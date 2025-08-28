/**
 * Auto-fix manager for applying code fixes automatically
 */
import { ActionInputs, AutoFixResult, CodeIssue, CommitResult, FileChange, PRContext } from './types';
import { GitHubClient } from './github-client';
export declare class AutoFixManager {
    private githubClient;
    private inputs;
    private prContext;
    private workspacePath;
    constructor(githubClient: GitHubClient, inputs: ActionInputs, prContext: PRContext, workspacePath?: string);
    /**
     * Apply auto-fixes for eligible issues
     */
    applyAutoFixes(issues: CodeIssue[], fileChanges: FileChange[]): Promise<AutoFixResult[]>;
    /**
     * Commit the applied fixes
     */
    commitFixes(fixResults: AutoFixResult[]): Promise<CommitResult | null>;
    /**
     * Filter issues eligible for auto-fix
     */
    private filterEligibleIssues;
    /**
     * Group issues by file
     */
    private groupIssuesByFile;
    /**
     * Apply fixes to a single file
     */
    private applyFixesToFile;
    /**
     * Apply an individual fix to file content
     */
    private applyIndividualFix;
    /**
     * Get file content (local or remote)
     */
    private getFileContent;
    /**
     * Generate commit message for auto-fixes
     */
    private generateCommitMessage;
    /**
     * Create a summary comment for auto-fixes
     */
    private createAutoFixSummaryComment;
    /**
     * Format category name for display
     */
    private formatCategoryName;
}
//# sourceMappingURL=auto-fix-manager.d.ts.map