/**
 * Base Node Generator
 *
 * Provides common functionality for all node generators
 */

import { NodeGenerator, GenerationContext } from '../registry/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { WorkflowNode } from '../../dsl/types.js';

/**
 * Abstract base class for node generators with common utilities
 */
export abstract class BaseNodeGenerator implements NodeGenerator {
  abstract readonly nodeType: string;

  /**
   * Generate shell script code for the node
   */
  abstract generate(node: WorkflowNode, context: GenerationContext): string;

  /**
   * Default validation - can be overridden by subclasses
   */
  validate(node: WorkflowNode): ValidationResult {
    const errors: Array<{
      type: 'error';
      code: string;
      message: string;
      nodeId?: string;
    }> = [];

    const warnings: Array<{
      type: 'warning';
      code: string;
      message: string;
      nodeId?: string;
    }> = [];

    // Basic validation all nodes should have
    if (!node.id) {
      errors.push({
        type: 'error' as const,
        code: 'MISSING_NODE_ID',
        message: 'Node must have an ID',
        nodeId: node.id,
      });
    }

    if (!node.data) {
      errors.push({
        type: 'error' as const,
        code: 'MISSING_NODE_DATA',
        message: 'Node must have data configuration',
        nodeId: node.id,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize shell variable names to prevent injection
   */
  protected sanitizeVariableName(varName: string): string {
    // Defensive programming: ensure varName is a string
    if (typeof varName !== 'string') {
      varName = String(varName || 'var');
    }

    // Only allow alphanumeric and underscore, starting with letter/underscore
    const sanitized = varName.replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      return `VAR_${sanitized}`;
    }
    return sanitized;
  }

  /**
   * Escape shell value to prevent injection
   */
  protected escapeShellValue(value: string): string {
    // Escape double quotes and backslashes
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * Replace template variables in command with getter function calls
   * Supports {{variable}}, {{#variable.path#}}, and ${variable} syntax
   */
  protected processTemplateVariables(command: string, nodeId: string = 'template_node'): string {
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
        return `$(get_var "${sanitizedVar.toUpperCase()}" "${nodeId}")`;
      } else {
        // For complex paths, create a shell variable lookup
        // This will be processed by the substitute_variables function in the generated script
        return `{{#${varPath}#}}`; // Keep the original for later processing
      }
    });

    // Handle traditional {{variable}} syntax
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
      const sanitizedVar = this.sanitizeVariableName(varName || '');
      return `$(get_var "${sanitizedVar.toUpperCase()}" "${nodeId}")`;
    });

    // Handle ${variable} syntax (common shell-style variable references)
    result = result.replace(/\$\{(\w+)\}/g, (_, varName: string) => {
      const sanitizedVar = this.sanitizeVariableName(varName || '');
      return `$(get_var "${sanitizedVar.toUpperCase()}" "${nodeId}")`;
    });

    // Escape remaining dollar signs that are meant for inner shell contexts
    // This prevents issues with commands like 'sh -c "... awk '{print $1}' ..."'
    // where the $1 should be escaped to avoid "unbound variable" errors
    result = result.replace(/\$(?![\(\{])/g, '\\$');

    return result;
  }

  /**
   * Extract template variable names from a command string
   * Supports {{variable}}, {{#variable.path#}}, and ${variable} syntax
   */
  protected extractTemplateVariables(text: string): string[] {
    // Defensive programming: ensure text is a string
    if (typeof text !== 'string') {
      text = String(text || '');
    }

    const variables: string[] = [];

    // Extract {{#variable.path#}} variables
    const newSyntaxMatches = text.match(/\{\{#([^#]+)#\}\}/g) || [];
    newSyntaxMatches.forEach(match => {
      const varPath = match.replace(/\{\{#|#\}\}/g, '');
      const parts = varPath.split('.');
      // Add the base variable name
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

    // Extract ${variable} variables
    const shellStyleMatches = text.match(/\$\{(\w+)\}/g) || [];
    shellStyleMatches.forEach(match => {
      const rawVarName = match.replace(/\$\{|\}/g, '');
      variables.push(this.sanitizeVariableName(rawVarName || '').toUpperCase());
    });

    return [...new Set(variables)];
  }

  /**
   * Generate a shell comment for the node
   */
  protected generateNodeComment(node: WorkflowNode): string {
    const title = 'title' in node.data && node.data.title ? String(node.data.title) : node.id;
    return `# Node: ${node.id} (${title})`;
  }

  /**
   * Get node data property safely with type checking
   */
  protected getNodeData<T>(node: WorkflowNode, property: string, defaultValue: T): T {
    if (!node.data) {
      return defaultValue;
    }

    // Use type assertion to access dynamic properties
    const nodeData = node.data as Record<string, unknown>;
    const value = nodeData[property];

    if (value === null || value === undefined) {
      return defaultValue;
    }

    return value as T;
  }
}
