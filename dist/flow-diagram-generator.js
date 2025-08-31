"use strict";
/**
 * Flow diagram generator for PR changes
 * Analyzes file changes and creates Mermaid flow diagrams
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowDiagramGenerator = void 0;
const logger_1 = require("./logger");
class FlowDiagramGenerator {
    constructor(config = {}, aiProvider) {
        this.config = {
            maxNodes: 15,
            includeFileTypes: [
                '.ts',
                '.tsx',
                '.jsx',
                '.py',
                '.java',
                '.go',
                '.rs',
                '.cpp',
                '.c',
                '.cs',
                '.vue',
                '.svelte',
            ],
            excludeFileTypes: [
                '.test.',
                '.spec.',
                '.d.ts',
                '.min.js',
                'index.js',
                'main.js',
                'bundle.',
                'dist/',
                'build/',
                'node_modules/',
                '.config.',
                'webpack.',
                'vite.',
                'rollup.',
            ],
            showOnlyModified: true,
            ...config,
        };
        this.aiProvider = aiProvider;
    }
    /**
     * Generate flow diagram from PR changes
     */
    async generateFlowDiagram(fileChanges, prPlan, issues = []) {
        try {
            logger_1.logger.info('Generating flow diagram for PR changes...');
            // Filter relevant files
            const relevantFiles = this.filterRelevantFiles(fileChanges);
            if (relevantFiles.length === 0) {
                logger_1.logger.info('No relevant files found for flow diagram generation after strict filtering');
                // Fallback: try with more lenient filtering (just exclude obvious build artifacts)
                const fallbackFiles = fileChanges.filter(file => {
                    const filename = file.filename.toLowerCase();
                    const fallbackExcludes = [
                        'node_modules/',
                        'dist/',
                        'build/',
                        '.min.js',
                        'bundle.',
                        'package-lock.json',
                        'yarn.lock',
                        'coverage/',
                        '.nyc_output/',
                    ];
                    const isExcluded = fallbackExcludes.some(pattern => filename.includes(pattern));
                    // For .js files, be more selective - include only if they're in src/ or similar
                    if (filename.endsWith('.js')) {
                        const isLikelySource = filename.includes('src/') ||
                            filename.includes('lib/') ||
                            filename.includes('app/') ||
                            !filename.includes('index.js'); // Exclude index.js specifically
                        if (!isLikelySource) {
                            logger_1.logger.info(`Excluding JS file that appears to be build artifact: ${file.filename}`);
                            return false;
                        }
                    }
                    return !isExcluded && file.patch && file.patch.trim().length > 0;
                });
                if (fallbackFiles.length === 0) {
                    logger_1.logger.info('No files found even with fallback filtering');
                    return null;
                }
                logger_1.logger.info(`Using fallback filtering: found ${fallbackFiles.length} files`);
                // Continue with fallback files
                return this.generateDiagramFromFiles(fallbackFiles, prPlan, issues);
            }
            // If AI provider is available, enhance with intelligent flow analysis
            if (this.aiProvider) {
                return this.generateAIEnhancedDiagram(relevantFiles, prPlan, issues);
            }
            else {
                return this.generateDiagramFromFiles(relevantFiles, prPlan, issues);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to generate flow diagram:', error);
            return null;
        }
    }
    /**
     * Generate AI-enhanced flow diagram with intelligent analysis
     */
    async generateAIEnhancedDiagram(files, prPlan, issues) {
        logger_1.logger.info('Generating AI-enhanced flow diagram...');
        try {
            // Get AI analysis of the code flow
            const flowAnalysis = await this.analyzeCodeFlowWithAI(files, prPlan);
            // Generate intelligent nodes based on AI analysis
            const nodes = this.generateIntelligentNodes(files, flowAnalysis, issues);
            // Generate intelligent edges based on AI analysis
            const edges = this.generateIntelligentEdges(flowAnalysis, nodes);
            // Generate enhanced Mermaid code
            const mermaidCode = this.generateEnhancedMermaidCode(nodes, edges, flowAnalysis);
            const diagram = {
                title: `Flow Analysis: ${flowAnalysis.overview}`,
                description: `${flowAnalysis.mainFlow.join(' → ')}`,
                nodes,
                edges,
                mermaidCode,
            };
            logger_1.logger.info(`Generated AI-enhanced diagram with ${nodes.length} nodes and ${edges.length} edges`);
            return diagram;
        }
        catch (error) {
            logger_1.logger.warn('AI analysis failed, falling back to basic diagram:', error);
            return this.generateDiagramFromFiles(files, prPlan, issues);
        }
    }
    /**
     * Generate diagram from a list of files
     */
    generateDiagramFromFiles(files, prPlan, issues) {
        // Analyze file relationships
        const nodes = this.extractNodes(files, issues);
        const edges = this.extractEdges(files);
        // Limit nodes to prevent diagram complexity
        const limitedNodes = this.limitNodes(nodes);
        const filteredEdges = this.filterEdges(edges, limitedNodes);
        // Generate Mermaid code
        const mermaidCode = this.generateMermaidCode(limitedNodes, filteredEdges);
        const diagram = {
            title: this.generateTitle(prPlan),
            description: this.generateDescription(prPlan, limitedNodes.length),
            nodes: limitedNodes,
            edges: filteredEdges,
            mermaidCode,
        };
        logger_1.logger.info(`Generated flow diagram with ${limitedNodes.length} nodes and ${filteredEdges.length} edges`);
        return diagram;
    }
    /**
     * Analyze code flow using AI
     */
    async analyzeCodeFlowWithAI(files, prPlan) {
        if (!this.aiProvider) {
            throw new Error('AI provider not available');
        }
        const prompt = this.buildFlowAnalysisPrompt(files, prPlan);
        try {
            // Use the AI provider's reviewCode method to analyze the flow
            const response = await this.aiProvider.reviewCode(prompt, this.getCodeContext(files), []);
            // Parse the AI response to extract flow analysis
            return this.parseFlowAnalysisResponse(response);
        }
        catch (error) {
            logger_1.logger.error('AI flow analysis failed:', error);
            throw error;
        }
    }
    /**
     * Build prompt for AI flow analysis
     */
    buildFlowAnalysisPrompt(files, prPlan) {
        return `# High-Level Flow Analysis Request

Create a simple, high-level flow diagram that shows the main business process or user journey for this PR.

## PR Context
**Overview**: ${prPlan.overview}
**Key Changes**: ${prPlan.keyChanges.join(', ')}

## Instructions

Focus on the HIGH-LEVEL user experience and business flow. Create a simple flow with 3-6 main steps.

Provide a JSON response with this structure:

\`\`\`json
{
  "overview": "What this feature/change does from a user perspective",
  "mainFlow": [
    "User starts process",
    "System validates input",
    "Data is processed", 
    "User sees result"
  ]
}
\`\`\`

Rules:
- Keep it simple (3-6 steps maximum)
- Focus on USER ACTIONS and OUTCOMES, not technical implementation
- Use business language, not technical terms
- Show the end-to-end journey
- Avoid technical details like "API calls" or "component rendering"

Example good flows:
- "User logs in" → "System validates credentials" → "User access granted"
- "User submits form" → "Data is saved" → "Confirmation shown"
- "User clicks button" → "Process starts" → "Results displayed"`;
    }
    /**
     * Get code context from file changes
     */
    getCodeContext(files) {
        return files
            .map(file => {
            const patch = file.patch || '';
            const addedLines = patch
                .split('\n')
                .filter(line => line.startsWith('+') && !line.startsWith('+++'))
                .map(line => line.substring(1))
                .join('\n');
            return `## ${file.filename} (${file.status})
\`\`\`
${addedLines}
\`\`\``;
        })
            .join('\n\n');
    }
    /**
     * Parse AI response for flow analysis
     */
    parseFlowAnalysisResponse(response) {
        // If response is an array of issues (from reviewCode), try to extract JSON from descriptions
        if (Array.isArray(response)) {
            for (const issue of response) {
                if (issue.description) {
                    try {
                        const jsonMatch = issue.description.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            return {
                                overview: parsed.overview || 'Feature implementation',
                                mainFlow: parsed.mainFlow || [
                                    'User action',
                                    'System processing',
                                    'Result displayed',
                                ],
                            };
                        }
                    }
                    catch (e) {
                        // Continue trying
                    }
                }
            }
        }
        // Fallback to basic analysis (will be enhanced by generateDefaultFlow)
        return {
            overview: 'Feature implementation',
            mainFlow: [], // Empty array will trigger generateDefaultFlow
        };
    }
    /**
     * Filter files relevant for flow diagram
     */
    filterRelevantFiles(fileChanges) {
        return fileChanges.filter(file => {
            const filename = file.filename.toLowerCase();
            // First check exclusions (more specific)
            const isExcluded = this.config.excludeFileTypes.some(pattern => filename.includes(pattern.toLowerCase()));
            if (isExcluded) {
                logger_1.logger.info(`Excluding file from flow diagram: ${file.filename} (matches exclusion pattern)`);
                return false;
            }
            // Check file extension (must end with one of the included types)
            const hasRelevantExtension = this.config.includeFileTypes.some(ext => filename.endsWith(ext.toLowerCase()));
            if (!hasRelevantExtension) {
                logger_1.logger.info(`Excluding file from flow diagram: ${file.filename} (no relevant extension)`);
                return false;
            }
            // Exclude very common build/config files by exact name
            const commonExcludes = [
                'package.json',
                'package-lock.json',
                'yarn.lock',
                'tsconfig.json',
                'jest.config.js',
                'babel.config.js',
                'eslint.config.js',
                '.eslintrc.js',
                'README.md',
                'LICENSE',
                'CHANGELOG.md',
            ];
            const basename = file.filename.split('/').pop()?.toLowerCase() || '';
            if (commonExcludes.includes(basename)) {
                logger_1.logger.info(`Excluding common file from flow diagram: ${file.filename}`);
                return false;
            }
            // If showOnlyModified is true, only include modified files
            if (this.config.showOnlyModified && file.status === 'removed') {
                return false;
            }
            // Exclude empty patches (no actual code changes)
            if (!file.patch || file.patch.trim().length === 0) {
                logger_1.logger.info(`Excluding file with no patch: ${file.filename}`);
                return false;
            }
            logger_1.logger.info(`Including file in flow diagram: ${file.filename}`);
            return true;
        });
    }
    /**
   * Generate intelligent nodes based on AI analysis
   */
    generateIntelligentNodes(files, flowAnalysis, _issues) {
        const nodes = [];
        // Ensure we have at least 3 steps in the flow
        let steps = flowAnalysis.mainFlow;
        if (steps.length < 3) {
            // Generate default flow based on file changes
            steps = this.generateDefaultFlow(files);
        }
        // Create simple flow step nodes from main flow
        steps.forEach((step, index) => {
            const stepType = this.determineStepType(step, index, steps.length);
            nodes.push({
                id: this.sanitizeId(`step_${index + 1}_${step}`),
                label: step,
                type: stepType,
                status: 'unchanged',
                importance: index === 0 || index === steps.length - 1 ? 'high' : 'medium',
                description: `Step ${index + 1}: ${step}`,
                functionality: step,
            });
        });
        return nodes;
    }
    /**
     * Generate default flow when AI doesn't provide enough steps
     */
    generateDefaultFlow(files) {
        const hasComponents = files.some(f => f.filename.includes('component') || f.filename.includes('Component'));
        const hasServices = files.some(f => f.filename.includes('service') || f.filename.includes('Service'));
        const hasAPI = files.some(f => f.filename.includes('api') || f.filename.includes('API'));
        const hasDatabase = files.some(f => f.filename.includes('db') || f.filename.includes('model') || f.filename.includes('schema'));
        if (hasComponents && hasServices) {
            return [
                'User interacts with interface',
                'Component processes request',
                'Service handles business logic',
                'Data is updated',
                'User sees result'
            ];
        }
        if (hasAPI) {
            return [
                'Client sends request',
                'API validates input',
                'Server processes data',
                'Response sent back'
            ];
        }
        if (hasDatabase) {
            return [
                'User submits data',
                'System validates input',
                'Database is updated',
                'Confirmation displayed'
            ];
        }
        // Generic flow
        return [
            'User initiates action',
            'System processes request',
            'Data is handled',
            'Result is displayed'
        ];
    }
    /**
     * Determine step type based on content and position
     */
    determineStepType(step, index, totalSteps) {
        const lowerStep = step.toLowerCase();
        // First step is usually user action
        if (index === 0) {
            return 'process';
        }
        // Last step is usually result/outcome
        if (index === totalSteps - 1) {
            return 'process';
        }
        // Middle steps are processes
        if (lowerStep.includes('validate') ||
            lowerStep.includes('check') ||
            lowerStep.includes('verify')) {
            return 'process';
        }
        if (lowerStep.includes('save') ||
            lowerStep.includes('store') ||
            lowerStep.includes('process')) {
            return 'data';
        }
        return 'process';
    }
    /**
     * Generate intelligent edges based on AI analysis
     */
    generateIntelligentEdges(flowAnalysis, nodes) {
        const edges = [];
        // Create simple sequential flow edges
        for (let i = 0; i < nodes.length - 1; i++) {
            const currentNode = nodes[i];
            const nextNode = nodes[i + 1];
            if (currentNode && nextNode) {
                edges.push({
                    from: currentNode.id,
                    to: nextNode.id,
                    type: 'triggers',
                    label: '',
                    description: `Flows to next step`,
                });
            }
        }
        return edges;
    }
    /**
     * Generate enhanced Mermaid code with AI insights
     */
    generateEnhancedMermaidCode(nodes, edges, flowAnalysis) {
        let mermaid = `flowchart TD\n`;
        // Add title as comment
        mermaid += `    %% ${flowAnalysis.overview}\n\n`;
        // Add nodes with simple, clean shapes
        for (const node of nodes) {
            const shape = this.getSimpleNodeShape(node);
            mermaid += `    ${node.id}${shape}\n`;
        }
        mermaid += '\n';
        // Add simple edges
        for (const edge of edges) {
            mermaid += `    ${edge.from} --> ${edge.to}\n`;
        }
        // Add simple styling
        mermaid += this.generateSimpleStyling();
        return mermaid;
    }
    /**
     * Get simple node shape for clean diagrams
     */
    getSimpleNodeShape(node) {
        const label = node.label;
        switch (node.type) {
            case 'process':
                return `["${label}"]`;
            case 'data':
                return `[("${label}")]`;
            default:
                return `["${label}"]`;
        }
    }
    /**
     * Generate simple styling for clean diagrams
     */
    generateSimpleStyling() {
        return `
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef data fill:#fff3e0,stroke:#f57c00,stroke-width:2px
`;
    }
    /**
     * Extract file functionality from patch
     */
    extractFileFunctionality(file) {
        if (!file.patch)
            return 'File changes';
        const addedLines = file.patch
            .split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1).trim())
            .filter(line => line.length > 0)
            .slice(0, 3) // First 3 meaningful lines
            .join('; ');
        return addedLines || 'Code modifications';
    }
    /**
     * Get enhanced node shape based on type
     */
    getEnhancedNodeShape(node) {
        const label = node.label;
        switch (node.type) {
            case 'process':
                return `[("${label}")]`;
            case 'data':
                return `[("📊 ${label}")]`;
            case 'component':
                return `[["⚛️ ${label}"]]`;
            case 'module':
                return `{{"⚙️ ${label}"}}`;
            case 'class':
                return `["🏗️ ${label}"]`;
            case 'function':
                return `("🔧 ${label}")`;
            default:
                return `["${label}"]`;
        }
    }
    /**
     * Get enhanced edge arrow type
     */
    getEnhancedEdgeArrow(type) {
        switch (type) {
            case 'processes':
                return '-->';
            case 'triggers':
                return '==>';
            case 'returns':
                return '-..->';
            case 'imports':
                return '-->';
            case 'calls':
                return '-..->';
            default:
                return '-->';
        }
    }
    /**
     * Generate enhanced styling
     */
    generateEnhancedStyling() {
        return `
    classDef added fill:#d4edda,stroke:#28a745,stroke-width:2px
    classDef modified fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef removed fill:#f8d7da,stroke:#dc3545,stroke-width:2px
    classDef renamed fill:#e2e3e5,stroke:#6c757d,stroke-width:2px
    classDef high-importance stroke:#dc3545,stroke-width:3px
    classDef process fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef data fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
`;
    }
    /**
     * Extract nodes from file changes
     */
    extractNodes(fileChanges, issues) {
        const nodes = [];
        for (const file of fileChanges) {
            const fileIssues = issues.filter(issue => issue.file === file.filename);
            const hasHighSeverityIssues = fileIssues.some(issue => issue.severity === 'high' || issue.type === 'error');
            const node = {
                id: this.sanitizeId(file.filename),
                label: this.getFileLabel(file.filename),
                type: this.determineFileType(file.filename),
                status: file.status,
                importance: this.determineImportance(file, fileIssues, hasHighSeverityIssues),
            };
            nodes.push(node);
        }
        return nodes;
    }
    /**
     * Extract edges (relationships) between files
     */
    extractEdges(fileChanges) {
        const edges = [];
        for (const file of fileChanges) {
            if (file.patch) {
                const relationships = this.analyzeFileRelationships(file);
                edges.push(...relationships);
            }
        }
        return edges;
    }
    /**
     * Analyze file relationships from patch content
     */
    analyzeFileRelationships(file) {
        const edges = [];
        if (!file.patch)
            return edges;
        const lines = file.patch.split('\n');
        const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
        for (const line of addedLines) {
            // Look for import statements
            const importMatches = this.extractImports(line);
            for (const importPath of importMatches) {
                edges.push({
                    from: this.sanitizeId(file.filename),
                    to: this.sanitizeId(importPath),
                    type: 'imports',
                    label: 'imports',
                });
            }
            // Look for function calls or class usage
            const callMatches = this.extractCalls(line);
            for (const call of callMatches) {
                edges.push({
                    from: this.sanitizeId(file.filename),
                    to: this.sanitizeId(call),
                    type: 'calls',
                    label: 'uses',
                });
            }
        }
        return edges;
    }
    /**
     * Extract import statements from a line
     */
    extractImports(line) {
        const imports = [];
        // JavaScript/TypeScript imports
        const jsImportRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = jsImportRegex.exec(line)) !== null) {
            if (match[1]) {
                let importPath = match[1];
                // Handle relative imports
                if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    // Convert relative path to filename
                    importPath = importPath.replace(/^\.\.?\//, '').replace(/\//g, '_');
                    // Add appropriate extension if not present
                    if (!importPath.includes('.')) {
                        importPath += '.ts';
                    }
                    imports.push(importPath);
                }
                else if (!importPath.startsWith('@') && !importPath.includes('node_modules')) {
                    // Internal module import
                    imports.push(importPath.replace(/\//g, '_'));
                }
            }
        }
        // Also look for direct class/service usage
        const serviceRegex = /new\s+(\w+Service|\w+Client|\w+Manager|\w+Handler)/g;
        while ((match = serviceRegex.exec(line)) !== null) {
            if (match[1]) {
                imports.push(match[1]);
            }
        }
        // Python imports
        const pyImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
        while ((match = pyImportRegex.exec(line)) !== null) {
            const importName = match[1] || match[2];
            if (importName && !importName.startsWith('.')) {
                imports.push(importName + '.py');
            }
        }
        return imports;
    }
    /**
     * Extract function/class calls from a line
     */
    extractCalls(line) {
        const calls = [];
        // Look for function calls (simplified)
        const callRegex = /(\w+)\s*\(/g;
        let match;
        while ((match = callRegex.exec(line)) !== null) {
            if (match[1] && match[1].length > 2) {
                calls.push(match[1]);
            }
        }
        return calls.slice(0, 3); // Limit to prevent too many edges
    }
    /**
     * Limit nodes to prevent diagram complexity
     */
    limitNodes(nodes) {
        if (nodes.length <= this.config.maxNodes) {
            return nodes;
        }
        // Sort by importance and status
        const sortedNodes = nodes.sort((a, b) => {
            const importanceOrder = { high: 3, medium: 2, low: 1 };
            const statusOrder = { added: 3, modified: 2, renamed: 2, removed: 1, unchanged: 0 };
            const aScore = importanceOrder[a.importance] + statusOrder[a.status];
            const bScore = importanceOrder[b.importance] + statusOrder[b.status];
            return bScore - aScore;
        });
        return sortedNodes.slice(0, this.config.maxNodes);
    }
    /**
     * Filter edges to only include those between existing nodes
     */
    filterEdges(edges, nodes) {
        const nodeIds = new Set(nodes.map(node => node.id));
        return edges.filter(edge => {
            // Direct ID match
            if (nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to) {
                return true;
            }
            // Try to match by partial name
            const fromNode = nodes.find(n => n.label.toLowerCase().includes(edge.to.toLowerCase()) ||
                edge.to
                    .toLowerCase()
                    .includes(n.label.toLowerCase().replace('.ts', '').replace('.tsx', '')));
            const toNode = nodes.find(n => n.label.toLowerCase().includes(edge.from.toLowerCase()) ||
                edge.from
                    .toLowerCase()
                    .includes(n.label.toLowerCase().replace('.ts', '').replace('.tsx', '')));
            if (fromNode && toNode && fromNode.id !== toNode.id) {
                // Update edge IDs to match actual node IDs
                edge.from = fromNode.id;
                edge.to = toNode.id;
                return true;
            }
            return false;
        });
    }
    /**
     * Generate Mermaid flowchart code
     */
    generateMermaidCode(nodes, edges) {
        let mermaid = 'flowchart TD\n';
        // Add nodes with styling
        for (const node of nodes) {
            const shape = this.getNodeShape(node);
            const style = this.getNodeStyle(node);
            mermaid += `    ${node.id}${shape}\n`;
            if (style) {
                mermaid += `    ${style}\n`;
            }
        }
        // Add edges
        for (const edge of edges) {
            const arrow = this.getEdgeArrow(edge.type);
            const label = edge.label ? `|${edge.label}|` : '';
            mermaid += `    ${edge.from} ${arrow}${label} ${edge.to}\n`;
        }
        // Add styling classes
        mermaid += this.generateStyling();
        return mermaid;
    }
    /**
     * Get Mermaid node shape based on type and status
     */
    getNodeShape(node) {
        const label = node.label;
        switch (node.type) {
            case 'component':
                return `[["${label}"]]`;
            case 'class':
                return `["${label}"]`;
            case 'function':
                return `("${label}")`;
            case 'module':
                return `{{"${label}"}}`;
            default:
                return `["${label}"]`;
        }
    }
    /**
     * Get node styling based on status and importance
     */
    getNodeStyle(node) {
        const classNames = [];
        // Status styling
        switch (node.status) {
            case 'added':
                classNames.push('added');
                break;
            case 'modified':
                classNames.push('modified');
                break;
            case 'removed':
                classNames.push('removed');
                break;
            case 'renamed':
                classNames.push('renamed');
                break;
        }
        // Importance styling
        if (node.importance === 'high') {
            classNames.push('high-importance');
        }
        return classNames.length > 0 ? `    class ${node.id} ${classNames.join(',')}` : null;
    }
    /**
     * Get edge arrow type
     */
    getEdgeArrow(type) {
        switch (type) {
            case 'imports':
                return '-->';
            case 'calls':
                return '-..->';
            case 'extends':
                return '==>';
            case 'implements':
                return '==>';
            default:
                return '-->';
        }
    }
    /**
     * Generate CSS styling for the diagram
     */
    generateStyling() {
        return `
    classDef added fill:#d4edda,stroke:#28a745,stroke-width:2px
    classDef modified fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef removed fill:#f8d7da,stroke:#dc3545,stroke-width:2px
    classDef renamed fill:#e2e3e5,stroke:#6c757d,stroke-width:2px
    classDef high-importance stroke:#dc3545,stroke-width:3px
`;
    }
    /**
     * Determine file type based on filename and content
     */
    determineFileType(filename) {
        const lower = filename.toLowerCase();
        const basename = filename.split('/').pop()?.toLowerCase() || '';
        // Modules/Services/Utilities (check first to override component detection)
        if (basename.includes('service') ||
            basename.includes('util') ||
            basename.includes('helper') ||
            basename.includes('manager') ||
            basename.includes('handler') ||
            basename.includes('controller') ||
            basename.includes('api') ||
            basename.includes('client')) {
            return 'module';
        }
        // Component detection (React, Vue, Svelte)
        if (lower.endsWith('.tsx') ||
            lower.endsWith('.jsx') ||
            lower.endsWith('.vue') ||
            lower.endsWith('.svelte') ||
            basename.includes('component') ||
            basename.startsWith('use') // React hooks
        ) {
            return 'component';
        }
        // Class-based languages
        if (lower.endsWith('.java') || lower.endsWith('.cs') || basename.includes('class')) {
            return 'class';
        }
        // Function-based files
        if (basename.includes('function') ||
            basename.includes('hook') ||
            basename.includes('middleware')) {
            return 'function';
        }
        return 'file';
    }
    /**
     * Determine node importance based on file changes and issues
     */
    determineImportance(file, issues, hasHighSeverityIssues) {
        // High importance if has high severity issues
        if (hasHighSeverityIssues) {
            return 'high';
        }
        // High importance for large changes
        if (file.changes > 50) {
            return 'high';
        }
        // Medium importance for moderate changes or multiple issues
        if (file.changes > 10 || issues.length > 2) {
            return 'medium';
        }
        return 'low';
    }
    /**
     * Generate diagram title
     */
    generateTitle(prPlan) {
        return `PR Flow Diagram: ${prPlan.overview.slice(0, 50)}${prPlan.overview.length > 50 ? '...' : ''}`;
    }
    /**
     * Generate diagram description
     */
    generateDescription(prPlan, nodeCount) {
        return `This diagram shows the flow of changes across ${nodeCount} key files in this PR. ${prPlan.keyChanges.slice(0, 2).join(', ')}.`;
    }
    /**
     * Sanitize ID for Mermaid
     */
    sanitizeId(input) {
        return input
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^(\d)/, '_$1') // Ensure doesn't start with number
            .slice(0, 20); // Limit length
    }
    /**
     * Get file label for display
     */
    getFileLabel(filename) {
        const parts = filename.split('/');
        const name = parts[parts.length - 1] || filename;
        // Truncate long names
        return name.length > 20 ? name.slice(0, 17) + '...' : name;
    }
}
exports.FlowDiagramGenerator = FlowDiagramGenerator;
//# sourceMappingURL=flow-diagram-generator.js.map