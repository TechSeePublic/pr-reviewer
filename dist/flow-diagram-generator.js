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
            // Ask AI to generate the Mermaid diagram directly
            const response = await this.aiProvider?.reviewCode(prompt, context, []);
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
                title: `PR Flow: ${prPlan.overview.substring(0, 50)}${prPlan.overview.length > 50 ? '...' : ''}`,
                description: `This diagram shows the flow of changes across ${files.length} files in this PR.`,
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
     * Build prompt for AI to generate Mermaid diagram
     */
    buildMermaidPrompt(files, prPlan) {
        const fileList = files.map(f => `- ${f.filename} (${f.status})`).join('\n');
        return `# FLOW DIAGRAM GENERATION REQUEST (NOT A CODE REVIEW)

This is NOT a code review request. Do NOT return code review issues or suggestions.

## What this PR does:
${prPlan.overview}

## Key changes:
${prPlan.keyChanges.join('\n')}

## Files modified:
${fileList}

YOUR TASK: Create a Mermaid flowchart that shows the logical flow of what this PR accomplishes.

Focus on:
- The user's journey or business process
- What triggers the flow
- What decisions are made
- What actions happen
- What the outcome is

Think about the user experience, not the code structure. Show the logical flow from start to finish.

CRITICAL REQUIREMENTS:
- This is NOT a code review - do not analyze code quality
- Do not return any code review issues or suggestions
- Return ONLY a valid Mermaid flowchart starting with "flowchart TD"
- Use proper Mermaid syntax with connected nodes and arrows (-->)
- No markdown formatting, no explanations, just raw Mermaid code

EXAMPLE OUTPUT FORMAT:
flowchart TD
    A[User action] --> B{Decision point}
    B -->|Yes| C[Process step]
    B -->|No| D[Alternative step]
    C --> E[Final result]
    D --> E

Return only the raw Mermaid code, nothing else.`;
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
            const isCodeReviewResponse = response.length > 0 &&
                response.every(item => item.type && item.category && item.severity);
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
     * Validate Mermaid code for basic syntax
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
        return true;
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
}
exports.FlowDiagramGenerator = FlowDiagramGenerator;
//# sourceMappingURL=flow-diagram-generator.js.map