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

  /**
   * Process template variables for subshell context by using local variable references
   * instead of get_var calls
   */
  private processTemplateVariablesForSubshell(
    command: string,
    _nodeId: string = 'template_node'
  ): string {
    // Defensive programming: ensure command is a string
    if (typeof command !== 'string') {
      command = String(command || '');
    }

    // Handle new {{#variable.path#}} syntax
    let result = command.replace(/\{\{#([^#]+)#\}\}/g, (_, varPath: string) => {
      // Convert paths like "env.tech_stack" to shell variable access
      const parts = varPath.split('.');
      if (parts.length === 1) {
        const sanitizedVar = this.sanitizeVariableName(parts[0] || '');
        return `$${sanitizedVar.toUpperCase()}`;
      } else {
        // For complex paths, keep original for now
        return `{{#${varPath}#}}`;
      }
    });

    // Handle traditional {{variable}} syntax
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
      const sanitizedVar = this.sanitizeVariableName(varName || '');
      return `$${sanitizedVar.toUpperCase()}`;
    });

    // For code nodes, we do NOT process ${variable} syntax because it conflicts
    // with bash parameter expansion. If someone wants flowsh template variables
    // in code, they should use {{variable}} syntax.
    // This preserves bash syntax like ${var:-default}, ${#var}, ${var:start:length}, etc.

    return result;
  }

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo "No command specified"');
    const args = this.getNodeData(node, 'args', []);

    // Extract all variables that will be used in the command and args
    const allVariables = this.getVariables(node);

    // Generate variable resolution code first (for subshell context)
    const variableResolution = allVariables
      .map(varName => {
        const sanitizedVar = this.sanitizeVariableName(varName);
        return `${sanitizedVar.toUpperCase()}="$(get_var "${sanitizedVar.toUpperCase()}" "${node.id}")"`;
      })
      .join('\n');

    // Process template variables differently for subshell context
    // Instead of get_var calls, use the pre-resolved local variables
    let fullCommand = this.processTemplateVariablesForSubshell(String(command), node.id);

    if (Array.isArray(args) && args.length > 0) {
      // Special handling for shell interpreters with script arguments
      const isShellCommand = String(command).includes('bash') || String(command).includes('sh');
      const stringArgs = args.map(arg => String(arg));
      const hasCFlag = stringArgs.includes('-c');

      // Process each argument for subshell context
      const processedArgs = args.map((arg, index) => {
        const argStr = String(arg);
        const processed = this.processTemplateVariablesForSubshell(argStr, node.id);

        // For shell script content in bash -c commands, escape quotes properly
        if (isShellCommand && hasCFlag && index > 0 && stringArgs[index - 1] === '-c') {
          // Escape shell-sensitive characters to avoid outer shell expansion.
          const escaped = this.escapeShellValue(processed);
          return `"${escaped}"`;
        }

        // Quote arguments that might contain spaces or special chars
        if (this.needsQuoting(processed)) {
          const escaped = this.escapeShellValueSmart(processed);
          return `"${escaped}"`;
        }
        return processed;
      });
      fullCommand = `${fullCommand} ${processedArgs.join(' ')}`;
    }

    // If we have variables to resolve, wrap the command in a subshell with variable resolution
    if (allVariables.length > 0) {
      return `(\n${variableResolution}\n${fullCommand}\n)`;
    }

    // If no variables, use the original approach
    return fullCommand;
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

    let variables = this.extractTemplateVariablesForCode(String(command));

    // Extract variables from args as well
    if (Array.isArray(args)) {
      args.forEach(arg => {
        variables = variables.concat(this.extractTemplateVariablesForCode(String(arg)));
      });
    }

    return [...new Set(variables)];
  }

  /**
   * Extract template variables from code, being careful not to confuse bash syntax
   * with flowsh template variables
   */
  private extractTemplateVariablesForCode(text: string): string[] {
    if (typeof text !== 'string') {
      text = String(text || '');
    }

    const variables: string[] = [];

    // Extract {{#variable.path#}} variables
    const newSyntaxMatches = text.match(/\{\{#([^#]+)#\}\}/g) || [];
    newSyntaxMatches.forEach(match => {
      const varPath = match.replace(/\{\{#|#\}\}/g, '');
      const parts = varPath.split('.');
      if (parts.length > 0 && parts[0]) {
        variables.push(this.sanitizeVariableName(parts[0]).toUpperCase());
      }
    });

    // Extract {{variable}} variables
    const traditionalMatches = text.match(/\{\{(\w+)\}\}/g) || [];
    traditionalMatches.forEach(match => {
      const rawVarName = match.replace(/\{\{|\}\}/g, '');
      variables.push(this.sanitizeVariableName(rawVarName || '').toUpperCase());
    });

    // For code nodes, we do NOT extract ${variable} patterns because they conflict
    // with bash parameter expansion. If someone wants flowsh template variables
    // in code, they should use {{variable}} syntax.

    return [...new Set(variables)];
  }
}
