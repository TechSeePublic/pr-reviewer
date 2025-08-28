/**
 * GitHub API client for PR analysis and commenting
 */

import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { minimatch } from 'minimatch';
import { 
  PRContext, 
  FileChange, 
  InlineComment, 
  SummaryComment, 
  GitHubFile,
  ActionInputs,
  RateLimitInfo 
} from './types';
import { COMMENT_MARKERS } from './config';
import { logger } from './logger';

export class GitHubClient {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: PRContext;

  constructor(token: string, context: PRContext) {
    this.octokit = github.getOctokit(token);
    this.context = context;
  }

  /**
   * Get PR file changes
   */
  async getPRChanges(inputs: ActionInputs): Promise<FileChange[]> {
    try {
      const { data: pullRequest } = await this.octokit.rest.pulls.get({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
        per_page: 100, // Maximum allowed
      });

      // Filter files based on include/exclude patterns
      const filteredFiles: FileChange[] = files
        .filter(file => this.shouldIncludeFile(file.filename, inputs))
        .slice(0, inputs.maxFiles) // Respect max files limit
        .map(file => {
          const fileChange: FileChange = {
            filename: file.filename,
            status: file.status as FileChange['status'],
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
          };
          
          if (file.patch !== undefined) {
            fileChange.patch = file.patch;
          }
          
          if (file.previous_filename !== undefined) {
            fileChange.previousFilename = file.previous_filename;
          }
          
          return fileChange;
        });

      return filteredFiles;
    } catch (error) {
      throw new Error(`Failed to get PR changes: ${error}`);
    }
  }

  /**
   * Check if file should be included based on patterns
   */
  private shouldIncludeFile(filename: string, inputs: ActionInputs): boolean {
    // Check exclude patterns first
    for (const pattern of inputs.excludePatterns) {
      if (minimatch(filename, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of inputs.includePatterns) {
      if (minimatch(filename, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get file content from repository
   */
  async getFileContent(filename: string, ref?: string): Promise<GitHubFile | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.context.owner,
        repo: this.context.repo,
        path: filename,
        ref: ref || this.context.sha,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return {
        filename,
        content: data.content,
        encoding: data.encoding as 'base64' | 'utf-8',
      };
    } catch (error) {
      // File might not exist (new file) or be binary
      return null;
    }
  }

  /**
   * Decode file content
   */
  decodeFileContent(file: GitHubFile): string {
    if (file.encoding === 'base64') {
      return Buffer.from(file.content, 'base64').toString('utf-8');
    }
    return file.content;
  }

  /**
   * Get existing bot comments
   */
  async getExistingBotComments(): Promise<{
    summaryComment?: SummaryComment;
    inlineComments: InlineComment[];
  }> {
    try {
      // Get issue comments (for summary)
      const { data: issueComments } = await this.octokit.rest.issues.listComments({
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: this.context.pullNumber,
      });

      // Get review comments (for inline comments)
      const { data: reviewComments } = await this.octokit.rest.pulls.listReviewComments({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      const summaryComment = issueComments
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER))
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.SUMMARY_MARKER))
        .map(comment => ({
          id: comment.id,
          body: comment.body || '',
          reviewResult: {} as any, // Will be populated when needed
        }))[0];

      const inlineComments = reviewComments
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER))
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.INLINE_MARKER))
        .map(comment => ({
          id: comment.id,
          body: comment.body || '',
          location: {
            file: comment.path || '',
            line: comment.line || comment.original_line || 0,
            side: (comment.side || 'RIGHT') as 'RIGHT' | 'LEFT',
          },
          issue: {} as any, // Will be populated when needed
        }));

      const result: { summaryComment?: SummaryComment; inlineComments: InlineComment[]; } = { inlineComments };
      if (summaryComment) {
        result.summaryComment = summaryComment;
      }
      return result;
    } catch (error) {
      logger.warn('Warning: Could not fetch existing comments:', error);
      return { inlineComments: [] };
    }
  }

  /**
   * Post or update summary comment
   */
  async postSummaryComment(comment: SummaryComment, existingCommentId?: number): Promise<void> {
    try {
      const body = this.formatSummaryComment(comment);

      if (existingCommentId) {
        await this.octokit.rest.issues.updateComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: existingCommentId,
          body,
        });
      } else {
        await this.octokit.rest.issues.createComment({
          owner: this.context.owner,
          repo: this.context.repo,
          issue_number: this.context.pullNumber,
          body,
        });
      }
    } catch (error) {
      throw new Error(`Failed to post summary comment: ${error}`);
    }
  }

  /**
   * Post or update inline comment
   */
  async postInlineComment(comment: InlineComment, existingCommentId?: number): Promise<void> {
    try {
      const body = this.formatInlineComment(comment);

      if (existingCommentId) {
        await this.octokit.rest.pulls.updateReviewComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: existingCommentId,
          body,
        });
      } else {
        await this.octokit.rest.pulls.createReviewComment({
          owner: this.context.owner,
          repo: this.context.repo,
          pull_number: this.context.pullNumber,
          commit_id: this.context.sha,
          path: comment.location.file,
          line: comment.location.line,
          side: comment.location.side,
          body,
        });
      }
    } catch (error) {
      logger.warn(`Warning: Could not post inline comment: ${error}`);
      // Don't throw - inline comments might fail due to line positioning
    }
  }

  /**
   * Format summary comment with markers
   */
  private formatSummaryComment(comment: SummaryComment): string {
    return `${COMMENT_MARKERS.BOT_IDENTIFIER}
${COMMENT_MARKERS.SUMMARY_MARKER}

${comment.body}`;
  }

  /**
   * Format inline comment with markers
   */
  private formatInlineComment(comment: InlineComment): string {
    return `${COMMENT_MARKERS.BOT_IDENTIFIER}
${COMMENT_MARKERS.INLINE_MARKER}

${comment.body}`;
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: number, type: 'issue' | 'review'): Promise<void> {
    try {
      if (type === 'issue') {
        await this.octokit.rest.issues.deleteComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: commentId,
        });
      } else {
        await this.octokit.rest.pulls.deleteReviewComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: commentId,
        });
      }
    } catch (error) {
      logger.warn(`Warning: Could not delete comment ${commentId}:`, error);
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      
      return {
        remaining: data.rate.remaining,
        resetTime: new Date(data.rate.reset * 1000),
        limit: data.rate.limit,
      };
    } catch (error) {
      // Return default values if rate limit check fails
      return {
        remaining: 1000,
        resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        limit: 5000,
      };
    }
  }

  /**
   * Check if we're approaching rate limits
   */
  async checkRateLimit(): Promise<boolean> {
    const rateLimit = await this.getRateLimit();
    const remainingPercentage = (rateLimit.remaining / rateLimit.limit) * 100;
    
    if (remainingPercentage < 10) {
      logger.warn(`Warning: GitHub API rate limit low (${rateLimit.remaining}/${rateLimit.limit})`);
      return false;
    }
    
    return true;
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo() {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.context.owner,
        repo: this.context.repo,
      });

      return {
        name: data.name,
        fullName: data.full_name,
        defaultBranch: data.default_branch,
        language: data.language,
        size: data.size,
        isPrivate: data.private,
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error}`);
    }
  }

  /**
   * Download repository archive for full analysis
   */
  async downloadRepository(ref?: string): Promise<Buffer> {
    try {
      const { data } = await this.octokit.rest.repos.downloadZipballArchive({
        owner: this.context.owner,
        repo: this.context.repo,
        ref: ref || this.context.sha,
      });

      return Buffer.from(data as ArrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download repository: ${error}`);
    }
  }
}
