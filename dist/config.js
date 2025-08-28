"use strict";
/**
 * Configuration management for the PR Reviewer
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMENT_MARKERS = exports.SEVERITY_LEVELS = exports.DEFAULT_MODELS = void 0;
exports.getActionInputs = getActionInputs;
exports.validateInputs = validateInputs;
const core = __importStar(require("@actions/core"));
function getActionInputs() {
    const includePatterns = core.getInput('include_patterns')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    const excludePatterns = core.getInput('exclude_patterns')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    const inputs = {
        githubToken: core.getInput('gh_token', { required: true }),
        aiProvider: core.getInput('ai_provider') || 'auto',
        model: core.getInput('model') || 'auto',
        reviewLevel: core.getInput('review_level') || 'standard',
        includePatterns: includePatterns.length > 0 ? includePatterns : [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.go', '**/*.rs', '**/*.java', '**/*.cs'
        ],
        excludePatterns: excludePatterns.length > 0 ? excludePatterns : [
            'node_modules/**', 'dist/**', 'build/**', 'coverage/**',
            '*.min.js', '*.bundle.js'
        ],
        maxFiles: parseInt(core.getInput('max_files') || '50', 10),
        commentStyle: core.getInput('comment_style') || 'both',
        inlineSeverity: core.getInput('inline_severity') || 'warning',
        summaryFormat: core.getInput('summary_format') || 'detailed',
        enableSuggestions: core.getBooleanInput('enable_suggestions') ?? true,
        skipIfNoRules: core.getBooleanInput('skip_if_no_rules') ?? false,
        updateExistingComments: core.getBooleanInput('update_existing_comments') ?? true,
    };
    // Add optional properties only if they have values
    const openaiApiKey = core.getInput('openai_api_key');
    if (openaiApiKey) {
        inputs.openaiApiKey = openaiApiKey;
    }
    const anthropicApiKey = core.getInput('anthropic_api_key');
    if (anthropicApiKey) {
        inputs.anthropicApiKey = anthropicApiKey;
    }
    const rulesPath = core.getInput('rules_path');
    if (rulesPath) {
        inputs.rulesPath = rulesPath;
    }
    return inputs;
}
function validateInputs(inputs) {
    // Validate AI provider credentials
    if (inputs.aiProvider === 'openai' && !inputs.openaiApiKey) {
        throw new Error('OpenAI API key is required when ai_provider is set to "openai"');
    }
    if (inputs.aiProvider === 'anthropic' && !inputs.anthropicApiKey) {
        throw new Error('Anthropic API key is required when ai_provider is set to "anthropic"');
    }
    if (inputs.aiProvider === 'auto' && !inputs.openaiApiKey && !inputs.anthropicApiKey) {
        throw new Error('At least one AI provider API key is required (openai_api_key or anthropic_api_key)');
    }
    // Validate numeric inputs
    if (inputs.maxFiles < 1 || inputs.maxFiles > 200) {
        throw new Error('max_files must be between 1 and 200');
    }
    // Validate patterns
    if (inputs.includePatterns.length === 0) {
        throw new Error('include_patterns cannot be empty');
    }
}
exports.DEFAULT_MODELS = {
    openai: 'gpt-4',
    anthropic: 'claude-3-sonnet-20240229',
};
exports.SEVERITY_LEVELS = {
    error: 4,
    warning: 3,
    info: 2,
    all: 1,
};
exports.COMMENT_MARKERS = {
    BOT_IDENTIFIER: '<!-- cursor-ai-pr-reviewer -->',
    SUMMARY_MARKER: '<!-- cursor-ai-summary -->',
    INLINE_MARKER: '<!-- cursor-ai-inline -->',
};
//# sourceMappingURL=config.js.map