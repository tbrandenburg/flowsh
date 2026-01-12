/**
 * Code Node Generator
 *
 * Generates shell functions for Code nodes that execute shell commands and scripts.
 * Includes comprehensive security validation, sandboxing, resource limits, and error handling.
 */

import { BaseNodeGenerator, ValidationResult } from './base-generator.js';
import { ShellSanitizer } from '../../security/sanitization.js';
import { escapeShellValue } from '../shell-scripting/shell-escaping.js';
import { FlowshGenerationError } from '../../errors/types.js';
import { WorkflowNode } from '../../dsl/types.js';

interface CodeNodeConfig {
  language: 'bash' | 'python' | 'node' | 'custom';
  code: string;
  command?: string;
  args?: string[];
  environment?: Record<string, string>;
  workingDirectory?: string;
  timeout?: number;
  allowNetworkAccess?: boolean;
  resourceLimits?: {
    maxMemory?: string;
    maxCpuTime?: number;
    maxFileSize?: string;
  };
}

export class CodeNodeGenerator extends BaseNodeGenerator {
  /**
   * Validates a Code node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const commonResult = this.validateCommonNode(node);
    if (!commonResult.isValid) {
      return commonResult;
    }

    const errors: string[] = [...commonResult.errors];
    const warnings: string[] = [...commonResult.warnings];

    const data = node.data as any;

    // Check for either code or command
    if (!data.code && !data.command) {
      errors.push(`Code node ${node.id}: No code or command specified`);
    }

    // If command is specified, validate it
    if (data.command) {
      const sanitizeResult = ShellSanitizer.sanitizeCommand(data.command);
      if (!sanitizeResult.success) {
        errors.push(
          ...sanitizeResult.errors.map(
            e => `Code node ${node.id}: Security validation failed - ${e.message}`
          )
        );
      }
    }

    // Check arguments if present
    if (data.args && Array.isArray(data.args)) {
      const argsResult = ShellSanitizer.sanitizeArguments(data.args);
      if (!argsResult.success) {
        errors.push(
          ...argsResult.errors.map(
            e => `Code node ${node.id}: Argument validation failed - ${e.message}`
          )
        );
      }
    }

    // Check working directory if specified
    if (data.working_directory && typeof data.working_directory !== 'string') {
      errors.push(`Code node ${node.id}: working_directory must be a string`);
    }

    // Validate language if code is provided
    if (data.code) {
      const language = data.language || 'bash';
      if (!['bash', 'python', 'node', 'custom'].includes(language)) {
        warnings.push(`Code node ${node.id}: Unknown language '${language}', defaulting to 'bash'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates shell function for a Code node
   */
  generateShell(node: WorkflowNode, functionName: string): string {
    const config = this.validateAndExtractConfig(node.data);
    const nodeId = this.sanitizeShellIdentifier(node.id);

    return `# Code Node: ${node.id}
${functionName}() {
    local input_data="$1"
    local correlation_id="$2"
    
    log_operation_start "${nodeId}" "code_execution" "$correlation_id"
    
    # Create secure execution environment
    ${this.generateSecuritySetup(config)}
    
    # Setup working directory
    ${this.generateWorkingDirectorySetup(config.workingDirectory)}
    
    # Setup environment variables
    ${this.generateEnvironmentSetup(config.environment)}
    
    ${this.generateTempFileCreation('code', nodeId)}
    
    # Prepare code execution
    local exit_code
    
    if [[ "\$USE_MOCK_TOOLS" == "true" ]]; then
        ${this.generateMockExecution(node.id)}
    else
        ${config.code ? this.generateCodeExecution(config) : this.generateCommandExecution(config)}
    fi
    
    ${this.generateErrorHandling(nodeId, 'Code execution')}
    
    # Process execution results
    if [ $exit_code -eq 0 ]; then
        local output
        output=$(cat "$output_file" 2>/dev/null || echo "")
        log_success "$correlation_id" "Code execution completed" "{\\"output_length\\": \${#output}}"
        
        # Store output for downstream nodes
        set_workflow_var "code_output" "$output"
        set_workflow_var "${nodeId}_output" "$output"
        
        ${this.generateOutputProcessing(node.data)}
        
        echo "$output"
    else
        local error_output
        error_output=$(cat "$error_file" 2>/dev/null || echo "No error output")
        log_error "$correlation_id" "Code execution failed" "{\\"exit_code\\": $exit_code, \\"error\\": \\"\$error_output\\"}"
    fi
    
    ${this.generateTempFileCleanup()}
    ${this.generateWorkingDirectoryCleanup()}
    
    set_workflow_state "current_node" "${node.id}"
    return $exit_code
}`;
  }

  private validateAndExtractConfig(data: any): CodeNodeConfig {
    const config: CodeNodeConfig = {
      language: (data.language || 'bash') as 'bash' | 'python' | 'node' | 'custom',
      code: data.code || '',
      command: data.command,
      args: data.args || [],
      environment: data.environment || {},
      workingDirectory: data.working_directory || data.workingDirectory,
      timeout: data.timeout || 300,
      allowNetworkAccess: data.allowNetworkAccess ?? true,
      resourceLimits: data.resourceLimits || {
        maxMemory: '1G',
        maxCpuTime: 300,
        maxFileSize: '100M',
      },
    };

    // Validate command if present
    if (config.command) {
      const sanitizeResult = ShellSanitizer.sanitizeCommand(config.command);
      if (!sanitizeResult.success) {
        const errorMessage = sanitizeResult.errors.map(e => e.message).join(', ');
        throw new FlowshGenerationError(`Code node command validation failed: ${errorMessage}`, {
          command: config.command,
          errors: sanitizeResult.errors,
        });
      }
    }

    // Validate arguments if present
    if (config.args && config.args.length > 0) {
      const argsResult = ShellSanitizer.sanitizeArguments(config.args);
      if (!argsResult.success) {
        const errorMessage = argsResult.errors.map(e => e.message).join(', ');
        throw new FlowshGenerationError(`Code node arguments validation failed: ${errorMessage}`, {
          args: config.args,
          errors: argsResult.errors,
        });
      }
    }

    return config;
  }

  private generateSecuritySetup(config: CodeNodeConfig): string {
    const restrictions = [];

    // Network access control
    if (!config.allowNetworkAccess) {
      restrictions.push('# Disable network access');
      restrictions.push('export NO_PROXY="*"');
      restrictions.push('export HTTP_PROXY="127.0.0.1:1"');
      restrictions.push('export HTTPS_PROXY="127.0.0.1:1"');
      restrictions.push('unset SSH_AUTH_SOCK');
    }

    // Resource limits
    const limits = config.resourceLimits!;

    if (limits.maxCpuTime) {
      restrictions.push(`ulimit -t ${limits.maxCpuTime}`);
    }

    if (limits.maxMemory) {
      const memoryKb = this.parseMemoryLimit(limits.maxMemory);
      restrictions.push(`ulimit -v ${memoryKb}`);
    }

    if (limits.maxFileSize) {
      const fileSizeKb = this.parseMemoryLimit(limits.maxFileSize);
      restrictions.push(`ulimit -f ${fileSizeKb}`);
    }

    // Additional security restrictions
    restrictions.push('ulimit -u 50'); // Max processes
    restrictions.push('ulimit -n 100'); // Max open files
    restrictions.push('umask 077'); // Restrictive file permissions

    return restrictions.join('\n    ');
  }

  private generateWorkingDirectorySetup(workingDirectory?: string): string {
    if (!workingDirectory) {
      return '# Using current working directory';
    }

    return `
    # Change to specified working directory
    local original_dir
    original_dir=$(pwd)
    
    # Create directory if it doesn't exist (securely)
    if [ ! -d "${workingDirectory}" ]; then
        if ! mkdir -p "${workingDirectory}"; then
            log_error "$correlation_id" "Failed to create working directory: ${workingDirectory}"
            return 1
        fi
    fi
    
    if ! cd "${workingDirectory}"; then
        log_error "$correlation_id" "Failed to change to directory: ${workingDirectory}"
        return 1
    fi
    
    log_debug "$correlation_id" "Changed to directory: $(pwd)"`;
  }

  private generateWorkingDirectoryCleanup(): string {
    return `
    # Return to original directory if changed
    if [ -n "$original_dir" ]; then
        cd "$original_dir" || {
            log_error "$correlation_id" "Failed to return to original directory"
        }
    fi`;
  }

  private generateCodeExecution(config: CodeNodeConfig): string {
    return `
        log_debug "$correlation_id" "Executing ${config.language} code"
        
        # Write code to secure temporary file
        local code_file="$temp_file.${this.getFileExtension(config.language)}"
        
        # Create code file with resolved variables
        cat > "$code_file" <<'CODE_EOF'
${this.resolveVariables(config.code)}
CODE_EOF
        
        # Set appropriate permissions
        chmod 600 "$code_file"
        
        # Execute code with appropriate interpreter
        ${this.generateSecureExecution(config, '$code_file')}
        
        # Clean up code file
        rm -f "$code_file"`;
  }

  private generateCommandExecution(config: CodeNodeConfig): string {
    if (!config.command) {
      throw new FlowshGenerationError('Command execution requested but no command provided');
    }

    const sanitizeResult = ShellSanitizer.sanitizeCommand(config.command);
    if (!sanitizeResult.success) {
      throw new FlowshGenerationError('Command sanitization failed during generation');
    }

    const command = sanitizeResult.data!;
    const shouldEscapeArgs =
      config.command === 'bash' ||
      config.command === '/bin/bash' ||
      (config.args?.includes('-c') ?? false);
    const argsList =
      config.args
        ?.map(arg => {
          const resolvedArg = this.resolveVariables(arg);
          return `"${shouldEscapeArgs ? escapeShellValue(resolvedArg) : resolvedArg}"`;
        })
        .join(' ') || '';

    return `
        log_debug "$correlation_id" "Executing command: ${command}"
        
        # Execute command with timeout and capture output
        ${this.generateSecureExecution(config, `"${command}" ${argsList}`)}`;
  }

  private generateSecureExecution(config: CodeNodeConfig, command: string): string {
    const timeout = config.timeout || 300;

    let interpreter = '';
    if (config.code) {
      switch (config.language) {
        case 'python':
          interpreter = 'python3 -B -I -s'; // Secure Python execution
          break;
        case 'node':
          interpreter = 'node --no-deprecation --no-warnings';
          break;
        case 'bash':
          interpreter = 'bash -euo pipefail'; // Strict bash execution
          break;
        default:
          interpreter = config.language;
      }
      command = `${interpreter} ${command}`;
    }

    return `
        # Execute with comprehensive monitoring
        if ${this.generateTimeoutWrapper(command, timeout)} > "$output_file" 2> "$error_file"; then
            exit_code=0
            log_debug "$correlation_id" "Execution completed successfully"
        else
            exit_code=$?
            log_debug "$correlation_id" "Execution failed with exit code: $exit_code"
        fi
        
        # Log resource usage if available
        if command -v /usr/bin/time >/dev/null 2>&1; then
            /usr/bin/time -f "Resource usage - User: %U, System: %S, Memory: %M KB" ${command} >/dev/null 2>>"$error_file" || true
        fi`;
  }

  private generateMockExecution(nodeId: string): string {
    return `
        log_debug "$correlation_id" "Using mock code execution"
        local mock_output="Mock execution output from ${nodeId} at $(date)"
        
        echo "$mock_output" > "$output_file"
        exit_code=0
        
        log_debug "$correlation_id" "Mock execution completed successfully"`;
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
        } else if (mapping?.source === 'code_output' || mapping?.source === 'stdout') {
          // Code output reference
          return `        set_workflow_var "${key}" "$output"`;
        } else if (mapping?.source === 'stderr') {
          // Error output reference
          return `        set_workflow_var "${key}" "$(cat "$error_file" 2>/dev/null || echo "")"`;
        } else if (mapping?.source === 'exit_code') {
          // Exit code reference
          return `        set_workflow_var "${key}" "$exit_code"`;
        } else if (mapping?.transform) {
          // Apply transformation
          return `        set_workflow_var "${key}" "$(echo "$output" | ${mapping.transform})"`;
        } else {
          // Default/fallback value
          return `        set_workflow_var "${key}" "${mapping?.default || ''}"`;
        }
      })
      .join('\n');

    return `# Process code execution outputs\n${outputProcessing}`;
  }

  private getFileExtension(language: string): string {
    switch (language) {
      case 'python':
        return 'py';
      case 'node':
        return 'js';
      case 'bash':
        return 'sh';
      default:
        return 'code';
    }
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([KMGT]?)B?$/i);
    if (!match) {
      return 1048576; // Default: 1GB in KB
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2]?.toUpperCase() || '';

    switch (unit) {
      case 'K':
        return value;
      case 'M':
        return value * 1024;
      case 'G':
        return value * 1024 * 1024;
      case 'T':
        return value * 1024 * 1024 * 1024;
      default:
        return value; // Assume KB if no unit
    }
  }
}
