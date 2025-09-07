"use strict";
/**
 * AWS Bedrock provider for code review
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockProvider = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const client_sts_1 = require("@aws-sdk/client-sts");
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
     * @param accessKeyId AWS access key ID (optional, can use IAM roles or API key)
     * @param secretAccessKey AWS secret access key (optional, can use IAM roles or API key)
     * @param anthropicVersion Anthropic API version for Claude models (default: bedrock-2023-05-31)
     * @param apiKey AWS Bedrock API key for simplified authentication (introduced July 2025)
     *                        Check AWS Bedrock documentation for latest supported versions
     */
    constructor(region = 'us-east-1', model, deterministicMode = true, accessKeyId, secretAccessKey, anthropicVersion = 'bedrock-2023-05-31', apiKey) {
        super(deterministicMode);
        this.name = 'bedrock';
        this.model = model || config_1.DEFAULT_MODELS.bedrock;
        this.region = region;
        this.anthropicVersion = anthropicVersion;
        if (apiKey) {
            this.apiKey = apiKey;
        }
        // Validate region
        if (!region) {
            throw new Error('AWS Bedrock region is required');
        }
        // Initialize Bedrock client with optional credentials
        const clientConfig = { region };
        // Priority: API Key > Access Keys > Default credential chain
        if (apiKey) {
            logger_1.logger.info('Using AWS Bedrock API Key for authentication (July 2025 feature)');
            // Set the API key as AWS_BEARER_TOKEN_BEDROCK environment variable
            // This is the correct way to use Bedrock API keys according to AWS documentation
            process.env.AWS_BEARER_TOKEN_BEDROCK = apiKey;
            logger_1.logger.info('Set AWS_BEARER_TOKEN_BEDROCK environment variable for Bedrock authentication');
            // Don't set any credentials - let AWS SDK use the bearer token
        }
        else if (accessKeyId && secretAccessKey) {
            logger_1.logger.info('Using explicit AWS Access Key credentials for Bedrock');
            clientConfig.credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }
        else {
            logger_1.logger.info('Using default AWS credential chain for Bedrock (IAM roles, environment variables, etc.)');
        }
        try {
            this.client = new client_bedrock_runtime_1.BedrockRuntimeClient(clientConfig);
            this.stsClient = new client_sts_1.STSClient(clientConfig);
            logger_1.logger.info(`Bedrock client initialized for region: ${region}, model: ${this.model}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Bedrock client:', error);
            throw new Error(`Failed to initialize Bedrock client: ${error}`);
        }
    }
    /**
     * Validates AWS credentials by making a test STS call
     * This helps diagnose authentication issues before making Bedrock API calls
     */
    async validateCredentials() {
        try {
            logger_1.logger.info('Validating AWS credentials...');
            const command = new client_sts_1.GetCallerIdentityCommand({});
            const response = await this.stsClient.send(command);
            logger_1.logger.info(`AWS credentials validated. Account: ${response.Account}, User/Role: ${response.Arn}`);
        }
        catch (error) {
            logger_1.logger.error('AWS credential validation failed:', error);
            if (error?.name === 'UnrecognizedClientException') {
                throw new Error(`AWS credentials are invalid or expired: ${error.message}. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.`);
            }
            if (error?.name === 'AccessDenied') {
                throw new Error(`AWS credentials lack STS permissions: ${error.message}. The credentials need sts:GetCallerIdentity permission.`);
            }
            throw new Error(`AWS credential validation failed: ${error?.message || error}`);
        }
    }
    async invokeModel(prompt, systemPrompt) {
        // Validate credentials on first API call (skip for API keys as they don't work with STS)
        if (!BedrockProvider.credentialsValidated && !this.apiKey) {
            await this.validateCredentials();
            BedrockProvider.credentialsValidated = true;
        }
        else if (this.apiKey) {
            logger_1.logger.info('Skipping STS validation for API key authentication');
            BedrockProvider.credentialsValidated = true;
        }
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
            // Provide specific error messages for common issues
            if (error?.name === 'UnrecognizedClientException') {
                const errorMessage = `AWS Bedrock authentication failed: ${error.message}. 
        
Possible causes:
1. Invalid or expired AWS credentials
2. Missing AWS credentials (check environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
3. Incorrect region configuration (current: ${this.region})
4. IAM permissions missing for Bedrock service
5. AWS credentials not configured in GitHub Actions secrets

Troubleshooting steps:
- Verify AWS credentials are valid and not expired
- Ensure the IAM user/role has bedrock:InvokeModel permissions
- Check that the region ${this.region} supports Bedrock
- For GitHub Actions, verify bedrock_access_key_id and bedrock_secret_access_key secrets are set`;
                throw new Error(errorMessage);
            }
            if (error?.name === 'AccessDeniedException') {
                throw new Error(`AWS Bedrock access denied: ${error.message}. Check IAM permissions for bedrock:InvokeModel and model access for ${this.model}`);
            }
            if (error?.name === 'ValidationException') {
                throw new Error(`AWS Bedrock validation error: ${error.message}. Check model ID and request parameters for ${this.model}`);
            }
            if (error?.name === 'ThrottlingException') {
                throw new Error(`AWS Bedrock throttling: ${error.message}. Too many requests, please retry later`);
            }
            if (error?.name === 'ServiceUnavailableException') {
                throw new Error(`AWS Bedrock service unavailable: ${error.message}. The service may be temporarily down`);
            }
            // Generic error fallback
            throw new Error(`Bedrock model invocation failed: ${error?.message || error}`);
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
BedrockProvider.credentialsValidated = false;
//# sourceMappingURL=bedrock-provider.js.map