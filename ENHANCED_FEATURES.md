# Enhanced PR Reviewer Features

## Overview

The TechSee AI PR Reviewer now includes enhanced inline comment features that make code review more interactive and actionable:

1. **GitHub Suggested Changes with Commit Buttons** - Small fixes can be applied directly via GitHub's "Commit suggestion" button
2. **Cursor Deep Link Integration** - One-click file opening in Cursor at specific locations
3. **Smart Fix Detection** - Automatically detects when fixes are small enough for inline suggestions

## GitHub Suggested Changes

### What It Does
For small code fixes (≤10 lines by default), the PR reviewer now generates GitHub's native "suggested changes" format instead of traditional code blocks. This enables the "Commit suggestion" button that allows developers to apply fixes with a single click.

### How It Works
When the AI identifies a small fix, the comment will show:

```markdown
**💡 Suggested Fix:**

```suggestion
const correctedCode = 'fixed version';
```

> 💡 **Quick Apply**: This fix can be committed directly using the "Commit suggestion" button above.
```

### Configuration
```yaml
- uses: amitwa1/pr-reviewer@main
  with:
    enable_commit_suggestions: true  # Enable GitHub suggested changes (default: true)
    max_fix_size: 10                # Maximum lines for suggested changes (default: 10)
```

## Editor Integration

### What It Does
Provides multiple ways to open files at specific locations in various editors, using proven approaches from VS Code and GitHub integration.

### How It Works
Comments now include comprehensive action buttons:
- 💻 **VS Code Web** - Opens in vscode.dev (works in any browser, no installation needed)
- 🖥️ **Desktop Editors** - Direct links for VS Code and Cursor desktop applications
- 📂 **GitHub View** - Reliable fallback GitHub file view

### Example Output
```markdown
**🔧 Quick Actions:**
- 💻 **Open in VS Code**: [vscode.dev](https://vscode.dev/github/owner/repo/blob/sha/src/example.ts#L42)
- 🖥️ **Desktop Editors**: [VS Code](vscode://file/src/example.ts:42:1) | [Cursor](cursor://file/src/example.ts:42:1)
- 📂 **View on GitHub**: [src/example.ts:42](https://github.com/owner/repo/blob/sha/src/example.ts#L42)
- 🤖 Auto-Fix Available
```

### Configuration
```yaml
- uses: amitwa1/pr-reviewer@main
  with:
    enable_cursor_integration: true  # Enable editor integration (default: true)
```

## Complete Configuration Example

```yaml
name: PR Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: amitwa1/pr-reviewer@main
        with:
          # AI Configuration
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          ai_provider: anthropic
          model: claude-3-5-sonnet
          
          # Enhanced Features
          enable_commit_suggestions: true
          enable_cursor_integration: true
          max_fix_size: 15
          
          # Standard Configuration
          comment_style: both
          inline_severity: warning
          enable_suggestions: true
```

## Feature Details

### Suggested Changes Format
- **Automatic Detection**: The system automatically identifies when a fix is small enough for GitHub's suggested changes format
- **Original Code Extraction**: Intelligently extracts the original code from diffs to enable proper change suggestions
- **Fallback**: Larger fixes automatically fall back to traditional code blocks with syntax highlighting

### Cursor Deep Links
- **Protocol Support**: Uses the `cursor://` protocol for direct integration with Cursor editor
- **Precise Navigation**: Links include file path, line number, and column for exact positioning
- **Cross-Platform**: Works on all platforms where Cursor is installed

### Smart Enhancement
- **Diff Analysis**: Analyzes PR diffs to extract original code for suggested changes
- **Line Mapping**: Properly maps AI-reported line numbers to actual file positions
- **Intelligent Filtering**: Only enables enhanced features when appropriate conditions are met

## Benefits

1. **Faster Code Reviews**: Developers can apply small fixes instantly without switching contexts
2. **Better Developer Experience**: Direct integration with preferred tools (Cursor)
3. **Reduced Friction**: Eliminates copy-paste operations for simple fixes
4. **Maintains Compatibility**: All features are opt-in and don't break existing workflows

## Migration Guide

### From Previous Versions
The enhanced features are enabled by default but can be disabled if needed:

```yaml
# Disable enhanced features if needed
enable_commit_suggestions: false
enable_cursor_integration: false
```

### Compatibility
- **GitHub**: Suggested changes work on all GitHub repositories
- **Cursor**: Deep links require Cursor editor to be installed locally
- **Fallback**: All features gracefully fall back to traditional formats when not supported

## Technical Implementation

### GitHub Suggested Changes
- Uses GitHub's native `suggestion` code block format
- Requires both `originalCode` and `fixedCode` from AI analysis
- Automatically validates fix size against `max_fix_size` setting

### Cursor Integration
- Generates `cursor://file/{path}:{line}:{column}` URLs
- Works with local Cursor installations via protocol handlers
- Includes proper URL encoding for file paths with special characters

### Original Code Detection
- Parses PR diffs to extract original code at specific line numbers
- Handles additions, deletions, and modifications
- Provides fallback mechanisms when original code cannot be determined

