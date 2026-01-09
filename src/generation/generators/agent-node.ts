/**
 * Agent Node Generator
 *
 * Generates shell script code for agent orchestration nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class AgentNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'agent';

  generate(node: WorkflowNode, context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo');
    const args = this.getNodeData(node, 'args', []);
    const promptTemplate = this.getNodeData(node, 'prompt_template', null);
    const templateParameters = this.getNodeData(node, 'template_parameters', {});
    const workingDirectory = this.getNodeData(node, 'working_directory', undefined);
    const environmentVariables = this.getNodeData(node, 'environment_variables', {});
    const timeout = this.getNodeData(node, 'timeout', 30);
    const title = this.getNodeData(node, 'title', node.id);

    if (context.options.includeMocks) {
      return `echo "Mock agent: ${String(title)}"`;
    }

    // Generate function name
    const functionName = `execute_agent_${node.id}`;

    // Build the agent execution function
    const parts: string[] = [];

    // Add function header with comment
    parts.push(this.generateNodeComment(node));
    parts.push(`${functionName}() {`);
    parts.push(`    log_step "🤖 Executing agent: ${title}"`);
    parts.push('');

    // Set up working directory if specified
    if (workingDirectory) {
      const processedDir = this.processTemplateVariables(String(workingDirectory), node.id);
      parts.push(`    local original_dir="$PWD"`);
      parts.push(`    local working_dir="${processedDir}"`);
      parts.push(`    if [[ -d "$working_dir" ]]; then`);
      parts.push(
        `        cd "$working_dir" || { log_error "Failed to change to directory: $working_dir"; return 1; }`
      );
      parts.push(`        log_debug "Changed to working directory: $working_dir"`);
      parts.push(`    else`);
      parts.push(
        `        log_warning "Working directory does not exist, using current: $working_dir"`
      );
      parts.push(`    fi`);
      parts.push('');
    }

    // Set up environment variables
    if (typeof environmentVariables === 'object' && environmentVariables !== null) {
      const envVars = environmentVariables as Record<string, unknown>;
      if (Object.keys(envVars).length > 0) {
        parts.push('    # Set up environment variables');
        Object.entries(envVars).forEach(([key, value]) => {
          const processedValue = this.processTemplateVariables(String(value || ''), node.id);
          const sanitizedKey = this.sanitizeVariableName(key);
          parts.push(`    export ${sanitizedKey}="${processedValue}"`);
        });
        parts.push('');
      }
    }

    // Build the command with arguments
    let fullCommand = this.processTemplateVariables(String(command), node.id);

    if (Array.isArray(args) && args.length > 0) {
      const processedArgs = args.map(arg => {
        const argStr = String(arg);
        const processed = this.processTemplateVariables(argStr, node.id);
        // Quote arguments that might contain spaces or special chars
        if (this.needsQuoting(processed)) {
          const escaped = this.escapeShellValueSmart(processed);
          return `"${escaped}"`;
        }
        return processed;
      });
      fullCommand = `${fullCommand} ${processedArgs.join(' ')}`;
    }

    // Handle prompt template if present
    if (promptTemplate && typeof promptTemplate === 'object') {
      const template = promptTemplate as Record<string, unknown>;

      if (template['type'] === 'prompt' && template['content']) {
        // Process the prompt template content
        let promptContent = String(template['content']);

        // Replace template parameters in the prompt
        if (typeof templateParameters === 'object' && templateParameters !== null) {
          Object.entries(templateParameters as Record<string, unknown>).forEach(([key, value]) => {
            const processedValue = this.processTemplateVariables(String(value || ''), node.id);
            // Handle both ${key} and {{key}} syntax in prompts
            promptContent = promptContent.replace(
              new RegExp(`\\$\\{${key}\\}`, 'g'),
              processedValue
            );
            promptContent = promptContent.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
              processedValue
            );
          });
        }

        // Process any remaining template variables in the prompt content
        promptContent = this.processTemplateVariables(promptContent, node.id);

        // Create a temporary file for the prompt (if needed by the command)
        parts.push('    # Prepare agent prompt');
        parts.push('    local prompt_content');
        parts.push(`    read -r -d '' prompt_content << 'AGENT_PROMPT_EOF' || true`);
        parts.push(promptContent);
        parts.push('AGENT_PROMPT_EOF');
        parts.push('');

        // If the command expects input, provide the prompt through stdin or as an argument
        // This depends on how the agent command is structured
        if (
          fullCommand.includes('-c') ||
          (Array.isArray(args) && args.some(arg => String(arg) === '-c'))
        ) {
          // For shell commands, pass the prompt as a command argument
          fullCommand = `${fullCommand} "\$prompt_content"`;
        } else if (fullCommand.includes('opencode')) {
          // For opencode commands, pass the prompt as a quoted argument
          fullCommand = `${fullCommand} "\$prompt_content"`;
        } else {
          // For other commands, assume they can take a prompt as an argument
          fullCommand = `${fullCommand} "\$prompt_content"`;
        }
      }
    }

    // Execute the command with timeout
    parts.push('    # Execute agent command');
    parts.push(`    local exit_code=0`);
    parts.push(`    local agent_output=""`);
    parts.push('');

    if (timeout && timeout > 0) {
      parts.push(`    # Execute with ${timeout}s timeout`);
      parts.push(`    if command -v timeout >/dev/null 2>&1; then`);
      parts.push(`        agent_output=$(timeout ${timeout} ${fullCommand} 2>&1) || exit_code=$?`);
      parts.push(`    else`);
      parts.push(`        # Fallback for systems without timeout command`);
      parts.push(`        agent_output=$(${fullCommand} 2>&1) || exit_code=$?`);
      parts.push(`    fi`);
    } else {
      parts.push(`    agent_output=$(${fullCommand} 2>&1) || exit_code=$?`);
    }

    parts.push('');

    // Store results in workflow variables
    parts.push('    # Store agent execution results');
    parts.push(`    set_workflow_var "agent_${node.id}_output" "\$agent_output"`);
    parts.push(`    set_workflow_var "agent_${node.id}_exit_code" "\$exit_code"`);
    parts.push(`    set_workflow_var "agent_${node.id}_success" "false"`);
    parts.push('');

    // Handle success/failure
    parts.push('    # Handle execution result');
    parts.push('    if [[ $exit_code -eq 0 ]]; then');
    parts.push(`        set_workflow_var "agent_${node.id}_success" "true"`);
    parts.push(`        log_success "Agent execution completed successfully"`);
    parts.push('        echo "$agent_output"');
    parts.push('    else');
    parts.push('        case $exit_code in');
    parts.push('            124)');
    parts.push(`                log_error "Agent execution timed out after ${timeout}s"`);
    parts.push('                ;;');
    parts.push('            127)');
    parts.push(`                log_error "Agent command not found: ${String(command)}"`);
    parts.push('                ;;');
    parts.push('            *)');
    parts.push(`                log_error "Agent execution failed with exit code: \$exit_code"`);
    parts.push('                ;;');
    parts.push('        esac');
    parts.push('        echo "$agent_output" >&2');
    parts.push('    fi');
    parts.push('');

    // Restore working directory if changed
    if (workingDirectory) {
      parts.push('    # Restore original directory');
      parts.push('    if [[ -n "${original_dir:-}" ]]; then');
      parts.push(
        '        cd "$original_dir" || log_warning "Failed to restore original directory"'
      );
      parts.push('    fi');
      parts.push('');
    }

    parts.push('    return $exit_code');
    parts.push('}');
    parts.push('');
    parts.push(`# Execute agent function`);
    parts.push(`${functionName}`);

    return parts.join('\n');
  }

  /**
   * Smart shell value escaping that preserves get_var call integrity
   */
  private escapeShellValueSmart(value: string): string {
    // Split on get_var calls to handle them separately
    const parts = value.split(/(get_var "[^"]*" "[^"]*")/);

    return parts
      .map((part, index) => {
        // Even indices are regular text, odd indices are get_var calls
        if (index % 2 === 0) {
          // Regular text - escape only unescaped quotes
          return part.replace(/([^\\])"/g, '$1\\"').replace(/^"/g, '\\"');
        } else {
          // get_var call - don't escape quotes inside
          return part;
        }
      })
      .join('');
  }

  private needsQuoting(arg: string): boolean {
    // Quote if contains spaces, special chars, or is a command substitution result
    return (
      arg.includes(' ') ||
      arg.includes('*') ||
      arg.includes('?') ||
      arg.includes('$(') ||
      arg.includes('`')
    );
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // Agent-specific validation
    const command = this.getNodeData(node, 'command', '');
    if (!command || String(command).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_AGENT_COMMAND',
        message: 'Agent node must have a command',
        nodeId: node.id,
      });
      result.valid = false;
    }

    // Validate timeout if specified
    const timeout = this.getNodeData(node, 'timeout', undefined);
    if (timeout !== undefined) {
      const timeoutNum = Number(timeout);
      if (isNaN(timeoutNum) || timeoutNum < 0) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_TIMEOUT',
          message: 'Agent timeout must be a positive number',
          nodeId: node.id,
        });
        result.valid = false;
      } else if (timeoutNum > 300) {
        result.warnings.push({
          type: 'warning',
          code: 'HIGH_TIMEOUT',
          message: 'Agent timeout is very high (>5 minutes), consider reducing it',
          nodeId: node.id,
        });
      }
    }

    // Validate prompt template if specified
    const promptTemplate = this.getNodeData(node, 'prompt_template', null);
    if (promptTemplate && typeof promptTemplate === 'object') {
      const template = promptTemplate as Record<string, unknown>;

      if (!template['type'] || template['type'] !== 'prompt') {
        result.warnings.push({
          type: 'warning',
          code: 'INVALID_PROMPT_TEMPLATE_TYPE',
          message: 'Agent prompt template should have type "prompt"',
          nodeId: node.id,
        });
      }

      if (!template['content'] || String(template['content']).trim() === '') {
        result.warnings.push({
          type: 'warning',
          code: 'EMPTY_PROMPT_TEMPLATE',
          message: 'Agent prompt template content is empty',
          nodeId: node.id,
        });
      }
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    let variables: string[] = [];

    // Extract variables from command
    const command = this.getNodeData(node, 'command', '');
    variables = variables.concat(this.extractTemplateVariables(String(command)));

    // Extract variables from args
    const args = this.getNodeData(node, 'args', []);
    if (Array.isArray(args)) {
      args.forEach(arg => {
        variables = variables.concat(this.extractTemplateVariables(String(arg)));
      });
    }

    // Extract variables from environment variables
    const environmentVariables = this.getNodeData(node, 'environment_variables', {});
    if (typeof environmentVariables === 'object' && environmentVariables !== null) {
      Object.values(environmentVariables as Record<string, unknown>).forEach(value => {
        variables = variables.concat(this.extractTemplateVariables(String(value || '')));
      });
    }

    // Extract variables from working directory
    const workingDirectory = this.getNodeData(node, 'working_directory', '');
    if (workingDirectory) {
      variables = variables.concat(this.extractTemplateVariables(String(workingDirectory)));
    }

    // Extract variables from prompt template content
    const promptTemplate = this.getNodeData(node, 'prompt_template', null);
    if (promptTemplate && typeof promptTemplate === 'object') {
      const template = promptTemplate as Record<string, unknown>;
      if (template['content']) {
        variables = variables.concat(this.extractTemplateVariables(String(template['content'])));
      }
    }

    // Extract variables from template parameters
    const templateParameters = this.getNodeData(node, 'template_parameters', {});
    if (typeof templateParameters === 'object' && templateParameters !== null) {
      Object.values(templateParameters as Record<string, unknown>).forEach(value => {
        variables = variables.concat(this.extractTemplateVariables(String(value || '')));
      });
    }

    // Add standard output variables that this node creates
    const outputVars = [
      `AGENT_${node.id.toUpperCase()}_OUTPUT`,
      `AGENT_${node.id.toUpperCase()}_EXIT_CODE`,
      `AGENT_${node.id.toUpperCase()}_SUCCESS`,
    ];

    return [...new Set([...variables, ...outputVars])];
  }
}
