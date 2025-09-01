#!/usr/bin/env node

const { FlowDiagramGenerator } = require('./dist/flow-diagram-generator');

// Mock AI that returns technical flow (what developers need)
class TechnicalAI {
  constructor() {
    this.name = 'openai';
    this.model = 'gpt-4';
    this.client = {
      chat: {
        completions: {
          create: async (params) => {
            console.log('🔧 Technical prompt sent to AI:');
            console.log('Focus areas from prompt:');
            const content = params.messages[1].content;
            if (content.includes('TECHNICAL IMPLEMENTATION')) {
              console.log('✅ Prompt focuses on technical implementation');
            }
            if (content.includes('Function calls and method execution')) {
              console.log('✅ Prompt mentions function calls');
            }
            if (content.includes('DEVELOPER\'S perspective')) {
              console.log('✅ Prompt targets developers');
            }
            
            // Return technical flow (simulating what AI should generate)
            return {
              choices: [{
                message: {
                  content: `flowchart TD
    A[Receive calculation request] --> B[Parse input parameters]
    B --> C[Validate numeric inputs]
    C --> D{Input valid?}
    D -->|No| E[Return validation error]
    D -->|Yes| F[Determine operation type]
    F --> G{Operation type}
    G -->|Factorial| H[Calculate factorial]
    G -->|Prime| I[Check if prime]
    G -->|Fibonacci| J[Calculate Fibonacci]
    H --> K[Return calculated result]
    I --> L{Is prime?}
    L -->|Yes| M[Return true with proof]
    L -->|No| N[Return false with factors]
    J --> O[Return sequence value]
    K --> P[Log operation completed]
    M --> P
    N --> P
    O --> P`
                }
              }]
            };
          }
        }
      }
    };
  }

  async reviewCode() { return []; }
  async generatePRPlan() { return {}; }
  async generateSummary() { return ''; }
  async reviewBatch() { return []; }
}

async function testTechnicalFlow() {
  console.log('🧪 Testing technical flow diagram generation for developers...\n');

  const mockAI = new TechnicalAI();
  const generator = new FlowDiagramGenerator({}, mockAI);

  try {
    const result = await generator.generateFlowDiagram(
      [
        { filename: 'src/calculator.ts', status: 'modified', patch: '+advanced math functions', additions: 30, deletions: 5, changes: 35 },
        { filename: 'src/validation.ts', status: 'added', patch: '+input validation', additions: 20, deletions: 0, changes: 20 },
        { filename: 'src/math-operations.ts', status: 'modified', patch: '+prime and fibonacci', additions: 45, deletions: 2, changes: 47 }
      ],
      { 
        overview: 'Add advanced mathematical operations with validation',
        keyChanges: [
          'Implement factorial, prime checking, and Fibonacci calculations',
          'Add comprehensive input validation',
          'Enhance error handling and logging'
        ],
        riskAreas: ['Mathematical accuracy', 'Input validation'],
        reviewFocus: ['Algorithm correctness', 'Error handling'],
        context: 'Enhanced calculator with advanced math capabilities and robust validation'
      }
    );

    if (result) {
      console.log('\n✅ Generated technical flow diagram!');
      console.log('📋 Title:', result.title);
      console.log('📝 Description:', result.description);
      
      console.log('\n🎨 Generated Technical Flow:');
      console.log('```mermaid');
      console.log(result.mermaidCode);
      console.log('```');
      
      // Analyze if it's truly technical
      const code = result.mermaidCode.toLowerCase();
      
      console.log('\n🔍 Technical Analysis:');
      
      // Good signs (technical/developer-focused)
      const technicalKeywords = [
        'receive', 'parse', 'validate', 'calculate', 'return', 'process', 
        'check', 'determine', 'log', 'error', 'request', 'response'
      ];
      const foundTechnical = technicalKeywords.filter(keyword => code.includes(keyword));
      if (foundTechnical.length > 0) {
        console.log(`✅ Technical keywords found: ${foundTechnical.join(', ')}`);
      }
      
      // Bad signs (user-focused)
      const userKeywords = ['user opens', 'user clicks', 'user sees', 'user enters', 'user selects'];
      const foundUser = userKeywords.filter(keyword => code.includes(keyword));
      if (foundUser.length > 0) {
        console.log(`❌ User-focused keywords found: ${foundUser.join(', ')}`);
      } else {
        console.log('✅ No user interaction keywords detected');
      }
      
      // Check for code-relevant content
      if (code.includes('function') || code.includes('method') || code.includes('api')) {
        console.log('✅ Contains code/API related content');
      }
      
      if (code.includes('validation') || code.includes('error') || code.includes('input')) {
        console.log('✅ Contains validation and error handling');
      }
      
    } else {
      console.log('❌ No diagram generated');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTechnicalFlow();
