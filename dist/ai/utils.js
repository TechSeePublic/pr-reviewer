"use strict";
/**
 * Shared utilities for AI providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderUtils = void 0;
const logger_1 = require("../logger");
class AIProviderUtils {
    /**
     * Extract error message from various error formats
     */
    static extractErrorMessage(error) {
        let errorMessage = 'Unknown error';
        if (error && typeof error === 'object') {
            if ('message' in error) {
                errorMessage = String(error.message);
            }
            else if ('error' in error &&
                error.error &&
                typeof error.error === 'object' &&
                'message' in error.error) {
                errorMessage = String(error.error.message);
            }
        }
        return errorMessage;
    }
    /**
     * Clean and parse AI response
     */
    static parseAIResponse(response, deterministicMode = false) {
        try {
            // Clean up the response for better JSON parsing
            let cleanedResponse = response.trim();
            // If response doesn't start with {, try to find JSON content
            if (!cleanedResponse.startsWith('{')) {
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[0];
                }
            }
            const parsed = JSON.parse(cleanedResponse);
            return parsed.issues || [];
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse AI response as JSON:', error);
            logger_1.logger.warn('Response content:', response.substring(0, 500) + '...');
            // In deterministic mode, return empty array instead of fallback parsing
            if (deterministicMode) {
                logger_1.logger.warn('Deterministic mode: returning empty array instead of fallback parsing');
                return [];
            }
            // Try to extract issues from malformed JSON
            return this.extractIssuesFromText(response);
        }
    }
    /**
     * Extract issues from text when JSON parsing fails
     */
    static extractIssuesFromText(text) {
        // Fallback: try to extract issues from non-JSON response
        const issues = [];
        // Look for common patterns in text responses
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes('violation') || line.toLowerCase().includes('issue')) {
                issues.push({
                    type: 'warning',
                    category: 'best_practice',
                    message: line.trim(),
                    description: line.trim(),
                    ruleId: 'unknown',
                    ruleName: 'Extracted from text response',
                    file: 'unknown',
                    severity: 'medium',
                });
            }
        }
        return issues;
    }
    /**
     * Parse PR plan response
     */
    static parsePRPlanResponse(response) {
        try {
            // Clean up the response for better JSON parsing
            let cleanedResponse = response.trim();
            // If response doesn't start with {, try to find JSON content
            if (!cleanedResponse.startsWith('{')) {
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[0];
                }
            }
            const parsed = JSON.parse(cleanedResponse);
            return {
                overview: parsed.overview || 'No overview provided',
                keyChanges: parsed.keyChanges || parsed.key_changes || [],
                riskAreas: parsed.riskAreas || parsed.risk_areas || [],
                reviewFocus: parsed.reviewFocus || parsed.review_focus || [],
                context: parsed.context || 'No additional context provided',
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse PR plan response as JSON:', error);
            // Return a fallback plan
            return {
                overview: 'Failed to generate PR plan overview',
                keyChanges: ['Unable to analyze changes'],
                riskAreas: ['Unknown risk areas'],
                reviewFocus: ['General code review'],
                context: 'PR plan generation failed',
            };
        }
    }
    /**
     * Parse architectural review response
     */
    static parseArchitecturalResponse(response) {
        try {
            // Clean up the response for better JSON parsing
            let cleanedResponse = response.trim();
            // If response doesn't start with {, try to find JSON content
            if (!cleanedResponse.startsWith('{')) {
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[0];
                }
            }
            const parsed = JSON.parse(cleanedResponse);
            return {
                issues: parsed.issues || [],
                duplications: parsed.duplications || [],
                logicalProblems: parsed.logicalProblems || [],
                misplacedCode: parsed.misplacedCode || [],
                summary: parsed.summary || 'No architectural summary provided',
                confidence: parsed.confidence || 0.5,
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse architectural review response as JSON:', error);
            logger_1.logger.warn('Response content:', response.substring(0, 500) + '...');
            // Return a fallback result
            return {
                issues: [],
                duplications: [],
                logicalProblems: [],
                misplacedCode: [],
                summary: 'Failed to generate architectural review',
                confidence: 0,
            };
        }
    }
    /**
     * Assign proper file names to issues when AI doesn't provide them correctly
     */
    static assignFilesToIssues(issues, files) {
        return issues.map(issue => {
            // If issue already has a valid filename from the files list, keep it
            if (issue.file && files.some(f => f.filename === issue.file)) {
                return issue;
            }
            // If only one file in batch, assign it
            if (files.length === 1 && files[0]) {
                return { ...issue, file: files[0].filename };
            }
            // Try to match based on file extensions or patterns in the message
            const matchedFile = this.matchIssueToFile(issue, files);
            if (matchedFile) {
                return { ...issue, file: matchedFile.filename };
            }
            // As last resort, keep original file name but log a warning
            if (issue.file === 'unknown' || !issue.file) {
                logger_1.logger.warn(`Could not determine specific file for issue: ${issue.message}. Will show as affecting multiple files.`);
                return { ...issue, file: 'Multiple Files' };
            }
            return issue;
        });
    }
    /**
     * Attempt to match an issue to a specific file based on context clues
     */
    static matchIssueToFile(issue, files) {
        const lowerMessage = issue.message.toLowerCase();
        const lowerDescription = issue.description.toLowerCase();
        // Look for file extensions or names mentioned in the issue
        for (const file of files) {
            const fileName = file.filename.toLowerCase();
            const baseName = fileName.split('/').pop() || fileName;
            // Check if filename or extension is mentioned in the issue
            if (lowerMessage.includes(baseName) || lowerDescription.includes(baseName)) {
                return file;
            }
            // Check for file extension patterns
            const ext = fileName.split('.').pop();
            if (ext && (lowerMessage.includes(`.${ext}`) || lowerDescription.includes(`.${ext}`))) {
                return file;
            }
        }
        // Look for technology-specific patterns
        for (const file of files) {
            const fileName = file.filename.toLowerCase();
            // React/TypeScript patterns
            if (fileName.includes('.tsx') || fileName.includes('.jsx')) {
                if (lowerMessage.includes('react') ||
                    lowerMessage.includes('component') ||
                    lowerMessage.includes('jsx') ||
                    lowerMessage.includes('hook')) {
                    return file;
                }
            }
            // API/Backend patterns
            if (fileName.includes('api') || fileName.includes('server') || fileName.includes('route')) {
                if (lowerMessage.includes('api') ||
                    lowerMessage.includes('endpoint') ||
                    lowerMessage.includes('route') ||
                    lowerMessage.includes('server')) {
                    return file;
                }
            }
            // Test file patterns
            if (fileName.includes('.test.') || fileName.includes('.spec.')) {
                if (lowerMessage.includes('test') || lowerMessage.includes('spec')) {
                    return file;
                }
            }
            // Markdown/Documentation patterns
            if (fileName.includes('.md') || fileName.includes('.mdc')) {
                if (lowerMessage.includes('markdown') ||
                    lowerMessage.includes('documentation') ||
                    lowerMessage.includes('readme') ||
                    lowerMessage.includes('doc') ||
                    lowerMessage.includes('md')) {
                    return file;
                }
            }
        }
        return null;
    }
}
exports.AIProviderUtils = AIProviderUtils;
//# sourceMappingURL=utils.js.map