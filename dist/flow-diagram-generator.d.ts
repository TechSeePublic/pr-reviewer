/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams
 */
import { AIProvider, CodeIssue, FileChange, PRPlan } from './types';
export interface FlowDiagramConfig {
    maxNodes: number;
    includeFileTypes: string[];
    excludeFileTypes: string[];
    showOnlyModified: boolean;
}
export interface FlowNode {
    id: string;
    label: string;
    type: 'file' | 'function' | 'class' | 'component' | 'module' | 'process' | 'data';
    status: 'added' | 'modified' | 'removed' | 'renamed' | 'unchanged';
    importance: 'high' | 'medium' | 'low';
    description?: string;
    functionality?: string;
}
export interface FlowEdge {
    from: string;
    to: string;
    type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses' | 'triggers' | 'processes' | 'returns';
    label?: string;
    description?: string;
}
export interface FlowAnalysis {
    overview: string;
    mainFlow: string[];
}
export interface FlowDiagram {
    title: string;
    description: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    mermaidCode: string;
}
export declare class FlowDiagramGenerator {
    private config;
    private aiProvider;
    constructor(config?: Partial<FlowDiagramConfig>, aiProvider?: AIProvider);
    /**
     * Generate flow diagram from PR changes
     */
    generateFlowDiagram(fileChanges: FileChange[], prPlan: PRPlan, issues?: CodeIssue[]): Promise<FlowDiagram | null>;
    /**
     * Generate AI-enhanced flow diagram with intelligent analysis
     */
    private generateAIEnhancedDiagram;
    /**
     * Generate diagram from a list of files
     */
    private generateDiagramFromFiles;
    /**
     * Analyze code flow using AI
     */
    private analyzeCodeFlowWithAI;
    /**
     * Build prompt for AI flow analysis
     */
    private buildFlowAnalysisPrompt;
    /**
     * Get code context from file changes
     */
    private getCodeContext;
    /**
     * Parse AI response for flow analysis
     */
    private parseFlowAnalysisResponse;
    /**
     * Filter files relevant for flow diagram
     */
    private filterRelevantFiles;
    /**
   * Generate intelligent nodes based on AI analysis
   */
    private generateIntelligentNodes;
    /**
     * Generate default flow when AI doesn't provide enough steps
     */
    private generateDefaultFlow;
    /**
     * Determine step type based on content and position
     */
    private determineStepType;
    /**
     * Generate intelligent edges based on AI analysis
     */
    private generateIntelligentEdges;
    /**
     * Generate enhanced Mermaid code with AI insights
     */
    private generateEnhancedMermaidCode;
    /**
     * Get simple node shape for clean diagrams
     */
    private getSimpleNodeShape;
    /**
     * Generate simple styling for clean diagrams
     */
    private generateSimpleStyling;
    /**
     * Extract file functionality from patch
     */
    private extractFileFunctionality;
    /**
     * Get enhanced node shape based on type
     */
    private getEnhancedNodeShape;
    /**
     * Get enhanced edge arrow type
     */
    private getEnhancedEdgeArrow;
    /**
     * Generate enhanced styling
     */
    private generateEnhancedStyling;
    /**
     * Extract nodes from file changes
     */
    private extractNodes;
    /**
     * Extract edges (relationships) between files
     */
    private extractEdges;
    /**
     * Analyze file relationships from patch content
     */
    private analyzeFileRelationships;
    /**
     * Extract import statements from a line
     */
    private extractImports;
    /**
     * Extract function/class calls from a line
     */
    private extractCalls;
    /**
     * Limit nodes to prevent diagram complexity
     */
    private limitNodes;
    /**
     * Filter edges to only include those between existing nodes
     */
    private filterEdges;
    /**
     * Generate Mermaid flowchart code
     */
    private generateMermaidCode;
    /**
     * Get Mermaid node shape based on type and status
     */
    private getNodeShape;
    /**
     * Get node styling based on status and importance
     */
    private getNodeStyle;
    /**
     * Get edge arrow type
     */
    private getEdgeArrow;
    /**
     * Generate CSS styling for the diagram
     */
    private generateStyling;
    /**
     * Determine file type based on filename and content
     */
    private determineFileType;
    /**
     * Determine node importance based on file changes and issues
     */
    private determineImportance;
    /**
     * Generate diagram title
     */
    private generateTitle;
    /**
     * Generate diagram description
     */
    private generateDescription;
    /**
     * Sanitize ID for Mermaid
     */
    private sanitizeId;
    /**
     * Get file label for display
     */
    private getFileLabel;
}
//# sourceMappingURL=flow-diagram-generator.d.ts.map