/**
 * Configuration management for the PR Reviewer
 */
import { ActionInputs } from './types';
export declare function getActionInputs(): ActionInputs;
export declare function validateInputs(inputs: ActionInputs): void;
export declare const DEFAULT_MODELS: {
    readonly openai: "gpt-4";
    readonly anthropic: "claude-3-sonnet-20240229";
};
export declare const SEVERITY_LEVELS: {
    readonly error: 4;
    readonly warning: 3;
    readonly info: 2;
    readonly all: 1;
};
export declare const COMMENT_MARKERS: {
    readonly BOT_IDENTIFIER: "<!-- cursor-ai-pr-reviewer -->";
    readonly SUMMARY_MARKER: "<!-- cursor-ai-summary -->";
    readonly INLINE_MARKER: "<!-- cursor-ai-inline -->";
};
//# sourceMappingURL=config.d.ts.map