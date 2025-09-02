/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams using AI
 */
import { AIProvider, CodeIssue, FileChange, PRPlan } from './types';
export interface FlowDiagramConfig {
    maxFiles: number;
    includeFileTypes: string[];
    excludeFileTypes: string[];
}
export interface FlowDiagram {
    title: string;
    description: string;
    mermaidCode: string;
}
export declare class FlowDiagramGenerator {
    private config;
    private aiProvider;
    constructor(config?: Partial<FlowDiagramConfig>, aiProvider?: AIProvider, _githubClient?: unknown);
    /**
     * Generate flow diagram from PR changes
     */
    generateFlowDiagram(fileChanges: FileChange[], prPlan: PRPlan, _issues?: CodeIssue[]): Promise<FlowDiagram | null>;
    /**
     * Generate diagram using AI to create Mermaid text directly
     */
    private generateAIDiagram;
    /**
     * Generate Mermaid diagram using direct AI call (not code review format)
     */
    private generateMermaidWithAI;
    /**
     * Build prompt for AI to generate Mermaid diagram
     */
    private buildMermaidPrompt;
    /**
     * Build file context for AI analysis
     */
    private buildFileContext;
    /**
     * Parse AI response to extract Mermaid code
     */
    private parseMermaidResponse;
    /**
     * Extract Mermaid code from text
     */
    private extractMermaidFromText;
    /**
     * Validate Mermaid code for basic syntax
     */
    private isValidMermaidCode;
    /**
     * Count the number of nodes/steps in a Mermaid flowchart
     */
    private countMermaidNodes;
    /**
     * Filter files relevant for flow diagram
     */
    private filterRelevantFiles;
}
//# sourceMappingURL=flow-diagram-generator.d.ts.map