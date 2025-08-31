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
        let prompt = `# Expert Code Review Assistant

You are a senior software engineer and expert code reviewer. Your role is to provide thorough, constructive, and actionable feedback on code changes in pull requests.

## CORE RESPONSIBILITIES

1. **Primary Focus**: Code quality - logic errors, potential bugs, and correctness
2. **Security Analysis**: Identify security vulnerabilities and unsafe practices
3. **Performance Review**: Spot performance bottlenecks and inefficiencies
4. **Best Practices**: Ensure adherence to language-specific conventions and patterns
5. **Maintainability**: Assess code readability, documentation, and future maintainability
6. **Cursor Rules Compliance**: Check violations of provided Cursor AI rules (when available)

## REVIEW PHILOSOPHY

- **Change-Focused**: Only analyze code that was actually modified in this PR
- **Constructive**: Provide specific, actionable suggestions for improvement
- **Educational**: Explain the "why" behind your recommendations
- **Balanced**: Acknowledge good practices alongside identifying issues
- **Contextual**: Consider the broader codebase context when making recommendations

## CRITICAL REVIEW GUIDELINES

### 🎯 Scope and Focus
- ONLY flag issues directly related to the code changes shown in the diff
- DO NOT comment on pre-existing code unless it's directly impacted by current changes
- Focus analysis on: added lines (+), modified lines, and directly affected logic
- Prioritize code correctness and potential bugs above all else

### 🔍 Analysis Depth
- Examine code for logical correctness and potential runtime errors
- Check for proper error handling and edge case coverage
- Verify security best practices (input validation, authentication, authorization)
- Assess performance implications of changes
- Review for proper resource management (memory leaks, connection handling)

### 💡 Feedback Quality
- Provide specific line numbers when referencing issues
- Suggest concrete improvements or alternative approaches
- Include code examples for complex fixes when helpful
- Explain the potential impact of identified issues
- Distinguish between critical errors and minor improvements

### 📝 Response Format
${jsonInstructions}

## CURSOR RULES TO CONSIDER

The following project-specific rules should be checked AFTER ensuring code correctness and quality:
`;
        // Add Cursor rules with enhanced formatting
        if (rules.length === 0) {
            prompt += '\n*No specific Cursor rules provided - apply general best practices*\n';
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
      "category": "rule_violation|bug|security|performance|best_practice|maintainability",
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

Remember: Your goal is to help developers write better, safer, more maintainable code while respecting their time and context.`;
        return prompt;
    }
    /**
     * Builds the user prompt with code context
     */
    static buildUserPrompt(context, code) {
        return `## CODE REVIEW REQUEST

${context}

## CODE TO ANALYZE

\`\`\`
${code}
\`\`\`

Please analyze this code against the Cursor rules and general best practices. Return your findings in the specified JSON format.

Focus your analysis specifically on the changes shown in the diff above, and provide actionable feedback that will help improve code quality, security, and maintainability.`;
    }
    /**
     * Builds a concise summary prompt for PR reviews
     */
    static buildSummaryPrompt(issues, context) {
        const { prContext, fileChanges, cursorRules } = context;
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;
        const suggestionCount = issues.filter(i => i.type === 'suggestion' || i.type === 'info').length;
        return `# Generate Concise PR Review Summary

## Context
- **Repository**: ${prContext.owner}/${prContext.repo}
- **PR**: #${prContext.pullNumber} (${fileChanges.length} files, ${cursorRules.projectRules.length} rules applied)
- **Issues Found**: ${issues.length} (${errorCount} errors, ${warningCount} warnings, ${suggestionCount} suggestions)

## Issues Summary
${issues.length === 0
            ? '✅ No issues found - all changes follow project rules and best practices.'
            : issues
                .map(issue => `- **${issue.type.toUpperCase()}** in \`${issue.file}\`: ${issue.message}${issue.suggestion ? ` → ${issue.suggestion}` : ''}`)
                .join('\n')}

## Instructions

Create a **SHORT** and **DIRECT** PR review summary (max 200 words) with:

1. **Status**: APPROVED / NEEDS CHANGES / REQUIRES REVIEW
2. **Quick Overview**: 1-2 sentences about overall code quality
3. **Key Issues**: List only critical/important issues (skip minor suggestions)
4. **Next Steps**: What the developer should do next

**Requirements:**
- Use bullet points and clear headings
- Be specific about file names and issues
- Skip verbose explanations - be direct
- Focus on actionable items only
- Use emoji for visual clarity (✅ ❌ ⚠️ 💡)

Keep it professional but concise. The developer should understand what to do in under 30 seconds of reading.`;
    }
    /**
     * Builds enhanced review context with better formatting
     */
    static buildReviewContext(fileChange, _fileContent) {
        let context = `## COMPLETE PR ANALYSIS REQUEST

### File Information
- **Filename**: ${fileChange.filename}
- **Change Type**: ${fileChange.status}
- **Lines Modified**: +${fileChange.additions} -${fileChange.deletions}
- **Total Changes**: ${fileChange.changes}

**NOTE**: This analysis covers ALL changes in the complete Pull Request (from base branch to current HEAD), not just the latest commit.

`;
        // Include patch information for context
        if (fileChange.patch) {
            context += `### Complete PR Changes (Focus Area)
The following diff shows ALL changes made in this entire Pull Request. Focus your analysis ONLY on these modifications:

\`\`\`diff
${fileChange.patch}
\`\`\`

`;
            // Extract and highlight changed line numbers
            const changedLines = this.extractChangedLines(fileChange.patch);
            if (changedLines.length > 0) {
                context += `### Modified Line Numbers (Full PR)
Focus analysis on lines: ${changedLines.join(', ')}

`;
            }
        }
        context += `### Analysis Instructions

**CRITICAL**: Analyze ALL changes in this complete Pull Request:
- ✅ **All lines added** across the entire PR (marked with +)
- ✅ **All lines modified** throughout the PR (context around changes)  
- ✅ **All logic directly affected** by any changes in the PR
- ❌ **Pre-existing unchanged code** (unless directly impacted by PR changes)

**Review Scope**: Complete Pull Request from base to HEAD (not just latest commit)

Look for:
1. **Logic errors** that could cause runtime issues (highest priority)
2. **Security vulnerabilities** in any new/changed code (high priority)
3. **Missing error handling** for any new code paths
4. **Performance issues** introduced by any changes
5. **Best practice violations** in any modifications
6. **Integration issues** between changes across different files
7. **Rule violations** from the provided Cursor rules (when available)

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
}
exports.PromptTemplates = PromptTemplates;
//# sourceMappingURL=prompt-templates.js.map