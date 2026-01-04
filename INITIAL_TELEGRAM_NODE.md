## FEATURE: Telegram Send Node for Flowsh

Add a Telegram send node to flowsh that enables sending text messages to Telegram chats as part of workflow automation. This node will be a fire-and-forget messaging component that integrates seamlessly with flowsh's existing node architecture.

### Core Requirements:

- **Send-only functionality**: Node only sends messages, no receiving capability
- **Text messages only**: Focus on text content initially, no media support
- **Parse mode support**: HTML (default) and Markdown formatting with automatic character escaping
- **Standard flowsh node**: Follows existing node patterns and can be connected in workflows
- **Input**: Message content (from file or text/template with variable substitution)
- **Output**: None (fire-and-forget pattern)

### Configuration:

**Environment Variables (Required):**

- `TELEGRAM_BOT_TOKEN`: Bot authentication token
- `TELEGRAM_CHAT_ID`: Target chat/channel ID

**Node-Specific Configuration:**

- `parse_mode`: "HTML" (default) or "Markdown"
- `max_retries`: Maximum retry attempts (default: 3)

### Technical Implementation:

- Fire-and-forget execution with try-catch error handling
- Automatic retry mechanism up to `max_retries` on failures
- Reliable character escaping based on selected parse mode (HTML: `&`, `<`, `>` / Markdown: special markdown characters)
- Simple success/failure logging without content validation
- Integration with flowsh's existing node framework and patterns

## EXAMPLES:

### Example 1: Workflow Notifications

**Purpose**: Send start/completion notifications for long-running workflows

```yaml
workflow:
  - name: backup_database
    type: database_backup
  - name: notify_start
    type: telegram_send
    message: '🔄 Database backup started'
  - name: notify_complete
    type: telegram_send
    message: '✅ Database backup completed successfully'
```

### Example 2: Agent Response Forwarding

**Purpose**: Forward AI agent responses or important outputs to Telegram

```yaml
workflow:
  - name: analyze_logs
    type: ai_agent
    output_file: analysis.txt
  - name: send_analysis
    type: telegram_send
    input_file: analysis.txt
    parse_mode: 'Markdown'
```

### Example 3: Progress Updates

**Purpose**: Send workflow progress updates with variable substitution

```yaml
workflow:
  - name: process_files
    type: file_processor
  - name: progress_update
    type: telegram_send
    message: '📊 Processed ${processed_count}/${total_count} files'
```

### Example 4: Failure Alerts

**Purpose**: Send alerts when critical nodes fail

```yaml
workflow:
  - name: critical_task
    type: important_operation
    on_error:
      - name: alert_failure
        type: telegram_send
        message: '🚨 ALERT: Critical task failed - ${error_message}'
        parse_mode: 'HTML'
```

## DOCUMENTATION:

### Telegram Bot API Documentation

- **URL**: https://core.telegram.org/bots/api#sendmessage
- **Description**: Official sendMessage API documentation covering all parameters, response formats, and error codes

### Telegram Bot API Error Handling

- **URL**: https://core.telegram.org/bots/api#making-requests
- **Description**: Official documentation on API request patterns, error responses, and retry strategies

### HTML Parse Mode Reference

- **URL**: https://core.telegram.org/bots/api#html-style
- **Description**: Supported HTML tags and character escaping requirements for HTML parse mode

### Markdown Parse Mode Reference

- **URL**: https://core.telegram.org/bots/api#markdownv2-style
- **Description**: MarkdownV2 formatting syntax and character escaping rules

### Flowsh Node Development Guide

- **Description**: Internal flowsh documentation for creating new node types (assume exists in flowsh codebase)
- **Topics**: Node interface, configuration patterns, error handling, testing framework integration

## OTHER CONSIDERATIONS:

### Security & Configuration:

- Environment variables must be validated at node initialization
- Bot token should never be logged or exposed in error messages
- Chat ID validation should prevent accidental message broadcasting
- Consider supporting chat ID resolution from username/channel name

### Error Handling & Reliability:

- Implement exponential backoff for retries to avoid API rate limiting
- Handle specific Telegram API errors (rate limits, blocked bots, invalid chat IDs)
- Log retry attempts with timestamps for debugging
- Graceful degradation when Telegram service is unavailable

### Character Escaping Implementation:

- HTML mode: Escape `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`
- Markdown mode: Escape special characters: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`
- Ensure escaping function is thoroughly tested with edge cases

### Integration Points:

- Follow flowsh's existing node registration and discovery patterns
- Implement standard flowsh node interface (execute, validate, cleanup methods)
- Support flowsh's variable substitution mechanism for dynamic message content
- Integrate with flowsh's logging and monitoring infrastructure

### Testing Requirements:

- Unit tests for message escaping functions (both HTML and Markdown modes)
- Integration test that sends actual test message via Telegram API
- Mock tests for API failure scenarios and retry logic
- Test variable substitution in message templates
- Validate environment variable handling and error cases

### Success Criteria:

- **Functional**: Test message successfully sent via Telegram API (HTTP 200 response)
- **Integration**: Node appears in flowsh node registry and can be used in workflows
- **Reliability**: Retry mechanism works correctly for transient failures
- **Standards**: Follows flowsh coding standards and testing patterns
- **Documentation**: Node usage documented in flowsh examples and test suite
