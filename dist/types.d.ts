/**
 * Core types for the TechSee AI PR Reviewer
 */
export interface ActionInputs {
    githubToken: string;
    prNumber?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
    azureOpenaiApiKey?: string;
    azureOpenaiEndpoint?: string;
    azureOpenaiApiVersion?: string;
    azureOpenaiRealModel?: string;
    aiProvider: 'openai' | 'anthropic' | 'gemini' | 'azure' | 'auto';
    model: string;
    reviewLevel: 'light' | 'standard' | 'thorough';
    rulesPath?: string;
    includePatterns: string[];
    excludePatterns: string[];
    maxFiles: number;
    commentStyle: 'inline' | 'summary' | 'both';
    inlineSeverity: 'error' | 'warning' | 'all';
    summaryFormat: 'brief' | 'detailed' | 'minimal';
    logLevel: 'error' | 'warning' | 'all';
    enableSuggestions: boolean;
    skipIfNoRules: boolean;
    updateExistingComments: boolean;
    enableAutoFix: boolean;
    autoFixSeverity: 'error' | 'warning' | 'all';
    requestDelay: number;
    batchSize: number;
    githubRateLimit: number;
    deterministicMode: boolean;
}
export interface PRContext {
    owner: string;
    repo: string;
    pullNumber: number;
    sha: string;
    baseSha: string;
}
export interface CursorRule {
    id: string;
    type: 'always' | 'auto_attached' | 'agent_requested' | 'manual';
    description?: string;
    globs?: string[];
    alwaysApply?: boolean;
    content: string;
    filePath: string;
    referencedFiles?: string[];
}
export interface CursorRulesConfig {
    projectRules: CursorRule[];
    userRules: string[];
    agentsMarkdown?: string;
    legacyRules?: string;
}
export interface FileChange {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    previousFilename?: string;
}
export interface CodeIssue {
    type: 'error' | 'warning';
    category: 'rule_violation' | 'bug' | 'security' | 'performance' | 'best_practice' | 'maintainability' | 'documentation' | 'architecture' | 'i18n' | 'api_design' | 'data_flow' | 'business_logic';
    message: string;
    description: string;
    suggestion?: string;
    fixedCode?: string;
    ruleId: string;
    ruleName: string;
    file: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    severity: 'high' | 'medium' | 'low';
}
export interface ReviewResult {
    issues: CodeIssue[];
    filesReviewed: number;
    totalFiles: number;
    rulesApplied: CursorRule[];
    summary: string;
    status: 'passed' | 'needs_attention';
}
export interface AIProvider {
    name: string;
    model: string;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
}
export interface ReviewContext {
    prContext: PRContext;
    fileChanges: FileChange[];
    cursorRules: CursorRulesConfig;
    inputs: ActionInputs;
}
export interface CommentLocation {
    file: string;
    line: number;
    side: 'RIGHT' | 'LEFT';
}
export interface InlineComment {
    id?: number;
    body: string;
    location: CommentLocation;
    issue: CodeIssue;
}
export interface SummaryComment {
    id?: number;
    body: string;
    reviewResult: ReviewResult;
}
export interface GitHubFile {
    filename: string;
    content: string;
    encoding: 'base64' | 'utf-8';
}
export interface ParsedMDCRule {
    metadata: {
        description?: string;
        globs?: string[];
        alwaysApply?: boolean;
    };
    content: string;
    referencedFiles: string[];
}
export interface AIResponse {
    issues: CodeIssue[];
    confidence: number;
    reasoning?: string;
}
export interface RateLimitInfo {
    remaining: number;
    resetTime: Date;
    limit: number;
}
export interface ActionOutputs {
    reviewSummary: string;
    filesReviewed: number;
    issuesFound: number;
    rulesApplied: number;
}
export interface AutoFixResult {
    file: string;
    issue: CodeIssue;
    applied: boolean;
    error?: string;
}
export interface CommitResult {
    sha: string;
    message: string;
    filesChanged: number;
}
export interface PRPlan {
    overview: string;
    keyChanges: string[];
    riskAreas: string[];
    reviewFocus: string[];
    dependencies?: {
        affectedFiles?: string[];
        externalAPIs?: string[];
        databaseChanges?: string;
        configurationChanges?: string;
    };
    businessImpact?: {
        userFacing?: string;
        dataImpact?: string;
        performanceImpact?: string;
        securityImplications?: string;
    };
    testing?: {
        requiredTests?: string[];
        testCoverage?: string;
        regressionRisk?: string;
    };
    context: string;
}
export interface FileBatch {
    files: FileChange[];
    batchIndex: number;
    totalBatches: number;
}
//# sourceMappingURL=types.d.ts.map