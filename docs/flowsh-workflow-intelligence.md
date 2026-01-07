---
name: flowsh-workflow-intelligence
description: >
  Intelligent guidance for creating YAML workflows that compile to clean shell scripts using flowsh. 
  Provides progressive templates, variable flow patterns, and anti-pattern prevention.
  Use when: "create workflow", "automate task", "YAML to shell", "flowsh", or working with workflow automation.
---

# flowsh Workflow Intelligence

Transform workflow ideas into production-ready YAML that compiles to clean, secure shell scripts using flowsh - "The jq of Workflows".

## Philosophy: Progressive Workflow Composition

**Before creating any workflow, understand the variable flow**:

- What data flows between nodes?
- Which variables are created by each node type?
- How do nodes reference previous outputs?
- What fallback patterns ensure reliability?

**Core principles**:

1. **Variable Flow First**: Design the data pipeline before the nodes
2. **Security by Default**: Every input sanitized, every script hardened
3. **Unix Philosophy**: Simple, composable, pipe-friendly workflows
4. **Reliable Execution**: Fallbacks, retries, and graceful failures
5. **Template Intelligence**: Learn from proven patterns, adapt to context

## Workflow Creation Framework

### 1. Intent Recognition & Template Selection

**Identify the workflow pattern**:

- **Content Generation + Messaging**: LLM → format → send (Telegram/HTTP)
- **Data Processing Pipeline**: HTTP → transform → aggregate → output
- **Conditional Logic Flow**: input → decision → branch → merge
- **Reliability Pattern**: retry → fallback → circuit-breaker
- **Parallel Processing**: split → parallel-iteration → aggregate

**Template Categories**:

- **AI Integration**: OpenAI/Anthropic APIs with token management
- **Messaging**: Telegram, Discord, Slack, email delivery
- **Data Transform**: JSON/XML processing, template rendering
- **Control Flow**: if-else, loops, parallel execution
- **Reliability**: retry logic, fallbacks, error handling

### 2. Variable Flow Architecture

**Standard Variable Patterns** (CRITICAL - follow exactly):

```yaml
# LLM nodes create standard variables
llm_node:
  outputs: [llm_content, llm_success, llm_error]

# HTTP nodes create response variables
http_request:
  outputs: [http_response_body, http_response_status, http_success]

# Variable assignment creates custom variables
variable_assignment:
  outputs: [variable_name] # exactly as specified in variable_name field

# Template transform uses input variables, creates output
template_transform:
  inputs: [any_variable] # reference with {{variable_name}}
  outputs: [template_output]
```

**Variable Reference Rules**:

- Reference variables with `{{variable_name}}` syntax
- Variables must exist from previous nodes in execution order
- Node names ≠ variable names (common mistake)
- Use descriptive variable names: `user_message`, `formatted_response`, `api_key`

### 3. Node Type Intelligence

**AI/LLM Integration**:

```yaml
llm:
  model: 'gpt-4' # or "claude-3-5-sonnet-20241022"
  prompt: 'Generate a {{request_type}} about {{topic}}'
  api_key_env: 'OPENAI_API_KEY' # environment variable name
  fallback_api: 'llm_v7' # no-key-required fallback
  # Creates: llm_content, llm_success, llm_error
```

**Messaging (Telegram)**:

```yaml
telegram:
  bot_token_env: 'TELEGRAM_BOT_TOKEN'
  chat_id_env: 'TELEGRAM_CHAT_ID'
  message: '{{llm_content}}' # reference LLM output
  format: 'HTML' # or "Markdown" - HTML more reliable
  # Creates: telegram_success, telegram_error
```

**Variable Management**:

```yaml
variable_assignment:
  variable_name: 'processed_data'
  variable_value: '{{raw_data}} processed at {{timestamp}}'
  # Creates: processed_data (not variable_assignment_output)
```

**Control Flow (If-Else)**:

```yaml
if_else:
  condition: '{{llm_success}} == true'
  if_branch: [success_node]
  else_branch: [fallback_node]
```

### 4. Execution Flow Patterns

**Sequential Processing** (most common):

```yaml
nodes:
  - id: gather_input
  - id: process_data # can reference gather_input outputs
  - id: send_result # can reference both previous outputs
```

**Parallel Processing** (for independent operations):

```yaml
parallel_iteration:
  items: ['{{item1}}', '{{item2}}', '{{item3}}']
  sub_workflow: [process_item]
```

**Reliable Execution** (with fallbacks):

```yaml
retry:
  attempts: 3
  delay: '5s'
  sub_workflow: [api_call]

fallback:
  primary: [external_api]
  fallback: [local_processing]
```

## Anti-Patterns to Avoid

❌ **Variable Reference Errors**:

```yaml
# WRONG - referencing non-existent variable
telegram:
  message: "{{my_llm_response}}" # if LLM node creates llm_content

# RIGHT - reference actual variable
telegram:
  message: "{{llm_content}}" # matches LLM node output
```

❌ **Node ID Confusion**:

```yaml
# WRONG - assuming node ID creates variable
nodes:
  - id: generate_riddle # this ID doesn't create generate_riddle variable
    type: llm

# RIGHT - understand actual variable creation
nodes:
  - id: generate_riddle
    type: llm # creates llm_content, llm_success, llm_error
```

❌ **Execution Order Violations**:

```yaml
# WRONG - referencing future variable
nodes:
  - id: send_message
    type: telegram
    message: '{{processed_content}}' # doesn't exist yet
  - id: process_content
    type: variable_assignment
    variable_name: processed_content
```

❌ **Missing Environment Variables**:

```yaml
# WRONG - no environment variable specified
llm:
  model: "gpt-4"
  api_key: "sk-..." # hardcoded secret

# RIGHT - environment variable reference
llm:
  model: "gpt-4"
  api_key_env: "OPENAI_API_KEY" # references environment
```

❌ **Function Naming Mistakes**:

```yaml
# WRONG - old pattern for Telegram
telegram:
  # internal: send_telegram_message # old incorrect pattern

# RIGHT - current execution pattern
telegram:
  # internal: execute_telegram_message # correct pattern
```

## Intelligent Template Library Integration

### Context-Aware Template Selection

**When user requests involve**:

- "generate + send/post/message" → **AI-to-Messaging Template**
- "process data + transform" → **Data Pipeline Template**
- "if/when + then/else" → **Conditional Logic Template**
- "try + fallback/backup" → **Reliability Template**
- "each/every + process" → **Parallel Processing Template**

### Progressive Template Enhancement

**Level 1 - Basic Structure**: Working YAML with placeholders
**Level 2 - Smart Defaults**: Environment variables, fallback APIs
**Level 3 - Context Adaptation**: Customize prompts, formats, scheduling  
**Level 4 - Reliability Patterns**: Retries, circuit breakers, monitoring

### Success Prediction

**High Success Probability**:

- ✅ Uses standard variable names
- ✅ Includes fallback patterns
- ✅ Environment variables for secrets
- ✅ Follows execution order
- ✅ Based on proven templates

**Risk Factors**:

- ⚠️ Custom variable references without validation
- ⚠️ Complex parallel workflows without testing
- ⚠️ Missing API keys or authentication
- ⚠️ No error handling or fallbacks

## Template Patterns by Use Case

### AI Content Generation + Delivery

```yaml
# Template: llm-to-telegram.yaml
workflow:
  name: 'AI Content to Telegram'
  description: 'Generate AI content and send to Telegram with fallbacks'

nodes:
  - id: generate_content
    type: llm
    model: 'gpt-4'
    prompt: 'Create a {{content_type}} about {{topic}}'
    api_key_env: 'OPENAI_API_KEY'
    fallback_api: 'llm_v7'

  - id: format_message
    type: template_transform
    template: "<b>{{content_type}}:</b>\n\n{{llm_content}}"
    output_variable: 'formatted_message'

  - id: send_telegram
    type: telegram
    bot_token_env: 'TELEGRAM_BOT_TOKEN'
    chat_id_env: 'TELEGRAM_CHAT_ID'
    message: '{{formatted_message}}'
    format: 'HTML'
```

### Data Processing Pipeline

```yaml
# Template: http-transform-output.yaml
workflow:
  name: 'Data Processing Pipeline'

nodes:
  - id: fetch_data
    type: http_request
    url: '{{api_endpoint}}'
    headers:
      Authorization: 'Bearer {{api_token}}'

  - id: transform_data
    type: template_transform
    template: 'Processed: {{http_response_body}}'
    output_variable: 'processed_result'

  - id: output_result
    type: answer
    content: '{{processed_result}}'
```

### Conditional Logic Flow

```yaml
# Template: conditional-workflow.yaml
workflow:
  name: 'Conditional Processing'

nodes:
  - id: check_condition
    type: variable_assignment
    variable_name: 'status'
    variable_value: '{{input_status}}'

  - id: conditional_branch
    type: if_else
    condition: "{{status}} == 'active'"
    if_branch: [process_active]
    else_branch: [process_inactive]

  - id: process_active
    type: llm
    prompt: 'Process active case: {{input_data}}'

  - id: process_inactive
    type: answer
    content: 'Inactive status - no processing needed'
```

## Variation Guidance

**IMPORTANT**: Workflows should vary based on context and requirements.

**Adapt these dimensions**:

- **Prompts**: Customize for specific domains, tones, formats
- **Variables**: Use meaningful names that reflect the actual data
- **Error Handling**: Match reliability requirements (simple vs. robust)
- **Output Formats**: HTML vs Markdown vs plain text based on destination
- **API Choices**: Balance cost, latency, and capability requirements

**Avoid converging on**:

- Generic variable names like "result", "output", "data"
- One-size-fits-all prompts
- Skipping error handling for "simple" workflows
- Always using the same AI model regardless of task

## Advanced Patterns

### Multi-Stage AI Workflows

```yaml
# Generate → Review → Refine → Deliver
nodes:
  - id: generate_draft
    type: llm
    prompt: 'Create initial {{content_type}}'

  - id: review_draft
    type: llm
    prompt: 'Review and suggest improvements: {{llm_content}}'

  - id: refine_content
    type: llm
    prompt: 'Apply improvements to: {{llm_content}}'
```

### Parallel Processing with Aggregation

```yaml
nodes:
  - id: process_parallel
    type: parallel_iteration
    items: ['{{item1}}', '{{item2}}', '{{item3}}']
    sub_workflow: [process_item, format_result]

  - id: aggregate_results
    type: variable_aggregation
    input_variables: ['result1', 'result2', 'result3']
    output_variable: 'combined_results'
```

### Circuit Breaker Pattern

```yaml
nodes:
  - id: protected_api_call
    type: circuit_breaker
    failure_threshold: 5
    timeout: '30s'
    sub_workflow: [external_api_call]
```

## Environment & Security

**Environment Variable Patterns**:

```bash
# Required for AI workflows
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Required for messaging
export TELEGRAM_BOT_TOKEN="123:ABC..."
export TELEGRAM_CHAT_ID="123456789"

# Optional for HTTP APIs
export API_TOKEN="bearer-token"
export API_ENDPOINT="https://api.example.com"
```

**Security Requirements**:

- ✅ Never hardcode secrets in YAML
- ✅ Use environment variables for all credentials
- ✅ Sanitize all user inputs in templates
- ✅ Validate URLs and API endpoints
- ✅ Set reasonable timeouts for external calls

## flowsh CLI Integration

**Compile workflow**:

```bash
flowsh compile my-workflow.yaml > generated-script.sh
chmod +x generated-script.sh
```

**Validate before compilation**:

```bash
flowsh validate my-workflow.yaml
```

**Test generated script**:

```bash
./generated-script.sh
```

## Troubleshooting Common Issues

**Variable not found errors**:

1. Check execution order - variable must be created before use
2. Verify variable name matches exactly (case sensitive)
3. Ensure creating node actually outputs that variable

**API authentication failures**:

1. Verify environment variables are set and exported
2. Test API keys with curl/HTTP tools first
3. Check API endpoint URLs and required headers

**Telegram delivery failures**:

1. Verify bot token and chat ID are correct
2. Test message format (HTML vs Markdown parsing)
3. Check message length limits and special characters

**LLM fallback patterns**:

1. Primary API (OpenAI/Anthropic) with key
2. Secondary API (LLM v7) without key
3. Static demo response for testing

## Remember

**flowsh transforms workflow ideas into reliable automation.**

The best workflows:

- Follow proven variable flow patterns
- Include comprehensive error handling
- Use meaningful, context-specific variables
- Balance simplicity with reliability
- Leverage templates but adapt to specific requirements

**You have access to 19+ node types and unlimited composition possibilities. These patterns guide the path—they don't limit the destination.**
