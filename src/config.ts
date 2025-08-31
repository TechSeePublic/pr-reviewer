/**
 * Configuration management for the PR Reviewer
 */

import * as core from '@actions/core';
import { ActionInputs } from './types';

export function getActionInputs(): ActionInputs {
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

  const inputs: ActionInputs = {
    githubToken: core.getInput('gh_token', { required: true }),
    aiProvider:
      (core.getInput('ai_provider') as 'openai' | 'anthropic' | 'gemini' | 'azure' | 'auto') ||
      'auto',
    model: core.getInput('model') || 'auto',
    reviewLevel: (core.getInput('review_level') as 'light' | 'standard' | 'thorough') || 'standard',
    includePatterns:
      includePatterns.length > 0
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
    excludePatterns:
      excludePatterns.length > 0
        ? excludePatterns
        : ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '*.min.js', '*.bundle.js'],
    maxFiles: parseInt(core.getInput('max_files') || '50', 10),
    commentStyle: (core.getInput('comment_style') as 'inline' | 'summary' | 'both') || 'both',
    inlineSeverity:
      (core.getInput('inline_severity') as 'error' | 'warning' | 'info' | 'all') || 'warning',
    summaryFormat:
      (core.getInput('summary_format') as 'brief' | 'detailed' | 'minimal') || 'detailed',
    logLevel: (core.getInput('log_level') as 'error' | 'warning' | 'info' | 'all') || 'warning',
    enableSuggestions: core.getBooleanInput('enable_suggestions') ?? true,
    skipIfNoRules: core.getBooleanInput('skip_if_no_rules') ?? false,
    updateExistingComments: core.getBooleanInput('update_existing_comments') ?? true,
    enableAutoFix: core.getBooleanInput('enable_auto_fix') ?? false,
    autoFixSeverity:
      (core.getInput('auto_fix_severity') as 'error' | 'warning' | 'info' | 'all') || 'error',
    requestDelay: parseInt(core.getInput('request_delay') || '2000', 10),
    batchSize: parseInt(core.getInput('batch_size') || '100', 10),
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

export function validateInputs(inputs: ActionInputs): void {
  // Validate AI provider credentials
  if (inputs.aiProvider === 'openai' && !inputs.openaiApiKey) {
    throw new Error('OpenAI API key is required when ai_provider is set to "openai"');
  }

  if (inputs.aiProvider === 'anthropic' && !inputs.anthropicApiKey) {
    throw new Error('Anthropic API key is required when ai_provider is set to "anthropic"');
  }

  if (inputs.aiProvider === 'azure' && (!inputs.azureOpenaiApiKey || !inputs.azureOpenaiEndpoint)) {
    throw new Error(
      'Azure OpenAI API key and endpoint are required when ai_provider is set to "azure"'
    );
  }

  if (
    inputs.aiProvider === 'auto' &&
    !inputs.openaiApiKey &&
    !inputs.anthropicApiKey &&
    !inputs.azureOpenaiApiKey
  ) {
    throw new Error(
      'At least one AI provider API key is required (openai_api_key, anthropic_api_key, or azure_openai_api_key)'
    );
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
  if (inputs.batchSize < 1 || inputs.batchSize > 200) {
    throw new Error('batch_size must be between 1 and 200');
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

export function validateModelChoice(model: string, provider: string, inputs: ActionInputs): void {
  // If provider is auto, check which providers are available
  if (provider === 'auto') {
    const hasOpenAI = !!inputs.openaiApiKey;
    const hasAnthropic = !!inputs.anthropicApiKey;
    const hasAzure = !!(inputs.azureOpenaiApiKey && inputs.azureOpenaiEndpoint);

    const modelInfo = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
    if (modelInfo) {
      if (modelInfo.provider === 'openai' && !hasOpenAI && !hasAzure) {
        throw new Error(
          `Model "${model}" requires OpenAI API key or Azure OpenAI credentials, but none provided`
        );
      }
      if (modelInfo.provider === 'anthropic' && !hasAnthropic) {
        throw new Error(`Model "${model}" requires Anthropic API key, but none provided`);
      }
      if (modelInfo.provider === 'azure' && !hasAzure) {
        throw new Error(
          `Model "${model}" requires Azure OpenAI API key and endpoint, but none provided`
        );
      }
    }
    return;
  }

  // No model validation - allow any model with any provider
  // This supports new models and custom deployments
}

export function getRecommendedModel(provider: string, reviewLevel: string): string {
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

  return (
    recommendations[reviewLevel as keyof typeof recommendations]?.[
      provider as keyof typeof recommendations.standard
    ] || DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS]
  );
}

export function getModelInfo(model: string) {
  return MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
}

export const DEFAULT_MODELS = {
  openai: 'gpt-5-mini', // Use gpt-5-mini - latest cost-effective model with enhanced capabilities
  anthropic: 'claude-4-sonnet',
  azure: 'gpt-5-mini', // Azure uses same models as OpenAI
} as const;

// Supported models by provider
export const SUPPORTED_MODELS = {
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
  ] as string[],
  anthropic: [
    // 2025 Models
    'claude-4-opus',
    'claude-4-sonnet',
    // Legacy Models
    'claude-3-5-sonnet',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
  ] as string[],
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
  ] as string[],
};

// Model capabilities and recommendations
export const MODEL_CAPABILITIES = {
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
} as const;

export const SEVERITY_LEVELS = {
  error: 4,
  warning: 3,
  info: 2,
  all: 1,
} as const;

export const COMMENT_MARKERS = {
  BOT_IDENTIFIER: '<!-- techsee-ai-pr-reviewer -->',
  SUMMARY_MARKER: '<!-- cursor-ai-summary -->',
  INLINE_MARKER: '<!-- cursor-ai-inline -->',
} as const;
