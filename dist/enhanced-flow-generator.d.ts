/**
 * Enhanced Flow Diagram Generator
 * Creates clear, logical flow charts that explain both business logic and high-level code flow
 */
import { AIProvider, CodeIssue, FileChange, PRPlan } from './types';
export interface BusinessStep {
    id: string;
    title: string;
    description: string;
    type: 'trigger' | 'process' | 'decision' | 'data' | 'result';
    files?: string[];
    importance: 'critical' | 'important' | 'supporting';
}
export interface CodeFlow {
    id: string;
    component: string;
    action: string;
    description: string;
    type: 'frontend' | 'backend' | 'api' | 'database' | 'service' | 'utility';
    files: string[];
    dependencies?: string[];
}
export interface FlowChart {
    title: string;
    description: string;
    businessFlow: BusinessStep[];
    codeFlow: CodeFlow[];
    businessMermaid: string;
    codeMermaid: string;
    combinedMermaid: string;
}
export declare class EnhancedFlowGenerator {
    private aiProvider;
    constructor(aiProvider?: AIProvider);
    /**
     * Generate comprehensive flow charts for PR changes
     */
    generateFlowCharts(fileChanges: FileChange[], prPlan: PRPlan, _issues?: CodeIssue[]): Promise<FlowChart | null>;
    /**
     * Analyze business flow from file changes
     */
    private analyzeBusinessFlow;
    /**
     * Get AI-generated business flow
     */
    private getAIBusinessFlow;
    /**
     * Parse AI response for business steps
     */
    private parseAIBusinessResponse;
    /**
     * Generate fallback business flow when AI is not available
     */
    private generateBusinessFlowFallback;
    /**
     * Analyze code flow from file changes
     */
    private analyzeCodeFlow;
    /**
     * Group files by their architectural type
     */
    private groupFilesByType;
    /**
     * Create code flow for a specific component type
     */
    private createCodeFlowForType;
    /**
     * Infer what actions are being performed based on file changes
     */
    private inferActionsFromFiles;
    /**
     * Get component name for display
     */
    private getComponentName;
    /**
     * Get component description
     */
    private getComponentDescription;
    /**
     * Infer dependencies between components
     */
    private inferDependencies;
    /**
     * Extract import statements from patch
     */
    private extractImports;
    /**
     * Generate integration flows between components
     */
    private generateIntegrationFlows;
    /**
     * Generate business flow Mermaid diagram
     */
    private generateBusinessMermaid;
    /**
     * Generate code flow Mermaid diagram
     */
    private generateCodeMermaid;
    /**
     * Generate combined business and code flow diagram
     */
    private generateCombinedMermaid;
    /**
     * Get business node shape based on step type
     */
    private getBusinessNodeShape;
    /**
     * Get code node shape based on component type
     */
    private getCodeNodeShape;
    /**
     * Get icon for business step type
     */
    private getBusinessIcon;
    /**
     * Filter relevant files for flow analysis
     */
    private filterRelevantFiles;
    /**
     * Build file context for AI analysis
     */
    private buildFileContext;
    /**
     * Generate title for flow chart
     */
    private generateTitle;
    /**
     * Generate description for flow chart
     */
    private generateDescription;
}
//# sourceMappingURL=enhanced-flow-generator.d.ts.map