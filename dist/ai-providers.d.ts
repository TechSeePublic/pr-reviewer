/**
 * AI providers for code review (OpenAI and Anthropic)
 */
import { ActionInputs, AIProvider, CodeIssue, CursorRule, FileChange, PRPlan, ReviewContext } from './types';
export declare class OpenAIProvider implements AIProvider {
    readonly name = "openai";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string);
    private supportsJsonMode;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    private parseAIResponse;
    private extractIssuesFromText;
    private parsePRPlanResponse;
    requiresMaxCompletionTokens(): boolean;
    supportsTemperature(): boolean;
}
export declare class AnthropicProvider implements AIProvider {
    readonly name = "anthropic";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string);
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    private parseAIResponse;
    private extractIssuesFromText;
    private parsePRPlanResponse;
}
export declare class AzureOpenAIProvider implements AIProvider {
    readonly name = "azure";
    readonly model: string;
    private readonly realModel?;
    private client;
    constructor(apiKey: string, endpoint: string, apiVersion: string, model?: string, realModel?: string);
    private supportsJsonMode;
    requiresMaxCompletionTokens(): boolean;
    supportsTemperature(): boolean;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    private parseAIResponse;
    private extractIssuesFromText;
    private parsePRPlanResponse;
}
export declare class AIProviderFactory {
    static create(inputs: ActionInputs): AIProvider;
    static resolveProviderAndModel(inputs: ActionInputs): {
        provider: string;
        model: string;
    };
    static getAvailableProviders(inputs: ActionInputs): string[];
    static getModelRecommendations(reviewLevel: string): Record<string, string>;
}
//# sourceMappingURL=ai-providers.d.ts.map