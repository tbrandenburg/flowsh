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
   * Replace template variables in command with sanitized variable references
   */
  protected processTemplateVariables(command: string): string {
    return command.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
      const sanitizedVar = this.sanitizeVariableName(varName);
      return `\${${sanitizedVar.toUpperCase()}}`;
    });
  }

  /**
   * Extract template variable names from a command string
   */
  protected extractTemplateVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(match => {
      const rawVarName = match.replace(/\{\{|\}\}/g, '');
      return this.sanitizeVariableName(rawVarName).toUpperCase();
    });
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
