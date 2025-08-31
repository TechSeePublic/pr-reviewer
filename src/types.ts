/**
 * Core types for the Cursor AI PR Reviewer
 */

export interface ActionInputs {
  githubToken: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  aiProvider: 'openai' | 'anthropic' | 'gemini' | 'auto';
  model: string;
  reviewLevel: 'light' | 'standard' | 'thorough';
  rulesPath?: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxFiles: number;
  commentStyle: 'inline' | 'summary' | 'both';
  inlineSeverity: 'error' | 'warning' | 'info' | 'all';
  summaryFormat: 'brief' | 'detailed' | 'minimal';
  enableSuggestions: boolean;
  skipIfNoRules: boolean;
  updateExistingComments: boolean;
  enableAutoFix: boolean;
  autoFixSeverity: 'error' | 'warning' | 'info' | 'all';
  requestDelay: number; // Delay in milliseconds between AI provider requests
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
  type: 'error' | 'warning' | 'info' | 'suggestion';
  category: 'rule_violation' | 'bug' | 'security' | 'performance' | 'best_practice';
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
