"use strict";
/**
 * Factory for creating AI providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderFactory = void 0;
const config_1 = require("../config");
const logger_1 = require("../logger");
const openai_provider_1 = require("./openai-provider");
const anthropic_provider_1 = require("./anthropic-provider");
const azure_provider_1 = require("./azure-provider");
const bedrock_provider_1 = require("./bedrock-provider");
class AIProviderFactory {
    static create(inputs) {
        const { provider, model } = this.resolveProviderAndModel(inputs);
        logger_1.logger.info(`Using AI provider: ${provider}, model: ${model}, deterministic: ${inputs.deterministicMode}`);
        if (provider === 'openai') {
            if (!inputs.openaiApiKey) {
                throw new Error('OpenAI API key is required');
            }
            return new openai_provider_1.OpenAIProvider(inputs.openaiApiKey, model, inputs.deterministicMode);
        }
        if (provider === 'anthropic') {
            if (!inputs.anthropicApiKey) {
                throw new Error('Anthropic API key is required');
            }
            return new anthropic_provider_1.AnthropicProvider(inputs.anthropicApiKey, model, inputs.deterministicMode);
        }
        if (provider === 'azure') {
            if (!inputs.azureOpenaiApiKey || !inputs.azureOpenaiEndpoint) {
                throw new Error('Azure OpenAI API key and endpoint are required');
            }
            return new azure_provider_1.AzureOpenAIProvider(inputs.azureOpenaiApiKey, inputs.azureOpenaiEndpoint, inputs.azureOpenaiApiVersion || '2024-10-21', model, inputs.azureOpenaiRealModel, inputs.deterministicMode);
        }
        if (provider === 'bedrock') {
            return new bedrock_provider_1.BedrockProvider(inputs.bedrockRegion, model, inputs.deterministicMode, inputs.bedrockAccessKeyId, inputs.bedrockSecretAccessKey, inputs.bedrockAnthropicVersion);
        }
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
    static resolveProviderAndModel(inputs) {
        let provider = inputs.aiProvider;
        let model = inputs.model;
        // Auto-detect provider if needed
        if (provider === 'auto') {
            if (inputs.openaiApiKey) {
                provider = 'openai';
            }
            else if (inputs.anthropicApiKey) {
                provider = 'anthropic';
            }
            else if (inputs.azureOpenaiApiKey && inputs.azureOpenaiEndpoint) {
                provider = 'azure';
            }
            else if (inputs.bedrockRegion || inputs.bedrockAccessKeyId) {
                provider = 'bedrock';
            }
            else {
                throw new Error('No AI provider API key available');
            }
            logger_1.logger.info(`Auto-detected AI provider: ${provider}`);
        }
        // Auto-select model if needed
        if (model === 'auto') {
            model = (0, config_1.getRecommendedModel)(provider, inputs.reviewLevel);
            logger_1.logger.info(`Auto-selected model: ${model} for review level: ${inputs.reviewLevel}`);
        }
        else if (model) {
            // Use the specified model without validation
            // This allows for new models or custom deployments
        }
        else {
            // Fallback to default
            model = config_1.DEFAULT_MODELS[provider];
        }
        return { provider, model };
    }
    static getAvailableProviders(inputs) {
        const providers = [];
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
    static getModelRecommendations(reviewLevel) {
        return {
            openai: (0, config_1.getRecommendedModel)('openai', reviewLevel),
            anthropic: (0, config_1.getRecommendedModel)('anthropic', reviewLevel),
            azure: (0, config_1.getRecommendedModel)('azure', reviewLevel),
            bedrock: (0, config_1.getRecommendedModel)('bedrock', reviewLevel),
        };
    }
}
exports.AIProviderFactory = AIProviderFactory;
//# sourceMappingURL=factory.js.map