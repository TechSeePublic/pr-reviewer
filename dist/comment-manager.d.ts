/**
 * Comment management system for inline and summary comments
 */
import { ActionInputs, FileChange, ReviewResult } from './types';
import { GitHubClient } from './github-client';
export declare class CommentManager {
    private githubClient;
    private inputs;
    constructor(githubClient: GitHubClient, inputs: ActionInputs);
    /**
     * Post all review comments (inline and summary)
     */
    postReviewComments(reviewResult: ReviewResult, fileChanges: FileChange[]): Promise<void>;
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
     * Group issues by file and line for inline comments
     */
    private groupIssuesByLocation;
    /**
     * Check if comment location is valid (exists in PR diff)
     */
    private isValidCommentLocation;
    /**
     * Parse patch to extract valid line numbers for comments
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
}
//# sourceMappingURL=comment-manager.d.ts.map