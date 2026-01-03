/**
 * Variable Aggregation Node Generator
 *
 * Generates shell script code for aggregating results from multiple variables
 * using different aggregation methods (concat, sum, avg, merge, collect)
 */

import { WorkflowNode, VariableAggregationNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class VariableAggregationNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'variable-aggregation';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as VariableAggregationNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_aggregation_${nodeId}`;

    // Extract configuration with defaults
    const inputVars = data.input_variables || [];
    const outputVar = this.sanitizeVariableName(data.output_variable);
    const method = data.aggregation_method;
    const separator = this.escapeShellValue(data.separator || '\n');
    const title = data.title || node.id;

    // Generate input variable array for shell
    const inputVarList = inputVars.map(v => `"${this.sanitizeVariableName(v)}"`).join(' ');

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "📊 Variable Aggregation: ${this.escapeShellValue(title)}"

    local -a input_vars=(${inputVarList})
    local output_var="${outputVar}"
    local method="${method}"
    local separator=$'${separator}'

    case "$method" in
        "concat")
            log_debug "Concatenating \${#input_vars[@]} variables with separator"
            local -a values=()
            for var_name in "\${input_vars[@]}"; do
                local value="\$(get_workflow_var "\$var_name" "")"
                [[ -n "\$value" ]] && values+=("\$value")
            done
            
            if [[ \${#values[@]} -eq 0 ]]; then
                log_warning "No non-empty values to concatenate"
                set_workflow_var "\$output_var" ""
            else
                local result
                result=\$(IFS="\$separator"; echo "\${values[*]}")
                set_workflow_var "\$output_var" "\$result"
                log_success "Concatenated \${#values[@]} values into \$output_var"
            fi
            ;;

        "sum")
            log_debug "Summing numeric values from \${#input_vars[@]} variables"
            local total=0
            local valid_count=0
            
            for var_name in "\${input_vars[@]}"; do
                local value="\$(get_workflow_var "\$var_name" "0")"
                if [[ "\$value" =~ ^[+-]?[0-9]+(\.[0-9]+)?$ ]]; then
                    if command -v bc >/dev/null 2>&1; then
                        total=\$(echo "\$total + \$value" | bc -l)
                    else
                        # Fallback to integer arithmetic if bc not available
                        total=\$((total + \${value%.*}))
                    fi
                    ((valid_count++))
                else
                    log_warning "Skipping non-numeric value in \$var_name: \$value"
                fi
            done
            
            set_workflow_var "\$output_var" "\$total"
            log_success "Summed \$valid_count numeric values, result: \$total"
            ;;

        "avg")
            log_debug "Calculating average of numeric values from \${#input_vars[@]} variables"
            local total=0
            local valid_count=0
            
            for var_name in "\${input_vars[@]}"; do
                local value="\$(get_workflow_var "\$var_name" "0")"
                if [[ "\$value" =~ ^[+-]?[0-9]+(\.[0-9]+)?$ ]]; then
                    if command -v bc >/dev/null 2>&1; then
                        total=\$(echo "\$total + \$value" | bc -l)
                    else
                        total=\$((total + \${value%.*}))
                    fi
                    ((valid_count++))
                else
                    log_warning "Skipping non-numeric value in \$var_name: \$value"
                fi
            done
            
            if [[ \$valid_count -gt 0 ]]; then
                local average
                if command -v bc >/dev/null 2>&1; then
                    average=\$(echo "scale=6; \$total / \$valid_count" | bc -l)
                else
                    average=\$((total / valid_count))
                fi
                set_workflow_var "\$output_var" "\$average"
                log_success "Calculated average of \$valid_count values: \$average"
            else
                log_warning "No valid numeric values to average"
                set_workflow_var "\$output_var" "0"
            fi
            ;;

        "collect")
            log_debug "Collecting values into JSON array from \${#input_vars[@]} variables"
            local -a collected=()
            
            for var_name in "\${input_vars[@]}"; do
                local value="\$(get_workflow_var "\$var_name" "")"
                [[ -n "\$value" ]] && collected+=("\$value")
            done
            
            # Store as JSON array for structured access
            if command -v jq >/dev/null 2>&1; then
                local json_array
                json_array=\$(printf '%s\n' "\${collected[@]}" | jq -R . | jq -s .)
                set_workflow_var "\$output_var" "\$json_array"
                log_success "Collected \${#collected[@]} values into JSON array"
            else
                # Fallback: create simple array format
                local array_string="["
                local first=true
                for value in "\${collected[@]}"; do
                    if [[ "\$first" == "true" ]]; then
                        first=false
                    else
                        array_string+=", "
                    fi
                    array_string+="\\"\$value\\""
                done
                array_string+="]"
                set_workflow_var "\$output_var" "\$array_string"
                log_success "Collected \${#collected[@]} values into array (jq not available, using fallback format)"
            fi
            ;;

        "merge")
            log_debug "Merging JSON objects from \${#input_vars[@]} variables"
            local merged_json="{}"
            local merge_count=0
            
            if command -v jq >/dev/null 2>&1; then
                for var_name in "\${input_vars[@]}"; do
                    local value="\$(get_workflow_var "\$var_name" "{}")"
                    # Validate that value is valid JSON
                    if echo "\$value" | jq -e . >/dev/null 2>&1; then
                        merged_json=\$(jq -s '.[0] * .[1]' <<< "\$merged_json \$value" 2>/dev/null)
                        if [[ \$? -eq 0 ]]; then
                            ((merge_count++))
                        else
                            log_warning "Failed to merge JSON from \$var_name"
                        fi
                    else
                        log_warning "Invalid JSON in variable \$var_name, skipping"
                    fi
                done
                
                set_workflow_var "\$output_var" "\$merged_json"
                log_success "Merged \$merge_count JSON objects"
            else
                log_error "jq is required for merge operation but not available"
                set_workflow_var "\$output_var" "{}"
                return 1
            fi
            ;;

        *)
            log_error "Unknown aggregation method: \$method"
            return 1
            ;;
    esac

    log_success "Variable aggregation completed: \${#input_vars[@]} inputs -> \$output_var"
}`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as VariableAggregationNodeData;

    // Variable aggregation specific validation
    if (!data.input_variables || data.input_variables.length === 0) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_INPUT_VARIABLES',
        message: 'Variable aggregation node must have at least one input variable',
        nodeId: node.id,
      });
    }

    if (!data.output_variable) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_OUTPUT_VARIABLE',
        message: 'Variable aggregation node must specify an output variable',
        nodeId: node.id,
      });
    }

    if (!data.aggregation_method) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_AGGREGATION_METHOD',
        message: 'Variable aggregation node must specify an aggregation method',
        nodeId: node.id,
      });
    } else {
      const validMethods = ['concat', 'sum', 'avg', 'merge', 'collect'];
      if (!validMethods.includes(data.aggregation_method)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_AGGREGATION_METHOD',
          message: `Invalid aggregation method "${data.aggregation_method}". Must be one of: ${validMethods.join(', ')}`,
          nodeId: node.id,
        });
      }
    }

    // Validate method-specific requirements
    if (data.aggregation_method === 'merge') {
      result.warnings.push({
        type: 'warning',
        code: 'JQ_DEPENDENCY',
        message: 'Merge aggregation requires jq to be available in the execution environment',
        nodeId: node.id,
      });
    }

    if (data.aggregation_method === 'collect') {
      result.warnings.push({
        type: 'warning',
        code: 'JQ_RECOMMENDED',
        message:
          'Collect aggregation works best with jq available (fallback format used otherwise)',
        nodeId: node.id,
      });
    }

    // Validate variable names
    if (data.input_variables) {
      for (const varName of data.input_variables) {
        if (!varName || typeof varName !== 'string') {
          result.errors.push({
            type: 'error',
            code: 'INVALID_INPUT_VARIABLE',
            message: 'Input variable names must be non-empty strings',
            nodeId: node.id,
          });
        }
      }
    }

    if (data.output_variable && typeof data.output_variable !== 'string') {
      result.errors.push({
        type: 'error',
        code: 'INVALID_OUTPUT_VARIABLE',
        message: 'Output variable name must be a string',
        nodeId: node.id,
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as VariableAggregationNodeData;

    // Add input variables
    if (data.input_variables) {
      for (const varName of data.input_variables) {
        variables.push(this.sanitizeVariableName(varName).toUpperCase());
      }
    }

    // Add output variable
    if (data.output_variable) {
      variables.push(this.sanitizeVariableName(data.output_variable).toUpperCase());
    }

    return [...new Set(variables)];
  }
}
