/**
 * AI providers for code review (OpenAI and Anthropic)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { 
  AIProvider, 
  CodeIssue, 
  CursorRule, 
  ReviewContext, 
  AIResponse,
  ActionInputs 
} from './types';
import { DEFAULT_MODELS } from './config';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || DEFAULT_MODELS.openai;
  }

  async reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]> {
    try {
      const systemPrompt = this.buildSystemPrompt(rules);
      const userPrompt = this.buildUserPrompt(prompt, code);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseAIResponse(result);
    } catch (error) {
      console.error('OpenAI API error:', error);
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
      console.error('OpenAI summary generation error:', error);
      return 'Failed to generate summary';
    }
  }

  private buildSystemPrompt(rules: CursorRule[]): string {
    let prompt = `You are a code review assistant that analyzes code changes according to specific Cursor AI rules.

IMPORTANT INSTRUCTIONS:
1. Only flag violations of the provided Cursor rules - do not invent new rules
2. Focus on the actual code changes, not existing code unless it's directly related
3. Provide specific, actionable feedback with line numbers when possible
4. Return responses in valid JSON format only
5. Be concise but helpful in your explanations

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
      "message": "Brief issue description",
      "description": "Detailed explanation",
      "suggestion": "Specific fix suggestion (optional)",
      "ruleId": "cursor_rule_id",
      "ruleName": "Human readable rule name",
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
      const parsed: AIResponse = JSON.parse(response);
      return parsed.issues || [];
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
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
      console.error('Anthropic API error:', error);
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
      console.error('Anthropic summary generation error:', error);
      return 'Failed to generate summary';
    }
  }

  // Reuse the same helper methods as OpenAI
  private buildSystemPrompt = OpenAIProvider.prototype['buildSystemPrompt'];
  private buildUserPrompt = OpenAIProvider.prototype['buildUserPrompt'];
  private parseAIResponse = OpenAIProvider.prototype['parseAIResponse'];
  private extractIssuesFromText = OpenAIProvider.prototype['extractIssuesFromText'];
  private buildSummaryPrompt = OpenAIProvider.prototype['buildSummaryPrompt'];
}

export class AIProviderFactory {
  static create(inputs: ActionInputs): AIProvider {
    // Auto-detect provider based on available API keys
    if (inputs.aiProvider === 'auto') {
      if (inputs.openaiApiKey) {
        return new OpenAIProvider(inputs.openaiApiKey, inputs.model === 'auto' ? undefined : inputs.model);
      } else if (inputs.anthropicApiKey) {
        return new AnthropicProvider(inputs.anthropicApiKey, inputs.model === 'auto' ? undefined : inputs.model);
      } else {
        throw new Error('No AI provider API key available');
      }
    }

    // Use specific provider
    if (inputs.aiProvider === 'openai') {
      if (!inputs.openaiApiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new OpenAIProvider(inputs.openaiApiKey, inputs.model === 'auto' ? undefined : inputs.model);
    }

    if (inputs.aiProvider === 'anthropic') {
      if (!inputs.anthropicApiKey) {
        throw new Error('Anthropic API key is required');
      }
      return new AnthropicProvider(inputs.anthropicApiKey, inputs.model === 'auto' ? undefined : inputs.model);
    }

    throw new Error(`Unsupported AI provider: ${inputs.aiProvider}`);
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
}
