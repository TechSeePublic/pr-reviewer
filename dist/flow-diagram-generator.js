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
            return this.generateAIDiagram(relevantFiles, prPlan);
        }
        catch (error) {
            logger_1.logger.error('Failed to generate flow diagram:', error);
            return null;
        }
    }
    /**
     * Generate diagram using AI to create Mermaid text directly
     */
    async generateAIDiagram(files, prPlan) {
        logger_1.logger.info('Generating AI flow diagram...');
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
                logger_1.logger.warn('Generated Mermaid code failed validation');
                throw new Error('Invalid Mermaid code generated');
            }
            const diagram = {
                title: `What This PR Does: ${prPlan.overview.substring(0, 50)}${prPlan.overview.length > 50 ? '...' : ''}`,
                description: this.generateSmartDescription(prPlan, files.length),
                mermaidCode,
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
     * Build prompt for AI to generate Mermaid diagram
     */
    buildMermaidPrompt(files, prPlan) {
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

GOOD EXAMPLES OF NODES:
- "User uploads document"
- "System validates file format"
- "Document processed for analysis"
- "AI extracts key information"
- "Results saved to database"
- "User receives summary report"

AVOID TECHNICAL JARGON:
- Don't use internal function names
- Don't focus on implementation details
- Don't use developer-only terminology
- Don't create generic "process data" nodes

STRUCTURE REQUIREMENTS:
- Start with user action or trigger event
- Show logical flow of what happens next
- Include meaningful decision points
- End with clear outcome/result
- Use 6-12 nodes for comprehensive explanation
- Keep labels under 40 characters but descriptive

EXAMPLE - For a document analysis feature:
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
            'step 3'
        ];
        const hasGenericNodes = badPatterns.some(pattern => text.includes(pattern));
        if (hasGenericNodes) {
            logger_1.logger.warn('Diagram contains generic nodes that don\'t explain the specific purpose');
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
            'calculate'
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
     * Generate a smart, contextual description for the flow diagram
     */
    generateSmartDescription(prPlan, fileCount) {
        const overview = prPlan.overview.toLowerCase();
        let description = '';
        // Determine the type of change
        if (overview.includes('add') || overview.includes('create') || overview.includes('implement')) {
            description = `This diagram explains the complete user journey for the new feature being added. `;
        }
        else if (overview.includes('fix') || overview.includes('bug') || overview.includes('resolve')) {
            description = `This diagram shows how the bug fix changes the user experience and system behavior. `;
        }
        else if (overview.includes('improve') || overview.includes('enhance') || overview.includes('optimize')) {
            description = `This diagram illustrates the improved workflow and enhanced user experience. `;
        }
        else if (overview.includes('update') || overview.includes('modify') || overview.includes('change')) {
            description = `This diagram shows how the updates change the existing flow and user experience. `;
        }
        else if (overview.includes('refactor') || overview.includes('restructure')) {
            description = `This diagram explains how the refactoring improves the internal logic while maintaining user functionality. `;
        }
        else {
            description = `This diagram explains what happens when users interact with the changes in this PR. `;
        }
        // Add context about scope
        if (fileCount === 1) {
            description += `The change affects one key component, showing a focused improvement to the system.`;
        }
        else if (fileCount <= 3) {
            description += `The changes span ${fileCount} components, showing how they work together to deliver the feature.`;
        }
        else {
            description += `The changes involve ${fileCount} components, illustrating the comprehensive nature of this update.`;
        }
        return description;
    }
}
exports.FlowDiagramGenerator = FlowDiagramGenerator;
//# sourceMappingURL=flow-diagram-generator.js.map