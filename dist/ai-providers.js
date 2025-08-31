"use strict";
/**
 * AI providers for code review (OpenAI and Anthropic)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderFactory = exports.AnthropicProvider = exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const prompt_templates_1 = require("./prompt-templates");
class OpenAIProvider {
    constructor(apiKey, model) {
        this.name = 'openai';
        this.client = new openai_1.default({ apiKey });
        this.model = model || config_1.DEFAULT_MODELS.openai;
    }
    supportsJsonMode() {
        // Models that support response_format: { type: 'json_object' }
        const supportedModels = [
            'gpt-4-1106-preview',
            'gpt-4-0125-preview',
            'gpt-4-turbo-preview',
            'gpt-4-turbo',
            'gpt-4o',
            'gpt-4o-2024-05-13',
            'gpt-4o-2024-08-06',
            'gpt-4o-mini',
            'gpt-4o-mini-2024-07-18',
            'gpt-3.5-turbo-1106',
            'gpt-3.5-turbo-0125',
        ];
        return supportedModels.some(supportedModel => this.model.startsWith(supportedModel));
    }
    async reviewCode(prompt, code, rules) {
        try {
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: this.supportsJsonMode(),
                provider: this.name
            });
            const userPrompt = prompt_templates_1.PromptTemplates.buildUserPrompt(prompt, code);
            // Build the request configuration
            const requestConfig = {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                max_tokens: 4000,
            };
            // Only add response_format if the model supports it
            if (this.supportsJsonMode()) {
                requestConfig.response_format = { type: 'json_object' };
            }
            const response = await this.client.chat.completions.create(requestConfig);
            const result = response.choices[0]?.message?.content;
            if (!result) {
                throw new Error('No response from OpenAI');
            }
            return this.parseAIResponse(result);
        }
        catch (error) {
            logger_1.logger.error('OpenAI API error:', error);
            // Extract specific error message from OpenAI error
            let errorMessage = 'Unknown error';
            if (error && typeof error === 'object') {
                if ('message' in error) {
                    errorMessage = String(error.message);
                }
                else if ('error' in error &&
                    error.error &&
                    typeof error.error === 'object' &&
                    'message' in error.error) {
                    errorMessage = String(error.error.message);
                }
            }
            throw new Error(`OpenAI review failed: ${errorMessage}`);
        }
    }
    async generateSummary(issues, context) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildSummaryPrompt(issues, context);
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 1500,
            });
            return response.choices[0]?.message?.content || 'Summary generation failed';
        }
        catch (error) {
            logger_1.logger.error('OpenAI summary generation error:', error);
            // Extract specific error message from OpenAI error
            let errorMessage = 'Unknown error';
            if (error && typeof error === 'object') {
                if ('message' in error) {
                    errorMessage = String(error.message);
                }
                else if ('error' in error &&
                    error.error &&
                    typeof error.error === 'object' &&
                    'message' in error.error) {
                    errorMessage = String(error.error.message);
                }
            }
            throw new Error(`OpenAI summary generation error: ${errorMessage}`);
        }
    }
    parseAIResponse(response) {
        try {
            // Clean up the response for better JSON parsing
            let cleanedResponse = response.trim();
            // If response doesn't start with {, try to find JSON content
            if (!cleanedResponse.startsWith('{')) {
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[0];
                }
            }
            const parsed = JSON.parse(cleanedResponse);
            return parsed.issues || [];
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse AI response as JSON:', error);
            logger_1.logger.warn('Response content:', response.substring(0, 500) + '...');
            // Try to extract issues from malformed JSON
            return this.extractIssuesFromText(response);
        }
    }
    extractIssuesFromText(text) {
        // Fallback: try to extract issues from non-JSON response
        const issues = [];
        // Look for common patterns in text responses
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes('violation') || line.toLowerCase().includes('issue')) {
                issues.push({
                    type: 'warning',
                    category: 'best_practice',
                    message: line.trim(),
                    description: line.trim(),
                    ruleId: 'unknown',
                    ruleName: 'Extracted from text response',
                    file: 'unknown',
                    severity: 'medium',
                });
            }
        }
        return issues;
    }
}
exports.OpenAIProvider = OpenAIProvider;
class AnthropicProvider {
    constructor(apiKey, model) {
        this.name = 'anthropic';
        this.client = new sdk_1.default({ apiKey });
        this.model = model || config_1.DEFAULT_MODELS.anthropic;
    }
    async reviewCode(prompt, code, rules) {
        try {
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: false,
                provider: this.name
            });
            const userPrompt = prompt_templates_1.PromptTemplates.buildUserPrompt(prompt, code);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: 0.1,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            });
            const result = response.content[0];
            if (!result || result.type !== 'text') {
                throw new Error('Unexpected response type from Anthropic');
            }
            return this.parseAIResponse(result.text);
        }
        catch (error) {
            logger_1.logger.error('Anthropic API error:', error);
            // Extract specific error message from Anthropic error
            let errorMessage = 'Unknown error';
            if (error && typeof error === 'object') {
                if ('message' in error) {
                    errorMessage = String(error.message);
                }
                else if ('error' in error &&
                    error.error &&
                    typeof error.error === 'object' &&
                    'message' in error.error) {
                    errorMessage = String(error.error.message);
                }
            }
            throw new Error(`Anthropic review failed: ${errorMessage}`);
        }
    }
    async generateSummary(issues, context) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildSummaryPrompt(issues, context);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 1500,
                temperature: 0.2,
                system: 'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
                messages: [{ role: 'user', content: prompt }],
            });
            const result = response.content[0];
            return result && result.type === 'text' ? result.text : 'Summary generation failed';
        }
        catch (error) {
            logger_1.logger.error('Anthropic summary generation error:', error);
            // Extract specific error message from Anthropic error
            let errorMessage = 'Unknown error';
            if (error && typeof error === 'object') {
                if ('message' in error) {
                    errorMessage = String(error.message);
                }
                else if ('error' in error &&
                    error.error &&
                    typeof error.error === 'object' &&
                    'message' in error.error) {
                    errorMessage = String(error.error.message);
                }
            }
            throw new Error(`Anthropic summary generation error: ${errorMessage}`);
        }
    }
    parseAIResponse(response) {
        try {
            // Clean up the response for better JSON parsing
            let cleanedResponse = response.trim();
            // If response doesn't start with {, try to find JSON content
            if (!cleanedResponse.startsWith('{')) {
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedResponse = jsonMatch[0];
                }
            }
            const parsed = JSON.parse(cleanedResponse);
            return parsed.issues || [];
        }
        catch (error) {
            logger_1.logger.warn('Failed to parse AI response as JSON:', error);
            logger_1.logger.warn('Response content:', response.substring(0, 500) + '...');
            // Try to extract issues from malformed JSON
            return this.extractIssuesFromText(response);
        }
    }
    extractIssuesFromText(text) {
        // Fallback: try to extract issues from non-JSON response
        const issues = [];
        // Look for common patterns in text responses
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes('violation') || line.toLowerCase().includes('issue')) {
                issues.push({
                    type: 'warning',
                    category: 'best_practice',
                    message: line.trim(),
                    description: line.trim(),
                    ruleId: 'unknown',
                    ruleName: 'Extracted from text response',
                    file: 'unknown',
                    severity: 'medium',
                });
            }
        }
        return issues;
    }
}
exports.AnthropicProvider = AnthropicProvider;
class AIProviderFactory {
    static create(inputs) {
        const { provider, model } = this.resolveProviderAndModel(inputs);
        logger_1.logger.info(`Using AI provider: ${provider}, model: ${model}`);
        if (provider === 'openai') {
            if (!inputs.openaiApiKey) {
                throw new Error('OpenAI API key is required');
            }
            return new OpenAIProvider(inputs.openaiApiKey, model);
        }
        if (provider === 'anthropic') {
            if (!inputs.anthropicApiKey) {
                throw new Error('Anthropic API key is required');
            }
            return new AnthropicProvider(inputs.anthropicApiKey, model);
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
            // If specific model is provided, validate it matches the provider
            const modelInfo = (0, config_1.getModelInfo)(model);
            if (modelInfo && modelInfo.provider !== provider) {
                throw new Error(`Model "${model}" is not compatible with provider "${provider}". ` +
                    `This model requires provider "${modelInfo.provider}".`);
            }
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
        return providers;
    }
    static getModelRecommendations(reviewLevel) {
        return {
            openai: (0, config_1.getRecommendedModel)('openai', reviewLevel),
            anthropic: (0, config_1.getRecommendedModel)('anthropic', reviewLevel),
        };
    }
}
exports.AIProviderFactory = AIProviderFactory;
//# sourceMappingURL=ai-providers.js.map