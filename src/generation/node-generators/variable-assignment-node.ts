/**
 * Variable Assignment Node Generator
 *
 * Generates shell functions for Variable Assignment nodes.
 * Handles constant values, variable copying, and expression evaluation.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator, ValidationResult } from './base-generator.js';

export class VariableAssignmentNodeGenerator implements NodeGenerator {
  /**
   * Validates a Variable Assignment node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const data = node.data as any;

    // Check for variable name
    if (!data.variable) {
      errors.push(`Variable Assignment node ${node.id}: No variable name specified`);
    } else if (typeof data.variable !== 'string') {
      errors.push(`Variable Assignment node ${node.id}: variable name must be a string`);
    }

    // Check assignment type
    const assignmentType = data.assignment_type || 'constant';
    if (!['constant', 'variable', 'expression'].includes(assignmentType)) {
      errors.push(
        `Variable Assignment node ${node.id}: Invalid assignment_type '${assignmentType}'. Must be 'constant', 'variable', or 'expression'`
      );
    }

    // Validate based on assignment type
    switch (assignmentType) {
      case 'constant':
        if (data.value === undefined || data.value === null) {
          warnings.push(
            `Variable Assignment node ${node.id}: No value specified for constant assignment`
          );
        }
        break;
      case 'variable':
        if (!data.source_variable) {
          errors.push(
            `Variable Assignment node ${node.id}: source_variable required for variable assignment`
          );
        }
        break;
      case 'expression':
        if (!data.expression && !data.value) {
          errors.push(
            `Variable Assignment node ${node.id}: expression or value required for expression assignment`
          );
        }
        warnings.push(
          `Variable Assignment node ${node.id}: Expression evaluation not fully implemented yet`
        );
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates shell function for a Variable Assignment node
   */
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;

    return `# Execute variable assignment node: ${node.id}
${functionName}() {
    log_step "📝 Variable Assignment: ${data.title || node.id}"
    
    local variable_name="${data.variable}"
    local assignment_type="${data.assignment_type || 'constant'}"
    
    case "\$assignment_type" in
        "constant")
            set_workflow_var "\$variable_name" "${data.value || ''}"
            ;;
        "variable")
            local source_value=\$(get_workflow_var "${data.source_variable || ''}" "")
            set_workflow_var "\$variable_name" "\$source_value"
            ;;
        "expression")
            log_warning "Expression evaluation not implemented, using constant value"
            set_workflow_var "\$variable_name" "${data.value || ''}"
            ;;
    esac
    
    log_success "Variable '\$variable_name' assigned"
    set_workflow_state "current_node" "${node.id}"
}`;
  }
}
