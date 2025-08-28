/**
 * Integration tests for the complete PR review flow
 */

import { PRReviewer } from '../src/pr-reviewer';
import { ActionInputs } from '../src/types';
import * as fs from 'fs';
import { PathLike } from 'fs';
import OpenAI from 'openai';

// Mock everything for integration test
jest.mock('fs');
jest.mock('@actions/github');
jest.mock('openai');
jest.mock('../src/logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('PR Reviewer Integration', () => {
  const mockInputs: ActionInputs = {
    githubToken: 'test-token',
    openaiApiKey: 'test-openai-key',
    aiProvider: 'openai',
    model: 'gpt-4',
    reviewLevel: 'standard',
    includePatterns: ['**/*.ts', '**/*.tsx'],
    excludePatterns: ['node_modules/**'],
    maxFiles: 50,
    commentStyle: 'both',
    inlineSeverity: 'warning',
    summaryFormat: 'detailed',
    enableSuggestions: true,
    skipIfNoRules: false,
    updateExistingComments: true,
    enableAutoFix: false,
    autoFixSeverity: 'error',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock GitHub API responses
    const mockOctokit = {
      rest: {
        pulls: {
          get: jest.fn().mockResolvedValue({
            data: { id: 123, number: 456 }
          }),
          listFiles: jest.fn().mockResolvedValue({
            data: [
              {
                filename: 'src/test.ts',
                status: 'modified',
                additions: 10,
                deletions: 2,
                changes: 12,
                patch: '@@ -1,3 +1,4 @@\n const x = 1;\n+const y: number = 2;'
              }
            ]
          }),
          createReviewComment: jest.fn().mockResolvedValue({ data: { id: 789 } }),
          listReviewComments: jest.fn().mockResolvedValue({ data: [] }),
        },
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: {
              type: 'file',
              content: Buffer.from('const x = 1;\nconst y: number = 2;').toString('base64'),
              encoding: 'base64',
            }
          }),
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 999 } }),
          listComments: jest.fn().mockResolvedValue({ data: [] }),
        },
        rateLimit: {
          get: jest.fn().mockResolvedValue({
            data: { rate: { remaining: 5000, limit: 5000, reset: Date.now() / 1000 + 3600 } }
          }),
        },
      },
    };

    require('@actions/github').getOctokit.mockReturnValue(mockOctokit);
  });

  it('should complete full review flow', async () => {
    // Setup file system mocks for cursor rules
    mockFs.existsSync.mockImplementation((path: PathLike) => {
      return path.toString().includes('.cursor/rules');
    });

    mockFs.readdirSync.mockReturnValue([
      { name: 'typescript.mdc', isDirectory: () => false, isFile: () => true }
    ] as any);

    mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
      const pathStr = path.toString();
      if (pathStr.includes('typescript.mdc')) {
        return `---
description: TypeScript rules
globs: ["**/*.ts"]
---
Always use explicit types for variables.`;
      }
      return '';
    });

    // Mock AI provider response
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            issues: [{
              type: 'warning',
              message: 'Variable should have explicit type',
              description: 'The variable x lacks type annotation',
              ruleId: 'typescript',
              ruleName: 'TypeScript Rules',
              file: 'src/test.ts',
              line: 1,
              severity: 'medium',
              suggestion: 'const x: number = 1;'
            }],
            confidence: 0.85
          })
        }
      }]
    });

    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } }
    }) as any);

    const reviewer = new PRReviewer(mockInputs, '/mock/workspace');
    const result = await reviewer.reviewPR();

    expect(result.status).toBe('needs_attention');
    expect(result.issues).toHaveLength(1);
    expect(result.filesReviewed).toBe(1);
    expect(result.rulesApplied).toHaveLength(1);

    // Verify AI was called
    expect(mockCreate).toHaveBeenCalled();

    // Verify comments were posted
    const mockOctokit = require('@actions/github').getOctokit();
    expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalled();
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
  }, 30000);

  it('should skip review when no rules found', async () => {
    const skipInputs = { ...mockInputs, skipIfNoRules: true };

    // No cursor rules found
    mockFs.existsSync.mockReturnValue(false);

    const reviewer = new PRReviewer(skipInputs, '/mock/workspace');
    const result = await reviewer.reviewPR();

    expect(result.status).toBe('passed');
    expect(result.issues).toHaveLength(0);
    expect(result.summary).toContain('No Cursor rules found');
  });

  it('should handle AI provider errors gracefully', async () => {
    // Setup basic cursor rules
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      { name: 'test.mdc', isDirectory: () => false, isFile: () => true }
    ] as any);
    mockFs.readFileSync.mockReturnValue('Test rule content');

    // Mock AI provider to throw error
    MockedOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }
    }) as any);

    const reviewer = new PRReviewer(mockInputs, '/mock/workspace');

    // Should not throw, but handle error gracefully
    const result = await reviewer.reviewPR();

    expect(result.status).toBe('passed'); // No issues found due to error
    expect(result.issues).toHaveLength(0);
  });
});
