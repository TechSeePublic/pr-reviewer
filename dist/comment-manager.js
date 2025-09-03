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
    constructor(githubClient, inputs, aiProvider, prContext, autoFixManager) {
        this.githubClient = githubClient;
        this.inputs = inputs;
        this.flowDiagramGenerator = new flow_diagram_generator_1.FlowDiagramGenerator({}, aiProvider, githubClient);
        this.autoFixManager = autoFixManager;
        // Extract PR context from GitHub environment if not provided
        this.prContext = prContext || this.extractPRContextFromGitHub();
    }
    /**
     * Extract PR context from GitHub environment (fallback if not provided)
     */
    extractPRContextFromGitHub() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const context = require('@actions/github').context;
        return {
            owner: context.repo.owner,
            repo: context.repo.repo,
            pullNumber: context.payload.pull_request?.number || 0,
            sha: context.sha,
            baseSha: context.payload.pull_request?.base?.sha || '',
        };
    }
    /**
     * Generate GitHub URL for a file in the PR with optional line number
     */
    generateGitHubFileURL(fileName, lineNumber) {
        const baseURL = `https://github.com/${this.prContext.owner}/${this.prContext.repo}/pull/${this.prContext.pullNumber}/files`;
        if (lineNumber) {
            // Generate anchor for the specific line in the diff
            return `${baseURL}#diff-${Buffer.from(fileName).toString('hex')}R${lineNumber}`;
        }
        return baseURL;
    }
    /**
     * Post all review comments (inline and summary)
     */
    async postReviewComments(reviewResult, fileChanges, prPlan) {
        const shouldPostInline = this.inputs.commentStyle === 'inline' || this.inputs.commentStyle === 'both';
        const shouldPostSummary = this.inputs.commentStyle === 'summary' || this.inputs.commentStyle === 'both';
        logger_1.logger.info(`Comment posting config: commentStyle=${this.inputs.commentStyle}, shouldPostSummary=${shouldPostSummary}, shouldPostInline=${shouldPostInline}`);
        logger_1.logger.info(`Review result: ${reviewResult.issues.length} total issues found (logLevel=${this.inputs.logLevel}, inlineSeverity=${this.inputs.inlineSeverity})`);
        // Get existing comments if we should update them
        let existingComments = {
            inlineComments: [],
        };
        if (this.inputs.updateExistingComments) {
            existingComments = await this.githubClient.getExistingBotComments();
        }
        // Filter issues based on inline severity for inline comments
        const filteredIssuesForInline = this.filterIssuesBySeverity(reviewResult.issues);
        // Log issue types for debugging
        const issueTypes = reviewResult.issues.reduce((acc, issue) => {
            acc[issue.type] = (acc[issue.type] || 0) + 1;
            return acc;
        }, {});
        logger_1.logger.info(`Issue types found: ${Object.entries(issueTypes)
            .map(([type, count]) => `${type}:${count}`)
            .join(', ')}`);
        // Log first few issues for detailed debugging
        if (reviewResult.issues.length > 0) {
            logger_1.logger.info(`Sample issues for debugging:`);
            reviewResult.issues.slice(0, 3).forEach((issue, i) => {
                logger_1.logger.info(`  Issue ${i + 1}: type="${issue.type}", category="${issue.category}", message="${issue.message}", file="${issue.file}", line=${issue.line}`);
            });
        }
        logger_1.logger.info(`Issue filtering: ${reviewResult.issues.length} total → ${filteredIssuesForInline.length} eligible for inline comments (severity: ${this.inputs.inlineSeverity}+)`);
        // Post inline comments (based on inline_severity setting)
        if (shouldPostInline) {
            logger_1.logger.info(`Posting ${filteredIssuesForInline.length} inline comments...`);
            await this.postInlineComments(filteredIssuesForInline, fileChanges, existingComments.inlineComments);
        }
        // Post summary comment - only skip if there are no file changes to review
        if (shouldPostSummary) {
            if (fileChanges.length === 0) {
                logger_1.logger.info('❌ Summary comment skipped - no file changes to review');
                return;
            }
            logger_1.logger.info(`📝 Posting summary comment for ${fileChanges.length} file changes and ${reviewResult.issues.length} issues...`);
            try {
                await this.postSummaryComment(reviewResult, fileChanges, existingComments.summaryComment, prPlan);
                logger_1.logger.info('✅ Summary comment posted successfully');
            }
            catch (error) {
                logger_1.logger.error('❌ Failed to post summary comment:', error);
                throw error;
            }
        }
        else {
            logger_1.logger.info('❌ Summary comment skipped due to commentStyle configuration');
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
        logger_1.logger.info(`Processing ${Object.keys(issuesByLocation).length} unique locations for inline comments`);
        // Debug: Show all AI-reported issues and their line numbers
        logger_1.logger.info(`\n=== AI REPORTED ISSUES DEBUG ===`);
        filteredIssues.forEach((issue, index) => {
            logger_1.logger.info(`Issue ${index + 1}:`);
            logger_1.logger.info(`  File: ${issue.file}`);
            logger_1.logger.info(`  Line: ${issue.line} (AI reported)`);
            logger_1.logger.info(`  Message: ${issue.message}`);
            logger_1.logger.info(`  Type: ${issue.type}`);
            const issueWithReviewType = issue;
            if (issueWithReviewType.reviewType) {
                logger_1.logger.info(`  Review Type: ${issueWithReviewType.reviewType}`);
            }
            // Cross-check with file changes
            const relatedFileChange = fileChanges.find(fc => fc.filename === issue.file);
            if (relatedFileChange?.patch) {
                const validLines = this.parseValidLinesFromPatch(relatedFileChange.patch);
                const isValidLine = validLines.includes(issue.line || 0);
                logger_1.logger.info(`  ✓ Line ${issue.line} valid in diff: ${isValidLine ? 'YES' : 'NO'}`);
                if (!isValidLine) {
                    logger_1.logger.warn(`  ⚠️  Available lines in diff: [${validLines.join(', ')}]`);
                    const closestLine = validLines.reduce((prev, curr) => Math.abs(curr - (issue.line || 0)) < Math.abs(prev - (issue.line || 0)) ? curr : prev);
                    logger_1.logger.warn(`  🔧 Closest valid line: ${closestLine} (distance: ${Math.abs(closestLine - (issue.line || 0))})`);
                }
            }
            else {
                logger_1.logger.warn(`  ❌ No patch found for file ${issue.file}`);
            }
        });
        logger_1.logger.info(`====================================\n`);
        for (const [locationKey, locationIssues] of Object.entries(issuesByLocation)) {
            const [file, lineStr] = locationKey.split(':');
            if (!file || !lineStr) {
                logger_1.logger.warn(`Invalid location key: ${locationKey}`);
                continue;
            }
            const originalLine = parseInt(lineStr, 10);
            // Convert diff line number to actual file line number
            logger_1.logger.info(`\n=== CONVERTING DIFF LINE TO FILE LINE ===`);
            logger_1.logger.info(`File: ${file}`);
            logger_1.logger.info(`AI reported diff line: ${originalLine}`);
            logger_1.logger.info(`Issue: ${locationIssues[0]?.message}`);
            let actualFileLineNumber = this.convertDiffLineToFileLine(file, originalLine, fileChanges);
            // Fallback: If conversion fails, AI might still be using old file line numbers
            // This is a temporary bridge while AI adapts to new format
            if (!actualFileLineNumber) {
                logger_1.logger.warn(`⚠️  Diff line conversion failed for line ${originalLine}. Checking if it's a valid file line...`);
                // Check if the reported line is actually a valid file line in the diff
                const validLines = this.parseValidLinesFromPatch(fileChanges.find(fc => fc.filename === file)?.patch || '');
                if (validLines.includes(originalLine)) {
                    logger_1.logger.warn(`📍 FALLBACK: AI reported file line ${originalLine} directly, using as-is`);
                    actualFileLineNumber = originalLine;
                }
                else {
                    logger_1.logger.warn(`❌ Skipping inline comment for ${file}:${originalLine} - not a valid line number in any format`);
                    continue;
                }
            }
            logger_1.logger.info(`✅ Converted diff line ${originalLine} to file line ${actualFileLineNumber}`);
            logger_1.logger.info(`=============================================\n`);
            // Create inline comment
            if (locationIssues.length === 0) {
                logger_1.logger.warn(`No issues for location ${locationKey}`);
                continue;
            }
            const comment = {
                body: this.formatInlineCommentBody(locationIssues),
                location: {
                    file,
                    line: actualFileLineNumber,
                    side: 'RIGHT', // Always comment on new code
                },
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                issue: locationIssues[0], // Store primary issue for reference (already validated above)
            };
            // Debug: Log the exact line number being sent to GitHub
            logger_1.logger.info(`📍 FINAL LINE SELECTION: AI diff line ${originalLine} → GitHub comment line ${actualFileLineNumber} (direct mapping)`);
            // Check if we should update existing comment
            const existingComment = existingComments.find(c => c.location.file === file && c.location.line === actualFileLineNumber);
            try {
                logger_1.logger.info(`\n=== POSTING INLINE COMMENT ===`);
                logger_1.logger.info(`File: ${file}`);
                logger_1.logger.info(`AI diff line: ${originalLine}`);
                logger_1.logger.info(`GitHub file line: ${actualFileLineNumber}`);
                logger_1.logger.info(`Issue type: ${locationIssues[0]?.type} - ${locationIssues[0]?.message}`);
                logger_1.logger.info(`==============================\n`);
                await this.githubClient.postInlineComment(comment, existingComment?.id);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to post inline comment for ${file}:${actualFileLineNumber}:`, error);
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
        let skippedCount = 0;
        for (const issue of issues) {
            if (!issue.file || !issue.line) {
                skippedCount++;
                logger_1.logger.warn(`Skipping issue for inline comment - missing location: file="${issue.file}", line=${issue.line}, message="${issue.message}"`);
                continue; // Skip issues without location info
            }
            const key = `${issue.file}:${issue.line}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(issue);
        }
        if (skippedCount > 0) {
            logger_1.logger.info(`Skipped ${skippedCount} issues for inline comments due to missing file/line info`);
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
     * Find the best valid location for a comment, with fallback options
     */
    findValidCommentLocation(file, requestedLine, fileChanges) {
        const fileChange = fileChanges.find(fc => fc.filename === file);
        if (!fileChange || !fileChange.patch) {
            logger_1.logger.warn(`No file change found for ${file}`);
            return null;
        }
        const validLines = this.parseValidLinesFromPatch(fileChange.patch);
        if (validLines.length === 0) {
            logger_1.logger.warn(`No valid comment lines found in patch for ${file}`);
            return null;
        }
        logger_1.logger.debug(`\n--- LINE VALIDATION DEBUG ---`);
        logger_1.logger.debug(`Requested line: ${requestedLine}`);
        logger_1.logger.debug(`Valid lines in diff: [${validLines.join(', ')}]`);
        logger_1.logger.debug(`File: ${file}`);
        // If requested line is valid, use it
        if (validLines.includes(requestedLine)) {
            logger_1.logger.debug(`✅ Exact match: line ${requestedLine} is in diff`);
            return { line: requestedLine, reason: 'exact_match' };
        }
        logger_1.logger.debug(`❌ Line ${requestedLine} not in diff, looking for nearby lines...`);
        // Find the closest valid line (within reasonable range)
        const maxDistance = 10; // Increased from 5 to catch more nearby lines
        let closestLine = null;
        let minDistance = Infinity;
        for (const validLine of validLines) {
            const distance = Math.abs(validLine - requestedLine);
            logger_1.logger.debug(`  Line ${validLine}: distance ${distance}`);
            if (distance <= maxDistance && distance < minDistance) {
                minDistance = distance;
                closestLine = validLine;
            }
        }
        if (closestLine !== null) {
            logger_1.logger.info(`🔄 Adjusted comment location from line ${requestedLine} to ${closestLine} (distance: ${minDistance})`);
            return { line: closestLine, reason: 'nearby_match' };
        }
        logger_1.logger.debug(`❌ No lines within ${maxDistance} distance of ${requestedLine}`);
        // As a last resort, use the first valid line in the file (for file-level issues)
        if (requestedLine <= 10) {
            // Increased from 5 to handle more cases
            const firstValidLine = Math.min(...validLines);
            logger_1.logger.info(`📌 Using first valid line ${firstValidLine} for file-level issue at line ${requestedLine}`);
            return { line: firstValidLine, reason: 'file_level_fallback' };
        }
        logger_1.logger.warn(`❌ No suitable comment location found for ${file}:${requestedLine}`);
        logger_1.logger.debug(`Valid lines were: [${validLines.join(', ')}]`);
        logger_1.logger.debug(`Max distance allowed: ${maxDistance}`);
        logger_1.logger.debug(`----------------------------\n`);
        return null;
    }
    /**
     * Convert diff line number (from AI) to actual file line number (for GitHub)
     * This is the key method that maps AI's numbered diff to GitHub's file line numbers
     */
    convertDiffLineToFileLine(file, diffLineNumber, fileChanges) {
        const fileChange = fileChanges.find(fc => fc.filename === file);
        if (!fileChange || !fileChange.patch) {
            logger_1.logger.warn(`No file change found for ${file}`);
            return null;
        }
        const lines = fileChange.patch.split('\n');
        let currentDiffLine = 0;
        let currentFileLine = 0;
        logger_1.logger.debug(`\n=== DIFF LINE TO FILE LINE CONVERSION ===`);
        logger_1.logger.debug(`Target diff line: ${diffLineNumber}`);
        logger_1.logger.debug(`Parsing patch for ${file}`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue; // Skip empty lines
            // Skip file headers
            if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff --git')) {
                continue;
            }
            if (line.startsWith('@@')) {
                // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
                const match = line.match(/\+(\d+)/);
                if (match && match[1]) {
                    currentFileLine = parseInt(match[1], 10) - 1; // Will increment for first content line
                    logger_1.logger.debug(`Hunk header: ${line} → setting currentFileLine to ${currentFileLine}`);
                }
            }
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                // Added line
                currentDiffLine++;
                currentFileLine++;
                logger_1.logger.debug(`Diff line ${currentDiffLine} (added) → File line ${currentFileLine}`);
                if (currentDiffLine === diffLineNumber) {
                    logger_1.logger.debug(`✅ Match found: Diff line ${diffLineNumber} = File line ${currentFileLine}`);
                    return currentFileLine;
                }
            }
            else if (line.startsWith(' ')) {
                // Context line
                currentDiffLine++;
                currentFileLine++;
                logger_1.logger.debug(`Diff line ${currentDiffLine} (context) → File line ${currentFileLine}`);
                if (currentDiffLine === diffLineNumber) {
                    logger_1.logger.debug(`✅ Match found: Diff line ${diffLineNumber} = File line ${currentFileLine}`);
                    return currentFileLine;
                }
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                // Deleted line - include in diff numbering but don't increment file line
                currentDiffLine++;
                logger_1.logger.debug(`Diff line ${currentDiffLine} (deleted) → No file line (deleted)`);
                if (currentDiffLine === diffLineNumber) {
                    logger_1.logger.warn(`❌ Cannot comment on deleted line ${diffLineNumber}`);
                    return null;
                }
            }
        }
        logger_1.logger.warn(`❌ Diff line ${diffLineNumber} not found in patch`);
        logger_1.logger.debug(`Total diff lines processed: ${currentDiffLine}`);
        logger_1.logger.debug(`=========================================\n`);
        return null;
    }
    /**
     * Parse patch to extract valid line numbers for comments
     * Returns absolute file line numbers that can be commented on
     * Uses the same logic as extractChangedLines but allows comments on context lines too
     */
    parseValidLinesFromPatch(patch) {
        const validLines = [];
        const lines = patch.split('\n');
        let currentLine = 0;
        logger_1.logger.debug(`\n=== PARSING PATCH FOR VALID COMMENT LINES ===`);
        logger_1.logger.debug(`Patch length: ${patch.length} characters`);
        logger_1.logger.debug(`Patch lines count: ${lines.length}`);
        logger_1.logger.debug(`Full patch content:\n${patch}`);
        logger_1.logger.debug(`================================`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            logger_1.logger.debug(`[${i}] Processing: "${line}"`);
            if (line && line.startsWith('@@')) {
                // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
                const match = line.match(/\+(\d+)/);
                if (match && match[1]) {
                    const hunkStartLine = parseInt(match[1], 10);
                    currentLine = hunkStartLine - 1;
                    logger_1.logger.debug(`Hunk header: ${line}`);
                    logger_1.logger.debug(`  Parsed start line: ${hunkStartLine}`);
                    logger_1.logger.debug(`  Setting currentLine to: ${currentLine} (will increment for first actual line)`);
                }
            }
            else if (line && line.startsWith('+') && !line.startsWith('+++')) {
                // Added line - can be commented on
                currentLine++;
                validLines.push(currentLine);
                logger_1.logger.debug(`+ Line ${currentLine}: Can comment (ADDED)`);
            }
            else if (line && line.startsWith(' ')) {
                // Context line - can be commented on (GitHub allows this)
                currentLine++;
                validLines.push(currentLine);
                logger_1.logger.debug(`  Line ${currentLine}: Can comment (CONTEXT)`);
            }
            else if (line && line.startsWith('-') && !line.startsWith('---')) {
                // Deleted line - ignore, don't increment currentLine
                logger_1.logger.debug(`- Line: DELETED (ignored)`);
            }
            else if (line) {
                // File headers or other content
                logger_1.logger.debug(`? Line: ${line.substring(0, 30)}... (ignored)`);
            }
        }
        logger_1.logger.debug(`Valid comment lines: [${validLines.join(', ')}]`);
        logger_1.logger.debug(`Total valid lines: ${validLines.length}`);
        if (validLines.length > 0) {
            logger_1.logger.debug(`Range: ${Math.min(...validLines)} to ${Math.max(...validLines)}`);
        }
        logger_1.logger.debug(`===============================================\n`);
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
                // Determine if suggestion is code or advice text
                if (this.isCodeSuggestion(primaryIssue.suggestion)) {
                    const codeLanguage = this.getLanguageFromFile(primaryIssue.file);
                    body += `**💡 Suggested Fix:**\n\`\`\`${codeLanguage}\n${primaryIssue.suggestion}\n\`\`\`\n\n`;
                }
                else {
                    // Display as regular text for advice/recommendations
                    body += `**💡 Suggestion:**\n${primaryIssue.suggestion}\n\n`;
                }
            }
        }
        // Auto-fix available indicator (commit button functionality removed)
        if (primaryIssue.fixedCode || primaryIssue.suggestion) {
            if (this.inputs.enableAutoFix) {
                const canAutoFix = ['rule_violation', 'best_practice'].includes(primaryIssue.category);
                if (canAutoFix) {
                    body += `**🤖 Auto-Fix Available:** This issue can be automatically fixed when auto-fix is enabled.\n\n`;
                }
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
        body += `---\n*<img src="https://raw.githubusercontent.com/amitwa1/pr-reviewer/main/assets/techsee-logo.png" width="16" height="16" alt="TechSee"> Generated by [TechSee AI PR Reviewer](https://github.com/amitwa1/pr-reviewer)*`;
        return body;
    }
    /**
     * Format summary comment body
     */
    async formatSummaryCommentBody(reviewResult, fileChanges, prPlan) {
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
        // Break down by review type if we have both types
        const architecturalIssues = issues.filter(issue => issue.reviewType === 'architectural');
        const detailedIssues = issues.filter(issue => issue.reviewType === 'detailed');
        if (architecturalIssues.length > 0 && detailedIssues.length > 0) {
            body += `| - Architectural | ${architecturalIssues.length} |\n`;
            body += `| - Detailed | ${detailedIssues.length} |\n`;
        }
        else if (architecturalIssues.length > 0) {
            body += `| - Architectural Only | ${architecturalIssues.length} |\n`;
        }
        else if (detailedIssues.length > 0) {
            body += `| - Detailed Only | ${detailedIssues.length} |\n`;
        }
        body += `| Rules Applied | ${rulesApplied.length} |\n`;
        body += `| Status | ${statusIcon} ${status.replace('_', ' ').toUpperCase()} |\n\n`;
        // Generate and add flow diagram
        if (prPlan && fileChanges.length > 1) {
            try {
                const flowDiagram = await this.flowDiagramGenerator.generateFlowDiagram(fileChanges, prPlan, issues);
                if (flowDiagram) {
                    const diagramTitle = flowDiagram.diagramType
                        ? `### 🌊 **${flowDiagram.title}**\n\n`
                        : `### 🌊 **What This PR Does - Flow Explanation**\n\n`;
                    body += diagramTitle;
                    body += `${flowDiagram.description}\n\n`;
                    // Ensure mermaid code ends with newline
                    const cleanMermaidCode = flowDiagram.mermaidCode.trim();
                    body += `\`\`\`mermaid\n${cleanMermaidCode}\n\`\`\`\n\n`;
                    body += `<details>\n<summary>💡 How to Read This Diagram</summary>\n\n`;
                    body += `This flow diagram tells the complete story of what happens when users interact with the changes in this PR. Follow the arrows to understand the journey from start to finish.\n\n`;
                    body += `**Visual Guide:**\n`;
                    body += `- **📋 Rectangles** \`[]\`: Actions that happen or processes that run\n`;
                    body += `- **💭 Diamonds** \`{}\`: Decision points where the system chooses what to do next\n`;
                    body += `- **🎯 Rounded rectangles** \`()\`: Starting points or final outcomes\n`;
                    body += `- **➡️ Arrows** \`-->\`: Shows what happens next in the flow\n`;
                    body += `- **🏷️ Arrow labels** \`-->|condition|\`: Explains when a specific path is taken\n\n`;
                    body += `**💡 Pro tip:** Start from the top and follow the arrows to understand the complete user journey and business logic behind these changes.\n\n`;
                    body += `</details>\n\n`;
                }
            }
            catch (error) {
                logger_1.logger.warn('Failed to generate flow diagram:', error);
                // Continue without diagram
            }
        }
        // Issues found
        if (issues.length > 0) {
            const architecturalIssues = issues.filter(issue => issue.reviewType === 'architectural');
            const detailedIssues = issues.filter(issue => issue.reviewType === 'detailed');
            // Show all issues directly
            if (this.inputs.summaryFormat === 'detailed' && issues.length <= 15) {
                body += `### 📋 **All Issues**\n\n`;
                // Show architectural issues first if they exist
                if (architecturalIssues.length > 0) {
                    body += `#### 🏗️ **Architectural Issues** (${architecturalIssues.length})\n`;
                    body += `*High-level structural and design concerns affecting maintainability*\n\n`;
                    const archIssuesByCategory = this.groupIssuesByCategory(architecturalIssues);
                    for (const [category, categoryIssues] of Object.entries(archIssuesByCategory)) {
                        if (categoryIssues.length > 0) {
                            const categoryIcon = this.getCategoryIcon(category);
                            body += `**${categoryIcon} ${this.formatCategoryName(category)} (${categoryIssues.length})**\n`;
                            for (const issue of categoryIssues) {
                                const typeIcon = this.getIssueIcon(issue.type);
                                const fileURL = this.generateGitHubFileURL(issue.file, issue.line);
                                body += `- ${typeIcon} **[${issue.file}:${issue.line || '?'}](${fileURL})** - ${issue.message}\n`;
                                // Add description if it's different from message and provides additional context
                                if (issue.description &&
                                    issue.description !== issue.message &&
                                    issue.description.length > 0) {
                                    body += `  - *${issue.description}*\n`;
                                }
                                // Add suggestion if available
                                if (issue.suggestion && issue.suggestion.length > 0) {
                                    body += `  - 💡 **Suggestion:** ${issue.suggestion}\n`;
                                }
                            }
                            body += '\n';
                        }
                    }
                }
                // Show detailed issues if they exist
                if (detailedIssues.length > 0) {
                    body += `#### 🔍 **Detailed Issues** (${detailedIssues.length})\n`;
                    body += `*Code-level issues and rule violations*\n\n`;
                    const detailedIssuesByCategory = this.groupIssuesByCategory(detailedIssues);
                    for (const [category, categoryIssues] of Object.entries(detailedIssuesByCategory)) {
                        if (categoryIssues.length > 0) {
                            const categoryIcon = this.getCategoryIcon(category);
                            body += `**${categoryIcon} ${this.formatCategoryName(category)} (${categoryIssues.length})**\n`;
                            for (const issue of categoryIssues) {
                                const typeIcon = this.getIssueIcon(issue.type);
                                const fileURL = this.generateGitHubFileURL(issue.file, issue.line);
                                body += `- ${typeIcon} **[${issue.file}:${issue.line || '?'}](${fileURL})** - ${issue.message}\n`;
                                // Add description if it's different from message and provides additional context
                                if (issue.description &&
                                    issue.description !== issue.message &&
                                    issue.description.length > 0) {
                                    body += `  - *${issue.description}*\n`;
                                }
                                // Add suggestion if available
                                if (issue.suggestion && issue.suggestion.length > 0) {
                                    body += `  - 💡 **Suggestion:** ${issue.suggestion}\n`;
                                }
                            }
                            body += '\n';
                        }
                    }
                }
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
        body += `---\n*Generated by [TechSee AI PR Reviewer](https://github.com/amitwa1/pr-reviewer) • [Report Issues](https://github.com/amitwa1/pr-reviewer/issues)*`;
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
     * Determine if a suggestion contains code or is general advice
     */
    isCodeSuggestion(suggestion) {
        // Check for common code patterns
        const codeIndicators = [
            /^[\s]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:]/m, // Variable assignments
            /^[\s]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/m, // Function calls
            /^[\s]*[{}[\]]/m, // Brackets/braces
            /^[\s]*import\s+/m, // Import statements
            /^[\s]*export\s+/m, // Export statements
            /^[\s]*function\s+/m, // Function declarations
            /^[\s]*const\s+|let\s+|var\s+/m, // Variable declarations
            /^[\s]*if\s*\(|while\s*\(|for\s*\(/m, // Control structures
            /^[\s]*class\s+/m, // Class declarations
            /^[\s]*interface\s+/m, // Interface declarations
            /^[\s]*type\s+/m, // Type declarations
            /^[\s]*\/\*|\/\//m, // Comments
            /[\s]*;[\s]*$/m, // Statements ending with semicolon
            /^[\s]*<[a-zA-Z]/m, // HTML/JSX tags
            /^[\s]*\./m, // Method chaining
        ];
        // Check if suggestion contains typical code patterns
        const hasCodePatterns = codeIndicators.some(pattern => pattern.test(suggestion));
        // Check for common advice phrases that indicate it's not code
        const adviceIndicators = [
            /consider/i,
            /recommend/i,
            /suggest/i,
            /should/i,
            /could/i,
            /might/i,
            /try/i,
            /use.*instead/i,
            /avoid/i,
            /ensure/i,
            /make sure/i,
            /be careful/i,
            /note that/i,
            /remember to/i,
            /don't forget/i,
        ];
        const hasAdviceLanguage = adviceIndicators.some(pattern => pattern.test(suggestion));
        // If it has clear advice language but no code patterns, it's advice
        if (hasAdviceLanguage && !hasCodePatterns) {
            return false;
        }
        // If it has code patterns, it's likely code
        if (hasCodePatterns) {
            return true;
        }
        // Check length and structure - very short suggestions are often advice
        if (suggestion.length < 50 && !suggestion.includes('\n') && !suggestion.includes(';')) {
            return false;
        }
        // Default to treating as advice if uncertain
        return false;
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