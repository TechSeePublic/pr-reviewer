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
    readonly description: "Latest multimodal model with advanced reasoning and 200K context";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews", "multimodal-tasks"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Cost-effective GPT-5 variant with excellent performance";
    readonly bestFor: readonly ["standard-reviews", "balanced-cost-quality"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Optimized for speed and low-latency requirements";
    readonly bestFor: readonly ["quick-reviews", "real-time-analysis"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Tailored for advanced, natural, and context-aware conversations";
    readonly bestFor: readonly ["interactive-reviews", "conversational-analysis"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Advanced reasoning model excelling in coding, math, and science";
    readonly bestFor: readonly ["complex-reasoning", "scientific-code-analysis", "mathematical-logic"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Efficient reasoning model for real-time applications";
    readonly bestFor: readonly ["quick-reasoning", "agentic-solutions"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Enhanced GPT-4 with 1M token context and improved intent understanding";
    readonly bestFor: readonly ["large-codebases", "creative-tasks", "agentic-planning"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Balanced GPT-4.1 variant with performance and efficiency";
    readonly bestFor: readonly ["standard-reviews", "medium-complexity-tasks"];
} | {
    readonly provider: "openai";
    readonly tier: "standard";
    readonly description: "Cost-efficient GPT-4.1 for lower resource consumption";
    readonly bestFor: readonly ["cost-sensitive-reviews", "lightweight-analysis"];
} | {
    readonly provider: "openai";
    readonly tier: "premium";
    readonly description: "Previous generation GPT-4 with improved reasoning";
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
    readonly description: "Most advanced Claude model with Level 3 safety classification";
    readonly bestFor: readonly ["complex-reasoning", "advanced-code-analysis", "high-risk-tasks"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Enhanced Claude 4 with superior coding and reasoning abilities";
    readonly bestFor: readonly ["code-generation", "detailed-reviews", "complex-analysis"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Previous generation Claude with enhanced code understanding";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Previous most capable Claude model for complex reasoning";
    readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
} | {
    readonly provider: "anthropic";
    readonly tier: "premium";
    readonly description: "Balanced Claude 3 model for comprehensive reviews";
    readonly bestFor: readonly ["detailed-reviews", "balanced-cost-quality"];
} | {
    readonly provider: "anthropic";
    readonly tier: "standard";
    readonly description: "Fast and cost-effective Claude 3 model";
    readonly bestFor: readonly ["quick-reviews", "large-prs"];
} | {
    readonly provider: "azure";
    readonly tier: "premium";
    readonly description: "xAI Grok 3 for real-time conversational AI and reasoning";
    readonly bestFor: readonly ["conversational-analysis", "real-time-reviews"];
} | {
    readonly provider: "azure";
    readonly tier: "standard";
    readonly description: "Efficient Grok 3 variant for cost-effective reasoning";
    readonly bestFor: readonly ["quick-reviews", "cost-effective-analysis"];
} | {
    readonly provider: "azure";
    readonly tier: "premium";
    readonly description: "Advanced reasoning model approaching o3 performance";
    readonly bestFor: readonly ["deep-reasoning", "research-applications", "intelligent-agents"];
} | {
    readonly provider: "azure";
    readonly tier: "standard";
    readonly description: "Lightweight coding assistant for embedded scenarios";
    readonly bestFor: readonly ["code-generation", "code-completion", "programming-assistance"];
} | {
    readonly provider: "azure";
    readonly tier: "standard";
    readonly description: "Fast and reliable for most code reviews (Azure)";
    readonly bestFor: readonly ["quick-reviews", "standard-reviews"];
};
export declare const DEFAULT_MODELS: {
    readonly openai: "gpt-5-mini";
    readonly anthropic: "claude-4-sonnet";
    readonly azure: "gpt-5-mini";
};
export declare const SUPPORTED_MODELS: {
    openai: string[];
    anthropic: string[];
    azure: string[];
};
export declare const MODEL_CAPABILITIES: {
    readonly 'gpt-5': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Latest multimodal model with advanced reasoning and 200K context";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews", "multimodal-tasks"];
    };
    readonly 'gpt-5-mini': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Cost-effective GPT-5 variant with excellent performance";
        readonly bestFor: readonly ["standard-reviews", "balanced-cost-quality"];
    };
    readonly 'gpt-5-nano': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Optimized for speed and low-latency requirements";
        readonly bestFor: readonly ["quick-reviews", "real-time-analysis"];
    };
    readonly 'gpt-5-chat': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Tailored for advanced, natural, and context-aware conversations";
        readonly bestFor: readonly ["interactive-reviews", "conversational-analysis"];
    };
    readonly o3: {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Advanced reasoning model excelling in coding, math, and science";
        readonly bestFor: readonly ["complex-reasoning", "scientific-code-analysis", "mathematical-logic"];
    };
    readonly 'o4-mini': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Efficient reasoning model for real-time applications";
        readonly bestFor: readonly ["quick-reasoning", "agentic-solutions"];
    };
    readonly 'gpt-4.1': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Enhanced GPT-4 with 1M token context and improved intent understanding";
        readonly bestFor: readonly ["large-codebases", "creative-tasks", "agentic-planning"];
    };
    readonly 'gpt-4.1-mini': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Balanced GPT-4.1 variant with performance and efficiency";
        readonly bestFor: readonly ["standard-reviews", "medium-complexity-tasks"];
    };
    readonly 'gpt-4.1-nano': {
        readonly provider: "openai";
        readonly tier: "standard";
        readonly description: "Cost-efficient GPT-4.1 for lower resource consumption";
        readonly bestFor: readonly ["cost-sensitive-reviews", "lightweight-analysis"];
    };
    readonly 'gpt-4o': {
        readonly provider: "openai";
        readonly tier: "premium";
        readonly description: "Previous generation GPT-4 with improved reasoning";
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
    readonly 'claude-4-opus': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Most advanced Claude model with Level 3 safety classification";
        readonly bestFor: readonly ["complex-reasoning", "advanced-code-analysis", "high-risk-tasks"];
    };
    readonly 'claude-4-sonnet': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Enhanced Claude 4 with superior coding and reasoning abilities";
        readonly bestFor: readonly ["code-generation", "detailed-reviews", "complex-analysis"];
    };
    readonly 'claude-3-5-sonnet': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Previous generation Claude with enhanced code understanding";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'claude-3-opus': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Previous most capable Claude model for complex reasoning";
        readonly bestFor: readonly ["complex-code-analysis", "detailed-reviews"];
    };
    readonly 'claude-3-sonnet': {
        readonly provider: "anthropic";
        readonly tier: "premium";
        readonly description: "Balanced Claude 3 model for comprehensive reviews";
        readonly bestFor: readonly ["detailed-reviews", "balanced-cost-quality"];
    };
    readonly 'claude-3-haiku': {
        readonly provider: "anthropic";
        readonly tier: "standard";
        readonly description: "Fast and cost-effective Claude 3 model";
        readonly bestFor: readonly ["quick-reviews", "large-prs"];
    };
    readonly 'grok-3': {
        readonly provider: "azure";
        readonly tier: "premium";
        readonly description: "xAI Grok 3 for real-time conversational AI and reasoning";
        readonly bestFor: readonly ["conversational-analysis", "real-time-reviews"];
    };
    readonly 'grok-3-mini': {
        readonly provider: "azure";
        readonly tier: "standard";
        readonly description: "Efficient Grok 3 variant for cost-effective reasoning";
        readonly bestFor: readonly ["quick-reviews", "cost-effective-analysis"];
    };
    readonly 'deepseek-r1': {
        readonly provider: "azure";
        readonly tier: "premium";
        readonly description: "Advanced reasoning model approaching o3 performance";
        readonly bestFor: readonly ["deep-reasoning", "research-applications", "intelligent-agents"];
    };
    readonly 'codex-mini': {
        readonly provider: "azure";
        readonly tier: "standard";
        readonly description: "Lightweight coding assistant for embedded scenarios";
        readonly bestFor: readonly ["code-generation", "code-completion", "programming-assistance"];
    };
    readonly 'gpt-35-turbo': {
        readonly provider: "azure";
        readonly tier: "standard";
        readonly description: "Fast and reliable for most code reviews (Azure)";
        readonly bestFor: readonly ["quick-reviews", "standard-reviews"];
    };
};
export declare const SEVERITY_LEVELS: {
    readonly error: 4;
    readonly warning: 3;
    readonly info: 2;
    readonly all: 1;
};
export declare const COMMENT_MARKERS: {
    readonly BOT_IDENTIFIER: "<!-- techsee-ai-pr-reviewer -->";
    readonly SUMMARY_MARKER: "<!-- cursor-ai-summary -->";
    readonly INLINE_MARKER: "<!-- cursor-ai-inline -->";
};
//# sourceMappingURL=config.d.ts.map