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
    diagramType?: 'feature' | 'bugfix' | 'optimization' | 'refactor' | 'maintenance';
    visualizationType?: 'flowchart' | 'graph' | 'gitgraph' | 'classDiagram' | 'sequenceDiagram' | 'stateDiagram';
}
export type PRType = 'feature' | 'bugfix' | 'optimization' | 'refactor' | 'maintenance' | 'unknown';
export type VisualizationType = 'flowchart' | 'graph' | 'gitgraph' | 'classDiagram' | 'sequenceDiagram' | 'stateDiagram';
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
     * Detect the type of PR based on overview and changes
     */
    private detectPRType;
    /**
     * Select the best visualization type for the PR
     */
    private selectVisualizationType;
    /**
     * Build specialized prompt based on PR type and visualization type
     */
    private buildSpecializedPrompt;
    /**
     * Build prompt for new features - focus on user journey
     */
    private buildFeaturePrompt;
    /**
     * Build prompt for bug fixes - focus on problem and solution
     */
    private buildBugfixPrompt;
    /**
     * Build prompt for optimizations - focus on improvements
     */
    private buildOptimizationPrompt;
    /**
     * Build prompt for refactoring - focus on structural improvements
     */
    private buildRefactorPrompt;
    /**
     * Build prompt for maintenance - focus on what was updated
     */
    private buildMaintenancePrompt;
    /**
     * Build generic prompt for unknown PR types
     */
    private buildGenericPrompt;
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
     * Validate Mermaid code for quality and usefulness
     */
    private isValidMermaidCode;
    /**
     * Check if the diagram has good explanatory value
     */
    private hasExplanatoryValue;
    /**
     * Count the number of nodes/steps in a Mermaid flowchart
     */
    private countMermaidNodes;
    /**
     * Filter files relevant for flow diagram
     */
    private filterRelevantFiles;
    /**
     * Generate specialized title based on PR type
     */
    private generateTitle;
    /**
     * Generate a smart, contextual description for the flow diagram
     */
    private generateSmartDescription;
    /**
     * Get basic syntax guidelines instead of rigid examples
     */
    private getEnhancedExampleDiagram;
    /**
     * Get example diagram based on visualization type and PR type
     */
    private getExampleDiagram;
    /**
     * Get display name for visualization type
     */
    private getVisualizationDisplayName;
}
//# sourceMappingURL=flow-diagram-generator.d.ts.map