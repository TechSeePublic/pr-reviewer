/**
 * OpenAI provider for code review
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

export class OpenAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model?: string, deterministicMode: boolean = true) {
    super(deterministicMode);
    this.client = new OpenAI({ apiKey });
    this.model = model || DEFAULT_MODELS.openai;
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
      // Legacy Models
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
    ];

    return supportedModels.some(supportedModel => this.model.startsWith(supportedModel));
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
        temperature: this.deterministicMode ? 0.0 : 0.1,
        max_tokens: 8000,
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
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error(`OpenAI review failed: ${this.extractErrorMessage(error)}`);
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
        temperature: this.deterministicMode ? 0.0 : 0.1,
        max_tokens: 4000,
        ...(this.supportsJsonMode() && { response_format: { type: 'json_object' } }),
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI for PR plan');
      }

      return this.parsePRPlanResponse(result);
    } catch (error) {
      logger.error('OpenAI PR plan generation error:', error);
      throw new Error(`OpenAI PR plan generation failed: ${error}`);
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
        temperature: this.deterministicMode ? 0.0 : 0.1,
        max_tokens: 12000,
      };

      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI for batch review');
      }

      const issues = this.parseAIResponse(result);

      // Ensure all issues have valid file names
      return this.assignFilesToIssues(issues, files);
    } catch (error) {
      logger.error('OpenAI batch review error:', error);
      throw new Error(`OpenAI batch review failed: ${error}`);
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
        temperature: this.deterministicMode ? 0.0 : 0.1,
        max_tokens: 8000,
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

      return this.parseArchitecturalResponse(result);
    } catch (error) {
      logger.error('OpenAI architectural review error:', error);
      throw new Error(`OpenAI architectural review failed: ${error}`);
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
        temperature: this.deterministicMode ? 0.0 : 0.1,
        max_tokens: 3000,
      });

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      logger.error('OpenAI summary generation error:', error);
      throw new Error(`OpenAI summary generation error: ${this.extractErrorMessage(error)}`);
    }
  }

  public requiresMaxCompletionTokens(): boolean {
    // Models that require max_completion_tokens instead of max_tokens
    const reasoningModels = ['o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'];
    return reasoningModels.some(reasoningModel => this.model.startsWith(reasoningModel));
  }

  public supportsTemperature(): boolean {
    // Reasoning models don't support temperature parameter
    return !this.requiresMaxCompletionTokens();
  }
}
