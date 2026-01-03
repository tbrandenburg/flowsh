/**
 * Iteration Node Generator
 *
 * Generates shell script code for iteration nodes that process arrays/lists
 */

import { WorkflowNode, IterationNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class IterationNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'iteration';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as IterationNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_iteration_${nodeId}`;

    // Extract configuration with defaults
    const inputVariable = this.sanitizeVariableName(data.input_variable);
    const outputVariable = data.output_variable
      ? this.sanitizeVariableName(data.output_variable)
      : 'iteration_results';
    const title = data.title || node.id;
    const parallel = data.parallel || false;
    const maxParallel = data.max_parallel || 4;

    if (parallel) {
      return this.generateParallelIteration(
        node,
        functionName,
        title,
        inputVariable,
        outputVariable,
        maxParallel
      );
    } else {
      return this.generateSequentialIteration(
        node,
        functionName,
        title,
        inputVariable,
        outputVariable
      );
    }
  }

  /**
   * Generate sequential iteration (Phase 2A implementation)
   */
  private generateSequentialIteration(
    node: WorkflowNode,
    functionName: string,
    title: string,
    inputVariable: string,
    outputVariable: string
  ): string {
    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🔁 Starting Iteration: ${this.escapeShellValue(title)}"
    
    # Get input array variable
    local input_variable="${inputVariable}"
    local output_variable="${outputVariable}"
    local input_array_raw="\$(get_workflow_var "\$input_variable" "")"
    
    # Parse input array (newline-separated values by default)
    local -a input_array=()
    if [[ -n "\$input_array_raw" ]]; then
        # Handle different array formats
        if [[ "\$input_array_raw" =~ ^\\[.*\\]$ ]]; then
            # JSON array format - extract values
            while IFS= read -r item; do
                [[ -n "\$item" ]] && input_array+=("\$item")
            done < <(echo "\$input_array_raw" | jq -r '.[]' 2>/dev/null || echo "\$input_array_raw")
        else
            # Newline-separated format
            while IFS= read -r item; do
                [[ -n "\$item" ]] && input_array+=("\$item")
            done <<< "\$input_array_raw"
        fi
    fi
    
    local total_items=\${#input_array[@]}
    log_info "Processing \$total_items items sequentially"
    
    # Results collection
    local -a output_results=()
    
    # Process each item
    for item_index in "\${!input_array[@]}"; do
        local current_item="\${input_array[\$item_index]}"
        
        log_debug "Processing item \$((item_index + 1))/\$total_items: \$current_item"
        
        # Set iteration context variables for child nodes
        set_workflow_var "iteration_item" "\$current_item"
        set_workflow_var "iteration_index" "\$item_index"
        set_workflow_var "iteration_number" "\$((item_index + 1))"
        set_workflow_var "iteration_total" "\$total_items"
        
        # Clear previous iteration result
        set_workflow_var "iteration_result" ""
        
        # Execute iteration body (child nodes would be called here by main executor)
        log_debug "Executing iteration body for item: \$current_item"
        
        # This is where child nodes would be executed
        # The main executor will handle the edge routing to child nodes
        
        # Collect result (after child nodes have executed)
        local iteration_result="\$(get_workflow_var "iteration_result" "\$current_item")"
        output_results+=("\$iteration_result")
        
        log_debug "Item \$((item_index + 1)) result: \$iteration_result"
    done
    
    # Aggregate results based on output format preference
    local aggregated_results
    if [[ \$total_items -eq 0 ]]; then
        aggregated_results=""
    else
        # Store as newline-separated by default, can be processed by aggregation nodes
        aggregated_results=\$(IFS=\$'\\n'; echo "\${output_results[*]}")
    fi
    
    # Set output variable
    set_workflow_var "\$output_variable" "\$aggregated_results"
    
    # Set iteration metadata
    set_workflow_var "iteration_count" "\$total_items"
    set_workflow_var "iteration_completed" "true"
    
    log_success "Iteration completed: processed \$total_items items"
}`;
  }

  /**
   * Generate parallel iteration (for future Phase 2C implementation)
   */
  private generateParallelIteration(
    node: WorkflowNode,
    functionName: string,
    title: string,
    inputVariable: string,
    outputVariable: string,
    _maxParallel: number
  ): string {
    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🔁 Starting Parallel Iteration: ${this.escapeShellValue(title)}"
    
    # Parallel iteration is planned for Phase 2C
    # For now, fall back to sequential processing
    log_warning "Parallel iteration not yet implemented, using sequential processing"
    
    # Use sequential implementation
    ${this.generateSequentialIteration(node, `${functionName}_sequential`, title, inputVariable, outputVariable).replace(functionName, `${functionName}_sequential`)}
    
    # Call sequential implementation
    ${functionName}_sequential
}`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as IterationNodeData;

    // Iteration-specific validation
    if (!data.input_variable) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_INPUT_VARIABLE',
        message: 'Iteration node must specify an input_variable',
        nodeId: node.id,
      });
    } else {
      // Validate variable name
      const sanitizedVar = this.sanitizeVariableName(data.input_variable);
      if (sanitizedVar !== data.input_variable) {
        result.warnings.push({
          type: 'warning',
          code: 'SANITIZED_VARIABLE_NAME',
          message: `Variable name "${data.input_variable}" was sanitized to "${sanitizedVar}"`,
          nodeId: node.id,
        });
      }
    }

    // Validate output variable
    if (data.output_variable) {
      const sanitizedVar = this.sanitizeVariableName(data.output_variable);
      if (sanitizedVar !== data.output_variable) {
        result.warnings.push({
          type: 'warning',
          code: 'SANITIZED_OUTPUT_VARIABLE',
          message: `Output variable name "${data.output_variable}" was sanitized to "${sanitizedVar}"`,
          nodeId: node.id,
        });
      }
    }

    // Validate parallel settings
    if (data.parallel) {
      result.warnings.push({
        type: 'warning',
        code: 'PARALLEL_NOT_IMPLEMENTED',
        message:
          'Parallel iteration is not yet implemented (Phase 2C), will use sequential processing',
        nodeId: node.id,
      });

      if (data.max_parallel !== undefined) {
        if (data.max_parallel < 1) {
          result.errors.push({
            type: 'error',
            code: 'INVALID_MAX_PARALLEL',
            message: 'max_parallel must be a positive number',
            nodeId: node.id,
          });
        } else if (data.max_parallel > 20) {
          result.warnings.push({
            type: 'warning',
            code: 'HIGH_MAX_PARALLEL',
            message: 'max_parallel is very high (>20), consider system resource limits',
            nodeId: node.id,
          });
        }
      }
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as IterationNodeData;

    // Add input variable
    if (data.input_variable) {
      variables.push(this.sanitizeVariableName(data.input_variable).toUpperCase());
    }

    // Add output variable
    if (data.output_variable) {
      variables.push(this.sanitizeVariableName(data.output_variable).toUpperCase());
    } else {
      variables.push('ITERATION_RESULTS');
    }

    // Add iteration context variables that this node provides
    variables.push('ITERATION_ITEM');
    variables.push('ITERATION_INDEX');
    variables.push('ITERATION_NUMBER');
    variables.push('ITERATION_TOTAL');
    variables.push('ITERATION_RESULT');
    variables.push('ITERATION_COUNT');
    variables.push('ITERATION_COMPLETED');

    return [...new Set(variables)];
  }
}
