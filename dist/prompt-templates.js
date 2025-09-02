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

You are a professional code reviewer.

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
- **Logic Correctness**: Examine code for logical errors, off-by-one errors, incorrect conditionals, and potential runtime failures
- **Error Handling**: Check for proper try-catch blocks, error propagation, meaningful error messages, and graceful degradation
- **Edge Cases**: Verify handling of null/undefined values, empty arrays/objects, boundary conditions, and exceptional scenarios
- **Security Vulnerabilities**: Identify input validation issues, authentication bypasses, authorization problems, XSS/SQL injection risks
- **Performance Problems**: Spot inefficient algorithms, unnecessary computations, blocking operations, and resource-intensive operations
- **Resource Management**: Review for memory leaks, unclosed files/connections, event listener cleanup, and proper disposal patterns
- **Data Integrity**: Check for race conditions, concurrent access issues, data validation, and consistency requirements
- **API Contracts**: Verify interface compliance, parameter validation, return type consistency, and backward compatibility
- **State Management**: Review state mutations, side effects, pure function violations, and state synchronization
- **Dependencies**: Check for circular imports, unused dependencies, version conflicts, and security vulnerabilities in packages
- **Configuration**: Verify environment-specific settings, feature flags, and deployment configurations
- **Backwards Compatibility**: Identify breaking changes that could affect existing code or APIs
- **Cross-cutting Concerns**: Review logging, monitoring, caching, and other system-wide concerns
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
      "file": "EXACT filename from context - NEVER use 'unknown' or 'Multiple Files'",
      "line": 0,
      "severity": "high|medium|low"
    }
  ],
  "confidence": 0.95,
  "reasoning": "Brief explanation of your analysis approach and confidence level"
}
\`\`\`

**CRITICAL**: The "file" field must ALWAYS contain the exact filename where the issue is found. Never use generic terms like "unknown", "Multiple Files", or "various files". If reviewing multiple files, specify the exact file for each individual issue.

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
- **architecture**: Design problems, coupling issues, separation of concerns
- **i18n**: Internationalization issues, hard-coded strings, locale problems
- **api_design**: Inconsistent interfaces, breaking changes, poor API design
- **data_flow**: Data handling issues, state management problems
- **business_logic**: Domain rule violations, requirement mismatches

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

Remember: Your goal is to help developers write better, safer, more maintainable code while respecting their time and context.

## COMPREHENSIVE ISSUE DETECTION GUIDELINES

### 🏗️ Architecture & Design Issues
**Look for structural problems that affect system design:**
- **Tight Coupling**: Classes or modules that are too dependent on each other
- **Single Responsibility Violations**: Classes/functions doing too many things
- **Dependency Inversion**: High-level modules depending on low-level modules
- **Circular Dependencies**: Import cycles between modules
- **God Objects**: Classes that know/do too much
- **Feature Envy**: Methods that use another class's data more than their own
- **Data Clumps**: Groups of data that appear together repeatedly



### 🌍 Internationalization & Localization Issues
**Identify i18n problems:**
- **Hard-coded Strings**: User-facing text not externalized
- **Date/Time Formatting**: Not using locale-appropriate formats
- **Number Formatting**: Currency, decimals not localized
- **Text Expansion**: UI layouts that won't accommodate longer translated text
- **RTL Support**: Right-to-left language considerations
- **Character Encoding**: UTF-8 and Unicode handling issues

### 🔌 API Design & Interface Issues
**Review API consistency and design:**
- **Inconsistent Naming**: Mixed conventions (camelCase vs snake_case)
- **Breaking Changes**: Modifications that break existing consumers
- **Missing Validation**: API endpoints without proper input validation
- **Poor Error Responses**: Unclear or inconsistent error messages
- **Versioning Issues**: API changes without proper versioning
- **REST Violations**: Non-RESTful API patterns
- **Missing Documentation**: API changes without updated docs

### 🌊 Data Flow & State Management Issues
**Analyze how data moves through the system:**
- **Race Conditions**: Async operations that can interfere with each other
- **State Mutations**: Direct modifications of immutable state
- **Side Effects**: Functions that modify external state unexpectedly
- **Data Consistency**: Inconsistent data representations across components
- **Memory Leaks**: Event listeners or subscriptions not cleaned up
- **Stale Closures**: Outdated values captured in closures
- **Props Drilling**: Data passed through many component levels unnecessarily

### 💼 Business Logic & Domain Issues
**Verify business rules and domain logic:**
- **Invalid Business Rules**: Logic that doesn't match business requirements
- **Missing Validation**: Business rule constraints not enforced
- **Edge Case Handling**: Missing handling for boundary conditions
- **Data Integrity**: Operations that could corrupt data
- **Workflow Violations**: Steps executed in wrong order
- **Permission Checks**: Missing authorization for sensitive operations
- **Audit Trail**: Missing logging for important business operations

### ⚡ Advanced Performance Issues
**Beyond basic performance, look for:**
- **N+1 Queries**: Database queries in loops
- **Unnecessary Re-renders**: React components rendering without changes
- **Memory Allocation**: Excessive object creation in hot paths
- **Bundle Size**: Large dependencies for small functionality
- **Lazy Loading**: Missing code splitting opportunities
- **Caching**: Missing or incorrect caching strategies
- **Resource Cleanup**: Files, connections, or resources not properly closed

### 🔒 Advanced Security Issues
**Beyond basic security, check for:**
- **Information Disclosure**: Sensitive data in logs or error messages
- **Time-based Attacks**: Operations vulnerable to timing analysis
- **CSRF Protection**: Missing cross-site request forgery protection
- **CORS Misconfiguration**: Overly permissive CORS settings
- **Dependency Vulnerabilities**: Known vulnerable dependencies
- **Secrets Management**: API keys or passwords in code
- **Session Management**: Insecure session handling

### 📱 Language & Framework Specific Issues

**For TypeScript/JavaScript:**
- **Type Safety**: Using 'any' type, missing type definitions
- **Async/Await**: Improper error handling in async functions
- **Promise Chains**: Unhandled promise rejections
- **Hoisting Issues**: Variable hoisting problems
- **This Binding**: Incorrect 'this' context handling
- **Module Imports**: Inefficient or incorrect import patterns

**For React:**
- **Hook Rules**: Violating rules of hooks (conditional calls, wrong order)
- **Key Props**: Missing or non-unique keys in lists
- **State Updates**: Direct state mutations, incorrect useState usage
- **Effect Dependencies**: Missing or incorrect useEffect dependencies
- **Component Lifecycle**: Improper lifecycle method usage
- **Context Overuse**: Excessive prop drilling or context provider nesting

**For Node.js:**
- **Stream Handling**: Improper stream management
- **Event Emitter**: Memory leaks from event listeners
- **Buffer Usage**: Unsafe buffer operations
- **Path Manipulation**: Directory traversal vulnerabilities
- **Process Management**: Improper child process handling

### 🔍 Context-Aware Analysis

**Analyze changes in relation to the broader codebase:**
- **Breaking Changes**: How do changes affect existing code?
- **Integration Points**: Do changes maintain API contracts?
- **Configuration**: Are environment-specific changes properly handled?
- **Migration Path**: Are there database or data migration needs?
- **Rollback Strategy**: Can changes be safely reverted?
- **Feature Flags**: Should new features be behind feature toggles?

Remember: Your goal is to help developers write better, safer, more maintainable code while respecting their time and context.`;
        return prompt;
    }
    /**
     * Get language-specific analysis guidelines
     */
    static getLanguageSpecificGuidelines(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts':
            case 'tsx':
                return `
**TypeScript/React Specific Guidelines:**
- **Type Safety**: Flag use of 'any' type, missing type definitions, unsafe type assertions
- **Hook Rules**: Check for hook calls in conditionals, loops, or nested functions
- **Component Patterns**: Verify proper prop types, state management, effect dependencies
- **Async Patterns**: Check for proper error handling in async/await, unhandled promises
- **Import Organization**: Review import efficiency, circular dependencies, unused imports
- **Interface Design**: Check for consistent interface definitions, proper generic usage`;
            case 'js':
            case 'jsx':
                return `
**JavaScript/React Specific Guidelines:**
- **Type Coercion**: Watch for loose equality (==), implicit conversions, truthiness issues
- **Hoisting**: Check for variable/function hoisting problems, temporal dead zones
- **This Binding**: Verify correct 'this' context in functions, arrow function usage
- **Promise Handling**: Check for proper error handling, avoiding callback hell
- **ES6+ Features**: Review proper use of destructuring, spread operator, template literals`;
            case 'py':
                return `
**Python Specific Guidelines:**
- **Exception Handling**: Check for bare except clauses, proper exception types
- **Iterator Usage**: Review generator usage, list comprehensions, iterator protocol
- **Context Managers**: Verify proper use of 'with' statements for resource management
- **Type Hints**: Check for missing type annotations in function signatures
- **Performance**: Watch for inefficient loops, unnecessary list copies, string concatenation`;
            case 'java':
                return `
**Java Specific Guidelines:**
- **Resource Management**: Check for proper try-with-resources usage, stream cleanup
- **Exception Handling**: Review exception hierarchy, checked vs unchecked exceptions
- **Concurrency**: Check for thread safety, proper synchronization, volatile usage
- **Memory Management**: Watch for memory leaks, proper object lifecycle management
- **Generics**: Review proper generic usage, type erasure considerations`;
            case 'go':
                return `
**Go Specific Guidelines:**
- **Error Handling**: Check for ignored errors, proper error wrapping, panic usage
- **Goroutines**: Review proper goroutine usage, channel operations, select statements
- **Interface Design**: Check for proper interface definitions, empty interface usage
- **Resource Management**: Verify proper defer usage, connection cleanup
- **Performance**: Watch for unnecessary allocations, string building, slice usage`;
            case 'rs':
                return `
**Rust Specific Guidelines:**
- **Ownership**: Check for proper ownership transfer, borrowing rules, lifetime annotations
- **Error Handling**: Review Result/Option usage, proper error propagation with ?
- **Memory Safety**: Verify unsafe code blocks, proper memory management
- **Concurrency**: Check for thread safety, proper Arc/Mutex usage, async patterns
- **Performance**: Watch for unnecessary clones, zero-cost abstractions`;
            default:
                return `
**General Code Guidelines:**
- **Language Conventions**: Follow established patterns and idioms for this language
- **Error Handling**: Implement proper error handling patterns for this language
- **Resource Management**: Ensure proper cleanup of resources (files, connections, memory)
- **Performance**: Use language-appropriate optimization techniques
- **Security**: Apply language-specific security best practices`;
        }
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
1. **Logic Errors** - Bugs that could cause runtime failures, off-by-one errors, incorrect conditionals
2. **Security Issues** - Vulnerabilities in new/changed code, input validation, auth bypasses
3. **Missing Error Handling** - New code paths without proper error handling, unhandled promises
4. **Performance Problems** - Inefficient algorithms, unnecessary computations, blocking operations
5. **Integration Issues** - How changes affect other parts of the system, breaking changes
6. **Architecture Issues** - Design problems, tight coupling, single responsibility violations
7. **Data Flow Problems** - Race conditions, state mutations, memory leaks, side effects
8. **API Design Issues** - Inconsistent interfaces, poor error responses, breaking changes
9. **Business Logic Issues** - Domain rule violations, missing validation, edge case handling
10. **Documentation Quality** - Typos, spelling errors, and grammar issues in:
    - Code comments (// and /* */ comments)
    - String literals and messages
    - Documentation files (.md, .txt, etc.)
    - Variable names, function names, class names, and other identifiers
11. **Internationalization Issues** - Hard-coded strings, locale problems, encoding issues
12. **Rule Violations** - Violations of provided Cursor rules

${this.getLanguageSpecificGuidelines(fileChange.filename)}

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

Please provide a comprehensive JSON response with the following structure:

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
    "Performance-critical changes",
    "Cross-file dependencies that could be affected",
    "Database or data migration requirements"
  ],
  "reviewFocus": [
    "Specific aspects reviewers should focus on",
    "Code quality concerns to check",
    "Integration points to verify",
    "Business logic validation needs",
    "Testing coverage requirements"
  ],
  "dependencies": {
    "affectedFiles": ["List of files that might be impacted by these changes"],
    "externalAPIs": ["Any external APIs or services that might be affected"],
    "databaseChanges": "Description of any database schema or data changes",
    "configurationChanges": "Any configuration or environment variable changes"
  },
  "businessImpact": {
    "userFacing": "Whether changes affect user experience",
    "dataImpact": "Any impact on data integrity or migrations",
    "performanceImpact": "Expected performance implications",
    "securityImplications": "Security considerations for these changes"
  },
  "testing": {
    "requiredTests": ["Types of tests that should be added or updated"],
    "testCoverage": "Assessment of current test coverage for changed areas",
    "regressionRisk": "Areas where regression testing is most important"
  },
  "context": "Additional context about the PR's purpose and scope"
}
\`\`\`

Focus on understanding the **intent**, **impact**, and **broader system implications** of these changes rather than line-by-line details.`;
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

${prPlan.dependencies
            ? `
**Dependencies & Impact**:
- **Affected Files**: ${prPlan.dependencies.affectedFiles?.join(', ') || 'None identified'}
- **External APIs**: ${prPlan.dependencies.externalAPIs?.join(', ') || 'None affected'}
- **Database Changes**: ${prPlan.dependencies.databaseChanges || 'None'}
- **Configuration**: ${prPlan.dependencies.configurationChanges || 'None'}
`
            : ''}

${prPlan.businessImpact
            ? `
**Business Impact Assessment**:
- **User-Facing**: ${prPlan.businessImpact.userFacing || 'No direct user impact'}
- **Data Impact**: ${prPlan.businessImpact.dataImpact || 'No data impact'}
- **Performance**: ${prPlan.businessImpact.performanceImpact || 'No performance impact expected'}
- **Security**: ${prPlan.businessImpact.securityImplications || 'No security implications'}
`
            : ''}

${prPlan.testing
            ? `
**Testing Considerations**:
- **Required Tests**: ${prPlan.testing.requiredTests?.join(', ') || 'Standard testing'}
- **Coverage Assessment**: ${prPlan.testing.testCoverage || 'Not assessed'}
- **Regression Risk**: ${prPlan.testing.regressionRisk || 'Low risk'}
`
            : ''}

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

## CRITICAL: File Assignment Requirements

For EVERY issue you identify, you MUST specify the exact filename where the issue occurs. Use the complete filename exactly as shown above:

${files.map((f) => `- "${f.filename}"`).join('\n')}

**NEVER use generic terms like "Multiple Files" or "unknown". Always specify the exact file where each issue is found.**

Apply the same JSON response format as single-file reviews, but consider the **collective impact** of all files together.

Look for:
- Cross-file dependencies and interactions
- Inconsistent patterns across files
- Missing error handling or edge cases
- Security implications of the combined changes
- Performance impact of the overall feature/fix

Remember: You're reviewing the changes as they relate to the overall PR goals, not just individual file quality.

**Final Reminder**: In your JSON response, ensure every issue has a "file" property set to one of the exact filenames listed above.`;
        return prompt;
    }
}
exports.PromptTemplates = PromptTemplates;
//# sourceMappingURL=prompt-templates.js.map