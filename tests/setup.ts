/**
 * Test setup and global mocks
 */

// Mock GitHub Actions core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  debug: jest.fn(),
}));

// Mock GitHub Actions github
jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    payload: {
      pull_request: {
        number: 123,
        head: { sha: 'head-sha' },
        base: { sha: 'base-sha' },
      },
    },
  },
  getOctokit: jest.fn(),
}));

// Mock OpenAI
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock file system operations for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
}));

// Global test timeout
jest.setTimeout(30000);
