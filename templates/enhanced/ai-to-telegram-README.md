# AI Content to Telegram - Enhanced Template

## Template Metadata

- **Name**: AI Content to Messaging
- **Category**: ai-messaging
- **Success Rate**: 94%
- **Deployment Time**: 3 minutes
- **Complexity**: Beginner

## Intent Keywords

- "generate content"
- "send message"
- "ai text"
- "telegram bot"
- "riddle"
- "content automation"

## Production Requirements

### Environment Variables (Required)

```bash
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxyz"  # From @BotFather
export TELEGRAM_CHAT_ID="123456789"                              # Your chat ID
export OPENAI_API_KEY="sk-..."                                   # Optional, has fallback
```

### Getting Credentials

1. **Telegram Bot Token**: Message @BotFather on Telegram, create new bot
2. **Chat ID**: Message @userinfobot on Telegram to get your chat ID
3. **OpenAI Key**: Optional - get from https://platform.openai.com/api-keys

## Customization Points

- `content_type`: riddle, joke, summary, news update, daily tip
- `content_topic`: space exploration, programming, history, science
- `message_format`: HTML (recommended) or Markdown

## Quick Start

1. Set environment variables above
2. Compile: `flowsh compile ai-to-telegram-template.yaml > ai-telegram.sh`
3. Execute: `chmod +x ai-telegram.sh && ./ai-telegram.sh`

## Features

- ✅ Two-tier AI fallback (OpenAI → LLM v7 → Demo)
- ✅ Environment validation before execution
- ✅ Telegram delivery with retry logic
- ✅ HTML formatted messages
- ✅ Production error handling
- ✅ Execution verification
