/**
 * GitHub API client for PR analysis and commenting
 */

import * as github from '@actions/github';
// import { Octokit } from '@octokit/rest'; // Currently unused
import { minimatch } from 'minimatch';
import {
  ActionInputs,
  CodeIssue,
  FileChange,
  GitHubFile,
  InlineComment,
  PRContext,
  RateLimitInfo,
  ReviewResult,
  SummaryComment,
} from './types';
import { COMMENT_MARKERS } from './config';
import { logger } from './logger';

export class GitHubClient {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: PRContext;
  private rateLimitDelay: number;
  private lastApiCall: number = 0;

  constructor(token: string, context: PRContext, rateLimitDelay: number = 1000) {
    this.octokit = github.getOctokit(token);
    this.context = context;
    this.rateLimitDelay = rateLimitDelay;
  }

  /**
   * Apply rate limiting before making API calls
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    if (timeSinceLastCall < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastCall;
      logger.info(`Rate limiting: waiting ${waitTime}ms before GitHub API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastApiCall = Date.now();
  }

  /**
   * Get PR file changes
   */
  async getPRChanges(inputs: ActionInputs): Promise<FileChange[]> {
    try {
      // Get PR metadata and update context if running manually
      await this.applyRateLimit();
      const { data: prData } = await this.octokit.rest.pulls.get({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      // Update context with correct SHA values if running manually
      if (inputs.prNumber) {
        this.context.sha = prData.head.sha;
        this.context.baseSha = prData.base.sha;
      }

      await this.applyRateLimit();
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
      await this.applyRateLimit();
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
    architecturalComment?: SummaryComment;
    inlineComments: InlineComment[];
  }> {
    try {
      // Get issue comments (for summary)
      await this.applyRateLimit();
      const { data: issueComments } = await this.octokit.rest.issues.listComments({
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: this.context.pullNumber,
      });

      // Get review comments (for inline comments)
      await this.applyRateLimit();
      const { data: reviewComments } = await this.octokit.rest.pulls.listReviewComments({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      // Find summary comment - look for summary marker OR TechSee AI PR Review header (for backwards compatibility)
      let summaryComment = issueComments
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER))
        .filter(comment =>
          comment.body?.includes(COMMENT_MARKERS.SUMMARY_MARKER) ||
          comment.body?.includes('TechSee AI PR Review Summary') ||
          comment.body?.includes('## 🤖 TechSee AI PR Review Summary') ||
          (comment.body?.includes('techsee-ai-pr-reviewer') && comment.body?.includes('Review Summary'))
        )
        .map(comment => ({
          id: comment.id,
          body: comment.body || '',
          reviewResult: {} as ReviewResult, // Will be populated when needed
        }))[0];

      // Find architectural comment - look for architectural marker OR architectural header
      const architecturalComment = issueComments
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER))
        .filter(comment =>
          comment.body?.includes(COMMENT_MARKERS.ARCHITECTURAL_MARKER) ||
          comment.body?.includes('## 🏗️ Architectural Review') ||
          (comment.body?.includes('techsee-ai-pr-reviewer') && comment.body?.includes('Architectural'))
        )
        .map(comment => ({
          id: comment.id,
          body: comment.body || '',
          reviewResult: {} as ReviewResult, // Will be populated when needed
        }))[0];

      // IMPORTANT: If we found an architectural comment but it's the same as the summary comment,
      // prioritize it as architectural and clear the summary comment
      // This handles the case where old architectural comments were posted as summary comments
      if (architecturalComment && summaryComment && architecturalComment.id === summaryComment.id) {
        logger.info(`🔄 Found architectural comment that was posted as summary comment (ID ${architecturalComment.id})`);
        summaryComment = undefined; // Clear summary so it will be treated as architectural only
      }

      // Find inline comments - look for inline marker OR Code Review Finding header
      const inlineComments = reviewComments
        .filter(comment => comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER))
        .filter(comment =>
          comment.body?.includes(COMMENT_MARKERS.INLINE_MARKER) ||
          comment.body?.includes('## 🤖 Code Review Finding') ||
          comment.body?.includes('Code Review Finding') ||
          (comment.body?.includes('techsee-ai-pr-reviewer') && (
            comment.body?.includes('ERROR') ||
            comment.body?.includes('WARNING') ||
            comment.body?.includes('Rule:') ||
            comment.body?.includes('Suggested Fix:')
          ))
        )
        .map(comment => ({
          id: comment.id,
          body: comment.body || '',
          location: {
            file: comment.path || '',
            line: comment.line || comment.original_line || 0,
            side: (comment.side || 'RIGHT') as 'RIGHT' | 'LEFT',
          },
          issue: {} as CodeIssue, // Will be populated when needed
        }));

      const result: { summaryComment?: SummaryComment; architecturalComment?: SummaryComment; inlineComments: InlineComment[] } = {
        inlineComments,
      };
      if (summaryComment) {
        result.summaryComment = summaryComment;
      }
      if (architecturalComment) {
        result.architecturalComment = architecturalComment;
      }
      return result;
    } catch (error) {
      logger.warn('Warning: Could not fetch existing comments:', error);
      return { inlineComments: [] };
    }
  }

  /**
   * Log existing comments for debugging
   */
  async logExistingComments(): Promise<void> {
    logger.info(`\n=== EXISTING COMMENTS DEBUG ===`);

    try {
      // Get raw comments first for debugging
      await this.applyRateLimit();
      const { data: issueComments } = await this.octokit.rest.issues.listComments({
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: this.context.pullNumber,
      });

      await this.applyRateLimit();
      const { data: reviewComments } = await this.octokit.rest.pulls.listReviewComments({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      logger.info(`📊 Raw GitHub data:`);
      logger.info(`  - Issue comments found: ${issueComments.length}`);
      logger.info(`  - Review comments found: ${reviewComments.length}`);

      // Check which comments have our bot identifier
      const botIssueComments = issueComments.filter(comment =>
        comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER)
      );
      const botReviewComments = reviewComments.filter(comment =>
        comment.body?.includes(COMMENT_MARKERS.BOT_IDENTIFIER)
      );

      logger.info(`🤖 Bot comments found:`);
      logger.info(`  - Bot issue comments: ${botIssueComments.length}`);
      logger.info(`  - Bot review comments: ${botReviewComments.length}`);

      // Show first few characters of each bot comment to see what markers they have
      botIssueComments.forEach((comment, i) => {
        const preview = comment.body?.substring(0, 200).replace(/\n/g, '\\n') || '';
        logger.info(`  Issue Comment ${i + 1} (ID ${comment.id}): "${preview}..."`);
      });

      botReviewComments.forEach((comment, i) => {
        const preview = comment.body?.substring(0, 200).replace(/\n/g, '\\n') || '';
        logger.info(`  Review Comment ${i + 1} (ID ${comment.id}): "${preview}..."`);
      });

      // Now get parsed comments
      const existing = await this.getExistingBotComments();
      logger.info(`\n📋 Parsed results:`);
      logger.info(`Summary comment: ${existing.summaryComment ? `ID ${existing.summaryComment.id}` : 'None'}`);
      logger.info(`Architectural comment: ${existing.architecturalComment ? `ID ${existing.architecturalComment.id}` : 'None'}`);
      logger.info(`Inline comments: ${existing.inlineComments.length} found`);
      existing.inlineComments.forEach((comment, i) => {
        logger.info(`  ${i + 1}. ID ${comment.id} at ${comment.location.file}:${comment.location.line}`);
      });
    } catch (error) {
      logger.error(`❌ Error fetching comments for debug: ${error}`);
    }

    logger.info(`===============================\n`);
  }

  /**
   * Post or update summary comment
   */
  async postSummaryComment(comment: SummaryComment, existingCommentId?: number): Promise<void> {
    try {
      const body = this.formatSummaryComment(comment);

      if (existingCommentId) {
        await this.applyRateLimit();
        await this.octokit.rest.issues.updateComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: existingCommentId,
          body,
        });
        logger.info(`✅ Updated existing summary comment ${existingCommentId}`);
      } else {
        await this.applyRateLimit();
        await this.octokit.rest.issues.createComment({
          owner: this.context.owner,
          repo: this.context.repo,
          issue_number: this.context.pullNumber,
          body,
        });
        logger.info(`✅ Created new summary comment`);
      }
    } catch (error) {
      throw new Error(`Failed to post summary comment: ${error}`);
    }
  }

  /**
   * Post or update architectural comment
   */
  async postArchitecturalComment(comment: SummaryComment, existingCommentId?: number): Promise<void> {
    try {
      const body = this.formatArchitecturalComment(comment);

      if (existingCommentId) {
        await this.applyRateLimit();
        await this.octokit.rest.issues.updateComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: existingCommentId,
          body,
        });
        logger.info(`✅ Updated existing architectural comment ${existingCommentId}`);
      } else {
        await this.applyRateLimit();
        await this.octokit.rest.issues.createComment({
          owner: this.context.owner,
          repo: this.context.repo,
          issue_number: this.context.pullNumber,
          body,
        });
        logger.info(`✅ Created new architectural comment`);
      }
    } catch (error) {
      throw new Error(`Failed to post architectural comment: ${error}`);
    }
  }

  /**
   * Post or update inline comment
   */
  async postInlineComment(comment: InlineComment, existingCommentId?: number): Promise<number | null> {
    try {
      const body = this.formatInlineComment(comment);

      if (existingCommentId) {
        await this.applyRateLimit();
        await this.octokit.rest.pulls.updateReviewComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: existingCommentId,
          body,
        });
        logger.info(`✅ Updated existing inline comment ${existingCommentId} at ${comment.location.file}:${comment.location.line}`);
        return existingCommentId;
      } else {
        await this.applyRateLimit();
        logger.debug(
          `Creating review comment at ${comment.location.file}:${comment.location.line} (${comment.location.side})`
        );
        const response = await this.octokit.rest.pulls.createReviewComment({
          owner: this.context.owner,
          repo: this.context.repo,
          pull_number: this.context.pullNumber,
          commit_id: this.context.sha,
          path: comment.location.file,
          line: comment.location.line,
          side: comment.location.side,
          body,
        });
        logger.info(
          `✅ Created new inline comment ${response.data.id} at ${comment.location.file}:${comment.location.line}`
        );
        return response.data.id;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        `Warning: Could not post inline comment at ${comment.location.file}:${comment.location.line}: ${errorMessage}`
      );

      // Log more details for debugging random positioning issues
      if (
        errorMessage.includes('line') ||
        errorMessage.includes('position') ||
        errorMessage.includes('422')
      ) {
        logger.warn(`GitHub API error details for comment positioning:`, {
          file: comment.location.file,
          line: comment.location.line,
          side: comment.location.side,
          error: errorMessage,
        });
      }

      // Don't throw - inline comments might fail due to line positioning
      return null;
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
   * Format architectural comment with markers
   */
  private formatArchitecturalComment(comment: SummaryComment): string {
    return `${COMMENT_MARKERS.BOT_IDENTIFIER}
${COMMENT_MARKERS.ARCHITECTURAL_MARKER}

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
        await this.applyRateLimit();
        await this.octokit.rest.issues.deleteComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: commentId,
        });
      } else {
        await this.applyRateLimit();
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
      await this.applyRateLimit();
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
      await this.applyRateLimit();
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
      await this.applyRateLimit();
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
