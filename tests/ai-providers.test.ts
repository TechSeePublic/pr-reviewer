/**
 * Tests for AI providers
 */

import { OpenAIProvider, AnthropicProvider, AIProviderFactory } from '../src/ai-providers';
import { ActionInputs, CursorRule } from '../src/types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Mock the AI libraries
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('../src/logger');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe('AI Providers', () => {
  const mockRule: CursorRule = {
    id: 'test-rule',
    type: 'always',
    content: 'Always use TypeScript types',
    filePath: 'test.mdc',
    description: 'Test rule',
  };

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    let mockCreate: jest.MockedFunction<any>;

    beforeEach(() => {
      mockCreate = jest.fn();
      const mockClient = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any;

      MockedOpenAI.mockImplementation(() => mockClient);
      provider = new OpenAIProvider('test-api-key');
    });

    it('should review code and return issues', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              issues: [{
                type: 'warning',
                message: 'Missing type annotation',
                description: 'Function parameter should have type',
                ruleId: 'test-rule',
                ruleName: 'Test Rule',
                file: 'test.ts',
                line: 5,
                severity: 'medium',
              }],
              confidence: 0.9,
            }),
          },
        }],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const issues = await provider.reviewCode('context', 'const fn = (x) => x;', [mockRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.type).toBe('warning');
      expect(issues[0]?.message).toBe('Missing type annotation');
    });

    it('should handle malformed JSON responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response with violation mentioned',
          },
        }],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const issues = await provider.reviewCode('context', 'code', [mockRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.ruleId).toBe('unknown');
    });

    it('should generate summary', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Review summary with key findings',
          },
        }],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const mockContext = {
        prContext: { owner: 'test', repo: 'test', pullNumber: 1 },
        fileChanges: [],
        cursorRules: { projectRules: [] },
      } as any;
      
      const summary = await provider.generateSummary([], mockContext);

      expect(summary).toBe('Review summary with key findings');
    });
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;
    let mockCreate: jest.MockedFunction<any>;

    beforeEach(() => {
      mockCreate = jest.fn();
      const mockClient = {
        messages: {
          create: mockCreate,
        },
      } as any;

      MockedAnthropic.mockImplementation(() => mockClient);
      provider = new AnthropicProvider('test-api-key');
    });

    it('should review code using Anthropic API', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            issues: [{
              type: 'error',
              message: 'Syntax error',
              description: 'Invalid syntax detected',
              ruleId: 'test-rule',
              ruleName: 'Test Rule',
              file: 'test.ts',
              line: 1,
              severity: 'high',
            }],
          }),
        }],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const issues = await provider.reviewCode('context', 'invalid code', [mockRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.type).toBe('error');
    });
  });

  describe('AIProviderFactory', () => {
    it('should create OpenAI provider when specified', () => {
      const inputs: ActionInputs = {
        aiProvider: 'openai',
        openaiApiKey: 'test-key',
      } as ActionInputs;

      const provider = AIProviderFactory.create(inputs);

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.name).toBe('openai');
    });

    it('should create Anthropic provider when specified', () => {
      const inputs: ActionInputs = {
        aiProvider: 'anthropic',
        anthropicApiKey: 'test-key',
      } as ActionInputs;

      const provider = AIProviderFactory.create(inputs);

      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.name).toBe('anthropic');
    });

    it('should auto-detect provider based on available keys', () => {
      const inputs: ActionInputs = {
        aiProvider: 'auto',
        openaiApiKey: 'test-key',
      } as ActionInputs;

      const provider = AIProviderFactory.create(inputs);

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw error when no API keys provided', () => {
      const inputs: ActionInputs = {
        aiProvider: 'auto',
      } as ActionInputs;

      expect(() => AIProviderFactory.create(inputs)).toThrow('No AI provider API key available');
    });

    it('should list available providers', () => {
      const inputs: ActionInputs = {
        openaiApiKey: 'key1',
        anthropicApiKey: 'key2',
      } as ActionInputs;

      const providers = AIProviderFactory.getAvailableProviders(inputs);

      expect(providers).toEqual(['openai', 'anthropic']);
    });
  });
});
