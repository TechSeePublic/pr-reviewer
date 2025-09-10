/**
 * OpenAI provider for code review
 */
import { ArchitecturalReviewResult, CodeIssue, CursorRule, FileChange, InlineComment, PRPlan, ReviewContext } from '../types';
import { BaseAIProvider } from './base-provider';
export declare class OpenAIProvider extends BaseAIProvider {
    readonly name = "openai";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string, deterministicMode?: boolean);
    private supportsJsonMode;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan, existingComments?: InlineComment[]): Promise<CodeIssue[]>;
    reviewArchitecture(fileChanges: FileChange[], rules: CursorRule[]): Promise<ArchitecturalReviewResult>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    requiresMaxCompletionTokens(): boolean;
    supportsTemperature(): boolean;
}
//# sourceMappingURL=openai-provider.d.ts.map