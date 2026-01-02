## FEATURE: Week 5 Complete Node Functionality and Template System Integration

Transform flowsh from a workflow processor with stub implementations into a fully functional system capable of generating meaningful shell scripts. Complete all Phase 1 node generators and implement the template system for external prompt/template integration.

## Core Requirements:

### 1. Complete Agent Node Generator

- Replace placeholder implementation with real CLI command generation
- Support for various agent types (CLI tools, APIs, custom executables)
- Add argument parsing, validation, and secure command construction
- Implement agent-specific configuration and environment handling

### 2. Complete LLM Node Generator

- Implement API call generation for major LLM providers (OpenAI, Anthropic, local)
- Add prompt template resolution and variable interpolation
- Support streaming and non-streaming response handling
- Include rate limiting, error handling, and response parsing

### 3. Complete Code Node Generator

- Generate secure bash/shell command execution with proper escaping
- Add input validation and command sanitization
- Support environment variable passing and working directory control
- Implement timeout handling and error capture

### 4. Template System Implementation

- Build external template loading and caching system
- Support multiple template sources (HTTP, file system, git repositories)
- Add template validation, versioning, and fallback mechanisms
- Implement template registry integration with authentication

## EXAMPLES:

### Agent Node Generator Implementation:

```typescript
interface AgentNodeConfig {
  command: string;
  arguments?: string[];
  environment?: Record<string, string>;
  workingDirectory?: string;
  timeout?: number;
  retryPolicy?: RetryConfig;
}

class AgentNodeGenerator extends BaseNodeGenerator {
  generateNodeFunction(node: WorkflowNode): string {
    const config = this.validateAgentConfig(node.data);
    const nodeId = this.sanitizer.sanitizeShellIdentifier(node.id);

    return `
# Agent Node: ${node.id}
function execute_agent_${nodeId}() {
    local input_data="$1"
    local correlation_id="$2"
    
    log_operation_start "${nodeId}" "agent_execution" "$correlation_id"
    
    # Prepare environment
    ${this.generateEnvironmentSetup(config.environment)}
    
    # Prepare arguments with variable substitution
    ${this.generateArgumentPreparation(config.arguments)}
    
    # Execute agent with timeout and error handling
    local output
    local exit_code
    
    if timeout ${config.timeout || 300} ${this.generateSecureCommand(config)}; then
        exit_code=$?
        output=$(cat "$AGENT_OUTPUT_FILE")
        
        if [ $exit_code -eq 0 ]; then
            log_success "$correlation_id" "Agent execution completed" "{\\"output\\": \\"$output\\"}"
            echo "$output"
            return 0
        else
            log_error "$correlation_id" "Agent execution failed" "{\\"exit_code\\": $exit_code, \\"output\\": \\"$output\\"}"
            return $exit_code
        fi
    else
        log_error "$correlation_id" "Agent execution timeout" "{\\"timeout\\": ${config.timeout || 300}}"
        return 124
    fi
}`;
  }

  private generateSecureCommand(config: AgentNodeConfig): string {
    // Sanitize command and arguments to prevent injection
    const command = this.sanitizer.sanitizeCommand(config.command);
    const args =
      config.arguments
        ?.map(arg => this.sanitizer.sanitizeArgument(this.resolveVariables(arg)))
        .join(' ') || '';

    return `"${command}" ${args} > "$AGENT_OUTPUT_FILE" 2>&1`;
  }

  private generateArgumentPreparation(args?: string[]): string {
    if (!args) return '';

    return args
      .map(
        (arg, index) => `
    local arg_${index}="${this.templateEngine.resolveVariables(arg)}"
    if [ -z "$arg_${index}" ]; then
        log_warning "$correlation_id" "Empty argument at position ${index}"
    fi`
      )
      .join('\n');
  }
}
```

### LLM Node Generator Implementation:

```typescript
interface LLMNodeConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  model: string;
  prompt: string | TemplateReference;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  apiKey?: string | EnvReference;
  endpoint?: string;
}

class LLMNodeGenerator extends BaseNodeGenerator {
  generateNodeFunction(node: WorkflowNode): string {
    const config = this.validateLLMConfig(node.data);
    const nodeId = this.sanitizer.sanitizeShellIdentifier(node.id);

    return `
# LLM Node: ${node.id}
function execute_llm_${nodeId}() {
    local input_data="$1"
    local correlation_id="$2"
    
    log_operation_start "${nodeId}" "llm_execution" "$correlation_id"
    
    # Resolve prompt template
    local resolved_prompt
    ${this.generatePromptResolution(config.prompt)}
    
    # Prepare API configuration
    ${this.generateAPIConfiguration(config)}
    
    # Execute LLM API call with retry logic
    local response
    local attempt=1
    local max_attempts=3
    
    while [ $attempt -le $max_attempts ]; do
        log_debug "$correlation_id" "LLM API attempt $attempt"
        
        if response=$(${this.generateAPICall(config)}); then
            log_success "$correlation_id" "LLM execution completed" "{\\"attempt\\": $attempt}"
            echo "$response"
            return 0
        else
            local exit_code=$?
            log_warning "$correlation_id" "LLM API attempt $attempt failed" "{\\"exit_code\\": $exit_code}"
            
            if [ $attempt -eq $max_attempts ]; then
                log_error "$correlation_id" "LLM execution failed after $max_attempts attempts"
                return $exit_code
            fi
            
            # Exponential backoff
            sleep $((2 ** attempt))
            attempt=$((attempt + 1))
        fi
    done
}`;
  }

  private generateAPICall(config: LLMNodeConfig): string {
    switch (config.provider) {
      case 'openai':
        return this.generateOpenAICall(config);
      case 'anthropic':
        return this.generateAnthropicCall(config);
      case 'local':
        return this.generateLocalLLMCall(config);
      default:
        return this.generateCustomAPICall(config);
    }
  }

  private generateOpenAICall(config: LLMNodeConfig): string {
    return `curl -s -X POST "https://api.openai.com/v1/chat/completions" \\
      -H "Authorization: Bearer $OPENAI_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{
        "model": "${config.model}",
        "messages": [{"role": "user", "content": "'$resolved_prompt'"}],
        "temperature": ${config.temperature || 0.7},
        "max_tokens": ${config.maxTokens || 1000}
      }' | jq -r '.choices[0].message.content'`;
  }

  private generatePromptResolution(prompt: string | TemplateReference): string {
    if (typeof prompt === 'string') {
      return `resolved_prompt="${this.templateEngine.resolveVariables(prompt)}"`;
    }

    return `
    # Resolve external template
    local template_content
    if ! template_content=$(resolve_template "${prompt.templateId}" "${prompt.version || 'latest'}"); then
        log_error "$correlation_id" "Failed to resolve template" "{\\"templateId\\": \\"${prompt.templateId}\\"}"
        return 1
    fi
    
    resolved_prompt=$(echo "$template_content" | substitute_variables "$input_data")`;
  }
}
```

### Template System Implementation:

```typescript
interface TemplateSource {
  type: 'http' | 'file' | 'git' | 'registry';
  url: string;
  authentication?: AuthConfig;
  caching?: CacheConfig;
}

interface TemplateRegistry {
  sources: TemplateSource[];
  fallbackStrategy: 'error' | 'inline' | 'default';
  cacheTTL: number;
  maxCacheSize: number;
}

class TemplateSystemImplementation {
  private cache = new Map<string, CachedTemplate>();
  private registry: TemplateRegistry;

  async resolveTemplate(templateId: string, version?: string): Promise<string> {
    const cacheKey = `${templateId}:${version || 'latest'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      this.logger.debug('Template cache hit', { templateId, version });
      return cached.content;
    }

    // Try each source until successful
    for (const source of this.registry.sources) {
      try {
        const template = await this.loadFromSource(source, templateId, version);

        // Validate template
        await this.validateTemplate(template);

        // Cache successful result
        this.cache.set(cacheKey, {
          content: template,
          timestamp: Date.now(),
          source: source.url
        });

        this.logger.info('Template resolved', { templateId, version, source: source.url });
        return template;

      } catch (error) {
        this.logger.warning('Template source failed', {
          templateId,
          version,
          source: source.url,
          error: error.message
        });
      }
    }

    // Handle fallback strategy
    return this.handleTemplateFallback(templateId, version);
  }

  private async loadFromSource(
    source: TemplateSource,
    templateId: string,
    version?: string
  ): Promise<string> {
    switch (source.type) {
      case 'http':
        return this.loadFromHTTP(source, templateId, version);
      case 'file':
        return this.loadFromFile(source, templateId, version);
      case 'git':
        return this.loadFromGit(source, templateId, version);
      case 'registry':
        return this.loadFromRegistry(source, templateId, version);
      default:
        throw new Error(`Unsupported template source type: ${source.type}`);
    }
  }

  generateTemplateSystemShellCode(): string {
    return `
# Template System Functions
resolve_template() {
    local template_id="$1"
    local version="${2:-latest}"
    local cache_key="${template_id}:${version}"

    # Check local cache
    if [ -f "$TEMPLATE_CACHE_DIR/$cache_key" ]; then
        local cache_age=$(($(date +%s) - $(stat -c %Y "$TEMPLATE_CACHE_DIR/$cache_key")))
        if [ $cache_age -lt ${this.registry.cacheTTL} ]; then
            cat "$TEMPLATE_CACHE_DIR/$cache_key"
            return 0
        fi
    fi

    # Try each configured source
    ${this.generateSourceResolution()}

    # Handle fallback
    case "${this.registry.fallbackStrategy}" in
        "error")
            log_error "$correlation_id" "Template not found" "{\\"templateId\\": \\"$template_id\\"}"
            return 1
            ;;
        "inline")
            echo "$template_id"  # Use template ID as inline content
            ;;
        "default")
            echo "Default template content for $template_id"
            ;;
    esac
}

substitute_variables() {
    local input_data="$1"

    # Replace ${variable} patterns with actual values
    sed -e "s/\\\${\\([^}]*\\)}/$(get_variable_value "\\1" "$input_data")/g"
}`;
  }
}
```

### Code Node Generator Implementation:

```typescript
interface CodeNodeConfig {
  language: 'bash' | 'python' | 'node' | 'custom';
  code: string;
  environment?: Record<string, string>;
  workingDirectory?: string;
  timeout?: number;
  allowNetworkAccess?: boolean;
}

class CodeNodeGenerator extends BaseNodeGenerator {
  generateNodeFunction(node: WorkflowNode): string {
    const config = this.validateCodeConfig(node.data);
    const nodeId = this.sanitizer.sanitizeShellIdentifier(node.id);

    return `
# Code Node: ${node.id}
function execute_code_${nodeId}() {
    local input_data="$1"
    local correlation_id="$2"
    
    log_operation_start "${nodeId}" "code_execution" "$correlation_id"
    
    # Create secure execution environment
    ${this.generateSecuritySetup(config)}
    
    # Prepare code execution
    local code_file="$TEMP_DIR/code_${nodeId}_$correlation_id"
    local output_file="$TEMP_DIR/output_${nodeId}_$correlation_id"
    
    # Write code to temporary file with security checks
    ${this.generateCodePreparation(config.code)}
    
    # Execute code with proper isolation
    local exit_code
    if ${this.generateSecureExecution(config)}; then
        exit_code=$?
        local output=$(cat "$output_file" 2>/dev/null || echo "")
        
        if [ $exit_code -eq 0 ]; then
            log_success "$correlation_id" "Code execution completed" "{\\"output_length\\": ${#output}}"
            echo "$output"
        else
            log_error "$correlation_id" "Code execution failed" "{\\"exit_code\\": $exit_code, \\"output\\": \\"$output\\"}"
        fi
        
        # Cleanup
        rm -f "$code_file" "$output_file"
        return $exit_code
    else
        log_error "$correlation_id" "Code execution setup failed"
        rm -f "$code_file" "$output_file"
        return 1
    fi
}`;
  }

  private generateSecuritySetup(config: CodeNodeConfig): string {
    const restrictions = [];

    if (!config.allowNetworkAccess) {
      restrictions.push('# Disable network access');
      restrictions.push('export NO_PROXY="*"');
      restrictions.push('export HTTP_PROXY="127.0.0.1:1"'); // Invalid proxy to block HTTP
    }

    restrictions.push('# Set resource limits');
    restrictions.push('ulimit -t 60'); // CPU time limit
    restrictions.push('ulimit -v 1048576'); // Virtual memory limit (1GB)

    return restrictions.join('\n    ');
  }

  private generateSecureExecution(config: CodeNodeConfig): string {
    switch (config.language) {
      case 'bash':
        return `timeout ${config.timeout || 300} bash "$code_file" > "$output_file" 2>&1`;
      case 'python':
        return `timeout ${config.timeout || 300} python3 -B -I "$code_file" > "$output_file" 2>&1`;
      case 'node':
        return `timeout ${config.timeout || 300} node --no-deprecation "$code_file" > "$output_file" 2>&1`;
      default:
        return `timeout ${config.timeout || 300} "${config.language}" "$code_file" > "$output_file" 2>&1`;
    }
  }
}
```

## DOCUMENTATION:

### Node Generator Implementation:

- **Shell Script Security**: https://mywiki.wooledge.org/BashGuide - Bash scripting best practices
- **Command Injection Prevention**: https://owasp.org/www-community/attacks/Command_Injection - Security patterns
- **Process Isolation**: https://man7.org/linux/man-pages/man2/unshare.2.html - Linux sandboxing
- **Resource Limits**: https://man7.org/linux/man-pages/man2/setrlimit.2.html - Process resource control

### LLM Integration:

- **OpenAI API**: https://platform.openai.com/docs/api-reference - API documentation
- **Anthropic Claude API**: https://docs.anthropic.com/claude/reference - API reference
- **API Rate Limiting**: https://www.npmjs.com/package/bottleneck - Rate limiting patterns
- **Streaming Responses**: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API - Stream processing

### Template Systems:

- **Handlebars Templates**: https://handlebarsjs.com/ - Template engine patterns
- **Template Caching**: https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener - File system caching
- **HTTP Template Loading**: https://nodejs.org/api/http.html - HTTP client implementation
- **Git Template Sources**: https://git-scm.com/docs/git-clone - Git integration patterns

## OTHER CONSIDERATIONS:

### Security Hardening:

- Implement sandboxed execution environments for code nodes
- Add input validation and sanitization for all node configurations
- Create security profiles for different deployment environments
- Implement audit logging for all code and command executions

### Performance Optimizations:

- Add template caching with configurable TTL and size limits
- Implement connection pooling for LLM API calls
- Use streaming for large template and response processing
- Add parallel execution capabilities for independent nodes

### Error Recovery:

- Implement retry policies with exponential backoff for API calls
- Add circuit breaker patterns for unreliable external services
- Create fallback templates for template resolution failures
- Implement graceful degradation for optional node functionality

### Monitoring Integration:

- Add detailed metrics for node execution times and success rates
- Track template cache hit ratios and resolution performance
- Monitor LLM API usage and costs across different providers
- Create alerting for node execution failures and security violations

### Configuration Management:

- Support environment-specific configurations for different deployment contexts
- Add validation for node configurations with detailed error messages
- Implement configuration templates and inheritance patterns
- Create configuration migration tools for version updates

### Template System Features:

- Support for nested template inclusion and composition
- Add template versioning and rollback capabilities
- Implement template validation and schema checking
- Create template debugging and preview functionality

### Success Criteria:

1. **Functionality**: All Phase 1 node types generate functional shell script implementations
2. **Security**: No code injection vulnerabilities in generated scripts
3. **Templates**: External templates resolve and integrate correctly with variable substitution
4. **Performance**: Node execution completes within acceptable time limits (<5 minutes for typical operations)
5. **Integration**: All example workflows process successfully with real node implementations
6. **Quality**: Comprehensive test coverage for all node generators and template system
