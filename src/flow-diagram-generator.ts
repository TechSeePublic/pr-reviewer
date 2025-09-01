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

      // Ask AI to generate the Mermaid diagram directly using a custom method
      const response = await this.generateMermaidWithAI(prompt, context);
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
        title: `Technical Flow: ${prPlan.overview.substring(0, 45)}${prPlan.overview.length > 45 ? '...' : ''}`,
        description: `This diagram shows the technical implementation and code flow for the changes in this PR.`,
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
   * Generate Mermaid diagram using direct AI call (not code review format)
   */
  private async generateMermaidWithAI(prompt: string, context: string): Promise<string | unknown> {
    if (!this.aiProvider) {
      throw new Error('AI provider not available');
    }

    // Access the underlying AI provider to make a direct call
    // This bypasses the code review format and gets raw text response
    if ('client' in this.aiProvider) {
      // Handle OpenAI provider
      const openaiProvider = this.aiProvider as any;

      try {
        const response = await openaiProvider.client.chat.completions.create({
          model: openaiProvider.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a flow diagram generator. Generate only valid Mermaid flowchart code. Do not provide code reviews or suggestions.',
            },
            {
              role: 'user',
              content: `${prompt}\n\n## Context:\n${context}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        });

        const result = response.choices[0]?.message?.content;
        if (!result) {
          throw new Error('No response from OpenAI for Mermaid generation');
        }

        logger.info('✅ Got direct AI response for Mermaid generation');
        return result;
      } catch (error) {
        logger.error('Direct OpenAI call failed:', error);
        throw error;
      }
    } else {
      // Fallback to reviewCode method but warn about it
      logger.warn('Unable to make direct AI call, falling back to reviewCode method');
      const response = await this.aiProvider.reviewCode(prompt, context, []);

      // For non-OpenAI providers, we still need to use the array response
      // Mark this as an array response so the parser knows how to handle it
      (response as any).__isArrayResponse = true;
      return response as any;
    }
  }

  /**
   * Build prompt for AI to generate Mermaid diagram
   */
  private buildMermaidPrompt(files: FileChange[], prPlan: PRPlan): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# TECHNICAL FLOW DIAGRAM GENERATION

Create a Mermaid flowchart that shows the TECHNICAL IMPLEMENTATION and CODE FLOW of the changes in this PR.

## Feature Description:
${prPlan.overview}

## Technical Changes Made:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR TASK: Create a flowchart showing the TECHNICAL FLOW from a DEVELOPER'S perspective.

FOCUS ON TECHNICAL IMPLEMENTATION:
- Function calls and method execution
- Data flow and transformations
- API calls and responses
- Validation and error handling
- Database operations
- System components interactions
- Key algorithms and logic

SHOW TECHNICAL ELEMENTS:
- Function/method entry points
- Data validation steps
- Processing logic and calculations
- External API calls
- Database queries/updates
- Error handling paths
- Return values and responses

DO NOT SHOW:
- End-user UI interactions
- Generic user actions like "clicks button"
- PR review processes

SYNTAX REQUIREMENTS:
- Keep node labels simple and short (under 30 characters)
- Do NOT use quotes (") inside node labels
- Use technical terms like "validate", "process", "query", "return"
- Keep the diagram focused (maximum 8-10 nodes)
- Use clear, technical language

EXAMPLE - For an authentication API:
flowchart TD
    A[Receive login request] --> B[Extract credentials]
    B --> C[Validate input format]
    C --> D{Input valid?}
    D -->|No| E[Return validation error]
    D -->|Yes| F[Query user database]
    F --> G{User exists?}
    G -->|No| H[Return user not found]
    G -->|Yes| I[Verify password hash]
    I --> J{Password correct?}
    J -->|No| K[Return auth failed]
    J -->|Yes| L[Generate JWT token]
    L --> M[Return success response]

Return only the Mermaid flowchart code, nothing else.`;
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

    // Log the AI response for debugging
    logger.info(`AI Response type: ${typeof response}`);

    // Handle array response (from reviewCode)
    if (Array.isArray(response)) {
      logger.info(`Processing array response with ${response.length} items`);

      // Check if this looks like a code review response instead of a flow diagram
      const isCodeReviewResponse =
        response.length > 0 && response.every(item => item.type && item.category && item.severity);

      if (isCodeReviewResponse) {
        logger.error('AI returned code review issues instead of Mermaid diagram');
        logger.error('This indicates the AI misunderstood the flow diagram request');
        throw new Error(
          'AI returned code review format instead of flow diagram - prompt may need adjustment'
        );
      }

      for (const item of response) {
        if (item.description || item.message) {
          const text = item.description || item.message;
          logger.info(`AI returned text (${text.length} chars): ${text.substring(0, 150)}...`);

          const extracted = this.extractMermaidFromText(text);
          if (extracted) {
            logger.info('✅ Successfully extracted Mermaid code from array item');
            mermaidCode = extracted;
            break;
          }
        }
      }
    }
    // Handle string response
    else if (typeof response === 'string') {
      logger.info(
        `AI returned string (${response.length} chars): ${response.substring(0, 150)}...`
      );
      const extracted = this.extractMermaidFromText(response);
      if (extracted) {
        logger.info('✅ Successfully extracted Mermaid code from string');
        mermaidCode = extracted;
      }
    }
    // Handle object response
    else if (response && typeof response === 'object') {
      logger.info('AI returned object response');
      const responseObj = response as Record<string, unknown>;
      if (typeof responseObj.mermaidCode === 'string') {
        logger.info('✅ Found mermaidCode property in object');
        mermaidCode = responseObj.mermaidCode;
      } else if (typeof responseObj.diagram === 'string') {
        logger.info('✅ Found diagram property in object');
        mermaidCode = responseObj.diagram;
      } else {
        logger.info(`Object keys: ${Object.keys(responseObj).join(', ')}`);
      }
    }

    // If no Mermaid code found, fail with detailed logging
    if (!mermaidCode || !mermaidCode.includes('flowchart')) {
      logger.error('Could not extract valid Mermaid code from AI response');
      logger.error(`Final mermaidCode variable: ${mermaidCode}`);
      logger.error(`Response type was: ${typeof response}`);
      if (Array.isArray(response)) {
        logger.error(
          `Array items structure: ${JSON.stringify(response.map(item => Object.keys(item || {})))}`
        );
      }
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
      logger.info('✅ Extracted flowchart TD pattern');
      return `flowchart TD\n${flowchartMatch[1]}`;
    }

    // Look for any flowchart statement
    const anyFlowchartMatch = text.match(/(flowchart\s+[\s\S]*?)(?=\n\n|\n```|$)/);
    if (anyFlowchartMatch && anyFlowchartMatch[1]) {
      logger.info('✅ Extracted general flowchart pattern');
      return anyFlowchartMatch[1];
    }

    // Look for Mermaid code blocks
    const codeBlockMatch = text.match(/```(?:mermaid)?\s*\n(flowchart[\s\S]*?)\n```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      logger.info('✅ Extracted from Mermaid code block');
      return codeBlockMatch[1];
    }

    // Try a simpler pattern - just look for flowchart anywhere
    const simpleFlowchartMatch = text.match(/flowchart[\s\S]*/);
    if (simpleFlowchartMatch) {
      logger.info('✅ Extracted using simple flowchart pattern');
      return simpleFlowchartMatch[0];
    }

    logger.warn(`❌ No Mermaid patterns found in text: ${text.substring(0, 100)}...`);
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

    // Check for problematic quotes in node labels
    const nodeWithQuotes = trimmed.match(/\[[^\]]*"[^\]]*\]/);
    if (nodeWithQuotes) {
      logger.warn('Mermaid validation failed: node labels contain quotes which break syntax');
      return false;
    }

    // Check for very long lines that might cause rendering issues
    const codeLines = trimmed.split('\n');
    const longLines = codeLines.filter(line => line.trim().length > 100);
    if (longLines.length > 0) {
      logger.warn(
        'Mermaid validation failed: contains very long lines that may cause rendering issues'
      );
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
