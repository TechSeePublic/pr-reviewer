/**
 * Main PR Reviewer orchestrator
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import {
  ActionInputs,
  AIProvider,
  CodeIssue,
  CursorRule,
  CursorRulesConfig,
  FileChange,
  PRContext,
  ReviewContext,
  ReviewResult,
} from './types';
import { CursorRulesParser } from './cursor-parser';
import { GitHubClient } from './github-client';
import { AIProviderFactory } from './ai-providers';
import { CommentManager } from './comment-manager';
import { AutoFixManager } from './auto-fix-manager';

export class PRReviewer {
  private inputs: ActionInputs;
  private prContext: PRContext;
  private githubClient: GitHubClient;
  private aiProvider: AIProvider;
  private commentManager: CommentManager;
  private autoFixManager: AutoFixManager;
  private workspacePath: string;

  constructor(inputs: ActionInputs, workspacePath: string = process.cwd()) {
    this.inputs = inputs;
    this.workspacePath = workspacePath;

    // Extract PR context from GitHub context
    this.prContext = this.extractPRContext();

    // Initialize clients
    this.githubClient = new GitHubClient(inputs.githubToken, this.prContext);
    this.aiProvider = AIProviderFactory.create(inputs);
    this.commentManager = new CommentManager(this.githubClient, inputs);
    this.autoFixManager = new AutoFixManager(
      this.githubClient,
      inputs,
      this.prContext,
      this.workspacePath
    );
  }

  /**
   * Main review process
   */
  async reviewPR(): Promise<ReviewResult> {
    try {
      core.info('🚀 Starting Cursor AI PR Review...');

      // Step 1: Parse Cursor rules
      core.info('📋 Parsing Cursor rules...');
      const cursorRules = await this.parseCursorRules();

      if (this.shouldSkipReview(cursorRules)) {
        return this.createSkippedResult('No Cursor rules found');
      }

      // Step 2: Get PR file changes
      core.info('📁 Analyzing PR file changes...');
      const fileChanges = await this.githubClient.getPRChanges(this.inputs);

      if (fileChanges.length === 0) {
        return this.createSkippedResult('No files to review');
      }

      core.info(`Found ${fileChanges.length} files to review`);

      // Step 3: Filter applicable rules
      const applicableRules = this.filterApplicableRules(cursorRules, fileChanges);
      core.info(`Applying ${applicableRules.length} Cursor rules`);

      if (applicableRules.length === 0 && this.inputs.skipIfNoRules) {
        return this.createSkippedResult('No applicable rules found');
      }

      // Step 4: Review each file
      core.info('🔍 Reviewing files with AI...');
      const allIssues = await this.reviewFiles(fileChanges, applicableRules);

      // Step 5: Generate review result
      const reviewResult = await this.generateReviewResult(
        allIssues,
        fileChanges,
        applicableRules,
        cursorRules
      );

      // Step 6: Apply auto-fixes if enabled
      if (this.inputs.enableAutoFix) {
        core.info('🔧 Applying auto-fixes...');
        const autoFixResults = await this.autoFixManager.applyAutoFixes(allIssues, fileChanges);

        if (autoFixResults.length > 0) {
          const appliedFixes = autoFixResults.filter(result => result.applied);
          if (appliedFixes.length > 0) {
            core.info(`✅ Applied ${appliedFixes.length} auto-fixes`);
            await this.autoFixManager.commitFixes(autoFixResults);
          } else {
            core.info('ℹ️ No auto-fixes could be applied');
          }
        }
      }

      // Step 7: Post comments
      core.info('💬 Posting review comments...');
      await this.commentManager.postReviewComments(reviewResult, fileChanges);

      // Step 8: Set outputs
      this.setActionOutputs(reviewResult);

      core.info(`✅ Review completed: ${reviewResult.status} (${allIssues.length} issues found)`);
      return reviewResult;
    } catch (error) {
      core.setFailed(`PR review failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract PR context from GitHub environment
   */
  private extractPRContext(): PRContext {
    const context = github.context;

    if (!context.payload.pull_request) {
      throw new Error('This action can only be run on pull request events');
    }

    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pullNumber: context.payload.pull_request.number,
      sha: context.payload.pull_request.head.sha,
      baseSha: context.payload.pull_request.base.sha,
    };
  }

  /**
   * Parse Cursor rules from repository
   */
  private async parseCursorRules(): Promise<CursorRulesConfig> {
    const parser = new CursorRulesParser(this.workspacePath);
    return await parser.parseAllRules(this.inputs.rulesPath);
  }

  /**
   * Check if review should be skipped
   */
  private shouldSkipReview(cursorRules: CursorRulesConfig): boolean {
    if (!this.inputs.skipIfNoRules) {
      return false;
    }

    const hasRules =
      cursorRules.projectRules.length > 0 || cursorRules.agentsMarkdown || cursorRules.legacyRules;

    return !hasRules;
  }

  /**
   * Filter rules that apply to the changed files
   */
  private filterApplicableRules(
    cursorRules: CursorRulesConfig,
    fileChanges: FileChange[]
  ): CursorRule[] {
    const parser = new CursorRulesParser(this.workspacePath);
    const changedFiles = fileChanges.map(fc => fc.filename);

    return parser.filterRulesForFiles(cursorRules.projectRules, changedFiles);
  }

  /**
   * Review all changed files
   */
  private async reviewFiles(fileChanges: FileChange[], rules: CursorRule[]): Promise<CodeIssue[]> {
    const allIssues: CodeIssue[] = [];
    const maxConcurrentReviews = 3; // Limit concurrent AI requests

    // Process files in batches to avoid rate limits
    for (let i = 0; i < fileChanges.length; i += maxConcurrentReviews) {
      const batch = fileChanges.slice(i, i + maxConcurrentReviews);

      const batchPromises = batch.map(async fileChange => {
        try {
          return await this.reviewSingleFile(fileChange, rules);
        } catch (error) {
          core.warning(`Failed to review file ${fileChange.filename}: ${error}`);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const issues of batchResults) {
        allIssues.push(...issues);
      }

      // Add delay between batches to respect rate limits
      if (i + maxConcurrentReviews < fileChanges.length) {
        await this.delay(1000); // 1 second delay
      }
    }

    return allIssues;
  }

  /**
   * Review a single file
   */
  private async reviewSingleFile(
    fileChange: FileChange,
    rules: CursorRule[]
  ): Promise<CodeIssue[]> {
    // Skip binary files or very large files
    if (fileChange.changes > 1000) {
      core.warning(`Skipping large file ${fileChange.filename} (${fileChange.changes} changes)`);
      return [];
    }

    // Get file content
    const fileContent = await this.getFileContent(fileChange);
    if (!fileContent) {
      return [];
    }

    // Build context for AI review
    const context = this.buildReviewContext(fileChange, fileContent);

    // Get AI review
    const issues = await this.aiProvider.reviewCode(context, fileContent, rules);

    // Enhance issues with file information
    return issues.map(issue => ({
      ...issue,
      file: fileChange.filename,
    }));
  }

  /**
   * Get file content for review
   */
  private async getFileContent(fileChange: FileChange): Promise<string | null> {
    try {
      // For new files or modified files, get the latest content
      const file = await this.githubClient.getFileContent(fileChange.filename);

      if (!file) {
        // Try to read from local workspace if available
        const localPath = path.join(this.workspacePath, fileChange.filename);
        if (fs.existsSync(localPath)) {
          return fs.readFileSync(localPath, 'utf-8');
        }
        return null;
      }

      return this.githubClient.decodeFileContent(file);
    } catch (error) {
      core.warning(`Could not get content for ${fileChange.filename}: ${error}`);
      return null;
    }
  }

  /**
   * Build review context for AI
   */
  private buildReviewContext(fileChange: FileChange, _fileContent: string): string {
    let context = `Reviewing file: ${fileChange.filename}\n`;
    context += `Change type: ${fileChange.status}\n`;
    context += `Changes: +${fileChange.additions} -${fileChange.deletions}\n\n`;

    // Include patch information for context
    if (fileChange.patch) {
      context += `Diff patch (focus your analysis ONLY on these changes):\n${fileChange.patch}\n\n`;

      // Extract changed line numbers for more precise analysis
      const changedLines = this.extractChangedLines(fileChange.patch);
      if (changedLines.length > 0) {
        context += `Changed line numbers: ${changedLines.join(', ')}\n\n`;
      }
    }

    context += `IMPORTANT: Only flag issues that are directly related to the code changes shown in the diff above.\n`;
    context += `Do NOT comment on pre-existing code unless it's directly impacted by the current changes.\n`;
    context += `Focus your analysis specifically on:\n`;
    context += `1. Lines that were added (marked with +)\n`;
    context += `2. Lines that were modified (context around changes)\n`;
    context += `3. Logic that is directly affected by the changes\n\n`;

    return context;
  }

  /**
   * Generate comprehensive review result
   */
  private async generateReviewResult(
    issues: CodeIssue[],
    fileChanges: FileChange[],
    appliedRules: CursorRule[],
    cursorRules: CursorRulesConfig
  ): Promise<ReviewResult> {
    // Determine review status
    const status = this.determineReviewStatus(issues);

    // Build review context for AI summary
    const reviewContext: ReviewContext = {
      prContext: this.prContext,
      fileChanges,
      cursorRules,
      inputs: this.inputs,
    };

    // Generate AI summary
    let summary = '';
    try {
      summary = await this.aiProvider.generateSummary(issues, reviewContext);
    } catch (error) {
      core.warning(`Failed to generate AI summary: ${error}`);
      summary = this.generateFallbackSummary(issues, fileChanges.length);
    }

    return {
      issues,
      filesReviewed: fileChanges.length,
      totalFiles: fileChanges.length,
      rulesApplied: appliedRules,
      summary,
      status,
    };
  }

  /**
   * Determine review status based on issues found
   */
  private determineReviewStatus(issues: CodeIssue[]): ReviewResult['status'] {
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    if (errorCount > 0) {
      return 'failed';
    } else if (warningCount > 0) {
      return 'needs_attention';
    } else {
      return 'passed';
    }
  }

  /**
   * Generate fallback summary if AI summary fails
   */
  private generateFallbackSummary(issues: CodeIssue[], filesReviewed: number): string {
    if (issues.length === 0) {
      return `Great work! All ${filesReviewed} files follow the Cursor rules with no violations found.`;
    }

    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;

    let summary = `Found ${issues.length} issue${issues.length === 1 ? '' : 's'} across ${filesReviewed} files. `;

    if (errorCount > 0) {
      summary += `${errorCount} error${errorCount === 1 ? '' : 's'} need immediate attention. `;
    }

    if (warningCount > 0) {
      summary += `${warningCount} warning${warningCount === 1 ? '' : 's'} should be addressed. `;
    }

    summary += 'Please review the specific comments and apply the suggested fixes.';

    return summary;
  }

  /**
   * Create result for skipped reviews
   */
  private createSkippedResult(reason: string): ReviewResult {
    core.info(`Skipping review: ${reason}`);

    return {
      issues: [],
      filesReviewed: 0,
      totalFiles: 0,
      rulesApplied: [],
      summary: `Review skipped: ${reason}`,
      status: 'passed',
    };
  }

  /**
   * Set GitHub Action outputs
   */
  private setActionOutputs(result: ReviewResult): void {
    core.setOutput('review_summary', result.summary);
    core.setOutput('files_reviewed', result.filesReviewed.toString());
    core.setOutput('issues_found', result.issues.length.toString());
    core.setOutput('rules_applied', result.rulesApplied.length.toString());
  }

  /**
   * Extract changed line numbers from patch
   */
  private extractChangedLines(patch: string): number[] {
    const changedLines: number[] = [];
    const lines = patch.split('\n');
    let currentLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
        const match = line.match(/\+(\d+)/);
        if (match && match[1]) {
          currentLine = parseInt(match[1], 10) - 1;
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line
        currentLine++;
        changedLines.push(currentLine);
      } else if (line.startsWith(' ')) {
        // Context line
        currentLine++;
      }
      // Ignore deleted lines (-)
    }

    return changedLines;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
