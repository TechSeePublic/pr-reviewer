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
     * Generate GitHub URL for summary links - SIMPLE approach that should work
     */
    generateGitHubFileURL(fileName, lineNumber, fileChanges, _postedComments) {
        const baseURL = `https://github.com/${this.prContext.owner}/${this.prContext.repo}/pull/${this.prContext.pullNumber}`;
        logger_1.logger.debug(`🔍 generateGitHubFileURL called: ${fileName}:${lineNumber}`);
        // SIMPLE APPROACH: Use GitHub's commit view instead of trying to guess diff hashes
        // This should be more reliable than trying to reverse-engineer GitHub's diff anchor algorithm
        if (fileChanges) {
            const fileChange = fileChanges.find(fc => fc.filename === fileName);
            if (fileChange) {
                logger_1.logger.debug(`📁 Found file in changes: ${fileName}`);
                // Use the commit SHA to create a reliable link to the specific file
                const commitURL = `https://github.com/${this.prContext.owner}/${this.prContext.repo}/blob/${this.prContext.sha}/${fileName}`;
                if (lineNumber && lineNumber > 0) {
                    const actualFileLineNumber = this.convertDiffLineToFileLine(fileName, lineNumber, fileChanges);
                    logger_1.logger.debug(`🔢 Line conversion: AI diff line ${lineNumber} -> File line ${actualFileLineNumber}`);
                    if (actualFileLineNumber && actualFileLineNumber > 0) {
                        const commitLineURL = `${commitURL}#L${actualFileLineNumber}`;
                        logger_1.logger.debug(`📍 Generated commit+line URL: ${commitLineURL}`);
                        return commitLineURL;
                    }
                }
                // File without line number
                logger_1.logger.debug(`📄 Generated commit file URL: ${commitURL}`);
                return commitURL;
            }
            else {
                logger_1.logger.debug(`⚠️ File ${fileName} not found in PR changes`);
            }
        }
        // Fallback: PR files page
        const filesURL = `${baseURL}/files`;
        logger_1.logger.debug(`📁 Fallback to PR files page: ${filesURL}`);
        return filesURL;
    }
    /**
     * Generate proper GitHub diff anchor URL
     */
    generateDiffAnchorURL(baseURL, fileName, lineNumber) {
        // GitHub diff anchors use a specific format
        // Option 1: Try the standard hex encoding of the filename
        const filePathHex = Buffer.from(fileName).toString('hex');
        if (lineNumber && lineNumber > 0) {
            // Try to link to specific line in diff (R for right side, L for left side)
            // Format: #diff-{filehash}R{lineNumber}
            return `${baseURL}/files#diff-${filePathHex}R${lineNumber}`;
        }
        else {
            // Link to the file header in diff
            return `${baseURL}/files#diff-${filePathHex}`;
        }
    }
    /**
     * Post all review comments (inline and summary)
     */
    async postReviewComments(reviewResult, fileChanges, prPlan) {
        // Track posted inline comments for summary links
        const postedComments = new Map();
        const shouldPostInline = this.inputs.commentStyle === 'inline' || this.inputs.commentStyle === 'both';
        const shouldPostSummary = this.inputs.commentStyle === 'summary' || this.inputs.commentStyle === 'both';
        logger_1.logger.info(`Comment posting config: commentStyle=${this.inputs.commentStyle}, shouldPostSummary=${shouldPostSummary}, shouldPostInline=${shouldPostInline}`);
        logger_1.logger.info(`Review result: ${reviewResult.issues.length} total issues found (logLevel=${this.inputs.logLevel}, inlineSeverity=${this.inputs.inlineSeverity})`);
        // Get existing comments if we should update them
        let existingComments = {
            inlineComments: [],
        };
        logger_1.logger.info(`🔍 Update existing comments setting: ${this.inputs.updateExistingComments}`);
        if (this.inputs.updateExistingComments) {
            logger_1.logger.info(`📥 Fetching existing bot comments...`);
            existingComments = await this.githubClient.getExistingBotComments();
            // Debug: Log existing comments
            await this.githubClient.logExistingComments();
        }
        else {
            logger_1.logger.info(`⏭️ Skipping existing comment lookup (updateExistingComments=false)`);
        }
        // Enhance issues with original code for commit suggestions
        const enhancedIssues = this.enhanceIssuesWithOriginalCode(reviewResult.issues, fileChanges);
        // Filter issues based on inline severity for inline comments
        const filteredIssuesForInline = this.filterIssuesBySeverity(enhancedIssues);
        // Log issue types for debugging
        const issueTypes = enhancedIssues.reduce((acc, issue) => {
            acc[issue.type] = (acc[issue.type] || 0) + 1;
            return acc;
        }, {});
        logger_1.logger.info(`Issue types found: ${Object.entries(issueTypes)
            .map(([type, count]) => `${type}:${count}`)
            .join(', ')}`);
        // Log first few issues for detailed debugging
        if (enhancedIssues.length > 0) {
            logger_1.logger.info(`Sample issues for debugging:`);
            enhancedIssues.slice(0, 3).forEach((issue, i) => {
                logger_1.logger.info(`  Issue ${i + 1}: type="${issue.type}", category="${issue.category}", message="${issue.message}", file="${issue.file}", line=${issue.line}`);
            });
        }
        logger_1.logger.info(`Issue filtering: ${enhancedIssues.length} total → ${filteredIssuesForInline.length} eligible for inline comments (severity: ${this.inputs.inlineSeverity}+)`);
        // Post inline comments (based on inline_severity setting)
        if (shouldPostInline) {
            logger_1.logger.info(`Posting ${filteredIssuesForInline.length} inline comments...`);
            await this.postInlineComments(filteredIssuesForInline, fileChanges, existingComments.inlineComments, postedComments);
        }
        // Post architectural comment SECOND (after inline comments)
        const architecturalIssues = enhancedIssues.filter(issue => issue.reviewType === 'architectural');
        if (architecturalIssues.length > 0) {
            logger_1.logger.info(`🏗️ Posting architectural comment for ${architecturalIssues.length} architectural issues...`);
            try {
                await this.postArchitecturalComment(architecturalIssues, fileChanges, existingComments.architecturalComment);
                logger_1.logger.info('✅ Architectural comment posted successfully');
            }
            catch (error) {
                logger_1.logger.error('❌ Failed to post architectural comment:', error);
                // Don't throw - architectural comment is optional
            }
        }
        // Post summary comment LAST - only skip if there are no file changes to review
        if (shouldPostSummary) {
            if (fileChanges.length === 0) {
                logger_1.logger.info('❌ Summary comment skipped - no file changes to review');
                return;
            }
            logger_1.logger.info(`📝 Posting summary comment for ${fileChanges.length} file changes and ${enhancedIssues.length} issues...`);
            try {
                // Create enhanced review result for summary
                const enhancedReviewResult = {
                    ...reviewResult,
                    issues: enhancedIssues
                };
                await this.postSummaryComment(enhancedReviewResult, fileChanges, existingComments.summaryComment, prPlan, postedComments);
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
     * Post dedicated architectural comment
     */
    async postArchitecturalComment(architecturalIssues, fileChanges, existingComment) {
        const body = this.formatArchitecturalCommentBody(architecturalIssues, fileChanges);
        const comment = {
            body,
            reviewResult: { issues: architecturalIssues }, // Simplified for architectural comment
        };
        await this.githubClient.postArchitecturalComment(comment, existingComment?.id);
    }
    /**
     * Post inline comments for specific issues
     */
    async postInlineComments(issues, fileChanges, existingComments, postedComments) {
        // Track which existing comments have been updated to prevent duplicates
        const updatedCommentIds = new Set();
        logger_1.logger.info(`🎯 Starting inline comment processing with ${existingComments.length} existing comments`);
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
            // Validate input
            if (originalLine <= 0) {
                logger_1.logger.warn(`❌ Invalid diff line number: ${originalLine} (must be > 0)`);
                continue;
            }
            let actualFileLineNumber = this.convertDiffLineToFileLine(file, originalLine, fileChanges);
            // If conversion fails, try to find the closest valid line
            if (!actualFileLineNumber) {
                logger_1.logger.warn(`⚠️  Diff line conversion failed for line ${originalLine}. Finding closest valid line...`);
                const validLocation = this.findValidCommentLocation(file, originalLine, fileChanges);
                if (validLocation) {
                    actualFileLineNumber = validLocation.line;
                    logger_1.logger.info(`🔧 Adjusted comment from diff line ${originalLine} to file line ${actualFileLineNumber} (${validLocation.reason})`);
                }
                else {
                    logger_1.logger.warn(`❌ Skipping inline comment for ${file}:${originalLine} - no valid line found`);
                    continue;
                }
            }
            logger_1.logger.info(`✅ Converted diff line ${originalLine} to file line ${actualFileLineNumber}`);
            logger_1.logger.info(`✅ SUCCESS: AI line ${originalLine} → GitHub line ${actualFileLineNumber} for ${file}`);
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
            // Validate final line number before sending to GitHub
            if (actualFileLineNumber <= 0) {
                logger_1.logger.warn(`❌ Invalid final line number: ${actualFileLineNumber} (must be > 0)`);
                continue;
            }
            // Debug: Log the exact line number being sent to GitHub
            logger_1.logger.info(`📍 FINAL LINE SELECTION: AI diff line ${originalLine} → GitHub comment line ${actualFileLineNumber}`);
            // Since the AI now handles deduplication intelligently, we simply create all comments
            // The AI has already seen existing comments and decided whether to create new ones
            logger_1.logger.info(`🤖 AI-driven deduplication: Creating comment at ${file}:${actualFileLineNumber}`);
            logger_1.logger.info(`Issue: "${locationIssues[0]?.message}" (${locationIssues[0]?.type})`);
            try {
                logger_1.logger.info(`\n=== POSTING INLINE COMMENT ===`);
                logger_1.logger.info(`File: ${file}`);
                logger_1.logger.info(`AI diff line: ${originalLine}`);
                logger_1.logger.info(`GitHub file line: ${actualFileLineNumber}`);
                logger_1.logger.info(`Issue type: ${locationIssues[0]?.type} - ${locationIssues[0]?.message}`);
                logger_1.logger.info(`==============================\n`);
                // Always create new comments since AI handles deduplication
                const commentId = await this.githubClient.postInlineComment(comment);
                // Track the posted comment for summary links
                if (commentId) {
                    const commentKey = `${file}:${originalLine}`;
                    postedComments.set(commentKey, commentId);
                    logger_1.logger.debug(`Tracked comment ${commentId} for ${commentKey}`);
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to post inline comment for ${file}:${actualFileLineNumber}:`, error);
            }
        }
        // Note: Cleanup is no longer needed since AI handles deduplication intelligently
        logger_1.logger.info(`✅ AI-driven comment management completed`);
    }
    /**
     * Post summary comment
     */
    async postSummaryComment(reviewResult, fileChanges, existingComment, prPlan, postedComments) {
        const comment = {
            body: await this.formatSummaryCommentBody(reviewResult, fileChanges, prPlan, postedComments),
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
     * Find the best matching existing comment for smart updates
     */
    findBestMatchingComment(file, newLineNumber, newIssue, existingComments, updatedCommentIds) {
        if (!newIssue) {
            logger_1.logger.debug(`🔍 No new issue provided for matching`);
            return null;
        }
        let fileComments = existingComments.filter(c => c.location.file === file);
        // Filter out already updated comments
        if (updatedCommentIds) {
            const originalCount = fileComments.length;
            fileComments = fileComments.filter(c => !c.id || !updatedCommentIds.has(c.id));
            const filteredCount = originalCount - fileComments.length;
            if (filteredCount > 0) {
                logger_1.logger.debug(`🔍 Filtered out ${filteredCount} already updated comments`);
            }
        }
        if (fileComments.length === 0) {
            logger_1.logger.debug(`🔍 No available comments in ${file} (${updatedCommentIds ? 'all already updated' : 'none exist'})`);
            return null;
        }
        logger_1.logger.debug(`🔍 Starting smart matching for "${newIssue.message}" at line ${newLineNumber}`);
        // Strategy 1: Exact line match
        logger_1.logger.debug(`🔍 Strategy 1: Looking for exact line match at ${newLineNumber}`);
        const exactMatch = fileComments.find(c => c.location.line === newLineNumber);
        if (exactMatch) {
            logger_1.logger.debug(`✅ Strategy 1 SUCCESS: Found exact line match (ID ${exactMatch.id})`);
            return { comment: exactMatch, reason: 'exact_line_match' };
        }
        logger_1.logger.debug(`❌ Strategy 1 FAILED: No exact line match`);
        // Strategy 2: Nearby line match (within 5 lines) + issue similarity
        logger_1.logger.debug(`🔍 Strategy 2: Looking for nearby similar issues (±5 lines)`);
        const nearbyMatches = fileComments.filter(c => Math.abs(c.location.line - newLineNumber) <= 5);
        logger_1.logger.debug(`🔍 Found ${nearbyMatches.length} nearby comments`);
        for (const comment of nearbyMatches) {
            const distance = Math.abs(comment.location.line - newLineNumber);
            logger_1.logger.debug(`🔍 Checking comment at line ${comment.location.line} (distance: ${distance})`);
            const isSimilar = this.areIssuesSimilar(newIssue, comment, newLineNumber, comment.location.line);
            logger_1.logger.debug(`🔍 Similarity check result: ${isSimilar}`);
            if (isSimilar) {
                logger_1.logger.debug(`✅ Strategy 2 SUCCESS: Found nearby similar issue (ID ${comment.id})`);
                return {
                    comment,
                    reason: `nearby_similar_issue (distance: ${distance} lines)`
                };
            }
        }
        logger_1.logger.debug(`❌ Strategy 2 FAILED: No nearby similar issues`);
        // Strategy 3: Same issue type and similar message anywhere in the file
        logger_1.logger.debug(`🔍 Strategy 3: Looking for similar issues anywhere in file`);
        for (const comment of fileComments) {
            const distance = Math.abs(comment.location.line - newLineNumber);
            logger_1.logger.debug(`🔍 Checking comment at line ${comment.location.line} (distance: ${distance})`);
            const isSimilar = this.areIssuesSimilar(newIssue, comment, newLineNumber, comment.location.line, true);
            logger_1.logger.debug(`🔍 File-wide similarity check result: ${isSimilar}`);
            if (isSimilar) {
                logger_1.logger.debug(`✅ Strategy 3 SUCCESS: Found similar issue anywhere in file (ID ${comment.id})`);
                return {
                    comment,
                    reason: `same_file_similar_issue (distance: ${distance} lines)`
                };
            }
        }
        logger_1.logger.debug(`❌ Strategy 3 FAILED: No similar issues found anywhere in file`);
        logger_1.logger.debug(`❌ ALL STRATEGIES FAILED: No matching comment found`);
        return null;
    }
    /**
     * Check if two issues are similar enough to be considered the same
     */
    areIssuesSimilar(newIssue, existingComment, newLine, existingLine, allowLargeDistance = false) {
        const distance = Math.abs(newLine - existingLine);
        logger_1.logger.debug(`    🔍 Similarity Analysis:`);
        logger_1.logger.debug(`       New: "${newIssue.message}" (${newIssue.type}) at line ${newLine}`);
        logger_1.logger.debug(`       Old: "${existingComment.body.substring(0, 100)}..." at line ${existingLine}`);
        logger_1.logger.debug(`       Distance: ${distance} lines, allowLargeDistance: ${allowLargeDistance}`);
        // If lines are too far apart and we don't allow large distances, not similar
        if (!allowLargeDistance && distance > 10) {
            logger_1.logger.debug(`       ❌ Distance check FAILED: ${distance} > 10 lines`);
            return false;
        }
        logger_1.logger.debug(`       ✅ Distance check PASSED`);
        // Extract issue information from the existing comment body
        const commentBody = existingComment.body.toLowerCase();
        const newMessage = newIssue.message.toLowerCase();
        const newType = newIssue.type.toLowerCase();
        logger_1.logger.debug(`       Comparing: "${newMessage}" vs "${commentBody.substring(0, 50)}..."`);
        // Check if the issue type matches
        const hasMatchingType = commentBody.includes(newType) ||
            (newType === 'error' && commentBody.includes('❌')) ||
            (newType === 'warning' && commentBody.includes('⚠️')) ||
            (newType === 'info' && commentBody.includes('ℹ️'));
        logger_1.logger.debug(`       Type match: ${hasMatchingType} (looking for "${newType}")`);
        // Check message similarity - look for key words
        const newWords = newMessage.split(' ').filter(word => word.length > 3);
        const matchingWords = newWords.filter(word => commentBody.includes(word));
        const similarityRatio = matchingWords.length / Math.max(newWords.length, 1);
        logger_1.logger.debug(`       New words: [${newWords.join(', ')}]`);
        logger_1.logger.debug(`       Matching words: [${matchingWords.join(', ')}]`);
        logger_1.logger.debug(`       Similarity ratio: ${similarityRatio.toFixed(2)} (${matchingWords.length}/${newWords.length})`);
        // Consider issues similar if:
        // 1. Same type AND significant message overlap (>50%)
        // 2. OR very high message similarity (>80%) regardless of type
        const result = (hasMatchingType && similarityRatio > 0.5) || similarityRatio > 0.8;
        if (result) {
            if (hasMatchingType && similarityRatio > 0.5) {
                logger_1.logger.debug(`       ✅ SIMILAR: Same type + ${(similarityRatio * 100).toFixed(0)}% message match`);
            }
            else {
                logger_1.logger.debug(`       ✅ SIMILAR: High message similarity (${(similarityRatio * 100).toFixed(0)}%)`);
            }
        }
        else {
            logger_1.logger.debug(`       ❌ NOT SIMILAR: Type=${hasMatchingType}, Similarity=${(similarityRatio * 100).toFixed(0)}%`);
        }
        return result;
    }
    /**
     * Clean up orphaned comments that no longer have corresponding issues
     */
    async cleanupOrphanedComments(existingComments, currentIssues, fileChanges) {
        if (!this.inputs.updateExistingComments) {
            return; // Only clean up if we're managing existing comments
        }
        logger_1.logger.info(`🧹 Checking for orphaned comments to clean up...`);
        // Get files that are still being changed in this review
        const changedFiles = new Set(fileChanges.map(fc => fc.filename));
        // Track which existing comments were matched/updated
        const matchedCommentIds = new Set();
        // For each current issue, find if it matches any existing comment
        for (const issue of currentIssues) {
            if (!issue.file || !issue.line)
                continue;
            const fileComments = existingComments.filter(c => c.location.file === issue.file);
            const match = this.findBestMatchingComment(issue.file, issue.line, issue, existingComments, undefined);
            if (match && match.comment.id) {
                matchedCommentIds.add(match.comment.id);
            }
        }
        // Find orphaned comments (existing comments that weren't matched to any current issue)
        const orphanedComments = existingComments.filter(comment => {
            // Only consider comments in files that are still being changed
            if (!changedFiles.has(comment.location.file)) {
                return false;
            }
            // Only consider comments that have an ID
            if (!comment.id) {
                return false;
            }
            // If the comment wasn't matched to any current issue, it's orphaned
            return !matchedCommentIds.has(comment.id);
        });
        if (orphanedComments.length > 0) {
            logger_1.logger.info(`🗑️ Found ${orphanedComments.length} orphaned comments to clean up`);
            for (const orphanedComment of orphanedComments) {
                if (!orphanedComment.id)
                    continue; // Safety check
                try {
                    logger_1.logger.info(`🗑️ Deleting orphaned comment ${orphanedComment.id} at ${orphanedComment.location.file}:${orphanedComment.location.line}`);
                    await this.githubClient.deleteComment(orphanedComment.id, 'review');
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to delete orphaned comment ${orphanedComment.id}:`, error);
                }
            }
        }
        else {
            logger_1.logger.info(`✅ No orphaned comments found`);
        }
    }
    /**
     * Format architectural comment body - clear and easy to understand
     */
    formatArchitecturalCommentBody(architecturalIssues, fileChanges) {
        let body = `## 🏗️ Architectural Review\n\n`;
        body += `*This comment focuses on high-level code structure, design patterns, and maintainability concerns that affect the overall codebase.*\n\n`;
        // Overview
        body += `### 📊 Overview\n`;
        body += `Found **${architecturalIssues.length}** architectural concern${architecturalIssues.length > 1 ? 's' : ''} that may impact long-term maintainability.\n\n`;
        // Group by category for better organization
        const issuesByCategory = this.groupIssuesByCategory(architecturalIssues);
        for (const [category, categoryIssues] of Object.entries(issuesByCategory)) {
            if (categoryIssues.length === 0)
                continue;
            const categoryIcon = this.getCategoryIcon(category);
            const categoryName = this.formatCategoryName(category);
            body += `### ${categoryIcon} ${categoryName}\n\n`;
            categoryIssues.forEach((issue, index) => {
                const severityIcon = issue.severity === 'high' ? '🚨' : issue.severity === 'medium' ? '⚠️' : 'ℹ️';
                body += `#### ${index + 1}. ${severityIcon} ${issue.message}\n\n`;
                // Add description with better formatting
                if (issue.description && issue.description !== issue.message) {
                    body += `**What's the concern?**\n`;
                    body += `${issue.description}\n\n`;
                }
                // Show affected files in a clear way
                if (issue.relatedFiles && issue.relatedFiles.length > 1) {
                    body += `**Affected files:**\n`;
                    issue.relatedFiles.forEach(file => {
                        // Use the SAME method as summary links (with proper line conversion)
                        const fileURL = this.generateGitHubFileURL(file, undefined, fileChanges);
                        body += `- [${file}](${fileURL})\n`;
                    });
                    body += '\n';
                }
                else if (issue.file && issue.file !== 'Multiple Files' && issue.file !== 'unknown') {
                    // Use the SAME method as summary links (with proper line conversion)
                    const fileURL = this.generateGitHubFileURL(issue.file, issue.line, fileChanges);
                    body += `**File:** [${issue.file}](${fileURL})\n\n`;
                }
                // Add suggestion if available
                if (issue.suggestion) {
                    body += `**💡 Recommendation:**\n`;
                    body += `${issue.suggestion}\n\n`;
                }
                body += `---\n\n`;
            });
        }
        // Footer
        body += `### 🎯 Next Steps\n\n`;
        body += `These architectural concerns are suggestions for improving code quality and maintainability. `;
        body += `Consider addressing them to make the codebase easier to understand, modify, and extend in the future.\n\n`;
        body += `*<img src="https://raw.githubusercontent.com/amitwa1/pr-reviewer/main/assets/techsee-logo.png" width="16" height="16" alt="TechSee"> Generated by [TechSee AI PR Reviewer](https://github.com/amitwa1/pr-reviewer) - Architectural Analysis*`;
        return body;
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
     * Find the best valid location for a comment when direct conversion fails
     * This method assumes requestedLine is a diff line number, so it looks for nearby file line numbers
     */
    findValidCommentLocation(file, requestedDiffLine, fileChanges) {
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
        logger_1.logger.debug(`\n--- FINDING VALID COMMENT LOCATION ---`);
        logger_1.logger.debug(`Requested diff line: ${requestedDiffLine}`);
        logger_1.logger.debug(`Valid file lines in diff: [${validLines.join(', ')}]`);
        logger_1.logger.debug(`File: ${file}`);
        // Try to map nearby diff lines to file lines
        // Look at diff lines around the requested one
        for (let offset = 0; offset <= 5; offset++) {
            for (const direction of [1, -1]) {
                if (offset === 0 && direction === -1)
                    continue; // Skip duplicate at offset 0
                const testDiffLine = requestedDiffLine + (offset * direction);
                if (testDiffLine <= 0)
                    continue;
                const mappedFileLine = this.convertDiffLineToFileLine(file, testDiffLine, fileChanges);
                if (mappedFileLine && validLines.includes(mappedFileLine)) {
                    logger_1.logger.info(`🔄 Found nearby mapping: diff line ${testDiffLine} → file line ${mappedFileLine} (offset: ${offset * direction})`);
                    return { line: mappedFileLine, reason: 'nearby_diff_mapping' };
                }
            }
        }
        // If no nearby mapping works, use the closest valid file line to the requested diff line number
        // This is a heuristic fallback
        let closestLine = null;
        let minDistance = Infinity;
        for (const validLine of validLines) {
            const distance = Math.abs(validLine - requestedDiffLine);
            if (distance < minDistance) {
                minDistance = distance;
                closestLine = validLine;
            }
        }
        if (closestLine !== null) {
            logger_1.logger.info(`🔧 Using closest file line ${closestLine} for diff line ${requestedDiffLine} (distance: ${minDistance})`);
            return { line: closestLine, reason: 'closest_file_line' };
        }
        logger_1.logger.warn(`❌ No suitable comment location found for ${file}:${requestedDiffLine}`);
        logger_1.logger.debug(`Valid file lines were: [${validLines.join(', ')}]`);
        logger_1.logger.debug(`-----------------------------------------\n`);
        return null;
    }
    /**
     * Convert diff line number (from AI) to actual file line number (for GitHub)
     * This maps AI's numbered diff lines to GitHub's file line numbers
     *
     * The AI receives a numbered diff where all content lines (added, deleted, context) are numbered 1, 2, 3...
     * But GitHub comments need actual file line numbers (only added and context lines).
     */
    convertDiffLineToFileLine(file, diffLineNumber, fileChanges) {
        const fileChange = fileChanges.find(fc => fc.filename === file);
        if (!fileChange || !fileChange.patch) {
            logger_1.logger.warn(`No file change found for ${file}`);
            return null;
        }
        const lines = fileChange.patch.split('\n');
        let currentDiffLine = 0; // Tracks the numbered lines that AI sees
        let currentFileLine = 0; // Tracks actual file line numbers
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
                // Added line - exists in both numbered diff and final file
                currentDiffLine++;
                currentFileLine++;
                logger_1.logger.debug(`Diff line ${currentDiffLine} (added) → File line ${currentFileLine}`);
                if (currentDiffLine === diffLineNumber) {
                    logger_1.logger.debug(`✅ Match found: Diff line ${diffLineNumber} = File line ${currentFileLine}`);
                    return currentFileLine;
                }
            }
            else if (line.startsWith(' ')) {
                // Context line - exists in both numbered diff and final file
                currentDiffLine++;
                currentFileLine++;
                logger_1.logger.debug(`Diff line ${currentDiffLine} (context) → File line ${currentFileLine}`);
                if (currentDiffLine === diffLineNumber) {
                    logger_1.logger.debug(`✅ Match found: Diff line ${diffLineNumber} = File line ${currentFileLine}`);
                    return currentFileLine;
                }
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                // Deleted line - exists in numbered diff but NOT in final file
                currentDiffLine++;
                // Don't increment currentFileLine because this line doesn't exist in the file
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
        // Enhanced fix display with commit suggestions
        if (primaryIssue.suggestion && this.inputs.enableSuggestions) {
            body += this.formatFixSection(primaryIssue);
        }
        // Enhanced action buttons
        body += this.formatActionButtons(primaryIssue);
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
     * Format the fix section with enhanced features
     */
    formatFixSection(issue) {
        let section = '';
        if (issue.fixedCode) {
            // Check if this is a small fix that qualifies for commit suggestion
            const isSmallFix = this.isSmallFix(issue);
            if (isSmallFix && this.hasEnhancedCommentsEnabled()) {
                // Use GitHub suggested changes format for small fixes
                section += this.formatSuggestedChange(issue);
            }
            else {
                // Use traditional code block format for larger fixes
                section += `**💡 Suggested Fix:**\n\`\`\`${this.getLanguageFromFile(issue.file)}\n${issue.fixedCode}\n\`\`\`\n\n`;
            }
        }
        else if (issue.suggestion) {
            // Determine if suggestion is code or advice text
            if (this.isCodeSuggestion(issue.suggestion)) {
                const codeLanguage = this.getLanguageFromFile(issue.file);
                section += `**💡 Suggested Fix:**\n\`\`\`${codeLanguage}\n${issue.suggestion}\n\`\`\`\n\n`;
            }
            else {
                // Display as regular text for advice/recommendations
                section += `**💡 Suggestion:**\n${issue.suggestion}\n\n`;
            }
        }
        return section;
    }
    /**
     * Format GitHub suggested changes for small fixes
     */
    formatSuggestedChange(issue) {
        if (!issue.fixedCode || !issue.originalCode) {
            return `**💡 Suggested Fix:**\n\`\`\`${this.getLanguageFromFile(issue.file)}\n${issue.fixedCode}\n\`\`\`\n\n`;
        }
        // GitHub suggested changes format
        let section = `**💡 Suggested Fix:**\n\n`;
        section += `\`\`\`suggestion\n${issue.fixedCode}\n\`\`\`\n\n`;
        section += `> 💡 **Quick Apply**: This fix can be committed directly using the "Commit suggestion" button above.\n\n`;
        return section;
    }
    /**
     * Format action buttons for enhanced functionality
     */
    formatActionButtons(issue) {
        const buttons = [];
        // Cursor integration button
        if (this.hasCursorIntegrationEnabled()) {
            const cursorLink = this.generateCursorLink(issue);
            if (cursorLink) {
                buttons.push(`[🎯 Open in Cursor](${cursorLink})`);
            }
        }
        // Auto-fix indicator
        if (issue.fixedCode || issue.suggestion) {
            if (this.inputs.enableAutoFix) {
                const canAutoFix = ['rule_violation', 'best_practice'].includes(issue.category);
                if (canAutoFix) {
                    buttons.push('🤖 Auto-Fix Available');
                }
            }
        }
        if (buttons.length === 0) {
            return '';
        }
        let section = `**🔧 Actions:**\n`;
        for (const button of buttons) {
            section += `- ${button}\n`;
        }
        section += '\n';
        return section;
    }
    /**
     * Check if enhanced comments are enabled
     */
    hasEnhancedCommentsEnabled() {
        return this.inputs.enableCommitSuggestions === true;
    }
    /**
     * Check if cursor integration is enabled
     */
    hasCursorIntegrationEnabled() {
        return this.inputs.enableCursorIntegration === true;
    }
    /**
     * Check if a fix is small enough for inline commit suggestion
     */
    isSmallFix(issue) {
        if (!issue.fixedCode)
            return false;
        const maxLines = this.inputs.maxFixSize || 10;
        const lineCount = issue.fixedCode.split('\n').length;
        // Also check if we have original code for comparison
        const hasOriginal = issue.originalCode !== undefined;
        return lineCount <= maxLines && hasOriginal;
    }
    /**
     * Generate Cursor deep link for opening file at specific location
     */
    generateCursorLink(issue) {
        if (!issue.file || !issue.line)
            return null;
        // Cursor deep link format: cursor://file/{path}:{line}:{column}
        // For GitHub Actions context, we'll use the repository structure
        const line = issue.line;
        const column = issue.column || 1;
        // Construct the Cursor link - this will work if Cursor is installed
        const cursorLink = `cursor://file/${encodeURIComponent(issue.file)}:${line}:${column}`;
        return cursorLink;
    }
    /**
     * Enhance issues with original code detection for small fixes
     * This method helps identify and populate originalCode for GitHub suggested changes
     */
    enhanceIssuesWithOriginalCode(issues, fileChanges) {
        return issues.map(issue => {
            // Skip if already has original code or no fixed code
            if (issue.originalCode || !issue.fixedCode || !issue.line) {
                return issue;
            }
            // Try to extract original code from file changes
            const originalCode = this.extractOriginalCodeFromDiff(issue, fileChanges);
            if (originalCode) {
                return {
                    ...issue,
                    originalCode,
                    isSmallFix: this.isSmallFix({ ...issue, originalCode })
                };
            }
            return issue;
        });
    }
    /**
     * Extract original code from diff for a specific issue
     */
    extractOriginalCodeFromDiff(issue, fileChanges) {
        const fileChange = fileChanges.find(fc => fc.filename === issue.file);
        if (!fileChange || !fileChange.patch) {
            return null;
        }
        try {
            // Parse the patch to find the original line
            const lines = fileChange.patch.split('\n');
            let currentDiffLine = 0;
            let currentFileLine = 0;
            const targetLine = issue.line;
            for (const line of lines) {
                if (line.startsWith('@@')) {
                    // Parse hunk header
                    const match = line.match(/\+(\d+)/);
                    if (match && match[1]) {
                        currentFileLine = parseInt(match[1], 10) - 1;
                    }
                }
                else if (line.startsWith('+') && !line.startsWith('+++')) {
                    // Added line
                    currentDiffLine++;
                    currentFileLine++;
                    if (currentFileLine === targetLine) {
                        // This is a new line, check if we can find corresponding deletion
                        return this.findCorrespondingDeletion(lines, line, currentDiffLine);
                    }
                }
                else if (line.startsWith(' ')) {
                    // Context line
                    currentDiffLine++;
                    currentFileLine++;
                    if (currentFileLine === targetLine) {
                        // Return the context line without the space prefix
                        return line.substring(1);
                    }
                }
                else if (line.startsWith('-') && !line.startsWith('---')) {
                    // Deleted line - might be the original
                    currentDiffLine++;
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to extract original code for ${issue.file}:${issue.line}:`, error);
        }
        return null;
    }
    /**
     * Find corresponding deletion for an addition (for replacements)
     */
    findCorrespondingDeletion(lines, addedLine, currentIndex) {
        // Look for nearby deletions that might correspond to this addition
        const searchRange = 5; // Look within 5 lines
        for (let i = Math.max(0, currentIndex - searchRange); i < Math.min(lines.length, currentIndex + searchRange); i++) {
            const line = lines[i];
            if (line && line.startsWith('-') && !line.startsWith('---')) {
                // Return the deleted line without the minus prefix
                return line.substring(1);
            }
        }
        return null;
    }
    /**
     * Format summary comment body
     */
    async formatSummaryCommentBody(reviewResult, fileChanges, prPlan, postedComments) {
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
                logger_1.logger.warn('Failed to generate flow diagram (attempt 1):', error);
                // Retry once more
                try {
                    logger_1.logger.info('🔄 Retrying flow diagram generation...');
                    const retryFlowDiagram = await this.flowDiagramGenerator.generateFlowDiagram(fileChanges, prPlan);
                    if (retryFlowDiagram) {
                        body += `### 🔄 **Flow Diagram**\n\n`;
                        body += `<details>\n`;
                        body += `<summary><b>📊 Click to view the flow diagram for this PR</b></summary>\n\n`;
                        body += `This diagram shows the logical flow and relationships between the changes in this PR:\n\n`;
                        body += `${retryFlowDiagram}\n\n`;
                        body += `**🔍 How to read this diagram:**\n`;
                        body += `- **📦 Rectangles** \`[]\`: Components, functions, or processes being modified\n`;
                        body += `- **💭 Diamonds** \`{}\`: Decision points where the system chooses what to do next\n`;
                        body += `- **🎯 Rounded rectangles** \`()\`: Starting points or final outcomes\n`;
                        body += `- **➡️ Arrows** \`-->\`: Shows what happens next in the flow\n`;
                        body += `- **🏷️ Arrow labels** \`-->|condition|\`: Explains when a specific path is taken\n\n`;
                        body += `**💡 Pro tip:** Start from the top and follow the arrows to understand the complete user journey and business logic behind these changes.\n\n`;
                        body += `</details>\n\n`;
                    }
                }
                catch (retryError) {
                    logger_1.logger.warn('Failed to generate flow diagram (attempt 2):', retryError);
                    // Continue without diagram after retry
                }
            }
        }
        // Issues found (excluding architectural issues - they get their own comment)
        const nonArchitecturalIssues = issues.filter(issue => issue.reviewType !== 'architectural');
        if (nonArchitecturalIssues.length > 0) {
            // Show detailed issues only
            if (this.inputs.summaryFormat === 'detailed' && nonArchitecturalIssues.length <= 15) {
                body += `### 📋 **Code Issues**\n`;
                body += `*Click on each issue link below to see full details and suggestions in the inline comments.*\n\n`;
                // Show detailed issues
                logger_1.logger.debug(`Posted comments map for summary links: ${JSON.stringify(Array.from(postedComments?.entries() || []))}`);
                const detailedIssuesByCategory = this.groupIssuesByCategory(nonArchitecturalIssues);
                for (const [category, categoryIssues] of Object.entries(detailedIssuesByCategory)) {
                    if (categoryIssues.length > 0) {
                        const categoryIcon = this.getCategoryIcon(category);
                        body += `**${categoryIcon} ${this.formatCategoryName(category)} (${categoryIssues.length})**\n`;
                        for (const issue of categoryIssues) {
                            const typeIcon = this.getIssueIcon(issue.type);
                            const fileURL = this.generateGitHubFileURL(issue.file, issue.line, fileChanges, postedComments);
                            // Debug: Log what we're linking to
                            logger_1.logger.debug(`Summary link: ${issue.file}:${issue.line} -> ${fileURL}`);
                            // CONCISE: Just show file, line, and brief message with link to full details
                            body += `- ${typeIcon} **[${issue.file}:${issue.line || '?'}](${fileURL})** - ${issue.message}\n`;
                        }
                        body += '\n';
                    }
                }
            }
            else if (nonArchitecturalIssues.length > 15) {
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