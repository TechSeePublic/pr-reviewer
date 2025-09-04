/**
 * Shared utilities for AI providers
 */
import { ArchitecturalReviewResult, CodeIssue, FileChange, PRPlan } from '../types';
export declare class AIProviderUtils {
    /**
     * Extract error message from various error formats
     */
    static extractErrorMessage(error: unknown): string;
    /**
     * Clean and parse AI response
     */
    static parseAIResponse(response: string, deterministicMode?: boolean): CodeIssue[];
    /**
     * Extract issues from text when JSON parsing fails
     */
    static extractIssuesFromText(text: string): CodeIssue[];
    /**
     * Parse PR plan response
     */
    static parsePRPlanResponse(response: string): PRPlan;
    /**
     * Parse architectural review response
     */
    static parseArchitecturalResponse(response: string): ArchitecturalReviewResult;
    /**
     * Assign proper file names to issues when AI doesn't provide them correctly
     */
    static assignFilesToIssues(issues: CodeIssue[], files: FileChange[]): CodeIssue[];
    /**
     * Attempt to match an issue to a specific file based on context clues
     */
    static matchIssueToFile(issue: CodeIssue, files: FileChange[]): FileChange | null;
}
//# sourceMappingURL=utils.d.ts.map