/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams
 */
import { CodeIssue, FileChange, PRPlan } from './types';
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
export declare class FlowDiagramGenerator {
    private config;
    constructor(config?: Partial<FlowDiagramConfig>);
    /**
     * Generate flow diagram from PR changes
     */
    generateFlowDiagram(fileChanges: FileChange[], prPlan: PRPlan, issues?: CodeIssue[]): Promise<FlowDiagram | null>;
    /**
     * Filter files relevant for flow diagram
     */
    private filterRelevantFiles;
    /**
     * Extract nodes from file changes
     */
    private extractNodes;
    /**
     * Extract edges (relationships) between files
     */
    private extractEdges;
    /**
     * Analyze file relationships from patch content
     */
    private analyzeFileRelationships;
    /**
     * Extract import statements from a line
     */
    private extractImports;
    /**
     * Extract function/class calls from a line
     */
    private extractCalls;
    /**
     * Limit nodes to prevent diagram complexity
     */
    private limitNodes;
    /**
     * Filter edges to only include those between existing nodes
     */
    private filterEdges;
    /**
     * Generate Mermaid flowchart code
     */
    private generateMermaidCode;
    /**
     * Get Mermaid node shape based on type and status
     */
    private getNodeShape;
    /**
     * Get node styling based on status and importance
     */
    private getNodeStyle;
    /**
     * Get edge arrow type
     */
    private getEdgeArrow;
    /**
     * Generate CSS styling for the diagram
     */
    private generateStyling;
    /**
     * Determine file type based on filename and content
     */
    private determineFileType;
    /**
     * Determine node importance based on file changes and issues
     */
    private determineImportance;
    /**
     * Generate diagram title
     */
    private generateTitle;
    /**
     * Generate diagram description
     */
    private generateDescription;
    /**
     * Sanitize ID for Mermaid
     */
    private sanitizeId;
    /**
     * Get file label for display
     */
    private getFileLabel;
}
//# sourceMappingURL=flow-diagram-generator.d.ts.map