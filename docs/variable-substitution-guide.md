# Variable Substitution and LLM Integration Guide

This guide documents the variable substitution system in flowsh workflows, particularly focusing on LLM integration patterns and the prompt_template structure.

## Variable Substitution System

### Core Mechanism

flowsh uses a two-stage variable substitution system:

1. **Template Variables**: `${variable}` patterns in YAML are detected and preserved
2. **Shell Variable Calls**: Converted to `$(get_workflow_var "VARIABLE" "default")` in generated scripts

### Variable Storage Format

- **Node Outputs**: Stored in UPPERCASE format (e.g., `LLM_CONTENT`, `HTTP_STATUS_CODE`)
- **Template References**: Referenced in lowercase in YAML (e.g., `${llm_content}`, `${http_status_code}`)
- **Shell Script**: Accessed via uppercase calls (e.g., `$(get_workflow_var "LLM_CONTENT" "default")`)

## LLM Node Integration

### Prompt Template Structure

flowsh LLM nodes support multiple prompt template formats:

#### 1. Role-Based Message Array (Recommended)

```yaml
prompt_template:
  - role: 'system'
    text: |
      You are a helpful assistant specializing in ${topic}.
      Provide ${response_style} responses.
  - role: 'user'
    text: '${user_query}'
  - role: 'assistant'
    text: 'I understand. Let me help you with that.'
  - role: 'user'
    text: 'Please elaborate on ${specific_aspect}'
```

#### 2. Complex Template Object

```yaml
prompt_template:
  type: 'prompt'
  source: 'inline'
  content: |
    # ${title}

    ## Context
    ${context_info}

    ## User Query
    ${user_query}

    ## Instructions
    - Style: ${response_style}
    - Length: ${response_length}
```

#### 3. Legacy Prompt Field (Backward Compatibility)

```yaml
prompt: |
  Answer the following question: ${user_query}
  Style: ${response_style}
```

### Variable Flow Example

```yaml
# Step 1: LLM generates content
- id: 'ai_writer'
  type: 'llm'
  data:
    prompt_template:
      - role: 'system'
        text: 'Generate a ${content_type} about ${topic}'
      - role: 'user'
        text: '${user_request}'
# → Stores result in UPPERCASE: AI_WRITER

# Step 2: Format the AI content
- id: 'format_content'
  type: 'variable-assignment'
  data:
    variable: 'formatted_message'
    assignment_type: 'constant'
    value: |
      **AI Generated Content**

      ${ai_writer}

      Topic: ${topic}
# → Variable substitution: ${ai_writer} becomes actual AI content
# Step 3: Send to Telegram
- id: 'send_message'
  type: 'telegram'
  data:
    message: '${formatted_message}'
# → Final delivery with fully substituted content
```

## Variable Assignment Node Integration

### Template Variable Detection

The variable-assignment node intelligently handles template variables:

```yaml
# Template variables are preserved for substitution
- id: 'create_summary'
  type: 'variable-assignment'
  data:
    variable: 'summary_text'
    assignment_type: 'constant'
    value: 'AI Response: ${llm_content} | Status: ${http_status}'
    # Result: AI Response: [actual AI text] | Status: 200

# Non-template variables are escaped for safety
- id: 'create_literal'
  type: 'variable-assignment'
  data:
    variable: 'literal_text'
    assignment_type: 'constant'
    value: 'Price: $50 (no substitution needed)'
    # Result: Price: \$50 (no substitution needed)
```

### Assignment Types and Template Variables

#### Constant Assignment with Templates

```yaml
assignment_type: 'constant'
value: 'Welcome ${user_name}! Your score is ${calculated_score}.'
# → Uses processConfigValue() for template substitution
```

#### Expression Assignment

```yaml
assignment_type: 'expression'
expression: 'echo "Processing ${input_data} at $(date)"'
# → Always uses processConfigValue() for shell command generation
```

#### Variable Copying

```yaml
assignment_type: 'variable'
source_variable: 'original_data'
# → Direct variable-to-variable copying, no template processing
```

## Common Integration Patterns

### 1. LLM → Format → Telegram

```yaml
# Generate AI content
llm_node → variable: 'ai_content'

# Format with template substitution
variable_assignment:
  value: 'Message: ${ai_content}'

# Send to Telegram
telegram:
  message: '${formatted_message}'
```

### 2. HTTP → LLM → Process

```yaml
# Fetch data
http_request → variable: 'api_data'

# Analyze with AI
llm_node:
  prompt_template:
    - role: 'user'
      text: 'Analyze this data: ${api_data}'

# Process results
variable_assignment:
  value: 'Analysis: ${llm_analysis} | Source: ${api_data}'
```

### 3. Multi-LLM Aggregation

```yaml
# Multiple AI responses
llm_node_1 → 'analysis_1'
llm_node_2 → 'analysis_2'

# Combine responses
variable_assignment:
  value: |
    **Combined Analysis**

    Response 1: ${analysis_1}

    Response 2: ${analysis_2}

    Generated: $(date)
```

## Debugging Variable Substitution

### Common Issues and Solutions

#### Issue: Literal `${variable}` in Output

**Cause**: Variable casing mismatch or missing variable

```yaml
# ❌ Wrong: Variable doesn't exist or wrong case
value: 'Content: ${missing_variable}'

# ✅ Correct: Match node ID and ensure variable exists
value: 'Content: ${existing_node_id}'
```

#### Issue: Shell Injection Risk

**Cause**: Unescaped user input in templates

```yaml
# ❌ Dangerous: User input not validated
value: 'Command: ${user_input}'

# ✅ Safe: Use expressions with proper escaping
assignment_type: 'expression'
expression: 'echo "Command: $(echo "${user_input}" | sed "s/[^a-zA-Z0-9 ]//g")"'
```

#### Issue: Complex Template Not Working

**Cause**: Nested template variables or complex syntax

```yaml
# ❌ Complex nesting not supported
value: '${prefix_${dynamic_suffix}}'

# ✅ Use expressions for complex operations
assignment_type: 'expression'
expression: 'echo "${prefix}$(get_workflow_var "DYNAMIC_SUFFIX")_result"'
```

### Validation Commands

```bash
# Validate workflow syntax
flowsh validate examples/llm-to-telegram-workflow.yaml

# Compile to see generated shell script
flowsh compile examples/llm-to-telegram-workflow.yaml > output.sh

# Check variable substitution in generated script
grep -n "get_workflow_var" output.sh
```

## Security Considerations

### Input Sanitization

- All template variables are processed through security validation
- Shell-dangerous characters are escaped when not using expressions
- User input should be validated before template substitution

### Best Practices

1. **Use specific variable names**: `${user_query}` not `${input}`
2. **Validate template variables**: Ensure all referenced variables exist
3. **Escape when needed**: Use expressions for complex shell operations
4. **Test substitution**: Always validate generated scripts before production use

## Examples in Repository

- **Basic LLM Integration**: `examples/nodes/llm-node-example.yaml`
- **Variable Assignment**: `examples/nodes/variable-assignment-node-example.yaml`
- **LLM→Telegram Workflow**: `examples/llm-to-telegram-workflow.yaml`
- **Integration Tests**: `src/generation/integration/llm-telegram-workflow.test.ts`

## Related Files

- **LLM Generator**: `src/generation/generators/llm-node.ts`
- **Variable Assignment Generator**: `src/generation/generators/variable-assignment-node.ts`
- **Template Processing**: `src/generation/shell-scripting/template-variables.ts`
- **Security Validation**: `src/security/`
