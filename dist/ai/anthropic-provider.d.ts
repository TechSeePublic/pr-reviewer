/**
 * Anthropic provider for code review
 */
import { ArchitecturalReviewResult, CodeIssue, CursorRule, FileChange, PRPlan, ReviewContext } from '../types';
import { BaseAIProvider } from './base-provider';
export declare class AnthropicProvider extends BaseAIProvider {
    readonly name = "anthropic";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string, deterministicMode?: boolean);
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    reviewArchitecture(fileChanges: FileChange[], rules: CursorRule[]): Promise<ArchitecturalReviewResult>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
}
//# sourceMappingURL=anthropic-provider.d.ts.map