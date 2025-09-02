/**
 * Comment management system for inline and summary comments
 */

import {
  ActionInputs,
  AIProvider,
  CodeIssue,
  FileChange,
  InlineComment,
  PRPlan,
  ReviewResult,
  SummaryComment,
  // CursorRule, // Currently unused
  // PRContext, // Currently unused
} from './types';
import { GitHubClient } from './github-client';
import { SEVERITY_LEVELS } from './config';
import { logger } from './logger';
import { FlowDiagramGenerator } from './flow-diagram-generator';

export class CommentManager {
  private githubClient: GitHubClient;
  private inputs: ActionInputs;
  private flowDiagramGenerator: FlowDiagramGenerator;

  constructor(githubClient: GitHubClient, inputs: ActionInputs, aiProvider?: AIProvider) {
    this.githubClient = githubClient;
    this.inputs = inputs;
    this.flowDiagramGenerator = new FlowDiagramGenerator({}, aiProvider, githubClient);
  }

  /**
   * Post all review comments (inline and summary)
   */
  async postReviewComments(
    reviewResult: ReviewResult,
    fileChanges: FileChange[],
    prPlan?: PRPlan
  ): Promise<void> {
    const shouldPostInline =
      this.inputs.commentStyle === 'inline' || this.inputs.commentStyle === 'both';
    const shouldPostSummary =
      this.inputs.commentStyle === 'summary' || this.inputs.commentStyle === 'both';

    logger.info(
      `Comment posting config: commentStyle=${this.inputs.commentStyle}, shouldPostSummary=${shouldPostSummary}, shouldPostInline=${shouldPostInline}`
    );
    logger.info(
      `Review result: ${reviewResult.issues.length} total issues, logLevel=${this.inputs.logLevel}`
    );

    // Get existing comments if we should update them
    let existingComments: { inlineComments: InlineComment[]; summaryComment?: SummaryComment } = {
      inlineComments: [],
    };

    if (this.inputs.updateExistingComments) {
      existingComments = await this.githubClient.getExistingBotComments();
    }

    // Filter issues based on log level for inline comments
    const filteredIssuesForInline = this.filterIssuesByLogLevel(reviewResult.issues);

    // Post inline comments (only critical issues based on log level)
    if (shouldPostInline) {
      logger.info(`Posting ${filteredIssuesForInline.length} inline comments...`);
      await this.postInlineComments(
        filteredIssuesForInline,
        fileChanges,
        existingComments.inlineComments
      );
    }

    // Post summary comment - only skip if there are no file changes to review
    if (shouldPostSummary) {
      if (fileChanges.length === 0) {
        logger.info('❌ Summary comment skipped - no file changes to review');
        return;
      }

      logger.info(
        `📝 Posting summary comment for ${fileChanges.length} file changes and ${reviewResult.issues.length} issues...`
      );
      try {
        await this.postSummaryComment(
          reviewResult,
          fileChanges,
          existingComments.summaryComment,
          prPlan
        );
        logger.info('✅ Summary comment posted successfully');
      } catch (error) {
        logger.error('❌ Failed to post summary comment:', error);
        throw error;
      }
    } else {
      logger.info('❌ Summary comment skipped due to commentStyle configuration');
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
        logger.warn(`Invalid location key: ${locationKey}`);
        continue;
      }
      const line = parseInt(lineStr, 10);

      // Validate that the line exists in the PR changes
      if (!this.isValidCommentLocation(file, line, fileChanges)) {
        logger.warn(`Skipping inline comment for ${file}:${line} - not in PR diff`);
        continue;
      }

      // Create inline comment
      if (locationIssues.length === 0) {
        logger.warn(`No issues for location ${locationKey}`);
        continue;
      }

      const comment: InlineComment = {
        body: this.formatInlineCommentBody(locationIssues),
        location: {
          file,
          line,
          side: 'RIGHT', // Always comment on new code
        },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        issue: locationIssues[0]!, // Store primary issue for reference (already validated above)
      };

      // Check if we should update existing comment
      const existingComment = existingComments.find(
        c => c.location.file === file && c.location.line === line
      );

      try {
        await this.githubClient.postInlineComment(comment, existingComment?.id);
      } catch (error) {
        logger.warn(`Failed to post inline comment for ${file}:${line}:`, error);
      }
    }
  }

  /**
   * Post summary comment
   */
  private async postSummaryComment(
    reviewResult: ReviewResult,
    fileChanges: FileChange[],
    existingComment?: SummaryComment,
    prPlan?: PRPlan
  ): Promise<void> {
    const comment: SummaryComment = {
      body: await this.formatSummaryCommentBody(reviewResult, fileChanges, prPlan),
      reviewResult,
    };

    try {
      await this.githubClient.postSummaryComment(comment, existingComment?.id);
    } catch (error) {
      logger.error('Failed to post summary comment:', error);
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
   * Filter issues based on configured log level for posting comments
   */
  private filterIssuesByLogLevel(issues: CodeIssue[]): CodeIssue[] {
    const minLogLevel = SEVERITY_LEVELS[this.inputs.logLevel];

    return issues.filter(issue => {
      const issueSeverityLevel = SEVERITY_LEVELS[issue.type as keyof typeof SEVERITY_LEVELS] || 1;
      return issueSeverityLevel >= minLogLevel;
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
      return '## 🤖 Code Review Finding\n\nNo issues detected.';
    }

    const categoryIcon = this.getCategoryIcon(primaryIssue.category);
    const typeIcon = this.getIssueIcon(primaryIssue.type);

    let body = `## ${categoryIcon} Code Review Finding\n\n`;

    // Primary issue with category badge
    body += `${typeIcon} **${primaryIssue.type.toUpperCase()}** | ${categoryIcon} *${this.formatCategoryName(primaryIssue.category)}*\n\n`;
    body += `### ${primaryIssue.message}\n\n`;
    body += `${primaryIssue.description}\n\n`;

    // Severity indicator
    const severityIcon =
      primaryIssue.severity === 'high' ? '🚨' : primaryIssue.severity === 'medium' ? '⚠️' : 'ℹ️';
    body += `**${severityIcon} Severity:** ${primaryIssue.severity.toUpperCase()}\n\n`;

    // Rule information
    if (primaryIssue.category === 'rule_violation') {
      body += `**📋 Rule:** \`${primaryIssue.ruleId}\` - ${primaryIssue.ruleName}\n\n`;
    } else {
      body += `**🔍 Category:** ${primaryIssue.ruleName}\n\n`;
    }

    // Suggestion if available
    if (primaryIssue.suggestion && this.inputs.enableSuggestions) {
      // Check if fixedCode is available for better display
      if (primaryIssue.fixedCode) {
        body += `**💡 Suggested Fix:**\n\`\`\`${this.getLanguageFromFile(primaryIssue.file)}\n${primaryIssue.fixedCode}\n\`\`\`\n\n`;
      } else {
        // Use suggestion as code if it looks like code, otherwise as text
        const codeLanguage = this.getLanguageFromFile(primaryIssue.file);
        body += `**💡 Suggested Fix:**\n\`\`\`${codeLanguage}\n${primaryIssue.suggestion}\n\`\`\`\n\n`;
      }
    }

    // Auto-fix available indicator
    if (this.inputs.enableAutoFix && (primaryIssue.fixedCode || primaryIssue.suggestion)) {
      const canAutoFix = ['rule_violation', 'best_practice'].includes(primaryIssue.category);
      if (canAutoFix) {
        body += `**🤖 Auto-Fix Available:** This issue can be automatically fixed when auto-fix is enabled.\n\n`;
      }
    }

    // Additional issues at the same location
    if (issues.length > 1) {
      body += `<details>\n<summary><strong>Additional issues at this location (${issues.length - 1})</strong></summary>\n\n`;
      for (let i = 1; i < issues.length; i++) {
        const issue = issues[i];
        if (issue) {
          const issueTypeIcon = this.getIssueIcon(issue.type);
          const issueCategoryIcon = this.getCategoryIcon(issue.category);
          body += `- ${issueTypeIcon} ${issueCategoryIcon} **${issue.message}** *(${issue.type})*\n`;
        }
      }
      body += '\n</details>\n\n';
    }

    body += `---\n*🤖 Generated by [TechSee AI PR Reviewer](https://github.com/amit.wagner/pr-reviewer)*`;

    return body;
  }

  /**
   * Format summary comment body
   */
  private async formatSummaryCommentBody(
    reviewResult: ReviewResult,
    fileChanges: FileChange[],
    prPlan?: PRPlan
  ): Promise<string> {
    const { issues, filesReviewed, totalFiles, rulesApplied, status } = reviewResult;

    let body = `## <img src="https://raw.githubusercontent.com/amitwa1/pr-reviewer/main/assets/techsee-logo.png" width="24" height="24" alt="TechSee"> TechSee AI PR Review Summary\n\n`;

    // Status indicator
    const statusIcon = this.getStatusIcon(status);
    body += `### ${statusIcon} **Overall Status: ${status.replace('_', ' ').toUpperCase()}**\n\n`;

    // Changes summary from PR plan
    if (prPlan && prPlan.keyChanges && prPlan.keyChanges.length > 0) {
      body += `### 📝 **What Changed**\n`;
      for (const change of prPlan.keyChanges) {
        body += `• ${change}\n`;
      }
      body += '\n';
    }

    // Quick overview
    body += `### 📊 **Review Overview**\n`;
    body += `| Metric | Value |\n`;
    body += `|--------|-------|\n`;
    body += `| Files Reviewed | ${filesReviewed}/${totalFiles} |\n`;
    body += `| Issues Found | ${issues.length} |\n`;
    body += `| Rules Applied | ${rulesApplied.length} |\n`;
    body += `| Status | ${statusIcon} ${status.replace('_', ' ').toUpperCase()} |\n\n`;

    // Generate and add flow diagram
    if (prPlan && fileChanges.length > 1) {
      try {
        const flowDiagram = await this.flowDiagramGenerator.generateFlowDiagram(
          fileChanges,
          prPlan,
          issues
        );

        if (flowDiagram) {
          body += `### 🔄 **Technical Flow Diagram**\n\n`;
          body += `${flowDiagram.description}\n\n`;
          // Ensure mermaid code ends with newline
          const cleanMermaidCode = flowDiagram.mermaidCode.trim();
          body += `\`\`\`mermaid\n${cleanMermaidCode}\n\`\`\`\n\n`;
          body += `<details>\n<summary>📊 About This Diagram</summary>\n\n`;
          body += `This flow diagram shows the technical implementation and code flow for the changes in this PR.\n\n`;
          body += `**Diagram Elements:**\n`;
          body += `- **Rectangles** \`[]\`: Process steps or actions\n`;
          body += `- **Diamonds** \`{}\`: Decision points or conditions\n`;
          body += `- **Rounded rectangles** \`()\`: Start/end points\n`;
          body += `- **Solid arrows** \`-->\`: Flow direction\n`;
          body += `- **Labeled arrows** \`-->|label|\`: Conditional flows\n\n`;
          body += `</details>\n\n`;
        }
      } catch (error) {
        logger.warn('Failed to generate flow diagram:', error);
        // Continue without diagram
      }
    }

    // Issues found
    if (issues.length > 0) {
      const issuesByCategory = this.groupIssuesByCategory(issues);

      // Show all issues directly
      if (this.inputs.summaryFormat === 'detailed' && issues.length <= 15) {
        body += `### 📋 **All Issues**\n\n`;

        for (const [category, categoryIssues] of Object.entries(issuesByCategory)) {
          if (categoryIssues.length > 0) {
            const categoryIcon = this.getCategoryIcon(category);
            body += `**${categoryIcon} ${this.formatCategoryName(category)} (${categoryIssues.length})**\n`;
            for (const issue of categoryIssues) {
              const typeIcon = this.getIssueIcon(issue.type);
              body += `- ${typeIcon} **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
            }
            body += '\n';
          }
        }
      } else if (issues.length > 15) {
        body += `### 📋 **Issue Summary**\n`;
        body += `*Too many issues to display individually. Please check inline comments for details.*\n\n`;
      }
    }

    // Rules applied
    if (rulesApplied.length > 0) {
      body += `### 📝 **Applied Rules**\n`;
      body += `<details>\n<summary>${rulesApplied.length} Cursor rules were applied</summary>\n\n`;

      for (const rule of rulesApplied) {
        const typeEmoji = this.getRuleTypeEmoji(rule.type);
        body += `- ${typeEmoji} \`${rule.id}\``;
        if (rule.description) {
          body += ` - ${rule.description}`;
        }
        body += '\n';
      }
      body += '\n</details>\n\n';
    }

    body += `---\n*Generated by [TechSee AI PR Reviewer](https://github.com/amit.wagner/pr-reviewer) • [Report Issues](https://github.com/amit.wagner/pr-reviewer/issues)*`;

    return body;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✅';
      case 'needs_attention':
        return '⚠️';
      default:
        return '🔍';
    }
  }

  /**
   * Get issue type icon
   */
  private getIssueIcon(type: string): string {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'suggestion':
        return '💡';
      default:
        return '🔍';
    }
  }

  /**
   * Get rule type emoji
   */
  private getRuleTypeEmoji(type: string): string {
    switch (type) {
      case 'always':
        return '🔒';
      case 'auto_attached':
        return '📎';
      case 'agent_requested':
        return '🤖';
      case 'manual':
        return '👤';
      default:
        return '📝';
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      grouped[issue.type]!.push(issue);
    }

    return grouped;
  }

  /**
   * Group issues by category
   */
  private groupIssuesByCategory(issues: CodeIssue[]): Record<string, CodeIssue[]> {
    const grouped: Record<string, CodeIssue[]> = {};

    for (const issue of issues) {
      if (!grouped[issue.category]) {
        grouped[issue.category] = [];
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      grouped[issue.category]!.push(issue);
    }

    return grouped;
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: string): string {
    switch (category) {
      case 'bug':
        return '🐛';
      case 'security':
        return '🔒';
      case 'performance':
        return '⚡';
      case 'rule_violation':
        return '📏';
      case 'best_practice':
        return '💡';
      case 'maintainability':
        return '🔧';
      case 'documentation':
        return '📝';
      case 'architecture':
        return '🏗️';
      case 'i18n':
        return '🌍';
      case 'api_design':
        return '🔌';
      case 'data_flow':
        return '🌊';
      case 'business_logic':
        return '💼';
      default:
        return '🔍';
    }
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    switch (category) {
      case 'bug':
        return 'Bugs';
      case 'security':
        return 'Security Issues';
      case 'performance':
        return 'Performance Issues';
      case 'rule_violation':
        return 'Rule Violations';
      case 'best_practice':
        return 'Best Practices';
      case 'maintainability':
        return 'Maintainability';
      case 'documentation':
        return 'Documentation & Typos (Critical)';
      case 'architecture':
        return 'Architecture & Design';
      case 'i18n':
        return 'Internationalization';
      case 'api_design':
        return 'API Design';
      case 'data_flow':
        return 'Data Flow & State';
      case 'business_logic':
        return 'Business Logic';
      default:
        return 'Other';
    }
  }

  /**
   * Get language identifier from file extension for syntax highlighting
   */
  private getLanguageFromFile(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'cs':
        return 'csharp';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
        return 'kotlin';
      case 'vue':
        return 'vue';
      case 'svelte':
        return 'svelte';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'xml':
        return 'xml';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
        return 'bash';
      default:
        return 'text';
    }
  }
}
