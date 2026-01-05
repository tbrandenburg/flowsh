/**
 * HTTP Request Node Generator
 *
 * Generates shell script code for HTTP requests with comprehensive
 * authentication, retry logic, and error handling
 */

import { WorkflowNode, HttpRequestNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class HttpRequestNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'http-request';

  private processConfigValue(value: any, defaultValue: any, nodeId: string): string {
    if (value === undefined || value === null) {
      return defaultValue.toString();
    }

    if (typeof value === 'string') {
      // Check if it's a template variable like "${request_timeout}"
      if (value.includes('${') || value.includes('{{')) {
        // Process template variables to generate shell variable access
        return `$(echo "${this.processTemplateVariables(value, nodeId)}" | bc -l 2>/dev/null || echo "${defaultValue}")`;
      }
      // If it's a plain string that looks like a number, return it
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return Math.floor(numValue).toString();
      }
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return defaultValue.toString();
  }

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as HttpRequestNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_http_${nodeId}`;

    // Extract configuration with defaults - handle template variables
    const url = data.url || '';
    const method = data.method || 'GET';
    const timeout = this.processConfigValue(data.timeout, 30, node.id);
    const maxRetries = this.processConfigValue(data.retries, 3, node.id);
    const retryDelay = this.processConfigValue(data.retry_delay, 2, node.id);
    const errorHandling = data.error_handling || 'fail';
    const title = data.title || node.id;

    // Process headers into curl-friendly format
    const headersCode = this.generateHeadersCode(data.headers, node.id);
    const authCode = this.generateAuthCode(data, node.id);
    const bodyCode = this.generateBodyCode(data, node.id);

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🌐 HTTP Request: ${this.escapeShellValue(title)}"

    local url="${this.processTemplateVariables(url, node.id)}"
    local method="${method}"
    local timeout=${timeout}
    local max_retries=${maxRetries}
    local retry_delay=${retryDelay}
    local error_handling="${errorHandling}"

    # Validate URL is not empty
    if [[ -z "$url" ]]; then
        log_error "HTTP request URL is empty"
        return 1
    fi

    log_debug "Making $method request to: $url"
    
    # Prepare curl options with comprehensive configuration
    local curl_opts=(
        --max-time "$timeout"
        --retry "$max_retries" 
        --retry-delay "$retry_delay"
        --retry-max-time $((timeout * max_retries))
        --fail-with-body
        --silent --show-error --location
        --write-out "%{http_code};%{time_total};%{size_download};%{url_effective}"
    )

${authCode}

${headersCode}

${bodyCode}

    # Execute request with comprehensive error handling
    local response_file=$(mktemp)
    local metrics_file=$(mktemp)
    local stderr_file=$(mktemp)

    log_debug "Executing curl with options: \${curl_opts[*]}"
    
    if curl "\${curl_opts[@]}" -X "$method" -o "$response_file" "$url" >"$metrics_file" 2>"$stderr_file"; then
        # Parse response and metrics
        local metrics=$(cat "$metrics_file" 2>/dev/null)
        local curl_stderr=$(cat "$stderr_file" 2>/dev/null)
        
        if [[ -n "$metrics" && "$metrics" =~ ^([0-9]{3})\\;([0-9.]+)\\;([0-9]+)\\;(.*)$ ]]; then
            local http_code="\${BASH_REMATCH[1]}"
            local time_total="\${BASH_REMATCH[2]}"
            local size_download="\${BASH_REMATCH[3]}"
            local effective_url="\${BASH_REMATCH[4]}"
            
            local response_body=$(cat "$response_file" 2>/dev/null)

            # Set response variables
            set_workflow_var "http_status_code" "$http_code"
            set_workflow_var "http_response_body" "$response_body"
            set_workflow_var "http_response_time" "$time_total"
            set_workflow_var "http_response_size" "$size_download"
            set_workflow_var "http_effective_url" "$effective_url"
            set_workflow_var "http_request_method" "$method"

            # Handle success/error based on status code
            case "$http_code" in
                2*)
                    log_success "HTTP $method completed successfully (status: $http_code, time: \${time_total}s, size: \${size_download} bytes)"
                    set_workflow_var "http_success" "true"
                    set_workflow_var "http_error" ""
                    ;;
                3*)
                    log_info "HTTP $method returned redirect (status: $http_code)"
                    set_workflow_var "http_success" "true"
                    set_workflow_var "http_error" ""
                    ;;
                4*|5*)
                    log_error "HTTP $method failed with status $http_code"
                    set_workflow_var "http_success" "false"
                    set_workflow_var "http_error" "HTTP_\${http_code}"

                    case "$error_handling" in
                        "ignore") 
                            log_info "Ignoring HTTP error as configured"
                            ;;
                        "continue") 
                            log_warning "Continuing despite HTTP error"
                            ;;
                        *)
                            cleanup_temp_files "$response_file" "$metrics_file" "$stderr_file"
                            return 1
                            ;;
                    esac
                    ;;
            esac
        else
            log_error "Failed to parse curl metrics: $metrics"
            set_workflow_var "http_success" "false"
            set_workflow_var "http_error" "PARSE_ERROR"
            cleanup_temp_files "$response_file" "$metrics_file" "$stderr_file"
            return 1
        fi
    else
        local curl_exit_code=$?
        local curl_stderr=$(cat "$stderr_file" 2>/dev/null)
        
        log_error "HTTP request failed (curl exit code: $curl_exit_code)"
        [[ -n "$curl_stderr" ]] && log_error "Curl error: $curl_stderr"
        
        set_workflow_var "http_success" "false"
        set_workflow_var "http_error" "CURL_\${curl_exit_code}"
        set_workflow_var "http_status_code" "0"
        set_workflow_var "http_response_body" ""

        case "$error_handling" in
            "ignore")
                log_info "Ignoring curl error as configured"
                ;;
            "continue")
                log_warning "Continuing despite curl error"
                ;;
            *)
                cleanup_temp_files "$response_file" "$metrics_file" "$stderr_file"
                return 1
                ;;
        esac
    fi

    cleanup_temp_files "$response_file" "$metrics_file" "$stderr_file"
    
    log_debug "HTTP request completed, check http_success variable for result"
}`;
  }

  private generateAuthCode(data: HttpRequestNodeData, nodeId: string): string {
    const authType = data.auth_type || 'none';

    switch (authType) {
      case 'bearer':
        return `    # Bearer token authentication
    if [[ -n "${data.auth_token || ''}" ]]; then
        local token="${this.processTemplateVariables(data.auth_token || '', nodeId)}"
        if [[ -n "$token" ]]; then
            curl_opts+=(-H "Authorization: Bearer $token")
            log_debug "Added Bearer authorization header"
        else
            log_warning "Bearer token is empty"
        fi
    fi`;

      case 'basic':
        return `    # Basic authentication
    if [[ -n "${data.auth_credentials || ''}" ]]; then
        local credentials="${this.processTemplateVariables(data.auth_credentials || '', nodeId)}"
        if [[ -n "$credentials" ]]; then
            curl_opts+=(-u "$credentials")
            log_debug "Added Basic authentication credentials"
        else
            log_warning "Basic auth credentials are empty"
        fi
    fi`;

      case 'api_key':
        const keyHeader = data.auth_key_header || 'X-API-Key';
        return `    # API Key authentication
    if [[ -n "${data.auth_api_key || ''}" ]]; then
        local api_key="${this.processTemplateVariables(data.auth_api_key || '', nodeId)}"
        local key_header="${keyHeader}"
        if [[ -n "$api_key" ]]; then
            curl_opts+=(-H "$key_header: $api_key")
            log_debug "Added API key header: $key_header"
        else
            log_warning "API key is empty"
        fi
    fi`;

      default:
        return '    # No authentication configured';
    }
  }

  private generateHeadersCode(headers?: string, nodeId?: string): string {
    if (!headers || headers.trim() === '') {
      return '    # No custom headers configured';
    }

    return `    # Add custom headers
    while IFS=': ' read -r header_name header_value || [[ -n "$header_name" ]]; do
        # Skip empty lines and comments
        [[ -z "$header_name" || "$header_name" =~ ^[[:space:]]*# ]] && continue
        
        # Process template variables in header value
        local processed_value="${this.processTemplateVariables('$header_value', nodeId || 'template_node')}"
        curl_opts+=(-H "$header_name: $processed_value")
        log_debug "Added header: $header_name"
    done <<'EOF'
${headers}
EOF`;
  }

  private generateBodyCode(data: HttpRequestNodeData, nodeId: string): string {
    if (!data.body || data.body.trim() === '') {
      return '    # No request body configured';
    }

    const bodyType = data.body_type || 'json';
    const contentType = this.getContentType(bodyType);

    // Process template variables first, then escape for shell
    const processedBody = this.processTemplateVariables(data.body, nodeId);
    const escapedBody = this.escapeForShellVariable(processedBody);

    return `    # Add request body
    local body_content="${escapedBody}"
    
    if [[ -n "$body_content" ]]; then
        curl_opts+=(-d "$body_content")
        
        # Set content type if not already specified in headers
        local content_type_set=false
        for opt in "\${curl_opts[@]}"; do
            if [[ "$opt" == *"Content-Type"* ]]; then
                content_type_set=true
                break
            fi
        done
        
        if [[ "$content_type_set" == "false" ]]; then
            curl_opts+=(-H "Content-Type: ${contentType}")
            log_debug "Set Content-Type: ${contentType}"
        fi
        
        log_debug "Request body length: \${#body_content} characters"
    fi`;
  }

  private escapeForShellVariable(content: string): string {
    return (
      content
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/`/g, '\\`') // Escape backticks
        // DON'T escape $ since we need $(get_var ...) to work
        .replace(/\n/g, '\\n')
    ); // Escape newlines
  }

  private getContentType(bodyType: string): string {
    switch (bodyType) {
      case 'json':
        return 'application/json';
      case 'form':
        return 'application/x-www-form-urlencoded';
      case 'xml':
        return 'application/xml';
      case 'text':
        return 'text/plain';
      default:
        return 'application/json';
    }
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as HttpRequestNodeData;

    // HTTP request specific validation
    if (!data.url) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_URL',
        message: 'HTTP request node must specify a URL',
        nodeId: node.id,
      });
    }

    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (data.method && !validMethods.includes(data.method)) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_METHOD',
        message: `Invalid HTTP method "${data.method}". Must be one of: ${validMethods.join(', ')}`,
        nodeId: node.id,
      });
    }

    // Validate timeout
    if (data.timeout !== undefined) {
      if (data.timeout < 1) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_TIMEOUT',
          message: 'Timeout must be a positive number',
          nodeId: node.id,
        });
      } else if (data.timeout > 600) {
        result.warnings.push({
          type: 'warning',
          code: 'HIGH_TIMEOUT',
          message: 'Timeout is very high (>600s), consider if this is intentional',
          nodeId: node.id,
        });
      }
    }

    // Validate retries
    if (data.retries !== undefined && data.retries < 0) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_RETRIES',
        message: 'Retries must be a non-negative number',
        nodeId: node.id,
      });
    }

    // Validate auth configuration
    if (data.auth_type) {
      const validAuthTypes = ['none', 'bearer', 'basic', 'api_key'];
      if (!validAuthTypes.includes(data.auth_type)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_AUTH_TYPE',
          message: `Invalid auth type "${data.auth_type}". Must be one of: ${validAuthTypes.join(', ')}`,
          nodeId: node.id,
        });
      }

      // Validate auth-specific requirements
      if (data.auth_type === 'bearer' && !data.auth_token) {
        result.warnings.push({
          type: 'warning',
          code: 'MISSING_BEARER_TOKEN',
          message: 'Bearer authentication specified but no token provided',
          nodeId: node.id,
        });
      }

      if (data.auth_type === 'basic' && !data.auth_credentials) {
        result.warnings.push({
          type: 'warning',
          code: 'MISSING_BASIC_CREDENTIALS',
          message: 'Basic authentication specified but no credentials provided',
          nodeId: node.id,
        });
      }

      if (data.auth_type === 'api_key' && !data.auth_api_key) {
        result.warnings.push({
          type: 'warning',
          code: 'MISSING_API_KEY',
          message: 'API key authentication specified but no key provided',
          nodeId: node.id,
        });
      }
    }

    // Validate error handling
    if (data.error_handling) {
      const validErrorHandling = ['fail', 'ignore', 'continue'];
      if (!validErrorHandling.includes(data.error_handling)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_ERROR_HANDLING',
          message: `Invalid error handling "${data.error_handling}". Must be one of: ${validErrorHandling.join(', ')}`,
          nodeId: node.id,
        });
      }
    }

    // Validate body type
    if (data.body_type) {
      const validBodyTypes = ['json', 'form', 'xml', 'text'];
      if (!validBodyTypes.includes(data.body_type)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_BODY_TYPE',
          message: `Invalid body type "${data.body_type}". Must be one of: ${validBodyTypes.join(', ')}`,
          nodeId: node.id,
        });
      }
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as HttpRequestNodeData;

    // Extract variables from URL, headers, body, and auth fields
    if (data.url) {
      variables.push(...this.extractTemplateVariables(data.url));
    }

    if (data.headers) {
      variables.push(...this.extractTemplateVariables(data.headers));
    }

    if (data.body) {
      variables.push(...this.extractTemplateVariables(data.body));
    }

    if (data.auth_token) {
      variables.push(...this.extractTemplateVariables(data.auth_token));
    }

    if (data.auth_credentials) {
      variables.push(...this.extractTemplateVariables(data.auth_credentials));
    }

    if (data.auth_api_key) {
      variables.push(...this.extractTemplateVariables(data.auth_api_key));
    }

    // Add HTTP response variables that this node provides
    variables.push('HTTP_STATUS_CODE');
    variables.push('HTTP_RESPONSE_BODY');
    variables.push('HTTP_RESPONSE_TIME');
    variables.push('HTTP_RESPONSE_SIZE');
    variables.push('HTTP_EFFECTIVE_URL');
    variables.push('HTTP_REQUEST_METHOD');
    variables.push('HTTP_SUCCESS');
    variables.push('HTTP_ERROR');

    return [...new Set(variables)];
  }
}
