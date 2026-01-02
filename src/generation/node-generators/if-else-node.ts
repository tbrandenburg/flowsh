/**
 * If-Else Node Generator
 *
 * Generates shell functions for conditional logic nodes with condition evaluation.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator } from './base-generator.js';

export class IfElseNodeGenerator implements NodeGenerator {
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;
    const conditions = data.conditions || [];

    return `# Execute if-else node: ${node.id}
${functionName}() {
    log_step "🔀 Evaluating Conditions: ${data.title || node.id}"
    
    local condition_result=false
    ${this.generateConditionChecks(conditions)}
    
    if [[ "\$condition_result" == "true" ]]; then
        log_info "Condition(s) evaluated to true"
        set_workflow_state "branch_taken" "true"
    else
        log_info "Condition(s) evaluated to false"
        set_workflow_state "branch_taken" "false"
    fi
    
    set_workflow_state "current_node" "${node.id}"
}`;
  }

  private generateConditionChecks(conditions: any[]): string {
    if (conditions.length === 0) {
      return `
    # No conditions specified, defaulting to true
    condition_result=true`;
    }

    return conditions
      .map((condition: any, index: number) => {
        const conditionText = condition.condition || 'true';
        const shellCondition = this.convertConditionToShell(conditionText);

        return `
    # Evaluate condition ${index + 1}: ${conditionText}
    if ${shellCondition}; then
        log_debug "Condition ${index + 1} evaluated to true"
        condition_result=true
    fi`;
      })
      .join('');
  }

  private convertConditionToShell(condition: string): string {
    // Convert flowsh condition syntax to shell test syntax
    let shellCondition = condition;

    // Convert ${variable} syntax to shell variable expansion
    shellCondition = shellCondition.replace(/\$\{([^}]+)\}/g, '"$(get_workflow_var "$1" "")"');

    // Convert JavaScript-style operators to shell test operators
    shellCondition = shellCondition.replace(/===/g, '=');
    shellCondition = shellCondition.replace(/!==/g, '!=');
    shellCondition = shellCondition.replace(/&&/g, '&& ');
    shellCondition = shellCondition.replace(/\|\|/g, '|| ');

    // Convert basic comparisons to shell test format
    if (
      shellCondition.includes('=') ||
      shellCondition.includes('!=') ||
      shellCondition.includes('>') ||
      shellCondition.includes('<')
    ) {
      return `[[ ${shellCondition} ]]`;
    }

    // Default to treating as a command/function call
    return shellCondition;
  }

  validateNode(node: WorkflowNode): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const data = node.data as any;

    // Validate that if-else nodes have conditions
    if (!data.conditions || !Array.isArray(data.conditions) || data.conditions.length === 0) {
      warnings.push('If-else node has no conditions defined - will default to true');
    }

    // Validate condition syntax
    if (data.conditions) {
      data.conditions.forEach((condition: any, index: number) => {
        if (!condition.condition || typeof condition.condition !== 'string') {
          errors.push(`Condition ${index + 1} is missing or invalid`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getRequiredVariables(node: WorkflowNode): string[] {
    const data = node.data as any;
    const variables: string[] = [];

    if (data.conditions) {
      data.conditions.forEach((condition: any) => {
        if (condition.condition) {
          // Extract variable names from ${variable} patterns
          const matches = condition.condition.match(/\$\{([^}]+)\}/g) || [];
          matches.forEach((match: string) => {
            const varName = match.slice(2, -1); // Remove ${ and }
            if (!variables.includes(varName)) {
              variables.push(varName);
            }
          });
        }
      });
    }

    return variables;
  }
}
