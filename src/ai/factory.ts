/**
 * Factory for creating AI providers
 */

import { ActionInputs, AIProvider } from '../types';
import { DEFAULT_MODELS, getRecommendedModel } from '../config';
import { logger } from '../logger';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { AzureOpenAIProvider } from './azure-provider';
import { BedrockProvider } from './bedrock-provider';

export class AIProviderFactory {
  static create(inputs: ActionInputs): AIProvider {
    const { provider, model } = this.resolveProviderAndModel(inputs);

    logger.info(
      `Using AI provider: ${provider}, model: ${model}, deterministic: ${inputs.deterministicMode}`
    );

    if (provider === 'openai') {
      if (!inputs.openaiApiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new OpenAIProvider(inputs.openaiApiKey, model, inputs.deterministicMode);
    }

    if (provider === 'anthropic') {
      if (!inputs.anthropicApiKey) {
        throw new Error('Anthropic API key is required');
      }
      return new AnthropicProvider(inputs.anthropicApiKey, model, inputs.deterministicMode);
    }

    if (provider === 'azure') {
      if (!inputs.azureOpenaiApiKey || !inputs.azureOpenaiEndpoint) {
        throw new Error('Azure OpenAI API key and endpoint are required');
      }
      return new AzureOpenAIProvider(
        inputs.azureOpenaiApiKey,
        inputs.azureOpenaiEndpoint,
        inputs.azureOpenaiApiVersion || '2024-10-21',
        model,
        inputs.azureOpenaiRealModel,
        inputs.deterministicMode
      );
    }

    if (provider === 'bedrock') {
      return new BedrockProvider(
        inputs.bedrockRegion,
        model,
        inputs.deterministicMode,
        inputs.bedrockAccessKeyId,
        inputs.bedrockSecretAccessKey,
        inputs.bedrockAnthropicVersion
      );
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  static resolveProviderAndModel(inputs: ActionInputs): { provider: string; model: string } {
    let provider = inputs.aiProvider;
    let model = inputs.model;

    // Auto-detect provider if needed
    if (provider === 'auto') {
      if (inputs.openaiApiKey) {
        provider = 'openai';
      } else if (inputs.anthropicApiKey) {
        provider = 'anthropic';
      } else if (inputs.azureOpenaiApiKey && inputs.azureOpenaiEndpoint) {
        provider = 'azure';
      } else if (inputs.bedrockRegion || inputs.bedrockAccessKeyId) {
        provider = 'bedrock';
      } else {
        throw new Error('No AI provider API key available');
      }
      logger.info(`Auto-detected AI provider: ${provider}`);
    }

    // Auto-select model if needed
    if (model === 'auto') {
      model = getRecommendedModel(provider, inputs.reviewLevel);
      logger.info(`Auto-selected model: ${model} for review level: ${inputs.reviewLevel}`);
    } else if (model) {
      // Use the specified model without validation
      // This allows for new models or custom deployments
    } else {
      // Fallback to default
      model = DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS];
    }

    return { provider, model };
  }

  static getAvailableProviders(inputs: ActionInputs): string[] {
    const providers: string[] = [];

    if (inputs.openaiApiKey) {
      providers.push('openai');
    }

    if (inputs.anthropicApiKey) {
      providers.push('anthropic');
    }

    if (inputs.azureOpenaiApiKey && inputs.azureOpenaiEndpoint) {
      providers.push('azure');
    }

    if (inputs.bedrockRegion || inputs.bedrockAccessKeyId) {
      providers.push('bedrock');
    }

    return providers;
  }

  static getModelRecommendations(reviewLevel: string): Record<string, string> {
    return {
      openai: getRecommendedModel('openai', reviewLevel),
      anthropic: getRecommendedModel('anthropic', reviewLevel),
      azure: getRecommendedModel('azure', reviewLevel),
      bedrock: getRecommendedModel('bedrock', reviewLevel),
    };
  }
}
