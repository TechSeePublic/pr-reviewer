/**
 * Unified prompt templates for AI code review
 * This module provides consistent, high-quality prompts that work across all AI providers
 */
import { CodeIssue, CursorRule, FileChange, InlineComment, PRPlan, ReviewContext } from './types';
export interface PromptConfig {
    supportsJsonMode: boolean;
    provider: string;
}
export declare class PromptTemplates {
    /**
     * Builds a comprehensive system prompt for code review
     */
    static buildCodeReviewSystemPrompt(rules: CursorRule[], config: PromptConfig): string;
    /**
     * Get language-specific analysis guidelines
     */
    static getLanguageSpecificGuidelines(filename: string): string;
    /**
     * Builds the user prompt with code context
     * Note: The context already contains all necessary information including file content and numbered diff
     */
    static buildUserPrompt(context: string, _code: string): string;
    /**
     * Builds a concise summary prompt for PR reviews
     */
    static buildSummaryPrompt(issues: CodeIssue[], context: ReviewContext): string;
    /**
     * Builds enhanced review context with better formatting
     */
    static buildReviewContext(fileChange: FileChange, fileContent: string): string;
    /**
     * Add line numbers to file content for precise AI line reporting
     */
    private static addLineNumbers;
    /**
     * Create a numbered version of the diff for precise line reporting
     * This creates a direct mapping between AI line numbers and GitHub comment positions
     */
    private static createNumberedDiff;
    /**
     * Get language identifier from filename for syntax highlighting
     */
    private static getLanguageFromFilename;
    /**
     * Extract changed line numbers from patch (helper method)
     */
    private static extractChangedLines;
    /**
     * Build PR plan prompt for analyzing overall changes
     */
    static buildPRPlanPrompt(fileChanges: FileChange[], rules: CursorRule[]): string;
    /**
     * Get language identifier from file extension for syntax highlighting
     */
    private static getLanguageFromFile;
    /**
     * Extract code context around a comment location
     */
    private static extractCodeContext;
    /**
     * Build batch review prompt for multiple files with PR context
     */
    static buildBatchReviewPrompt(files: FileChange[], rules: CursorRule[], prPlan: PRPlan, existingComments?: InlineComment[]): string;
    /**
     * Build architectural review prompt for analyzing code structure and patterns
     */
    static buildArchitecturalReviewPrompt(files: FileChange[], rules: CursorRule[], config: PromptConfig): string;
}
//# sourceMappingURL=prompt-templates.d.ts.map