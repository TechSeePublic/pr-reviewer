/**
 * Azure OpenAI provider for code review
 */

import OpenAI from 'openai';
import {
  ArchitecturalReviewResult,
  CodeIssue,
  CursorRule,
  FileChange,
  InlineComment,
  PRPlan,
  ReviewContext,
} from '../types';
import { DEFAULT_MODELS } from '../config';
import { logger } from '../logger';
import { PromptTemplates } from '../prompt-templates';
import { BaseAIProvider } from './base-provider';

export class AzureOpenAIProvider extends BaseAIProvider {
  public readonly name = 'azure';
  public readonly model: string;
  private readonly realModel?: string;
  private client: OpenAI;

  constructor(
    apiKey: string,
    endpoint: string,
    apiVersion: string,
    model?: string,
    realModel?: string,
    deterministicMode: boolean = true
  ) {
    super(deterministicMode);
    this.model = model || DEFAULT_MODELS.azure;
    if (realModel) {
      this.realModel = realModel;
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${this.model}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });
  }

  private supportsJsonMode(): boolean {
    // Models that support response_format: { type: 'json_object' }
    const supportedModels = [
      // 2025 Models (all support JSON mode)
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
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-35-turbo',
    ];

    // Use realModel if provided (for custom Azure deployment names), otherwise fall back to deployment name
    const modelToCheck = this.realModel || this.model;
    return supportedModels.some(supportedModel => modelToCheck.startsWith(supportedModel));
  }

  public requiresMaxCompletionTokens(): boolean {
    // Models that require max_completion_tokens instead of max_tokens
    const reasoningModels = ['o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'];

    // Use realModel if provided (for custom Azure deployment names), otherwise fall back to deployment name
    const modelToCheck = this.realModel || this.model;
    return reasoningModels.some(reasoningModel => modelToCheck.startsWith(reasoningModel));
  }

  public supportsTemperature(): boolean {
    // Reasoning models don't support temperature parameter
    return !this.requiresMaxCompletionTokens();
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: this.supportsJsonMode(),
        provider: this.name,
      });
      const userPrompt = PromptTemplates.buildUserPrompt(prompt, code);

      // Build the request configuration
      const requestConfig: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(this.supportsTemperature() && { temperature: 0.1 }),
        ...(this.requiresMaxCompletionTokens()
          ? { max_completion_tokens: 8000 }
          : { max_tokens: 8000 }),
      };

      // Only add response_format if the model supports it
      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      logger.error('Azure OpenAI API error:', error);
      throw new Error(`Azure OpenAI review failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan> {
    try {
      const prompt = PromptTemplates.buildPRPlanPrompt(fileChanges, rules);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.',
          },
          { role: 'user', content: prompt },
        ],
        ...(this.supportsTemperature() && { temperature: 0.1 }),
        ...(this.requiresMaxCompletionTokens()
          ? { max_completion_tokens: 4000 }
          : { max_tokens: 4000 }),
        ...(this.supportsJsonMode() && { response_format: { type: 'json_object' } }),
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI for PR plan');
      }

      return this.parsePRPlanResponse(result);
    } catch (error) {
      logger.error('Azure OpenAI PR plan generation error:', error);
      throw new Error(`Azure OpenAI PR plan generation failed: ${error}`);
    }
  }

  async reviewBatch(
    files: FileChange[],
    rules: CursorRule[],
    prPlan: PRPlan,
    existingComments?: InlineComment[]
  ): Promise<CodeIssue[]> {
    try {
      const prompt = PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan, existingComments);

      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: this.supportsJsonMode(),
        provider: this.name,
      });

      const requestConfig: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        ...(this.supportsTemperature() && { temperature: 0.1 }),
        ...(this.requiresMaxCompletionTokens()
          ? { max_completion_tokens: 12000 }
          : { max_tokens: 12000 }),
      };

      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI for batch review');
      }

      const issues = this.parseAIResponse(result);

      // Ensure all issues have valid file names
      return this.assignFilesToIssues(issues, files);
    } catch (error) {
      logger.error('Azure OpenAI batch review error:', error);
      throw new Error(`Azure OpenAI batch review failed: ${error}`);
    }
  }

  async reviewArchitecture(
    fileChanges: FileChange[],
    rules: CursorRule[]
  ): Promise<ArchitecturalReviewResult> {
    try {
      const prompt = PromptTemplates.buildArchitecturalReviewPrompt(fileChanges, rules, {
        supportsJsonMode: this.supportsJsonMode(),
        provider: this.name,
      });

      // Build the request configuration
      const requestConfig: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        ...(this.supportsTemperature() && {
          temperature: this.deterministicMode ? 0.0 : 0.1,
        }),
        ...(this.requiresMaxCompletionTokens()
          ? { max_completion_tokens: 8000 }
          : { max_tokens: 8000 }),
      };

      // Only add response_format if the model supports it
      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      return this.parseArchitecturalResponse(result);
    } catch (error) {
      logger.error('Azure OpenAI architectural review error:', error);
      throw new Error(`Azure OpenAI architectural review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = PromptTemplates.buildSummaryPrompt(issues, context);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
          },
          { role: 'user', content: prompt },
        ],
        ...(this.supportsTemperature() && { temperature: 0.2 }),
        ...(this.requiresMaxCompletionTokens()
          ? { max_completion_tokens: 3000 }
          : { max_tokens: 3000 }),
      });

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      logger.error('Azure OpenAI summary generation error:', error);
      throw new Error(`Azure OpenAI summary generation error: ${this.extractErrorMessage(error)}`);
    }
  }
}
