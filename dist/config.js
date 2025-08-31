"use strict";
/**
 * Configuration management for the PR Reviewer
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMENT_MARKERS = exports.SEVERITY_LEVELS = exports.MODEL_CAPABILITIES = exports.SUPPORTED_MODELS = exports.DEFAULT_MODELS = void 0;
exports.getActionInputs = getActionInputs;
exports.validateInputs = validateInputs;
exports.validateModelChoice = validateModelChoice;
exports.getRecommendedModel = getRecommendedModel;
exports.getModelInfo = getModelInfo;
const core = __importStar(require("@actions/core"));
function getActionInputs() {
    const includePatterns = core
        .getInput('include_patterns')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    const excludePatterns = core
        .getInput('exclude_patterns')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    const inputs = {
        githubToken: core.getInput('gh_token', { required: true }),
        aiProvider: core.getInput('ai_provider') ||
            'auto',
        model: core.getInput('model') || 'auto',
        reviewLevel: core.getInput('review_level') || 'standard',
        includePatterns: includePatterns.length > 0
            ? includePatterns
            : [
                '**/*.ts',
                '**/*.tsx',
                '**/*.js',
                '**/*.jsx',
                '**/*.py',
                '**/*.go',
                '**/*.rs',
                '**/*.java',
                '**/*.cs',
            ],
        excludePatterns: excludePatterns.length > 0
            ? excludePatterns
            : ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '*.min.js', '*.bundle.js'],
        maxFiles: parseInt(core.getInput('max_files') || '50', 10),
        commentStyle: core.getInput('comment_style') || 'both',
        inlineSeverity: core.getInput('inline_severity') || 'warning',
        summaryFormat: core.getInput('summary_format') || 'detailed',
        enableSuggestions: core.getBooleanInput('enable_suggestions') ?? true,
        skipIfNoRules: core.getBooleanInput('skip_if_no_rules') ?? false,
        updateExistingComments: core.getBooleanInput('update_existing_comments') ?? true,
        enableAutoFix: core.getBooleanInput('enable_auto_fix') ?? false,
        autoFixSeverity: core.getInput('auto_fix_severity') || 'error',
        requestDelay: parseInt(core.getInput('request_delay') || '2000', 10),
        batchSize: parseInt(core.getInput('batch_size') || '5', 10),
        githubRateLimit: parseInt(core.getInput('github_rate_limit') || '1000', 10),
    };
    // Add optional properties only if they have values
    const openaiApiKey = core.getInput('openai_api_key');
    if (openaiApiKey) {
        inputs.openaiApiKey = openaiApiKey;
    }
    const anthropicApiKey = core.getInput('anthropic_api_key');
    if (anthropicApiKey) {
        inputs.anthropicApiKey = anthropicApiKey;
    }
    const azureOpenaiApiKey = core.getInput('azure_openai_api_key');
    if (azureOpenaiApiKey) {
        inputs.azureOpenaiApiKey = azureOpenaiApiKey;
    }
    const azureOpenaiEndpoint = core.getInput('azure_openai_endpoint');
    if (azureOpenaiEndpoint) {
        inputs.azureOpenaiEndpoint = azureOpenaiEndpoint;
    }
    const azureOpenaiApiVersion = core.getInput('azure_openai_api_version');
    if (azureOpenaiApiVersion) {
        inputs.azureOpenaiApiVersion = azureOpenaiApiVersion;
    }
    const rulesPath = core.getInput('rules_path');
    if (rulesPath) {
        inputs.rulesPath = rulesPath;
    }
    return inputs;
}
function validateInputs(inputs) {
    // Validate AI provider credentials
    if (inputs.aiProvider === 'openai' && !inputs.openaiApiKey) {
        throw new Error('OpenAI API key is required when ai_provider is set to "openai"');
    }
    if (inputs.aiProvider === 'anthropic' && !inputs.anthropicApiKey) {
        throw new Error('Anthropic API key is required when ai_provider is set to "anthropic"');
    }
    if (inputs.aiProvider === 'azure' && (!inputs.azureOpenaiApiKey || !inputs.azureOpenaiEndpoint)) {
        throw new Error('Azure OpenAI API key and endpoint are required when ai_provider is set to "azure"');
    }
    if (inputs.aiProvider === 'auto' &&
        !inputs.openaiApiKey &&
        !inputs.anthropicApiKey &&
        !inputs.azureOpenaiApiKey) {
        throw new Error('At least one AI provider API key is required (openai_api_key, anthropic_api_key, or azure_openai_api_key)');
    }
    // Validate model selection
    if (inputs.model && inputs.model !== 'auto') {
        validateModelChoice(inputs.model, inputs.aiProvider, inputs);
    }
    // Validate numeric inputs
    if (inputs.maxFiles < 1 || inputs.maxFiles > 200) {
        throw new Error('max_files must be between 1 and 200');
    }
    // Validate request delay
    if (inputs.requestDelay < 0 || inputs.requestDelay > 60000) {
        throw new Error('request_delay must be between 0 and 60000 milliseconds');
    }
    // Validate batch size
    if (inputs.batchSize < 1 || inputs.batchSize > 20) {
        throw new Error('batch_size must be between 1 and 20');
    }
    // Validate GitHub rate limit
    if (inputs.githubRateLimit < 0 || inputs.githubRateLimit > 10000) {
        throw new Error('github_rate_limit must be between 0 and 10000 milliseconds');
    }
    // Validate patterns
    if (inputs.includePatterns.length === 0) {
        throw new Error('include_patterns cannot be empty');
    }
}
function validateModelChoice(model, provider, inputs) {
    // If provider is auto, check which providers are available
    if (provider === 'auto') {
        const hasOpenAI = !!inputs.openaiApiKey;
        const hasAnthropic = !!inputs.anthropicApiKey;
        const hasAzure = !!(inputs.azureOpenaiApiKey && inputs.azureOpenaiEndpoint);
        const modelInfo = exports.MODEL_CAPABILITIES[model];
        if (modelInfo) {
            if (modelInfo.provider === 'openai' && !hasOpenAI && !hasAzure) {
                throw new Error(`Model "${model}" requires OpenAI API key or Azure OpenAI credentials, but none provided`);
            }
            if (modelInfo.provider === 'anthropic' && !hasAnthropic) {
                throw new Error(`Model "${model}" requires Anthropic API key, but none provided`);
            }
            if (modelInfo.provider === 'azure' && !hasAzure) {
                throw new Error(`Model "${model}" requires Azure OpenAI API key and endpoint, but none provided`);
            }
        }
        return;
    }
    // No model validation - allow any model with any provider
    // This supports new models and custom deployments
}
function getRecommendedModel(provider, reviewLevel) {
    const recommendations = {
        light: {
            openai: 'gpt-5-nano',
            anthropic: 'claude-3-haiku',
            azure: 'gpt-5-nano',
        },
        standard: {
            openai: 'gpt-5-mini',
            anthropic: 'claude-4-sonnet',
            azure: 'gpt-5-mini',
        },
        thorough: {
            openai: 'gpt-5',
            anthropic: 'claude-4-opus',
            azure: 'o3',
        },
    };
    return (recommendations[reviewLevel]?.[provider] || exports.DEFAULT_MODELS[provider]);
}
function getModelInfo(model) {
    return exports.MODEL_CAPABILITIES[model];
}
exports.DEFAULT_MODELS = {
    openai: 'gpt-5-mini', // Use gpt-5-mini - latest cost-effective model with enhanced capabilities
    anthropic: 'claude-4-sonnet',
    azure: 'gpt-5-mini', // Azure uses same models as OpenAI
};
// Supported models by provider
exports.SUPPORTED_MODELS = {
    openai: [
        // 2025 Models
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5-chat',
        'o3',
        'o4-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        // Legacy Models
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
    ],
    anthropic: [
        // 2025 Models
        'claude-4-opus',
        'claude-4-sonnet',
        // Legacy Models
        'claude-3-5-sonnet',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
    ],
    azure: [
        // 2025 Models
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5-chat',
        'o3',
        'o4-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'grok-3',
        'grok-3-mini',
        'deepseek-r1',
        'codex-mini',
        // Legacy Models
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-35-turbo', // Azure uses gpt-35-turbo instead of gpt-3.5-turbo
    ],
};
// Model capabilities and recommendations
exports.MODEL_CAPABILITIES = {
    // 2025 OpenAI Models
    'gpt-5': {
        provider: 'openai',
        tier: 'premium',
        description: 'Latest multimodal model with advanced reasoning and 200K context',
        bestFor: ['complex-code-analysis', 'detailed-reviews', 'multimodal-tasks'],
    },
    'gpt-5-mini': {
        provider: 'openai',
        tier: 'standard',
        description: 'Cost-effective GPT-5 variant with excellent performance',
        bestFor: ['standard-reviews', 'balanced-cost-quality'],
    },
    'gpt-5-nano': {
        provider: 'openai',
        tier: 'standard',
        description: 'Optimized for speed and low-latency requirements',
        bestFor: ['quick-reviews', 'real-time-analysis'],
    },
    'gpt-5-chat': {
        provider: 'openai',
        tier: 'premium',
        description: 'Tailored for advanced, natural, and context-aware conversations',
        bestFor: ['interactive-reviews', 'conversational-analysis'],
    },
    o3: {
        provider: 'openai',
        tier: 'premium',
        description: 'Advanced reasoning model excelling in coding, math, and science',
        bestFor: ['complex-reasoning', 'scientific-code-analysis', 'mathematical-logic'],
    },
    'o4-mini': {
        provider: 'openai',
        tier: 'standard',
        description: 'Efficient reasoning model for real-time applications',
        bestFor: ['quick-reasoning', 'agentic-solutions'],
    },
    'gpt-4.1': {
        provider: 'openai',
        tier: 'premium',
        description: 'Enhanced GPT-4 with 1M token context and improved intent understanding',
        bestFor: ['large-codebases', 'creative-tasks', 'agentic-planning'],
    },
    'gpt-4.1-mini': {
        provider: 'openai',
        tier: 'standard',
        description: 'Balanced GPT-4.1 variant with performance and efficiency',
        bestFor: ['standard-reviews', 'medium-complexity-tasks'],
    },
    'gpt-4.1-nano': {
        provider: 'openai',
        tier: 'standard',
        description: 'Cost-efficient GPT-4.1 for lower resource consumption',
        bestFor: ['cost-sensitive-reviews', 'lightweight-analysis'],
    },
    // Legacy OpenAI Models
    'gpt-4o': {
        provider: 'openai',
        tier: 'premium',
        description: 'Previous generation GPT-4 with improved reasoning',
        bestFor: ['complex-code-analysis', 'detailed-reviews'],
    },
    'gpt-4': {
        provider: 'openai',
        tier: 'premium',
        description: 'Original GPT-4 with excellent reasoning',
        bestFor: ['complex-code-analysis', 'detailed-reviews'],
    },
    'gpt-4o-mini': {
        provider: 'openai',
        tier: 'standard',
        description: 'Fast and cost-effective GPT-4 variant',
        bestFor: ['quick-reviews', 'large-prs'],
    },
    'gpt-4-turbo': {
        provider: 'openai',
        tier: 'premium',
        description: 'Enhanced GPT-4 with larger context window',
        bestFor: ['complex-code-analysis', 'detailed-reviews', 'large-files'],
    },
    'gpt-3.5-turbo': {
        provider: 'openai',
        tier: 'standard',
        description: 'Fast and reliable for most code reviews',
        bestFor: ['quick-reviews', 'standard-reviews'],
    },
    // 2025 Anthropic Models
    'claude-4-opus': {
        provider: 'anthropic',
        tier: 'premium',
        description: 'Most advanced Claude model with Level 3 safety classification',
        bestFor: ['complex-reasoning', 'advanced-code-analysis', 'high-risk-tasks'],
    },
    'claude-4-sonnet': {
        provider: 'anthropic',
        tier: 'premium',
        description: 'Enhanced Claude 4 with superior coding and reasoning abilities',
        bestFor: ['code-generation', 'detailed-reviews', 'complex-analysis'],
    },
    // Legacy Anthropic Models
    'claude-3-5-sonnet': {
        provider: 'anthropic',
        tier: 'premium',
        description: 'Previous generation Claude with enhanced code understanding',
        bestFor: ['complex-code-analysis', 'detailed-reviews'],
    },
    'claude-3-opus': {
        provider: 'anthropic',
        tier: 'premium',
        description: 'Previous most capable Claude model for complex reasoning',
        bestFor: ['complex-code-analysis', 'detailed-reviews'],
    },
    'claude-3-sonnet': {
        provider: 'anthropic',
        tier: 'premium',
        description: 'Balanced Claude 3 model for comprehensive reviews',
        bestFor: ['detailed-reviews', 'balanced-cost-quality'],
    },
    'claude-3-haiku': {
        provider: 'anthropic',
        tier: 'standard',
        description: 'Fast and cost-effective Claude 3 model',
        bestFor: ['quick-reviews', 'large-prs'],
    },
    // 2025 Azure-specific models
    'grok-3': {
        provider: 'azure',
        tier: 'premium',
        description: 'xAI Grok 3 for real-time conversational AI and reasoning',
        bestFor: ['conversational-analysis', 'real-time-reviews'],
    },
    'grok-3-mini': {
        provider: 'azure',
        tier: 'standard',
        description: 'Efficient Grok 3 variant for cost-effective reasoning',
        bestFor: ['quick-reviews', 'cost-effective-analysis'],
    },
    'deepseek-r1': {
        provider: 'azure',
        tier: 'premium',
        description: 'Advanced reasoning model approaching o3 performance',
        bestFor: ['deep-reasoning', 'research-applications', 'intelligent-agents'],
    },
    'codex-mini': {
        provider: 'azure',
        tier: 'standard',
        description: 'Lightweight coding assistant for embedded scenarios',
        bestFor: ['code-generation', 'code-completion', 'programming-assistance'],
    },
    // Azure OpenAI legacy models
    'gpt-35-turbo': {
        provider: 'azure',
        tier: 'standard',
        description: 'Fast and reliable for most code reviews (Azure)',
        bestFor: ['quick-reviews', 'standard-reviews'],
    },
};
exports.SEVERITY_LEVELS = {
    error: 4,
    warning: 3,
    info: 2,
    all: 1,
};
exports.COMMENT_MARKERS = {
    BOT_IDENTIFIER: '<!-- cursor-ai-pr-reviewer -->',
    SUMMARY_MARKER: '<!-- cursor-ai-summary -->',
    INLINE_MARKER: '<!-- cursor-ai-inline -->',
};
//# sourceMappingURL=config.js.map