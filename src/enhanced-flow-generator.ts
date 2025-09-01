/**
 * Enhanced Flow Diagram Generator
 * Creates clear, logical flow charts that explain both business logic and high-level code flow
 */

import { AIProvider, CodeIssue, FileChange, PRPlan } from './types';
import { logger } from './logger';

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

export class EnhancedFlowGenerator {
  private aiProvider: AIProvider | undefined;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider;
  }

  /**
   * Generate comprehensive flow charts for PR changes
   */
  async generateFlowCharts(
    fileChanges: FileChange[],
    prPlan: PRPlan,
    _issues: CodeIssue[] = []
  ): Promise<FlowChart | null> {
    try {
      logger.info('Generating enhanced flow charts for PR...');

      // Filter relevant files for flow analysis
      const relevantFiles = this.filterRelevantFiles(fileChanges);

      if (relevantFiles.length === 0) {
        logger.info('No relevant files found for flow chart generation');
        return null;
      }

      // Analyze business flow
      const businessFlow = await this.analyzeBusinessFlow(relevantFiles, prPlan);

      // Analyze code flow
      const codeFlow = await this.analyzeCodeFlow(relevantFiles, prPlan);

      // Generate Mermaid diagrams
      const businessMermaid = this.generateBusinessMermaid(businessFlow);
      const codeMermaid = this.generateCodeMermaid(codeFlow);
      const combinedMermaid = this.generateCombinedMermaid(businessFlow, codeFlow);

      return {
        title: this.generateTitle(prPlan),
        description: this.generateDescription(businessFlow, codeFlow),
        businessFlow,
        codeFlow,
        businessMermaid,
        codeMermaid,
        combinedMermaid,
      };
    } catch (error) {
      logger.error('Failed to generate enhanced flow charts:', error);
      return null;
    }
  }

  /**
   * Analyze business flow from file changes
   */
  private async analyzeBusinessFlow(files: FileChange[], prPlan: PRPlan): Promise<BusinessStep[]> {
    // Try AI analysis first
    if (this.aiProvider) {
      try {
        const aiSteps = await this.getAIBusinessFlow(files, prPlan);
        if (aiSteps.length > 0) {
          return aiSteps;
        }
      } catch (error) {
        logger.warn('AI business flow analysis failed, using fallback:', error);
      }
    }

    // Fallback to rule-based analysis
    return this.generateBusinessFlowFallback(files, prPlan);
  }

  /**
   * Get AI-generated business flow
   */
  private async getAIBusinessFlow(files: FileChange[], prPlan: PRPlan): Promise<BusinessStep[]> {
    if (!this.aiProvider) return [];

    const prompt = `
# Business Flow Analysis

Analyze this PR and create a logical business flow that explains what the user experiences.

## PR Overview
${prPlan.overview}

## Key Changes
${prPlan.keyChanges.join('\n')}

## Files Changed
${files.map(f => `- ${f.filename} (${f.status})`).join('\n')}

## Task
Create 3-6 business steps that show the user journey. Focus on:
1. What triggers the flow (user action, event, etc.)
2. What business logic processes happen
3. What data is involved
4. What the final result/outcome is

Each step should be from the user's or business perspective, NOT technical implementation.

Return JSON in this format:
{
  "steps": [
    {
      "id": "step1",
      "title": "User Action Title",
      "description": "What happens in this step",
      "type": "trigger|process|decision|data|result",
      "importance": "critical|important|supporting"
    }
  ]
}

Focus on clarity and logical flow. Avoid technical jargon.
`;

    try {
      const context = this.buildFileContext(files);
      const response = await this.aiProvider.reviewCode(prompt, context, []);

      // Parse AI response for business steps
      return this.parseAIBusinessResponse(response);
    } catch (error) {
      logger.error('AI business flow generation failed:', error);
      return [];
    }
  }

  /**
   * Parse AI response for business steps
   */
  private parseAIBusinessResponse(response: unknown): BusinessStep[] {
    try {
      if (Array.isArray(response)) {
        // Look for JSON in the response descriptions
        for (const item of response) {
          if (item.description) {
            const jsonMatch = item.description.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.steps && Array.isArray(parsed.steps)) {
                return parsed.steps.map(
                  (
                    step: {
                      id?: string;
                      title?: string;
                      description?: string;
                      type?: BusinessStep['type'];
                      importance?: BusinessStep['importance'];
                    },
                    index: number
                  ) => ({
                    id: step.id || `step_${index + 1}`,
                    title: step.title || `Step ${index + 1}`,
                    description: step.description || '',
                    type: step.type || 'process',
                    importance: step.importance || 'important',
                  })
                );
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse AI business response:', error);
    }

    return [];
  }

  /**
   * Generate fallback business flow when AI is not available
   */
  private generateBusinessFlowFallback(files: FileChange[], prPlan: PRPlan): BusinessStep[] {
    const steps: BusinessStep[] = [];

    // Analyze file types to determine business flow
    const hasUI = files.some(
      f =>
        f.filename.includes('component') ||
        f.filename.includes('Component') ||
        f.filename.endsWith('.tsx') ||
        f.filename.endsWith('.jsx') ||
        f.filename.endsWith('.vue')
    );

    const hasAPI = files.some(
      f =>
        f.filename.includes('api') ||
        f.filename.includes('endpoint') ||
        f.filename.includes('route')
    );

    const hasService = files.some(
      f =>
        f.filename.includes('service') ||
        f.filename.includes('Service') ||
        f.filename.includes('manager') ||
        f.filename.includes('handler')
    );

    const hasDatabase = files.some(
      f =>
        f.filename.includes('model') ||
        f.filename.includes('schema') ||
        f.filename.includes('db') ||
        f.filename.includes('repository')
    );

    // Build flow based on detected patterns
    if (hasUI && hasAPI && hasService) {
      steps.push(
        {
          id: 'user_action',
          title: 'User Action',
          description: 'User interacts with the interface to initiate a request',
          type: 'trigger',
          importance: 'critical',
        },
        {
          id: 'request_processing',
          title: 'Request Processing',
          description: 'System validates and processes the user request',
          type: 'process',
          importance: 'critical',
        }
      );

      if (hasDatabase) {
        steps.push({
          id: 'data_operation',
          title: 'Data Operation',
          description: 'System performs data operations (create, read, update, delete)',
          type: 'data',
          importance: 'important',
        });
      }

      steps.push(
        {
          id: 'business_logic',
          title: 'Business Logic',
          description: 'Core business rules and logic are applied',
          type: 'process',
          importance: 'critical',
        },
        {
          id: 'response_delivery',
          title: 'Response Delivery',
          description: 'Results are prepared and sent back to the user',
          type: 'result',
          importance: 'critical',
        }
      );
    } else {
      // Generic flow based on PR overview
      const overview = prPlan.overview.toLowerCase();

      if (overview.includes('add') || overview.includes('create')) {
        steps.push(
          {
            id: 'initiate',
            title: 'Feature Initiation',
            description: 'New functionality is triggered',
            type: 'trigger',
            importance: 'critical',
          },
          {
            id: 'implement',
            title: 'Implementation',
            description: 'Core feature logic is implemented',
            type: 'process',
            importance: 'critical',
          },
          {
            id: 'integrate',
            title: 'Integration',
            description: 'Feature is integrated with existing system',
            type: 'process',
            importance: 'important',
          },
          {
            id: 'complete',
            title: 'Completion',
            description: 'Feature is ready for use',
            type: 'result',
            importance: 'critical',
          }
        );
      } else {
        steps.push(
          {
            id: 'change_trigger',
            title: 'Change Required',
            description: 'A change or improvement is needed',
            type: 'trigger',
            importance: 'important',
          },
          {
            id: 'modification',
            title: 'System Modification',
            description: 'Existing functionality is updated',
            type: 'process',
            importance: 'critical',
          },
          {
            id: 'verification',
            title: 'Verification',
            description: 'Changes are verified and tested',
            type: 'process',
            importance: 'important',
          },
          {
            id: 'deployment',
            title: 'Deployment',
            description: 'Updated system is ready for use',
            type: 'result',
            importance: 'critical',
          }
        );
      }
    }

    return steps;
  }

  /**
   * Analyze code flow from file changes
   */
  private async analyzeCodeFlow(files: FileChange[], prPlan: PRPlan): Promise<CodeFlow[]> {
    const flows: CodeFlow[] = [];

    // Group files by type and analyze their roles
    const filesByType = this.groupFilesByType(files);

    // Generate flows for each component type
    for (const [type, typeFiles] of Object.entries(filesByType)) {
      if (typeFiles.length === 0) continue;

      const flow = this.createCodeFlowForType(type, typeFiles, prPlan);
      if (flow) {
        flows.push(flow);
      }
    }

    // Add integration flows
    const integrationFlows = this.generateIntegrationFlows(filesByType);
    flows.push(...integrationFlows);

    return flows;
  }

  /**
   * Group files by their architectural type
   */
  private groupFilesByType(files: FileChange[]): Record<string, FileChange[]> {
    const groups: {
      frontend: FileChange[];
      backend: FileChange[];
      api: FileChange[];
      database: FileChange[];
      service: FileChange[];
      utility: FileChange[];
    } = {
      frontend: [],
      backend: [],
      api: [],
      database: [],
      service: [],
      utility: [],
    };

    for (const file of files) {
      const filename = file.filename.toLowerCase();

      if (
        filename.endsWith('.tsx') ||
        filename.endsWith('.jsx') ||
        filename.endsWith('.vue') ||
        filename.includes('component')
      ) {
        groups.frontend.push(file);
      } else if (
        filename.includes('api') ||
        filename.includes('endpoint') ||
        filename.includes('route')
      ) {
        groups.api.push(file);
      } else if (
        filename.includes('service') ||
        filename.includes('manager') ||
        filename.includes('handler')
      ) {
        groups.service.push(file);
      } else if (
        filename.includes('model') ||
        filename.includes('schema') ||
        filename.includes('db')
      ) {
        groups.database.push(file);
      } else if (
        filename.includes('util') ||
        filename.includes('helper') ||
        filename.includes('config')
      ) {
        groups.utility.push(file);
      } else {
        groups.backend.push(file);
      }
    }

    return groups;
  }

  /**
   * Create code flow for a specific component type
   */
  private createCodeFlowForType(
    type: string,
    files: FileChange[],
    prPlan: PRPlan
  ): CodeFlow | null {
    if (files.length === 0) return null;

    const actions = this.inferActionsFromFiles(files, prPlan);

    return {
      id: `${type}_flow`,
      component: this.getComponentName(type),
      action: actions.join(', '),
      description: this.getComponentDescription(type, actions),
      type: type as CodeFlow['type'],
      files: files.map(f => f.filename),
      dependencies: this.inferDependencies(type, files),
    };
  }

  /**
   * Infer what actions are being performed based on file changes
   */
  private inferActionsFromFiles(files: FileChange[], prPlan: PRPlan): string[] {
    const actions: string[] = [];
    const overview = prPlan.overview.toLowerCase();

    const addedFiles = files.filter(f => f.status === 'added');
    const modifiedFiles = files.filter(f => f.status === 'modified');
    const removedFiles = files.filter(f => f.status === 'removed');

    if (addedFiles.length > 0) {
      if (overview.includes('create') || overview.includes('add')) {
        actions.push('Create new functionality');
      } else {
        actions.push('Add new components');
      }
    }

    if (modifiedFiles.length > 0) {
      if (overview.includes('fix') || overview.includes('bug')) {
        actions.push('Fix issues');
      } else if (overview.includes('improve') || overview.includes('enhance')) {
        actions.push('Enhance existing features');
      } else if (overview.includes('update') || overview.includes('modify')) {
        actions.push('Update functionality');
      } else {
        actions.push('Modify existing code');
      }
    }

    if (removedFiles.length > 0) {
      actions.push('Remove unused code');
    }

    return actions.length > 0 ? actions : ['Process data'];
  }

  /**
   * Get component name for display
   */
  private getComponentName(type: string): string {
    const names: Record<string, string> = {
      frontend: 'User Interface',
      backend: 'Backend Logic',
      api: 'API Layer',
      database: 'Data Layer',
      service: 'Business Services',
      utility: 'Utilities',
    };

    return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Get component description
   */
  private getComponentDescription(type: string, actions: string[]): string {
    const base = actions.join(' and ');

    const contexts: Record<string, string> = {
      frontend: `${base} in the user interface components`,
      backend: `${base} in the backend application logic`,
      api: `${base} in the API endpoints and request handling`,
      database: `${base} in the data models and database operations`,
      service: `${base} in the business logic services`,
      utility: `${base} in the utility functions and helpers`,
    };

    return contexts[type] || `${base} in the ${type} layer`;
  }

  /**
   * Infer dependencies between components
   */
  private inferDependencies(type: string, files: FileChange[]): string[] {
    // Analyze import statements and cross-references
    const dependencies: string[] = [];

    for (const file of files) {
      if (file.patch) {
        const imports = this.extractImports(file.patch);
        dependencies.push(...imports);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Extract import statements from patch
   */
  private extractImports(patch: string): string[] {
    const imports: string[] = [];
    const lines = patch.split('\n');

    for (const line of lines) {
      if (line.startsWith('+') && (line.includes('import') || line.includes('require'))) {
        const importMatch = line.match(/['"`]([^'"`]+)['"`]/);
        if (importMatch && importMatch[1]) {
          imports.push(importMatch[1]);
        }
      }
    }

    return imports;
  }

  /**
   * Generate integration flows between components
   */
  private generateIntegrationFlows(filesByType: Record<string, FileChange[]>): CodeFlow[] {
    const flows: CodeFlow[] = [];

    // Frontend -> API integration
    if (
      filesByType.frontend &&
      filesByType.api &&
      filesByType.frontend.length > 0 &&
      filesByType.api.length > 0
    ) {
      flows.push({
        id: 'frontend_api_integration',
        component: 'Frontend-API Integration',
        action: 'Handle user requests and API communication',
        description: 'Frontend components communicate with API endpoints',
        type: 'frontend',
        files: [
          ...filesByType.frontend.map(f => f.filename),
          ...filesByType.api.map(f => f.filename),
        ],
        dependencies: ['api'],
      });
    }

    // API -> Service integration
    if (
      filesByType.api &&
      filesByType.service &&
      filesByType.api.length > 0 &&
      filesByType.service.length > 0
    ) {
      flows.push({
        id: 'api_service_integration',
        component: 'API-Service Integration',
        action: 'Process requests through business logic',
        description: 'API layer delegates processing to business services',
        type: 'api',
        files: [
          ...filesByType.api.map(f => f.filename),
          ...filesByType.service.map(f => f.filename),
        ],
        dependencies: ['service'],
      });
    }

    // Service -> Database integration
    if (
      filesByType.service &&
      filesByType.database &&
      filesByType.service.length > 0 &&
      filesByType.database.length > 0
    ) {
      flows.push({
        id: 'service_database_integration',
        component: 'Service-Database Integration',
        action: 'Perform data operations',
        description: 'Business services interact with data layer',
        type: 'service',
        files: [
          ...filesByType.service.map(f => f.filename),
          ...filesByType.database.map(f => f.filename),
        ],
        dependencies: ['database'],
      });
    }

    return flows;
  }

  /**
   * Generate business flow Mermaid diagram
   */
  private generateBusinessMermaid(steps: BusinessStep[]): string {
    let mermaid = 'flowchart TD\n';

    // Add title
    mermaid += '    %% Business Flow - User Journey\n\n';

    // Add nodes
    for (const step of steps) {
      const shape = this.getBusinessNodeShape(step);
      mermaid += `    ${step.id}${shape}\n`;
    }

    mermaid += '\n';

    // Add connections
    for (let i = 0; i < steps.length - 1; i++) {
      const current = steps[i];
      const next = steps[i + 1];
      if (current && next) {
        mermaid += `    ${current.id} --> ${next.id}\n`;
      }
    }

    // Add styling
    mermaid += '\n';
    mermaid += '    classDef critical fill:#ff6b6b,stroke:#d63031,stroke-width:3px,color:#fff\n';
    mermaid += '    classDef important fill:#4ecdc4,stroke:#00b894,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef supporting fill:#a29bfe,stroke:#6c5ce7,stroke-width:1px,color:#fff\n';

    // Apply styles
    for (const step of steps) {
      mermaid += `    class ${step.id} ${step.importance}\n`;
    }

    return mermaid;
  }

  /**
   * Generate code flow Mermaid diagram
   */
  private generateCodeMermaid(flows: CodeFlow[]): string {
    let mermaid = 'flowchart LR\n';

    // Add title
    mermaid += '    %% Code Flow - Component Architecture\n\n';

    // Add nodes
    for (const flow of flows) {
      const shape = this.getCodeNodeShape(flow);
      mermaid += `    ${flow.id}${shape}\n`;
    }

    mermaid += '\n';

    // Add connections based on dependencies
    for (const flow of flows) {
      if (flow.dependencies) {
        for (const dep of flow.dependencies) {
          const depFlow = flows.find(f => f.type === dep);
          if (depFlow) {
            mermaid += `    ${flow.id} --> ${depFlow.id}\n`;
          }
        }
      }
    }

    // Add styling
    mermaid += '\n';
    mermaid += '    classDef frontend fill:#61dafb,stroke:#20232a,stroke-width:2px,color:#20232a\n';
    mermaid += '    classDef backend fill:#8cc84b,stroke:#215732,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef api fill:#ff6b6b,stroke:#d63031,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef database fill:#336791,stroke:#1a365d,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef service fill:#ffa502,stroke:#cc8400,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef utility fill:#747d8c,stroke:#2f3640,stroke-width:2px,color:#fff\n';

    // Apply styles
    for (const flow of flows) {
      mermaid += `    class ${flow.id} ${flow.type}\n`;
    }

    return mermaid;
  }

  /**
   * Generate combined business and code flow diagram
   */
  private generateCombinedMermaid(businessSteps: BusinessStep[], codeFlows: CodeFlow[]): string {
    let mermaid = 'flowchart TD\n';

    // Add title
    mermaid += '    %% Combined Flow - Business Logic + Code Architecture\n\n';

    // Business flow subgraph
    mermaid += '    subgraph Business["🎯 Business Flow"]\n';
    mermaid += '        direction TD\n';

    for (const step of businessSteps) {
      const shape = this.getBusinessNodeShape(step);
      mermaid += `        B${step.id}${shape}\n`;
    }

    // Business connections
    for (let i = 0; i < businessSteps.length - 1; i++) {
      const current = businessSteps[i];
      const next = businessSteps[i + 1];
      if (current && next) {
        mermaid += `        B${current.id} --> B${next.id}\n`;
      }
    }

    mermaid += '    end\n\n';

    // Code flow subgraph
    mermaid += '    subgraph Code["⚙️ Code Architecture"]\n';
    mermaid += '        direction LR\n';

    for (const flow of codeFlows) {
      const shape = this.getCodeNodeShape(flow);
      mermaid += `        C${flow.id}${shape}\n`;
    }

    // Code connections
    for (const flow of codeFlows) {
      if (flow.dependencies) {
        for (const dep of flow.dependencies) {
          const depFlow = codeFlows.find(f => f.type === dep);
          if (depFlow) {
            mermaid += `        C${flow.id} --> C${depFlow.id}\n`;
          }
        }
      }
    }

    mermaid += '    end\n\n';

    // Add high-level connection between business and code
    if (businessSteps.length > 0 && codeFlows.length > 0) {
      mermaid += `    Business -.-> Code\n`;
    }

    return mermaid;
  }

  /**
   * Get business node shape based on step type
   */
  private getBusinessNodeShape(step: BusinessStep): string {
    const title = step.title.length > 25 ? step.title.substring(0, 22) + '...' : step.title;

    switch (step.type) {
      case 'trigger':
        return `(["🚀 ${title}"])`;
      case 'decision':
        return `{"🤔 ${title}"}`;
      case 'data':
        return `[("📊 ${title}")]`;
      case 'result':
        return `[["✅ ${title}"]]`;
      default:
        return `["⚙️ ${title}"]`;
    }
  }

  /**
   * Get code node shape based on component type
   */
  private getCodeNodeShape(flow: CodeFlow): string {
    const component =
      flow.component.length > 20 ? flow.component.substring(0, 17) + '...' : flow.component;

    switch (flow.type) {
      case 'frontend':
        return `[["🎨 ${component}"]]`;
      case 'api':
        return `[["🌐 ${component}"]]`;
      case 'database':
        return `[("💾 ${component}")]`;
      case 'service':
        return `["⚙️ ${component}"]`;
      case 'utility':
        return `("🔧 ${component}")`;
      default:
        return `["📦 ${component}"]`;
    }
  }

  /**
   * Get icon for business step type
   */
  private getBusinessIcon(type: BusinessStep['type']): string {
    const icons = {
      trigger: '🚀',
      process: '⚙️',
      decision: '🤔',
      data: '📊',
      result: '✅',
    };
    return icons[type] || '⚙️';
  }

  /**
   * Filter relevant files for flow analysis
   */
  private filterRelevantFiles(fileChanges: FileChange[]): FileChange[] {
    return fileChanges.filter(file => {
      const filename = file.filename.toLowerCase();

      // Exclude obvious non-code files
      const excludePatterns = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        '.gitignore',
        '.eslintrc',
        'readme.md',
        'license',
        'dockerfile',
        'docker-compose',
        '.env',
        'tsconfig.json',
        'jest.config',
        'webpack.config',
      ];

      const basename = filename.split('/').pop() || '';
      if (excludePatterns.some(pattern => basename.includes(pattern))) {
        return false;
      }

      // Include code files
      const includeExtensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.vue',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.cs',
        '.php',
        '.rb',
        '.swift',
        '.kt',
      ];

      return includeExtensions.some(ext => filename.endsWith(ext));
    });
  }

  /**
   * Build file context for AI analysis
   */
  private buildFileContext(files: FileChange[]): string {
    return files
      .map(file => {
        const changes = file.patch
          ? `\n${file.patch.substring(0, 500)}${file.patch.length > 500 ? '...' : ''}`
          : ' (no patch available)';

        return `## ${file.filename} (${file.status})\n${changes}`;
      })
      .join('\n\n');
  }

  /**
   * Generate title for flow chart
   */
  private generateTitle(prPlan: PRPlan): string {
    return `PR Flow Analysis: ${prPlan.overview.substring(0, 60)}${prPlan.overview.length > 60 ? '...' : ''}`;
  }

  /**
   * Generate description for flow chart
   */
  private generateDescription(businessFlow: BusinessStep[], codeFlow: CodeFlow[]): string {
    const businessSteps = businessFlow.length;
    const codeComponents = codeFlow.length;

    return `This PR involves ${businessSteps} business step${businessSteps !== 1 ? 's' : ''} and ${codeComponents} code component${codeComponents !== 1 ? 's' : ''}. The diagrams below show both the business logic flow and the technical implementation architecture.`;
  }
}
