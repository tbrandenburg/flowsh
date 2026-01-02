/**
 * Code Node Generator
 *
 * Generates shell functions for Code nodes that execute shell commands.
 * Includes security validation, working directory management, and error handling.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { ShellSanitizer } from '../../security/sanitization.js';
import { FlowshGenerationError } from '../../errors/types.js';
import { NodeGenerator, ValidationResult } from './base-generator.js';

export class CodeNodeGenerator implements NodeGenerator {
  /**
   * Validates a Code node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const data = node.data as any;

    // Check for command
    if (!data.command) {
      errors.push(`Code node ${node.id}: No command specified`);
    } else {
      // Perform security validation
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
    const data = node.data as any;

    // Validate and sanitize command using security utilities
    const command = data.command || '';
    const args = data.args || [];

    // Sanitize the command for security
    const sanitizeResult = ShellSanitizer.sanitizeCommand(command);
    if (!sanitizeResult.success) {
      const errorMessage = sanitizeResult.errors.map(e => e.message).join(', ');
      throw new FlowshGenerationError(
        `Security validation failed for command in node ${node.id}: ${errorMessage}`,
        { nodeId: node.id, command, errors: sanitizeResult.errors }
      );
    }

    const sanitizedCommand = sanitizeResult.data!;

    // Sanitize arguments
    const argsResult = ShellSanitizer.sanitizeArguments(args);
    if (!argsResult.success) {
      const errorMessage = argsResult.errors.map(e => e.message).join(', ');
      throw new FlowshGenerationError(
        `Security validation failed for arguments in node ${node.id}: ${errorMessage}`,
        { nodeId: node.id, args, errors: argsResult.errors }
      );
    }

    const sanitizedArgs = argsResult.data!;

    return `# Execute code node: ${node.id}
${functionName}() {
    log_step "🔧 Running Code: ${data.title || node.id}"
    
    local exit_code=0
    local command="${sanitizedCommand}"
    
    # Change to working directory if specified
    ${
      data.working_directory
        ? `
    local original_dir
    original_dir=\$(pwd)
    
    if ! cd "${data.working_directory}"; then
        log_error "Failed to change to directory: ${data.working_directory}"
        return 1
    fi
    
    log_debug "Changed to directory: \$(pwd)"`
        : ''
    }
    
    # Execute command with fallback options
    if [[ "\$USE_MOCK_TOOLS" == "true" ]]; then
        log_debug "Using mock command"
        mock_command "\$command" ${sanitizedArgs.map(arg => `"${arg}"`).join(' ')} || exit_code=\$?
    else
        log_debug "Using real command: \$command"
        "\$command" ${sanitizedArgs.map(arg => `"${arg}"`).join(' ')} || exit_code=\$?
    fi
    
    ${
      data.working_directory
        ? `
    # Return to original directory
    cd "\$original_dir" || {
        log_error "Failed to return to original directory"
        return 1
    }`
        : ''
    }
    
    # Handle success/failure routing
    if [[ \$exit_code -eq 0 ]]; then
        log_success "Code execution completed successfully"
        ${data.on_success ? `execute_node_${data.on_success.replace(/[^a-zA-Z0-9]/g, '_')}` : ''}
    else
        log_error "Code execution failed with exit code: \$exit_code"
        ${data.on_failure ? `execute_node_${data.on_failure.replace(/[^a-zA-Z0-9]/g, '_')}` : `return \$exit_code`}
    fi
    
    set_workflow_state "current_node" "${node.id}"
}`;
  }
}
