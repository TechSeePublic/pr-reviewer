/**
 * Parser for Cursor AI rules in all supported formats
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { minimatch } from 'minimatch';
import { CursorRule, CursorRulesConfig, ParsedMDCRule } from './types';
import { logger } from './logger';

export class CursorRulesParser {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Parse all Cursor rules from the repository
   */
  async parseAllRules(customRulesPath?: string): Promise<CursorRulesConfig> {
    const config: CursorRulesConfig = {
      projectRules: [],
      userRules: [],
    };

    // 1. Parse Project Rules (.cursor/rules/*.mdc)
    config.projectRules = await this.parseProjectRules(customRulesPath);

    // 2. Parse AGENTS.md
    const agentsMarkdown = await this.parseAgentsMarkdown();
    if (agentsMarkdown !== undefined) {
      config.agentsMarkdown = agentsMarkdown;
    }

    // 3. Parse legacy .cursorrules
    const legacyRules = await this.parseLegacyRules();
    if (legacyRules !== undefined) {
      config.legacyRules = legacyRules;
    }

    return config;
  }

  /**
   * Parse Project Rules from .cursor/rules directory
   */
  private async parseProjectRules(customPath?: string): Promise<CursorRule[]> {
    const rules: CursorRule[] = [];
    const rulesDir = customPath || path.join(this.basePath, '.cursor', 'rules');

    if (!fs.existsSync(rulesDir)) {
      return rules;
    }

    await this.parseRulesInDirectory(rulesDir, rules);
    return rules;
  }

  /**
   * Recursively parse rules in directory and subdirectories
   */
  private async parseRulesInDirectory(dir: string, rules: CursorRule[]): Promise<void> {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively parse subdirectories
          await this.parseRulesInDirectory(fullPath, rules);
        } else if (entry.isFile() && entry.name.endsWith('.mdc')) {
          const rule = await this.parseMDCFile(fullPath);
          if (rule) {
            rules.push(rule);
          }
        }
      }
    } catch (error) {
      logger.warn(`Warning: Could not read rules directory ${dir}:`, error);
    }
  }

  /**
   * Parse a single .mdc rule file
   */
  private async parseMDCFile(filePath: string): Promise<CursorRule | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.parseMDCContent(content);

      const relativePath = path.relative(this.basePath, filePath);
      const ruleId = this.generateRuleId(relativePath);

      const rule: CursorRule = {
        id: ruleId,
        type: this.determineRuleType(parsed.metadata),
        content: parsed.content,
        filePath: relativePath,
        referencedFiles: parsed.referencedFiles,
      };

      if (parsed.metadata.description !== undefined) {
        rule.description = parsed.metadata.description;
      }
      if (parsed.metadata.globs !== undefined) {
        rule.globs = parsed.metadata.globs;
      }
      if (parsed.metadata.alwaysApply !== undefined) {
        rule.alwaysApply = parsed.metadata.alwaysApply;
      }

      return rule;
    } catch (error) {
      logger.warn(`Warning: Could not parse rule file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse MDC content (metadata + content)
   */
  private parseMDCContent(content: string): ParsedMDCRule {
    const { data: metadata, content: ruleContent } = matter(content);

    // Extract referenced files (@filename.ext)
    const referencedFiles = this.extractReferencedFiles(ruleContent);

    const parsedMetadata: { description?: string; globs?: string[]; alwaysApply?: boolean } = {
      alwaysApply: Boolean(metadata.alwaysApply),
    };

    if (metadata.description !== undefined) {
      parsedMetadata.description = metadata.description;
    }

    if (metadata.globs !== undefined) {
      if (Array.isArray(metadata.globs)) {
        parsedMetadata.globs = metadata.globs;
      } else if (typeof metadata.globs === 'string') {
        parsedMetadata.globs = [metadata.globs];
      }
    }

    return {
      metadata: parsedMetadata,
      content: ruleContent.trim(),
      referencedFiles,
    };
  }

  /**
   * Determine rule type based on metadata
   */
  private determineRuleType(metadata: ParsedMDCRule['metadata']): CursorRule['type'] {
    if (metadata.alwaysApply) {
      return 'always';
    }
    if (metadata.globs && metadata.globs.length > 0) {
      return 'auto_attached';
    }
    if (metadata.description) {
      return 'agent_requested';
    }
    return 'manual';
  }

  /**
   * Extract referenced files from rule content (@filename.ext)
   */
  private extractReferencedFiles(content: string): string[] {
    const matches = content.match(/@([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)/g);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  /**
   * Generate a unique rule ID from file path
   */
  private generateRuleId(filePath: string): string {
    return filePath
      .replace(/\\/g, '/')
      .replace(/^\.cursor\/rules\//, '')
      .replace(/\.mdc$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Parse AGENTS.md file
   */
  private async parseAgentsMarkdown(): Promise<string | undefined> {
    const agentsPath = path.join(this.basePath, 'AGENTS.md');

    if (!fs.existsSync(agentsPath)) {
      return undefined;
    }

    try {
      return fs.readFileSync(agentsPath, 'utf-8');
    } catch (error) {
      logger.warn('Warning: Could not read AGENTS.md:', error);
      return undefined;
    }
  }

  /**
   * Parse legacy .cursorrules file
   */
  private async parseLegacyRules(): Promise<string | undefined> {
    const legacyPath = path.join(this.basePath, '.cursorrules');

    if (!fs.existsSync(legacyPath)) {
      return undefined;
    }

    try {
      return fs.readFileSync(legacyPath, 'utf-8');
    } catch (error) {
      logger.warn('Warning: Could not read .cursorrules:', error);
      return undefined;
    }
  }

  /**
   * Filter rules that apply to specific files
   */
  filterRulesForFiles(rules: CursorRule[], filePaths: string[]): CursorRule[] {
    return rules.filter(rule => {
      // Always apply rules
      if (rule.type === 'always' || rule.alwaysApply) {
        return true;
      }

      // Auto-attached rules based on glob patterns
      if (rule.type === 'auto_attached' && rule.globs) {
        return filePaths.some(filePath => rule.globs?.some(glob => minimatch(filePath, glob)));
      }

      // Agent requested and manual rules (let AI decide)
      return rule.type === 'agent_requested';
    });
  }

  /**
   * Read referenced files content
   */
  async readReferencedFiles(rule: CursorRule): Promise<Record<string, string>> {
    const files: Record<string, string> = {};

    if (!rule.referencedFiles) {
      return files;
    }

    for (const filename of rule.referencedFiles) {
      try {
        const filePath = path.join(this.basePath, filename);
        if (fs.existsSync(filePath)) {
          files[filename] = fs.readFileSync(filePath, 'utf-8');
        }
      } catch (error) {
        logger.warn(`Warning: Could not read referenced file ${filename}:`, error);
      }
    }

    return files;
  }

  /**
   * Get all nested rules directories
   */
  findNestedRulesDirectories(): string[] {
    const directories: string[] = [];

    const findDirs = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = path.join(dir, entry.name);
          const rulesPath = path.join(fullPath, '.cursor', 'rules');

          if (fs.existsSync(rulesPath)) {
            directories.push(rulesPath);
          }

          // Recursively search subdirectories
          findDirs(fullPath);
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    };

    findDirs(this.basePath);
    return directories;
  }
}
