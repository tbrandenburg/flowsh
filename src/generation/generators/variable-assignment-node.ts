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
    const assignmentType = String(this.getNodeData(node, 'assignment_type', 'constant'));

    if (assignmentType === 'expression') {
      // Handle expression-based assignment
      const expression = this.processConfigValue(this.getNodeData(node, 'expression', ''), '');

      if (expression) {
        return `# Node: ${node.id}
${variable.toUpperCase()}=$(${expression})
set_var "${variable.toUpperCase()}" "\$${variable.toUpperCase()}" "${node.id}"`;
      } else {
        // Fallback to empty if no expression
        return `set_var "${variable.toUpperCase()}" "" "${node.id}"`;
      }
    } else {
      // Handle constant value assignment (original logic)
      const rawValue = this.getNodeData(node, 'value', '');
      const value = this.escapeShellValue(String(rawValue));

      return `set_var "${variable.toUpperCase()}" "${value}" "${node.id}"`;
    }
  }

  /**
   * Process configuration values with template variable substitution
   */
  private processConfigValue(value: any, defaultValue: any): string {
    if (!value) return defaultValue.toString();

    const stringValue = value.toString();

    // Handle template variables like ${variable_name}
    if (stringValue.includes('${')) {
      // Replace all ${var_name} with $(get_workflow_var "VAR_NAME" "0")
      let result = stringValue.replace(/\$\{([^}]+)\}/g, (_match: string, varName: string) => {
        const sanitizedVar = this.sanitizeVariableName(varName).toUpperCase();
        return `$(get_workflow_var "${sanitizedVar}" "0")`;
      });
      return result;
    }

    return stringValue;
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
