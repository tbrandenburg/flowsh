/**
 * Code Node Generator
 *
 * Generates shell script code for code execution nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class CodeNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'code';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo "No command specified"');
    const args = this.getNodeData(node, 'args', []);

    // Generate the command with properly processed arguments
    let fullCommand = this.processTemplateVariables(String(command), node.id);

    if (Array.isArray(args) && args.length > 0) {
      // Process each argument and add to command with proper quoting
      const processedArgs = args.map(arg => {
        const argStr = String(arg);
        const processed = this.processTemplateVariables(argStr, node.id);
        // Quote arguments that might contain spaces or special chars
        if (this.needsQuoting(processed)) {
          // For shell commands with complex quoting, we need careful escaping
          const escaped = this.escapeShellValueSmart(processed);
          return `"${escaped}"`;
        }
        return processed;
      });
      fullCommand = `${fullCommand} ${processedArgs.join(' ')}`;
    }

    return fullCommand;
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
          // Replace " with \" but don't replace \" with \\"
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

    // Code-specific validation
    const command = this.getNodeData(node, 'command', '');
    if (!command || String(command).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_CODE_COMMAND',
        message: 'Code node must have a command',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const command = this.getNodeData(node, 'command', '');
    const args = this.getNodeData(node, 'args', []);

    let variables = this.extractTemplateVariables(String(command));

    // Extract variables from args as well
    if (Array.isArray(args)) {
      args.forEach(arg => {
        variables = variables.concat(this.extractTemplateVariables(String(arg)));
      });
    }

    return [...new Set(variables)];
  }
}
