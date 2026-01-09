# OpenCode Poem to Telegram Template

A production-ready flowsh template that combines OpenCode agent orchestration, creative poem generation, and Telegram delivery into a unified automation workflow.

## Features

🎭 **Creative Poetry Generation**: Uses OpenCode agent to generate original poems in various styles
📱 **Telegram Integration**: Delivers poems with beautiful HTML formatting  
🔧 **Production Ready**: Comprehensive error handling and environment validation
🎨 **Customizable**: Support for multiple poem types and themes
⚡ **Intelligent Fallback**: Provides backup content if AI generation fails
🚀 **Automated**: Complete hands-off operation once configured

## Quick Start

### 1. Prerequisites

- **OpenCode**: Install OpenCode agent system for AI-powered poem generation
- **Telegram Bot**: Create a bot via @BotFather and get your bot token
- **Chat ID**: Get your Telegram chat ID using @userinfobot

### 2. Environment Setup

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
export TELEGRAM_CHAT_ID="your_chat_id_from_userinfobot"
```

### 3. Create and Run Workflow

```bash
# Create workflow from template
flowsh init opencode-poem-telegram my-poem-bot.yaml

# Validate the workflow
flowsh validate my-poem-bot.yaml

# Compile to shell script
flowsh compile my-poem-bot.yaml > poem-bot.sh

# Execute the workflow
bash poem-bot.sh
```

## Configuration Options

### Poem Types Supported

- **haiku**: Traditional 5-7-5 syllable Japanese poetry
- **sonnet**: 14-line poems with structured rhyme schemes
- **limerick**: Humorous 5-line AABBA rhyming poems
- **free-verse**: Unstructured creative expression
- **acrostic**: Poems spelling out words with first letters
- **ballad**: Narrative story poems with rhythm

### Template Variables

- `poem_type`: Select from supported poem types (default: "haiku")
- `poem_theme`: Custom theme/topic for the poem (default: "nature and technology harmony")

### Environment Variables

- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather (required)
- `TELEGRAM_CHAT_ID`: Target chat ID for message delivery (required)

## Example Usage

### Basic Usage

```bash
flowsh init opencode-poem-telegram daily-haiku.yaml
export TELEGRAM_BOT_TOKEN="1234567890:AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQr"
export TELEGRAM_CHAT_ID="123456789"
flowsh compile daily-haiku.yaml > daily-haiku.sh
bash daily-haiku.sh
```

### Custom Poem Generation

When creating the workflow, you can customize:

- Poem type (haiku, sonnet, limerick, free-verse, acrostic, ballad)
- Theme/topic for the poem content

### Expected Output

The generated Telegram message will look like:

```
🎭 Poem of the Day 🎭

Type: haiku
Theme: nature and technology harmony

Silicon dreams flow,
Through circuits of morning light—
Code meets butterfly.

---
✨ Created with OpenCode poetry magic
🤖 Delivered by flowsh automation

Generated on 2026-01-09 at 14:30
```

## Technical Details

### Workflow Architecture

1. **Environment Validation**: Checks for required tokens and OpenCode availability
2. **Agent Generation**: Uses OpenCode to create custom poems based on parameters
3. **Fallback System**: Provides backup poems if AI generation fails
4. **Message Formatting**: Creates beautiful HTML-formatted Telegram messages
5. **Telegram Delivery**: Sends with retry logic and error handling
6. **Completion Report**: Provides detailed status and results

### Error Handling

- **Missing Environment Variables**: Clear error messages with setup instructions
- **OpenCode Unavailable**: Graceful degradation to fallback content
- **Telegram Failures**: Automatic retry with exponential backoff
- **Generation Timeouts**: 45-second timeout with fallback activation

### Security Features

- **Token Validation**: Checks Telegram token format before use
- **Input Sanitization**: Safe handling of user-provided themes
- **Environment Isolation**: Secure execution environment
- **Error Recovery**: Graceful failure handling without exposing secrets

## Use Cases

### Personal Automation

- Daily poetry delivery to personal chats
- Creative writing inspiration on schedule
- Personalized poem generation for special occasions

### Content Creation

- Social media content automation
- Newsletter poetry sections
- Creative writing workshops

### Educational

- Poetry learning and exploration
- Literature class demonstrations
- Creative writing exercises

### Integration Examples

- **Cron Scheduling**: Run daily/weekly for regular poetry delivery
- **Webhook Triggers**: Generate poems based on external events
- **Multi-Platform**: Extend to Discord, Slack, or other messaging platforms

## Troubleshooting

### Common Issues

**"opencode command not found"**

- Install OpenCode agent system
- Ensure OpenCode is in your PATH
- Workflow will use fallback content if OpenCode is unavailable

**"TELEGRAM_BOT_TOKEN not set"**

- Get bot token from @BotFather on Telegram
- Export as environment variable before running

**"TELEGRAM_CHAT_ID not set"**

- Get your chat ID from @userinfobot on Telegram
- Export as environment variable before running

**Poems not generating properly**

- Check OpenCode installation and configuration
- Verify internet connectivity for AI services
- Review poem theme for clarity and specificity

### Validation Commands

```bash
# Validate template syntax
flowsh validate opencode-poem-telegram-template.yaml

# Test compilation
flowsh compile opencode-poem-telegram-template.yaml > test.sh

# Check generated script
bash -n test.sh  # Syntax check without execution
```

## Advanced Configuration

### Custom Poem Prompts

Modify the agent node's prompt template to adjust poem generation style, tone, or structure.

### Message Formatting

Customize the Telegram message format by editing the `format_telegram_message` node.

### Retry Logic

Adjust retry counts and timeouts in the Telegram node for different network conditions.

### Fallback Content

Customize fallback poems in the `prepare_fallback` node for your specific use case.

## Integration with Other Templates

This template can be combined with other flowsh templates:

- **Scheduled Execution**: Use with cron-based automation templates
- **Multi-Platform Delivery**: Combine with Discord/Slack notification templates
- **Data Integration**: Incorporate with data processing pipelines for dynamic themes

## Contributing

This template demonstrates the power of combining:

- OpenCode agent orchestration for AI-powered content generation
- flowsh workflow automation for reliable pipeline execution
- Telegram API integration for real-world message delivery

The template follows flowsh best practices:

- ✅ Environment validation with helpful error messages
- ✅ Intelligent fallback systems for reliability
- ✅ Production-ready error handling and retry logic
- ✅ Clean, readable generated shell scripts
- ✅ Comprehensive documentation and examples

Perfect for demonstrating creative AI automation with practical delivery mechanisms!
