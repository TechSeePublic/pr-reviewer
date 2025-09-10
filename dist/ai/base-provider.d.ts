/**
 * Base class for AI providers with shared functionality
 */
import { AIProvider, ArchitecturalReviewResult, CodeIssue, CursorRule, FileChange, InlineComment, PRPlan, ReviewContext } from '../types';
export declare abstract class BaseAIProvider implements AIProvider {
    abstract readonly name: string;
    abstract readonly model: string;
    protected deterministicMode: boolean;
    constructor(deterministicMode?: boolean);
    abstract reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    abstract generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    abstract reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan, existingComments?: InlineComment[]): Promise<CodeIssue[]>;
    abstract reviewArchitecture(fileChanges: FileChange[], rules: CursorRule[]): Promise<ArchitecturalReviewResult>;
    abstract generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
    protected parseAIResponse(response: string): CodeIssue[];
    protected extractIssuesFromText(text: string): CodeIssue[];
    protected parsePRPlanResponse(response: string): PRPlan;
    protected parseArchitecturalResponse(response: string): ArchitecturalReviewResult;
    protected assignFilesToIssues(issues: CodeIssue[], files: FileChange[]): CodeIssue[];
    protected matchIssueToFile(issue: CodeIssue, files: FileChange[]): FileChange | null;
    protected extractErrorMessage(error: unknown): string;
}
//# sourceMappingURL=base-provider.d.ts.map