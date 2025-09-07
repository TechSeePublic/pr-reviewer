/**
 * AWS Bedrock provider for code review
 */
import { ArchitecturalReviewResult, CodeIssue, CursorRule, FileChange, PRPlan, ReviewContext } from '../types';
import { BaseAIProvider } from './base-provider';
export declare class BedrockProvider extends BaseAIProvider {
    readonly name = "bedrock";
    readonly model: string;
    private client;
    private stsClient;
    private region;
    private anthropicVersion;
    private static credentialsValidated;
    /**
     * Creates a new BedrockProvider instance
     * @param region AWS region for Bedrock (default: us-east-1)
     * @param model Model ID to use (default: from config)
     * @param deterministicMode Whether to use deterministic settings (default: true)
     * @param accessKeyId AWS access key ID (optional, can use IAM roles or API key)
     * @param secretAccessKey AWS secret access key (optional, can use IAM roles or API key)
     * @param anthropicVersion Anthropic API version for Claude models (default: bedrock-2023-05-31)
     * @param apiKey AWS Bedrock API key for simplified authentication (introduced July 2025)
     *                        Check AWS Bedrock documentation for latest supported versions
     */
    constructor(region?: string, model?: string, deterministicMode?: boolean, accessKeyId?: string, secretAccessKey?: string, anthropicVersion?: string, apiKey?: string);
    /**
     * Validates AWS credentials by making a test STS call
     * This helps diagnose authentication issues before making Bedrock API calls
     */
    private validateCredentials;
    private invokeModel;
    reviewCode(prompt: string, code: string, rules: CursorRule[]): Promise<CodeIssue[]>;
    generatePRPlan(fileChanges: FileChange[], rules: CursorRule[]): Promise<PRPlan>;
    reviewBatch(files: FileChange[], rules: CursorRule[], prPlan: PRPlan): Promise<CodeIssue[]>;
    reviewArchitecture(fileChanges: FileChange[], rules: CursorRule[]): Promise<ArchitecturalReviewResult>;
    generateSummary(issues: CodeIssue[], context: ReviewContext): Promise<string>;
}
//# sourceMappingURL=bedrock-provider.d.ts.map