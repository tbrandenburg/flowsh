# flowsh Phase 2B: Enhanced Features Implementation

**Creation Date**: January 3, 2026  
**Implementation Phase**: Phase 2B - Enhanced Control Flow  
**Priority**: HIGH  
**Estimated Effort**: 3-4 weeks  
**Success Criteria**: Complete Phase 2 functionality with HTTP, aggregation, and templates

## Problem Statement

Following Phase 2A completion (Loop and Iteration nodes), flowsh needs the remaining Phase 2 capabilities to become a complete workflow automation platform: **Variable Aggregation** for result processing, **Template Transform** for advanced templating, and **HTTP Request Nodes** for external API integration.

**Current Gap Post-2A**:

- Cannot aggregate results from loops/iterations effectively
- Limited template processing capabilities
- No external API integration (major limitation)
- Sub-workflows not yet implemented

**Business Impact**:

- Users cannot build complete automation pipelines
- API integrations require manual shell scripting
- Complex data processing workflows impossible
- Cannot compete with tools like GitHub Actions, Zapier

## Success Criteria

### Primary Goals

1. **Variable Aggregation**: Collect, merge, and process results from iterations and loops
2. **Template Transform**: Advanced template processing with variable output
3. **HTTP Request Nodes**: Full REST API integration with authentication, retries, error handling
4. **Sub-Workflows**: Basic nested workflow execution with variable scoping
5. **Production Ready**: Comprehensive error handling, logging, and debugging support

### Quality Metrics

- ✅ All existing tests continue passing (including Phase 2A additions)
- ✅ Variable aggregation handles arrays, objects, and complex data structures
- ✅ HTTP requests work with major APIs (GitHub, OpenAI, REST services)
- ✅ Template transforms support complex variable substitution and formatting
- ✅ Sub-workflows maintain proper variable isolation
- ✅ Generated scripts remain clean and maintainable (&lt;150 lines typical)

## Technical Specification

### Architecture Decisions (Extending Phase 2A Patterns)

#### Variable Aggregation Strategy: Type-Aware Collection and Merge

```bash
# Generated Variable Aggregation Node Pattern
execute_aggregation_${node_id}() {
    log_step "📊 Variable Aggregation: ${node.data.title}"

    local -a input_vars=(${node.data.input_variables[@]})
    local output_var="${node.data.output_variable}"
    local method="${node.data.aggregation_method}"
    local separator="${node.data.separator:-$'\n'}"

    case "$method" in
        "concat")
            local -a values=()
            for var_name in "${input_vars[@]}"; do
                local value="$(get_workflow_var "$var_name" "")"
                [[ -n "$value" ]] && values+=("$value")
            done
            local result
            result=$(IFS="$separator"; echo "${values[*]}")
            set_workflow_var "$output_var" "$result"
            ;;

        "sum")
            local total=0
            for var_name in "${input_vars[@]}"; do
                local value="$(get_workflow_var "$var_name" "0")"
                if [[ "$value" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
                    total=$(echo "$total + $value" | bc -l)
                fi
            done
            set_workflow_var "$output_var" "$total"
            ;;

        "collect")
            local -a collected=()
            for var_name in "${input_vars[@]}"; do
                local value="$(get_workflow_var "$var_name" "")"
                [[ -n "$value" ]] && collected+=("$value")
            done
            # Store as JSON array for structured access
            local json_array
            json_array=$(printf '%s\n' "${collected[@]}" | jq -R . | jq -s .)
            set_workflow_var "$output_var" "$json_array"
            ;;

        "merge")
            # Merge objects/maps (assumes JSON input)
            local merged_json="{}"
            for var_name in "${input_vars[@]}"; do
                local value="$(get_workflow_var "$var_name" "{}")"
                if jq -e . >/dev/null 2>&1 <<< "$value"; then
                    merged_json=$(jq -s '.[0] * .[1]' <<< "$merged_json $value")
                fi
            done
            set_workflow_var "$output_var" "$merged_json"
            ;;
    esac

    log_success "Aggregated ${#input_vars[@]} variables into $output_var using $method"
}
```

#### HTTP Request Strategy: Full-Featured curl Integration

```bash
# Generated HTTP Request Node Pattern
execute_http_${node_id}() {
    log_step "🌐 HTTP Request: ${node.data.title}"

    local url="$(substitute_variables "${node.data.url}")"
    local method="${node.data.method:-GET}"
    local timeout="${node.data.timeout:-30}"
    local max_retries="${node.data.retries:-3}"

    # Prepare curl options with comprehensive configuration
    local curl_opts=(
        --max-time "$timeout"
        --retry "$max_retries"
        --retry-delay "${node.data.retry_delay:-2}"
        --retry-max-time $((timeout * max_retries))
        --fail-with-body
        --silent --show-error --location
        --write-out "%{http_code};%{time_total};%{size_download}"
    )

    # Add authentication
    case "${node.data.auth_type:-none}" in
        "bearer")
            local token="$(substitute_variables "${node.data.auth_token}")"
            curl_opts+=(-H "Authorization: Bearer $token")
            ;;
        "basic")
            local credentials="$(substitute_variables "${node.data.auth_credentials}")"
            curl_opts+=(-u "$credentials")
            ;;
        "api_key")
            local key_header="${node.data.auth_key_header:-X-API-Key}"
            local api_key="$(substitute_variables "${node.data.auth_api_key}")"
            curl_opts+=(-H "$key_header: $api_key")
            ;;
    esac

    # Add headers
    if [[ -n "${node.data.headers:-}" ]]; then
        while IFS=': ' read -r header_name header_value; do
            curl_opts+=(-H "$(substitute_variables "$header_name: $header_value")")
        done <<< "${node.data.headers}"
    fi

    # Add request body
    if [[ -n "${node.data.body:-}" ]]; then
        local body_content="$(substitute_variables "${node.data.body}")"
        curl_opts+=(-d "$body_content")

        # Set content type if not specified
        if [[ ! "${node.data.headers:-}" =~ Content-Type ]]; then
            case "${node.data.body_type:-json}" in
                "json") curl_opts+=(-H "Content-Type: application/json") ;;
                "form") curl_opts+=(-H "Content-Type: application/x-www-form-urlencoded") ;;
                "xml")  curl_opts+=(-H "Content-Type: application/xml") ;;
            esac
        fi
    fi

    # Execute request with comprehensive error handling
    local response_file=$(mktemp)
    local metrics_file=$(mktemp)

    if curl "${curl_opts[@]}" -X "$method" -o "$response_file" "$url" > "$metrics_file" 2>&1; then
        # Parse response and metrics
        local metrics=$(cat "$metrics_file")
        local http_code=$(echo "$metrics" | cut -d';' -f1)
        local time_total=$(echo "$metrics" | cut -d';' -f2)
        local size_download=$(echo "$metrics" | cut -d';' -f3)
        local response_body=$(cat "$response_file")

        # Set response variables
        set_workflow_var "http_status_code" "$http_code"
        set_workflow_var "http_response_body" "$response_body"
        set_workflow_var "http_response_time" "$time_total"
        set_workflow_var "http_response_size" "$size_download"

        # Handle success/error based on status code
        case "$http_code" in
            2*)
                log_success "HTTP $method $url completed successfully ($http_code)"
                set_workflow_var "http_success" "true"
                ;;
            4*|5*)
                log_error "HTTP $method $url failed with status $http_code"
                set_workflow_var "http_success" "false"

                case "${node.data.error_handling:-fail}" in
                    "ignore") log_info "Ignoring HTTP error as configured" ;;
                    "continue") log_warning "Continuing despite HTTP error" ;;
                    *)
                        cleanup_temp_files "$response_file" "$metrics_file"
                        return 1
                        ;;
                esac
                ;;
        esac
    else
        local curl_exit_code=$?
        log_error "HTTP request failed (curl exit code: $curl_exit_code)"
        set_workflow_var "http_success" "false"
        set_workflow_var "http_error_code" "$curl_exit_code"

        cleanup_temp_files "$response_file" "$metrics_file"
        return 1
    fi

    cleanup_temp_files "$response_file" "$metrics_file"
}
```

#### Template Transform Strategy: Advanced Variable Processing

```bash
# Generated Template Transform Node Pattern
execute_template_transform_${node_id}() {
    log_step "🔧 Template Transform: ${node.data.title}"

    local template_source="${node.data.template.source}"
    local template_id="${node.data.template.template_id:-}"
    local output_var="${node.data.output_variable}"

    # Resolve template content
    local template_content=""
    case "$template_source" in
        "inline")
            template_content="${node.data.template.content}"
            ;;
        "library")
            if ! template_content=$(resolve_template "$template_id" "library"); then
                log_error "Failed to resolve template '$template_id' from library"
                return 1
            fi
            ;;
        "file")
            local template_file="$(substitute_variables "${node.data.template.file_path}")"
            if [[ -f "$template_file" ]]; then
                template_content=$(cat "$template_file")
            else
                log_error "Template file not found: $template_file"
                return 1
            fi
            ;;
    esac

    # Apply template parameters (basic substitution + advanced functions)
    local rendered_content="$template_content"

    # Basic variable substitution
    while IFS='=' read -r param_name param_value; do
        local resolved_value="$(substitute_variables "$param_value")"
        rendered_content="${rendered_content//\{\{$param_name\}\}/$resolved_value}"
    done <<< "${node.data.template_parameters}"

    # Advanced template functions
    rendered_content=$(process_template_functions "$rendered_content")

    # Set output variable
    set_workflow_var "$output_var" "$rendered_content"

    log_success "Template transformed and stored in $output_var"
    log_debug "Template output length: ${#rendered_content} characters"
}

# Advanced template function processor
process_template_functions() {
    local content="$1"

    # {{#date}} -> current date
    content="${content//\{\{#date\}\}/$(date '+%Y-%m-%d')}"

    # {{#timestamp}} -> current timestamp
    content="${content//\{\{#timestamp\}\}/$(date '+%s')}"

    # {{#uuid}} -> generate UUID
    content="${content//\{\{#uuid\}\}/$(uuidgen 2>/dev/null || echo "uuid-$(date +%s)-$$")}"

    # {{#base64:variable}} -> base64 encode variable
    while [[ "$content" =~ \{\{#base64:([^}]+)\}\} ]]; do
        local var_name="${BASH_REMATCH[1]}"
        local var_value="$(get_workflow_var "$var_name" "")"
        local encoded_value="$(echo -n "$var_value" | base64 -w 0)"
        content="${content//\{\{#base64:$var_name\}\}/$encoded_value}"
    done

    echo "$content"
}
```

#### Sub-Workflow Strategy: Function-Based Execution with Variable Scoping

```bash
# Generated Sub-Workflow Node Pattern (Basic Implementation)
execute_subworkflow_${node_id}() {
    log_step "🏗️ Sub-Workflow: ${node.data.title}"

    local subworkflow_file="$(substitute_variables "${node.data.workflow_file}")"
    local -A subworkflow_inputs=()
    local -A subworkflow_outputs=()

    # Prepare input variables for sub-workflow
    while IFS='=' read -r input_name input_source; do
        local input_value="$(get_workflow_var "$input_source" "")"
        subworkflow_inputs["$input_name"]="$input_value"
    done <<< "${node.data.input_mappings}"

    # Execute sub-workflow in isolated context
    (
        # Override variable functions for sub-workflow scope
        declare -A workflow_vars=()

        # Initialize with input variables
        for input_name in "${!subworkflow_inputs[@]}"; do
            workflow_vars["$input_name"]="${subworkflow_inputs[$input_name]}"
        done

        get_workflow_var() {
            echo "${workflow_vars[$1]:-$2}"
        }

        set_workflow_var() {
            workflow_vars["$1"]="$2"
        }

        # Parse and execute sub-workflow
        log_info "Executing sub-workflow: $subworkflow_file"

        # This would require flowsh to parse and execute the sub-workflow
        # For Phase 2B, we implement this as a simplified version
        # Full implementation would require recursive workflow parsing

        # Placeholder for sub-workflow execution
        log_warning "Sub-workflow execution not fully implemented - placeholder"

        # Set mock outputs for testing
        workflow_vars["subworkflow_result"]="success"
        workflow_vars["subworkflow_status"]="completed"

        # Export outputs back to parent scope
        for output_name in "${!workflow_vars[@]}"; do
            echo "$output_name=${workflow_vars[$output_name]}"
        done
    ) > /tmp/subworkflow_outputs_$$

    # Read outputs back into parent scope
    while IFS='=' read -r output_name output_value; do
        local parent_var_name="$(echo "${node.data.output_mappings}" | grep "$output_name" | cut -d'=' -f2)"
        [[ -n "$parent_var_name" ]] && set_workflow_var "$parent_var_name" "$output_value"
    done < /tmp/subworkflow_outputs_$$

    rm -f /tmp/subworkflow_outputs_$$

    log_success "Sub-workflow completed"
}
```

### Implementation Components

#### 1. Variable Aggregation Generator (`src/generation/generators/variable-aggregation-node.ts`)

- Support for concat, sum, avg, merge, collect methods
- Type-aware processing (numbers, strings, JSON objects)
- Integration with jq for JSON manipulation
- Proper error handling for type mismatches

#### 2. HTTP Request Generator (`src/generation/generators/http-request-node.ts`)

- Full curl integration with all major options
- Authentication support (Bearer, Basic, API Key)
- Comprehensive error handling and retry logic
- Response parsing and variable assignment
- Configurable timeout and error handling strategies

#### 3. Template Transform Generator (`src/generation/generators/template-transform-node.ts`)

- Template resolution from multiple sources (inline, library, file)
- Advanced template functions (date, uuid, base64, etc.)
- Parameter substitution and variable processing
- Integration with existing template system

#### 4. Sub-Workflow Generator (`src/generation/generators/sub-workflow-node.ts`)

- Basic sub-workflow execution framework
- Variable scoping and input/output mapping
- Isolated execution context
- Foundation for full recursive workflow support

#### 5. Enhanced Template Engine (`src/generation/template-engine/advanced-functions.ts`)

- Template function library (date, uuid, encoding, etc.)
- Variable transformation utilities
- Template validation and error handling

### Testing Strategy

#### Unit Tests

```typescript
describe('VariableAggregationNodeGenerator', () => {
  it('should concatenate string values', () => {
    const generator = new VariableAggregationNodeGenerator();
    // Test concat method with various separators
  });

  it('should sum numeric values', () => {
    // Test sum method with integer and float handling
  });

  it('should collect values into JSON array', () => {
    // Test collect method with proper JSON formatting
  });
});

describe('HttpRequestNodeGenerator', () => {
  it('should generate GET request with auth headers', () => {
    // Test authentication header generation
  });

  it('should handle POST with JSON body', () => {
    // Test request body and content-type handling
  });

  it('should include retry logic', () => {
    // Test retry configuration in generated script
  });
});
```

#### Integration Tests

```typescript
describe('Phase 2B Workflows', () => {
  it('should process API data with aggregation', async () => {
    // End-to-end test: HTTP request → iteration → aggregation
  });

  it('should transform templates with complex variables', async () => {
    // Test template transformation with various functions
  });

  it('should execute basic sub-workflow', async () => {
    // Test sub-workflow isolation and variable passing
  });
});
```

## Implementation Plan

### Phase 1: Data Processing (Week 1)

1. **Variable Aggregation Generator**: Implement all aggregation methods
2. **Enhanced Template Functions**: Advanced template processing capabilities
3. **Testing**: Unit tests for aggregation and template functionality
4. **Integration**: Register generators in default registry

### Phase 2: External Integration (Week 2-3)

1. **HTTP Request Generator**: Full curl integration with authentication
2. **Error Handling**: Comprehensive retry and failure handling
3. **Response Processing**: JSON parsing and variable assignment
4. **Integration Testing**: Real API integration tests

### Phase 3: Advanced Features (Week 4)

1. **Template Transform Generator**: Complete template processing system
2. **Basic Sub-Workflow Support**: Foundation for nested workflows
3. **Performance Optimization**: Large data handling and memory management
4. **Documentation**: Examples, CLI validation, and user guides

## Example Workflows

### API Integration Example (`examples/github-api-workflow.yaml`)

```yaml
workflow:
  name: 'GitHub API Integration'
  description: 'Fetch repository data and process results'

graph:
  nodes:
    - id: 'fetch_repos'
      type: 'http-request'
      data:
        title: 'Get User Repositories'
        url: 'https://api.github.com/users/{{github_username}}/repos'
        method: 'GET'
        headers: 'Authorization: token {{github_token}}'
        timeout: 30
        retries: 3

    - id: 'process_repos'
      type: 'iteration'
      data:
        title: 'Process Each Repository'
        input_variable: 'http_response_body'
        output_variable: 'processed_repos'

    - id: 'aggregate_results'
      type: 'variable-aggregation'
      data:
        title: 'Aggregate Repository Data'
        input_variables: ['processed_repos']
        output_variable: 'repo_summary'
        aggregation_method: 'collect'
```

### Template Processing Example (`examples/report-generation.yaml`)

```yaml
workflow:
  name: 'Report Generation'
  description: 'Generate formatted reports from data'

graph:
  nodes:
    - id: 'generate_report'
      type: 'template-transform'
      data:
        title: 'Generate HTML Report'
        template:
          source: 'inline'
          content: |
            <html>
              <h1>Daily Report - {{#date}}</h1>
              <p>Total Processed: {{total_count}}</p>
              <p>Success Rate: {{success_rate}}%</p>
              <p>Report ID: {{#uuid}}</p>
            </html>
        template_parameters:
          total_count: '{{aggregated_count}}'
          success_rate: '{{calculated_success_rate}}'
        output_variable: 'html_report'
```

## Success Metrics & Validation

### Functional Validation

- [ ] Variable aggregation correctly processes different data types
- [ ] HTTP requests work with major APIs (GitHub, OpenAI, REST services)
- [ ] Template transforms handle complex variable substitution
- [ ] Sub-workflows maintain proper variable isolation
- [ ] Error handling prevents failures and provides useful feedback

### Performance Validation

- [ ] HTTP requests handle large responses efficiently
- [ ] Variable aggregation processes arrays with 1000+ items
- [ ] Template transforms handle large template files
- [ ] Memory usage remains reasonable for complex workflows

### Integration Validation

- [ ] All Phase 2A functionality continues working
- [ ] New nodes integrate seamlessly with existing generators
- [ ] Generated scripts maintain clean, readable structure
- [ ] CLI validation supports all new node types

This PRP completes Phase 2 functionality, transforming flowsh into a comprehensive workflow automation platform capable of external API integration, advanced data processing, and complex template manipulation.
