/**
 * AWS Bedrock provider for code review
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import {
  ArchitecturalReviewResult,
  CodeIssue,
  CursorRule,
  FileChange,
  PRPlan,
  ReviewContext,
} from '../types';
import { DEFAULT_MODELS } from '../config';
import { logger } from '../logger';
import { PromptTemplates } from '../prompt-templates';
import { BaseAIProvider } from './base-provider';

export class BedrockProvider extends BaseAIProvider {
  public readonly name = 'bedrock';
  public readonly model: string;
  private client: BedrockRuntimeClient;
  private stsClient: STSClient;
  private region: string;
  private anthropicVersion: string;
  private static credentialsValidated = false;

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
  constructor(
    region: string = 'us-east-1',
    model?: string,
    deterministicMode: boolean = true,
    accessKeyId?: string,
    secretAccessKey?: string,
    anthropicVersion: string = 'bedrock-2023-05-31',
    apiKey?: string
  ) {
    super(deterministicMode);
    this.model = model || DEFAULT_MODELS.bedrock;
    this.region = region;
    this.anthropicVersion = anthropicVersion;

    // Validate region
    if (!region) {
      throw new Error('AWS Bedrock region is required');
    }

    // Initialize Bedrock client with optional credentials
    const clientConfig: Record<string, unknown> = { region };

    // Priority: API Key > Access Keys > Default credential chain
    if (apiKey) {
      logger.info('Using AWS Bedrock API Key for authentication (July 2025 feature)');
      clientConfig.credentials = {
        apiKey,
      };
    } else if (accessKeyId && secretAccessKey) {
      logger.info('Using explicit AWS Access Key credentials for Bedrock');
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    } else {
      logger.info(
        'Using default AWS credential chain for Bedrock (IAM roles, environment variables, etc.)'
      );
    }

    try {
      this.client = new BedrockRuntimeClient(clientConfig);
      this.stsClient = new STSClient(clientConfig);
      logger.info(`Bedrock client initialized for region: ${region}, model: ${this.model}`);
    } catch (error) {
      logger.error('Failed to initialize Bedrock client:', error);
      throw new Error(`Failed to initialize Bedrock client: ${error}`);
    }
  }

  /**
   * Validates AWS credentials by making a test STS call
   * This helps diagnose authentication issues before making Bedrock API calls
   */
  private async validateCredentials(): Promise<void> {
    try {
      logger.info('Validating AWS credentials...');
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);
      logger.info(
        `AWS credentials validated. Account: ${response.Account}, User/Role: ${response.Arn}`
      );
    } catch (error: any) {
      logger.error('AWS credential validation failed:', error);

      if (error?.name === 'UnrecognizedClientException') {
        throw new Error(
          `AWS credentials are invalid or expired: ${error.message}. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.`
        );
      }

      if (error?.name === 'AccessDenied') {
        throw new Error(
          `AWS credentials lack STS permissions: ${error.message}. The credentials need sts:GetCallerIdentity permission.`
        );
      }

      throw new Error(`AWS credential validation failed: ${error?.message || error}`);
    }
  }

  private async invokeModel(prompt: string, systemPrompt?: string): Promise<string> {
    // Validate credentials on first API call
    if (!BedrockProvider.credentialsValidated) {
      await this.validateCredentials();
      BedrockProvider.credentialsValidated = true;
    }

    try {
      let body: Record<string, unknown>;

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
      } else if (this.model.startsWith('meta.llama')) {
        // Llama models on Bedrock
        body = {
          prompt: systemPrompt
            ? `${systemPrompt}\n\nHuman: ${prompt}\n\nAssistant:`
            : `Human: ${prompt}\n\nAssistant:`,
          max_gen_len: 8000,
          temperature: this.deterministicMode ? 0.0 : 0.1,
          top_p: 0.9,
        };
      } else if (this.model.startsWith('amazon.titan')) {
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
      } else {
        // Default format for other models
        body = {
          prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
          max_tokens: 8000,
          temperature: this.deterministicMode ? 0.0 : 0.1,
        };
      }

      const command = new InvokeModelCommand({
        modelId: this.model,
        body: JSON.stringify(body),
        contentType: 'application/json',
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract text based on model family
      if (this.model.startsWith('anthropic.claude')) {
        return responseBody.content?.[0]?.text || '';
      } else if (this.model.startsWith('meta.llama')) {
        return responseBody.generation || '';
      } else if (this.model.startsWith('amazon.titan')) {
        return responseBody.results?.[0]?.outputText || '';
      } else {
        // Try common response formats
        return responseBody.completion || responseBody.text || responseBody.generated_text || '';
      }
    } catch (error: any) {
      logger.error('Bedrock API error:', error);

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
        throw new Error(
          `AWS Bedrock access denied: ${error.message}. Check IAM permissions for bedrock:InvokeModel and model access for ${this.model}`
        );
      }

      if (error?.name === 'ValidationException') {
        throw new Error(
          `AWS Bedrock validation error: ${error.message}. Check model ID and request parameters for ${this.model}`
        );
      }

      if (error?.name === 'ThrottlingException') {
        throw new Error(
          `AWS Bedrock throttling: ${error.message}. Too many requests, please retry later`
        );
      }

      if (error?.name === 'ServiceUnavailableException') {
        throw new Error(
          `AWS Bedrock service unavailable: ${error.message}. The service may be temporarily down`
        );
      }

      // Generic error fallback
      throw new Error(`Bedrock model invocation failed: ${error?.message || error}`);
    }
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: false, // Bedrock doesn't have explicit JSON mode like OpenAI
        provider: this.name,
      });
      const userPrompt = PromptTemplates.buildUserPrompt(prompt, code);

      const result = await this.invokeModel(userPrompt, systemPrompt);
      if (!result) {
        throw new Error('No response from Bedrock');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      logger.error('Bedrock review error:', error);
      throw new Error(`Bedrock review failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan> {
    try {
      const prompt = PromptTemplates.buildPRPlanPrompt(fileChanges, rules);
      const systemPrompt =
        'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.';

      const result = await this.invokeModel(prompt, systemPrompt);
      if (!result) {
        throw new Error('No response from Bedrock for PR plan');
      }

      return this.parsePRPlanResponse(result);
    } catch (error) {
      logger.error('Bedrock PR plan generation error:', error);
      throw new Error(`Bedrock PR plan generation failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async reviewBatch(
    files: FileChange[],
    rules: CursorRule[],
    prPlan: PRPlan
  ): Promise<CodeIssue[]> {
    try {
      const prompt = PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan);
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: false,
        provider: this.name,
      });

      const result = await this.invokeModel(prompt, systemPrompt);
      if (!result) {
        throw new Error('No response from Bedrock for batch review');
      }

      const issues = this.parseAIResponse(result);
      return this.assignFilesToIssues(issues, files);
    } catch (error) {
      logger.error('Bedrock batch review error:', error);
      throw new Error(`Bedrock batch review failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async reviewArchitecture(
    fileChanges: FileChange[],
    rules: CursorRule[]
  ): Promise<ArchitecturalReviewResult> {
    try {
      const prompt = PromptTemplates.buildArchitecturalReviewPrompt(fileChanges, rules, {
        supportsJsonMode: false,
        provider: this.name,
      });

      const result = await this.invokeModel(prompt);
      if (!result) {
        throw new Error('No response from Bedrock for architectural review');
      }

      return this.parseArchitecturalResponse(result);
    } catch (error) {
      logger.error('Bedrock architectural review error:', error);
      throw new Error(`Bedrock architectural review failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = PromptTemplates.buildSummaryPrompt(issues, context);
      const systemPrompt =
        'You are a helpful code review assistant that creates concise, actionable PR review summaries.';

      const result = await this.invokeModel(prompt, systemPrompt);
      return result || 'Summary generation failed';
    } catch (error) {
      logger.error('Bedrock summary generation error:', error);
      throw new Error(`Bedrock summary generation error: ${this.extractErrorMessage(error)}`);
    }
  }
}
