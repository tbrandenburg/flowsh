/**
 * LLM Node Generator
 *
 * Generates shell functions for LLM (Large Language Model) nodes.
 * Supports OpenAI, Anthropic, and local LLM providers with prompt templates,
 * streaming responses, rate limiting, and comprehensive error handling.
 */

import {
  BaseNodeGenerator,
  ValidationResult,
  TemplateReference,
  RetryConfig,
} from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

interface LLMNodeConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  model: string;
  prompt: string | TemplateReference;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryPolicy?: RetryConfig;
}

export class LLMNodeGenerator extends BaseNodeGenerator {
  /**
   * Validates an LLM node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const commonResult = this.validateCommonNode(node);
    if (!commonResult.isValid) {
      return commonResult;
    }

    const errors: string[] = [...commonResult.errors];
    const warnings: string[] = [...commonResult.warnings];

    const data = node.data as any;

    // Check for model configuration
    if (!data.model) {
      warnings.push(`LLM node ${node.id}: No model specified, will use default 'gpt-4'`);
    } else {
      if (!data.model.name) {
        warnings.push(`LLM node ${node.id}: No model name specified, will use 'gpt-4'`);
      }
      if (!data.model.provider) {
        warnings.push(`LLM node ${node.id}: No provider specified, will use 'openai'`);
      }
    }

    // Check for prompt configuration
    if (!data.prompt_template && !data.prompt) {
      warnings.push(`LLM node ${node.id}: No prompt template or direct prompt specified`);
    }

    // Validate prompt template if present
    if (data.prompt_template) {
      if (!data.prompt_template.template_id) {
        errors.push(`LLM node ${node.id}: prompt_template specified but no template_id provided`);
      }
      if (!data.prompt_template.source) {
        warnings.push(`LLM node ${node.id}: No template source specified, will use 'library'`);
      }
    }

    // Validate provider-specific requirements
    const provider = data.model?.provider || 'openai';
    if (provider === 'openai' && !data.api_key && !process.env['OPENAI_API_KEY']) {
      warnings.push(`LLM node ${node.id}: OpenAI API key not configured`);
    }
    if (provider === 'anthropic' && !data.api_key && !process.env['ANTHROPIC_API_KEY']) {
      warnings.push(`LLM node ${node.id}: Anthropic API key not configured`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates shell function for an LLM node
   */
  generateShell(node: WorkflowNode, functionName: string): string {
    const config = this.validateAndExtractConfig(node.data);
    const nodeId = this.sanitizeShellIdentifier(node.id);

    return `# LLM Node: ${node.id}
${functionName}() {
    local input_data="$1"
    local correlation_id="$2"
    
    log_operation_start "${nodeId}" "llm_execution" "$correlation_id"
    
    # Configure LLM settings
    local model_name="${config.model}"
    local provider="${config.provider}"
    local temperature="${config.temperature || 0.7}"
    local max_tokens="${config.maxTokens || 1000}"
    local timeout_val="${config.timeout || 120}"
    
    ${this.generateTempFileCreation('llm', nodeId)}
    
    # Resolve and prepare prompt
    local prompt=""
    ${this.generatePromptResolution(config.prompt)}
    
    # Prepare API configuration
    ${this.generateAPIConfiguration(config)}
    
    # Execute LLM API call with retry logic
    local response
    local exit_code
    
    if [[ "\$USE_MOCK_TOOLS" == "true" ]]; then
        ${this.generateMockLLMExecution(node.id)}
    else
        ${
          config.retryPolicy
            ? this.generateRetryLogic(config.retryPolicy, 'call_llm_api')
            : 'call_llm_api'
        }
    fi
    
    ${this.generateErrorHandling(nodeId, 'LLM execution')}
    
    # Process successful execution
    if [ $exit_code -eq 0 ]; then
        response=$(cat "$output_file" 2>/dev/null || echo "")
        log_success "$correlation_id" "LLM execution completed" "{\\"response_length\\": \${#response}}"
        
        # Store response for downstream nodes
        set_workflow_var "llm_response" "$response"
        set_workflow_var "${nodeId}_response" "$response"
        
        ${this.generateOutputProcessing(node.data)}
        
        echo "$response"
    fi
    
    ${this.generateTempFileCleanup()}
    
    set_workflow_state "current_node" "${node.id}"
    return $exit_code
}

# LLM API call function
call_llm_api() {
    log_debug "$correlation_id" "Calling \$provider API with model \$model_name"
    
    case "\$provider" in
        "openai")
            ${this.generateOpenAICall()}
            ;;
        "anthropic")
            ${this.generateAnthropicCall()}
            ;;
        "local")
            ${this.generateLocalLLMCall()}
            ;;
        *)
            ${this.generateCustomAPICall()}
            ;;
    esac
}`;
  }

  private validateAndExtractConfig(data: any): LLMNodeConfig {
    return {
      provider: (data.model?.provider || data.provider || 'openai') as
        | 'openai'
        | 'anthropic'
        | 'local'
        | 'custom',
      model: data.model?.name || data.model || 'gpt-4',
      prompt: data.prompt_template || data.prompt || 'Default LLM prompt',
      temperature: data.model?.temperature || data.temperature || 0.7,
      maxTokens: data.model?.max_tokens || data.maxTokens || 1000,
      streaming: data.model?.streaming || data.streaming || false,
      apiKey: data.api_key,
      endpoint: data.endpoint,
      timeout: data.timeout || 120,
      retryPolicy: data.retryPolicy,
    };
  }

  private generatePromptResolution(prompt: string | TemplateReference): string {
    if (typeof prompt === 'string') {
      return `prompt="${this.resolveVariables(prompt)}"`;
    }

    return `
    # Resolve external template
    local template_content
    if ! template_content=$(resolve_template "${prompt.templateId}" "${prompt.source || 'library'}"); then
        log_error "$correlation_id" "Failed to resolve template" "{\\"templateId\\": \\"${prompt.templateId}\\"}"
        return 1
    fi
    
    # Render template with variables
    if ! prompt=$(render_template "$template_content" "$(get_workflow_var 'task_description' '')"); then
        log_error "$correlation_id" "Failed to render template"
        return 1
    fi`;
  }

  private generateAPIConfiguration(config: LLMNodeConfig): string {
    const configurations = [];

    // API Key configuration
    if (config.apiKey) {
      configurations.push(`local api_key="${config.apiKey}"`);
    } else {
      switch (config.provider) {
        case 'openai':
          configurations.push('local api_key="${OPENAI_API_KEY:-}"');
          break;
        case 'anthropic':
          configurations.push('local api_key="${ANTHROPIC_API_KEY:-}"');
          break;
        case 'local':
          configurations.push('local api_key=""  # No API key needed for local');
          break;
        default:
          configurations.push('local api_key="${LLM_API_KEY:-}"');
      }
    }

    // Endpoint configuration
    if (config.endpoint) {
      configurations.push(`local endpoint="${config.endpoint}"`);
    } else {
      switch (config.provider) {
        case 'openai':
          configurations.push('local endpoint="${OPENAI_API_ENDPOINT:-https://api.openai.com/v1}"');
          break;
        case 'anthropic':
          configurations.push(
            'local endpoint="${ANTHROPIC_API_ENDPOINT:-https://api.anthropic.com/v1}"'
          );
          break;
        case 'local':
          configurations.push('local endpoint="${LOCAL_LLM_ENDPOINT:-http://localhost:8080}"');
          break;
        default:
          configurations.push('local endpoint="${CUSTOM_LLM_ENDPOINT:-}"');
      }
    }

    // Validation
    configurations.push(`
    # Validate API configuration
    if [ "\$provider" != "local" ] && [ -z "\$api_key" ]; then
        log_error "$correlation_id" "API key not configured for provider: \$provider"
        return 1
    fi
    
    if [ -z "\$endpoint" ]; then
        log_error "$correlation_id" "API endpoint not configured for provider: \$provider"
        return 1
    fi`);

    return configurations.join('\n    ');
  }

  private generateOpenAICall(): string {
    return `
            log_debug "$correlation_id" "Making OpenAI API call to \$endpoint"
            
            # Prepare JSON payload
            local json_payload
            json_payload=$(cat <<EOF
{
    "model": "\$model_name",
    "messages": [{"role": "user", "content": "\$prompt"}],
    "temperature": \$temperature,
    "max_tokens": \$max_tokens
}
EOF
)
            
            # Make API call
            if curl -s -w "\\n%{http_code}" \\
                -X POST "\$endpoint/chat/completions" \\
                -H "Authorization: Bearer \$api_key" \\
                -H "Content-Type: application/json" \\
                -d "\$json_payload" \\
                --max-time \$timeout_val > "$temp_file" 2> "$error_file"; then
                
                # Extract HTTP status code and response
                local http_code
                http_code=$(tail -n1 "$temp_file")
                local response_body
                response_body=$(head -n -1 "$temp_file")
                
                if [ "\$http_code" -eq 200 ]; then
                    # Extract content from OpenAI response
                    if command -v jq >/dev/null 2>&1; then
                        echo "\$response_body" | jq -r '.choices[0].message.content // "No content"' > "$output_file"
                    else
                        # Fallback parsing without jq
                        echo "\$response_body" | sed -n 's/.*"content":"\\([^"]*\\)".*/\\1/p' > "$output_file"
                    fi
                    exit_code=0
                else
                    log_error "$correlation_id" "OpenAI API error" "{\\"http_code\\": \$http_code, \\"response\\": \\"\$response_body\\"}"
                    exit_code=1
                fi
            else
                exit_code=$?
                local error_msg
                error_msg=$(cat "$error_file" 2>/dev/null || echo "Unknown error")
                log_error "$correlation_id" "OpenAI API call failed" "{\\"error\\": \\"\$error_msg\\"}"
            fi`;
  }

  private generateAnthropicCall(): string {
    return `
            log_debug "$correlation_id" "Making Anthropic API call to \$endpoint"
            
            # Prepare JSON payload for Claude
            local json_payload
            json_payload=$(cat <<EOF
{
    "model": "\$model_name",
    "max_tokens": \$max_tokens,
    "temperature": \$temperature,
    "messages": [{"role": "user", "content": "\$prompt"}]
}
EOF
)
            
            # Make API call
            if curl -s -w "\\n%{http_code}" \\
                -X POST "\$endpoint/messages" \\
                -H "x-api-key: \$api_key" \\
                -H "Content-Type: application/json" \\
                -H "anthropic-version: 2023-06-01" \\
                -d "\$json_payload" \\
                --max-time \$timeout_val > "$temp_file" 2> "$error_file"; then
                
                # Extract HTTP status code and response
                local http_code
                http_code=$(tail -n1 "$temp_file")
                local response_body
                response_body=$(head -n -1 "$temp_file")
                
                if [ "\$http_code" -eq 200 ]; then
                    # Extract content from Anthropic response
                    if command -v jq >/dev/null 2>&1; then
                        echo "\$response_body" | jq -r '.content[0].text // "No content"' > "$output_file"
                    else
                        # Fallback parsing without jq
                        echo "\$response_body" | sed -n 's/.*"text":"\\([^"]*\\)".*/\\1/p' > "$output_file"
                    fi
                    exit_code=0
                else
                    log_error "$correlation_id" "Anthropic API error" "{\\"http_code\\": \$http_code, \\"response\\": \\"\$response_body\\"}"
                    exit_code=1
                fi
            else
                exit_code=$?
                local error_msg
                error_msg=$(cat "$error_file" 2>/dev/null || echo "Unknown error")
                log_error "$correlation_id" "Anthropic API call failed" "{\\"error\\": \\"\$error_msg\\"}"
            fi`;
  }

  private generateLocalLLMCall(): string {
    return `
            log_debug "$correlation_id" "Making local LLM API call to \$endpoint"
            
            # Prepare JSON payload for local LLM (OpenAI-compatible)
            local json_payload
            json_payload=$(cat <<EOF
{
    "model": "\$model_name",
    "prompt": "\$prompt",
    "temperature": \$temperature,
    "max_tokens": \$max_tokens,
    "stream": false
}
EOF
)
            
            # Make API call to local endpoint
            if curl -s -w "\\n%{http_code}" \\
                -X POST "\$endpoint/v1/completions" \\
                -H "Content-Type: application/json" \\
                -d "\$json_payload" \\
                --max-time \$timeout_val > "$temp_file" 2> "$error_file"; then
                
                # Extract HTTP status code and response
                local http_code
                http_code=$(tail -n1 "$temp_file")
                local response_body
                response_body=$(head -n -1 "$temp_file")
                
                if [ "\$http_code" -eq 200 ]; then
                    # Extract content from local LLM response
                    if command -v jq >/dev/null 2>&1; then
                        echo "\$response_body" | jq -r '.choices[0].text // "No content"' > "$output_file"
                    else
                        # Fallback parsing without jq
                        echo "\$response_body" | sed -n 's/.*"text":"\\([^"]*\\)".*/\\1/p' > "$output_file"
                    fi
                    exit_code=0
                else
                    log_error "$correlation_id" "Local LLM API error" "{\\"http_code\\": \$http_code, \\"response\\": \\"\$response_body\\"}"
                    exit_code=1
                fi
            else
                exit_code=$?
                local error_msg
                error_msg=$(cat "$error_file" 2>/dev/null || echo "Unknown error")
                log_error "$correlation_id" "Local LLM API call failed" "{\\"error\\": \\"\$error_msg\\"}"
            fi`;
  }

  private generateCustomAPICall(): string {
    return `
            log_debug "$correlation_id" "Making custom LLM API call to \$endpoint"
            
            # For custom endpoints, use a generic approach
            local json_payload
            json_payload=$(cat <<EOF
{
    "prompt": "\$prompt",
    "model": "\$model_name",
    "temperature": \$temperature,
    "max_tokens": \$max_tokens
}
EOF
)
            
            # Make generic API call
            if curl -s -w "\\n%{http_code}" \\
                -X POST "\$endpoint" \\
                -H "Authorization: Bearer \$api_key" \\
                -H "Content-Type: application/json" \\
                -d "\$json_payload" \\
                --max-time \$timeout_val > "$temp_file" 2> "$error_file"; then
                
                local http_code
                http_code=$(tail -n1 "$temp_file")
                local response_body
                response_body=$(head -n -1 "$temp_file")
                
                if [ "\$http_code" -eq 200 ]; then
                    # For custom APIs, just use the response body directly
                    echo "\$response_body" > "$output_file"
                    exit_code=0
                else
                    log_error "$correlation_id" "Custom LLM API error" "{\\"http_code\\": \$http_code, \\"response\\": \\"\$response_body\\"}"
                    exit_code=1
                fi
            else
                exit_code=$?
                local error_msg
                error_msg=$(cat "$error_file" 2>/dev/null || echo "Unknown error")
                log_error "$correlation_id" "Custom LLM API call failed" "{\\"error\\": \\"\$error_msg\\"}"
            fi`;
  }

  private generateMockLLMExecution(nodeId: string): string {
    return `
        log_debug "$correlation_id" "Using mock LLM execution"
        local mock_response="Mock LLM response from ${nodeId} for prompt: \$prompt"
        
        # Simulate processing time
        sleep 1
        
        echo "\$mock_response" > "$output_file"
        exit_code=0
        
        log_debug "$correlation_id" "Mock LLM completed successfully"`;
  }

  private generateOutputProcessing(data: any): string {
    const outputs = data.outputs || {};

    if (Object.keys(outputs).length === 0) {
      return '# No output mappings to process';
    }

    const outputProcessing = Object.entries(outputs)
      .map(([key, mapping]: [string, any]) => {
        if (typeof mapping === 'string') {
          // Direct variable reference
          return `        set_workflow_var "${key}" "$(get_workflow_var "${mapping}" "")"`;
        } else if (mapping?.source === 'llm_response') {
          // LLM response reference
          return `        set_workflow_var "${key}" "$response"`;
        } else if (mapping?.transform) {
          // Apply transformation (basic string operations)
          return `        set_workflow_var "${key}" "$(echo "$response" | ${mapping.transform})"`;
        } else {
          // Default/fallback value
          return `        set_workflow_var "${key}" "${mapping?.default || ''}"`;
        }
      })
      .join('\n');

    return `# Process LLM outputs\n${outputProcessing}`;
  }
}
