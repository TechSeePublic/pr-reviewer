"use strict";
/**
 * Auto-fix manager for applying code fixes automatically
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoFixManager = void 0;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
class AutoFixManager {
    constructor(githubClient, inputs, prContext, workspacePath = process.cwd()) {
        this.githubClient = githubClient;
        this.inputs = inputs;
        this.prContext = prContext;
        this.workspacePath = workspacePath;
    }
    /**
     * Apply auto-fixes for eligible issues
     */
    async applyAutoFixes(issues, fileChanges) {
        if (!this.inputs.enableAutoFix) {
            return [];
        }
        const eligibleIssues = this.filterEligibleIssues(issues);
        if (eligibleIssues.length === 0) {
            core.info('No eligible issues for auto-fix');
            return [];
        }
        core.info(`Attempting to auto-fix ${eligibleIssues.length} issues`);
        const results = [];
        // Group issues by file for efficient processing
        const issuesByFile = this.groupIssuesByFile(eligibleIssues);
        for (const [fileName, fileIssues] of Object.entries(issuesByFile)) {
            try {
                const fileResults = await this.applyFixesToFile(fileName, fileIssues, fileChanges);
                results.push(...fileResults);
            }
            catch (error) {
                logger_1.logger.error(`Failed to apply fixes to ${fileName}:`, error);
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
    async commitFixes(fixResults) {
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
        }
        catch (error) {
            logger_1.logger.error('Failed to commit auto-fixes:', error);
            throw error;
        }
    }
    /**
     * Filter issues eligible for auto-fix
     */
    filterEligibleIssues(issues) {
        const severityFilter = this.inputs.autoFixSeverity;
        const severityLevels = {
            error: 4,
            warning: 3,
            info: 2,
            all: 1,
        };
        const minSeverityLevel = severityLevels[severityFilter];
        return issues.filter(issue => {
            // Must have fixed code for auto-fix
            if (!issue.fixedCode) {
                return false;
            }
            // Check severity level
            const issueSeverityLevel = severityLevels[issue.type] || 1;
            if (issueSeverityLevel < minSeverityLevel) {
                return false;
            }
            // Only safe categories for auto-fix
            const safeCategoriesForAutoFix = ['rule_violation'];
            if (!safeCategoriesForAutoFix.includes(issue.category)) {
                return false;
            }
            return true;
        });
    }
    /**
     * Group issues by file
     */
    groupIssuesByFile(issues) {
        const grouped = {};
        for (const issue of issues) {
            if (!grouped[issue.file]) {
                grouped[issue.file] = [];
            }
            // TypeScript knows grouped[issue.file] is defined here due to the check above
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            grouped[issue.file].push(issue);
        }
        return grouped;
    }
    /**
     * Apply fixes to a single file
     */
    async applyFixesToFile(fileName, issues, _fileChanges) {
        const results = [];
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
                const fixResult = await this.applyIndividualFix(modifiedContent, issue, lines, fileName);
                if (fixResult.success) {
                    modifiedContent = fixResult.content;
                    results.push({
                        file: fileName,
                        issue,
                        applied: true,
                    });
                }
                else {
                    results.push({
                        file: fileName,
                        issue,
                        applied: false,
                        error: fixResult.error || 'Unknown error occurred',
                    });
                }
            }
            catch (error) {
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
            }
            catch (error) {
                logger_1.logger.error(`Failed to write fixed content to ${fileName}:`, error);
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
    async applyIndividualFix(content, issue, lines, _fileName) {
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
            }
            else {
                // Replace single line
                newLines[lineIndex] = issue.fixedCode;
            }
            return { success: true, content: newLines.join('\n') };
        }
        else if (issue.suggestion) {
            // Try to apply suggestion intelligently
            const originalLine = lines[lineIndex];
            // Simple heuristic: if suggestion looks like a complete line replacement
            if (originalLine &&
                (issue.suggestion.includes('\n') || issue.suggestion.length > originalLine.length * 0.5)) {
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
    async getFileContent(fileName) {
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
        }
        catch (error) {
            logger_1.logger.warn(`Could not get content for ${fileName}:`, error);
            return null;
        }
    }
    /**
     * Generate data for commit fix button
     */
    generateCommitFixData(issue) {
        const fixData = {
            file: issue.file,
            line: issue.line,
            endLine: issue.endLine,
            fixedCode: issue.fixedCode,
            suggestion: issue.suggestion,
            message: issue.message,
            category: issue.category,
            type: issue.type,
        };
        // Base64 encode the fix data for safe URL transmission
        return Buffer.from(JSON.stringify(fixData)).toString('base64');
    }
    /**
     * Generate commit message for auto-fixes
     */
    generateCommitMessage(fixes) {
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
        message += '\n\nGenerated by TechSee AI PR Reviewer';
        return message;
    }
    /**
     * Create a summary comment for auto-fixes
     */
    async createAutoFixSummaryComment(fixes) {
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
        body += `\n---\n*🤖 Generated by TechSee AI PR Reviewer Auto-Fix*`;
        try {
            await this.githubClient.postSummaryComment({ body, reviewResult: {} }, undefined);
        }
        catch (error) {
            logger_1.logger.warn('Failed to post auto-fix summary comment:', error);
        }
    }
    /**
     * Format category name for display
     */
    formatCategoryName(category) {
        switch (category) {
            case 'bug':
                return 'Bug Fixes';
            case 'security':
                return 'Security Issues';
            case 'performance':
                return 'Performance Improvements';
            case 'rule_violation':
                return 'Rule Violations';
            case 'best_practice':
                return 'Best Practices';
            case 'maintainability':
                return 'Maintainability Improvements';
            case 'documentation':
                return 'Documentation & Typo Fixes';
            default:
                return 'Other';
        }
    }
}
exports.AutoFixManager = AutoFixManager;
//# sourceMappingURL=auto-fix-manager.js.map