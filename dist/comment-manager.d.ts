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
     * Generate GitHub URL for a file in the PR with optional line number
     */
    private generateGitHubFileURL;
    /**
     * Post all review comments (inline and summary)
     */
    postReviewComments(reviewResult: ReviewResult, fileChanges: FileChange[], prPlan?: PRPlan): Promise<void>;
    /**
     * Post inline comments for specific issues
     */
    private postInlineComments;
    /**
     * Post summary comment
     */
    private postSummaryComment;
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
     * Find the best valid location for a comment, with fallback options
     */
    private findValidCommentLocation;
    /**
     * Parse patch to extract valid line numbers for comments
     * Returns absolute file line numbers that can be commented on
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