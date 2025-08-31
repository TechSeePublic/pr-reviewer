/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams
 */

import { CodeIssue, FileChange, PRPlan } from './types';
import { logger } from './logger';

export interface FlowDiagramConfig {
  maxNodes: number;
  includeFileTypes: string[];
  excludeFileTypes: string[];
  showOnlyModified: boolean;
}

export interface FlowNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'component' | 'module';
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'unchanged';
  importance: 'high' | 'medium' | 'low';
}

export interface FlowEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses';
  label?: string;
}

export interface FlowDiagram {
  title: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  mermaidCode: string;
}

export class FlowDiagramGenerator {
  private config: FlowDiagramConfig;

  constructor(config: Partial<FlowDiagramConfig> = {}) {
    this.config = {
      maxNodes: 15,
      includeFileTypes: [
        '.ts',
        '.js',
        '.tsx',
        '.jsx',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.cpp',
        '.c',
        '.cs',
      ],
      excludeFileTypes: ['.test.', '.spec.', '.d.ts', '.min.js'],
      showOnlyModified: true,
      ...config,
    };
  }

  /**
   * Generate flow diagram from PR changes
   */
  async generateFlowDiagram(
    fileChanges: FileChange[],
    prPlan: PRPlan,
    issues: CodeIssue[] = []
  ): Promise<FlowDiagram | null> {
    try {
      logger.info('Generating flow diagram for PR changes...');

      // Filter relevant files
      const relevantFiles = this.filterRelevantFiles(fileChanges);

      if (relevantFiles.length === 0) {
        logger.info('No relevant files found for flow diagram generation');
        return null;
      }

      // Analyze file relationships
      const nodes = this.extractNodes(relevantFiles, issues);
      const edges = this.extractEdges(relevantFiles);

      // Limit nodes to prevent diagram complexity
      const limitedNodes = this.limitNodes(nodes);
      const filteredEdges = this.filterEdges(edges, limitedNodes);

      // Generate Mermaid code
      const mermaidCode = this.generateMermaidCode(limitedNodes, filteredEdges);

      const diagram: FlowDiagram = {
        title: this.generateTitle(prPlan),
        description: this.generateDescription(prPlan, limitedNodes.length),
        nodes: limitedNodes,
        edges: filteredEdges,
        mermaidCode,
      };

      logger.info(
        `Generated flow diagram with ${limitedNodes.length} nodes and ${filteredEdges.length} edges`
      );
      return diagram;
    } catch (error) {
      logger.error('Failed to generate flow diagram:', error);
      return null;
    }
  }

  /**
   * Filter files relevant for flow diagram
   */
  private filterRelevantFiles(fileChanges: FileChange[]): FileChange[] {
    return fileChanges.filter(file => {
      // Check file extension
      const hasRelevantExtension = this.config.includeFileTypes.some(ext =>
        file.filename.toLowerCase().includes(ext)
      );

      if (!hasRelevantExtension) return false;

      // Exclude test files and other irrelevant files
      const isExcluded = this.config.excludeFileTypes.some(pattern =>
        file.filename.toLowerCase().includes(pattern)
      );

      if (isExcluded) return false;

      // If showOnlyModified is true, only include modified files
      if (this.config.showOnlyModified && file.status === 'removed') {
        return false;
      }

      return true;
    });
  }

  /**
   * Extract nodes from file changes
   */
  private extractNodes(fileChanges: FileChange[], issues: CodeIssue[]): FlowNode[] {
    const nodes: FlowNode[] = [];

    for (const file of fileChanges) {
      const fileIssues = issues.filter(issue => issue.file === file.filename);
      const hasHighSeverityIssues = fileIssues.some(
        issue => issue.severity === 'high' || issue.type === 'error'
      );

      const node: FlowNode = {
        id: this.sanitizeId(file.filename),
        label: this.getFileLabel(file.filename),
        type: this.determineFileType(file.filename),
        status: file.status,
        importance: this.determineImportance(file, fileIssues, hasHighSeverityIssues),
      };

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Extract edges (relationships) between files
   */
  private extractEdges(fileChanges: FileChange[]): FlowEdge[] {
    const edges: FlowEdge[] = [];

    for (const file of fileChanges) {
      if (file.patch) {
        const relationships = this.analyzeFileRelationships(file);
        edges.push(...relationships);
      }
    }

    return edges;
  }

  /**
   * Analyze file relationships from patch content
   */
  private analyzeFileRelationships(file: FileChange): FlowEdge[] {
    const edges: FlowEdge[] = [];

    if (!file.patch) return edges;

    const lines = file.patch.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));

    for (const line of addedLines) {
      // Look for import statements
      const importMatches = this.extractImports(line);
      for (const importPath of importMatches) {
        edges.push({
          from: this.sanitizeId(file.filename),
          to: this.sanitizeId(importPath),
          type: 'imports',
          label: 'imports',
        });
      }

      // Look for function calls or class usage
      const callMatches = this.extractCalls(line);
      for (const call of callMatches) {
        edges.push({
          from: this.sanitizeId(file.filename),
          to: this.sanitizeId(call),
          type: 'calls',
          label: 'uses',
        });
      }
    }

    return edges;
  }

  /**
   * Extract import statements from a line
   */
  private extractImports(line: string): string[] {
    const imports: string[] = [];

    // JavaScript/TypeScript imports
    const jsImportRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = jsImportRegex.exec(line)) !== null) {
      if (match[1]) {
        let importPath = match[1];

        // Handle relative imports
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          // Convert relative path to filename
          importPath = importPath.replace(/^\.\.?\//, '').replace(/\//g, '_');

          // Add appropriate extension if not present
          if (!importPath.includes('.')) {
            importPath += '.ts';
          }

          imports.push(importPath);
        } else if (!importPath.startsWith('@') && !importPath.includes('node_modules')) {
          // Internal module import
          imports.push(importPath.replace(/\//g, '_'));
        }
      }
    }

    // Also look for direct class/service usage
    const serviceRegex = /new\s+(\w+Service|\w+Client|\w+Manager|\w+Handler)/g;
    while ((match = serviceRegex.exec(line)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    // Python imports
    const pyImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
    while ((match = pyImportRegex.exec(line)) !== null) {
      const importName = match[1] || match[2];
      if (importName && !importName.startsWith('.')) {
        imports.push(importName + '.py');
      }
    }

    return imports;
  }

  /**
   * Extract function/class calls from a line
   */
  private extractCalls(line: string): string[] {
    const calls: string[] = [];

    // Look for function calls (simplified)
    const callRegex = /(\w+)\s*\(/g;
    let match;
    while ((match = callRegex.exec(line)) !== null) {
      if (match[1] && match[1].length > 2) {
        calls.push(match[1]);
      }
    }

    return calls.slice(0, 3); // Limit to prevent too many edges
  }

  /**
   * Limit nodes to prevent diagram complexity
   */
  private limitNodes(nodes: FlowNode[]): FlowNode[] {
    if (nodes.length <= this.config.maxNodes) {
      return nodes;
    }

    // Sort by importance and status
    const sortedNodes = nodes.sort((a, b) => {
      const importanceOrder = { high: 3, medium: 2, low: 1 };
      const statusOrder = { added: 3, modified: 2, renamed: 2, removed: 1, unchanged: 0 };

      const aScore = importanceOrder[a.importance] + statusOrder[a.status];
      const bScore = importanceOrder[b.importance] + statusOrder[b.status];

      return bScore - aScore;
    });

    return sortedNodes.slice(0, this.config.maxNodes);
  }

  /**
   * Filter edges to only include those between existing nodes
   */
  private filterEdges(edges: FlowEdge[], nodes: FlowNode[]): FlowEdge[] {
    const nodeIds = new Set(nodes.map(node => node.id));

    return edges.filter(edge => {
      // Direct ID match
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to) {
        return true;
      }

      // Try to match by partial name
      const fromNode = nodes.find(
        n =>
          n.label.toLowerCase().includes(edge.to.toLowerCase()) ||
          edge.to
            .toLowerCase()
            .includes(n.label.toLowerCase().replace('.ts', '').replace('.tsx', ''))
      );

      const toNode = nodes.find(
        n =>
          n.label.toLowerCase().includes(edge.from.toLowerCase()) ||
          edge.from
            .toLowerCase()
            .includes(n.label.toLowerCase().replace('.ts', '').replace('.tsx', ''))
      );

      if (fromNode && toNode && fromNode.id !== toNode.id) {
        // Update edge IDs to match actual node IDs
        edge.from = fromNode.id;
        edge.to = toNode.id;
        return true;
      }

      return false;
    });
  }

  /**
   * Generate Mermaid flowchart code
   */
  private generateMermaidCode(nodes: FlowNode[], edges: FlowEdge[]): string {
    let mermaid = 'flowchart TD\n';

    // Add nodes with styling
    for (const node of nodes) {
      const shape = this.getNodeShape(node);
      const style = this.getNodeStyle(node);

      mermaid += `    ${node.id}${shape}\n`;
      if (style) {
        mermaid += `    ${style}\n`;
      }
    }

    // Add edges
    for (const edge of edges) {
      const arrow = this.getEdgeArrow(edge.type);
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `    ${edge.from} ${arrow}${label} ${edge.to}\n`;
    }

    // Add styling classes
    mermaid += this.generateStyling();

    return mermaid;
  }

  /**
   * Get Mermaid node shape based on type and status
   */
  private getNodeShape(node: FlowNode): string {
    const label = node.label;

    switch (node.type) {
      case 'component':
        return `[["${label}"]]`;
      case 'class':
        return `["${label}"]`;
      case 'function':
        return `("${label}")`;
      case 'module':
        return `{{"${label}"}}`;
      default:
        return `["${label}"]`;
    }
  }

  /**
   * Get node styling based on status and importance
   */
  private getNodeStyle(node: FlowNode): string | null {
    const classNames: string[] = [];

    // Status styling
    switch (node.status) {
      case 'added':
        classNames.push('added');
        break;
      case 'modified':
        classNames.push('modified');
        break;
      case 'removed':
        classNames.push('removed');
        break;
      case 'renamed':
        classNames.push('renamed');
        break;
    }

    // Importance styling
    if (node.importance === 'high') {
      classNames.push('high-importance');
    }

    return classNames.length > 0 ? `    class ${node.id} ${classNames.join(',')}` : null;
  }

  /**
   * Get edge arrow type
   */
  private getEdgeArrow(type: string): string {
    switch (type) {
      case 'imports':
        return '-->';
      case 'calls':
        return '-..->';
      case 'extends':
        return '==>';
      case 'implements':
        return '==>';
      default:
        return '-->';
    }
  }

  /**
   * Generate CSS styling for the diagram
   */
  private generateStyling(): string {
    return `
    classDef added fill:#d4edda,stroke:#28a745,stroke-width:2px
    classDef modified fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef removed fill:#f8d7da,stroke:#dc3545,stroke-width:2px
    classDef renamed fill:#e2e3e5,stroke:#6c757d,stroke-width:2px
    classDef high-importance stroke:#dc3545,stroke-width:3px
`;
  }

  /**
   * Determine file type based on filename and content
   */
  private determineFileType(filename: string): FlowNode['type'] {
    const ext = filename.toLowerCase();

    if (ext.includes('component') || ext.includes('.tsx') || ext.includes('.jsx')) {
      return 'component';
    }

    if (ext.includes('class') || ext.includes('.java') || ext.includes('.cs')) {
      return 'class';
    }

    if (ext.includes('util') || ext.includes('helper') || ext.includes('service')) {
      return 'module';
    }

    return 'file';
  }

  /**
   * Determine node importance based on file changes and issues
   */
  private determineImportance(
    file: FileChange,
    issues: CodeIssue[],
    hasHighSeverityIssues: boolean
  ): FlowNode['importance'] {
    // High importance if has high severity issues
    if (hasHighSeverityIssues) {
      return 'high';
    }

    // High importance for large changes
    if (file.changes > 50) {
      return 'high';
    }

    // Medium importance for moderate changes or multiple issues
    if (file.changes > 10 || issues.length > 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate diagram title
   */
  private generateTitle(prPlan: PRPlan): string {
    return `PR Flow Diagram: ${prPlan.overview.slice(0, 50)}${prPlan.overview.length > 50 ? '...' : ''}`;
  }

  /**
   * Generate diagram description
   */
  private generateDescription(prPlan: PRPlan, nodeCount: number): string {
    return `This diagram shows the flow of changes across ${nodeCount} key files in this PR. ${prPlan.keyChanges.slice(0, 2).join(', ')}.`;
  }

  /**
   * Sanitize ID for Mermaid
   */
  private sanitizeId(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1') // Ensure doesn't start with number
      .slice(0, 20); // Limit length
  }

  /**
   * Get file label for display
   */
  private getFileLabel(filename: string): string {
    const parts = filename.split('/');
    const name = parts[parts.length - 1] || filename;

    // Truncate long names
    return name.length > 20 ? name.slice(0, 17) + '...' : name;
  }
}
