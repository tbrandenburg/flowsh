# PRP: OpenCode Poem to Telegram Template

## FEATURE:

Create a new flowsh template called "opencode-poem-telegram" that combines OpenCode agent orchestration, creative poem generation, and Telegram delivery into a single production-ready workflow.

### Requirements:

1. **Agent Node Integration**: Use agent node with "opencode" command to generate creative poems
2. **Telegram Delivery**: Send generated poems via Telegram using preset environment variables (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
3. **Template Structure**: Follow existing flowsh template patterns with proper validation, error handling, and fallback content
4. **Poem Customization**: Support different poem types/themes through template variables
5. **Production Ready**: Include environment validation, error handling, and proper documentation

### Template Structure:

- **Enhanced Template Category**: Place in `templates/enhanced/` for simple, ready-to-use functionality
- **File Name**: `opencode-poem-telegram-template.yaml`
- **Supporting Documentation**: Include README with setup instructions and example usage

### Core Workflow Flow:

1. **Start** → Environment Validation → **Agent Poem Generation** → **Telegram Delivery** → **End**
2. Environment validation checks for TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
3. Agent node uses opencode with creative prompt for poem generation
4. Telegram node sends the generated poem with proper formatting
5. Fallback poem content if agent/opencode fails

## EXAMPLES:

### Similar Templates to Reference:

1. **`ai-to-telegram-simple.yaml`** - For Telegram integration patterns and environment validation
2. **`simple-workflow.yaml`** - For opencode agent node usage pattern
3. **`multi-stage-ai-workflows-template.yaml`** - For creative content generation structure

### Expected Output Example:

```bash
# After template creation
flowsh init opencode-poem-telegram my-poem-bot.yaml
flowsh validate my-poem-bot.yaml
flowsh compile my-poem-bot.yaml > poem-bot.sh
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_CHAT_ID="your_chat_id"
bash poem-bot.sh
```

### Generated Poem Format:

```
🎭 **Poem of the Day** 🎭

[Generated poem content from OpenCode]

---
✨ Created with OpenCode poetry magic
🤖 Delivered by flowsh automation
```

## DOCUMENTATION:

### Key Documentation References:

1. **flowsh Templates**: `/templates/enhanced/` - Pattern for simple template structure
2. **Agent Node Spec**: `/examples/nodes/agent-node-example.yaml` - OpenCode integration patterns
3. **Telegram Node Spec**: `/examples/nodes/telegram-node-example.yaml` - Telegram delivery patterns
4. **Template System**: `/src/templates/` - Template registration and discovery system
5. **AGENTS.md**: Template system guidelines (section 11) and usage patterns

### Pattern References:

- **Environment Variable Usage**: Follow `ai-to-telegram-simple.yaml` validation patterns
- **Agent Node Configuration**: Follow `simple-workflow.yaml` opencode usage
- **Telegram Node Setup**: Use preset environment variables, no recipient selection
- **Error Handling**: Include fallback content like existing AI templates

## OTHER CONSIDERATIONS:

### Technical Requirements:

1. **OpenCode Integration**: Must work with installed OpenCode agent system
2. **Environment Variables**: Trust preset TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (no selection UI)
3. **Template Variables**: Support poem theme/type customization (haiku, sonnet, limerick, free verse)
4. **Validation**: Include comprehensive environment and dependency validation
5. **Testing**: Must validate that workflow runs and Telegram message sends successfully

### Security & Safety:

1. **Token Validation**: Validate TELEGRAM_BOT_TOKEN format before use
2. **Error Handling**: Graceful degradation with fallback poem content if OpenCode fails
3. **Input Sanitization**: Ensure poem content is safe for Telegram delivery
4. **Timeout Handling**: Set appropriate timeouts for agent operations

### Template Integration:

1. **Discovery**: Register in template discovery system for `flowsh init` listing
2. **Preview Support**: Include metadata for `flowsh init --preview` functionality
3. **Validation**: Ensure template validates with `flowsh validate`
4. **Compilation**: Generate clean, executable shell script under 100 lines

### Success Criteria:

1. ✅ Template validates successfully with `flowsh validate`
2. ✅ Template compiles to clean shell script with `flowsh compile`
3. ✅ Generated script executes without errors (with proper env vars)
4. ✅ OpenCode generates creative poem content
5. ✅ Telegram message is delivered successfully
6. ✅ Template appears in `flowsh init` listing
7. ✅ Template preview works with `flowsh init --preview`
8. ✅ Error handling works (fallback poem if OpenCode fails)
9. ✅ Environment validation prevents execution without required tokens

### Gotchas to Avoid:

1. **OpenCode Path Issues**: Ensure opencode command is accessible in generated script PATH
2. **Agent Prompt Design**: Create effective prompts that reliably generate poems
3. **Telegram Rate Limits**: Handle potential Telegram API rate limiting
4. **Environment Variable Escaping**: Proper shell script variable handling
5. **Timeout Configuration**: Set realistic timeouts for creative generation
6. **Template Variable Conflicts**: Avoid conflicts with flowsh template syntax (`{{variable}}`)

### Files to Create:

1. **Primary Template**: `templates/enhanced/opencode-poem-telegram-template.yaml`
2. **Documentation**: `templates/enhanced/opencode-poem-telegram-README.md`
3. **Test Script**: Validation script to verify template functionality
4. **Integration Test**: Add to Makefile `templates-all` target for comprehensive testing

This template should demonstrate the power of combining OpenCode agent orchestration with flowsh workflow automation for creative content delivery, while maintaining the simplicity and reliability expected from flowsh's "jq of workflows" philosophy.
