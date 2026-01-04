/**
 * Variable Assignment Node Generator
 *
 * Generates shell script code for variable assignment nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class VariableAssignmentNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'variable-assignment';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const rawVariable = this.getNodeData(node, 'variable', 'TEMP_VAR');
    const variable = this.sanitizeVariableName(String(rawVariable));
    const rawValue = this.getNodeData(node, 'value', '');

    // Escape value to prevent injection
    const value = this.escapeShellValue(String(rawValue));

    // Use the new variable management function with debug logging
    return `set_var "${variable.toUpperCase()}" "${value}" "${node.id}"`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // Variable assignment specific validation
    const variable = this.getNodeData(node, 'variable', '');
    if (!variable || String(variable).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_VARIABLE_NAME',
        message: 'Variable assignment node must specify a variable name',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variable = this.getNodeData(node, 'variable', '');
    if (variable && String(variable).trim() !== '') {
      return [this.sanitizeVariableName(String(variable)).toUpperCase()];
    }
    return [];
  }
}
