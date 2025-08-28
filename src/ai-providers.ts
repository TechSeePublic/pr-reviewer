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
  ReviewContext
} from './types';
import { DEFAULT_MODELS, getModelInfo, getRecommendedModel } from './config';
import { logger } from './logger';

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
      'gpt-3.5-turbo-0125'
    ];

    return supportedModels.some(supportedModel =>
      this.model.startsWith(supportedModel)
    );
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = this.buildSystemPrompt(rules);
      const userPrompt = this.buildUserPrompt(prompt, code);

      // Build the request configuration
      const requestConfig: any = {
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
      throw new Error(`OpenAI review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = this.buildSummaryPrompt(issues, context);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful code review assistant that creates concise, actionable PR review summaries.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content || 'Summary generation failed';
    } catch (error) {
      logger.error('OpenAI summary generation error:', error);
      return 'Failed to generate summary';
    }
  }

  private buildSystemPrompt(rules: CursorRule[]): string {
    const jsonInstructions = this.supportsJsonMode()
      ? "5. Return responses in valid JSON format only"
      : "5. Return responses in valid JSON format only (start your response with { and end with })";

    let prompt = `You are a comprehensive code review assistant that analyzes code changes for:
1. Violations of provided Cursor AI rules
2. General code quality issues and potential bugs
3. Security vulnerabilities
4. Performance issues
5. Best practices violations

IMPORTANT INSTRUCTIONS:
1. Prioritize violations of the provided Cursor rules when they exist
2. Also identify potential bugs, security issues, and code quality problems
3. Focus on the actual code changes, not existing code unless it's directly related to the changes
4. Provide specific, actionable feedback with line numbers when possible
${jsonInstructions}
6. Be concise but helpful in your explanations
7. Only flag issues that are related to the actual changes in the PR

CURSOR RULES TO FOLLOW:
`;

    rules.forEach((rule, index) => {
      prompt += `\n${index + 1}. RULE "${rule.id}" (${rule.type}):`;
      if (rule.description) {
        prompt += `\n   Description: ${rule.description}`;
      }
      prompt += `\n   Content: ${rule.content}`;
      if (rule.globs && rule.globs.length > 0) {
        prompt += `\n   Applies to: ${rule.globs.join(', ')}`;
      }
      prompt += '\n';
    });

    prompt += `
RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "issues": [
    {
      "type": "error|warning|info|suggestion",
      "category": "rule_violation|bug|security|performance|best_practice",
      "message": "Brief issue description",
      "description": "Detailed explanation",
      "suggestion": "Specific fix suggestion (optional)",
      "fixedCode": "Complete corrected code for auto-fix (optional)",
      "ruleId": "cursor_rule_id or general_code_review",
      "ruleName": "Human readable rule name or issue category",
      "file": "filename",
      "line": 0,
      "severity": "high|medium|low"
    }
  ],
  "confidence": 0.95,
  "reasoning": "Brief explanation of analysis approach"
}`;

    return prompt;
  }

  private buildUserPrompt(context: string, code: string): string {
    return `${context}

CODE TO REVIEW:
\`\`\`
${code}
\`\`\`

Please analyze this code against the Cursor rules and return any violations or suggestions in the specified JSON format.`;
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

  private buildSummaryPrompt(issues: CodeIssue[], context: ReviewContext): string {
    const { prContext, fileChanges, cursorRules } = context;

    return `Generate a comprehensive PR review summary for:
Repository: ${prContext.owner}/${prContext.repo}
PR #${prContext.pullNumber}
Files changed: ${fileChanges.length}
Cursor rules applied: ${cursorRules.projectRules.length}

ISSUES FOUND:
${issues.map(issue => `- ${issue.type.toUpperCase()}: ${issue.message} (${issue.file}:${issue.line || 'unknown'})`).join('\n')}

Please create a summary that includes:
1. Overall assessment (passed/needs attention/failed)
2. Key issues by category
3. Rules that were applied
4. Actionable next steps
5. Positive feedback where appropriate

Keep it professional, constructive, and actionable. Use markdown formatting.`;
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
      const systemPrompt = this.buildSystemPrompt(rules);
      const userPrompt = this.buildUserPrompt(prompt, code);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });

      const result = response.content[0];
      if (!result || result.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return this.parseAIResponse(result.text);
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw new Error(`Anthropic review failed: ${error}`);
    }
  }

  async generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string> {
    try {
      const prompt = this.buildSummaryPrompt(issues, context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        temperature: 0.2,
        system: 'You are a helpful code review assistant that creates concise, actionable PR review summaries.',
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      const result = response.content[0];
      return result && result.type === 'text' ? result.text : 'Summary generation failed';
    } catch (error) {
      logger.error('Anthropic summary generation error:', error);
      return 'Failed to generate summary';
    }
  }

  // Anthropic doesn't support JSON mode, so we need our own methods
  private buildSystemPrompt(rules: CursorRule[]): string {
    let prompt = `You are a comprehensive code review assistant that analyzes code changes for:
1. Violations of provided Cursor AI rules
2. General code quality issues and potential bugs
3. Security vulnerabilities
4. Performance issues
5. Best practices violations

IMPORTANT INSTRUCTIONS:
1. Prioritize violations of the provided Cursor rules when they exist
2. Also identify potential bugs, security issues, and code quality problems
3. Focus on the actual code changes, not existing code unless it's directly related to the changes
4. Provide specific, actionable feedback with line numbers when possible
5. Return responses in valid JSON format only (start your response with { and end with })
6. Be concise but helpful in your explanations
7. Only flag issues that are related to the actual changes in the PR

CURSOR RULES TO FOLLOW:
`;

    rules.forEach((rule, index) => {
      prompt += `\n${index + 1}. RULE "${rule.id}" (${rule.type}):`;
      if (rule.description) {
        prompt += `\n   Description: ${rule.description}`;
      }
      prompt += `\n   Content: ${rule.content}`;
      if (rule.globs && rule.globs.length > 0) {
        prompt += `\n   Applies to: ${rule.globs.join(', ')}`;
      }
      prompt += '\n';
    });

    prompt += `
RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "issues": [
    {
      "type": "error|warning|info|suggestion",
      "category": "rule_violation|bug|security|performance|best_practice",
      "message": "Brief issue description",
      "description": "Detailed explanation",
      "suggestion": "Specific fix suggestion (optional)",
      "fixedCode": "Complete corrected code for auto-fix (optional)",
      "ruleId": "cursor_rule_id or general_code_review",
      "ruleName": "Human readable rule name or issue category",
      "file": "filename",
      "line": 0,
      "severity": "high|medium|low"
    }
  ],
  "confidence": 0.95,
  "reasoning": "Brief explanation of analysis approach"
}`;

    return prompt;
  }

  private buildUserPrompt(context: string, code: string): string {
    return `${context}

CODE TO REVIEW:
\`\`\`
${code}
\`\`\`

Please analyze this code against the Cursor rules and return any violations or suggestions in the specified JSON format.`;
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

  private buildSummaryPrompt(issues: CodeIssue[], context: ReviewContext): string {
    const { prContext, fileChanges, cursorRules } = context;

    return `Generate a comprehensive PR review summary for:
Repository: ${prContext.owner}/${prContext.repo}
PR #${prContext.pullNumber}
Files changed: ${fileChanges.length}
Cursor rules applied: ${cursorRules.projectRules.length}

ISSUES FOUND:
${issues.map(issue => `- ${issue.type.toUpperCase()}: ${issue.message} (${issue.file}:${issue.line || 'unknown'})`).join('\n')}

Please create a summary that includes:
1. Overall assessment (passed/needs attention/failed)
2. Key issues by category
3. Rules that were applied
4. Actionable next steps
5. Positive feedback where appropriate

Keep it professional, constructive, and actionable. Use markdown formatting.`;
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
      // If specific model is provided, validate it matches the provider
      const modelInfo = getModelInfo(model);
      if (modelInfo && modelInfo.provider !== provider) {
        throw new Error(
          `Model "${model}" is not compatible with provider "${provider}". ` +
          `This model requires provider "${modelInfo.provider}".`
        );
      }
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

    return providers;
  }

  static getModelRecommendations(reviewLevel: string): Record<string, string> {
    return {
      openai: getRecommendedModel('openai', reviewLevel),
      anthropic: getRecommendedModel('anthropic', reviewLevel),
    };
  }
}
