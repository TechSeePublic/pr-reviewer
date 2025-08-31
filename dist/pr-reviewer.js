"use strict";
/**
 * Main PR Reviewer orchestrator
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
exports.PRReviewer = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cursor_parser_1 = require("./cursor-parser");
const github_client_1 = require("./github-client");
const ai_providers_1 = require("./ai-providers");
const comment_manager_1 = require("./comment-manager");
const auto_fix_manager_1 = require("./auto-fix-manager");
const prompt_templates_1 = require("./prompt-templates");
class PRReviewer {
    constructor(inputs, workspacePath = process.cwd()) {
        this.inputs = inputs;
        this.workspacePath = workspacePath;
        // Extract PR context from GitHub context
        this.prContext = this.extractPRContext();
        // Initialize clients
        this.githubClient = new github_client_1.GitHubClient(inputs.githubToken, this.prContext, inputs.githubRateLimit);
        this.aiProvider = ai_providers_1.AIProviderFactory.create(inputs);
        this.commentManager = new comment_manager_1.CommentManager(this.githubClient, inputs, this.aiProvider);
        this.autoFixManager = new auto_fix_manager_1.AutoFixManager(this.githubClient, inputs, this.prContext, this.workspacePath);
    }
    /**
     * Main review process
     */
    async reviewPR() {
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
            // Step 4: Generate PR plan (new planner step)
            core.info('📋 Generating PR review plan...');
            const prPlan = await this.generatePRPlan(fileChanges, applicableRules);
            core.info(`Plan created: ${prPlan.overview}`);
            // Step 5: Review files in batches with PR context
            core.info('🔍 Reviewing files in batches with AI...');
            const allIssues = await this.reviewFilesInBatches(fileChanges, applicableRules, prPlan);
            // Step 6: Generate review result
            const reviewResult = await this.generateReviewResult(allIssues, fileChanges, applicableRules, cursorRules);
            // Step 7: Apply auto-fixes if enabled
            if (this.inputs.enableAutoFix) {
                core.info('🔧 Applying auto-fixes...');
                const autoFixResults = await this.autoFixManager.applyAutoFixes(allIssues, fileChanges);
                if (autoFixResults.length > 0) {
                    const appliedFixes = autoFixResults.filter(result => result.applied);
                    if (appliedFixes.length > 0) {
                        core.info(`✅ Applied ${appliedFixes.length} auto-fixes`);
                        await this.autoFixManager.commitFixes(autoFixResults);
                    }
                    else {
                        core.info('ℹ️ No auto-fixes could be applied');
                    }
                }
            }
            // Step 8: Post comments
            core.info('💬 Posting review comments...');
            await this.commentManager.postReviewComments(reviewResult, fileChanges, prPlan);
            // Step 9: Set outputs
            this.setActionOutputs(reviewResult);
            core.info(`✅ Review completed: ${reviewResult.status} (${allIssues.length} issues found)`);
            return reviewResult;
        }
        catch (error) {
            core.setFailed(`PR review failed: ${error}`);
            throw error;
        }
    }
    /**
     * Extract PR context from GitHub environment
     */
    extractPRContext() {
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
    async parseCursorRules() {
        const parser = new cursor_parser_1.CursorRulesParser(this.workspacePath);
        return await parser.parseAllRules(this.inputs.rulesPath);
    }
    /**
     * Check if review should be skipped
     */
    shouldSkipReview(cursorRules) {
        if (!this.inputs.skipIfNoRules) {
            return false;
        }
        const hasRules = cursorRules.projectRules.length > 0 || cursorRules.agentsMarkdown || cursorRules.legacyRules;
        return !hasRules;
    }
    /**
     * Filter rules that apply to the changed files
     */
    filterApplicableRules(cursorRules, fileChanges) {
        const parser = new cursor_parser_1.CursorRulesParser(this.workspacePath);
        const changedFiles = fileChanges.map(fc => fc.filename);
        return parser.filterRulesForFiles(cursorRules.projectRules, changedFiles);
    }
    /**
     * Generate PR plan by analyzing all changes
     */
    async generatePRPlan(fileChanges, rules) {
        try {
            return await this.aiProvider.generatePRPlan(fileChanges, rules);
        }
        catch (error) {
            core.warning(`Failed to generate PR plan: ${error}`);
            // Return a fallback plan
            return {
                overview: 'Unable to generate PR plan - proceeding with standard review',
                keyChanges: fileChanges.map(f => `${f.status}: ${f.filename}`),
                riskAreas: ['Review all changes carefully'],
                reviewFocus: ['Critical issues', 'Rule compliance'],
                context: 'Fallback plan due to AI provider error',
            };
        }
    }
    /**
     * Review files in batches with PR context
     */
    async reviewFilesInBatches(fileChanges, rules, prPlan) {
        const allIssues = [];
        const batches = this.createFileBatches(fileChanges);
        core.info(`Processing ${fileChanges.length} files in ${batches.length} batches (batch size: ${this.inputs.batchSize})`);
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (!batch) {
                core.warning(`Skipping undefined batch at index ${i}`);
                continue;
            }
            try {
                core.info(`Reviewing batch ${i + 1}/${batches.length} (${batch.files.length} files)`);
                // Get file contents for the batch
                const filesWithContent = await this.getFilesWithContent(batch.files);
                // Review the batch
                const batchIssues = await this.aiProvider.reviewBatch(filesWithContent, rules, prPlan);
                allIssues.push(...batchIssues);
                // Add delay between batches to respect rate limits
                if (i < batches.length - 1) {
                    const delayMs = this.inputs.requestDelay;
                    core.info(`Waiting ${delayMs}ms before next batch to avoid rate limits...`);
                    await this.delay(delayMs);
                }
            }
            catch (error) {
                // Log error but continue with other batches
                core.error(`Error reviewing batch ${i + 1}: ${error}`);
                // Fallback to single file review for this batch
                core.info(`Falling back to single-file review for batch ${i + 1}`);
                const fallbackIssues = await this.reviewBatchFallback(batch.files, rules);
                allIssues.push(...fallbackIssues);
            }
        }
        return allIssues;
    }
    /**
     * Create batches of files for processing
     */
    createFileBatches(fileChanges) {
        const batches = [];
        const batchSize = this.inputs.batchSize;
        for (let i = 0; i < fileChanges.length; i += batchSize) {
            const files = fileChanges.slice(i, i + batchSize);
            batches.push({
                files,
                batchIndex: Math.floor(i / batchSize),
                totalBatches: Math.ceil(fileChanges.length / batchSize),
            });
        }
        return batches;
    }
    /**
     * Get file contents for a batch of files
     */
    async getFilesWithContent(files) {
        const filesWithContent = [];
        for (const file of files) {
            try {
                const content = await this.getFileContent(file);
                if (content) {
                    // Add content to the file change object for batch processing
                    filesWithContent.push({
                        ...file,
                        // Store content in patch field for batch processing
                        patch: file.patch ||
                            `Content: ${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}`,
                    });
                }
                else {
                    // Include file even without content
                    filesWithContent.push(file);
                }
            }
            catch (error) {
                core.warning(`Could not get content for ${file.filename}: ${error}`);
                // Include file without content
                filesWithContent.push(file);
            }
        }
        return filesWithContent;
    }
    /**
     * Fallback to single file review when batch review fails
     */
    async reviewBatchFallback(files, rules) {
        const allIssues = [];
        for (const file of files) {
            try {
                const issues = await this.reviewSingleFile(file, rules);
                allIssues.push(...issues);
                // Small delay between single file reviews
                await this.delay(500);
            }
            catch (error) {
                core.warning(`Failed to review ${file.filename} in fallback mode: ${error}`);
            }
        }
        return allIssues;
    }
    /**
     * Review a single file
     */
    async reviewSingleFile(fileChange, rules) {
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
        const context = prompt_templates_1.PromptTemplates.buildReviewContext(fileChange, fileContent);
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
    async getFileContent(fileChange) {
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
        }
        catch (error) {
            core.warning(`Could not get content for ${fileChange.filename}: ${error}`);
            return null;
        }
    }
    /**
     * Generate comprehensive review result
     */
    async generateReviewResult(issues, fileChanges, appliedRules, cursorRules) {
        // Determine review status
        const status = this.determineReviewStatus(issues);
        // Build review context for AI summary
        const reviewContext = {
            prContext: this.prContext,
            fileChanges,
            cursorRules,
            inputs: this.inputs,
        };
        // Generate AI summary
        let summary = '';
        try {
            summary = await this.aiProvider.generateSummary(issues, reviewContext);
            // Validate summary content
            if (!summary || summary.trim().length === 0) {
                core.warning('AI summary generation returned empty content, will use fallback');
                summary = this.generateFallbackSummary(issues, fileChanges.length);
            }
        }
        catch (error) {
            // Log the error but don't fail the action - use fallback summary instead
            core.warning(`AI provider error generating summary: ${error}`);
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
     * Note: Never returns 'failed' - the PR reviewer should report issues but not fail the PR
     */
    determineReviewStatus(issues) {
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;
        const infoCount = issues.filter(i => i.type === 'info').length;
        const suggestionCount = issues.filter(i => i.type === 'suggestion').length;
        // If there are any issues (errors, warnings, info, suggestions), mark as needs_attention
        // This allows the reviewer to report all types of findings without failing the PR
        if (errorCount > 0 || warningCount > 0 || infoCount > 0 || suggestionCount > 0) {
            return 'needs_attention';
        }
        else {
            return 'passed';
        }
    }
    /**
     * Generate fallback summary if AI summary fails
     */
    generateFallbackSummary(issues, filesReviewed) {
        if (issues.length === 0) {
            return `✅ **Excellent work!** All ${filesReviewed} file${filesReviewed > 1 ? 's are' : ' is'} clean with no issues detected. The code follows best practices and appears ready for deployment.`;
        }
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;
        const infoCount = issues.filter(i => i.type === 'info' || i.type === 'suggestion').length;
        const criticalCount = issues.filter(i => i.severity === 'high').length;
        let summary = `📋 **Review Summary:** Found ${issues.length} issue${issues.length > 1 ? 's' : ''} across ${filesReviewed} file${filesReviewed > 1 ? 's' : ''}`;
        const parts = [];
        if (errorCount > 0)
            parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
        if (warningCount > 0)
            parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
        if (infoCount > 0)
            parts.push(`${infoCount} suggestion${infoCount > 1 ? 's' : ''}`);
        if (parts.length > 0) {
            summary += ` (${parts.join(', ')})`;
        }
        // Add priority assessment
        if (criticalCount > 0 || errorCount > 0) {
            summary += '. 🚨 **Action Required** - Critical issues need to be addressed before merging.';
        }
        else if (warningCount > 0) {
            summary +=
                '. ⚠️ **Review Recommended** - Consider addressing warnings for improved code quality.';
        }
        else {
            summary += '. 💡 **Optional Improvements** - All issues are informational suggestions.';
        }
        return summary;
    }
    /**
     * Create result for skipped reviews
     */
    createSkippedResult(reason) {
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
    setActionOutputs(result) {
        core.setOutput('review_summary', result.summary);
        core.setOutput('files_reviewed', result.filesReviewed.toString());
        core.setOutput('issues_found', result.issues.length.toString());
        core.setOutput('rules_applied', result.rulesApplied.length.toString());
    }
    /**
     * Extract changed line numbers from patch
     */
    extractChangedLines(patch) {
        const changedLines = [];
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
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                // Added line
                currentLine++;
                changedLines.push(currentLine);
            }
            else if (line.startsWith(' ')) {
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
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.PRReviewer = PRReviewer;
//# sourceMappingURL=pr-reviewer.js.map