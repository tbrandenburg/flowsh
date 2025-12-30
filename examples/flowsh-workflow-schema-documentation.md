# flowsh Workflow YAML Schema Documentation

## Overview

This document provides comprehensive documentation for the flowsh Workflow YAML schema, which has been reverse-engineered from the flowsh codebase. The schema allows workflows to be defined as exportable YAML configurations with complete validation and type safety.

## Table of Contents

- [Quick Start](#quick-start)
- [Schema Structure](#schema-structure)
- [Node Types](#node-types)
- [Template System](#template-system)
- [Nested Workflows](#nested-workflows)
- [Variables and Data Flow](#variables-and-data-flow)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Quick Start

Here's a minimal workflow example:

```yaml
version: "1.0"
kind: Workflow

metadata:
  name: "simple-chat"
  description: "Basic LLM chat workflow"

spec:
  graph:
    nodes:
      - id: "start"
        type: "start"
        data:
          title: "User Input"
          variables:
            - variable: "query"
              label: "Your question"
              type: "text-input"
              required: true

      - id: "llm"
        type: "llm"
        data:
          title: "AI Response"
          model:
            provider: "openai"
            name: "gpt-4"
            mode: "chat"
          prompt_template:
            - role: "user"
              text: "{{#start.query#}}"

      - id: "answer"
        type: "answer"
        data:
          title: "Response"
          answer: "{{#llm.text#}}"

    edges:
      - source: "start"
        target: "llm"
      - source: "llm"
        target: "answer"
```

## Schema Structure

### Root Level

```yaml
version: "1.0"          # Schema version (required)
kind: "Workflow"        # Resource type (required)
metadata:               # Workflow metadata (optional)
spec:                   # Workflow specification (required)
```

### Metadata Section

```yaml
metadata:
  id: "unique-workflow-id"
  name: "Human Readable Name"
  description: "Workflow description"
  version: "1.0"
  created_by: "user-id"
  updated_by: "user-id"
  labels:
    category: "support"
    complexity: "medium"
  annotations:
    documentation: "https://docs.example.com/workflow"
```

### Specification Section

```yaml
spec:
  graph:                      # Main workflow graph (required)
    nodes: []                 # Array of workflow nodes
    edges: []                 # Array of node connections
    viewport:                 # Canvas view settings
      x: 0
      y: 0
      zoom: 1.0
      
  features:                   # Workflow capabilities (optional)
    file_upload: {}
    opening_statement: "Hello!"
    suggested_questions: []
    
  environment_variables: []   # Global environment vars (optional)
  conversation_variables: []  # Conversation context vars (optional)
  execution_config: {}        # Runtime configuration (optional)
```

## Node Types

### Base Node Structure

All nodes share a common base structure:

```yaml
id: "unique-node-id"          # Required: Unique identifier
type: "node-type"             # Required: Node type (see types below)
position:                     # Optional: Canvas position
  x: 100
  y: 200
data:                         # Required: Node-specific configuration
  title: "Display Name"       # Required: Node display name
  desc: "Description"         # Optional: Node description
  version: "1"               # Optional: Schema version
  error_strategy: "fail-branch" # Optional: Error handling
  default_value: []          # Optional: Default fallback values
  retry_config:              # Optional: Retry configuration
    retry_enabled: true
    max_retries: 3
    retry_interval: 1000
```

### 1. Start Node

Entry point for workflow execution with input variable definitions.

```yaml
- id: "start"
  type: "start"
  data:
    title: "Start"
    variables:
      - variable: "user_input"        # Variable name
        label: "Enter your question"  # Display label
        type: "text-input"           # Input type
        required: true               # Required flag
        max_length: 1000            # Length limit
        default: "Hello"            # Default value
        options: ["A", "B", "C"]    # For select type
        json_schema: "{}"           # For JSON validation
```

**Variable Types:**
- `text-input`: Single line text
- `paragraph`: Multi-line text  
- `select`: Dropdown selection
- `number`: Numeric input
- `checkbox`: Boolean checkbox
- `url`: URL validation
- `files`: File upload
- `json`: JSON object
- `json_object`: Structured JSON with schema

### 2. LLM Node

Large Language Model interactions with comprehensive configuration.

```yaml
- id: "llm"
  type: "llm"
  data:
    title: "AI Assistant"
    model:
      provider: "openai"             # Provider: openai, anthropic, etc.
      name: "gpt-4"                  # Model name
      mode: "chat"                   # chat or completion
      completion_params:
        temperature: 0.7
        max_tokens: 1000
        top_p: 1.0
        presence_penalty: 0
        frequency_penalty: 0
        
    prompt_template:                 # For chat mode
      - role: "system"
        text: "You are a helpful assistant."
      - role: "user" 
        text: "{{#start.user_input#}}"
        
    # OR for completion mode:
    # prompt_template: "Complete this: {{#start.user_input#}}"
        
    context:                         # Context configuration
      enabled: true
      variable_selector: ["knowledge", "result"]
      
    vision:                          # Vision capabilities
      enabled: false
      configs:
        variable_selector: ["start", "image"]
        detail: "high"               # high or low
        
    memory:                          # Conversation memory
      role_prefix:
        user: "Human"
        assistant: "AI"
      window:
        enabled: true
        size: 10
        
    structured_output_enabled: false # Enable JSON output
    structured_output:               # JSON schema for output
      type: "object"
      properties:
        answer: {"type": "string"}
        
    reasoning_format: "separated"    # tagged or separated
```

### 3. Tool Node

External tool and API integrations.

```yaml
- id: "tool"
  type: "tool"
  data:
    title: "External Tool"
    provider_id: "google"           # Tool provider
    provider_type: "built-in"       # built-in, app, or plugin
    provider_name: "Google APIs"
    tool_name: "search"             # Specific tool
    credential_id: "cred-123"       # Authentication
    
    tool_configurations:            # Tool-specific settings
      api_version: "v1"
      
    tool_parameters:                # Tool parameters
      query:
        value: ["start", "user_input"]  # Variable reference
        type: "variable"
      max_results:
        value: 5
        type: "constant"
      language:
        value: "en"
        type: "constant"
```

### 4. HTTP Request Node

Make HTTP API calls with full configuration.

```yaml
- id: "api_call"
  type: "http-request"
  data:
    title: "API Request"
    method: "POST"                   # GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
    url: "https://api.example.com/v1/search"
    
    headers: |                       # JSON string of headers
      {
        "Content-Type": "application/json",
        "User-Agent": "flowsh-Workflow/1.0"
      }
      
    params: |                        # JSON string of query params
      {
        "limit": 10,
        "format": "json"
      }
      
    authorization:                   # Authentication
      type: "api-key"                # no-auth, api-key, bearer-token, basic
      config:
        type: "bearer"               # basic, bearer, custom
        api_key: "{{#env.API_KEY#}}"
        header: "Authorization"      # For custom type
        
    body:                            # Request body
      type: "json"                   # none, form-data, x-www-form-urlencoded, raw-text, json, binary
      data:
        - key: "query"
          type: "text"
          value: "{{#start.user_input#}}"
        - key: "file"
          type: "file"
          file: ["start", "upload"]
          
    timeout:                         # Request timeouts
      connect: 30
      read: 60  
      write: 30
      
    ssl_verify: true                # SSL certificate verification
```

### 5. Knowledge Retrieval Node

Retrieval Augmented Generation (RAG) for knowledge bases.

```yaml
- id: "knowledge"
  type: "knowledge-retrieval"  
  data:
    title: "Knowledge Search"
    query_variable_selector: ["start", "question"]
    dataset_ids: ["kb-001", "faq-002"]    # Knowledge base IDs
    retrieval_mode: "multiple"            # single or multiple
    
    multiple_retrieval_config:            # For multiple mode
      top_k: 5                           # Number of results
      score_threshold: 0.7               # Minimum relevance score
      reranking_enable: true             # Enable reranking
      reranking_mode: "reranking_model"
      reranking_model:
        provider: "cohere"
        model: "rerank-english-v2.0"
      weights:                           # Hybrid search weights
        vector_setting:
          vector_weight: 0.7
          embedding_provider_name: "openai"
          embedding_model_name: "text-embedding-ada-002"
        keyword_setting:
          keyword_weight: 0.3
          
    single_retrieval_config:              # For single mode
      model:
        provider: "openai"
        name: "gpt-4"
        mode: "chat"
```

### 6. If-Else Node

Conditional branching with complex logic support.

```yaml
- id: "condition"
  type: "if-else"
  data:
    title: "Route Logic"
    logical_operator: "and"              # Global operator: and, or
    
    cases:                               # Multiple condition cases
      - case_id: "premium_user"
        logical_operator: "and"          # Case-specific operator
        conditions:
          - variable_selector: ["user", "tier"]
            comparison_operator: "="
            value: "premium"
          - variable_selector: ["user", "active"]
            comparison_operator: "="
            value: true
            
      - case_id: "urgent_request"
        logical_operator: "or"
        conditions:
          - variable_selector: ["request", "priority"]
            comparison_operator: ">"
            value: "high"
          - variable_selector: ["request", "keywords"]
            comparison_operator: "contains"
            value: "urgent"
```

**Comparison Operators:**
- `contains`, `not contains`: String containment
- `start with`, `end with`: String prefix/suffix
- `is`, `is not`: Exact equality
- `empty`, `not empty`: Empty check
- `null`, `not null`: Null check  
- `=`, `!=`: Equality/inequality
- `>`, `<`, `>=`, `<=`: Numeric comparison

### 7. Question Classifier Node

Classify user queries using LLM.

```yaml
- id: "classifier"
  type: "question-classifier"
  data:
    title: "Query Classifier"
    query_variable_selector: ["start", "question"]
    model:
      provider: "openai"
      name: "gpt-4"
      mode: "chat"
    classes:
      - id: "technical"
        name: "Technical Support"
      - id: "billing"  
        name: "Billing Question"
      - id: "general"
        name: "General Inquiry"
    instruction: "Classify the user question into the most appropriate category."
    memory: null                         # Optional memory config
    vision:                             # Optional vision config
      enabled: false
```

### 8. Iteration Node

Process arrays with sub-workflows using a flat graph structure.

```yaml
- id: "iterator"
  type: "iteration"
  data:
    title: "Process Files"
    iterator_selector: ["start", "file_list"]      # Array to iterate
    output_selector: ["process", "result"]        # Output collection
    start_node_id: "sub_start"                   # Sub-workflow entry point
    is_parallel: true                            # Parallel execution
    parallel_nums: 5                             # Max parallel threads
    error_handle_mode: "continue-on-error"       # Error strategy
    flatten_output: true                         # Flatten nested arrays

# NESTED SUB-WORKFLOW NODES (exist at same level, reference parent via iteration_id)
- id: "sub_start"
  type: "document-extractor"
  isInIteration: true                            # Mark as nested
  iteration_id: "iterator"                      # Parent container ID
  data:
    title: "Extract Document"
    variable_selector: ["iteration", "item"]     # Current iteration item

- id: "sub_process"  
  type: "llm"
  isInIteration: true                            # Mark as nested
  iteration_id: "iterator"                      # Parent container ID
  data:
    title: "Process Content"
    model: {...}
    prompt_template: [...]
```

**Key Points:**
- Child nodes reference parent via `iteration_id` field
- All nodes exist at the same graph level (flat structure)
- `start_node_id` identifies the sub-workflow entry point
- Special `["iteration", "item"]` variable references current array item

**Error Handle Modes:**
- `terminated`: Stop on first error
- `continue-on-error`: Continue processing
- `remove-abnormal-output`: Remove failed results

### 9. Loop Node  

Conditional loops with break conditions and nested sub-workflows.

```yaml
- id: "retry_loop"
  type: "loop"
  data:
    title: "Retry Logic"
    loop_count: 10                               # Maximum iterations
    logical_operator: "or"                       # Break condition logic
    break_conditions:                            # Exit conditions
      - variable_selector: ["api", "success"]
        comparison_operator: "="
        value: true
      - variable_selector: ["api", "status_code"]
        comparison_operator: "="
        value: 200
        
    start_node_id: "loop_start"                 # Sub-workflow entry point
    loop_variables:                             # Loop variables
      - label: "attempt"
        var_type: "number"
        value_type: "constant"
        value: 0
      - label: "delay"
        var_type: "number" 
        value_type: "variable"
        value: ["config", "retry_delay"]
        
    outputs:                                    # Output configuration
      final_result: {}
      attempt_count: {}

# NESTED SUB-WORKFLOW NODES (exist at same level, reference parent via loop_id)
- id: "loop_start"
  type: "http-request"
  isInLoop: true                               # Mark as nested
  loop_id: "retry_loop"                       # Parent container ID
  data:
    title: "Make API Call"
    method: "POST"
    url: "{{#env.API_URL#}}"

- id: "loop_check"
  type: "code"
  isInLoop: true                               # Mark as nested
  loop_id: "retry_loop"                       # Parent container ID
  data:
    title: "Check Result"
    code: "// Check if retry needed..."
```

**Key Points:**
- Child nodes reference parent via `loop_id` field
- All nodes exist at the same graph level (flat structure)  
- `start_node_id` identifies the sub-workflow entry point
- Loop variables maintain state across iterations

### 10. Code Node

Execute custom JavaScript or Python code.

```yaml
- id: "processor"
  type: "code"
  data:
    title: "Data Processor"
    variables:                                  # Input variables
      - variable: "raw_data"
        value_selector: ["api", "response"]
      - variable: "config"
        value_selector: ["start", "settings"]
        
    code_language: "javascript"                 # python3 or javascript
    code: |
      function main({raw_data, config}) {
        // Process the data
        const processed = raw_data.map(item => {
          return {
            id: item.id,
            name: item.name.toUpperCase(),
            score: item.score * config.multiplier
          };
        });
        
        // Return outputs
        return {
          processed_data: processed,
          total_count: processed.length,
          average_score: processed.reduce((a, b) => a + b.score, 0) / processed.length
        };
      }
      
    outputs:                                    # Expected outputs
      processed_data:
        type: "array[object]"
      total_count:
        type: "number"
      average_score:
        type: "number"
        
    dependencies:                               # External packages (Python only)
      - name: "requests"
        version: "2.28.0"
      - name: "pandas" 
        version: "1.5.0"
```

### 11. Parameter Extractor Node

Extract structured data using LLM function calling.

```yaml
- id: "extractor"
  type: "parameter-extractor"
  data:
    title: "Extract Details"
    model:
      provider: "openai"
      name: "gpt-4"
      mode: "chat"
    query: ["start", "user_message"]
    reasoning_mode: "function_call"             # function_call or prompt
    instruction: "Extract structured information from the user message."
    
    parameters:                                 # Parameters to extract
      - name: "issue_type"
        type: "string"
        description: "Type of customer issue"
        required: true
        options: ["billing", "technical", "general"]
      - name: "urgency"
        type: "string"
        description: "Urgency level"
        required: true
        options: ["low", "medium", "high", "critical"]
      - name: "customer_id"
        type: "string"
        description: "Customer identifier if mentioned"
        required: false
      - name: "products"
        type: "array[string]" 
        description: "Products mentioned"
        required: false
        
    memory: null                               # Optional conversation memory
    vision:                                    # Optional vision support
      enabled: false
```

### 12. Template Transform Node

Process Jinja2 templates with variables.

```yaml
- id: "template"
  type: "template-transform"
  data:
    title: "Format Response"
    variables:                                 # Template variables
      - variable: "customer_name"
        value_selector: ["customer", "name"]
      - variable: "response_text"
        value_selector: ["llm", "text"]
      - variable: "timestamp"
        value_selector: ["sys", "timestamp"]
        
    template: |                               # Jinja2 template
      Dear {{ customer_name or 'Valued Customer' }},
      
      Thank you for contacting us on {{ timestamp.strftime('%B %d, %Y') }}.
      
      {{ response_text }}
      
      Best regards,
      Support Team
      
      {% if customer.tier == 'premium' %}
      As a premium customer, you can reach our priority support at premium@company.com
      {% endif %}
```

### 13. Answer Node

Final workflow output node.

```yaml
- id: "answer" 
  type: "answer"
  data:
    title: "Final Response"
    answer: |
      {{#template.result#}}
      
      ---
      Reference ID: {{#sys.workflow_execution_id#}}
      Processing Time: {{#sys.elapsed_time#}}s
```

### 14. Variable Nodes

**Variable Assigner:**
```yaml
- id: "assigner"
  type: "variable-assigner" 
  data:
    title: "Set Variables"
    variables:
      - variable: "status"
        value: "processed"
      - variable: "timestamp"
        value: ["sys", "timestamp"]
      - variable: "user_tier"
        value: ["customer_lookup", "tier"]
```

**Variable Aggregator:**
```yaml
- id: "aggregator"
  type: "variable-aggregator"
  data:
    title: "Combine Data"
    variables:
      - variable: "user_data"
        value_selector: ["user_lookup", "data"]
      - variable: "preferences"
        value_selector: ["pref_lookup", "settings"]
      - variable: "history"
        value_selector: ["history_lookup", "events"]
```

## Template System

flowsh implements a sophisticated multi-layered template system that enables reusability, sharing, and sophisticated prompt management across the entire platform. This system provides multiple approaches for template management depending on your use case.

### Template System Architecture

#### 1. **Advanced Prompt Templates**
Model-specific prompt configurations optimized for different LLM providers and modes.

```yaml
# Reference advanced prompt template
- id: "optimized_llm"
  type: "llm" 
  data:
    model:
      provider: "openai"
      name: "gpt-4"
    prompt_template:
      type: "prompt"
      source: "built-in"
      template_type: "chat_app_chat"
    advanced_prompt_config:
      app_mode: "chat"
      model_mode: "chat"
      model_name: "gpt-4"
      has_context: true
```

**Key Features:**
- **Model Optimization**: Templates optimized for specific models (Baichuan, general models)
- **Context Injection**: Automatic context template injection based on `has_context` flag
- **Conversation History**: Proper role-based conversation formatting
- **Stop Sequences**: Model-appropriate stop sequence configuration

#### 2. **Pipeline Templates** 
RAG pipeline configurations with comprehensive sharing and management capabilities.

```yaml
# Reference pipeline template
pipeline_reference:
  type: "pipeline"
  source: "database" # built-in, database, customized, remote
  template_id: "advanced-rag-v2"
  version: "1.2.0"
  parameters:
    chunk_size: 1000
    overlap: 200
    retrieval_mode: "hybrid"
  sharing_scope: "workspace"
```

**Template Storage Tiers:**
1. **Built-in Templates**: Curated templates available to all users
2. **Database Templates**: Professionally maintained template library  
3. **Customized Templates**: User/workspace-created templates
4. **Remote Templates**: External template repositories

**Sharing Capabilities:**
- **Workspace-level Sharing**: Templates scoped to `tenant_id`
- **Template Publishing**: Users can save pipelines as reusable templates
- **CRUD Operations**: Full create, read, update, delete support
- **Export/Import**: YAML-based template interchange
- **Metadata Management**: Icons, descriptions, categorization

#### 3. **Workflow Templates**
Complete workflow configurations as reusable templates with parameterization.

```yaml
# Workflow template reference
workflow_template:
  type: "workflow"
  source: "library"
  template_id: "content-generation-pipeline"
  version: "2.1.0"
  parameters:
    content_type: "blog_post"
    target_length: 2000
    tone: "professional"
    target_audience: "developers"
  required_integrations: ["openai", "serp"]
  complexity_level: "intermediate"
```

**Template Features:**
- **Parameterization**: Configurable template parameters with validation
- **Default Values**: Sensible defaults for quick deployment
- **Integration Requirements**: Clear dependency declarations
- **Complexity Assessment**: Beginner to expert classification
- **Token Estimation**: Resource usage prediction

#### 4. **Template Transform Nodes**
Runtime Jinja2 template processing within workflows with external template support.

```yaml
# Template transform with external reference
- id: "dynamic_content"
  type: "template-transform"
  data:
    template:
      type: "jinja2"
      source: "customized"
      template_id: "email-formatter-v1"
      parameters:
        format: "html"
        include_signature: true
    variables:
      - variable: "recipient_name"
        value_selector: ["user", "name"]
      - variable: "content"
        value_selector: ["llm", "text"]
    template_validation:
      validate_syntax: true
      validate_variables: true
      strict_mode: false
```

### Template Reference Syntax

All template systems support a unified reference syntax:

```yaml
template_reference:
  type: "prompt|pipeline|workflow|jinja2|custom"
  source: "built-in|database|customized|remote|inline|library"
  template_id: "unique-template-identifier"
  template_name: "Human Readable Name"
  version: "1.2.3|latest"
  url: "https://templates.example.com/template.yaml" # for remote
  parameters:
    parameter1: "value1"
    parameter2: "value2"
  cache_policy:
    cache_enabled: true
    cache_duration: 3600
  validation:
    validate_syntax: true
    security_scan: true
```

### Template Management Operations

#### Creating Templates

**From Existing Workflows/Pipelines:**
```python
# Backend service calls
pipeline_service.publish_customized_pipeline_template(
    pipeline_id="uuid-123",
    template_data={
        "name": "My RAG Template",
        "description": "Advanced RAG pipeline with hybrid search",
        "icon": {"type": "emoji", "value": "🔍"},
        "tags": ["rag", "hybrid", "search"]
    }
)
```

**Template Metadata Structure:**
```yaml
template_metadata:
  id: "template-uuid"
  tenant_id: "workspace-uuid" # null for built-in
  name: "Template Name"
  description: "Detailed description"
  icon:
    type: "emoji|lucide|custom"
    value: "🔍"
    color: "#3B82F6"
  position: 1 # display order
  install_count: 47
  language: "en-US"
  created_by: "user-uuid"
  sharing_scope: "private|workspace|public"
  tags: ["tag1", "tag2"]
  version_history:
    - version: "1.0.0"
      created_at: "2024-01-15T10:00:00Z"
      changelog: "Initial release"
      breaking_changes: false
```

#### Template Libraries

**Multi-source Template Libraries:**
```yaml
template_libraries:
  - library_id: "official-templates"
    name: "Official flowsh Templates"
    source_type: "built-in"
    access_control:
      public_read: true
      workspace_write: false
    
  - library_id: "workspace-templates"  
    name: "Workspace Templates"
    source_type: "workspace"
    access_control:
      workspace_read: true
      workspace_write: true
      
  - library_id: "community-hub"
    name: "Community Template Hub"
    source_type: "marketplace"
    source_url: "https://templates.flowsh.ai"
    sync_config:
      auto_sync: true
      sync_interval: 86400
      conflict_resolution: "skip"
```

### Template Parameterization

**Parameter Definition:**
```yaml
template_parameters:
  - name: "model_temperature"
    type: "number"
    description: "Controls randomness in model outputs"
    required: false
    default_value: 0.7
    validation:
      minimum: 0.0
      maximum: 2.0
    
  - name: "content_type"
    type: "select"
    description: "Type of content to generate"
    required: true
    options: ["blog_post", "email", "summary", "report"]
    
  - name: "custom_instructions"
    type: "string"
    description: "Additional instructions for the model"
    validation:
      max_length: 500
      pattern: "^[a-zA-Z0-9\\s.,!?-]*$"
```

### Template Validation & Security

**Comprehensive Validation Framework:**
```yaml
template_validation:
  validate_syntax: true        # Jinja2 syntax validation
  validate_variables: true     # Variable reference validation  
  strict_mode: false          # Require all variables to be defined
  security_scan: true         # Security vulnerability scanning
  max_template_size: 100000   # Maximum template size in characters
  allowed_functions:          # Whitelist of allowed Jinja2 functions
    - "range"
    - "length"
    - "upper"
    - "lower"
    - "replace"
```

**Security Features:**
- **Sandboxed Execution**: Templates execute in isolated environments
- **Function Whitelisting**: Only approved Jinja2 functions allowed
- **Size Limits**: Prevent resource exhaustion attacks
- **Input Sanitization**: Automatic XSS and injection prevention
- **Access Control**: Granular permissions for template access

### Template Versioning & Migration

**Semantic Versioning:**
```yaml
template_versions:
  - version: "1.0.0"
    created_at: "2024-01-15T10:00:00Z"
    created_by: "user-uuid"
    changelog: "Initial template release"
    breaking_changes: false
    deprecated: false
    
  - version: "2.0.0"  
    created_at: "2024-02-15T10:00:00Z"
    created_by: "user-uuid"
    changelog: "Major redesign with new parameter structure"
    breaking_changes: true
    deprecated: false
```

**Migration Support:**
- **Backward Compatibility**: Non-breaking changes maintain compatibility
- **Breaking Change Detection**: Automatic detection and warnings
- **Migration Guides**: Automated migration assistance
- **Deprecation Warnings**: Graceful sunset of old versions

### Integration with Existing Systems

#### LLM Nodes with Template References
```yaml
- id: "smart_llm"
  type: "llm"
  data:
    model:
      provider: "openai" 
      name: "gpt-4"
    prompt_template:
      type: "prompt"
      source: "customized"
      template_id: "expert-analyst-v3"
      version: "1.5.0"
    template_parameters:
      expertise_domain: "software_engineering"
      response_style: "detailed_technical"
      include_code_examples: true
    advanced_prompt_config:
      app_mode: "chat"
      has_context: true
      model_name: "gpt-4"
```

#### Template Transform Nodes
```yaml
- id: "format_output"
  type: "template-transform"  
  data:
    template:
      type: "jinja2"
      source: "library"
      template_name: "markdown-formatter"
      version: "latest"
    variables:
      - variable: "content"
        value_selector: ["llm", "text"]
      - variable: "title" 
        value_selector: ["start", "title"]
    template_validation:
      validate_syntax: true
      strict_mode: true
```

### Template Best Practices

#### 1. **Template Organization**
```yaml
# Use clear, descriptive names
template_name: "customer-support-escalation-v2"

# Provide comprehensive descriptions
description: |
  Automated customer support workflow with intelligent escalation.
  Handles common inquiries and escalates complex issues to human agents.
  Includes sentiment analysis and priority routing.

# Use semantic versioning
version: "2.1.0"

# Tag for discoverability  
tags: ["customer-service", "automation", "escalation", "ai-assistant"]
```

#### 2. **Parameter Design**
```yaml
# Provide sensible defaults
parameters:
  escalation_threshold:
    type: "number"
    default_value: 3
    description: "Number of failed resolution attempts before escalation"
    
  response_tone:
    type: "select" 
    default_value: "professional"
    options: ["casual", "professional", "empathetic", "technical"]
    description: "Tone of automated responses"
```

#### 3. **Template Composition**
```yaml
# Reference other templates for modularity
prompt_template:
  type: "prompt"
  source: "library"
  template_id: "base-customer-service-v1" 
  parameters:
    specialized_domain: "technical-support"
    
# Use template inheritance patterns
base_template: "generic-chat-v2"
overrides:
  system_message: "You are a specialized technical support agent..."
  temperature: 0.3
```

#### 4. **Error Handling**
```yaml
template_fallbacks:
  - condition: "template_not_found"
    action: "use_inline_fallback"
    fallback_template: "Basic response: I'm sorry, I couldn't process your request."
    
  - condition: "parameter_validation_failed"
    action: "use_defaults"
    log_error: true
```

### Template System Benefits

#### **For Developers:**
- **Rapid Development**: Pre-built templates accelerate workflow creation
- **Consistency**: Standardized patterns across projects
- **Version Control**: Track template evolution and manage dependencies
- **Collaboration**: Share and reuse templates across teams

#### **For Organizations:**
- **Governance**: Centralized template management and approval workflows  
- **Compliance**: Ensure all workflows meet organizational standards
- **Cost Optimization**: Reuse proven templates to reduce development costs
- **Knowledge Management**: Capture and share best practices as templates

#### **For Platforms:**
- **Ecosystem Growth**: Enable community-driven template libraries
- **Quality Assurance**: Validated, tested templates reduce support burden
- **Innovation**: Template marketplace encourages creative solutions
- **Scalability**: Template system scales from individual to enterprise use

### Advanced Template Features

#### Template Composition
```yaml
# Compose multiple templates
composite_template:
  base_template:
    type: "workflow"
    source: "library"  
    template_id: "data-processing-base-v1"
    
  extensions:
    - type: "prompt"
      source: "customized"
      template_id: "domain-specific-instructions"
      merge_strategy: "append"
      
    - type: "pipeline"
      source: "remote"
      url: "https://templates.example.com/advanced-rag.yaml"
      merge_strategy: "override"
```

#### Dynamic Template Loading
```yaml
# Runtime template selection
dynamic_template:
  selection_logic:
    - condition: "{{user.expertise_level}} == 'beginner'"
      template_id: "simple-explanation-template"
    - condition: "{{user.expertise_level}} == 'expert'" 
      template_id: "technical-deep-dive-template"
    - default: "balanced-explanation-template"
```

#### Template Analytics
```yaml
template_analytics:
  usage_tracking: true
  performance_metrics: true
  user_feedback: true
  optimization_suggestions: true
```

This comprehensive template system provides the foundation for sophisticated, reusable, and maintainable AI workflows while supporting both individual developers and enterprise-scale deployments.

## Nested Workflows

flowsh implements nested workflows using a **"flat graph with references"** approach rather than true hierarchical nesting.

### Architecture

#### 1. Flat Graph Structure
All nodes (including nested ones) exist at the same level in the `nodes` array. There is no physical nesting in the data structure.

#### 2. Reference-Based Nesting
Child nodes reference their parent container via special ID fields:
- `iteration_id`: References parent iteration node
- `loop_id`: References parent loop node
- `isInIteration`/`isInLoop`: Boolean flags for quick identification

#### 3. Edge Context
Edges connecting nodes within containers also carry the same context:
```yaml
edges:
  - source: "child1"
    target: "child2"
    data:
      isInIteration: true
      iteration_id: "parent_iteration_id"
```

### Container Node Patterns

#### Iteration Containers
```yaml
# Container node
- id: "process_files"
  type: "iteration"
  data:
    start_node_id: "extract_text"      # Entry point
    iterator_selector: ["start", "files"]
    output_selector: ["summarize", "summary"]

# Child nodes (same level, different context)
- id: "extract_text"
  type: "document-extractor"
  isInIteration: true                  # Context flag
  iteration_id: "process_files"        # Parent reference
  data: {...}

- id: "summarize"
  type: "llm"
  isInIteration: true                  # Context flag
  iteration_id: "process_files"        # Parent reference
  data: {...}

# Edges within iteration
- source: "extract_text"
  target: "summarize"
  data:
    isInIteration: true                # Context flag
    iteration_id: "process_files"      # Parent reference
```

#### Loop Containers
```yaml
# Container node
- id: "retry_api"
  type: "loop"
  data:
    start_node_id: "make_call"         # Entry point
    loop_count: 5
    break_conditions: [...]

# Child nodes (same level, different context)
- id: "make_call"
  type: "http-request"
  isInLoop: true                       # Context flag
  loop_id: "retry_api"                # Parent reference
  data: {...}

- id: "check_result"
  type: "if-else"
  isInLoop: true                       # Context flag
  loop_id: "retry_api"                # Parent reference
  data: {...}
```

### Execution Flow

1. **Container Identification**: Engine identifies iteration/loop nodes
2. **Child Discovery**: Finds all nodes with matching `iteration_id`/`loop_id`
3. **Sub-workflow Execution**: Executes child nodes in container context
4. **Variable Scoping**: Maintains separate variable pools for each iteration/loop
5. **Result Collection**: Aggregates outputs according to container configuration

### Variable Access

#### Special Variables in Iterations
- `["iteration", "item"]`: Current array item being processed
- `["iteration", "index"]`: Current iteration index (0-based)

#### Special Variables in Loops  
- `["loop", "index"]`: Current loop iteration (0-based)
- Loop variables defined in `loop_variables` array

#### Variable Scoping
- Child nodes can access parent workflow variables
- Parent cannot directly access child variables (except through outputs)
- Each iteration/loop maintains separate variable scope

### Best Practices

#### 1. Clear Naming
- Use descriptive IDs for container and child nodes
- Prefix child node IDs with container context when helpful

#### 2. Entry Point Design
- `start_node_id` should point to a logical entry point
- Ensure entry node has no incoming edges from outside container

#### 3. Output Management
- Use meaningful `output_selector` paths
- Consider `flatten_output` setting for iterations
- Design loop outputs to capture final state

#### 4. Error Handling
- Configure appropriate `error_handle_mode` for iterations
- Use break conditions effectively in loops
- Provide fallback values for critical paths

### Advanced Patterns

#### Nested Containers
Containers can be nested within other containers:
```yaml
# Outer iteration
- id: "outer_loop"
  type: "iteration"
  data:
    start_node_id: "inner_loop"

# Inner loop (nested within iteration)
- id: "inner_loop"
  type: "loop"
  isInIteration: true
  iteration_id: "outer_loop"
  data:
    start_node_id: "worker_node"

# Worker node (nested within both)
- id: "worker_node"
  type: "llm"
  isInIteration: true
  iteration_id: "outer_loop"
  isInLoop: true
  loop_id: "inner_loop"
  data: {...}
```

#### Parallel Processing
Iterations support parallel execution:
```yaml
data:
  is_parallel: true
  parallel_nums: 5                     # Max concurrent executions
  error_handle_mode: "continue-on-error"  # Don't stop on single failure
```

This architecture provides flexibility while maintaining clear execution semantics and variable scoping rules.

### Variable Selectors

Variables are referenced using array notation:

```yaml
["node_id", "output_key"]           # Basic reference
["node_id", "output_key", "nested"] # Nested object access
["sys", "query"]                    # System variables
["env", "API_KEY"]                  # Environment variables  
["conversation", "user_id"]         # Conversation variables
```

### System Variables

Available system variables:

- `sys.query`: User input query
- `sys.files`: Uploaded files
- `sys.conversation_id`: Conversation ID
- `sys.user_id`: User identifier
- `sys.dialogue_count`: Message count
- `sys.app_id`: Application ID
- `sys.workflow_id`: Workflow ID
- `sys.workflow_execution_id`: Execution ID
- `sys.timestamp`: Current timestamp

### Variable Types

Supported data types:

- `string`: Text data
- `number`: Numeric values
- `boolean`: True/false
- `object`: JSON objects
- `array`: Lists of items
- `array[string]`: String arrays
- `array[number]`: Number arrays
- `array[object]`: Object arrays
- `array[boolean]`: Boolean arrays
- `file`: File uploads
- `array[file]`: Multiple files
- `any`: Any data type
- `array[any]`: Mixed arrays

## Error Handling

### Error Strategies

Configure how nodes handle errors:

```yaml
error_strategy: "fail-branch"       # Route through fail-branch edge
error_strategy: "default-value"     # Use predefined defaults
error_strategy: "continue-on-error" # Continue with null values
# error_strategy: null              # Abort execution (default)
```

### Default Values

Provide fallback values for failed nodes:

```yaml
default_value:
  - variable: "result"
    value: "No data available"
    type: "string"
  - variable: "status"
    value: "error"
    type: "string"
  - variable: "items"
    value: []
    type: "array"
```

### Retry Configuration

Configure automatic retries:

```yaml
retry_config:
  retry_enabled: true
  max_retries: 3
  retry_interval: 2000              # Milliseconds between retries
```

## Advanced Features

### Workflow Features

```yaml
features:
  file_upload:                      # File upload configuration
    image:
      enabled: true
      number_limits: 5
      transfer_methods: ["local_file", "remote_url"]
    document:
      enabled: true
      number_limits: 3
      transfer_methods: ["local_file"]
    audio:
      enabled: false
    video:
      enabled: false
      
  opening_statement: "Hello! How can I help you today?"
  
  suggested_questions:              # Pre-defined questions
    - "How do I reset my password?"
    - "What are your business hours?"
    - "How can I contact support?"
    
  suggested_questions_after_answer:
    enabled: true
    
  speech_to_text:
    enabled: false
    
  text_to_speech:
    enabled: false
    language: "en-US"
    voice: "female"
    
  retriever_resource:
    enabled: true
```

### Environment Variables

Global configuration variables:

```yaml
environment_variables:
  - id: "api_key"
    name: "API_KEY"
    value: "sk-..."
    value_type: "secret"            # string, number, secret
    
  - id: "base_url"
    name: "BASE_URL" 
    value: "https://api.company.com"
    value_type: "string"
    
  - id: "timeout"
    name: "REQUEST_TIMEOUT"
    value: "30"
    value_type: "number"
```

### Conversation Variables

Persistent conversation context:

```yaml
conversation_variables:
  - id: "user_tier"
    name: "user_tier"
    value_type: "string"
    description: "Customer service tier"
    
  - id: "session_data"
    name: "session_data"
    value_type: "object"
    description: "Session-specific data"
```

### Execution Configuration

Runtime behavior settings:

```yaml
execution_config:
  max_execution_time: 1200          # Maximum execution time (seconds)
  max_iteration_count: 100          # Maximum iterations per iteration node
  max_loop_count: 10               # Maximum loops per loop node
  parallel_limit: 10               # Maximum parallel executions
  error_continue: false            # Continue on non-critical errors
```

## Best Practices

### 1. Node Organization

- Use descriptive node IDs and titles
- Group related nodes with consistent positioning
- Add meaningful descriptions to complex nodes

### 2. Variable Management

- Use clear, descriptive variable names
- Minimize data copying between nodes
- Validate input variables in start nodes

### 3. Error Handling

- Always configure error strategies for critical paths
- Provide meaningful default values
- Use retry logic for external API calls

### 4. Performance

- Limit parallel execution to avoid resource exhaustion  
- Use iteration nodes for batch processing
- Implement proper timeouts for HTTP requests

### 5. Security

- Store sensitive data in environment variables
- Use secret-type variables for credentials
- Validate all external inputs

## Examples

### Example 1: Customer Support Chatbot

```yaml
version: "1.0"
kind: Workflow

metadata:
  name: "customer-support-bot"
  description: "Intelligent customer support with routing"

spec:
  graph:
    nodes:
      - id: "start"
        type: "start"
        data:
          title: "Customer Query"
          variables:
            - variable: "question"
              label: "How can we help you?"
              type: "paragraph"
              required: true

      - id: "classify"
        type: "question-classifier"
        data:
          title: "Route Query"
          query_variable_selector: ["start", "question"]
          model:
            provider: "openai"
            name: "gpt-4"
            mode: "chat"
          classes:
            - id: "billing"
              name: "Billing Question"
            - id: "technical"
              name: "Technical Support"  
            - id: "general"
              name: "General Inquiry"

      - id: "knowledge_search"
        type: "knowledge-retrieval"
        data:
          title: "Search Knowledge Base"
          query_variable_selector: ["start", "question"]
          dataset_ids: ["support-kb-001"]
          retrieval_mode: "multiple"
          multiple_retrieval_config:
            top_k: 3
            score_threshold: 0.7

      - id: "generate_response"
        type: "llm"
        data:
          title: "Generate Response"
          model:
            provider: "openai"
            name: "gpt-4"
            mode: "chat"
          prompt_template:
            - role: "system"
              text: |
                You are a helpful customer support agent. Use the knowledge base context to provide accurate answers.
                Be professional, empathetic, and concise.
            - role: "user"
              text: |
                Question: {{#start.question#}}
                Context: {{#knowledge_search.result#}}
          context:
            enabled: true
            variable_selector: ["knowledge_search", "result"]

      - id: "answer"
        type: "answer" 
        data:
          title: "Support Response"
          answer: "{{#generate_response.text#}}"

    edges:
      - source: "start"
        target: "classify"
      - source: "classify"
        target: "knowledge_search"
        sourceHandle: "technical"
        type: "condition"
      - source: "knowledge_search"
        target: "generate_response"
      - source: "generate_response"
        target: "answer"

  features:
    opening_statement: "Hello! I'm here to help with your questions."
    suggested_questions:
      - "How do I reset my password?"
      - "What are your pricing plans?"
      - "How can I cancel my subscription?"
```

### Example 2: Document Processing Pipeline

```yaml
version: "1.0"
kind: Workflow

metadata:
  name: "document-processor"
  description: "Process and analyze uploaded documents"

spec:
  graph:
    nodes:
      - id: "start"
        type: "start"
        data:
          title: "Upload Documents"
          variables:
            - variable: "documents"
              label: "Upload files to process"
              type: "files"
              required: true

      - id: "process_docs"
        type: "iteration"
        data:
          title: "Process Each Document"
          iterator_selector: ["start", "documents"]
          output_selector: ["extract", "content"]
          is_parallel: true
          parallel_nums: 3
          error_handle_mode: "continue-on-error"

      - id: "extract"
        type: "document-extractor"
        data:
          title: "Extract Text"
          variable_selector: ["iteration", "item"]

      - id: "summarize"
        type: "llm"
        data:
          title: "Summarize Content"
          model:
            provider: "openai"  
            name: "gpt-4"
            mode: "chat"
          prompt_template:
            - role: "user"
              text: "Please provide a concise summary of this document:\n\n{{#extract.content#}}"

      - id: "aggregate"
        type: "variable-aggregator"
        data:
          title: "Combine Results"
          variables:
            - variable: "summaries"
              value_selector: ["process_docs", "output"]

      - id: "final_report"
        type: "template-transform"
        data:
          title: "Generate Report"
          variables:
            - variable: "results"
              value_selector: ["aggregate", "summaries"]
          template: |
            # Document Processing Report
            
            Processed {{ results|length }} documents
            
            ## Summaries
            {% for summary in results %}
            ### Document {{ loop.index }}
            {{ summary }}
            
            {% endfor %}

      - id: "answer"
        type: "answer"
        data:
          title: "Processing Report"
          answer: "{{#final_report.result#}}"

    edges:
      - source: "start"
        target: "process_docs"
      - source: "process_docs"
        target: "aggregate"
      - source: "aggregate" 
        target: "final_report"
      - source: "final_report"
        target: "answer"

  execution_config:
    max_execution_time: 600
    max_iteration_count: 50
    parallel_limit: 5
```

## Validation and Tools

### Schema Validation

The workflow YAML can be validated against the JSON Schema definition. Tools like `ajv` (JavaScript) or `jsonschema` (Python) can validate workflows before execution.

### IDE Support

- **VS Code**: Use YAML extension with schema association
- **IntelliJ**: Built-in YAML support with schema validation
- **Vim/Neovim**: Use appropriate YAML plugins

### Schema Association

Add to your YAML file header:

```yaml
# yaml-language-server: $schema=./flowsh-workflow-schema.yaml
```

Or configure your IDE to associate `.flowsh.yaml` files with the schema.

## Migration and Compatibility

### Version Management

The schema supports versioning to handle future changes:

- `version: "1.0"`: Current schema version
- Backward compatibility maintained within major versions
- Migration guides provided for major version changes

### Export/Import

Workflows can be:
1. Exported from flowsh UI to YAML format
2. Version controlled in Git repositories  
3. Imported back into flowsh for execution
4. Shared between different flowsh instances

This comprehensive schema enables Infrastructure as Code (IaC) approaches for AI workflow management, supporting DevOps practices, version control, and automated deployment pipelines.