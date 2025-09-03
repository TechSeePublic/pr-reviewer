/**
 * Base class for AI providers with shared functionality
 */

import {
  AIProvider,
  ArchitecturalReviewResult,
  CodeIssue,
  CursorRule,
  FileChange,
  PRPlan,
  ReviewContext,
} from '../types';
import { AIProviderUtils } from './utils';

export abstract class BaseAIProvider implements AIProvider {
  public abstract readonly name: string;
  public abstract readonly model: string;
  protected deterministicMode: boolean;

  constructor(deterministicMode: boolean = true) {
    this.deterministicMode = deterministicMode;
  }

  // Abstract methods that providers must implement
  abstract reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
  abstract generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
  abstract reviewBatch(
    files: FileChange[],
    rules: CursorRule[],
    prPlan: PRPlan
  ): Promise<CodeIssue[]>;
  abstract reviewArchitecture(
    fileChanges: FileChange[],
    rules: CursorRule[]
  ): Promise<ArchitecturalReviewResult>;
  abstract generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;

  // Shared utility methods
  protected parseAIResponse(response: string): CodeIssue[] {
    return AIProviderUtils.parseAIResponse(response, this.deterministicMode);
  }

  protected extractIssuesFromText(text: string): CodeIssue[] {
    return AIProviderUtils.extractIssuesFromText(text);
  }

  protected parsePRPlanResponse(response: string): PRPlan {
    return AIProviderUtils.parsePRPlanResponse(response);
  }

  protected parseArchitecturalResponse(response: string): ArchitecturalReviewResult {
    return AIProviderUtils.parseArchitecturalResponse(response);
  }

  protected assignFilesToIssues(issues: CodeIssue[], files: FileChange[]): CodeIssue[] {
    return AIProviderUtils.assignFilesToIssues(issues, files);
  }

  protected matchIssueToFile(issue: CodeIssue, files: FileChange[]): FileChange | null {
    return AIProviderUtils.matchIssueToFile(issue, files);
  }

  protected extractErrorMessage(error: unknown): string {
    return AIProviderUtils.extractErrorMessage(error);
  }
}
