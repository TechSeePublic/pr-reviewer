/**
 * Auto-fix manager for applying code fixes automatically
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  ActionInputs,
  AutoFixResult,
  CodeIssue,
  CommitResult,
  FileChange,
  PRContext
} from './types';
import { GitHubClient } from './github-client';
import { logger } from './logger';

export class AutoFixManager {
  private githubClient: GitHubClient;
  private inputs: ActionInputs;
  private prContext: PRContext;
  private workspacePath: string;

  constructor(
    githubClient: GitHubClient,
    inputs: ActionInputs,
    prContext: PRContext,
    workspacePath: string = process.cwd()
  ) {
    this.githubClient = githubClient;
    this.inputs = inputs;
    this.prContext = prContext;
    this.workspacePath = workspacePath;
  }

  /**
   * Apply auto-fixes for eligible issues
   */
  async applyAutoFixes(issues: CodeIssue[], fileChanges: FileChange[]): Promise<AutoFixResult[]> {
    if (!this.inputs.enableAutoFix) {
      return [];
    }

    const eligibleIssues = this.filterEligibleIssues(issues);
    if (eligibleIssues.length === 0) {
      core.info('No eligible issues for auto-fix');
      return [];
    }

    core.info(`Attempting to auto-fix ${eligibleIssues.length} issues`);
    const results: AutoFixResult[] = [];

    // Group issues by file for efficient processing
    const issuesByFile = this.groupIssuesByFile(eligibleIssues);

    for (const [fileName, fileIssues] of Object.entries(issuesByFile)) {
      try {
        const fileResults = await this.applyFixesToFile(fileName, fileIssues, fileChanges);
        results.push(...fileResults);
      } catch (error) {
        logger.error(`Failed to apply fixes to ${fileName}:`, error);
        // Add failed results for all issues in this file
        for (const issue of fileIssues) {
          results.push({
            file: fileName,
            issue,
            applied: false,
            error: `Failed to process file: ${error}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Commit the applied fixes
   */
  async commitFixes(fixResults: AutoFixResult[]): Promise<CommitResult | null> {
    const successfulFixes = fixResults.filter(result => result.applied);
    if (successfulFixes.length === 0) {
      return null;
    }

    try {
      // Get unique files that were modified
      const modifiedFiles = [...new Set(successfulFixes.map(fix => fix.file))];

      // Create commit message
      const commitMessage = this.generateCommitMessage(successfulFixes);

      core.info(`Committing ${successfulFixes.length} auto-fixes to ${modifiedFiles.length} files`);

      // For now, we'll create a comment suggesting the fixes rather than auto-committing
      // This is safer and allows for human review
      await this.createAutoFixSummaryComment(successfulFixes);

      return {
        sha: '', // Would be populated in actual commit
        message: commitMessage,
        filesChanged: modifiedFiles.length,
      };
    } catch (error) {
      logger.error('Failed to commit auto-fixes:', error);
      throw error;
    }
  }

  /**
   * Filter issues eligible for auto-fix
   */
  private filterEligibleIssues(issues: CodeIssue[]): CodeIssue[] {
    const severityFilter = this.inputs.autoFixSeverity;
    const severityLevels = {
      error: 4,
      warning: 3,
      info: 2,
      all: 1,
    };

    const minSeverityLevel = severityLevels[severityFilter];

    return issues.filter(issue => {
      // Must have either fixed code or a clear suggestion
      if (!issue.fixedCode && !issue.suggestion) {
        return false;
      }

      // Check severity level
      const issueSeverityLevel = severityLevels[issue.type as keyof typeof severityLevels] || 1;
      if (issueSeverityLevel < minSeverityLevel) {
        return false;
      }

      // Only safe categories for auto-fix
      const safeCategoriesForAutoFix = ['rule_violation', 'best_practice'];
      if (!safeCategoriesForAutoFix.includes(issue.category)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Group issues by file
   */
  private groupIssuesByFile(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const grouped: Record<string, CodeIssue[]> = {};

    for (const issue of issues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      // TypeScript knows grouped[issue.file] is defined here due to the check above
      grouped[issue.file]!.push(issue);
    }

    return grouped;
  }

  /**
   * Apply fixes to a single file
   */
  private async applyFixesToFile(
    fileName: string,
    issues: CodeIssue[],
    fileChanges: FileChange[]
  ): Promise<AutoFixResult[]> {
    const results: AutoFixResult[] = [];

    // Get current file content
    const currentContent = await this.getFileContent(fileName);
    if (!currentContent) {
      for (const issue of issues) {
        results.push({
          file: fileName,
          issue,
          applied: false,
          error: 'Could not read file content',
        });
      }
      return results;
    }

    let modifiedContent = currentContent;
    const lines = currentContent.split('\n');

    // Sort issues by line number (descending) to avoid line number shifts
    const sortedIssues = issues
      .filter(issue => issue.line !== undefined)
      .sort((a, b) => (b.line || 0) - (a.line || 0));

    for (const issue of sortedIssues) {
      try {
        const fixResult = await this.applyIndividualFix(
          modifiedContent,
          issue,
          lines,
          fileName
        );

        if (fixResult.success) {
          modifiedContent = fixResult.content;
          results.push({
            file: fileName,
            issue,
            applied: true,
          });
        } else {
          results.push({
            file: fileName,
            issue,
            applied: false,
            error: fixResult.error || 'Unknown error occurred',
          });
        }
      } catch (error) {
        results.push({
          file: fileName,
          issue,
          applied: false,
          error: `Fix application failed: ${error}`,
        });
      }
    }

    // Write the modified content back to file (in local workspace)
    if (modifiedContent !== currentContent) {
      try {
        const localPath = path.join(this.workspacePath, fileName);
        fs.writeFileSync(localPath, modifiedContent, 'utf-8');
        core.info(`Applied auto-fixes to ${fileName}`);
      } catch (error) {
        logger.error(`Failed to write fixed content to ${fileName}:`, error);
        // Mark all successful fixes as failed
        for (const result of results) {
          if (result.applied) {
            result.applied = false;
            result.error = 'Failed to write file';
          }
        }
      }
    }

    return results;
  }

  /**
   * Apply an individual fix to file content
   */
  private async applyIndividualFix(
    content: string,
    issue: CodeIssue,
    lines: string[],
    fileName: string
  ): Promise<{ success: boolean; content: string; error?: string }> {
    if (!issue.line) {
      return { success: false, content, error: 'No line number specified' };
    }

    const lineIndex = issue.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return { success: false, content, error: 'Line number out of range' };
    }

    if (issue.fixedCode) {
      // Apply complete fixed code
      const newLines = [...lines];

      if (issue.endLine) {
        // Replace range of lines
        const endIndex = issue.endLine - 1;
        newLines.splice(lineIndex, endIndex - lineIndex + 1, issue.fixedCode);
      } else {
        // Replace single line
        newLines[lineIndex] = issue.fixedCode;
      }

      return { success: true, content: newLines.join('\n') };
    } else if (issue.suggestion) {
      // Try to apply suggestion intelligently
      const originalLine = lines[lineIndex];

      // Simple heuristic: if suggestion looks like a complete line replacement
      if (originalLine && (issue.suggestion.includes('\n') || issue.suggestion.length > originalLine.length * 0.5)) {
        const newLines = [...lines];
        newLines[lineIndex] = issue.suggestion;
        return { success: true, content: newLines.join('\n') };
      }
    }

    return { success: false, content, error: 'No applicable fix method' };
  }

  /**
   * Get file content (local or remote)
   */
  private async getFileContent(fileName: string): Promise<string | null> {
    try {
      // Try local file first
      const localPath = path.join(this.workspacePath, fileName);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath, 'utf-8');
      }

      // Fall back to GitHub API
      const file = await this.githubClient.getFileContent(fileName);
      if (file) {
        return this.githubClient.decodeFileContent(file);
      }

      return null;
    } catch (error) {
      logger.warn(`Could not get content for ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Generate commit message for auto-fixes
   */
  private generateCommitMessage(fixes: AutoFixResult[]): string {
    const fixCount = fixes.length;
    const fileCount = new Set(fixes.map(fix => fix.file)).size;

    let message = `🤖 Auto-fix: Applied ${fixCount} code improvements`;

    if (fileCount > 1) {
      message += ` across ${fileCount} files`;
    }

    // Add details about fix categories
    const categories = new Set(fixes.map(fix => fix.issue.category));
    if (categories.size <= 3) {
      const categoryNames = Array.from(categories).join(', ');
      message += `\n\nCategories: ${categoryNames}`;
    }

    message += '\n\nGenerated by Cursor AI PR Reviewer';
    return message;
  }

  /**
   * Create a summary comment for auto-fixes
   */
  private async createAutoFixSummaryComment(fixes: AutoFixResult[]): Promise<void> {
    const fileCount = new Set(fixes.map(fix => fix.file)).size;

    let body = `## 🤖 Auto-Fix Summary\n\n`;
    body += `✅ **${fixes.length} fixes applied** across **${fileCount} files**\n\n`;

    // Group fixes by file
    const fixesByFile = this.groupIssuesByFile(fixes.map(fix => fix.issue));

    body += `### 📝 Files Modified:\n`;
    for (const [fileName, fileIssues] of Object.entries(fixesByFile)) {
      body += `- **${fileName}** (${fileIssues.length} fixes)\n`;
    }

    body += `\n### 🔧 Fix Categories:\n`;
    const categories = new Set(fixes.map(fix => fix.issue.category));
    for (const category of categories) {
      const categoryCount = fixes.filter(fix => fix.issue.category === category).length;
      body += `- **${this.formatCategoryName(category)}**: ${categoryCount}\n`;
    }

    body += `\n> 💡 **Note**: These fixes have been automatically applied to improve code quality based on the review findings.\n`;
    body += `\n---\n*🤖 Generated by Cursor AI PR Reviewer Auto-Fix*`;

    try {
      await this.githubClient.postSummaryComment(
        { body, reviewResult: {} as any },
        undefined
      );
    } catch (error) {
      logger.warn('Failed to post auto-fix summary comment:', error);
    }
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    switch (category) {
      case 'bug': return 'Bug Fixes';
      case 'security': return 'Security Issues';
      case 'performance': return 'Performance Improvements';
      case 'rule_violation': return 'Rule Violations';
      case 'best_practice': return 'Best Practices';
      default: return 'Other';
    }
  }
}
