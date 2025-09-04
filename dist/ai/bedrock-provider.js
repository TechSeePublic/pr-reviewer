"use strict";
/**
 * AWS Bedrock provider for code review
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockProvider = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const config_1 = require("../config");
const logger_1 = require("../logger");
const prompt_templates_1 = require("../prompt-templates");
const base_provider_1 = require("./base-provider");
class BedrockProvider extends base_provider_1.BaseAIProvider {
    /**
     * Creates a new BedrockProvider instance
     * @param region AWS region for Bedrock (default: us-east-1)
     * @param model Model ID to use (default: from config)
     * @param deterministicMode Whether to use deterministic settings (default: true)
     * @param accessKeyId AWS access key ID (optional, can use IAM roles)
     * @param secretAccessKey AWS secret access key (optional, can use IAM roles)
     * @param anthropicVersion Anthropic API version for Claude models (default: bedrock-2023-05-31)
     *                        Check AWS Bedrock documentation for latest supported versions
     */
    constructor(region = 'us-east-1', model, deterministicMode = true, accessKeyId, secretAccessKey, anthropicVersion = 'bedrock-2023-05-31') {
        super(deterministicMode);
        this.name = 'bedrock';
        this.model = model || config_1.DEFAULT_MODELS.bedrock;
        this.region = region;
        this.anthropicVersion = anthropicVersion;
        // Initialize Bedrock client with optional credentials
        const clientConfig = { region };
        if (accessKeyId && secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }
        this.client = new client_bedrock_runtime_1.BedrockRuntimeClient(clientConfig);
    }
    async invokeModel(prompt, systemPrompt) {
        try {
            let body;
            // Handle different model families
            if (this.model.startsWith('anthropic.claude')) {
                // Claude models on Bedrock
                body = {
                    anthropic_version: this.anthropicVersion,
                    max_tokens: 8000,
                    temperature: this.deterministicMode ? 0.0 : 0.1,
                    messages: [
                        {
                            role: 'user',
                            content: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                        },
                    ],
                };
            }
            else if (this.model.startsWith('meta.llama')) {
                // Llama models on Bedrock
                body = {
                    prompt: systemPrompt
                        ? `${systemPrompt}\n\nHuman: ${prompt}\n\nAssistant:`
                        : `Human: ${prompt}\n\nAssistant:`,
                    max_gen_len: 8000,
                    temperature: this.deterministicMode ? 0.0 : 0.1,
                    top_p: 0.9,
                };
            }
            else if (this.model.startsWith('amazon.titan')) {
                // Titan models on Bedrock
                body = {
                    inputText: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                    textGenerationConfig: {
                        maxTokenCount: 8000,
                        temperature: this.deterministicMode ? 0.0 : 0.1,
                        topP: 0.9,
                        stopSequences: [],
                    },
                };
            }
            else {
                // Default format for other models
                body = {
                    prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                    max_tokens: 8000,
                    temperature: this.deterministicMode ? 0.0 : 0.1,
                };
            }
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: this.model,
                body: JSON.stringify(body),
                contentType: 'application/json',
            });
            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            // Extract text based on model family
            if (this.model.startsWith('anthropic.claude')) {
                return responseBody.content?.[0]?.text || '';
            }
            else if (this.model.startsWith('meta.llama')) {
                return responseBody.generation || '';
            }
            else if (this.model.startsWith('amazon.titan')) {
                return responseBody.results?.[0]?.outputText || '';
            }
            else {
                // Try common response formats
                return responseBody.completion || responseBody.text || responseBody.generated_text || '';
            }
        }
        catch (error) {
            logger_1.logger.error('Bedrock API error:', error);
            throw new Error(`Bedrock model invocation failed: ${error}`);
        }
    }
    async reviewCode(prompt, code, rules) {
        try {
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: false, // Bedrock doesn't have explicit JSON mode like OpenAI
                provider: this.name,
            });
            const userPrompt = prompt_templates_1.PromptTemplates.buildUserPrompt(prompt, code);
            const result = await this.invokeModel(userPrompt, systemPrompt);
            if (!result) {
                throw new Error('No response from Bedrock');
            }
            return this.parseAIResponse(result);
        }
        catch (error) {
            logger_1.logger.error('Bedrock review error:', error);
            throw new Error(`Bedrock review failed: ${this.extractErrorMessage(error)}`);
        }
    }
    async generatePRPlan(fileChanges, rules) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildPRPlanPrompt(fileChanges, rules);
            const systemPrompt = 'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.';
            const result = await this.invokeModel(prompt, systemPrompt);
            if (!result) {
                throw new Error('No response from Bedrock for PR plan');
            }
            return this.parsePRPlanResponse(result);
        }
        catch (error) {
            logger_1.logger.error('Bedrock PR plan generation error:', error);
            throw new Error(`Bedrock PR plan generation failed: ${this.extractErrorMessage(error)}`);
        }
    }
    async reviewBatch(files, rules, prPlan) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan);
            const systemPrompt = prompt_templates_1.PromptTemplates.buildCodeReviewSystemPrompt(rules, {
                supportsJsonMode: false,
                provider: this.name,
            });
            const result = await this.invokeModel(prompt, systemPrompt);
            if (!result) {
                throw new Error('No response from Bedrock for batch review');
            }
            const issues = this.parseAIResponse(result);
            return this.assignFilesToIssues(issues, files);
        }
        catch (error) {
            logger_1.logger.error('Bedrock batch review error:', error);
            throw new Error(`Bedrock batch review failed: ${this.extractErrorMessage(error)}`);
        }
    }
    async reviewArchitecture(fileChanges, rules) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildArchitecturalReviewPrompt(fileChanges, rules, {
                supportsJsonMode: false,
                provider: this.name,
            });
            const result = await this.invokeModel(prompt);
            if (!result) {
                throw new Error('No response from Bedrock for architectural review');
            }
            return this.parseArchitecturalResponse(result);
        }
        catch (error) {
            logger_1.logger.error('Bedrock architectural review error:', error);
            throw new Error(`Bedrock architectural review failed: ${this.extractErrorMessage(error)}`);
        }
    }
    async generateSummary(issues, context) {
        try {
            const prompt = prompt_templates_1.PromptTemplates.buildSummaryPrompt(issues, context);
            const systemPrompt = 'You are a helpful code review assistant that creates concise, actionable PR review summaries.';
            const result = await this.invokeModel(prompt, systemPrompt);
            return result || 'Summary generation failed';
        }
        catch (error) {
            logger_1.logger.error('Bedrock summary generation error:', error);
            throw new Error(`Bedrock summary generation error: ${this.extractErrorMessage(error)}`);
        }
    }
}
exports.BedrockProvider = BedrockProvider;
//# sourceMappingURL=bedrock-provider.js.map