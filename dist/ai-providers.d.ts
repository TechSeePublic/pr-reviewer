/**
 * AI providers for code review (OpenAI and Anthropic)
 */
import { ActionInputs, AIProvider, CodeIssue, CursorRule, ReviewContext } from './types';
export declare class OpenAIProvider implements AIProvider {
    readonly name = "openai";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string);
    private supportsJsonMode;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseAIResponse;
    private extractIssuesFromText;
    private buildSummaryPrompt;
}
export declare class AnthropicProvider implements AIProvider {
    readonly name = "anthropic";
    readonly model: string;
    private client;
    constructor(apiKey: string, model?: string);
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseAIResponse;
    private extractIssuesFromText;
    private buildSummaryPrompt;
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