# 🤖 TechSee AI PR Reviewer

An AI-powered GitHub Action that automatically reviews pull requests according to your project's Cursor AI rules. This bot respects all Cursor rule formats including the new `.cursor/rules/*.mdc` format, `AGENTS.md`, and legacy `.cursorrules`.

## ✨ Features

- 🎯 **Respects Cursor Rules** - Supports all Cursor rule formats (`.cursor/rules/*.mdc`, `AGENTS.md`, `.cursorrules`)
- 🔍 **Smart Code Analysis** - AI-powered review using OpenAI, Anthropic, or Azure
- 📋 **PR-Level Planning** - Creates comprehensive review plans understanding overall PR context
- 📦 **Intelligent Batching** - Processes files in batches with full PR context for better analysis
- 💬 **Dual Comment System** - Both inline file comments and PR summary comments
- ⚙️ **Highly Configurable** - Customize review behavior, severity levels, and comment styles
- 🚀 **Zero Infrastructure** - Runs entirely on GitHub Actions, no servers needed
- 🛡️ **Secure** - Code never leaves GitHub's infrastructure
- 📊 **Comprehensive Reporting** - Detailed review statistics and rule application tracking
- ⏱️ **Smart Rate Limiting** - Configurable delays for both AI providers and GitHub API calls
- 🔄 **Robust Fallback** - Falls back to single-file review if batch processing fails

## 🚀 Quick Start

### New 2-Step Review Process

The action now uses an intelligent 2-step approach for better PR understanding and faster processing:

**Step 1: PR Planning**
- 📋 **Analyzes all changes** to understand the overall PR intent and scope
- 🎯 **Identifies key changes**, risk areas, and review focus points
- 📝 **Creates a comprehensive plan** that guides the detailed review

**Step 2: Batch Review with Context**
- 📦 **Processes files in batches** (default: 5 files) with full PR context
- ⚡ **Faster processing** compared to file-by-file review
- 🔄 **Automatic fallback** to single-file review if batch processing fails
- ⏱️ **Smart rate limiting** for both AI providers and GitHub API calls

**Benefits:**
- 🚀 **Improved Performance**: Batch processing reduces total AI requests
- 🎯 **Better Context**: AI understands how files work together
- 📊 **Focused Analysis**: Reviews focus on critical issues that need fixing

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
          batch_size: '5'          # Process 5 files per batch
          request_delay: '2000'    # 2 seconds between AI requests
          github_rate_limit: '1000' # 1 second between GitHub API calls
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
| `azure_openai_api_key` | Azure OpenAI API key | - | ⚠️ |
| `azure_openai_endpoint` | Azure OpenAI endpoint URL | - | ⚠️ |
| `azure_openai_api_version` | Azure OpenAI API version | `2024-10-21` | ❌ |
| `ai_provider` | AI provider (`openai`, `anthropic`, `azure`, `auto`) | `auto` | ❌ |
| `model` | AI model to use | `auto` | ❌ |
| `review_level` | Review intensity (`light`, `standard`, `thorough`) | `standard` | ❌ |
| `comment_style` | Comment style (`inline`, `summary`, `both`) | `both` | ❌ |
| `inline_severity` | Min severity for inline comments (`error`, `warning`, `info`, `all`) | `warning` | ❌ |
| `log_level` | Min severity level for posting comments (`error`, `warning`, `info`, `all`) | `warning` | ❌ |
| `summary_format` | Summary format (`brief`, `detailed`, `minimal`) | `detailed` | ❌ |
| `enable_suggestions` | Enable suggestion code blocks in inline comments | `true` | ❌ |
| `include_patterns` | File patterns to include (comma-separated) | `**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py,**/*.go,**/*.rs,**/*.java,**/*.cs` | ❌ |
| `exclude_patterns` | File patterns to exclude (comma-separated) | `node_modules/**,dist/**,build/**,coverage/**,*.min.js,*.bundle.js` | ❌ |
| `max_files` | Maximum files to review | `50` | ❌ |

| `skip_if_no_rules` | Skip review if no rules found | `false` | ❌ |
| `update_existing_comments` | Update existing bot comments | `true` | ❌ |
| `request_delay` | Delay in milliseconds between AI provider requests to avoid rate limits | `2000` | ❌ |

⚠️ *At least one AI provider API key is required*

### Azure OpenAI Setup

For Azure OpenAI, you'll need:

1. **API Key**: Your Azure OpenAI service API key
2. **Endpoint**: Your Azure OpenAI resource endpoint (e.g., `https://your-resource.openai.azure.com/`)
3. **API Version**: The API version to use:
   - `2024-10-21` (default, stable) - Supports Whisper, DALL-E 3, fine-tuning
   - `2025-04-01-preview` (latest) - Includes o3, o4-mini, GPT-image-1 support
4. **Model Deployment**: Ensure your chosen model is deployed in your Azure OpenAI resource

**Note**: Azure OpenAI uses deployment names that may differ from OpenAI model names. For example, `gpt-3.5-turbo` becomes `gpt-35-turbo` in Azure.

## 🤖 Supported AI Models

### OpenAI Models (2025)

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `gpt-5` | Latest multimodal model with advanced reasoning and 200K context | Complex analysis, multimodal tasks | Premium |
| `gpt-5-mini` | Cost-effective GPT-5 variant with excellent performance | Standard reviews, balanced cost-quality | Standard |
| `gpt-5-nano` | Optimized for speed and low-latency requirements | Quick reviews, real-time analysis | Standard |
| `gpt-5-chat` | Tailored for advanced, natural conversations | Interactive reviews, conversational analysis | Premium |
| `o3` | Advanced reasoning model excelling in coding, math, science | Complex reasoning, scientific code analysis | Premium |
| `o4-mini` | Efficient reasoning model for real-time applications | Quick reasoning, agentic solutions | Standard |
| `gpt-4.1` | Enhanced GPT-4 with 1M token context | Large codebases, creative tasks | Premium |
| `gpt-4.1-mini` | Balanced GPT-4.1 variant | Standard reviews, medium complexity | Standard |
| `gpt-4.1-nano` | Cost-efficient GPT-4.1 | Cost-sensitive reviews, lightweight analysis | Standard |

### Anthropic Models (2025)

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `claude-4-opus` | Most advanced Claude with Level 3 safety classification | Complex reasoning, advanced code analysis | Premium |
| `claude-4-sonnet` | Enhanced Claude 4 with superior coding abilities | Code generation, detailed reviews | Premium |
| `claude-3-5-sonnet` | Previous generation Claude (legacy) | Complex analysis, detailed reviews | Premium |
| `claude-3-opus` | Previous most capable Claude (legacy) | Complex analysis, detailed reviews | Premium |
| `claude-3-sonnet` | Balanced Claude 3 model (legacy) | Detailed reviews, balanced cost-quality | Premium |
| `claude-3-haiku` | Fast and cost-effective Claude 3 (legacy) | Quick reviews, large PRs | Standard |

### Azure OpenAI Models (2025)

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `gpt-5` | Latest multimodal model with advanced reasoning (Azure) | Complex analysis, multimodal tasks | Premium |
| `gpt-5-mini` | Cost-effective GPT-5 variant (Azure) | Standard reviews, balanced cost-quality | Standard |
| `gpt-5-nano` | Optimized for speed and low-latency (Azure) | Quick reviews, real-time analysis | Standard |
| `o3` | Advanced reasoning model (Azure) | Complex reasoning, scientific code analysis | Premium |
| `o4-mini` | Efficient reasoning model (Azure) | Quick reasoning, agentic solutions | Standard |
| `gpt-4.1` | Enhanced GPT-4 with 1M token context (Azure) | Large codebases, creative tasks | Premium |
| `grok-3` | xAI Grok 3 for real-time conversational AI | Conversational analysis, real-time reviews | Premium |
| `grok-3-mini` | Efficient Grok 3 variant | Quick reviews, cost-effective analysis | Standard |
| `deepseek-r1` | Advanced reasoning model approaching o3 performance | Deep reasoning, research applications | Premium |
| `codex-mini` | Lightweight coding assistant | Code generation, programming assistance | Standard |
| `gpt-35-turbo` | Fast and reliable for most code reviews (legacy) | Quick reviews, standard reviews | Standard |

### Smart Model Selection

The action can automatically select the best model based on your `review_level`:

- **Light reviews** → Fast, cost-effective models (`gpt-5-nano`, `claude-3-haiku`, `gpt-5-nano` for Azure)
- **Standard reviews** → Balanced models (`gpt-5-mini`, `claude-4-sonnet`, `gpt-5-mini` for Azure)  
- **Thorough reviews** → Premium models (`gpt-5`, `claude-4-opus`, `o3` for Azure)

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
*Generated by TechSee AI PR Reviewer*
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
*Generated by TechSee AI PR Reviewer v1.0.0*
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
    model: 'gpt-5-nano'
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Use latest Claude model for complex analysis
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'anthropic'
    model: 'claude-4-opus'
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# Use Azure OpenAI for enterprise compliance
- uses: amit.wagner/pr-reviewer@v1
  with:
    ai_provider: 'azure'
    model: 'gpt-5'
    azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    azure_openai_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
    azure_openai_api_version: '2024-10-21'
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
    azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    azure_openai_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
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


## 📞 Support

- 🐛 [Issue Tracker](https://github.com/amit.wagner/pr-reviewer/issues)
- 💬 [Discussions](https://github.com/amit.wagner/pr-reviewer/discussions)

---

<div align="center">

**Made with ❤️ by the Techsee**

[⭐ Star this repo](https://github.com/amit.wagner/pr-reviewer) • [🐛 Report bug](https://github.com/amit.wagner/pr-reviewer/issues) • [✨ Request feature](https://github.com/amit.wagner/pr-reviewer/issues)

</div>
