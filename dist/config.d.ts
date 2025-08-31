/**
 * Configuration management for the PR Reviewer
 */
import { ActionInputs } from './types';
export declare function getActionInputs(): ActionInputs;
export declare function validateInputs(inputs: ActionInputs): void;
export declare function validateModelChoice(model: string, provider: string, inputs: ActionInputs): void;
export declare function getRecommendedModel(provider: string, reviewLevel: string): string;
export declare function getModelInfo(model: string): {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Latest GPT-4 with improved reasoning and speed";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Original GPT-4 with excellent reasoning";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Fast and cost-effective GPT-4 variant";
    readonly bestFor: readonly ["quick-reviews", "large-prs"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Enhanced GPT-4 with larger context window";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews", "large-files"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Fast and reliable for most code reviews";
    readonly bestFor: readonly ["quick-reviews", "standard-reviews"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Most capable Claude model for complex reasoning";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Balanced Claude model for comprehensive reviews";
    readonly bestFor: readonly ["detailed-reviews", "balanced-cost-quality"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Latest Claude with enhanced code understanding";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "anthropic";
    readonly tier: "standard";
    readonly description: "Fast and cost-effective Claude model";
    readonly bestFor: readonly ["quick-reviews", "large-prs"];
};
export declare const DEFAULT_MODELS: {
    readonly openai: "gpt-4o-mini";
    readonly anthropic: "claude-3-sonnet-20240229";
};
export declare const SUPPORTED_MODELS: {
    openai: string[];
    anthropic: string[];
};
export declare const MODEL_CAPABILITIES: {
    readonly 'gpt-4o': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Latest GPT-4 with improved reasoning and speed";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'gpt-4': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Original GPT-4 with excellent reasoning";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'gpt-4o-mini': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Fast and cost-effective GPT-4 variant";
        readonly bestFor: readonly ["quick-reviews", "large-prs"];
    };
    readonly 'gpt-4-turbo': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Enhanced GPT-4 with larger context window";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews", "large-files"];
    };
    readonly 'gpt-3.5-turbo': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Fast and reliable for most code reviews";
        readonly bestFor: readonly ["quick-reviews", "standard-reviews"];
    };
    readonly 'claude-3-opus-20240229': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Most capable Claude model for complex reasoning";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'claude-3-sonnet-20240229': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Balanced Claude model for comprehensive reviews";
        readonly bestFor: readonly ["detailed-reviews", "balanced-cost-quality"];
    };
    readonly 'claude-3-5-sonnet-20241022': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Latest Claude with enhanced code understanding";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'claude-3-haiku-20240307': {
        readonly provider: "anthropic";
        readonly tier: "standard";
        readonly description: "Fast and cost-effective Claude model";
        readonly bestFor: readonly ["quick-reviews", "large-prs"];
    };
};
export declare const SEVERITY_LEVELS: {
    readonly error: 4;
    readonly warning: 3;
    readonly info: 2;
    readonly all: 1;
};
export declare const COMMENT_MARKERS: {
    readonly BOT_IDENTIFIER: "<!-- cursor-ai-pr-reviewer -->";
    readonly SUMMARY_MARKER: "<!-- cursor-ai-summary -->";
    readonly INLINE_MARKER: "<!-- cursor-ai-inline -->";
};
//# sourceMappingURL=config.d.ts.map