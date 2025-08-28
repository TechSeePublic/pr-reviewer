"use strict";
/**
 * Parser for Cursor AI rules in all supported formats
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorRulesParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const minimatch_1 = require("minimatch");
const logger_1 = require("./logger");
class CursorRulesParser {
    constructor(basePath) {
        this.basePath = basePath;
    }
    /**
     * Parse all Cursor rules from the repository
     */
    async parseAllRules(customRulesPath) {
        const config = {
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
    async parseProjectRules(customPath) {
        const rules = [];
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
    async parseRulesInDirectory(dir, rules) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Recursively parse subdirectories
                    await this.parseRulesInDirectory(fullPath, rules);
                }
                else if (entry.isFile() && entry.name.endsWith('.mdc')) {
                    const rule = await this.parseMDCFile(fullPath);
                    if (rule) {
                        rules.push(rule);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Warning: Could not read rules directory ${dir}:`, error);
        }
    }
    /**
     * Parse a single .mdc rule file
     */
    async parseMDCFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = this.parseMDCContent(content);
            const relativePath = path.relative(this.basePath, filePath);
            const ruleId = this.generateRuleId(relativePath);
            const rule = {
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
        }
        catch (error) {
            logger_1.logger.warn(`Warning: Could not parse rule file ${filePath}:`, error);
            return null;
        }
    }
    /**
     * Parse MDC content (metadata + content)
     */
    parseMDCContent(content) {
        const { data: metadata, content: ruleContent } = (0, gray_matter_1.default)(content);
        // Extract referenced files (@filename.ext)
        const referencedFiles = this.extractReferencedFiles(ruleContent);
        const parsedMetadata = {
            alwaysApply: Boolean(metadata.alwaysApply),
        };
        if (metadata.description !== undefined) {
            parsedMetadata.description = metadata.description;
        }
        if (metadata.globs !== undefined) {
            if (Array.isArray(metadata.globs)) {
                parsedMetadata.globs = metadata.globs;
            }
            else if (typeof metadata.globs === 'string') {
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
    determineRuleType(metadata) {
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
    extractReferencedFiles(content) {
        const matches = content.match(/@([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)/g);
        return matches ? matches.map(match => match.substring(1)) : [];
    }
    /**
     * Generate a unique rule ID from file path
     */
    generateRuleId(filePath) {
        return filePath
            .replace(/\\/g, '/')
            .replace(/^\.cursor\/rules\//, '')
            .replace(/\.mdc$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    /**
     * Parse AGENTS.md file
     */
    async parseAgentsMarkdown() {
        const agentsPath = path.join(this.basePath, 'AGENTS.md');
        if (!fs.existsSync(agentsPath)) {
            return undefined;
        }
        try {
            return fs.readFileSync(agentsPath, 'utf-8');
        }
        catch (error) {
            logger_1.logger.warn('Warning: Could not read AGENTS.md:', error);
            return undefined;
        }
    }
    /**
     * Parse legacy .cursorrules file
     */
    async parseLegacyRules() {
        const legacyPath = path.join(this.basePath, '.cursorrules');
        if (!fs.existsSync(legacyPath)) {
            return undefined;
        }
        try {
            return fs.readFileSync(legacyPath, 'utf-8');
        }
        catch (error) {
            logger_1.logger.warn('Warning: Could not read .cursorrules:', error);
            return undefined;
        }
    }
    /**
     * Filter rules that apply to specific files
     */
    filterRulesForFiles(rules, filePaths) {
        return rules.filter(rule => {
            // Always apply rules
            if (rule.type === 'always' || rule.alwaysApply) {
                return true;
            }
            // Auto-attached rules based on glob patterns
            if (rule.type === 'auto_attached' && rule.globs) {
                return filePaths.some(filePath => rule.globs.some(glob => (0, minimatch_1.minimatch)(filePath, glob)));
            }
            // Agent requested and manual rules (let AI decide)
            return rule.type === 'agent_requested';
        });
    }
    /**
     * Read referenced files content
     */
    async readReferencedFiles(rule) {
        const files = {};
        if (!rule.referencedFiles) {
            return files;
        }
        for (const filename of rule.referencedFiles) {
            try {
                const filePath = path.join(this.basePath, filename);
                if (fs.existsSync(filePath)) {
                    files[filename] = fs.readFileSync(filePath, 'utf-8');
                }
            }
            catch (error) {
                logger_1.logger.warn(`Warning: Could not read referenced file ${filename}:`, error);
            }
        }
        return files;
    }
    /**
     * Get all nested rules directories
     */
    findNestedRulesDirectories() {
        const directories = [];
        const findDirs = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const fullPath = path.join(dir, entry.name);
                    const rulesPath = path.join(fullPath, '.cursor', 'rules');
                    if (fs.existsSync(rulesPath)) {
                        directories.push(rulesPath);
                    }
                    // Recursively search subdirectories
                    findDirs(fullPath);
                }
            }
            catch (error) {
                // Ignore directories we can't read
            }
        };
        findDirs(this.basePath);
        return directories;
    }
}
exports.CursorRulesParser = CursorRulesParser;
//# sourceMappingURL=cursor-parser.js.map