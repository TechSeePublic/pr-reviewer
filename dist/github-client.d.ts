/**
 * GitHub API client for PR analysis and commenting
 */
import { ActionInputs, FileChange, GitHubFile, InlineComment, PRContext, RateLimitInfo, SummaryComment } from './types';
export declare class GitHubClient {
    private octokit;
    private context;
    private rateLimitDelay;
    private lastApiCall;
    constructor(token: string, context: PRContext, rateLimitDelay?: number);
    /**
     * Apply rate limiting before making API calls
     */
    private applyRateLimit;
    /**
     * Get PR file changes
     */
    getPRChanges(inputs: ActionInputs): Promise<FileChange[]>;
    /**
     * Check if file should be included based on patterns
     */
    private shouldIncludeFile;
    /**
     * Get file content from repository
     */
    getFileContent(filename: string, ref?: string): Promise<GitHubFile | null>;
    /**
     * Decode file content
     */
    decodeFileContent(file: GitHubFile): string;
    /**
     * Get existing bot comments
     */
    getExistingBotComments(): Promise<{
        summaryComment?: SummaryComment;
        inlineComments: InlineComment[];
    }>;
    /**
     * Post or update summary comment
     */
    postSummaryComment(comment: SummaryComment, existingCommentId?: number): Promise<void>;
    /**
     * Post or update inline comment
     */
    postInlineComment(comment: InlineComment, existingCommentId?: number): Promise<number | null>;
    /**
     * Format summary comment with markers
     */
    private formatSummaryComment;
    /**
     * Format inline comment with markers
     */
    private formatInlineComment;
    /**
     * Delete comment
     */
    deleteComment(commentId: number, type: 'issue' | 'review'): Promise<void>;
    /**
     * Get rate limit information
     */
    getRateLimit(): Promise<RateLimitInfo>;
    /**
     * Check if we're approaching rate limits
     */
    checkRateLimit(): Promise<boolean>;
    /**
     * Get repository information
     */
    getRepositoryInfo(): Promise<{
        name: string;
        fullName: string;
        defaultBranch: string;
        language: string | null;
        size: number;
        isPrivate: boolean;
    }>;
    /**
     * Download repository archive for full analysis
     */
    downloadRepository(ref?: string): Promise<Buffer>;
}
//# sourceMappingURL=github-client.d.ts.map