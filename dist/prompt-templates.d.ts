/**
 * Unified prompt templates for AI code review
 * This module provides consistent, high-quality prompts that work across all AI providers
 */
import { CodeIssue, CursorRule, FileChange, ReviewContext } from './types';
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
     * Builds the user prompt with code context
     */
    static buildUserPrompt(context: string, code: string): string;
    /**
     * Builds a concise summary prompt for PR reviews
     */
    static buildSummaryPrompt(issues: CodeIssue[], context: ReviewContext): string;
    /**
     * Builds enhanced review context with better formatting
     */
    static buildReviewContext(fileChange: FileChange, _fileContent: string): string;
    /**
     * Extract changed line numbers from patch (helper method)
     */
    private static extractChangedLines;
}
//# sourceMappingURL=prompt-templates.d.ts.map