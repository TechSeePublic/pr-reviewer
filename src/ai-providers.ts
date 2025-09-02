/**
 * AI providers for code review (OpenAI and Anthropic)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  ActionInputs,
  AIProvider,
  AIResponse,
  CodeIssue,
  CursorRule,
  FileChange,
  PRPlan,
  ReviewContext,
} from './types';
import { DEFAULT_MODELS, getRecommendedModel } from './config';
import { logger } from './logger';
import { PromptTemplates } from './prompt-templates';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
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
    } catch (error) {
      logger.error('OpenAI API error:', error);

      // Extract specific error message from OpenAI error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`OpenAI review failed: ${errorMessage}`);
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
        temperature: 0.1,
        max_tokens: 2000,
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
    prPlan: PRPlan
  ): Promise<CodeIssue[]> {
    try {
      const prompt = PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan);

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
        temperature: 0.1,
        max_tokens: 6000,
      };

      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.client.chat.completions.create(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI for batch review');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      logger.error('OpenAI batch review error:', error);
      throw new Error(`OpenAI batch review failed: ${error}`);
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
        temperature: 0.2,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      logger.error('OpenAI summary generation error:', error);

      // Extract specific error message from OpenAI error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`OpenAI summary generation error: ${errorMessage}`);
    }
  }

  private parseAIResponse(response: string): CodeIssue[] {
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

      const parsed: AIResponse = JSON.parse(cleanedResponse);
      return parsed.issues || [];
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON:', error);
      logger.warn('Response content:', response.substring(0, 500) + '...');
      // Try to extract issues from malformed JSON
      return this.extractIssuesFromText(response);
    }
  }

  private extractIssuesFromText(text: string): CodeIssue[] {
    // Fallback: try to extract issues from non-JSON response
    const issues: CodeIssue[] = [];

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

  private parsePRPlanResponse(response: string): PRPlan {
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

      return {
        overview: parsed.overview || 'No overview provided',
        keyChanges: parsed.keyChanges || parsed.key_changes || [],
        riskAreas: parsed.riskAreas || parsed.risk_areas || [],
        reviewFocus: parsed.reviewFocus || parsed.review_focus || [],
        context: parsed.context || 'No additional context provided',
      };
    } catch (error) {
      logger.warn('Failed to parse PR plan response as JSON:', error);
      // Return a fallback plan
      return {
        overview: 'Failed to generate PR plan overview',
        keyChanges: ['Unable to analyze changes'],
        riskAreas: ['Unknown risk areas'],
        reviewFocus: ['General code review'],
        context: 'PR plan generation failed',
      };
    }
  }
}

export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic';
  public readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || DEFAULT_MODELS.anthropic;
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: false,
        provider: this.name,
      });
      const userPrompt = PromptTemplates.buildUserPrompt(prompt, code);

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
    } catch (error) {
      logger.error('Anthropic API error:', error);

      // Extract specific error message from Anthropic error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`Anthropic review failed: ${errorMessage}`);
    }
  }

  async generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan> {
    try {
      const prompt = PromptTemplates.buildPRPlanPrompt(fileChanges, rules);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.1,
        system:
          'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.',
        messages: [{ role: 'user', content: prompt }],
      });

      const result = response.content[0];
      if (!result || result.type !== 'text') {
        throw new Error('No response from Anthropic for PR plan');
      }

      return this.parsePRPlanResponse(result.text);
    } catch (error) {
      logger.error('Anthropic PR plan generation error:', error);
      throw new Error(`Anthropic PR plan generation failed: ${error}`);
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

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 6000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const result = response.content[0];
      if (!result || result.type !== 'text') {
        throw new Error('No response from Anthropic for batch review');
      }

      return this.parseAIResponse(result.text);
    } catch (error) {
      logger.error('Anthropic batch review error:', error);
      throw new Error(`Anthropic batch review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = PromptTemplates.buildSummaryPrompt(issues, context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        temperature: 0.2,
        system:
          'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
        messages: [{ role: 'user', content: prompt }],
      });

      const result = response.content[0];
      return result && result.type === 'text' ? result.text : 'Summary generation failed';
    } catch (error) {
      logger.error('Anthropic summary generation error:', error);

      // Extract specific error message from Anthropic error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`Anthropic summary generation error: ${errorMessage}`);
    }
  }

  private parseAIResponse(response: string): CodeIssue[] {
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

      const parsed: AIResponse = JSON.parse(cleanedResponse);
      return parsed.issues || [];
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON:', error);
      logger.warn('Response content:', response.substring(0, 500) + '...');
      // Try to extract issues from malformed JSON
      return this.extractIssuesFromText(response);
    }
  }

  private extractIssuesFromText(text: string): CodeIssue[] {
    // Fallback: try to extract issues from non-JSON response
    const issues: CodeIssue[] = [];

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

  private parsePRPlanResponse(response: string): PRPlan {
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

      return {
        overview: parsed.overview || 'No overview provided',
        keyChanges: parsed.keyChanges || parsed.key_changes || [],
        riskAreas: parsed.riskAreas || parsed.risk_areas || [],
        reviewFocus: parsed.reviewFocus || parsed.review_focus || [],
        context: parsed.context || 'No additional context provided',
      };
    } catch (error) {
      logger.warn('Failed to parse PR plan response as JSON:', error);
      // Return a fallback plan
      return {
        overview: 'Failed to generate PR plan overview',
        keyChanges: ['Unable to analyze changes'],
        riskAreas: ['Unknown risk areas'],
        reviewFocus: ['General code review'],
        context: 'PR plan generation failed',
      };
    }
  }
}

export class AzureOpenAIProvider implements AIProvider {
  public readonly name = 'azure';
  public readonly model: string;
  private client: OpenAI;
  private modelCapabilities: {
    requiresMaxCompletionTokens?: boolean;
    detectionAttempted?: boolean;
    detectionFailed?: boolean;
  } = {};

  constructor(apiKey: string, endpoint: string, apiVersion: string, model?: string) {
    this.model = model || DEFAULT_MODELS.azure;
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

    return supportedModels.some(supportedModel => this.model.startsWith(supportedModel));
  }

  private async detectModelCapabilities(): Promise<void> {
    // If we already detected the capabilities, no need to test again
    if (this.modelCapabilities.detectionAttempted) {
      return;
    }

    // Mark that we've attempted detection to avoid repeated failures
    this.modelCapabilities.detectionAttempted = true;

    // First check if the deployment name matches known patterns
    const knownReasoningModels = ['o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'];
    const isKnownReasoningModel = knownReasoningModels.some(reasoningModel =>
      this.model.startsWith(reasoningModel)
    );

    if (isKnownReasoningModel) {
      this.modelCapabilities.requiresMaxCompletionTokens = true;
      logger.info(`✅ Model ${this.model} recognized as reasoning model by name pattern`);
      return;
    }

    // For custom deployment names, make a test request to detect the model type
    try {
      logger.info(`Detecting model capabilities for Azure deployment: ${this.model}`);

      // Try with max_tokens first (most common)
      try {
        await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0,
        });

        // If successful, this model uses max_tokens
        this.modelCapabilities.requiresMaxCompletionTokens = false;
        logger.info(`✅ Model ${this.model} confirmed to use max_tokens parameter`);
      } catch (error) {
        // Check if the error is specifically about max_tokens parameter
        const errorMessage = String(error);
        if (errorMessage.includes('max_tokens') && errorMessage.includes('max_completion_tokens')) {
          // This is a reasoning model that requires max_completion_tokens
          this.modelCapabilities.requiresMaxCompletionTokens = true;
          logger.info(
            `✅ Model ${this.model} confirmed to require max_completion_tokens parameter`
          );

          // Verify it works with max_completion_tokens
          await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: 'test' }],
            max_completion_tokens: 1,
            temperature: 0,
          });
        } else {
          // Some other error, assume standard model and let fallback handle it
          this.modelCapabilities.requiresMaxCompletionTokens = false;
          this.modelCapabilities.detectionFailed = true;
        }
      }
    } catch (error) {
      // Detection failed completely - mark it for dynamic fallback
      this.modelCapabilities.detectionFailed = true;
      this.modelCapabilities.requiresMaxCompletionTokens = false; // Start with false
      logger.warn(`⚠️ Detection failed for ${this.model}, will try both parameters dynamically`);
    }
  }

  private async requiresMaxCompletionTokens(): Promise<boolean> {
    await this.detectModelCapabilities();
    return this.modelCapabilities.requiresMaxCompletionTokens || false;
  }

  private async makeRequestWithFallback(requestConfig: any): Promise<any> {
    // If detection failed, try both parameters
    if (this.modelCapabilities.detectionFailed) {
      // First try with the current setting
      try {
        const usesMaxCompletionTokens = this.modelCapabilities.requiresMaxCompletionTokens;
        const configWithTokens = {
          ...requestConfig,
          ...(usesMaxCompletionTokens
            ? {
                max_completion_tokens:
                  requestConfig.max_tokens || requestConfig.max_completion_tokens,
              }
            : { max_tokens: requestConfig.max_tokens || requestConfig.max_completion_tokens }),
        };
        // Remove the other token parameter
        if (usesMaxCompletionTokens) {
          delete configWithTokens.max_tokens;
        } else {
          delete configWithTokens.max_completion_tokens;
        }

        return await this.client.chat.completions.create(configWithTokens);
      } catch (error) {
        const errorMessage = String(error);
        if (errorMessage.includes('max_tokens') && errorMessage.includes('max_completion_tokens')) {
          // Switch to the other parameter and cache the result
          this.modelCapabilities.requiresMaxCompletionTokens =
            !this.modelCapabilities.requiresMaxCompletionTokens;
          this.modelCapabilities.detectionFailed = false; // We found the right parameter

          const usesMaxCompletionTokens = this.modelCapabilities.requiresMaxCompletionTokens;
          const configWithTokens = {
            ...requestConfig,
            ...(usesMaxCompletionTokens
              ? {
                  max_completion_tokens:
                    requestConfig.max_tokens || requestConfig.max_completion_tokens,
                }
              : { max_tokens: requestConfig.max_tokens || requestConfig.max_completion_tokens }),
          };
          // Remove the other token parameter
          if (usesMaxCompletionTokens) {
            delete configWithTokens.max_tokens;
          } else {
            delete configWithTokens.max_completion_tokens;
          }

          logger.info(
            `✅ Found correct parameter for ${this.model}: ${usesMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens'}`
          );
          return await this.client.chat.completions.create(configWithTokens);
        } else {
          throw error; // Different error, re-throw
        }
      }
    } else {
      // Normal case - detection worked or we know the parameter
      const usesMaxCompletionTokens = await this.requiresMaxCompletionTokens();
      const configWithTokens = {
        ...requestConfig,
        ...(usesMaxCompletionTokens
          ? {
              max_completion_tokens:
                requestConfig.max_tokens || requestConfig.max_completion_tokens,
            }
          : { max_tokens: requestConfig.max_tokens || requestConfig.max_completion_tokens }),
      };
      // Remove the other token parameter
      if (usesMaxCompletionTokens) {
        delete configWithTokens.max_tokens;
      } else {
        delete configWithTokens.max_completion_tokens;
      }

      return await this.client.chat.completions.create(configWithTokens);
    }
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: this.supportsJsonMode(),
        provider: this.name,
      });
      const userPrompt = PromptTemplates.buildUserPrompt(prompt, code);

      // Build the request configuration
      const requestConfig: any = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000, // Will be converted to the right parameter in makeRequestWithFallback
      };

      // Only add response_format if the model supports it
      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.makeRequestWithFallback(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      logger.error('Azure OpenAI API error:', error);

      // Extract specific error message from Azure OpenAI error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`Azure OpenAI review failed: ${errorMessage}`);
    }
  }

  async generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan> {
    try {
      const prompt = PromptTemplates.buildPRPlanPrompt(fileChanges, rules);

      const requestConfig: any = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code reviewer who analyzes pull requests to create comprehensive review plans. Focus on understanding the overall changes and their implications.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        ...(this.supportsJsonMode() && { response_format: { type: 'json_object' } }),
      };

      const response = await this.makeRequestWithFallback(requestConfig);

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
    prPlan: PRPlan
  ): Promise<CodeIssue[]> {
    try {
      const prompt = PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan);

      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
        supportsJsonMode: this.supportsJsonMode(),
        provider: this.name,
      });

      const requestConfig: any = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      };

      if (this.supportsJsonMode()) {
        requestConfig.response_format = { type: 'json_object' };
      }

      const response = await this.makeRequestWithFallback(requestConfig);

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI for batch review');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      logger.error('Azure OpenAI batch review error:', error);
      throw new Error(`Azure OpenAI batch review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = PromptTemplates.buildSummaryPrompt(issues, context);

      const requestConfig: any = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      };

      const response = await this.makeRequestWithFallback(requestConfig);

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      logger.error('Azure OpenAI summary generation error:', error);

      // Extract specific error message from Azure OpenAI error
      let errorMessage = 'Unknown error';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if (
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'message' in error.error
        ) {
          errorMessage = String(error.error.message);
        }
      }

      throw new Error(`Azure OpenAI summary generation error: ${errorMessage}`);
    }
  }

  private parseAIResponse(response: string): CodeIssue[] {
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

      const parsed: AIResponse = JSON.parse(cleanedResponse);
      return parsed.issues || [];
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON:', error);
      logger.warn('Response content:', response.substring(0, 500) + '...');
      // Try to extract issues from malformed JSON
      return this.extractIssuesFromText(response);
    }
  }

  private extractIssuesFromText(text: string): CodeIssue[] {
    // Fallback: try to extract issues from non-JSON response
    const issues: CodeIssue[] = [];

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

  private parsePRPlanResponse(response: string): PRPlan {
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

      return {
        overview: parsed.overview || 'No overview provided',
        keyChanges: parsed.keyChanges || parsed.key_changes || [],
        riskAreas: parsed.riskAreas || parsed.risk_areas || [],
        reviewFocus: parsed.reviewFocus || parsed.review_focus || [],
        context: parsed.context || 'No additional context provided',
      };
    } catch (error) {
      logger.warn('Failed to parse PR plan response as JSON:', error);
      // Return a fallback plan
      return {
        overview: 'Failed to generate PR plan overview',
        keyChanges: ['Unable to analyze changes'],
        riskAreas: ['Unknown risk areas'],
        reviewFocus: ['General code review'],
        context: 'PR plan generation failed',
      };
    }
  }
}

export class AIProviderFactory {
  static create(inputs: ActionInputs): AIProvider {
    const { provider, model } = this.resolveProviderAndModel(inputs);

    logger.info(`Using AI provider: ${provider}, model: ${model}`);

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

    if (provider === 'azure') {
      if (!inputs.azureOpenaiApiKey || !inputs.azureOpenaiEndpoint) {
        throw new Error('Azure OpenAI API key and endpoint are required');
      }
      return new AzureOpenAIProvider(
        inputs.azureOpenaiApiKey,
        inputs.azureOpenaiEndpoint,
        inputs.azureOpenaiApiVersion || '2024-10-21',
        model
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

    return providers;
  }

  static getModelRecommendations(reviewLevel: string): Record<string, string> {
    return {
      openai: getRecommendedModel('openai', reviewLevel),
      anthropic: getRecommendedModel('anthropic', reviewLevel),
      azure: getRecommendedModel('azure', reviewLevel),
    };
  }
}
