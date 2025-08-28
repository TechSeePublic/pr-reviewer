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
    aiProvider: (core.getInput('ai_provider') as 'openai' | 'anthropic' | 'auto') || 'auto',
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
    enableSuggestions: core.getBooleanInput('enable_suggestions') ?? true,
    skipIfNoRules: core.getBooleanInput('skip_if_no_rules') ?? false,
    updateExistingComments: core.getBooleanInput('update_existing_comments') ?? true,
    enableAutoFix: core.getBooleanInput('enable_auto_fix') ?? false,
    autoFixSeverity:
      (core.getInput('auto_fix_severity') as 'error' | 'warning' | 'info' | 'all') || 'error',
    requestDelay: parseInt(core.getInput('request_delay') || '2000', 10),
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

  if (inputs.aiProvider === 'auto' && !inputs.openaiApiKey && !inputs.anthropicApiKey) {
    throw new Error(
      'At least one AI provider API key is required (openai_api_key or anthropic_api_key)'
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

    const modelInfo = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];
    if (modelInfo) {
      if (modelInfo.provider === 'openai' && !hasOpenAI) {
        throw new Error(`Model "${model}" requires OpenAI API key, but none provided`);
      }
      if (modelInfo.provider === 'anthropic' && !hasAnthropic) {
        throw new Error(`Model "${model}" requires Anthropic API key, but none provided`);
      }
    }
    return;
  }

  // Check if model is supported by the specified provider
  const supportedModels = SUPPORTED_MODELS[provider as keyof typeof SUPPORTED_MODELS];
  if (!supportedModels || !supportedModels.includes(model)) {
    const suggestions = supportedModels ? supportedModels.slice(0, 3).join(', ') : 'none available';
    throw new Error(
      `Model "${model}" is not supported by provider "${provider}". ` +
        `Supported models: ${suggestions}. ` +
        `See documentation for full list.`
    );
  }
}

export function getRecommendedModel(provider: string, reviewLevel: string): string {
  const recommendations = {
    light: {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
    },
    standard: {
      openai: 'gpt-4',
      anthropic: 'claude-3-sonnet-20240229',
    },
    thorough: {
      openai: 'gpt-4o',
      anthropic: 'claude-3-5-sonnet-20241022',
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
  openai: 'gpt-4o-mini', // Use gpt-4o-mini which supports JSON mode and is more cost-effective
  anthropic: 'claude-3-sonnet-20240229',
} as const;

// Supported models by provider
export const SUPPORTED_MODELS = {
  openai: [
    'gpt-4',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ] as string[],
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
  ] as string[],
};

// Model capabilities and recommendations
export const MODEL_CAPABILITIES = {
  'gpt-4o': {
    provider: 'openai',
    tier: 'premium',
    description: 'Latest GPT-4 with improved reasoning and speed',
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
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    tier: 'premium',
    description: 'Most capable Claude model for complex reasoning',
    bestFor: ['complex-code-analysis', 'detailed-reviews'],
  },
  'claude-3-sonnet-20240229': {
    provider: 'anthropic',
    tier: 'premium',
    description: 'Balanced Claude model for comprehensive reviews',
    bestFor: ['detailed-reviews', 'balanced-cost-quality'],
  },
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    tier: 'premium',
    description: 'Latest Claude with enhanced code understanding',
    bestFor: ['complex-code-analysis', 'detailed-reviews'],
  },
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    tier: 'standard',
    description: 'Fast and cost-effective Claude model',
    bestFor: ['quick-reviews', 'large-prs'],
  },
} as const;

export const SEVERITY_LEVELS = {
  error: 4,
  warning: 3,
  info: 2,
  all: 1,
} as const;

export const COMMENT_MARKERS = {
  BOT_IDENTIFIER: '<!-- cursor-ai-pr-reviewer -->',
  SUMMARY_MARKER: '<!-- cursor-ai-summary -->',
  INLINE_MARKER: '<!-- cursor-ai-inline -->',
} as const;
