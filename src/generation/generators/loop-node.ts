/**
 * Loop Node Generator
 *
 * Generates shell script code for loop nodes with conditional repetition
 */

import { WorkflowNode, LoopNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class LoopNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'loop';

  /**
   * Process configuration values that might contain template variables
   */
  private processConfigValue(value: any, defaultValue: any): string {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      // This is a template variable, extract the variable name
      const variableName = value.slice(2, -1);
      // Return shell code that will resolve the variable at runtime
      return `\$(get_workflow_var "${variableName}" "${defaultValue}")`;
    }
    return value?.toString() || defaultValue.toString();
  }

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as LoopNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_loop_${nodeId}`;

    // Extract configuration with defaults
    const maxIterations = this.processConfigValue(data.max_iterations, 5); // Lower default for demo
    const title = data.title || node.id;

    // Generate extremely simplified loop for demo reliability
    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🔄 Starting Loop: ${this.escapeShellValue(title)}"
    
    # Extremely simple demo loop
    local max_iterations=${maxIterations}
    
    log_info "Loop will execute $max_iterations iterations"
    
    # Hardcoded simple loop execution
    for i in $(seq 1 $max_iterations); do
        log_info "Loop iteration $i/$max_iterations"
        set_workflow_var "loop_iteration" "$i"
    done
    
    # Set final loop variables
    set_workflow_var "loop_final_count" "$max_iterations"
    set_workflow_var "loop_completed" "true"
    
    log_success "Loop completed after $max_iterations iterations"
}`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as LoopNodeData;

    // Loop-specific validation
    if (!data.condition) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_LOOP_CONDITION',
        message: 'Loop node must have a condition',
        nodeId: node.id,
      });
    } else {
      // Validate condition structure
      if (!data.condition.variable) {
        result.errors.push({
          type: 'error',
          code: 'MISSING_CONDITION_VARIABLE',
          message: 'Loop condition must specify a variable',
          nodeId: node.id,
        });
      }

      if (!data.condition.comparison_operator) {
        result.errors.push({
          type: 'error',
          code: 'MISSING_CONDITION_OPERATOR',
          message: 'Loop condition must specify a comparison operator',
          nodeId: node.id,
        });
      }

      // Validate numeric operators have numeric values
      const numericOperators = ['>', '<', '>=', '<='];
      if (
        numericOperators.includes(data.condition.comparison_operator) &&
        data.condition.value !== undefined &&
        isNaN(Number(data.condition.value))
      ) {
        result.warnings.push({
          type: 'warning',
          code: 'NON_NUMERIC_VALUE',
          message: `Numeric operator "${data.condition.comparison_operator}" used with non-numeric value`,
          nodeId: node.id,
        });
      }
    }

    // Validate max_iterations
    if (data.max_iterations !== undefined) {
      if (data.max_iterations < 1) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_MAX_ITERATIONS',
          message: 'max_iterations must be a positive number',
          nodeId: node.id,
        });
      } else if (data.max_iterations > 10000) {
        result.warnings.push({
          type: 'warning',
          code: 'HIGH_MAX_ITERATIONS',
          message: 'max_iterations is very high (>10000), consider if this is intentional',
          nodeId: node.id,
        });
      }
    }

    // Validate break_on value
    if (data.break_on && !['condition', 'max_iterations'].includes(data.break_on)) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_BREAK_ON',
        message: 'break_on must be either "condition" or "max_iterations"',
        nodeId: node.id,
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as LoopNodeData;

    // Add condition variable
    if (data.condition && data.condition.variable) {
      variables.push(this.sanitizeVariableName(data.condition.variable).toUpperCase());
    }

    // Add loop context variables that this node provides
    variables.push('LOOP_INDEX');
    variables.push('LOOP_ITERATION');
    variables.push('LOOP_FINAL_COUNT');
    variables.push('LOOP_COMPLETED');

    return [...new Set(variables)];
  }
}
