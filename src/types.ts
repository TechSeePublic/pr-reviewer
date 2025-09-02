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
  requestDelay: number; // Delay in milliseconds between AI provider requests
  batchSize: number; // Number of files to process in each batch (default: 1)
  githubRateLimit: number; // Delay in milliseconds between GitHub API calls (default: 1000ms)
  deterministicMode: boolean; // Force deterministic behavior (temperature=0, stable parsing)
  enableArchitecturalReview: boolean; // Enable architectural review for code duplication, logical problems, and misplaced code
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
  category:
    | 'rule_violation'
    | 'bug'
    | 'security'
    | 'performance'
    | 'best_practice'
    | 'maintainability'
    | 'documentation'
    | 'architecture'
    | 'i18n'
    | 'api_design'
    | 'data_flow'
    | 'business_logic'
    | 'duplication'
    | 'misplaced_code'
    | 'logical_flow';
  message: string;
  description: string;
  suggestion?: string;
  fixedCode?: string; // Complete code fix for auto-application
  ruleId: string;
  ruleName: string;
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: 'high' | 'medium' | 'low';
  relatedFiles?: string[]; // For architectural issues that span multiple files
  reviewType?: 'architectural' | 'detailed'; // Indicates which type of review found this issue
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
  reviewArchitecture(
    fileChanges: FileChange[],
    rules: CursorRule[]
  ): Promise<ArchitecturalReviewResult>;
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

export interface ArchitecturalReviewResult {
  issues: CodeIssue[];
  duplications: DuplicationPattern[];
  logicalProblems: LogicalProblem[];
  misplacedCode: MisplacedCodeIssue[];
  summary: string;
  confidence: number;
}

export interface DuplicationPattern {
  pattern: string;
  files: string[];
  lines: number[];
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface LogicalProblem {
  description: string;
  affectedFiles: string[];
  problemType: 'flow' | 'dependency' | 'state' | 'data' | 'control';
  impact: string;
  suggestion: string;
}

export interface MisplacedCodeIssue {
  code: string;
  currentFile: string;
  currentLine: number;
  suggestedFile: string;
  reason: string;
  impact: string;
}
