/**
 * Variable Aggregation Node Generator
 *
 * Generates shell script code for aggregating multiple variables using different methods
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

    // Generate input variable array for shell (uppercase to match storage)
    const inputVarList = inputVars
      .map(v => `"${this.sanitizeVariableName(v).toUpperCase()}"`)
      .join(' ');

    // Generate only the specific method implementation
    const methodImplementation = this.generateMethodImplementation(method);

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "📊 Variable Aggregation: ${this.escapeShellValue(title)}"

    local -a input_vars=(${inputVarList})
    local output_var="${outputVar}"
    local method="${method}"
    local separator=$'${separator}'

${methodImplementation}

    log_success "Variable aggregation completed: \${#input_vars[@]} inputs -> \$output_var"
}`;
  }

  private generateMethodImplementation(method: string): string {
    switch (method) {
      case 'concat':
        return this.generateConcatMethod();
      case 'sum':
        return this.generateSumMethod();
      case 'avg':
        return this.generateAvgMethod();
      case 'collect':
        return this.generateCollectMethod();
      case 'merge':
        return this.generateMergeMethod();
      default:
        return `    log_error "Unknown aggregation method: $method"
    return 1`;
    }
  }

  private generateConcatMethod(): string {
    return `    log_debug "Concatenating \${#input_vars[@]} variables with separator"
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
    fi`;
  }

  private generateSumMethod(): string {
    return `    log_debug "Starting sum method with input vars: \${input_vars[@]}"
    local total=0
    local valid_count=0
    
    log_debug "About to iterate through \${#input_vars[@]} variables"
    for var_name in "\${input_vars[@]}"; do
        log_debug "Processing variable: \$var_name"
        local value="\$(get_workflow_var "\$var_name" "0")"
        log_debug "Got value for \$var_name: \$value"
        
        # Handle comma-separated numbers with simple approach
        if [[ "\$value" == *","* ]]; then
            log_debug "Processing comma-separated value: \$value"
            # Replace commas with spaces and iterate
            local space_separated=\$(echo "\$value" | tr ',' ' ')
            log_debug "Space separated: \$space_separated"
            for num in \$space_separated; do
                # Trim whitespace and validate with case statement (safer than regex)
                num=\$(echo "\$num" | xargs)
                log_debug "Processing number: \$num"
                case "\$num" in
                    ''|*[!0-9]*) log_warning "Skipping non-numeric value '\$num' in \$var_name" ;;
                    *) 
                        total=\$((total + num))
                        ((valid_count++))
                        log_debug "Added \$num, running total: \$total"
                        ;;
                esac
            done
        else
            # Handle single value with case statement
            case "\$value" in
                ''|*[!0-9]*) log_warning "Skipping non-numeric value in \$var_name: \$value" ;;
                *)
                    total=\$((total + value))
                    ((valid_count++))
                    log_debug "Added single value \$value, total: \$total"
                    ;;
            esac
        fi
        log_debug "Completed processing \$var_name"
    done
    
    log_debug "Sum calculation complete. Total: \$total, Count: \$valid_count"
    set_workflow_var "\$output_var" "\$total"
    log_success "Summed \$valid_count numeric values, result: \$total"`;
  }

  private generateAvgMethod(): string {
    return `    log_debug "Calculating average of numeric values from \${#input_vars[@]} variables"
    local total=0
    local valid_count=0
    
    for var_name in "\${input_vars[@]}"; do
        local value="\$(get_workflow_var "\$var_name" "0")"
        log_debug "Processing variable \$var_name with value: \$value"
        
        # Handle comma-separated numbers with simple approach
        if [[ "\$value" == *","* ]]; then
            # Replace commas with spaces and iterate
            local space_separated=\$(echo "\$value" | tr ',' ' ')
            for num in \$space_separated; do
                # Trim whitespace and validate with case statement (safer than regex)
                num=\$(echo "\$num" | xargs)
                case "\$num" in
                    ''|*[!0-9]*) log_warning "Skipping non-numeric value '\$num' in \$var_name" ;;
                    *) 
                        total=\$((total + num))
                        ((valid_count++))
                        log_debug "Added \$num, running total: \$total"
                        ;;
                esac
            done
        else
            # Handle single value with case statement
            case "\$value" in
                ''|*[!0-9]*) log_warning "Skipping non-numeric value in \$var_name: \$value" ;;
                *)
                    total=\$((total + value))
                    ((valid_count++))
                    log_debug "Added single value \$value, total: \$total"
                    ;;
            esac
        fi
    done
    
    if [[ \$valid_count -gt 0 ]]; then
        local average=\$((total / valid_count))
        set_workflow_var "\$output_var" "\$average"
        log_success "Calculated average of \$valid_count values: \$average (total: \$total)"
    else
        log_warning "No valid numeric values to average"
        set_workflow_var "\$output_var" "0"
    fi`;
  }

  private generateCollectMethod(): string {
    return `    log_debug "Collecting values into JSON array from \${#input_vars[@]} variables"
    local -a collected=()
    
    for var_name in "\${input_vars[@]}"; do
        local value="\$(get_workflow_var "\$var_name" "")"
        [[ -n "\$value" ]] && collected+=("\$value")
    done
    
    # Store as JSON array for structured access
    if command -v jq >/dev/null 2>&1; then
        local json_array
        json_array=\$(printf '%s\\n' "\${collected[@]}" | jq -R . | jq -s .)
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
    fi`;
  }

  private generateMergeMethod(): string {
    return `    log_debug "Merging JSON objects from \${#input_vars[@]} variables"
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
    fi`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as VariableAggregationNodeData;

    // Validate required fields
    if (
      !data.input_variables ||
      !Array.isArray(data.input_variables) ||
      data.input_variables.length === 0
    ) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_INPUT_VARIABLES',
        message: 'Variable aggregation node must specify input_variables as a non-empty array',
        nodeId: node.id,
      });
    }

    if (!data.output_variable) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_OUTPUT_VARIABLE',
        message: 'Variable aggregation node must specify output_variable',
        nodeId: node.id,
      });
    }

    if (!data.aggregation_method) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_AGGREGATION_METHOD',
        message: 'Variable aggregation node must specify aggregation_method',
        nodeId: node.id,
      });
    }

    // Validate aggregation method
    const validMethods = ['concat', 'sum', 'avg', 'collect', 'merge'];
    if (data.aggregation_method && !validMethods.includes(data.aggregation_method)) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_AGGREGATION_METHOD',
        message: `Invalid aggregation_method "${data.aggregation_method}". Must be one of: ${validMethods.join(', ')}`,
        nodeId: node.id,
      });
    }

    // Method-specific validation
    if (data.aggregation_method === 'merge') {
      result.warnings.push({
        type: 'warning',
        code: 'JQ_DEPENDENCY',
        message: 'Merge aggregation method requires jq to be available during execution',
        nodeId: node.id,
      });
    }

    if (data.aggregation_method === 'collect') {
      result.warnings.push({
        type: 'warning',
        code: 'JQ_DEPENDENCY_OPTIONAL',
        message: 'Collect aggregation method works better with jq available (fallback supported)',
        nodeId: node.id,
      });
    }

    // Validate variable references exist
    if (data.input_variables) {
      data.input_variables.forEach((varRef, index) => {
        if (!varRef || typeof varRef !== 'string') {
          result.errors.push({
            type: 'error',
            code: 'INVALID_VARIABLE_REFERENCE',
            message: `Invalid variable reference at index ${index}: must be a non-empty string`,
            nodeId: node.id,
          });
        }
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const data = node.data as VariableAggregationNodeData;
    const variables: string[] = [];

    // Output variable
    if (data.output_variable) {
      variables.push(this.sanitizeVariableName(data.output_variable).toUpperCase());
    }

    return variables;
  }
}
