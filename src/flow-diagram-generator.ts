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
  diagramType?: 'feature' | 'bugfix' | 'optimization' | 'refactor' | 'maintenance';
  visualizationType?:
    | 'flowchart'
    | 'graph'
    | 'gitgraph'
    | 'classDiagram'
    | 'sequenceDiagram'
    | 'stateDiagram';
}

export type PRType = 'feature' | 'bugfix' | 'optimization' | 'refactor' | 'maintenance' | 'unknown';

export type VisualizationType =
  | 'flowchart'
  | 'graph'
  | 'gitgraph'
  | 'classDiagram'
  | 'sequenceDiagram'
  | 'stateDiagram';

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

      // Detect PR type and visualization type
      const prType = this.detectPRType(prPlan, relevantFiles);
      const visualizationType = this.selectVisualizationType(prType, relevantFiles, prPlan);
      return this.generateAIDiagram(relevantFiles, prPlan, prType, visualizationType);
    } catch (error) {
      logger.error('Failed to generate flow diagram:', error);
      return null;
    }
  }

  /**
   * Generate diagram using AI to create Mermaid text directly
   */
  private async generateAIDiagram(
    files: FileChange[],
    prPlan: PRPlan,
    prType: PRType,
    visualizationType: VisualizationType
  ): Promise<FlowDiagram> {
    logger.info(`Generating AI ${visualizationType} diagram for ${prType} PR...`);

    try {
      const prompt = this.buildSpecializedPrompt(files, prPlan, prType, visualizationType);
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
        title: this.generateTitle(prPlan, prType),
        description: this.generateSmartDescription(prPlan, files.length, prType, visualizationType),
        mermaidCode,
        ...(prType !== 'unknown' && { diagramType: prType }),
        visualizationType,
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
      // Handle OpenAI provider (including Azure OpenAI)
      const openaiProvider = this.aiProvider as any;

      try {
        // Check if this is an Azure/OpenAI provider that has the new methods
        const requiresMaxCompletionTokens =
          typeof openaiProvider.requiresMaxCompletionTokens === 'function'
            ? openaiProvider.requiresMaxCompletionTokens()
            : false;
        const supportsTemperature =
          typeof openaiProvider.supportsTemperature === 'function'
            ? openaiProvider.supportsTemperature()
            : true; // Default to true for backward compatibility

        logger.info(
          `Flow diagram generation: model=${openaiProvider.model}, requiresMaxCompletionTokens=${requiresMaxCompletionTokens}, supportsTemperature=${supportsTemperature}`
        );

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
          ...(supportsTemperature && { temperature: 0.1 }),
          ...(requiresMaxCompletionTokens ? { max_completion_tokens: 2000 } : { max_tokens: 2000 }),
        });

        const result = response.choices[0]?.message?.content;
        if (!result) {
          throw new Error('No response from OpenAI for Mermaid generation');
        }

        logger.info('✅ Got direct AI response for Mermaid generation');
        return result;
      } catch (error) {
        logger.error('Direct OpenAI call failed:', error);

        // Provide more detailed error information
        if (error && typeof error === 'object') {
          const errorObj = error as any;
          if (errorObj.status) {
            logger.error(`API Error Status: ${errorObj.status}`);
          }
          if (errorObj.message) {
            logger.error(`API Error Message: ${errorObj.message}`);
          }
          if (errorObj.code) {
            logger.error(`API Error Code: ${errorObj.code}`);
          }
        }

        throw error;
      }
    } else {
      // Fallback to reviewCode method but warn about it
      logger.warn('Unable to make direct AI call, falling back to reviewCode method');
      try {
        const response = await this.aiProvider.reviewCode(prompt, context, []);

        // For non-OpenAI providers, we still need to use the array response
        // Mark this as an array response so the parser knows how to handle it
        (response as any).__isArrayResponse = true;
        return response as any;
      } catch (error) {
        logger.error('Fallback reviewCode method also failed:', error);
        throw error;
      }
    }
  }

  /**
   * Detect the type of PR based on overview and changes
   */
  private detectPRType(prPlan: PRPlan, files: FileChange[]): PRType {
    const overview = prPlan.overview.toLowerCase();
    const keyChanges = prPlan.keyChanges.join(' ').toLowerCase();
    const fileNames = files.map(f => f.filename.toLowerCase()).join(' ');
    const allText = `${overview} ${keyChanges} ${fileNames}`;

    // Feature detection
    if (
      allText.includes('add') ||
      allText.includes('create') ||
      allText.includes('implement') ||
      allText.includes('new feature') ||
      allText.includes('introduce')
    ) {
      return 'feature';
    }

    // Bug fix detection
    if (
      allText.includes('fix') ||
      allText.includes('bug') ||
      allText.includes('resolve') ||
      allText.includes('patch') ||
      allText.includes('correct')
    ) {
      return 'bugfix';
    }

    // Optimization detection
    if (
      allText.includes('optimize') ||
      allText.includes('performance') ||
      allText.includes('speed up') ||
      allText.includes('improve performance') ||
      allText.includes('faster') ||
      allText.includes('efficiency')
    ) {
      return 'optimization';
    }

    // Refactor detection
    if (
      allText.includes('refactor') ||
      allText.includes('restructure') ||
      allText.includes('reorganize') ||
      allText.includes('clean up') ||
      allText.includes('simplify')
    ) {
      return 'refactor';
    }

    // Maintenance detection
    if (
      allText.includes('update') ||
      allText.includes('upgrade') ||
      allText.includes('maintain') ||
      allText.includes('dependency') ||
      allText.includes('version')
    ) {
      return 'maintenance';
    }

    return 'unknown';
  }

  /**
   * Select the best visualization type for the PR
   */
  private selectVisualizationType(
    prType: PRType,
    files: FileChange[],
    prPlan: PRPlan
  ): VisualizationType {
    const overview = prPlan.overview.toLowerCase();
    const keyChanges = prPlan.keyChanges.join(' ').toLowerCase();
    const fileNames = files.map(f => f.filename.toLowerCase()).join(' ');

    switch (prType) {
      case 'feature':
        // For features, use flowchart to show user journey
        return 'flowchart';

      case 'bugfix':
        // For bug fixes, use stateDiagram to show before/after states
        if (
          overview.includes('state') ||
          overview.includes('status') ||
          keyChanges.includes('state')
        ) {
          return 'stateDiagram';
        }
        return 'flowchart';

      case 'optimization':
        // For optimizations, use graph to show performance relationships
        if (
          overview.includes('performance') ||
          overview.includes('cache') ||
          overview.includes('speed')
        ) {
          return 'graph';
        }
        return 'flowchart';

      case 'refactor':
        // For refactoring, use classDiagram if it involves class structure
        if (
          fileNames.includes('class') ||
          fileNames.includes('model') ||
          overview.includes('structure')
        ) {
          return 'classDiagram';
        }
        // Use graph for architectural changes
        if (
          overview.includes('architecture') ||
          overview.includes('organize') ||
          keyChanges.includes('module')
        ) {
          return 'graph';
        }
        return 'flowchart';

      case 'maintenance':
        // For maintenance, use gitgraph to show update progression
        if (
          overview.includes('dependency') ||
          overview.includes('version') ||
          overview.includes('update')
        ) {
          return 'gitgraph';
        }
        return 'graph';

      default:
        return 'flowchart';
    }
  }

  /**
   * Build specialized prompt based on PR type and visualization type
   */
  private buildSpecializedPrompt(
    files: FileChange[],
    prPlan: PRPlan,
    prType: PRType,
    visualizationType: VisualizationType
  ): string {
    switch (prType) {
      case 'feature':
        return this.buildFeaturePrompt(files, prPlan, visualizationType);
      case 'bugfix':
        return this.buildBugfixPrompt(files, prPlan, visualizationType);
      case 'optimization':
        return this.buildOptimizationPrompt(files, prPlan, visualizationType);
      case 'refactor':
        return this.buildRefactorPrompt(files, prPlan, visualizationType);
      case 'maintenance':
        return this.buildMaintenancePrompt(files, prPlan, visualizationType);
      default:
        return this.buildGenericPrompt(files, prPlan, visualizationType);
    }
  }

  /**
   * Build prompt for new features - focus on user journey
   */
  private buildFeaturePrompt(
    files: FileChange[],
    prPlan: PRPlan,
    visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# NEW FEATURE ${visualizationType.toUpperCase()} DIAGRAM

Create a Mermaid ${visualizationType} that explains the complete USER JOURNEY for this new feature.

## New Feature Description:
${prPlan.overview}

## Key Implementation Details:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show users and stakeholders WHAT this new feature does and HOW users will interact with it.

**MANDATORY REQUIREMENTS - YOUR DIAGRAM MUST INCLUDE:**
1. **AT LEAST 3 DECISION POINTS** using diamond shapes {Is condition met?}
2. **MULTIPLE BRANCHING PATHS** - success/error/alternative flows
3. **CONDITIONAL ARROWS** with labels like -->|Yes| or -->|No|
4. **ERROR HANDLING FLOWS** showing what happens when things go wrong
5. **PARALLEL PROCESSES** where applicable (multiple things happening)
6. **VALIDATION STEPS** that can pass or fail
7. **USER CHOICE POINTS** where users must decide between options

FOCUS ON COMPLEX USER EXPERIENCE:
1. HOW users discover/access this feature
2. WHAT validation/checks happen at each step
3. WHAT decisions the system or users need to make
4. WHAT happens in success vs failure scenarios  
5. WHAT alternative paths exist
6. HOW errors are handled and recovery works
7. WHAT parallel processes might run
8. HOW this improves their workflow

MAKE IT REALISTIC AND BRANCHING:
- Start with user action or need
- Add validation checks that can fail
- Show decision points where flow splits
- Include error scenarios and recovery paths
- Add conditional logic and user choices
- Show parallel processing where relevant
- End with multiple possible outcomes
- Use business language stakeholders understand

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters
- MUST include diamond shapes {} for decisions
- MUST include conditional arrows -->|condition|

**CREATIVE FREEDOM GUIDELINES:**
- Design a UNIQUE flow that matches the specific changes in this PR
- Think about the REAL user scenarios and business logic involved
- Create decision points that make sense for THIS specific feature
- Include error handling that's relevant to THIS implementation
- Show the actual complexity and edge cases for THIS feature

**SYNTAX REMINDERS:**
- Decision nodes: {Is this condition true?}
- Conditional flows: -->|Yes| or -->|No| or -->|Error|
- Keep labels clear and specific to this feature

Return only the Mermaid ${visualizationType} code with creative, PR-specific branching logic.`;
  }

  /**
   * Build prompt for bug fixes - focus on problem and solution
   */
  private buildBugfixPrompt(
    files: FileChange[],
    prPlan: PRPlan,
    visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# BUG FIX ${visualizationType.toUpperCase()} DIAGRAM

Create a Mermaid ${visualizationType} that shows HOW this bug fix changes the user experience.

## Bug Fix Description:
${prPlan.overview}

## What Was Fixed:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show the BEFORE vs AFTER behavior so users understand what changed.

**MANDATORY REQUIREMENTS - YOUR DIAGRAM MUST INCLUDE:**
1. **MULTIPLE DECISION POINTS** showing where validation/checks occur
2. **BEFORE/AFTER PATHS** comparing old broken vs new fixed flows
3. **ERROR SCENARIOS** that were problematic before the fix
4. **VALIDATION STEPS** that now work correctly
5. **CONDITIONAL BRANCHING** for success/failure cases
6. **RECOVERY MECHANISMS** that are now improved
7. **EDGE CASE HANDLING** that was previously broken

FOCUS ON COMPLEX PROBLEM & SOLUTION:
1. WHAT scenario triggered the bug (with decision points)
2. WHERE validation failed in the old flow
3. WHAT conditions caused the problem
4. HOW the fix adds proper checks and branches
5. WHAT new validation logic prevents issues
6. HOW error handling now works with multiple paths
7. WHAT alternative scenarios now work correctly

SHOW THE COMPREHENSIVE IMPROVEMENT:
- Start with the problematic user scenario
- Show decision points where old logic failed
- Add new validation steps with pass/fail branches
- Demonstrate improved error handling paths
- Include multiple success/failure scenarios
- Show recovery and retry mechanisms
- Highlight conditional logic improvements
- End with robust user experience

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters
- MUST include diamond shapes {} for decisions
- MUST include conditional arrows -->|condition|

**CREATIVE FREEDOM GUIDELINES:**
- Design a UNIQUE flow that shows the specific bug and how this fix addresses it
- Think about the REAL scenarios where the bug occurred
- Create decision points that demonstrate the improved validation/logic
- Show the actual error conditions that are now handled properly
- Include recovery paths that are specific to this bug fix

**SYNTAX REMINDERS:**
- Decision nodes: {Does this check pass now?}
- Conditional flows: -->|Fixed| or -->|Still fails| or -->|Retry|
- Keep labels specific to the actual bug being fixed

Use green styling for improved/fixed parts: style NodeId fill:#90EE90

Return only the Mermaid flowchart code with creative, bug-specific branching logic.`;
  }

  /**
   * Build prompt for optimizations - focus on improvements
   */
  private buildOptimizationPrompt(
    files: FileChange[],
    prPlan: PRPlan,
    _visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# OPTIMIZATION FLOW DIAGRAM

Create a Mermaid flowchart that shows HOW this optimization improves performance or efficiency.

## Optimization Description:
${prPlan.overview}

## Performance Improvements:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show WHAT was optimized and HOW it affects the user experience.

**MANDATORY REQUIREMENTS - YOUR DIAGRAM MUST INCLUDE:**
1. **MULTIPLE DECISION POINTS** for optimization logic
2. **BEFORE/AFTER COMPARISONS** showing old vs new paths
3. **CACHE/PERFORMANCE CHECKS** with conditional flows
4. **FALLBACK MECHANISMS** when optimizations fail
5. **PARALLEL PROCESSING** where performance is gained
6. **BOTTLENECK IDENTIFICATION** and resolution paths
7. **RESOURCE MANAGEMENT** decisions and flows

FOCUS ON COMPLEX PERFORMANCE IMPROVEMENTS:
1. WHAT process was slow/inefficient with decision points
2. WHERE bottlenecks occurred with conditional checks
3. HOW optimization logic decides between paths
4. WHAT validation ensures optimization works
5. WHEN fallbacks are needed if optimization fails
6. HOW parallel processes improve speed
7. WHAT monitoring detects performance issues

HIGHLIGHT THE COMPREHENSIVE GAINS:
- Show optimization decision logic
- Include cache hit/miss scenarios
- Demonstrate parallel vs sequential paths
- Add performance monitoring branches
- Show resource optimization choices
- Include error handling for failed optimizations
- Demonstrate measurable improvement paths

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters
- MUST include diamond shapes {} for decisions
- MUST include conditional arrows -->|condition|

**CREATIVE FREEDOM GUIDELINES:**
- Design a UNIQUE flow showing the specific performance improvements in this PR
- Think about the REAL bottlenecks that were addressed
- Create decision points for cache hits/misses, load balancing, etc. based on actual changes
- Show the specific optimization strategies used in this implementation
- Include monitoring and fallback logic relevant to these optimizations

**SYNTAX REMINDERS:**
- Decision nodes: {Is cache available?} {Load high?} {Optimization successful?}
- Conditional flows: -->|Hit| -->|Miss| -->|Fast| -->|Slow|
- Keep labels specific to the actual optimizations made

Use green styling for optimized parts: style NodeId fill:#90EE90

Return only the Mermaid flowchart code with creative, optimization-specific branching logic.`;
  }

  /**
   * Build prompt for refactoring - focus on structural improvements
   */
  private buildRefactorPrompt(
    files: FileChange[],
    prPlan: PRPlan,
    _visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# REFACTORING FLOW DIAGRAM

Create a Mermaid flowchart that shows HOW the code structure was improved while maintaining functionality.

## Refactoring Description:
${prPlan.overview}

## Structural Changes:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show WHAT was restructured and WHY it's better for maintenance/development.

FOCUS ON STRUCTURAL IMPROVEMENTS:
1. WHAT the main process flow is (unchanged for users)
2. HOW the internal structure is now better organized
3. WHERE complexity was reduced
4. WHAT makes it easier to maintain
5. HOW it improves code quality

SHOW INTERNAL IMPROVEMENTS:
- Maintain the same user-facing flow
- Highlight cleaner internal processes
- Show better separation of concerns
- Indicate improved error handling
- Demonstrate better code organization

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters
- Example: Use "Controllers - Async Refactor" not "Controllers (Async/Await Refactor)"

EXAMPLE STRUCTURE:
flowchart TD
    A[User request] --> B[Unified validation layer]
    B --> C[Business logic handler]
    C --> D[Data access layer]
    D --> E[Response formatter]
    E --> F[User receives response]
    
    subgraph "Improved Structure"
        B
        C
        D
        E
    end
    
    style B fill:#E6E6FA
    style C fill:#E6E6FA
    style D fill:#E6E6FA
    style E fill:#E6E6FA

Use light purple for refactored components.

Return only the Mermaid flowchart code that shows the improved structure.`;
  }

  /**
   * Build prompt for maintenance - focus on what was updated
   */
  private buildMaintenancePrompt(
    files: FileChange[],
    prPlan: PRPlan,
    _visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# MAINTENANCE UPDATE DIAGRAM

Create a Mermaid flowchart that shows WHAT was updated and HOW it affects the system.

## Maintenance Description:
${prPlan.overview}

## Updates Made:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show WHAT components were updated and WHY this matters for the system.

FOCUS ON UPDATES:
1. WHAT components were updated
2. HOW the updates improve reliability/security
3. WHERE the changes have impact
4. WHAT users can expect (if anything)
5. HOW this keeps the system healthy

SHOW MAINTENANCE VALUE:
- Highlight updated components
- Show improved reliability/security
- Indicate compatibility improvements
- Demonstrate system health benefits
- Keep user impact minimal focus

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters

EXAMPLE STRUCTURE:
flowchart TD
    A[System operates normally] --> B[Updated dependencies]
    B --> C[Enhanced security checks]
    C --> D[Improved compatibility]
    D --> E[Better performance]
    E --> F[Users enjoy stable system]
    
    style B fill:#87CEEB
    style C fill:#98FB98
    style D fill:#87CEEB
    style E fill:#98FB98

Use blue for updates and light green for improvements.

Return only the Mermaid flowchart code that shows the maintenance updates.`;
  }

  /**
   * Build generic prompt for unknown PR types
   */
  private buildGenericPrompt(
    files: FileChange[],
    prPlan: PRPlan,
    _visualizationType: VisualizationType
  ): string {
    const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');

    return `# EXPLANATORY FLOW DIAGRAM GENERATION

Create a Mermaid flowchart that CLEARLY EXPLAINS what this PR does and why it matters.

## What This PR Accomplishes:
${prPlan.overview}

## Key Changes Made:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Create a flowchart that explains the COMPLETE USER JOURNEY and BUSINESS LOGIC, not just technical implementation.

**MANDATORY REQUIREMENTS - YOUR DIAGRAM MUST INCLUDE:**
1. **AT LEAST 3 DECISION POINTS** using diamond shapes {Is condition met?}
2. **MULTIPLE BRANCHING PATHS** for different scenarios and outcomes
3. **CONDITIONAL ARROWS** with clear labels like -->|Yes| or -->|Error|
4. **ERROR HANDLING FLOWS** showing what happens when things fail
5. **VALIDATION STEPS** that can pass or fail with consequences
6. **USER CHOICE POINTS** where users make decisions
7. **RECOVERY MECHANISMS** for handling failures and retries

FOCUS ON COMPREHENSIVE EXPLANATION:
1. WHAT triggers this flow with validation checkpoints
2. WHAT business problem is solved with decision logic
3. WHAT decisions are made and WHY with conditional paths
4. WHAT data validation and processing occurs
5. WHAT happens in success vs multiple failure scenarios
6. HOW different components interact with error handling
7. WHAT the end result means for users in each case

MAKE IT REALISTICALLY COMPLEX:
- Use clear, descriptive labels that explain PURPOSE and CONDITIONS
- Show the complete logical progression with branching
- Include decision points with meaningful conditions and outcomes
- Explain what happens in success, error, and edge cases
- Add validation steps that can fail with recovery options
- Use business terms stakeholders understand
- Show comprehensive value/outcome for different user paths
- Include parallel processes where applicable

CRITICAL SYNTAX RULES:
- DO NOT use parentheses, quotes, or brackets inside node labels
- Keep node labels simple and descriptive
- Use hyphens or spaces instead of special characters
- MUST include diamond shapes {} for decisions
- MUST include conditional arrows -->|condition|

**CREATIVE FREEDOM GUIDELINES:**
- Design a UNIQUE flow that tells the specific story of this PR
- Think about the REAL user journey and business value being created
- Create decision points that reflect the actual logic in the code changes
- Show the genuine complexity and edge cases introduced by these changes
- Include validation, error handling, and user choices specific to this implementation

**SYNTAX REMINDERS:**
- Decision nodes: {Does condition match the actual code?}
- Conditional flows: -->|ActualCondition| based on the real logic
- Keep labels descriptive of what this PR actually does

Return only the Mermaid flowchart code that creatively explains this specific PR's story.`;
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
   * Validate Mermaid code for quality and usefulness
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

    // Check for problematic characters in node labels
    const nodeWithQuotes = trimmed.match(/\[[^\]]*"[^\]]*\]/);
    if (nodeWithQuotes) {
      logger.warn('Mermaid validation failed: node labels contain quotes which break syntax');
      return false;
    }

    // Check for problematic parentheses in node labels
    const nodeWithParens = trimmed.match(/\[[^\]]*\([^\]]*\]/);
    if (nodeWithParens) {
      logger.warn('Mermaid validation failed: node labels contain parentheses which break syntax');
      return false;
    }

    // Check for other problematic characters
    const problematicChars = /[[\]{}()"'`]/;
    const codeLines2 = trimmed.split('\n');
    for (const line of codeLines2) {
      const nodeMatch = line.match(/\[([^\]]+)\]/);
      if (nodeMatch && nodeMatch[1]) {
        const nodeText = nodeMatch[1];
        if (problematicChars.test(nodeText)) {
          logger.warn(
            `Mermaid validation failed: node label "${nodeText}" contains problematic characters`
          );
          return false;
        }
      }
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

    // Check for minimum number of steps (nodes) - must have at least 5 steps for meaningful complexity
    const nodeCount = this.countMermaidNodes(trimmed);
    if (nodeCount < 5) {
      logger.warn(
        `Mermaid validation failed: diagram has only ${nodeCount} steps, minimum 5 required for meaningful flow`
      );
      return false;
    }

    // Quality checks for explanatory value
    if (!this.hasExplanatoryValue(trimmed)) {
      logger.warn('Mermaid validation failed: diagram lacks explanatory value');
      return false;
    }

    return true;
  }

  /**
   * Check if the diagram has good explanatory value
   */
  private hasExplanatoryValue(mermaidCode: string): boolean {
    const text = mermaidCode.toLowerCase();

    // Check for generic/poor node labels that don't explain anything
    const badPatterns = [
      'function call',
      'process data',
      'handle request',
      'return response',
      'execute logic',
      'perform operation',
      'run code',
      'call method',
      'step 1',
      'step 2',
      'step 3',
    ];

    const hasGenericNodes = badPatterns.some(pattern => text.includes(pattern));
    if (hasGenericNodes) {
      logger.warn("Diagram contains generic nodes that don't explain the specific purpose");
      return false;
    }

    // Check for good explanatory terms that indicate value
    const goodPatterns = [
      'user',
      'validate',
      'save',
      'create',
      'update',
      'delete',
      'send',
      'receive',
      'check',
      'verify',
      'analyze',
      'generate',
      'upload',
      'download',
      'authenticate',
      'authorize',
      'process',
      'transform',
      'calculate',
    ];

    const hasExplanatoryTerms = goodPatterns.some(pattern => text.includes(pattern));
    if (!hasExplanatoryTerms) {
      logger.warn('Diagram lacks explanatory terms that describe what actually happens');
      return false;
    }

    // ENFORCE decision points (good flow diagrams MUST have logical branches)
    const hasDecisions = text.includes('{') && text.includes('}');
    const hasConditionalFlows = text.includes('|');
    const decisionCount = (text.match(/\{[^}]*\}/g) || []).length;
    const conditionalCount = (text.match(/\|[^|]*\|/g) || []).length;

    if (!hasDecisions) {
      logger.warn('Mermaid validation failed: diagram lacks decision points (diamond shapes {})');
      return false;
    }

    if (decisionCount < 2) {
      logger.warn(
        `Mermaid validation failed: diagram has only ${decisionCount} decision points, minimum 2 required for proper branching`
      );
      return false;
    }

    if (!hasConditionalFlows) {
      logger.warn('Mermaid validation failed: diagram lacks conditional arrows (-->|condition|)');
      return false;
    }

    if (conditionalCount < 2) {
      logger.warn(
        `Mermaid validation failed: diagram has only ${conditionalCount} conditional flows, minimum 2 required for meaningful branching`
      );
      return false;
    }

    // Check for branching complexity - count arrow connections
    const arrowCount = (text.match(/-->/g) || []).length;
    const nodeCount = this.countMermaidNodes(mermaidCode);

    // Good diagrams should have more arrows than nodes (indicating branching)
    if (arrowCount <= nodeCount) {
      logger.warn(
        `Mermaid validation failed: diagram appears too linear (${arrowCount} arrows for ${nodeCount} nodes). Need more branching.`
      );
      return false;
    }

    return true;
  }

  /**
   * Count the number of nodes/steps in a Mermaid flowchart
   */
  private countMermaidNodes(mermaidCode: string): number {
    const lines = mermaidCode.split('\n');
    const uniqueNodes = new Set<string>();

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip flowchart declaration line and empty lines
      if (!trimmedLine || trimmedLine.startsWith('flowchart')) {
        continue;
      }

      // Extract all node IDs from the line using comprehensive regex patterns
      // This will match node IDs in various contexts:
      // - Standalone node definitions: A[Label], B{Label}, C(Label)
      // - Arrow connections: A --> B, A -->|label| B, A --> B[Label]
      // - Multiple connections on same line

      // Pattern to match node IDs (typically single letters A-Z, but could be multi-char)
      const nodeMatches = trimmedLine.match(/\b([A-Z]+)(?=\s*(?:-->|\[|\{|\(|$)|\s*-->)/g);

      if (nodeMatches) {
        for (const nodeId of nodeMatches) {
          uniqueNodes.add(nodeId.trim());
        }
      }

      // Also extract destination nodes from arrows with inline labels
      const arrowDestMatches = trimmedLine.match(/-->\s*(?:\|[^|]*\|\s*)?([A-Z]+)/g);
      if (arrowDestMatches) {
        for (const match of arrowDestMatches) {
          const destMatch = match.match(/-->\s*(?:\|[^|]*\|\s*)?([A-Z]+)/);
          if (destMatch && destMatch[1]) {
            uniqueNodes.add(destMatch[1]);
          }
        }
      }
    }

    logger.info(
      `Counted ${uniqueNodes.size} unique nodes in Mermaid diagram: ${Array.from(uniqueNodes).join(', ')}`
    );
    return uniqueNodes.size;
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

  /**
   * Generate specialized title based on PR type
   */
  private generateTitle(prPlan: PRPlan, prType: PRType): string {
    const shortOverview =
      prPlan.overview.substring(0, 50) + (prPlan.overview.length > 50 ? '...' : '');

    switch (prType) {
      case 'feature':
        return `🆕 New Feature: ${shortOverview}`;
      case 'bugfix':
        return `🐛 Bug Fix: ${shortOverview}`;
      case 'optimization':
        return `⚡ Performance: ${shortOverview}`;
      case 'refactor':
        return `🔧 Refactor: ${shortOverview}`;
      case 'maintenance':
        return `🔄 Maintenance: ${shortOverview}`;
      default:
        return `What This PR Does: ${shortOverview}`;
    }
  }

  /**
   * Generate a smart, contextual description for the flow diagram
   */
  private generateSmartDescription(
    prPlan: PRPlan,
    fileCount: number,
    prType: PRType,
    visualizationType: VisualizationType
  ): string {
    let description = '';

    // Generate description based on PR type and visualization type
    const visualName = this.getVisualizationDisplayName(visualizationType);

    switch (prType) {
      case 'feature':
        description = `This ${visualName} shows the complete user journey for the new feature. Follow the flow to understand how users will discover, use, and benefit from this addition. `;
        break;
      case 'bugfix':
        if (visualizationType === 'stateDiagram') {
          description = `This state diagram shows how the bug fix changes system behavior. States represent different conditions, with the fix improving transitions and preventing problematic states. `;
        } else {
          description = `This ${visualName} illustrates how the bug fix improves the user experience. Green highlighted sections show the corrected behavior that prevents the original issue. `;
        }
        break;
      case 'optimization':
        if (visualizationType === 'graph') {
          description = `This graph shows the relationships between system components and how optimization improves performance. Highlighted connections show where speed/efficiency gains occur. `;
        } else {
          description = `This ${visualName} demonstrates the performance improvements made to the system. Gold sections show optimization points, while green areas highlight speed/efficiency gains users will notice. `;
        }
        break;
      case 'refactor':
        if (visualizationType === 'classDiagram') {
          description = `This class diagram shows how the code structure was improved through refactoring. Classes and relationships are now cleaner and more maintainable. `;
        } else if (visualizationType === 'graph') {
          description = `This graph illustrates the architectural improvements made during refactoring. Nodes represent components, with cleaner relationships and better organization. `;
        } else {
          description = `This ${visualName} shows how the code structure was improved while maintaining the same user functionality. Purple sections highlight the cleaner, more maintainable internal organization. `;
        }
        break;
      case 'maintenance':
        if (visualizationType === 'gitgraph') {
          description = `This git graph shows the progression of maintenance updates. Each commit represents an update, showing how the system evolves to stay healthy and secure. `;
        } else {
          description = `This ${visualName} explains what system components were updated and how these changes improve reliability, security, or compatibility. Blue sections show updates, green shows benefits. `;
        }
        break;
      default:
        description = `This ${visualName} explains what happens when users interact with the changes in this PR. `;
    }

    // Add context about scope
    if (fileCount === 1) {
      description += `The change affects one key component, delivering a focused improvement.`;
    } else if (fileCount <= 3) {
      description += `The changes span ${fileCount} components, showing how they coordinate to deliver the enhancement.`;
    } else {
      description += `The changes involve ${fileCount} components, demonstrating the comprehensive scope of this update.`;
    }

    return description;
  }

  /**
   * Get basic syntax guidelines instead of rigid examples
   */
  private getEnhancedExampleDiagram(visualizationType: VisualizationType, prType: PRType): string {
    switch (visualizationType) {
      case 'flowchart':
        return `**FLOWCHART SYNTAX GUIDE:**
- Start with: flowchart TD (top-down) or flowchart LR (left-right)
- Rectangle nodes: [Action or process]
- Diamond decisions: {Question or condition?}
- Conditional arrows: -->|Yes| or -->|No| or -->|Error|
- Styling: style NodeId fill:#color

**BE CREATIVE:** Design a flow unique to this PR's actual functionality and business logic.`;

      case 'stateDiagram':
        return `**STATE DIAGRAM SYNTAX GUIDE:**
- Start with: stateDiagram-v2
- States: StateName
- Transitions: State1 --> State2 : trigger/condition
- Entry/exit: [*] --> InitialState or FinalState --> [*]

**BE CREATIVE:** Show the actual state changes relevant to this PR.`;

      case 'graph':
        return `**GRAPH SYNTAX GUIDE:**
- Start with: graph TD (top-down) or graph LR (left-right)
- Nodes: [Component] or (Service) or {Decision}
- Connections: A --> B or A -->|label| B
- Styling: style NodeId fill:#color

**BE CREATIVE:** Show the actual component relationships changed in this PR.`;

      default:
        return this.getExampleDiagram(visualizationType, prType);
    }
  }

  /**
   * Get example diagram based on visualization type and PR type
   */
  private getExampleDiagram(visualizationType: VisualizationType, _prType: PRType): string {
    switch (visualizationType) {
      case 'flowchart':
        return `flowchart TD
    A[User needs to upload document] --> B[User clicks upload button]
    B --> C[User selects file from device]
    C --> D{File size acceptable?}
    D -->|No| E[Show size warning]
    D -->|Yes| F[File uploads with progress bar]
    F --> G[System analyzes document]
    G --> H[User sees analysis results]`;

      case 'stateDiagram':
        return `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : User submits form
    Processing --> ValidationError : Input invalid
    Processing --> Success : Input valid
    ValidationError --> Idle : User corrects input
    Success --> [*]`;

      case 'graph':
        return `graph TD
    A[Component A] --> B[Component B]
    A --> C[Component C]
    B --> D[Optimized Process]
    C --> D
    D --> E[Improved Performance]`;

      case 'classDiagram':
        return `classDiagram
    class UserService {
        +authenticate()
        +getUserData()
    }
    class DatabaseLayer {
        +query()
        +update()
    }
    UserService --> DatabaseLayer`;

      case 'gitgraph':
        return `gitgraph
    commit id: "Initial"
    commit id: "Update deps"
    commit id: "Security patch"
    commit id: "Performance fix"`;

      default:
        return `flowchart TD
    A[Start] --> B[Process]
    B --> C[End]`;
    }
  }

  /**
   * Get display name for visualization type
   */
  private getVisualizationDisplayName(visualizationType: VisualizationType): string {
    switch (visualizationType) {
      case 'flowchart':
        return 'flowchart';
      case 'graph':
        return 'graph';
      case 'gitgraph':
        return 'git graph';
      case 'classDiagram':
        return 'class diagram';
      case 'sequenceDiagram':
        return 'sequence diagram';
      case 'stateDiagram':
        return 'state diagram';
      default:
        return 'diagram';
    }
  }
}
