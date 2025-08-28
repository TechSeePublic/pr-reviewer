# 🤖 Cursor AI PR Reviewer

An AI-powered GitHub Action that automatically reviews pull requests according to your project's Cursor AI rules. This bot respects all Cursor rule formats including the new `.cursor/rules/*.mdc` format, `AGENTS.md`, and legacy `.cursorrules`.

## ✨ Features

- 🎯 **Respects Cursor Rules** - Supports all Cursor rule formats (`.cursor/rules/*.mdc`, `AGENTS.md`, `.cursorrules`)
- 🔍 **Smart Code Analysis** - AI-powered review using OpenAI or Anthropic
- 💬 **Dual Comment System** - Both inline file comments and PR summary comments
- ⚙️ **Highly Configurable** - Customize review behavior, severity levels, and comment styles
- 🚀 **Zero Infrastructure** - Runs entirely on GitHub Actions, no servers needed
- 🛡️ **Secure** - Code never leaves GitHub's infrastructure
- 📊 **Comprehensive Reporting** - Detailed review statistics and rule application tracking
- 🚨 **Fail-Fast Error Handling** - Action fails immediately on AI provider errors for better debugging
- ⏱️ **Smart Rate Limiting** - Sequential file processing with configurable delays to avoid AI provider rate limits

## 🚀 Quick Start

### Rate Limiting & Error Handling

The action now processes files **one by one** (instead of in batches) with configurable delays between AI provider requests to avoid rate limits. If any AI provider request fails, the action will **fail immediately** instead of continuing with fallback behavior.

**Key Changes:**
- ⚡ **Sequential Processing**: Files are reviewed one at a time to prevent overwhelming AI providers
- ⏱️ **Configurable Delays**: Use `request_delay` to set milliseconds between requests (default: 2000ms)
- 🚨 **Fail-Fast**: Action stops immediately on AI provider errors for better debugging
- 📊 **Progress Tracking**: Clear logging shows which file is being reviewed and when delays occur

### 1. Add to Your Workflow

Create `.github/workflows/pr-review.yml`:

```yaml
name: PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: AI Code Review
        uses: amit.wagner/pr-reviewer@v1
        with:
          gh_token: ${{ secrets.GH_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          review_level: 'standard'
          comment_style: 'both'
          request_delay: '3000'  # 3 seconds between requests to avoid rate limits
```

### 2. Set Up API Keys

Add your AI provider API key to GitHub Secrets:
- `OPENAI_API_KEY` for OpenAI (recommended)
- `ANTHROPIC_API_KEY` for Anthropic Claude

### 3. Configure Cursor Rules

The bot automatically detects and applies Cursor rules from:
- `.cursor/rules/*.mdc` files (new format)
- `AGENTS.md` file in project root
- `.cursorrules` file (legacy format)

## 📋 Configuration Options

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `gh_token` | GitHub token for API access | `${{ github.token }}` | ✅ |
| `openai_api_key` | OpenAI API key | - | ⚠️ |
| `anthropic_api_key` | Anthropic API key | - | ⚠️ |
| `ai_provider` | AI provider (`openai`, `anthropic`, `auto`) | `auto` | ❌ |
| `model` | AI model to use | `auto` | ❌ |
| `review_level` | Review intensity (`light`, `standard`, `thorough`) | `standard` | ❌ |
| `comment_style` | Comment style (`inline`, `summary`, `both`) | `both` | ❌ |
| `inline_severity` | Min severity for inline comments (`error`, `warning`, `info`, `all`) | `warning` | ❌ |
| `summary_format` | Summary format (`brief`, `detailed`, `minimal`) | `detailed` | ❌ |
| `include_patterns` | File patterns to include (comma-separated) | `**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py,**/*.go,**/*.rs,**/*.java,**/*.cs` | ❌ |
| `exclude_patterns` | File patterns to exclude (comma-separated) | `node_modules/**,dist/**,build/**,coverage/**,*.min.js,*.bundle.js` | ❌ |
| `max_files` | Maximum files to review | `50` | ❌ |
| `enable_suggestions` | Enable code suggestions | `true` | ❌ |
| `skip_if_no_rules` | Skip review if no rules found | `false` | ❌ |
| `update_existing_comments` | Update existing bot comments | `true` | ❌ |
| `request_delay` | Delay in milliseconds between AI provider requests to avoid rate limits | `2000` | ❌ |

⚠️ *At least one AI provider API key is required*

## 🤖 Supported AI Models

### OpenAI Models

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `gpt-4o` | Latest GPT-4 with improved reasoning and speed | Complex analysis, detailed reviews | Premium |
| `gpt-4` | Original GPT-4 with excellent reasoning | Complex analysis, detailed reviews | Premium |
| `gpt-4o-mini` | Fast and cost-effective GPT-4 variant | Quick reviews, large PRs | Standard |
| `gpt-4-turbo` | Enhanced GPT-4 with larger context window | Complex analysis, large files | Premium |
| `gpt-3.5-turbo` | Fast and reliable for most code reviews | Quick reviews, standard reviews | Standard |

### Anthropic Models

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `claude-3-5-sonnet-20241022` | Latest Claude with enhanced code understanding | Complex analysis, detailed reviews | Premium |
| `claude-3-opus-20240229` | Most capable Claude model for complex reasoning | Complex analysis, detailed reviews | Premium |
| `claude-3-sonnet-20240229` | Balanced Claude model for comprehensive reviews | Detailed reviews, balanced cost-quality | Premium |
| `claude-3-haiku-20240307` | Fast and cost-effective Claude model | Quick reviews, large PRs | Standard |

### Smart Model Selection

The action can automatically select the best model based on your `review_level`:

- **Light reviews** → Fast, cost-effective models (`gpt-4o-mini`, `claude-3-haiku`)
- **Standard reviews** → Balanced models (`gpt-4`, `claude-3-sonnet`)  
- **Thorough reviews** → Premium models (`gpt-4o`, `claude-3-5-sonnet`)

```yaml
# Automatic model selection
- uses: amit.wagner/pr-reviewer@v1
  with:
    model: 'auto'              # Let the action choose
    review_level: 'thorough'   # This will select premium models
    ai_provider: 'auto'        # Choose provider automatically
    request_delay: '5000'      # 5 seconds between requests for thorough reviews
```

## 🎨 Comment Examples

### Inline Comments
```markdown
## 🤖 Cursor Rule Violation

**⚠️ WARNING:** Missing type annotation

Function parameters should have explicit TypeScript types according to your project's Cursor rules.

**📋 Rule:** `typescript-strict` - Always use TypeScript types

**💡 Suggestion:**
```typescript
const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
```

---
*Generated by Cursor AI PR Reviewer*
```

### Summary Comments
```markdown
## 🤖 Cursor AI PR Review Summary

### ⚠️ **Overall Status: NEEDS ATTENTION**

### 📊 **Review Statistics**
- **Files Reviewed:** 8/12
- **Issues Found:** 3
- **Rules Applied:** 5

### ⚠️ **Issues by Type**
- **⚠️ WARNING:** 2
- **ℹ️ INFO:** 1

### 📝 **Cursor Rules Applied**
- 🔒 `typescript-strict` - Always use TypeScript types
- 📎 `react-patterns` - React component patterns
- 🤖 `code-style` - Project code style guide

### 🎯 **Assessment**
Great work on the new feature! Just a few TypeScript type annotations needed to fully comply with your Cursor rules.

### 🚀 **Next Steps**
1. Review the 3 issues identified above
2. Apply the suggested fixes
3. Push changes to trigger a new review

---
*Generated by Cursor AI PR Reviewer v1.0.0*
```

## 🎛️ Advanced Configuration

### Custom Review Levels

```yaml
# Light review - basic rule checking only
- uses: amit.wagner/pr-reviewer@v1
  with:
    review_level: 'light'
    inline_severity: 'error'

# Thorough review - comprehensive analysis
- uses: amit.wagner/pr-reviewer@v1
  with:
    review_level: 'thorough'
    inline_severity: 'info'
    summary_format: 'detailed'
```

### File Pattern Filtering

```yaml
# Review only TypeScript files
- uses: amit.wagner/pr-reviewer@v1
  with:
    include_patterns: '**/*.ts,**/*.tsx'
    exclude_patterns: '**/*.test.ts,**/*.spec.ts'
```

### Specific AI Models

```yaml
# Use latest GPT-4 model for premium quality
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'openai'
    model: 'gpt-4o'
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Use cost-effective model for large PRs
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'openai'
    model: 'gpt-4o-mini'
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Use latest Claude model for complex analysis
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'anthropic'
    model: 'claude-3-5-sonnet-20241022'
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Smart Model Selection

```yaml
# Auto-select best model based on review level
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'auto'           # Choose provider automatically
    model: 'auto'                 # Choose model based on review_level
    review_level: 'thorough'      # Will select premium models
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Multiple AI Providers

```yaml
# Prefer Anthropic, fallback to OpenAI
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'anthropic'
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

## 📚 Cursor Rules Support

### New Format (`.cursor/rules/*.mdc`)

```markdown
---
description: TypeScript strict typing rules
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# TypeScript Rules

- Always use explicit types for function parameters
- Avoid `any` type
- Use strict null checks

@typescript-template.ts
```

### AGENTS.md Format

```markdown
# Project Instructions

## Code Style
- Use TypeScript for all new files
- Prefer functional components in React
- Use snake_case for database columns

## Architecture
- Follow the repository pattern
- Keep business logic in service layers
```

### Legacy Format (`.cursorrules`)

```
Use TypeScript strict mode
Follow React best practices
Implement proper error handling
```

## 🔧 Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/amit.wagner/pr-reviewer.git
cd pr-reviewer

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run linting
npm run lint
```

### Release Process

```bash
# Patch release
npm run release patch

# Minor release
npm run release minor

# Major release
npm run release major

# Specific version
npm run release 1.2.3
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

**"No AI provider API key available"**
- Ensure you've set either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in GitHub Secrets

**"This action can only be run on pull request events"**
- Make sure your workflow triggers on `pull_request` events

**"Working directory is not clean"**
- Ensure the repository is checked out in your workflow before running the action

**Rate limit issues**
- The action automatically handles GitHub API rate limits
- For AI provider rate limits, consider using `review_level: 'light'`
- Adjust `request_delay` to increase delays between AI requests (default: 2000ms)
- The action now processes files sequentially (one by one) instead of in batches to prevent rate limiting

**Model compatibility issues**
- Ensure the model name matches exactly (case-sensitive)
- Check that the model is supported by your chosen provider
- Use `model: 'auto'` if unsure which model to choose

**"Model X is not supported by provider Y"**
- Verify the model name spelling and provider compatibility
- See the [Supported AI Models](#-supported-ai-models) section for valid combinations
- Use the automatic model selection feature for best results

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cursor](https://cursor.sh/) for the amazing AI-powered development environment
- [GitHub Actions](https://github.com/features/actions) for the CI/CD platform
- [OpenAI](https://openai.com/) and [Anthropic](https://anthropic.com/) for AI capabilities

## 📞 Support

- 📖 [Documentation](https://github.com/amit.wagner/pr-reviewer#readme)
- 🐛 [Issue Tracker](https://github.com/amit.wagner/pr-reviewer/issues)
- 💬 [Discussions](https://github.com/amit.wagner/pr-reviewer/discussions)

---

<div align="center">

**Made with ❤️ by the Cursor AI community**

[⭐ Star this repo](https://github.com/amit.wagner/pr-reviewer) • [🐛 Report bug](https://github.com/amit.wagner/pr-reviewer/issues) • [✨ Request feature](https://github.com/amit.wagner/pr-reviewer/issues)

</div>
