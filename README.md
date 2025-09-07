# <img src="https://raw.githubusercontent.com/amitwa1/pr-reviewer/main/assets/techsee-logo.png" width="32" height="32" alt="TechSee"> TechSee AI PR Reviewer

An AI-powered GitHub Action that automatically reviews pull requests according to your project's Cursor AI rules. This bot respects all Cursor rule formats including the new `.cursor/rules/*.mdc` format, `AGENTS.md`, and legacy `.cursorrules`.

## ✨ Features

- 🎯 **Respects Cursor Rules** - Supports all Cursor rule formats (`.cursor/rules/*.mdc`, `AGENTS.md`, `.cursorrules`)
- 🔍 **Smart Code Analysis** - AI-powered review using OpenAI, Anthropic, Azure, or AWS Bedrock
- 📋 **PR-Level Planning** - Creates comprehensive review plans understanding overall PR context
- 📦 **Intelligent Batching** - Processes files in batches with full PR context for better analysis
- 💬 **Dual Comment System** - Both inline file comments and PR summary comments
- ⚙️ **Highly Configurable** - Customize review behavior, severity levels, and comment styles
- 🚀 **Zero Infrastructure** - Runs entirely on GitHub Actions, no servers needed
- 🛡️ **Secure** - Code never leaves GitHub's infrastructure
- 📊 **Comprehensive Reporting** - Detailed review statistics and rule application tracking
- ⏱️ **Smart Rate Limiting** - Configurable delays for both AI providers and GitHub API calls
- 🔄 **Robust Fallback** - Falls back to single-file review if batch processing fails
- 🏗️ **Architectural Review** - Detects code duplication, logical problems, and misplaced code across files
- 🎯 **Deterministic Mode** - Consistent results with stable parsing and zero temperature

## 🚀 Quick Start

### New 2-Step Review Process

The action now uses an intelligent 2-step approach for better PR understanding and faster processing:

**Step 1: PR Planning**
- 📋 **Analyzes all changes** to understand the overall PR intent and scope
- 🎯 **Identifies key changes**, risk areas, and review focus points
- 📝 **Creates a comprehensive plan** that guides the detailed review

**Step 2: Batch Review with Context**
- 📦 **Processes files in batches** (configurable: default 1 file, up to 200 files) with full PR context for comprehensive analysis
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
        uses: amitwa1/pr-reviewer@v1
        with:
          gh_token: ${{ secrets.GH_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          review_level: 'standard'
          comment_style: 'both'
          batch_size: '50'         # Process up to 50 files per batch (default: 1 file per batch)
          request_delay: '2000'    # 2 seconds between AI requests
          github_rate_limit: '1000' # 1 second between GitHub API calls
```

### Manual Trigger (Optional)

You can also create a workflow for manual PR reviews:

```yaml
name: Manual PR Review
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to review'
        required: true
        type: string

jobs:
  manual-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: AI Code Review (Manual)
        uses: amitwa1/pr-reviewer@v1
        with:
          pr_number: ${{ github.event.inputs.pr_number }}
          gh_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          review_level: 'standard'
```

### 2. Set Up API Keys

Add your AI provider API key to GitHub Secrets:
- `OPENAI_API_KEY` for OpenAI (recommended)
- `ANTHROPIC_API_KEY` for Anthropic Claude
- `AZURE_OPENAI_API_KEY` for Azure OpenAI
- Configure AWS credentials for Bedrock (see [AWS Bedrock Setup](#aws-bedrock-setup))

### 3. Configure Cursor Rules

The bot automatically detects and applies Cursor rules from:
- `.cursor/rules/*.mdc` files (new format)
- `AGENTS.md` file in project root
- `.cursorrules` file (legacy format)

## 📋 Configuration Options

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `pr_number` | PR number to review (for manual workflow_dispatch) | - | ❌ |
| `gh_token` | GitHub token for API access | `${{ github.token }}` | ✅ |
| `openai_api_key` | OpenAI API key | - | ⚠️ |
| `anthropic_api_key` | Anthropic API key | - | ⚠️ |
| `azure_openai_api_key` | Azure OpenAI API key | - | ⚠️ |
| `azure_openai_endpoint` | Azure OpenAI endpoint URL | - | ⚠️ |
| `azure_openai_api_version` | Azure OpenAI API version | `2024-10-21` | ❌ |
| `azure_openai_real_model` | Real model name for custom Azure deployments | - | ❌ |
| `bedrock_region` | AWS Bedrock region (e.g., us-east-1, us-west-2) | - | ❌ |
| `bedrock_api_key` | AWS Bedrock API Key (July 2025 feature, recommended) | - | ❌ |
| `bedrock_access_key_id` | AWS Access Key ID for Bedrock (legacy) | - | ❌ |
| `bedrock_secret_access_key` | AWS Secret Access Key for Bedrock (legacy) | - | ❌ |
| `ai_provider` | AI provider (`openai`, `anthropic`, `azure`, `bedrock`, `auto`) | `auto` | ❌ |
| `model` | AI model to use | `auto` | ❌ |
| `review_level` | Review intensity (`light`, `standard`, `thorough`) | `standard` | ❌ |
| `comment_style` | Comment style (`inline`, `summary`, `both`) | `both` | ❌ |
| `inline_severity` | Min severity for inline comments (`error`, `warning`, `info`, `all`) | `error` | ❌ |
| `log_level` | Min severity level for posting comments (`error`, `warning`, `info`, `all`) | `error` | ❌ |
| `summary_format` | Summary format (`brief`, `detailed`, `minimal`) | `detailed` | ❌ |
| `enable_suggestions` | Enable suggestion code blocks in inline comments | `true` | ❌ |
| `include_patterns` | File patterns to include (comma-separated) | `**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py,**/*.go,**/*.rs,**/*.java,**/*.cs,**/*.md,**/*.mdc` | ❌ |
| `exclude_patterns` | File patterns to exclude (comma-separated) | `node_modules/**,dist/**,build/**,coverage/**,*.min.js,*.bundle.js` | ❌ |
| `max_files` | Maximum files to review | `50` | ❌ |

| `skip_if_no_rules` | Skip review if no rules found | `false` | ❌ |
| `update_existing_comments` | Update existing bot comments | `true` | ❌ |
| `request_delay` | Delay in milliseconds between AI provider requests to avoid rate limits | `2000` | ❌ |
| `batch_size` | Number of files to process in each batch | `1` | ❌ |
| `github_rate_limit` | Delay in milliseconds between GitHub API calls | `1000` | ❌ |
| `deterministic_mode` | Force deterministic behavior for consistent results | `true` | ❌ |
| `enable_architectural_review` | Enable architectural review for code duplication and logical problems | `true` | ❌ |

⚠️ *At least one AI provider API key is required*

### Azure OpenAI Setup

For Azure OpenAI, you'll need:

1. **API Key**: Your Azure OpenAI service API key
2. **Endpoint**: Your Azure OpenAI resource endpoint (e.g., `https://your-resource.openai.azure.com/`)
3. **API Version**: The API version to use:
   - `2024-10-21` (default, stable) - Supports Whisper, DALL-E 3, fine-tuning
   - `2025-04-01-preview` (latest) - Includes o3, o4-mini, GPT-image-1 support
4. **Model Deployment**: Ensure your chosen model is deployed in your Azure OpenAI resource

#### Custom Deployment Names

Azure OpenAI allows custom deployment names that may differ from the actual model names. When using custom deployment names, you should specify the real model name for proper parameter detection:

```yaml
azure_openai_real_model: 'o1-preview'  # Real model name
model: 'my-reasoning-model-prod'        # Custom deployment name
```

**Why this is needed**: Different Azure OpenAI models require different API parameters:
- **Standard models** (gpt-4, gpt-35-turbo): Use `max_tokens` parameter
- **Reasoning models** (o1, o3, o4-mini): Use `max_completion_tokens` parameter

**Note**: If you use standard deployment names that match the model (e.g., `gpt-4o`, `o1-preview`), the `azure_openai_real_model` parameter is not needed.

### AWS Bedrock Setup

For AWS Bedrock, you'll need:

1. **AWS Region**: The AWS region where Bedrock is available (e.g., `us-east-1`, `us-west-2`)
2. **AWS Credentials**: Either:
   - **Access Key & Secret**: Provide `bedrock_access_key_id` and `bedrock_secret_access_key`
   - **IAM Role**: Use IAM roles for GitHub Actions (recommended for security)
   - **Environment Variables**: AWS credentials from the environment

#### IAM Role Setup (Recommended)

```yaml
# Use IAM roles for GitHub Actions
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsBedrock
    aws-region: us-east-1

- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'bedrock'
    bedrock_region: 'us-east-1'
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
```

#### API Key Setup (Recommended - New in July 2025)

```yaml
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'bedrock'
    bedrock_region: 'us-east-1'
    bedrock_api_key: ${{ secrets.BEDROCK_API_KEY }}
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
```

#### Access Key Setup (Legacy)

```yaml
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'bedrock'
    bedrock_region: 'us-east-1'
    bedrock_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    bedrock_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
```

**Available Models**: See the [AWS Bedrock Models](#aws-bedrock-models-2025) section for supported models.

#### Troubleshooting AWS Bedrock Authentication

If you encounter authentication errors with AWS Bedrock, follow these steps:

**Common Error**: `UnrecognizedClientException: The security token included in the request is invalid`

**Possible Causes & Solutions**:

1. **Invalid or Expired Credentials**
   - Verify your AWS Access Key ID and Secret Access Key are correct
   - Check if credentials have expired (temporary credentials expire after a set time)
   - Regenerate credentials if needed

2. **Missing Credentials**
   - **NEW (July 2025)**: Use `bedrock_api_key` for simplified authentication
   - **Legacy**: Ensure `bedrock_access_key_id` and `bedrock_secret_access_key` are set in GitHub Secrets
   - Or configure IAM roles for GitHub Actions (recommended)

3. **Incorrect Region**
   - Verify the `bedrock_region` matches where Bedrock is available
   - Common regions: `us-east-1`, `us-west-2`, `eu-west-1`
   - Check [AWS Bedrock availability](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html)

4. **IAM Permissions**
   - Ensure your IAM user/role has these permissions:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "bedrock:InvokeModel",
             "bedrock:ListFoundationModels"
           ],
           "Resource": "*"
         }
       ]
     }
     ```

5. **Model Access**
   - Enable model access in AWS Bedrock console
   - Go to AWS Console → Bedrock → Model access
   - Request access for the models you want to use

**Debug Steps**:
1. Test AWS credentials locally: `aws sts get-caller-identity`
2. Verify region availability: Check AWS Bedrock console in your region
3. Check GitHub Actions logs for detailed error messages
4. Ensure secrets are properly configured in repository settings

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

### AWS Bedrock Models (2025)

| Model | Description | Best For | Cost |
|-------|-------------|----------|------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Latest Claude 3.5 Sonnet with enhanced reasoning | Complex analysis, detailed reviews | Premium |
| `anthropic.claude-3-opus-20240229-v1:0` | Most capable Claude model for thorough analysis | Complex reasoning, architectural review | Premium |
| `anthropic.claude-3-sonnet-20240229-v1:0` | Balanced Claude model for comprehensive reviews | Standard reviews, balanced cost-quality | Premium |
| `anthropic.claude-3-haiku-20240307-v1:0` | Fast and cost-effective Claude model | Quick reviews, large PRs | Standard |
| `meta.llama3-2-90b-instruct-v1:0` | Large Llama model with strong reasoning | Complex analysis, code generation | Premium |
| `meta.llama3-2-11b-instruct-v1:0` | Medium Llama model for balanced performance | Standard reviews, efficient processing | Standard |
| `amazon.titan-text-premier-v1:0` | Amazon's premier text model | Documentation review, content analysis | Premium |
| `ai21.jamba-1-5-large-v1:0` | AI21's large instruction-following model | Complex reasoning, long context analysis | Premium |
| `cohere.command-r-plus-v1:0` | Cohere's enhanced reasoning model | Analytical tasks, detailed code review | Premium |
| `mistral.mistral-large-2407-v1:0` | Mistral's large model for complex tasks | Advanced analysis, multi-language support | Premium |

### Smart Model Selection

The action can automatically select the best model based on your `review_level`:

- **Light reviews** → Fast, cost-effective models (`gpt-5-nano`, `claude-3-haiku`, `gpt-5-nano` for Azure, `anthropic.claude-3-haiku-20240307-v1:0` for Bedrock)
- **Standard reviews** → Balanced models (`gpt-5-mini`, `claude-4-sonnet`, `gpt-5-mini` for Azure, `anthropic.claude-3-5-sonnet-20241022-v2:0` for Bedrock)  
- **Thorough reviews** → Premium models (`gpt-5`, `claude-4-opus`, `o3` for Azure, `anthropic.claude-3-opus-20240229-v1:0` for Bedrock)

```yaml
# Automatic model selection
- uses: amitwa1/pr-reviewer@v1
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
## <img src="https://raw.githubusercontent.com/amitwa1/pr-reviewer/main/assets/techsee-logo.png" width="24" height="24" alt="TechSee"> TechSee AI PR Review Summary

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
- uses: amitwa1/pr-reviewer@v1
  with:
    review_level: 'light'
    inline_severity: 'error'

# Thorough review - comprehensive analysis
- uses: amitwa1/pr-reviewer@v1
  with:
    review_level: 'thorough'
    inline_severity: 'info'
    summary_format: 'detailed'
```

### File Pattern Filtering

```yaml
# Review only TypeScript files
- uses: amitwa1/pr-reviewer@v1
  with:
    include_patterns: '**/*.ts,**/*.tsx'
    exclude_patterns: '**/*.test.ts,**/*.spec.ts'
```

### Specific AI Models

```yaml
# Use latest GPT-4 model for premium quality
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'openai'
    model: 'gpt-4o'
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Use cost-effective model for large PRs
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'openai'
    model: 'gpt-5-nano'
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Use latest Claude model for complex analysis
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'anthropic'
    model: 'claude-4-opus'
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# Use Azure OpenAI for enterprise compliance
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'azure'
    model: 'gpt-5'
    azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    azure_openai_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
    azure_openai_api_version: '2024-10-21'

# Azure OpenAI with custom deployment names
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'azure'
    model: 'my-reasoning-model-prod'      # Custom deployment name
    azure_openai_real_model: 'o1-preview' # Actual model for proper parameter detection
    azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    azure_openai_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}

# Use AWS Bedrock for enterprise compliance
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'bedrock'
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    bedrock_region: 'us-east-1'
    bedrock_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    bedrock_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

# Use Bedrock with IAM roles (recommended)
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsBedrock
    aws-region: us-east-1

- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'bedrock'
    model: 'meta.llama3-2-90b-instruct-v1:0'
    bedrock_region: 'us-east-1'
```

### Smart Model Selection

```yaml
# Auto-select best model based on review level
- uses: amitwa1/pr-reviewer@v1
  with:
    ai_provider: 'auto'           # Choose provider automatically
    model: 'auto'                 # Choose model based on review_level
    review_level: 'thorough'      # Will select premium models
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
    azure_openai_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
    bedrock_region: 'us-east-1'
    bedrock_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    bedrock_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Multiple AI Providers

```yaml
# Prefer Anthropic, fallback to OpenAI
- uses: amitwa1/pr-reviewer@v1
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
git clone https://github.com/amitwa1/pr-reviewer.git
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
- Ensure you've set at least one AI provider configuration:
  - `OPENAI_API_KEY` for OpenAI
  - `ANTHROPIC_API_KEY` for Anthropic
  - `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` for Azure
  - `bedrock_region` (and optionally AWS credentials) for Bedrock

**"This action can only be run on pull request events"**
- Make sure your workflow triggers on `pull_request` events

**"Working directory is not clean"**
- Ensure the repository is checked out in your workflow before running the action

**Rate limit issues**
- The action automatically handles GitHub API rate limits
- For AI provider rate limits, consider using `review_level: 'light'`
- Adjust `request_delay` to increase delays between AI requests (default: 2000ms)
- Adjust `github_rate_limit` to increase delays between GitHub API calls (default: 1000ms)
- The action processes files in batches (default: 1 file per batch) for better context and efficiency

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

- 🐛 [Issue Tracker](https://github.com/amitwa1/pr-reviewer/issues)
- 💬 [Discussions](https://github.com/amitwa1/pr-reviewer/discussions)

---

<div align="center">

**Made with ❤️ by the Techsee**

[⭐ Star this repo](https://github.com/amitwa1/pr-reviewer) • [🐛 Report bug](https://github.com/amitwa1/pr-reviewer/issues) • [✨ Request feature](https://github.com/amitwa1/pr-reviewer/issues)

</div>

