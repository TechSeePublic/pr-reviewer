/**
 * Comment management system for inline and summary comments
 */

import { 
  CodeIssue, 
  ReviewResult, 
  InlineComment, 
  SummaryComment, 
  ActionInputs,
  FileChange,
  CursorRule,
  PRContext
} from './types';
import { GitHubClient } from './github-client';
import { SEVERITY_LEVELS } from './config';

export class CommentManager {
  private githubClient: GitHubClient;
  private inputs: ActionInputs;

  constructor(githubClient: GitHubClient, inputs: ActionInputs) {
    this.githubClient = githubClient;
    this.inputs = inputs;
  }

  /**
   * Post all review comments (inline and summary)
   */
  async postReviewComments(reviewResult: ReviewResult, fileChanges: FileChange[]): Promise<void> {
    const shouldPostInline = this.inputs.commentStyle === 'inline' || this.inputs.commentStyle === 'both';
    const shouldPostSummary = this.inputs.commentStyle === 'summary' || this.inputs.commentStyle === 'both';

    // Get existing comments if we should update them
    let existingComments: { inlineComments: InlineComment[]; summaryComment?: SummaryComment; } = { inlineComments: [] };
    
    if (this.inputs.updateExistingComments) {
      existingComments = await this.githubClient.getExistingBotComments();
    }

    // Post inline comments
    if (shouldPostInline) {
      await this.postInlineComments(reviewResult.issues, fileChanges, existingComments.inlineComments);
    }

    // Post summary comment
    if (shouldPostSummary) {
      await this.postSummaryComment(reviewResult, existingComments.summaryComment);
    }
  }

  /**
   * Post inline comments for specific issues
   */
  private async postInlineComments(
    issues: CodeIssue[], 
    fileChanges: FileChange[], 
    existingComments: InlineComment[]
  ): Promise<void> {
    // Filter issues based on severity
    const filteredIssues = this.filterIssuesBySeverity(issues);
    
    // Group issues by file and line
    const issuesByLocation = this.groupIssuesByLocation(filteredIssues);

    for (const [locationKey, locationIssues] of Object.entries(issuesByLocation)) {
      const [file, lineStr] = locationKey.split(':');
      if (!file || !lineStr) {
        console.warn(`Invalid location key: ${locationKey}`);
        continue;
      }
      const line = parseInt(lineStr, 10);

      // Validate that the line exists in the PR changes
      if (!this.isValidCommentLocation(file, line, fileChanges)) {
        console.warn(`Skipping inline comment for ${file}:${line} - not in PR diff`);
        continue;
      }

      // Create inline comment
      if (locationIssues.length === 0) {
        console.warn(`No issues for location ${locationKey}`);
        continue;
      }
      
      const comment: InlineComment = {
        body: this.formatInlineCommentBody(locationIssues),
        location: {
          file,
          line,
          side: 'RIGHT', // Always comment on new code
        },
        issue: locationIssues[0]!, // Store primary issue for reference (already validated above)
      };

      // Check if we should update existing comment
      const existingComment = existingComments.find(
        c => c.location.file === file && c.location.line === line
      );

      try {
        await this.githubClient.postInlineComment(comment, existingComment?.id);
      } catch (error) {
        console.warn(`Failed to post inline comment for ${file}:${line}:`, error);
      }
    }
  }

  /**
   * Post summary comment
   */
  private async postSummaryComment(reviewResult: ReviewResult, existingComment?: SummaryComment): Promise<void> {
    const comment: SummaryComment = {
      body: this.formatSummaryCommentBody(reviewResult),
      reviewResult,
    };

    try {
      await this.githubClient.postSummaryComment(comment, existingComment?.id);
    } catch (error) {
      console.error('Failed to post summary comment:', error);
      throw error;
    }
  }

  /**
   * Filter issues based on configured severity level
   */
  private filterIssuesBySeverity(issues: CodeIssue[]): CodeIssue[] {
    const minSeverityLevel = SEVERITY_LEVELS[this.inputs.inlineSeverity];
    
    return issues.filter(issue => {
      const issueSeverityLevel = SEVERITY_LEVELS[issue.type as keyof typeof SEVERITY_LEVELS] || 1;
      return issueSeverityLevel >= minSeverityLevel;
    });
  }

  /**
   * Group issues by file and line for inline comments
   */
  private groupIssuesByLocation(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const grouped: Record<string, CodeIssue[]> = {};

    for (const issue of issues) {
      if (!issue.file || !issue.line) {
        continue; // Skip issues without location info
      }

      const key = `${issue.file}:${issue.line}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(issue);
    }

    return grouped;
  }

  /**
   * Check if comment location is valid (exists in PR diff)
   */
  private isValidCommentLocation(file: string, line: number, fileChanges: FileChange[]): boolean {
    const fileChange = fileChanges.find(fc => fc.filename === file);
    
    if (!fileChange || !fileChange.patch) {
      return false;
    }

    // Parse patch to find valid line numbers
    const validLines = this.parseValidLinesFromPatch(fileChange.patch);
    return validLines.includes(line);
  }

  /**
   * Parse patch to extract valid line numbers for comments
   */
  private parseValidLinesFromPatch(patch: string): number[] {
    const validLines: number[] = [];
    const lines = patch.split('\n');
    let currentLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
        const match = line.match(/\+(\d+)/);
        if (match && match[1]) {
          currentLine = parseInt(match[1], 10) - 1;
        }
      } else if (line.startsWith('+')) {
        // Added line
        currentLine++;
        validLines.push(currentLine);
      } else if (line.startsWith(' ')) {
        // Context line
        currentLine++;
        validLines.push(currentLine);
      }
      // Ignore deleted lines (-)
    }

    return validLines;
  }

  /**
   * Format inline comment body
   */
  private formatInlineCommentBody(issues: CodeIssue[]): string {
    const primaryIssue = issues[0];
    if (!primaryIssue) {
      return '## 🤖 Cursor Rule Violation\n\nNo issues detected.';
    }
    
    let body = `## 🤖 Cursor Rule Violation\n\n`;

    // Primary issue
    body += `**${this.getIssueIcon(primaryIssue.type)} ${primaryIssue.type.toUpperCase()}:** ${primaryIssue.message}\n\n`;
    body += `${primaryIssue.description}\n\n`;

    // Rule information
    body += `**📋 Rule:** \`${primaryIssue.ruleId}\` - ${primaryIssue.ruleName}\n\n`;

    // Suggestion if available
    if (primaryIssue.suggestion && this.inputs.enableSuggestions) {
      body += `**💡 Suggestion:**\n\`\`\`\n${primaryIssue.suggestion}\n\`\`\`\n\n`;
    }

    // Additional issues at the same location
    if (issues.length > 1) {
      body += `**Additional issues at this location:**\n`;
      for (let i = 1; i < issues.length; i++) {
        const issue = issues[i];
        if (issue) {
          body += `- ${this.getIssueIcon(issue.type)} ${issue.message}\n`;
        }
      }
      body += '\n';
    }

    body += `---\n*Generated by [Cursor AI PR Reviewer](https://github.com/amit.wagner/pr-reviewer)*`;

    return body;
  }

  /**
   * Format summary comment body
   */
  private formatSummaryCommentBody(reviewResult: ReviewResult): string {
    const { issues, filesReviewed, totalFiles, rulesApplied, summary, status } = reviewResult;
    
    let body = `## 🤖 Cursor AI PR Review Summary\n\n`;

    // Status indicator
    const statusIcon = this.getStatusIcon(status);
    body += `### ${statusIcon} **Overall Status: ${status.replace('_', ' ').toUpperCase()}**\n\n`;

    // Stats
    body += `### 📊 **Review Statistics**\n`;
    body += `- **Files Reviewed:** ${filesReviewed}/${totalFiles}\n`;
    body += `- **Issues Found:** ${issues.length}\n`;
    body += `- **Rules Applied:** ${rulesApplied.length}\n\n`;

    // Issues breakdown
    if (issues.length > 0) {
      const issuesByType = this.groupIssuesByType(issues);
      body += `### ⚠️ **Issues by Type**\n`;
      
      for (const [type, typeIssues] of Object.entries(issuesByType)) {
        const icon = this.getIssueIcon(type);
        body += `- **${icon} ${type.toUpperCase()}:** ${typeIssues.length}\n`;
      }
      body += '\n';

      // Detailed format for detailed summary
      if (this.inputs.summaryFormat === 'detailed' && issues.length <= 10) {
        body += `### 📋 **Issue Details**\n`;
        
        for (const issue of issues.slice(0, 10)) {
          body += `- ${this.getIssueIcon(issue.type)} **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
        }
        
        if (issues.length > 10) {
          body += `- ... and ${issues.length - 10} more issues\n`;
        }
        body += '\n';
      }
    }

    // Rules applied
    if (rulesApplied.length > 0) {
      body += `### 📝 **Cursor Rules Applied**\n`;
      
      for (const rule of rulesApplied) {
        const typeEmoji = this.getRuleTypeEmoji(rule.type);
        body += `- ${typeEmoji} \`${rule.id}\``;
        if (rule.description) {
          body += ` - ${rule.description}`;
        }
        body += '\n';
      }
      body += '\n';
    }

    // AI-generated summary
    if (summary) {
      body += `### 🎯 **Assessment**\n${summary}\n\n`;
    }

    // Next steps
    if (issues.length > 0) {
      body += `### 🚀 **Next Steps**\n`;
      body += `1. Review the ${issues.length > 1 ? 'issues' : 'issue'} identified above\n`;
      body += `2. Apply the suggested fixes\n`;
      body += `3. Push changes to trigger a new review\n\n`;
    } else {
      body += `### ✅ **Great Work!**\nNo Cursor rule violations found. Your code follows the established patterns and conventions.\n\n`;
    }

    body += `---\n*Generated by [Cursor AI PR Reviewer](https://github.com/amit.wagner/pr-reviewer) v1.0.0*`;

    return body;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return '✅';
      case 'needs_attention': return '⚠️';
      case 'failed': return '❌';
      default: return '🔍';
    }
  }

  /**
   * Get issue type icon
   */
  private getIssueIcon(type: string): string {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'suggestion': return '💡';
      default: return '🔍';
    }
  }

  /**
   * Get rule type emoji
   */
  private getRuleTypeEmoji(type: string): string {
    switch (type) {
      case 'always': return '🔒';
      case 'auto_attached': return '📎';
      case 'agent_requested': return '🤖';
      case 'manual': return '👤';
      default: return '📝';
    }
  }

  /**
   * Group issues by type
   */
  private groupIssuesByType(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const grouped: Record<string, CodeIssue[]> = {};

    for (const issue of issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type]!.push(issue);
    }

    return grouped;
  }
}
