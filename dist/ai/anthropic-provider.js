"use strict";
/**
 * Anthropic provider for code review
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../config");
const logger_1 = require("../logger");
const prompt_templates_1 = require("../prompt-templates");
const base_provider_1 = require("./base-provider");
class AnthropicProvider extends base_provider_1.BaseAIProvider {
    constructor(apiKey, model, deterministicMode = true) {
        super(deterministicMode);
        this.name = 'anthropic';
        this.client = new sdk_1.default({ apiKey });
        this.model = model || config_1.DEFAULT_MODELS.anthropic;
    }
    async reviewCode(prompt, code, rules) {
        try {
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: false,
                provider: this.name,
            });
            const userPrompt = prompt_templates_1.PromptTemplates.buildUserPrompt(prompt, code);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 8000,
                temperature: this.deterministicMode ? 0.0 : 0.1,
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
            throw new Error(`Anthropic review failed: ${this.extractErrorMessage(error)}`);
        }
    }
    async generatePRPlan(fileChanges, rules) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildPRPlanPrompt(fileChanges, rules);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: this.deterministicMode ? 0.0 : 0.1,
                system: 'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.',
                messages: [{ role: 'user', content: prompt }],
            });
            const result = response.content[0];
            if (!result || result.type !== 'text') {
                throw new Error('No response from Anthropic for PR plan');
            }
            return this.parsePRPlanResponse(result.text);
        }
        catch (error) {
            logger_1.logger.error('Anthropic PR plan generation error:', error);
            throw new Error(`Anthropic PR plan generation failed: ${error}`);
        }
    }
    async reviewBatch(files, rules, prPlan, existingComments) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan, existingComments);
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: false,
                provider: this.name,
            });
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 12000,
                temperature: this.deterministicMode ? 0.0 : 0.1,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            });
            const result = response.content[0];
            if (!result || result.type !== 'text') {
                throw new Error('No response from Anthropic for batch review');
            }
            const issues = this.parseAIResponse(result.text);
            // Ensure all issues have valid file names
            return this.assignFilesToIssues(issues, files);
        }
        catch (error) {
            logger_1.logger.error('Anthropic batch review error:', error);
            throw new Error(`Anthropic batch review failed: ${error}`);
        }
    }
    async reviewArchitecture(fileChanges, rules) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildArchitecturalReviewPrompt(fileChanges, rules, {
                supportsJsonMode: false,
                provider: this.name,
            });
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 8000,
                temperature: this.deterministicMode ? 0.0 : 0.1,
                messages: [{ role: 'user', content: prompt }],
            });
            const result = response.content[0];
            if (!result || result.type !== 'text') {
                throw new Error('No response from Anthropic for architectural review');
            }
            return this.parseArchitecturalResponse(result.text);
        }
        catch (error) {
            logger_1.logger.error('Anthropic architectural review error:', error);
            throw new Error(`Anthropic architectural review failed: ${error}`);
        }
    }
    async generateSummary(issues, context) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildSummaryPrompt(issues, context);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 3000,
                temperature: this.deterministicMode ? 0.0 : 0.1,
                system: 'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
                messages: [{ role: 'user', content: prompt }],
            });
            const result = response.content[0];
            return result && result.type === 'text' ? result.text : 'Summary generation failed';
        }
        catch (error) {
            logger_1.logger.error('Anthropic summary generation error:', error);
            throw new Error(`Anthropic summary generation error: ${this.extractErrorMessage(error)}`);
        }
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic-provider.js.map