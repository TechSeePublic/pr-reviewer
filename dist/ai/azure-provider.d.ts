/**
 * Azure OpenAI provider for code review
 */
import { ArchitecturalReviewResult, CodeIssue, CursorRule, FileChange, InlineComment, PRPlan, ReviewContext } from '../types';
import { BaseAIProvider } from './base-provider';
export declare class AzureOpenAIProvider extends BaseAIProvider {
    readonly name = "azure";
    readonly model: string;
    private readonly realModel?;
    private client;
    constructor(apiKey: string, endpoint: string, apiVersion: string, model?: string, realModel?: string, deterministicMode?: boolean);
    private supportsJsonMode;
    requiresMaxCompletionTokens(): boolean;
    supportsTemperature(): boolean;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan, existingComments?: InlineComment[]): Promise<CodeIssue[]>;
    reviewArchitecture(fileChanges: FileChange[], rules: CursorRule[]): Promise<ArchitecturalReviewResult>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
}
//# sourceMappingURL=azure-provider.d.ts.map