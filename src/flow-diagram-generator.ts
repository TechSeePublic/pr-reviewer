/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams using AI
 */

import { AIProvider, CodeIssue, FileChange, PRPlan } from './types';
import { logger } from './logger';

export interface FlowDiagramConfig {
  maxFiles: number;
  includeFileTypes: string[];
  excludeFileTypes: string[];
}

export interface FlowDiagram {
  title: string;
  description: string;
  mermaidCode: string;
}

export class FlowDiagramGenerator {
  private config: FlowDiagramConfig;
  private aiProvider: AIProvider | undefined;

  constructor(
    config: Partial<FlowDiagramConfig> = {},
    aiProvider?: AIProvider,
    _githubClient?: unknown
  ) {
    this.config = {
      maxFiles: 10,
      includeFileTypes: [
        '.ts',
        '.tsx',
        '.jsx',
        '.js',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.cpp',
        '.c',
        '.cs',
        '.vue',
        '.svelte',
      ],
      excludeFileTypes: [
        '.test.',
        '.spec.',
        '.d.ts',
        '.min.js',
        'bundle.',
        'dist/',
        'build/',
        'node_modules/',
        '.config.',
        'webpack.',
        'vite.',
        'rollup.',
      ],
      ...config,
    };
    this.aiProvider = aiProvider;
  }

  /**
   * Generate flow diagram from PR changes
   */
  async generateFlowDiagram(
    fileChanges: FileChange[],
    prPlan: PRPlan,
    _issues: CodeIssue[] = []
  ): Promise<FlowDiagram | null> {
    try {
      logger.info('Generating flow diagram for PR changes...');

      // Filter relevant files
      const relevantFiles = this.filterRelevantFiles(fileChanges);

      if (relevantFiles.length === 0) {
        logger.info('No relevant files found for flow diagram generation');
        return null;
      }

      // Generate diagram using AI
      if (!this.aiProvider) {
        logger.info('No AI provider available for flow diagram generation');
        return null;
      }

      return this.generateAIDiagram(relevantFiles, prPlan);
    } catch (error) {
      logger.error('Failed to generate flow diagram:', error);
      return null;
    }
  }

  /**
   * Generate diagram using AI to create Mermaid text directly
   */
  private async generateAIDiagram(files: FileChange[], prPlan: PRPlan): Promise<FlowDiagram> {
    logger.info('Generating AI flow diagram...');

    try {
      const prompt = this.buildMermaidPrompt(files, prPlan);
      const context = this.buildFileContext(files);

      // Ask AI to generate the Mermaid diagram directly
      const response = await this.aiProvider?.reviewCode(prompt, context, []);
      if (!response) {
        throw new Error('No response from AI provider');
      }

      // Parse the AI response to extract the Mermaid code
      const mermaidCode = this.parseMermaidResponse(response);

      // Validate the Mermaid code
      if (!this.isValidMermaidCode(mermaidCode)) {
        logger.warn('Generated Mermaid code failed validation');
        throw new Error('Invalid Mermaid code generated');
      }

      const diagram: FlowDiagram = {
        title: `PR Flow: ${prPlan.overview.substring(0, 50)}${prPlan.overview.length > 50 ? '...' : ''}`,
        description: `This diagram shows the flow of changes across ${files.length} files in this PR.`,
        mermaidCode,
      };

      logger.info('Generated AI flow diagram successfully');
      return diagram;
    } catch (error) {
      logger.error('AI diagram generation failed:', error);
      throw error;
    }
  }

  /**
   * Build prompt for AI to generate Mermaid diagram
   */
  private buildMermaidPrompt(files: FileChange[], prPlan: PRPlan): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# Analyze this PR and create a flow diagram

## What this PR does:
${prPlan.overview}

## Key changes:
${prPlan.keyChanges.join('\n')}

## Files modified:
${fileList}

Create a Mermaid flowchart that shows the logical flow of what this PR accomplishes. Focus on:

- The user's journey or business process
- What triggers the flow
- What decisions are made
- What actions happen
- What the outcome is

Think about the user experience, not the code structure. Show the logical flow from start to finish.

CRITICAL: You must return ONLY valid Mermaid flowchart code that:
- Starts with "flowchart TD" 
- Uses proper Mermaid syntax
- Has connected nodes with arrows (--> )
- Contains no markdown formatting or explanations

Return only the raw Mermaid code, nothing else.`;
  }

  /**
   * Build file context for AI analysis
   */
  private buildFileContext(files: FileChange[]): string {
    const contexts = files.map(file => {
      const changes = file.patch
        ? file.patch.substring(0, 1000) // Limit patch size
        : 'No patch available';

      return `## ${file.filename} (${file.status})
**Changes**: +${file.additions} -${file.deletions}

\`\`\`diff
${changes}${file.patch && file.patch.length > 1000 ? '...' : ''}
\`\`\`
`;
    });

    return contexts.join('\n\n');
  }

  /**
   * Parse AI response to extract Mermaid code
   */
  private parseMermaidResponse(response: unknown): string {
    let mermaidCode = '';

    // Handle array response (from reviewCode)
    if (Array.isArray(response)) {
      for (const item of response) {
        if (item.description || item.message) {
          const text = item.description || item.message;
          const extracted = this.extractMermaidFromText(text);
          if (extracted) {
            mermaidCode = extracted;
            break;
          }
        }
      }
    }
    // Handle string response
    else if (typeof response === 'string') {
      const extracted = this.extractMermaidFromText(response);
      if (extracted) {
        mermaidCode = extracted;
      }
    }
    // Handle object response
    else if (response && typeof response === 'object') {
      const responseObj = response as Record<string, unknown>;
      if (typeof responseObj.mermaidCode === 'string') {
        mermaidCode = responseObj.mermaidCode;
      } else if (typeof responseObj.diagram === 'string') {
        mermaidCode = responseObj.diagram;
      }
    }

    // If no Mermaid code found, fail
    if (!mermaidCode || !mermaidCode.includes('flowchart')) {
      logger.error('Could not extract valid Mermaid code from AI response');
      throw new Error('AI did not return valid Mermaid code');
    }

    return mermaidCode;
  }

  /**
   * Extract Mermaid code from text
   */
  private extractMermaidFromText(text: string): string | null {
    // Look for flowchart in the text
    const flowchartMatch = text.match(/flowchart\s+TD\s*\n([\s\S]*?)(?=\n\n|\n```|$)/);
    if (flowchartMatch && flowchartMatch[1]) {
      return `flowchart TD\n${flowchartMatch[1]}`;
    }

    // Look for any flowchart statement
    const anyFlowchartMatch = text.match(/(flowchart\s+[\s\S]*?)(?=\n\n|\n```|$)/);
    if (anyFlowchartMatch && anyFlowchartMatch[1]) {
      return anyFlowchartMatch[1];
    }

    // Look for Mermaid code blocks
    const codeBlockMatch = text.match(/```(?:mermaid)?\s*\n(flowchart[\s\S]*?)\n```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1];
    }

    return null;
  }

  /**
   * Validate Mermaid code for basic syntax
   */
  private isValidMermaidCode(code: string): boolean {
    if (!code || typeof code !== 'string') {
      logger.warn('Mermaid validation failed: code is not a string');
      return false;
    }

    const trimmed = code.trim();

    // Must start with flowchart
    if (!trimmed.startsWith('flowchart')) {
      logger.warn('Mermaid validation failed: does not start with flowchart');
      return false;
    }

    // Must have at least one arrow (flow connection)
    if (!trimmed.includes('-->')) {
      logger.warn('Mermaid validation failed: no flow arrows found');
      return false;
    }

    // Should not contain markdown blocks
    if (trimmed.includes('```')) {
      logger.warn('Mermaid validation failed: contains markdown code blocks');
      return false;
    }

    // Should not contain explanatory text (multiple paragraphs)
    const lines = trimmed.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    if (nonEmptyLines.length < 2) {
      logger.warn('Mermaid validation failed: too few lines');
      return false;
    }

    // Basic check for balanced brackets
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      logger.warn('Mermaid validation failed: unbalanced brackets');
      return false;
    }

    // Should not contain obvious explanation text
    if (
      trimmed.toLowerCase().includes('this diagram') ||
      trimmed.toLowerCase().includes('explanation') ||
      trimmed.toLowerCase().includes('represents')
    ) {
      logger.warn('Mermaid validation failed: contains explanatory text');
      return false;
    }

    return true;
  }

  /**
   * Filter files relevant for flow diagram
   */
  private filterRelevantFiles(fileChanges: FileChange[]): FileChange[] {
    const filtered = fileChanges.filter(file => {
      const filename = file.filename.toLowerCase();

      // Exclude by file extension patterns
      const isExcluded = this.config.excludeFileTypes.some(pattern =>
        filename.includes(pattern.toLowerCase())
      );

      if (isExcluded) {
        return false;
      }

      // Include by file extension
      const hasRelevantExtension = this.config.includeFileTypes.some(ext =>
        filename.endsWith(ext.toLowerCase())
      );

      if (!hasRelevantExtension) {
        return false;
      }

      // Exclude common config files
      const basename = filename.split('/').pop() || '';
      const commonExcludes = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'tsconfig.json',
        'readme.md',
        'license',
      ];

      if (commonExcludes.some(exclude => basename.includes(exclude))) {
        return false;
      }

      // Must have actual changes
      if (!file.patch || file.patch.trim().length === 0) {
        return false;
      }

      return true;
    });

    // Limit to max files to avoid overly complex diagrams
    return filtered.slice(0, this.config.maxFiles);
  }
}
