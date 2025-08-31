"use strict";
/**
 * Comment management system for inline and summary comments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentManager = void 0;
const config_1 = require("./config");
const logger_1 = require("./logger");
const flow_diagram_generator_1 = require("./flow-diagram-generator");
class CommentManager {
    constructor(githubClient, inputs, aiProvider) {
        this.githubClient = githubClient;
        this.inputs = inputs;
        this.flowDiagramGenerator = new flow_diagram_generator_1.FlowDiagramGenerator({}, aiProvider, githubClient);
    }
    /**
     * Post all review comments (inline and summary)
     */
    async postReviewComments(reviewResult, fileChanges, prPlan) {
        const shouldPostInline = this.inputs.commentStyle === 'inline' || this.inputs.commentStyle === 'both';
        const shouldPostSummary = this.inputs.commentStyle === 'summary' || this.inputs.commentStyle === 'both';
        // Get existing comments if we should update them
        let existingComments = {
            inlineComments: [],
        };
        if (this.inputs.updateExistingComments) {
            existingComments = await this.githubClient.getExistingBotComments();
        }
        // Filter issues based on log level for inline comments
        const filteredIssuesForInline = this.filterIssuesByLogLevel(reviewResult.issues);
        // Post inline comments (only critical issues based on log level)
        if (shouldPostInline) {
            await this.postInlineComments(filteredIssuesForInline, fileChanges, existingComments.inlineComments);
        }
        // Post summary comment (always show all issues, but only post if there are critical issues or all issues are low-severity)
        if (shouldPostSummary) {
            const criticalIssues = this.filterIssuesByLogLevel(reviewResult.issues);
            // Always show all issues in summary, but only post if:
            // 1. There are critical issues (above log level threshold), OR
            // 2. There are any issues and no critical ones (to show non-critical issues in summary only)
            const shouldPost = criticalIssues.length > 0 ||
                (reviewResult.issues.length > 0 && criticalIssues.length === 0) ||
                reviewResult.issues.length === 0;
            if (shouldPost) {
                await this.postSummaryComment(reviewResult, // Always pass full result with all issues
                fileChanges, existingComments.summaryComment, prPlan);
            }
        }
    }
    /**
     * Post inline comments for specific issues
     */
    async postInlineComments(issues, fileChanges, existingComments) {
        // Filter issues based on severity
        const filteredIssues = this.filterIssuesBySeverity(issues);
        // Group issues by file and line
        const issuesByLocation = this.groupIssuesByLocation(filteredIssues);
        for (const [locationKey, locationIssues] of Object.entries(issuesByLocation)) {
            const [file, lineStr] = locationKey.split(':');
            if (!file || !lineStr) {
                logger_1.logger.warn(`Invalid location key: ${locationKey}`);
                continue;
            }
            const line = parseInt(lineStr, 10);
            // Validate that the line exists in the PR changes
            if (!this.isValidCommentLocation(file, line, fileChanges)) {
                logger_1.logger.warn(`Skipping inline comment for ${file}:${line} - not in PR diff`);
                continue;
            }
            // Create inline comment
            if (locationIssues.length === 0) {
                logger_1.logger.warn(`No issues for location ${locationKey}`);
                continue;
            }
            const comment = {
                body: this.formatInlineCommentBody(locationIssues),
                location: {
                    file,
                    line,
                    side: 'RIGHT', // Always comment on new code
                },
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                issue: locationIssues[0], // Store primary issue for reference (already validated above)
            };
            // Check if we should update existing comment
            const existingComment = existingComments.find(c => c.location.file === file && c.location.line === line);
            try {
                await this.githubClient.postInlineComment(comment, existingComment?.id);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to post inline comment for ${file}:${line}:`, error);
            }
        }
    }
    /**
     * Post summary comment
     */
    async postSummaryComment(reviewResult, fileChanges, existingComment, prPlan) {
        const comment = {
            body: await this.formatSummaryCommentBody(reviewResult, fileChanges, prPlan),
            reviewResult,
        };
        try {
            await this.githubClient.postSummaryComment(comment, existingComment?.id);
        }
        catch (error) {
            logger_1.logger.error('Failed to post summary comment:', error);
            throw error;
        }
    }
    /**
     * Filter issues based on configured severity level
     */
    filterIssuesBySeverity(issues) {
        const minSeverityLevel = config_1.SEVERITY_LEVELS[this.inputs.inlineSeverity];
        return issues.filter(issue => {
            const issueSeverityLevel = config_1.SEVERITY_LEVELS[issue.type] || 1;
            return issueSeverityLevel >= minSeverityLevel;
        });
    }
    /**
     * Filter issues based on configured log level for posting comments
     */
    filterIssuesByLogLevel(issues) {
        const minLogLevel = config_1.SEVERITY_LEVELS[this.inputs.logLevel];
        return issues.filter(issue => {
            const issueSeverityLevel = config_1.SEVERITY_LEVELS[issue.type] || 1;
            return issueSeverityLevel >= minLogLevel;
        });
    }
    /**
     * Group issues by file and line for inline comments
     */
    groupIssuesByLocation(issues) {
        const grouped = {};
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
    isValidCommentLocation(file, line, fileChanges) {
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
    parseValidLinesFromPatch(patch) {
        const validLines = [];
        const lines = patch.split('\n');
        let currentLine = 0;
        for (const line of lines) {
            if (line.startsWith('@@')) {
                // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
                const match = line.match(/\+(\d+)/);
                if (match && match[1]) {
                    currentLine = parseInt(match[1], 10) - 1;
                }
            }
            else if (line.startsWith('+')) {
                // Added line
                currentLine++;
                validLines.push(currentLine);
            }
            else if (line.startsWith(' ')) {
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
    formatInlineCommentBody(issues) {
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
        const severityIcon = primaryIssue.severity === 'high' ? '🚨' : primaryIssue.severity === 'medium' ? '⚠️' : 'ℹ️';
        body += `**${severityIcon} Severity:** ${primaryIssue.severity.toUpperCase()}\n\n`;
        // Rule information
        if (primaryIssue.category === 'rule_violation') {
            body += `**📋 Rule:** \`${primaryIssue.ruleId}\` - ${primaryIssue.ruleName}\n\n`;
        }
        else {
            body += `**🔍 Category:** ${primaryIssue.ruleName}\n\n`;
        }
        // Suggestion if available
        if (primaryIssue.suggestion && this.inputs.enableSuggestions) {
            // Check if fixedCode is available for better display
            if (primaryIssue.fixedCode) {
                body += `**💡 Suggested Fix:**\n\`\`\`${this.getLanguageFromFile(primaryIssue.file)}\n${primaryIssue.fixedCode}\n\`\`\`\n\n`;
            }
            else {
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
    async formatSummaryCommentBody(reviewResult, fileChanges, prPlan) {
        const { issues, filesReviewed, totalFiles, rulesApplied, summary, status } = reviewResult;
        let body = `## 🤖 Cursor AI PR Review Summary\n\n`;
        // Status indicator
        const statusIcon = this.getStatusIcon(status);
        body += `### ${statusIcon} **Overall Status: ${status.replace('_', ' ').toUpperCase()}**\n\n`;
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
                const flowDiagram = await this.flowDiagramGenerator.generateFlowDiagram(fileChanges, prPlan, issues);
                if (flowDiagram) {
                    body += `### 🔄 **PR Flow Diagram**\n\n`;
                    body += `${flowDiagram.description}\n\n`;
                    body += `\`\`\`mermaid\n${flowDiagram.mermaidCode}\`\`\`\n\n`;
                    body += `<details>\n<summary>📊 Diagram Legend</summary>\n\n`;
                    body += `- 🟢 **Green**: Added files\n`;
                    body += `- 🟡 **Yellow**: Modified files\n`;
                    body += `- 🔴 **Red**: Removed files\n`;
                    body += `- 🔘 **Gray**: Renamed files\n`;
                    body += `- **Bold border**: High importance (large changes or critical issues)\n`;
                    body += `- **Solid arrows**: Direct imports/dependencies\n`;
                    body += `- **Dashed arrows**: Function calls or usage\n\n`;
                    body += `</details>\n\n`;
                }
            }
            catch (error) {
                logger_1.logger.warn('Failed to generate flow diagram:', error);
                // Continue without diagram
            }
        }
        // Issues breakdown by category and type
        if (issues.length > 0) {
            const issuesByCategory = this.groupIssuesByCategory(issues);
            const issuesByType = this.groupIssuesByType(issues);
            body += `### 🎯 **Issues Breakdown**\n\n`;
            // By category
            body += `**By Category:**\n`;
            const categoryOrder = [
                'bug',
                'security',
                'performance',
                'rule_violation',
                'best_practice',
                'maintainability',
            ];
            for (const category of categoryOrder) {
                if (issuesByCategory[category]) {
                    const categoryIcon = this.getCategoryIcon(category);
                    body += `- ${categoryIcon} **${this.formatCategoryName(category)}:** ${issuesByCategory[category].length}\n`;
                }
            }
            body += `\n**By Severity:**\n`;
            const typeOrder = ['error', 'warning', 'info', 'suggestion'];
            for (const type of typeOrder) {
                if (issuesByType[type]) {
                    const icon = this.getIssueIcon(type);
                    body += `- ${icon} **${type.toUpperCase()}:** ${issuesByType[type].length}\n`;
                }
            }
            body += '\n';
            // Critical issues first
            const criticalIssues = issues.filter(issue => issue.type === 'error' || issue.severity === 'high');
            if (criticalIssues.length > 0) {
                body += `### 🚨 **Critical Issues Requiring Immediate Attention**\n`;
                for (const issue of criticalIssues.slice(0, 5)) {
                    const categoryIcon = this.getCategoryIcon(issue.category);
                    body += `- ${categoryIcon} **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
                }
                if (criticalIssues.length > 5) {
                    body += `- ... and ${criticalIssues.length - 5} more critical issues\n`;
                }
                body += '\n';
            }
            // Detailed format for detailed summary
            if (this.inputs.summaryFormat === 'detailed' && issues.length <= 15) {
                body += `### 📋 **All Issues**\n`;
                body += `<details>\n<summary>Click to expand full issue list</summary>\n\n`;
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
                body += `</details>\n\n`;
            }
            else if (issues.length > 15) {
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
        // AI-generated summary
        if (summary && summary.trim().length > 0) {
            body += `### 🎯 **AI Assessment**\n`;
            body += `> ${summary}\n\n`;
        }
        else {
            // Provide a fallback summary based on the issues found
            body += `### 🎯 **AI Assessment**\n`;
            if (issues.length === 0) {
                body += `> ✅ **Excellent work!** No issues detected in this PR. The code follows best practices and appears ready for deployment.\n\n`;
            }
            else {
                const criticalCount = issues.filter(i => i.type === 'error' || i.severity === 'high').length;
                const warningCount = issues.filter(i => i.type === 'warning').length;
                if (criticalCount > 0) {
                    body += `> ⚠️ **Review Required** - Found ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} that need${criticalCount === 1 ? 's' : ''} attention before merging.\n\n`;
                }
                else if (warningCount > 0) {
                    body += `> 💡 **Minor Issues Found** - ${warningCount} warning${warningCount > 1 ? 's' : ''} detected. Consider addressing these for improved code quality.\n\n`;
                }
                else {
                    body += `> ℹ️ **Info Available** - Found ${issues.length} informational suggestion${issues.length > 1 ? 's' : ''} for code improvement.\n\n`;
                }
            }
        }
        // Next steps
        if (issues.length > 0) {
            body += `### 🛠️ **Recommended Actions**\n`;
            const hasCritical = issues.some(i => i.type === 'error' || i.severity === 'high');
            const hasSecurityIssues = issues.some(i => i.category === 'security');
            const hasBugs = issues.some(i => i.category === 'bug');
            if (hasCritical) {
                body += `1. **🚨 Address critical issues immediately** - These may prevent successful deployment\n`;
            }
            if (hasSecurityIssues) {
                body += `2. **🔒 Fix security vulnerabilities** - These pose risks to your application\n`;
            }
            if (hasBugs) {
                body += `3. **🐛 Resolve bugs** - These may cause unexpected behavior\n`;
            }
            body += `${hasCritical || hasSecurityIssues || hasBugs ? '' : '1. '}Review inline comments for detailed suggestions\n`;
            body += `${hasCritical || hasSecurityIssues || hasBugs ? '' : '2. '}Apply recommended fixes where appropriate\n`;
            body += `${hasCritical || hasSecurityIssues || hasBugs ? '' : '3. '}Push changes to trigger a new review\n\n`;
        }
        else {
            body += `### ✅ **Excellent Work!**\n`;
            body += `🎉 No issues found! Your code follows all established patterns and best practices.\n\n`;
        }
        body += `---\n*Generated by [TechSee AI PR Reviewer](https://github.com/amit.wagner/pr-reviewer) • [Report Issues](https://github.com/amit.wagner/pr-reviewer/issues)*`;
        return body;
    }
    /**
     * Get status icon
     */
    getStatusIcon(status) {
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
    getIssueIcon(type) {
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
    getRuleTypeEmoji(type) {
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
    groupIssuesByType(issues) {
        const grouped = {};
        for (const issue of issues) {
            if (!grouped[issue.type]) {
                grouped[issue.type] = [];
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            grouped[issue.type].push(issue);
        }
        return grouped;
    }
    /**
     * Group issues by category
     */
    groupIssuesByCategory(issues) {
        const grouped = {};
        for (const issue of issues) {
            if (!grouped[issue.category]) {
                grouped[issue.category] = [];
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            grouped[issue.category].push(issue);
        }
        return grouped;
    }
    /**
     * Get category icon
     */
    getCategoryIcon(category) {
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
            default:
                return '🔍';
        }
    }
    /**
     * Format category name for display
     */
    formatCategoryName(category) {
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
            default:
                return 'Other';
        }
    }
    /**
     * Get language identifier from file extension for syntax highlighting
     */
    getLanguageFromFile(filename) {
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
exports.CommentManager = CommentManager;
//# sourceMappingURL=comment-manager.js.map