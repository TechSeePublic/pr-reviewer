/**
 * Configuration management for the PR Reviewer
 */

import * as core from '@actions/core';
import { ActionInputs } from './types';

export function getActionInputs(): ActionInputs {
  const includePatterns = core.getInput('include_patterns')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const excludePatterns = core.getInput('exclude_patterns')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const inputs: ActionInputs = {
    githubToken: core.getInput('github_token', { required: true }),
    aiProvider: core.getInput('ai_provider') as 'openai' | 'anthropic' | 'auto' || 'auto',
    model: core.getInput('model') || 'auto',
    reviewLevel: core.getInput('review_level') as 'light' | 'standard' | 'thorough' || 'standard',
    includePatterns: includePatterns.length > 0 ? includePatterns : [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', 
      '**/*.py', '**/*.go', '**/*.rs', '**/*.java', '**/*.cs'
    ],
    excludePatterns: excludePatterns.length > 0 ? excludePatterns : [
      'node_modules/**', 'dist/**', 'build/**', 'coverage/**', 
      '*.min.js', '*.bundle.js'
    ],
    maxFiles: parseInt(core.getInput('max_files') || '50', 10),
    commentStyle: core.getInput('comment_style') as 'inline' | 'summary' | 'both' || 'both',
    inlineSeverity: core.getInput('inline_severity') as 'error' | 'warning' | 'info' | 'all' || 'warning',
    summaryFormat: core.getInput('summary_format') as 'brief' | 'detailed' | 'minimal' || 'detailed',
    enableSuggestions: core.getBooleanInput('enable_suggestions') ?? true,
    skipIfNoRules: core.getBooleanInput('skip_if_no_rules') ?? false,
    updateExistingComments: core.getBooleanInput('update_existing_comments') ?? true,
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
    throw new Error('At least one AI provider API key is required (openai_api_key or anthropic_api_key)');
  }

  // Validate numeric inputs
  if (inputs.maxFiles < 1 || inputs.maxFiles > 200) {
    throw new Error('max_files must be between 1 and 200');
  }

  // Validate patterns
  if (inputs.includePatterns.length === 0) {
    throw new Error('include_patterns cannot be empty');
  }
}

export const DEFAULT_MODELS = {
  openai: 'gpt-4',
  anthropic: 'claude-3-sonnet-20240229',
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
