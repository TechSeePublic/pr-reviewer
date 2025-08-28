/**
 * Main PR Reviewer orchestrator
 */
import { ActionInputs, ReviewResult } from './types';
export declare class PRReviewer {
    private inputs;
    private prContext;
    private githubClient;
    private aiProvider;
    private commentManager;
    private autoFixManager;
    private workspacePath;
    constructor(inputs: ActionInputs, workspacePath?: string);
    /**
     * Main review process
     */
    reviewPR(): Promise<ReviewResult>;
    /**
     * Extract PR context from GitHub environment
     */
    private extractPRContext;
    /**
     * Parse Cursor rules from repository
     */
    private parseCursorRules;
    /**
     * Check if review should be skipped
     */
    private shouldSkipReview;
    /**
     * Filter rules that apply to the changed files
     */
    private filterApplicableRules;
    /**
     * Review all changed files
     */
    private reviewFiles;
    /**
     * Review a single file
     */
    private reviewSingleFile;
    /**
     * Get file content for review
     */
    private getFileContent;
    /**
     * Build review context for AI
     */
    private buildReviewContext;
    /**
     * Generate comprehensive review result
     */
    private generateReviewResult;
    /**
     * Determine review status based on issues found
     */
    private determineReviewStatus;
    /**
     * Generate fallback summary if AI summary fails
     */
    private generateFallbackSummary;
    /**
     * Create result for skipped reviews
     */
    private createSkippedResult;
    /**
     * Set GitHub Action outputs
     */
    private setActionOutputs;
    /**
     * Extract changed line numbers from patch
     */
    private extractChangedLines;
    /**
     * Utility delay function
     */
    private delay;
}
//# sourceMappingURL=pr-reviewer.d.ts.map