"use strict";
/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams using AI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowDiagramGenerator = void 0;
const logger_1 = require("./logger");
class FlowDiagramGenerator {
    constructor(config = {}, aiProvider, _githubClient) {
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
    async generateFlowDiagram(fileChanges, prPlan, _issues = []) {
        try {
            logger_1.logger.info('Generating flow diagram for PR changes...');
            // Filter relevant files
            const relevantFiles = this.filterRelevantFiles(fileChanges);
            if (relevantFiles.length === 0) {
                logger_1.logger.info('No relevant files found for flow diagram generation');
                return null;
            }
            // Generate diagram using AI
            if (!this.aiProvider) {
                logger_1.logger.info('No AI provider available for flow diagram generation');
                return null;
            }
            // Detect PR type and generate appropriate diagram
            const prType = this.detectPRType(prPlan, relevantFiles);
            return this.generateAIDiagram(relevantFiles, prPlan, prType);
        }
        catch (error) {
            logger_1.logger.error('Failed to generate flow diagram:', error);
            return null;
        }
    }
    /**
     * Generate diagram using AI to create Mermaid text directly
     */
    async generateAIDiagram(files, prPlan, prType) {
        logger_1.logger.info(`Generating AI flow diagram for ${prType} PR...`);
        try {
            const prompt = this.buildSpecializedPrompt(files, prPlan, prType);
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
                logger_1.logger.warn('Generated Mermaid code failed validation');
                throw new Error('Invalid Mermaid code generated');
            }
            const diagram = {
                title: this.generateTitle(prPlan, prType),
                description: this.generateSmartDescription(prPlan, files.length, prType),
                mermaidCode,
                ...(prType !== 'unknown' && { diagramType: prType }),
            };
            logger_1.logger.info('Generated AI flow diagram successfully');
            return diagram;
        }
        catch (error) {
            logger_1.logger.error('AI diagram generation failed:', error);
            throw error;
        }
    }
    /**
     * Generate Mermaid diagram using direct AI call (not code review format)
     */
    async generateMermaidWithAI(prompt, context) {
        if (!this.aiProvider) {
            throw new Error('AI provider not available');
        }
        // Access the underlying AI provider to make a direct call
        // This bypasses the code review format and gets raw text response
        if ('client' in this.aiProvider) {
            // Handle OpenAI provider (including Azure OpenAI)
            const openaiProvider = this.aiProvider;
            try {
                // Check if this is an Azure/OpenAI provider that has the new methods
                const requiresMaxCompletionTokens = typeof openaiProvider.requiresMaxCompletionTokens === 'function'
                    ? openaiProvider.requiresMaxCompletionTokens()
                    : false;
                const supportsTemperature = typeof openaiProvider.supportsTemperature === 'function'
                    ? openaiProvider.supportsTemperature()
                    : true; // Default to true for backward compatibility
                logger_1.logger.info(`Flow diagram generation: model=${openaiProvider.model}, requiresMaxCompletionTokens=${requiresMaxCompletionTokens}, supportsTemperature=${supportsTemperature}`);
                const response = await openaiProvider.client.chat.completions.create({
                    model: openaiProvider.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a flow diagram generator. Generate only valid Mermaid flowchart code. Do not provide code reviews or suggestions.',
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
                logger_1.logger.info('✅ Got direct AI response for Mermaid generation');
                return result;
            }
            catch (error) {
                logger_1.logger.error('Direct OpenAI call failed:', error);
                // Provide more detailed error information
                if (error && typeof error === 'object') {
                    const errorObj = error;
                    if (errorObj.status) {
                        logger_1.logger.error(`API Error Status: ${errorObj.status}`);
                    }
                    if (errorObj.message) {
                        logger_1.logger.error(`API Error Message: ${errorObj.message}`);
                    }
                    if (errorObj.code) {
                        logger_1.logger.error(`API Error Code: ${errorObj.code}`);
                    }
                }
                throw error;
            }
        }
        else {
            // Fallback to reviewCode method but warn about it
            logger_1.logger.warn('Unable to make direct AI call, falling back to reviewCode method');
            try {
                const response = await this.aiProvider.reviewCode(prompt, context, []);
                // For non-OpenAI providers, we still need to use the array response
                // Mark this as an array response so the parser knows how to handle it
                response.__isArrayResponse = true;
                return response;
            }
            catch (error) {
                logger_1.logger.error('Fallback reviewCode method also failed:', error);
                throw error;
            }
        }
    }
    /**
     * Detect the type of PR based on overview and changes
     */
    detectPRType(prPlan, files) {
        const overview = prPlan.overview.toLowerCase();
        const keyChanges = prPlan.keyChanges.join(' ').toLowerCase();
        const fileNames = files.map(f => f.filename.toLowerCase()).join(' ');
        const allText = `${overview} ${keyChanges} ${fileNames}`;
        // Feature detection
        if (allText.includes('add') ||
            allText.includes('create') ||
            allText.includes('implement') ||
            allText.includes('new feature') ||
            allText.includes('introduce')) {
            return 'feature';
        }
        // Bug fix detection
        if (allText.includes('fix') ||
            allText.includes('bug') ||
            allText.includes('resolve') ||
            allText.includes('patch') ||
            allText.includes('correct')) {
            return 'bugfix';
        }
        // Optimization detection
        if (allText.includes('optimize') ||
            allText.includes('performance') ||
            allText.includes('speed up') ||
            allText.includes('improve performance') ||
            allText.includes('faster') ||
            allText.includes('efficiency')) {
            return 'optimization';
        }
        // Refactor detection
        if (allText.includes('refactor') ||
            allText.includes('restructure') ||
            allText.includes('reorganize') ||
            allText.includes('clean up') ||
            allText.includes('simplify')) {
            return 'refactor';
        }
        // Maintenance detection
        if (allText.includes('update') ||
            allText.includes('upgrade') ||
            allText.includes('maintain') ||
            allText.includes('dependency') ||
            allText.includes('version')) {
            return 'maintenance';
        }
        return 'unknown';
    }
    /**
     * Build specialized prompt based on PR type
     */
    buildSpecializedPrompt(files, prPlan, prType) {
        switch (prType) {
            case 'feature':
                return this.buildFeaturePrompt(files, prPlan);
            case 'bugfix':
                return this.buildBugfixPrompt(files, prPlan);
            case 'optimization':
                return this.buildOptimizationPrompt(files, prPlan);
            case 'refactor':
                return this.buildRefactorPrompt(files, prPlan);
            case 'maintenance':
                return this.buildMaintenancePrompt(files, prPlan);
            default:
                return this.buildGenericPrompt(files, prPlan);
        }
    }
    /**
     * Build prompt for new features - focus on user journey
     */
    buildFeaturePrompt(files, prPlan) {
        const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');
        return `# NEW FEATURE FLOW DIAGRAM

Create a Mermaid flowchart that explains the complete USER JOURNEY for this new feature.

## New Feature Description:
${prPlan.overview}

## Key Implementation Details:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show users and stakeholders WHAT this new feature does and HOW users will interact with it.

FOCUS ON USER EXPERIENCE:
1. HOW users discover/access this feature
2. WHAT steps users take to use it
3. WHAT happens behind the scenes (in simple terms)
4. WHAT users see as results
5. HOW this improves their workflow

MAKE IT USER-CENTRIC:
- Start with user action or need
- Show clear steps users will take
- Explain what users see at each step
- Include decision points users face
- End with the value/benefit users get
- Use language stakeholders understand

EXAMPLE STRUCTURE:
flowchart TD
    A[User needs to upload document] --> B[User clicks upload button]
    B --> C[User selects file from device]
    C --> D{File size acceptable?}
    D -->|No| E[Show size warning]
    D -->|Yes| F[File uploads with progress bar]
    F --> G[System analyzes document]
    G --> H[User sees analysis results]
    H --> I[User can download report]

Return only the Mermaid flowchart code that tells the complete user story.`;
    }
    /**
     * Build prompt for bug fixes - focus on problem and solution
     */
    buildBugfixPrompt(files, prPlan) {
        const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');
        return `# BUG FIX FLOW DIAGRAM

Create a Mermaid flowchart that shows HOW this bug fix changes the user experience.

## Bug Fix Description:
${prPlan.overview}

## What Was Fixed:
${prPlan.keyChanges.join('\n')}

## Files Modified:
${fileList}

YOUR GOAL: Show the BEFORE vs AFTER behavior so users understand what changed.

FOCUS ON PROBLEM & SOLUTION:
1. WHAT scenario triggered the bug
2. WHERE the problem occurred in the flow
3. HOW the fix changes the behavior
4. WHAT users experience now instead
5. HOW this prevents the issue

SHOW THE IMPROVEMENT:
- Start with the scenario that had problems
- Show where the bug occurred
- Highlight the fixed behavior
- Demonstrate the improved user experience
- Include error handling improvements

EXAMPLE STRUCTURE:
flowchart TD
    A[User submits form] --> B[System validates data]
    B --> C{All required fields?}
    C -->|No| D[Show specific field errors]
    C -->|Yes| E[Process submission]
    E --> F{Processing successful?}
    F -->|No| G[Show helpful error message]
    F -->|Yes| H[Confirm success to user]
    
    style D fill:#90EE90
    style G fill:#90EE90
    
Use green highlighting for the parts that were fixed/improved.

Return only the Mermaid flowchart code that shows the fix.`;
    }
    /**
     * Build prompt for optimizations - focus on improvements
     */
    buildOptimizationPrompt(files, prPlan) {
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

FOCUS ON IMPROVEMENTS:
1. WHAT process was slow/inefficient before
2. WHERE the bottlenecks were
3. HOW the optimization works
4. WHAT users notice as improvement
5. WHEN the benefits are most apparent

HIGHLIGHT THE GAINS:
- Show the improved process flow
- Indicate faster/more efficient steps
- Demonstrate reduced waiting times
- Highlight better resource usage
- Show measurable improvements

EXAMPLE STRUCTURE:
flowchart TD
    A[User requests data] --> B[Check cache first]
    B --> C{Data in cache?}
    C -->|Yes| D[Return cached data instantly]
    C -->|No| E[Fetch from database]
    E --> F[Store in cache]
    F --> G[Return data to user]
    D --> H[User sees results quickly]
    G --> H
    
    style B fill:#FFD700
    style D fill:#90EE90
    style F fill:#FFD700
    
Use gold for optimization points and green for speed improvements.

Return only the Mermaid flowchart code that shows the optimization.`;
    }
    /**
     * Build prompt for refactoring - focus on structural improvements
     */
    buildRefactorPrompt(files, prPlan) {
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
    buildMaintenancePrompt(files, prPlan) {
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
    buildGenericPrompt(files, prPlan) {
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

FOCUS ON EXPLAINING:
1. WHAT triggers this flow (user action, event, condition)
2. WHAT business problem is being solved
3. WHAT decisions are made and why
4. WHAT data is processed and transformed
5. WHAT the end result means for users
6. HOW different components work together

MAKE IT EXPLANATORY:
- Use clear, descriptive labels that explain PURPOSE
- Show the logical progression of events
- Include decision points with meaningful conditions
- Explain what happens in success vs error cases
- Use business terms that stakeholders understand
- Show the value/outcome for users

EXAMPLE STRUCTURE:
flowchart TD
    A[User uploads document] --> B[System validates file]
    B --> C{File format supported?}
    C -->|No| D[Show error message]
    C -->|Yes| E[Extract text content]
    E --> F[AI analyzes document]
    F --> G[Generate insights report]
    G --> H[Save results to user account]
    H --> I[Display analysis to user]
    D --> J[User can try again]

Return only the Mermaid flowchart code that explains the complete story of what this PR accomplishes.`;
    }
    /**
     * Build file context for AI analysis
     */
    buildFileContext(files) {
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
    parseMermaidResponse(response) {
        let mermaidCode = '';
        // Log the AI response for debugging
        logger_1.logger.info(`AI Response type: ${typeof response}`);
        // Handle array response (from reviewCode)
        if (Array.isArray(response)) {
            logger_1.logger.info(`Processing array response with ${response.length} items`);
            // Check if this looks like a code review response instead of a flow diagram
            const isCodeReviewResponse = response.length > 0 && response.every(item => item.type && item.category && item.severity);
            if (isCodeReviewResponse) {
                logger_1.logger.error('AI returned code review issues instead of Mermaid diagram');
                logger_1.logger.error('This indicates the AI misunderstood the flow diagram request');
                throw new Error('AI returned code review format instead of flow diagram - prompt may need adjustment');
            }
            for (const item of response) {
                if (item.description || item.message) {
                    const text = item.description || item.message;
                    logger_1.logger.info(`AI returned text (${text.length} chars): ${text.substring(0, 150)}...`);
                    const extracted = this.extractMermaidFromText(text);
                    if (extracted) {
                        logger_1.logger.info('✅ Successfully extracted Mermaid code from array item');
                        mermaidCode = extracted;
                        break;
                    }
                }
            }
        }
        // Handle string response
        else if (typeof response === 'string') {
            logger_1.logger.info(`AI returned string (${response.length} chars): ${response.substring(0, 150)}...`);
            const extracted = this.extractMermaidFromText(response);
            if (extracted) {
                logger_1.logger.info('✅ Successfully extracted Mermaid code from string');
                mermaidCode = extracted;
            }
        }
        // Handle object response
        else if (response && typeof response === 'object') {
            logger_1.logger.info('AI returned object response');
            const responseObj = response;
            if (typeof responseObj.mermaidCode === 'string') {
                logger_1.logger.info('✅ Found mermaidCode property in object');
                mermaidCode = responseObj.mermaidCode;
            }
            else if (typeof responseObj.diagram === 'string') {
                logger_1.logger.info('✅ Found diagram property in object');
                mermaidCode = responseObj.diagram;
            }
            else {
                logger_1.logger.info(`Object keys: ${Object.keys(responseObj).join(', ')}`);
            }
        }
        // If no Mermaid code found, fail with detailed logging
        if (!mermaidCode || !mermaidCode.includes('flowchart')) {
            logger_1.logger.error('Could not extract valid Mermaid code from AI response');
            logger_1.logger.error(`Final mermaidCode variable: ${mermaidCode}`);
            logger_1.logger.error(`Response type was: ${typeof response}`);
            if (Array.isArray(response)) {
                logger_1.logger.error(`Array items structure: ${JSON.stringify(response.map(item => Object.keys(item || {})))}`);
            }
            throw new Error('AI did not return valid Mermaid code');
        }
        return mermaidCode;
    }
    /**
     * Extract Mermaid code from text
     */
    extractMermaidFromText(text) {
        // Look for flowchart in the text
        const flowchartMatch = text.match(/flowchart\s+TD\s*\n([\s\S]*?)(?=\n\n|\n```|$)/);
        if (flowchartMatch && flowchartMatch[1]) {
            logger_1.logger.info('✅ Extracted flowchart TD pattern');
            return `flowchart TD\n${flowchartMatch[1]}`;
        }
        // Look for any flowchart statement
        const anyFlowchartMatch = text.match(/(flowchart\s+[\s\S]*?)(?=\n\n|\n```|$)/);
        if (anyFlowchartMatch && anyFlowchartMatch[1]) {
            logger_1.logger.info('✅ Extracted general flowchart pattern');
            return anyFlowchartMatch[1];
        }
        // Look for Mermaid code blocks
        const codeBlockMatch = text.match(/```(?:mermaid)?\s*\n(flowchart[\s\S]*?)\n```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
            logger_1.logger.info('✅ Extracted from Mermaid code block');
            return codeBlockMatch[1];
        }
        // Try a simpler pattern - just look for flowchart anywhere
        const simpleFlowchartMatch = text.match(/flowchart[\s\S]*/);
        if (simpleFlowchartMatch) {
            logger_1.logger.info('✅ Extracted using simple flowchart pattern');
            return simpleFlowchartMatch[0];
        }
        logger_1.logger.warn(`❌ No Mermaid patterns found in text: ${text.substring(0, 100)}...`);
        return null;
    }
    /**
     * Validate Mermaid code for quality and usefulness
     */
    isValidMermaidCode(code) {
        if (!code || typeof code !== 'string') {
            logger_1.logger.warn('Mermaid validation failed: code is not a string');
            return false;
        }
        const trimmed = code.trim();
        // Must start with flowchart
        if (!trimmed.startsWith('flowchart')) {
            logger_1.logger.warn('Mermaid validation failed: does not start with flowchart');
            return false;
        }
        // Must have at least one arrow (flow connection)
        if (!trimmed.includes('-->')) {
            logger_1.logger.warn('Mermaid validation failed: no flow arrows found');
            return false;
        }
        // Should not contain markdown blocks
        if (trimmed.includes('```')) {
            logger_1.logger.warn('Mermaid validation failed: contains markdown code blocks');
            return false;
        }
        // Should not contain explanatory text (multiple paragraphs)
        const lines = trimmed.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);
        if (nonEmptyLines.length < 2) {
            logger_1.logger.warn('Mermaid validation failed: too few lines');
            return false;
        }
        // Basic check for balanced brackets
        const openBrackets = (trimmed.match(/\[/g) || []).length;
        const closeBrackets = (trimmed.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            logger_1.logger.warn('Mermaid validation failed: unbalanced brackets');
            return false;
        }
        // Should not contain obvious explanation text
        if (trimmed.toLowerCase().includes('this diagram') ||
            trimmed.toLowerCase().includes('explanation') ||
            trimmed.toLowerCase().includes('represents')) {
            logger_1.logger.warn('Mermaid validation failed: contains explanatory text');
            return false;
        }
        // Check for problematic quotes in node labels
        const nodeWithQuotes = trimmed.match(/\[[^\]]*"[^\]]*\]/);
        if (nodeWithQuotes) {
            logger_1.logger.warn('Mermaid validation failed: node labels contain quotes which break syntax');
            return false;
        }
        // Check for very long lines that might cause rendering issues
        const codeLines = trimmed.split('\n');
        const longLines = codeLines.filter(line => line.trim().length > 100);
        if (longLines.length > 0) {
            logger_1.logger.warn('Mermaid validation failed: contains very long lines that may cause rendering issues');
            return false;
        }
        // Check for minimum number of steps (nodes) - must have at least 3 steps
        const nodeCount = this.countMermaidNodes(trimmed);
        if (nodeCount < 3) {
            logger_1.logger.warn(`Mermaid validation failed: diagram has only ${nodeCount} steps, minimum 3 required`);
            return false;
        }
        // Quality checks for explanatory value
        if (!this.hasExplanatoryValue(trimmed)) {
            logger_1.logger.warn('Mermaid validation failed: diagram lacks explanatory value');
            return false;
        }
        return true;
    }
    /**
     * Check if the diagram has good explanatory value
     */
    hasExplanatoryValue(mermaidCode) {
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
            logger_1.logger.warn("Diagram contains generic nodes that don't explain the specific purpose");
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
            logger_1.logger.warn('Diagram lacks explanatory terms that describe what actually happens');
            return false;
        }
        // Check for decision points (good flow diagrams have logical branches)
        const hasDecisions = text.includes('{') && text.includes('}');
        const hasConditionalFlows = text.includes('|');
        if (!hasDecisions && !hasConditionalFlows) {
            logger_1.logger.info('Diagram could be improved with decision points, but this is not required');
        }
        return true;
    }
    /**
     * Count the number of nodes/steps in a Mermaid flowchart
     */
    countMermaidNodes(mermaidCode) {
        const lines = mermaidCode.split('\n');
        const uniqueNodes = new Set();
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
        logger_1.logger.info(`Counted ${uniqueNodes.size} unique nodes in Mermaid diagram: ${Array.from(uniqueNodes).join(', ')}`);
        return uniqueNodes.size;
    }
    /**
     * Filter files relevant for flow diagram
     */
    filterRelevantFiles(fileChanges) {
        const filtered = fileChanges.filter(file => {
            const filename = file.filename.toLowerCase();
            // Exclude by file extension patterns
            const isExcluded = this.config.excludeFileTypes.some(pattern => filename.includes(pattern.toLowerCase()));
            if (isExcluded) {
                return false;
            }
            // Include by file extension
            const hasRelevantExtension = this.config.includeFileTypes.some(ext => filename.endsWith(ext.toLowerCase()));
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
    generateTitle(prPlan, prType) {
        const shortOverview = prPlan.overview.substring(0, 50) + (prPlan.overview.length > 50 ? '...' : '');
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
    generateSmartDescription(prPlan, fileCount, prType) {
        let description = '';
        // Generate description based on PR type
        switch (prType) {
            case 'feature':
                description = `This diagram shows the complete user journey for the new feature. Follow the flow to understand how users will discover, use, and benefit from this addition. `;
                break;
            case 'bugfix':
                description = `This diagram illustrates how the bug fix improves the user experience. Green highlighted sections show the corrected behavior that prevents the original issue. `;
                break;
            case 'optimization':
                description = `This diagram demonstrates the performance improvements made to the system. Gold sections show optimization points, while green areas highlight speed/efficiency gains users will notice. `;
                break;
            case 'refactor':
                description = `This diagram shows how the code structure was improved while maintaining the same user functionality. Purple sections highlight the cleaner, more maintainable internal organization. `;
                break;
            case 'maintenance':
                description = `This diagram explains what system components were updated and how these changes improve reliability, security, or compatibility. Blue sections show updates, green shows benefits. `;
                break;
            default:
                description = `This diagram explains what happens when users interact with the changes in this PR. `;
        }
        // Add context about scope
        if (fileCount === 1) {
            description += `The change affects one key component, delivering a focused improvement.`;
        }
        else if (fileCount <= 3) {
            description += `The changes span ${fileCount} components, showing how they coordinate to deliver the enhancement.`;
        }
        else {
            description += `The changes involve ${fileCount} components, demonstrating the comprehensive scope of this update.`;
        }
        return description;
    }
}
exports.FlowDiagramGenerator = FlowDiagramGenerator;
//# sourceMappingURL=flow-diagram-generator.js.map