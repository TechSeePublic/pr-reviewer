/**
 * Parser for Cursor AI rules in all supported formats
 */
import { CursorRule, CursorRulesConfig } from './types';
export declare class CursorRulesParser {
    private basePath;
    constructor(basePath: string);
    /**
     * Parse all Cursor rules from the repository
     */
    parseAllRules(customRulesPath?: string): Promise<CursorRulesConfig>;
    /**
     * Parse Project Rules from .cursor/rules directory
     */
    private parseProjectRules;
    /**
     * Recursively parse rules in directory and subdirectories
     */
    private parseRulesInDirectory;
    /**
     * Parse a single .mdc rule file
     */
    private parseMDCFile;
    /**
     * Parse MDC content (metadata + content)
     */
    private parseMDCContent;
    /**
     * Determine rule type based on metadata
     */
    private determineRuleType;
    /**
     * Extract referenced files from rule content (@filename.ext)
     */
    private extractReferencedFiles;
    /**
     * Generate a unique rule ID from file path
     */
    private generateRuleId;
    /**
     * Parse AGENTS.md file
     */
    private parseAgentsMarkdown;
    /**
     * Parse legacy .cursorrules file
     */
    private parseLegacyRules;
    /**
     * Filter rules that apply to specific files
     */
    filterRulesForFiles(rules: CursorRule[], filePaths: string[]): CursorRule[];
    /**
     * Read referenced files content
     */
    readReferencedFiles(rule: CursorRule): Promise<Record<string, string>>;
    /**
     * Get all nested rules directories
     */
    findNestedRulesDirectories(): string[];
}
//# sourceMappingURL=cursor-parser.d.ts.map