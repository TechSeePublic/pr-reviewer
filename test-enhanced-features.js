/**
 * Simple test to validate enhanced comment features
 */

const { CommentManager } = require('./dist/comment-manager');
const { mockInputs, mockPRContext, mockFileChanges, mockIssues } = require('./test-mocks');

// Test data
const testIssues = [
  {
    type: 'warning',
    category: 'best_practice',
    message: 'Use const instead of let for immutable variables',
    description: 'Variable is never reassigned, should use const',
    fixedCode: 'const userName = "john";',
    originalCode: 'let userName = "john";',
    ruleId: 'prefer-const',
    ruleName: 'Prefer const',
    file: 'src/example.ts',
    line: 42,
    severity: 'medium'
  },
  {
    type: 'error',
    category: 'bug',
    message: 'Missing null check',
    description: 'Potential null pointer exception',
    fixedCode: 'if (user && user.name) {\n  console.log(user.name);\n}',
    originalCode: 'console.log(user.name);',
    ruleId: 'null-check',
    ruleName: 'Null Safety',
    file: 'src/example.ts',
    line: 55,
    severity: 'high'
  }
];

const testFileChanges = [
  {
    filename: 'src/example.ts',
    status: 'modified',
    additions: 5,
    deletions: 3,
    changes: 8,
    patch: `@@ -40,7 +40,7 @@ function processUser() {
   // Process user data
-  let userName = "john";
+  const userName = "john";
   console.log(userName);
   
@@ -53,5 +53,7 @@ function processUser() {
   
-  console.log(user.name);
+  if (user && user.name) {
+    console.log(user.name);
+  }
 }`
  }
];

const testInputs = {
  ...mockInputs,
  enableCommitSuggestions: true,
  enableCursorIntegration: true,
  maxFixSize: 10,
  enableSuggestions: true
};

// Test comment formatting
function testEnhancedComments() {
  console.log('🧪 Testing Enhanced Comment Features...\n');

  const commentManager = new CommentManager(
    null, // mockGitHubClient
    testInputs,
    null, // mockAIProvider
    mockPRContext,
    null  // mockAutoFixManager
  );

  // Test original code enhancement
  const enhancedIssues = commentManager.enhanceIssuesWithOriginalCode(testIssues, testFileChanges);
  
  console.log('📊 Enhanced Issues Results:');
  enhancedIssues.forEach((issue, index) => {
    console.log(`\nIssue ${index + 1}:`);
    console.log(`  File: ${issue.file}:${issue.line}`);
    console.log(`  Message: ${issue.message}`);
    console.log(`  Has Fixed Code: ${!!issue.fixedCode}`);
    console.log(`  Has Original Code: ${!!issue.originalCode}`);
    console.log(`  Is Small Fix: ${issue.isSmallFix}`);
    
    if (issue.originalCode) {
      console.log(`  Original: "${issue.originalCode}"`);
      console.log(`  Fixed: "${issue.fixedCode}"`);
    }
  });

  console.log('\n✅ Enhanced comment features test completed');
  return enhancedIssues;
}

// Test comment formatting
function testCommentFormatting(enhancedIssues) {
  console.log('\n🎨 Testing Comment Formatting...\n');

  enhancedIssues.forEach((issue, index) => {
    console.log(`--- Issue ${index + 1} Comment Preview ---`);
    
    // Mock the private formatting methods
    const commentBody = formatMockComment(issue);
    console.log(commentBody);
    console.log('--- End Comment ---\n');
  });
}

// Mock comment formatting (simplified version of the private methods)
function formatMockComment(issue) {
  let body = `## 🔧 Code Review Finding\n\n`;
  body += `⚠️ **${issue.type.toUpperCase()}** | 💡 *${issue.category}*\n\n`;
  body += `### ${issue.message}\n\n`;
  body += `${issue.description}\n\n`;

  // Enhanced fix section
  if (issue.fixedCode) {
    if (issue.originalCode && issue.isSmallFix) {
      // GitHub suggested changes format
      body += `**💡 Suggested Fix:**\n\n`;
      body += `\`\`\`suggestion\n${issue.fixedCode}\n\`\`\`\n\n`;
      body += `> 💡 **Quick Apply**: This fix can be committed directly using the "Commit suggestion" button above.\n\n`;
    } else {
      // Traditional code block
      body += `**💡 Suggested Fix:**\n\`\`\`typescript\n${issue.fixedCode}\n\`\`\`\n\n`;
    }
  }

  // Action buttons
  body += `**🔧 Actions:**\n`;
  body += `- [🎯 Open in Cursor](cursor://file/${encodeURIComponent(issue.file)}:${issue.line}:1)\n`;
  if (issue.fixedCode) {
    body += `- 🤖 Auto-Fix Available\n`;
  }
  body += '\n';

  return body;
}

// Run tests
if (require.main === module) {
  try {
    const enhancedIssues = testEnhancedComments();
    testCommentFormatting(enhancedIssues);
    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

module.exports = {
  testEnhancedComments,
  testCommentFormatting,
  testIssues,
  testFileChanges
};

