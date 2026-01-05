/**
 * Loop Node Generator
 *
 * Generates shell script code for loop nodes with conditional repetition
 */

import { WorkflowNode, LoopNodeData, IfElseCondition } from '../../dsl/types.js';
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

    // Extract configuration with defaults and template variable processing
    const maxIterations = this.processConfigValue(data.max_iterations, 100);
    const breakOn = data.break_on || 'condition';
    const title = data.title || node.id;

    // Generate condition evaluation
    const conditionCode = this.generateConditionEvaluation(data.condition, node.id);

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🔄 Starting Loop: ${this.escapeShellValue(title)}"
    
    # Loop configuration
    local loop_counter=0
    local max_iterations=${maxIterations}
    local continue_loop=true
    local break_on="${breakOn}"
    
    # Loop execution with safety checks
    while [[ "\$continue_loop" == "true" && \$loop_counter -lt \$max_iterations ]]; do
        log_debug "Loop iteration \$loop_counter (max: \$max_iterations)"
        
        # Set loop context variables for child nodes
        set_workflow_var "loop_index" "\$loop_counter"
        set_workflow_var "loop_iteration" "\$((loop_counter + 1))"
        
        # Evaluate loop condition
        local condition_result
        ${conditionCode}
        
        # Check if we should continue based on condition and break_on setting
        if [[ "\$break_on" == "condition" ]]; then
            if [[ "\$condition_result" != "true" ]]; then
                log_info "Loop exit condition met at iteration \$loop_counter"
                break
            fi
        fi
        
        # Execute loop body (child nodes would be called here by the main executor)
        log_debug "Executing loop body for iteration \$loop_counter"
        
        # This is where child nodes would be executed
        # The main executor will handle the edge routing to child nodes
        
        # Increment counter for next iteration
        ((loop_counter++))
        
        # Safety check for max iterations
        if [[ \$loop_counter -ge \$max_iterations ]]; then
            log_warning "Loop reached max iterations (\$max_iterations), stopping"
            break
        fi
    done
    
    # Set final loop variables
    set_workflow_var "loop_final_count" "\$loop_counter"
    set_workflow_var "loop_completed" "true"
    
    log_success "Loop completed after \$loop_counter iterations"
}`;
  }

  /**
   * Generate condition evaluation code that sets condition_result variable
   */
  private generateConditionEvaluation(condition: IfElseCondition, nodeId: string): string {
    if (!condition) {
      return 'condition_result="false"  # No condition specified';
    }

    const variable = this.sanitizeVariableName(condition.variable).toUpperCase();
    const operator = condition.comparison_operator;
    const value = condition.value;

    // Process the value to handle template variables using base class method
    const processedValue = this.processTemplateVariables(String(value), nodeId);

    // Generate the appropriate comparison based on operator
    let comparisonCode = '';

    switch (operator) {
      case '==':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" == "${this.escapeShellValue(String(value))}" ]]`;
        break;
      case '!=':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" != "${this.escapeShellValue(String(value))}" ]]`;
        break;
      case '>':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") > ${processedValue} ))`;
        break;
      case '>=':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") >= ${processedValue} ))`;
        break;
      case '<':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") < ${processedValue} ))`;
        break;
      case '<=':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") <= ${processedValue} ))`;
        break;
      case 'contains':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" == *"${this.escapeShellValue(String(value))}"* ]]`;
        break;
      case 'not_contains':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" != *"${this.escapeShellValue(String(value))}"* ]]`;
        break;
      case 'is_empty':
        comparisonCode = `[[ -z "\$(get_workflow_var "${variable}" "")" ]]`;
        break;
      case 'is_not_empty':
        comparisonCode = `[[ -n "\$(get_workflow_var "${variable}" "")" ]]`;
        break;
      case '!=':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" != "${this.escapeShellValue(String(value))}" ]]`;
        break;
      case '>':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") > ${processedValue} ))`;
        break;
      case '<':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") < ${processedValue} ))`;
        break;
      case '>=':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") >= ${processedValue} ))`;
        break;
      case '<=':
        comparisonCode = `(( \$(get_workflow_var "${variable}" "0") <= ${processedValue} ))`;
        break;
      case 'contains':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" == *"${this.escapeShellValue(String(value))}"* ]]`;
        break;
      case 'not_contains':
        comparisonCode = `[[ "\$(get_workflow_var "${variable}" "")" != *"${this.escapeShellValue(String(value))}"* ]]`;
        break;
      case 'is_empty':
        comparisonCode = `[[ -z "\$(get_workflow_var "${variable}" "")" ]]`;
        break;
      case 'is_not_empty':
        comparisonCode = `[[ -n "\$(get_workflow_var "${variable}" "")" ]]`;
        break;
      default:
        return `condition_result="false"  # Unsupported operator: ${operator}`;
    }

    return `        # Evaluate condition: ${variable} ${operator} ${value}
        if ${comparisonCode}; then
            condition_result="true"
        else
            condition_result="false"
        fi`;
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
