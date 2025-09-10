/**
 * Anthropic provider for code review
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider extends BaseAIProvider {
  public readonly name = 'anthropic';
  public readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model?: string, deterministicMode: boolean = true) {
    super(deterministicMode);
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
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw new Error(`Anthropic review failed: ${this.extractErrorMessage(error)}`);
    }
  }

  async generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan> {
    try {
      const prompt = PromptTemplates.buildPRPlanPrompt(fileChanges, rules);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: this.deterministicMode ? 0.0 : 0.1,
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
    prPlan: PRPlan,
    existingComments?: InlineComment[]
  ): Promise<CodeIssue[]> {
    try {
      const prompt = PromptTemplates.buildBatchReviewPrompt(files, rules, prPlan, existingComments);
      const systemPrompt = PromptTemplates.buildCodeReviewSystemPrompt(rules, {
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
    } catch (error) {
      logger.error('Anthropic batch review error:', error);
      throw new Error(`Anthropic batch review failed: ${error}`);
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
    } catch (error) {
      logger.error('Anthropic architectural review error:', error);
      throw new Error(`Anthropic architectural review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = PromptTemplates.buildSummaryPrompt(issues, context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        temperature: this.deterministicMode ? 0.0 : 0.1,
        system:
          'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
        messages: [{ role: 'user', content: prompt }],
      });

      const result = response.content[0];
      return result && result.type === 'text' ? result.text : 'Summary generation failed';
    } catch (error) {
      logger.error('Anthropic summary generation error:', error);
      throw new Error(`Anthropic summary generation error: ${this.extractErrorMessage(error)}`);
    }
  }
}
