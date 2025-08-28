/**
 * Tests for CursorRulesParser
 */

import * as fs from 'fs';
import * as path from 'path';
import { PathLike } from 'fs';
import { CursorRulesParser } from '../src/cursor-parser';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('CursorRulesParser', () => {
  let parser: CursorRulesParser;
  const basePath = '/mock/project';

  beforeEach(() => {
    parser = new CursorRulesParser(basePath);
    jest.clearAllMocks();
  });

  describe('parseAllRules', () => {
    it('should parse project rules, AGENTS.md, and legacy rules', async () => {
      // Mock file system structure
      mockFs.existsSync.mockImplementation((filePath: PathLike) => {
        const filePathStr = filePath.toString();
        return [
          path.join(basePath, '.cursor', 'rules'),
          path.join(basePath, 'AGENTS.md'),
          path.join(basePath, '.cursorrules'),
        ].includes(filePathStr);
      });

      mockFs.readdirSync.mockReturnValue([
        { name: 'typescript.mdc', isDirectory: () => false, isFile: () => true },
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const filePathStr = filePath.toString();
        if (filePathStr.includes('typescript.mdc')) {
          return `---
description: TypeScript rules
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# TypeScript Rules
Always use strict typing.`;
        }
        if (filePathStr.includes('AGENTS.md')) {
          return '# Agent Instructions\nBe helpful and concise.';
        }
        if (filePathStr.includes('.cursorrules')) {
          return 'Legacy rule content';
        }
        return '';
      });

      const config = await parser.parseAllRules();

      expect(config.projectRules).toHaveLength(1);
      expect(config.projectRules[0]?.id).toBe('typescript');
      expect(config.projectRules[0]?.type).toBe('auto_attached');
      expect(config.agentsMarkdown).toBe('# Agent Instructions\nBe helpful and concise.');
      expect(config.legacyRules).toBe('Legacy rule content');
    });

    it('should handle missing rules gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = await parser.parseAllRules();

      expect(config.projectRules).toHaveLength(0);
      expect(config.agentsMarkdown).toBeUndefined();
      expect(config.legacyRules).toBeUndefined();
    });
  });

  describe('filterRulesForFiles', () => {
    const mockRules = [
      {
        id: 'always-rule',
        type: 'always' as const,
        alwaysApply: true,
        content: 'Always applied',
        filePath: 'always.mdc',
      },
      {
        id: 'ts-rule',
        type: 'auto_attached' as const,
        globs: ['**/*.ts', '**/*.tsx'],
        content: 'TypeScript rule',
        filePath: 'typescript.mdc',
      },
      {
        id: 'js-rule',
        type: 'auto_attached' as const,
        globs: ['**/*.js'],
        content: 'JavaScript rule',
        filePath: 'javascript.mdc',
      },
      {
        id: 'manual-rule',
        type: 'manual' as const,
        content: 'Manual rule',
        filePath: 'manual.mdc',
      },
    ];

    it('should include always-apply rules', () => {
      const files = ['src/test.py'];
      const filtered = parser.filterRulesForFiles(mockRules, files);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('always-rule');
    });

    it('should include auto-attached rules based on globs', () => {
      const files = ['src/component.tsx', 'src/utils.js'];
      const filtered = parser.filterRulesForFiles(mockRules, files);

      expect(filtered).toHaveLength(3); // always + ts + js rules
      expect(filtered.map(r => r.id)).toEqual(['always-rule', 'ts-rule', 'js-rule']);
    });

    it('should exclude manual rules from auto-filtering', () => {
      const files = ['src/test.ts'];
      const filtered = parser.filterRulesForFiles(mockRules, files);

      expect(filtered.map(r => r.id)).not.toContain('manual-rule');
    });
  });

  describe('extractReferencedFiles', () => {
    const parser = new CursorRulesParser('/test');

    it('should extract @filename references', () => {
      const content = `
        Use this template: @template.ts
        And this config: @config.json
        Regular text without references.
      `;

      const referenced = (parser as any).extractReferencedFiles(content);

      expect(referenced).toEqual(['template.ts', 'config.json']);
    });

    it('should handle no references', () => {
      const content = 'No file references here.';
      const referenced = (parser as any).extractReferencedFiles(content);

      expect(referenced).toEqual([]);
    });
  });
});
