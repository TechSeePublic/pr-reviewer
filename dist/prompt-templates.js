"use strict";
/**
 * Unified prompt templates for AI code review
 * This module provides consistent, high-quality prompts that work across all AI providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplates = void 0;
class PromptTemplates {
    /**
     * Builds a comprehensive system prompt for code review
     */
    static buildCodeReviewSystemPrompt(rules, config) {
        const jsonInstructions = config.supportsJsonMode
            ? 'Return your response as a valid JSON object only.'
            : 'Return your response as a valid JSON object only. Start your response with { and end with }.';
        let prompt = `# Code Review Assistant

You are a code reviewer focused on identifying critical issues. Your role is to find actual problems that could cause failures or security issues.

## CORE RESPONSIBILITIES

1. **Primary Focus**: Logic errors, potential bugs, and correctness issues
2. **Security Analysis**: Identify security vulnerabilities and unsafe practices
3. **Performance Issues**: Spot critical performance problems
4. **Documentation Quality**: Check for typos, spelling errors, and grammar issues - THESE ARE CRITICAL for code quality and user experience
5. **Cursor Rules Compliance**: Check violations of provided Cursor AI rules (when available)

## REVIEW PHILOSOPHY

- **Change-Focused**: Only analyze code that was actually modified in this PR
- **Critical Issues Only**: Focus on bugs, security issues, typos, and rule violations
- **Concise**: Keep feedback brief and to the point
- **Actionable**: Only report issues that need to be fixed

## CRITICAL REVIEW GUIDELINES

### 🎯 Scope and Focus
- ONLY flag issues directly related to the code changes shown in the diff
- DO NOT comment on pre-existing code unless it's directly impacted by current changes
- Focus analysis on: added lines (+), modified lines, and directly affected logic
- Prioritize code correctness and potential bugs above all else

### 🔍 Analysis Depth
- Examine code for logical correctness and potential runtime errors
- Check for proper error handling and edge case coverage
- Identify security vulnerabilities (input validation, authentication, authorization)
- Spot critical performance problems
- Review for resource management issues (memory leaks, connection handling)
- **CRITICAL**: Check documentation quality - typos, spelling errors, and grammar issues in comments, string literals, documentation files, and code identifiers (these impact user experience and code maintainability)

### 💡 Feedback Quality
- Provide specific line numbers when referencing issues
- Focus on critical issues that need fixing
- Explain the potential impact of identified issues
- Skip minor style or preference issues

### 📝 Response Format
${jsonInstructions}

## CURSOR RULES TO CONSIDER

The following project-specific rules should be checked AFTER ensuring code correctness and quality:
`;
        // Add Cursor rules with enhanced formatting
        if (rules.length === 0) {
            prompt += '\n*No specific Cursor rules provided - focus on critical issues only*\n';
        }
        else {
            rules.forEach((rule, index) => {
                prompt += `\n### Rule ${index + 1}: "${rule.id}" (${rule.type.toUpperCase()})`;
                if (rule.description) {
                    prompt += `\n**Purpose**: ${rule.description}`;
                }
                prompt += `\n**Content**: ${rule.content}`;
                if (rule.globs && rule.globs.length > 0) {
                    prompt += `\n**Applies to**: ${rule.globs.join(', ')}`;
                }
                if (rule.alwaysApply) {
                    prompt += `\n**Always Apply**: Yes`;
                }
                prompt += '\n';
            });
        }
        prompt += `
## REQUIRED JSON RESPONSE STRUCTURE

Your response MUST be a valid JSON object with this exact structure:

\`\`\`json
{
  "issues": [
    {
      "type": "error|warning|info|suggestion",
      "category": "rule_violation|bug|security|performance|best_practice|maintainability|documentation",
      "message": "Brief, clear description of the issue (50-80 chars)",
      "description": "Detailed explanation of the problem and its impact",
      "suggestion": "Specific, actionable fix suggestion (optional)",
      "fixedCode": "Complete corrected code snippet for auto-fix (optional)",
      "ruleId": "cursor_rule_id or 'general_review'",
      "ruleName": "Human-readable rule name or issue category",
      "file": "filename from context",
      "line": 0,
      "severity": "high|medium|low"
    }
  ],
  "confidence": 0.95,
  "reasoning": "Brief explanation of your analysis approach and confidence level"
}
\`\`\`

## ISSUE CLASSIFICATION GUIDE

### Issue Types
- **error**: Critical issues that will cause runtime failures or security vulnerabilities
- **warning**: Important issues that could lead to bugs or poor performance
- **info**: Minor improvements or style suggestions
- **suggestion**: Optional enhancements that would improve code quality

### Categories
- **bug**: Logic errors or potential runtime failures (highest priority)
- **security**: Security vulnerabilities or unsafe practices (high priority)
- **documentation**: Typos, spelling errors, grammar issues - CRITICAL for user experience and code quality
- **performance**: Performance bottlenecks or inefficiencies
- **best_practice**: Violations of language/framework conventions
- **maintainability**: Issues affecting code readability or future maintenance
- **rule_violation**: Direct violation of a provided Cursor rule

### Severity Levels
- **high**: Critical issues requiring immediate attention
- **medium**: Important issues that should be addressed
- **low**: Minor improvements or style preferences

## QUALITY STANDARDS

- Provide line numbers for all issues when available
- Keep messages concise but descriptive
- Make suggestions specific and actionable
- Include code examples only when they add significant value
- Balance thoroughness with conciseness
- Focus on the most impactful improvements

## TYPO AND DOCUMENTATION REVIEW GUIDELINES - CRITICAL PRIORITY

Typos are CRITICAL issues that impact user experience, code maintainability, and professional quality. 
When checking for documentation quality issues, pay close attention to:

**Comments & Documentation:**
- Spelling errors in code comments
- Grammar mistakes in multi-sentence comments
- Typos in JSDoc/documentation comments
- Inconsistent terminology or naming

**String Literals & Messages:**
- User-facing error messages with typos
- Log messages with spelling errors
- API response messages
- Console output text

**Code Identifiers:**
- Variable names with spelling errors (e.g., \`usreName\` should be \`userName\`)
- Function names with typos (e.g., \`calcualteTotal\` should be \`calculateTotal\`)
- Class names with spelling mistakes (e.g., \`UserManger\` should be \`UserManager\`)
- Method names, property names, and other identifiers
- Common typos: missing letters, transposed letters, wrong words
- Obvious misspellings in technical terms (e.g., \`conection\` vs \`connection\`, \`lenght\` vs \`length\`)
- Watch for: receive/recieve, separate/seperate, definitely/definately, initialize/intialize

**Classification for Typos:**
- Use \`type: "error"\` for typos in user-facing text, API responses, or critical identifiers
- Use \`type: "warning"\` for typos in code identifiers, comments, and documentation
- Use \`type: "info"\` only for very minor naming style improvements
- Use \`category: "documentation"\` for all typo-related issues
- Use \`severity: "high"\` for user-facing text typos, \`"medium"\` for code identifiers, \`"low"\` for comments only

Remember: Your goal is to help developers write better, safer, more maintainable code while respecting their time and context.`;
        return prompt;
    }
    /**
     * Builds the user prompt with code context
     */
    static buildUserPrompt(context, code) {
        return `${context}

## COMPLETE FILE CONTENT (For Context)

\`\`\`
${code}
\`\`\`

## ANALYSIS REQUEST

Please analyze this file, focusing ONLY on the changes shown in the diff above. 

**Remember**: 
- The complete file content above is for CONTEXT to understand the changes
- Only review the specific lines that were ADDED/MODIFIED in the diff
- Report critical issues: bugs, security problems, performance issues, or rule violations
- Return findings in the specified JSON format

**Focus your analysis on the changed areas, use the complete file for understanding context.**`;
    }
    /**
     * Builds a concise summary prompt for PR reviews
     */
    static buildSummaryPrompt(issues, context) {
        const { prContext, fileChanges, cursorRules } = context;
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;
        return `# Generate Concise PR Review Summary

## Context
- **Repository**: ${prContext.owner}/${prContext.repo}
- **PR**: #${prContext.pullNumber} (${fileChanges.length} files, ${cursorRules.projectRules.length} rules applied)
- **Issues Found**: ${issues.length} (${errorCount} errors, ${warningCount} warnings)

## Issues Summary
${issues.length === 0
            ? '✅ No issues found - all changes are clean.'
            : issues
                .map(issue => `- **${issue.type.toUpperCase()}** in \`${issue.file}\`: ${issue.message}`)
                .join('\n')}

## Instructions

Create a **SHORT** and **DIRECT** PR review summary (max 150 words) with:

1. **Status**: APPROVED / NEEDS CHANGES / REQUIRES REVIEW
2. **Critical Issues**: List only errors and warnings that must be fixed
3. **Next Steps**: What the developer should do next

**Requirements:**
- Use bullet points and clear headings
- Be specific about file names and issues
- Skip verbose explanations - be direct
- Focus only on issues that need fixing
- Use emoji for visual clarity (✅ ❌ ⚠️)

Keep it professional and concise. Only report actual problems.`;
    }
    /**
     * Builds enhanced review context with better formatting
     */
    static buildReviewContext(fileChange, _fileContent) {
        let context = `## CODE REVIEW REQUEST

### File Information
- **Filename**: ${fileChange.filename}
- **Status**: ${fileChange.status}
- **Changes**: +${fileChange.additions} -${fileChange.deletions} (${fileChange.changes} total)

**IMPORTANT**: You will receive the COMPLETE FILE CONTENT below for context, but only review the specific changes shown in the diff.

`;
        // Include patch information for context
        if (fileChange.patch) {
            context += `### What Changed (Review These Areas Only)
The following diff shows EXACTLY what was modified. Focus your analysis ONLY on these changes:

\`\`\`diff
${fileChange.patch}
\`\`\`

`;
            // Extract and highlight changed line numbers
            const changedLines = this.extractChangedLines(fileChange.patch);
            if (changedLines.length > 0) {
                context += `### Changed Lines to Review
**Focus analysis on lines**: ${changedLines.join(', ')}

`;
            }
        }
        context += `### Review Guidelines

**WHAT TO ANALYZE**:
- ✅ **Added lines** (marked with + in diff)
- ✅ **Modified lines** and their immediate context
- ✅ **Logic affected** by the changes
- ❌ **Unchanged pre-existing code** (unless directly impacted)

**WHAT TO LOOK FOR**:
1. **Logic Errors** - Bugs that could cause runtime failures  
2. **Security Issues** - Vulnerabilities in new/changed code
3. **Missing Error Handling** - New code paths without proper error handling
4. **Performance Problems** - Inefficient code introduced by changes
5. **Integration Issues** - How changes affect other parts of the system
6. **Documentation Quality** - Typos, spelling errors, and grammar issues in:
   - Code comments (// and /* */ comments)
   - String literals and messages
   - Documentation files (.md, .txt, etc.)
   - Variable names, function names, class names, and other identifiers
7. **Rule Violations** - Violations of provided Cursor rules

**CONTEXT**: The complete file content below provides context to understand the changes, but focus your review only on the modified areas shown in the diff above.

`;
        return context;
    }
    /**
     * Extract changed line numbers from patch (helper method)
     */
    static extractChangedLines(patch) {
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
     * Build PR plan prompt for analyzing overall changes
     */
    static buildPRPlanPrompt(fileChanges, rules) {
        let prompt = `# PR Analysis Request

You are analyzing a pull request to create a comprehensive review plan. Please analyze the overall changes and provide strategic insights.

## Files Changed (${fileChanges.length} files):

`;
        fileChanges.forEach((file, index) => {
            prompt += `### ${index + 1}. ${file.filename} (${file.status})
- **Changes**: +${file.additions} -${file.deletions} (${file.changes} total)
`;
            if (file.patch) {
                // Show a summary of the patch, not the full content to save tokens
                const lines = file.patch.split('\n');
                const significantLines = lines
                    .filter(line => line.startsWith('@@') ||
                    (line.startsWith('+') && !line.startsWith('+++')) ||
                    (line.startsWith('-') && !line.startsWith('---')))
                    .slice(0, 10); // Limit to first 10 significant lines
                prompt += `- **Key Changes Preview**:\n`;
                significantLines.forEach(line => {
                    prompt += `  ${line}\n`;
                });
                if (lines.length > significantLines.length) {
                    prompt += `  ... (${lines.length - significantLines.length} more lines)\n`;
                }
            }
            prompt += '\n';
        });
        if (rules.length > 0) {
            prompt += `## Project Rules to Consider (${rules.length} rules):

`;
            rules.forEach((rule, index) => {
                prompt += `### Rule ${index + 1}: ${rule.id}
- **Type**: ${rule.type}
- **Description**: ${rule.description || 'No description'}
- **Applies to**: ${rule.globs?.join(', ') || 'All files'}

`;
            });
        }
        prompt += `## Required Analysis

Please provide a JSON response with the following structure:

\`\`\`json
{
  "overview": "High-level summary of what this PR accomplishes",
  "keyChanges": [
    "List of the most important changes",
    "Focus on functional changes, new features, bug fixes",
    "Architectural or design pattern changes"
  ],
  "riskAreas": [
    "Areas that need careful review",
    "Potential breaking changes",
    "Security-sensitive modifications",
    "Performance-critical changes"
  ],
  "reviewFocus": [
    "Specific aspects reviewers should focus on",
    "Code quality concerns to check",
    "Integration points to verify"
  ],
  "context": "Additional context about the PR's purpose and scope"
}
\`\`\`

Focus on understanding the **intent** and **impact** of these changes rather than line-by-line details.`;
        return prompt;
    }
    /**
     * Build batch review prompt for multiple files with PR context
     */
    static buildBatchReviewPrompt(files, rules, prPlan) {
        let prompt = `# Batch Code Review Request

## PR Context
**Overview**: ${prPlan.overview}

**Key Changes**: ${prPlan.keyChanges.join(', ')}

**Risk Areas**: ${prPlan.riskAreas.join(', ')}

**Review Focus**: ${prPlan.reviewFocus.join(', ')}

**Additional Context**: ${prPlan.context}

## Files to Review (${files.length} files):

`;
        files.forEach((file, index) => {
            prompt += `### File ${index + 1}: ${file.filename}
**Status**: ${file.status} | **Changes**: +${file.additions} -${file.deletions}

`;
            if (file.patch) {
                prompt += `**Code Changes**:
\`\`\`diff
${file.patch}
\`\`\`

`;
            }
        });
        prompt += `## Review Instructions

Given the PR context above, please review these ${files.length} files as a cohesive unit. Focus on:

1. **Consistency** - Do the changes work together logically?
2. **Completeness** - Are there missing pieces or incomplete implementations?
3. **Integration** - How do these files interact with each other?
4. **PR Goals** - Do the changes achieve the stated objectives?

Apply the same JSON response format as single-file reviews, but consider the **collective impact** of all files together.

Look for:
- Cross-file dependencies and interactions
- Inconsistent patterns across files
- Missing error handling or edge cases
- Security implications of the combined changes
- Performance impact of the overall feature/fix

Remember: You're reviewing the changes as they relate to the overall PR goals, not just individual file quality.`;
        return prompt;
    }
}
exports.PromptTemplates = PromptTemplates;
//# sourceMappingURL=prompt-templates.js.map