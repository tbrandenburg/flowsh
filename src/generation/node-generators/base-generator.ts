/**
 * Base Node Generator Interface and Implementation
 *
 * Defines the common interface and shared functionality for all node type generators in flowsh workflows.
 */

import { ShellSanitizer } from '../../security/sanitization.js';
import { WorkflowNode } from '../../dsl/types.js';

export interface NodeGenerator<T extends WorkflowNode = WorkflowNode> {
  generateShell(node: T, functionName: string): string;
  validateNode?(node: T): ValidationResult;
  getRequiredVariables?(node: T): string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationContext {
  variables: Map<string, any>;
  nodeIndex: Map<string, WorkflowNode>;
  options: GenerationOptions;
}

export interface GenerationOptions {
  includeMocks?: boolean;
  shell?: 'bash' | 'zsh';
  verbose?: boolean;
  defaultTimeout?: number;
  headerTemplate?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential';
  baseDelay: number;
}

export interface EnvReference {
  type: 'env';
  variable: string;
  fallback?: string;
}

export interface TemplateReference {
  templateId: string;
  version?: string;
  source?: string;
}

/**
 * Abstract base class providing common functionality for all node generators
 */
export abstract class BaseNodeGenerator<
  T extends WorkflowNode = WorkflowNode,
> implements NodeGenerator<T> {
  protected sanitizer = ShellSanitizer;

  abstract generateShell(node: T, functionName: string): string;

  /**
   * Sanitizes a shell identifier (function names, variable names, etc.)
   */
  protected sanitizeShellIdentifier(id: string): string {
    return this.sanitizer.sanitizeVariable(id);
  }

  /**
   * Generates environment variable setup for a node
   */
  protected generateEnvironmentSetup(environment?: Record<string, string>): string {
    if (!environment || Object.keys(environment).length === 0) {
      return '# No environment variables to set';
    }

    return Object.entries(environment)
      .map(([key, value]) => {
        const sanitizedKey = this.sanitizer.sanitizeVariable(key);
        // Handle environment variable references
        if (typeof value === 'string' && value.startsWith('$')) {
          return `    export ${sanitizedKey}="${value}"`;
        }
        return `    export ${sanitizedKey}="${value}"`;
      })
      .join('\n');
  }

  /**
   * Generates retry logic with exponential backoff
   */
  protected generateRetryLogic(config: RetryConfig, operation: string): string {
    return `
    local attempt=1
    local max_attempts=${config.maxAttempts}
    local base_delay=${config.baseDelay}
    
    while [ $attempt -le $max_attempts ]; do
        log_debug "$correlation_id" "${operation} attempt $attempt"
        
        if ${operation}; then
            log_success "$correlation_id" "${operation} completed" "{\\"attempt\\": $attempt}"
            return 0
        else
            local exit_code=$?
            log_warning "$correlation_id" "${operation} attempt $attempt failed" "{\\"exit_code\\": $exit_code}"
            
            if [ $attempt -eq $max_attempts ]; then
                log_error "$correlation_id" "${operation} failed after $max_attempts attempts"
                return $exit_code
            fi
            
            # Calculate delay based on strategy
            ${
              config.backoffStrategy === 'exponential'
                ? 'local delay=$((base_delay * (2 ** (attempt - 1))))'
                : 'local delay=$((base_delay * attempt))'
            }
            
            log_debug "$correlation_id" "Waiting ${config.backoffStrategy} backoff: $delay seconds"
            sleep $delay
            attempt=$((attempt + 1))
        fi
    done`;
  }

  /**
   * Generates timeout wrapper for operations
   */
  protected generateTimeoutWrapper(operation: string, timeout: number): string {
    return `timeout ${timeout} ${operation}`;
  }

  /**
   * Generates variable resolution for template variables
   */
  protected resolveVariables(template: string): string {
    // This will be used by template engine to resolve ${variable} patterns
    return template.replace(/\$\{([^}]+)\}/g, '$(get_variable_value "$1" "$input_data")');
  }

  /**
   * Generates error handling for common failure scenarios
   */
  protected generateErrorHandling(nodeId: string, operation: string): string {
    return `
    if [ $exit_code -ne 0 ]; then
        case $exit_code in
            1)
                log_error "$correlation_id" "${operation} general error" "{\\"node\\": \\"${nodeId}\\"}"
                ;;
            124)
                log_error "$correlation_id" "${operation} timeout" "{\\"node\\": \\"${nodeId}\\"}"
                ;;
            126)
                log_error "$correlation_id" "${operation} command not executable" "{\\"node\\": \\"${nodeId}\\"}"
                ;;
            127)
                log_error "$correlation_id" "${operation} command not found" "{\\"node\\": \\"${nodeId}\\"}"
                ;;
            *)
                log_error "$correlation_id" "${operation} unknown error" "{\\"node\\": \\"${nodeId}\\", \\"exit_code\\": $exit_code}"
                ;;
        esac
        return $exit_code
    fi`;
  }

  /**
   * Validates common node properties
   */
  protected validateCommonNode(node: T): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!node.id) {
      errors.push('Node missing required id property');
    }

    if (!node.type) {
      errors.push('Node missing required type property');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates secure temporary file creation
   */
  protected generateTempFileCreation(prefix: string, nodeId: string): string {
    return `
    # Create secure temporary files
    local temp_dir="\${FLOWSH_TEMP_DIR:-/tmp/flowsh}"
    mkdir -p "$temp_dir"
    
    local temp_file_prefix="${prefix}_${nodeId}_$correlation_id"
    local temp_file="$temp_dir/\${temp_file_prefix}"
    local output_file="\${temp_file}.output"
    local error_file="\${temp_file}.error"
    
    # Set secure permissions
    touch "$temp_file" "$output_file" "$error_file"
    chmod 600 "$temp_file" "$output_file" "$error_file"`;
  }

  /**
   * Generates cleanup for temporary files
   */
  protected generateTempFileCleanup(): string {
    return `
    # Cleanup temporary files
    rm -f "$temp_file" "$output_file" "$error_file" 2>/dev/null || true`;
  }
}
