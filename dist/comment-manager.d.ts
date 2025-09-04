/**
 * Comment management system for inline and summary comments
 */
import { ActionInputs, AIProvider, FileChange, PRContext, PRPlan, ReviewResult } from './types';
import { GitHubClient } from './github-client';
import { AutoFixManager } from './auto-fix-manager';
export declare class CommentManager {
    private githubClient;
    private inputs;
    private flowDiagramGenerator;
    private prContext;
    private autoFixManager;
    constructor(githubClient: GitHubClient, inputs: ActionInputs, aiProvider?: AIProvider, prContext?: PRContext, autoFixManager?: AutoFixManager);
    /**
     * Extract PR context from GitHub environment (fallback if not provided)
     */
    private extractPRContextFromGitHub;
    /**
     * Generate GitHub URL for summary links - Use EXACT same logic as inline comments!
     */
    private generateGitHubFileURL;
    /**
     * Generate proper GitHub diff anchor URL
     */
    private generateDiffAnchorURL;
    /**
     * Generate URL that links to a specific file in the PR (without line anchor)
     */
    private generateFileAnchorURL;
    /**
     * Post all review comments (inline and summary)
     */
    postReviewComments(reviewResult: ReviewResult, fileChanges: FileChange[], prPlan?: PRPlan): Promise<void>;
    /**
     * Post dedicated architectural comment
     */
    private postArchitecturalComment;
    /**
     * Post inline comments for specific issues
     */
    private postInlineComments;
    /**
     * Post summary comment
     */
    private postSummaryComment;
    /**
     * Format architectural comment body - clear and easy to understand
     */
    private formatArchitecturalCommentBody;
    /**
     * Filter issues based on configured severity level
     */
    private filterIssuesBySeverity;
    /**
     * Filter issues based on configured log level for posting comments
     */
    private filterIssuesByLogLevel;
    /**
     * Group issues by file and line for inline comments
     */
    private groupIssuesByLocation;
    /**
     * Check if comment location is valid (exists in PR diff)
     */
    private isValidCommentLocation;
    /**
     * Find the best valid location for a comment when direct conversion fails
     * This method assumes requestedLine is a diff line number, so it looks for nearby file line numbers
     */
    private findValidCommentLocation;
    /**
     * Convert diff line number (from AI) to actual file line number (for GitHub)
     * This maps AI's numbered diff lines to GitHub's file line numbers
     *
     * The AI receives a numbered diff where all content lines (added, deleted, context) are numbered 1, 2, 3...
     * But GitHub comments need actual file line numbers (only added and context lines).
     */
    private convertDiffLineToFileLine;
    /**
     * Parse patch to extract valid line numbers for comments
     * Returns absolute file line numbers that can be commented on
     * Uses the same logic as extractChangedLines but allows comments on context lines too
     */
    private parseValidLinesFromPatch;
    /**
     * Format inline comment body
     */
    private formatInlineCommentBody;
    /**
     * Format summary comment body
     */
    private formatSummaryCommentBody;
    /**
     * Get status icon
     */
    private getStatusIcon;
    /**
     * Get issue type icon
     */
    private getIssueIcon;
    /**
     * Get rule type emoji
     */
    private getRuleTypeEmoji;
    /**
     * Group issues by type
     */
    private groupIssuesByType;
    /**
     * Group issues by category
     */
    private groupIssuesByCategory;
    /**
     * Get category icon
     */
    private getCategoryIcon;
    /**
     * Format category name for display
     */
    private formatCategoryName;
    /**
     * Determine if a suggestion contains code or is general advice
     */
    private isCodeSuggestion;
    /**
     * Get language identifier from file extension for syntax highlighting
     */
    private getLanguageFromFile;
}
//# sourceMappingURL=comment-manager.d.ts.map