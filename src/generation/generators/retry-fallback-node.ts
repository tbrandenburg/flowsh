/**
 * Retry and Fallback Node Generators for Phase 2C
 *
 * Implements sophisticated retry mechanisms and fallback strategies for enterprise-grade error handling.
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

/**
 * Retry Node Generator for Phase 2C
 */
export class RetryNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'retry';

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    if (node.type !== this.nodeType) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_NODE_TYPE',
        message: `Expected node type '${this.nodeType}', got '${node.type}'`,
        nodeId: node.id,
      });
      result.valid = false;
    }

    // Validate retry-specific data
    const data = node.data as any;
    if (data.max_attempts !== undefined) {
      if (
        typeof data.max_attempts !== 'number' ||
        data.max_attempts < 1 ||
        data.max_attempts > 20
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_MAX_ATTEMPTS',
          message: 'max_attempts must be a number between 1 and 20',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    if (data.retry_delay !== undefined) {
      if (typeof data.retry_delay !== 'number' || data.retry_delay < 0 || data.retry_delay > 300) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_RETRY_DELAY',
          message: 'retry_delay must be a number between 0 and 300',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    if (data.backoff_multiplier !== undefined) {
      if (
        typeof data.backoff_multiplier !== 'number' ||
        data.backoff_multiplier < 1.0 ||
        data.backoff_multiplier > 5.0
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_BACKOFF_MULTIPLIER',
          message: 'backoff_multiplier must be a number between 1.0 and 5.0',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    if (data.retry_condition !== undefined) {
      const validConditions = ['any_failure', 'timeout_only', 'network_only', 'exit_code_range'];
      if (!validConditions.includes(data.retry_condition)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_RETRY_CONDITION',
          message: `retry_condition must be one of: ${validConditions.join(', ')}`,
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    return result;
  }

  override generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as any;
    const nodeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = `execute_retry_${nodeId}`;

    // Extract configuration with defaults
    const maxAttempts = data.max_attempts || 3;
    const retryDelay = data.retry_delay !== undefined ? data.retry_delay : 5;
    const backoffMultiplier = data.backoff_multiplier || 2.0;
    const retryCondition = data.retry_condition || 'any_failure';
    const timeout = data.timeout;

    return [
      `# Node: ${node.id} (${nodeId})`,
      `${functionName}() {`,
      `    log_step "🔄 Retry Handler: ${data.title || `Retry Handler ${node.id}`}"`,
      ``,
      `    local max_attempts=${maxAttempts}`,
      `    local retry_delay=${retryDelay}`,
      `    local backoff_multiplier=${backoffMultiplier}`,
      `    local retry_condition="${retryCondition}"`,
      timeout ? `    local timeout_seconds=${timeout}` : '',
      `    `,
      `    log_info "Starting retry handler: max_attempts=\$max_attempts, delay=\$retry_delay, condition=\$retry_condition"`,
      ``,
      `    for attempt in $(seq 1 \$max_attempts); do`,
      `        log_info "Retry attempt \$attempt/\$max_attempts"`,
      `        `,
      `        local start_time=$(date +%s)`,
      `        local should_retry=false`,
      `        local exit_code=0`,
      `        `,
      timeout ? `        # Execute with timeout` : `        # Execute command`,
      timeout
        ? `        if timeout \${timeout_seconds} execute_retry_command; then`
        : `        if execute_retry_command; then`,
      `            log_success "Retry attempt \$attempt succeeded"`,
      `            return 0`,
      `        else`,
      `            exit_code=\$?`,
      `            log_warning "Retry attempt \$attempt failed with exit code: \$exit_code"`,
      `        fi`,
      `        `,
      `        # Check if we should retry based on condition`,
      this.generateRetryConditionCheck(retryCondition),
      `        `,
      `        if [[ "\$should_retry" == "false" ]]; then`,
      `            log_error "Non-retryable condition detected, stopping retries"`,
      `            return \$exit_code`,
      `        fi`,
      `        `,
      `        # Don't sleep after the last attempt`,
      `        if [[ \$attempt -lt \$max_attempts ]]; then`,
      `            local delay_time=\$(echo "\$retry_delay * (\$backoff_multiplier ^ (\$attempt - 1))" | bc -l)`,
      `            local rounded_delay=\$(printf "%.0f" "\$delay_time")`,
      `            log_info "Waiting \$rounded_delay seconds before next attempt..."`,
      `            sleep "\$rounded_delay"`,
      `        fi`,
      `    done`,
      `    `,
      `    log_error "All \$max_attempts retry attempts failed"`,
      `    return \$exit_code`,
      `}`,
    ]
      .filter(line => line !== '')
      .join('\n');
  }

  private generateRetryConditionCheck(condition: string): string {
    const conditionChecks = {
      any_failure: [
        `        # Retry on any failure`,
        `        should_retry=true`,
        `        log_debug "Will retry on any failure"`,
      ],
      timeout_only: [
        `        # Retry only on timeout errors`,
        `        if [[ \$exit_code -eq 124 || \$exit_code -eq 142 ]]; then`,
        `            should_retry=true`,
        `            log_debug "Timeout detected (exit code: \$exit_code)"`,
        `        else`,
        `            should_retry=false`,
        `            log_debug "Non-timeout failure (exit code: \$exit_code)"`,
        `        fi`,
      ],
      network_only: [
        `        # Retry only on network-related errors`,
        `        case \$exit_code in`,
        `            6|7|28|35|56)  # curl network error codes`,
        `                should_retry=true`,
        `                log_debug "Network error detected (exit code: \$exit_code)"`,
        `                ;;`,
        `            *)`,
        `                should_retry=false`,
        `                log_debug "Non-network failure (exit code: \$exit_code)"`,
        `                ;;`,
        `        esac`,
      ],
      exit_code_range: [
        `        # Retry on specific exit code ranges`,
        `        if [[ \$exit_code -ge 1 && \$exit_code -le 10 ]]; then`,
        `            should_retry=true`,
        `            log_debug "Retryable exit code: \$exit_code"`,
        `        else`,
        `            should_retry=false`,
        `            log_debug "Non-retryable exit code: \$exit_code"`,
        `        fi`,
      ],
    };

    const selectedCheck = conditionChecks[condition as keyof typeof conditionChecks];
    return selectedCheck ? selectedCheck.join('\n') : conditionChecks['any_failure'].join('\n');
  }
}

/**
 * Fallback Node Generator for Phase 2C
 */
export class FallbackNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'fallback';

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    if (node.type !== this.nodeType) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_NODE_TYPE',
        message: `Expected node type '${this.nodeType}', got '${node.type}'`,
        nodeId: node.id,
      });
      result.valid = false;
    }

    const data = node.data as any;
    if (
      !data.fallback_paths ||
      !Array.isArray(data.fallback_paths) ||
      data.fallback_paths.length === 0
    ) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_FALLBACK_PATHS',
        message: 'fallback_paths must be a non-empty array',
        nodeId: node.id,
      });
      result.valid = false;
    }

    if (data.strategy !== undefined && !['sequential', 'parallel'].includes(data.strategy)) {
      result.errors.push({
        type: 'error',
        code: 'INVALID_STRATEGY',
        message: 'strategy must be either "sequential" or "parallel"',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  override generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as any;
    const nodeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = `execute_fallback_${nodeId}`;

    // Extract configuration with defaults
    const strategy = data.strategy || 'sequential';
    const maxTime = data.max_fallback_time || 300;
    const continueOnSuccess = data.continue_on_success || false;
    const fallbackPaths = data.fallback_paths || [];

    return [
      `# Node: ${node.id} (${nodeId})`,
      `${functionName}() {`,
      `    log_step "🛡️ Fallback Handler: ${data.title || `Fallback Handler ${node.id}`}"`,
      ``,
      `    local fallback_strategy="${strategy}"`,
      `    local max_fallback_time=${maxTime}`,
      `    local continue_on_success=${continueOnSuccess}`,
      `    local fallback_start_time=$(date +%s)`,
      `    `,
      `    # Define fallback paths`,
      `    local -a fallback_paths=(${fallbackPaths.map((path: string) => `"${path.replace(/"/g, '\\"')}"`).join(' ')})`,
      `    `,
      `    log_info "Starting fallback handler: strategy=\$fallback_strategy, paths=\${#fallback_paths[@]}"`,
      ``,
      `    case "\$fallback_strategy" in`,
      `        "sequential")`,
      `            # Try each fallback path in order until one succeeds`,
      `            for path_index in "\${!fallback_paths[@]}"; do`,
      `                local path_id="\${fallback_paths[\$path_index]}"`,
      `                `,
      `                # Check timeout`,
      `                local elapsed_time=$(($(date +%s) - fallback_start_time))`,
      `                if [[ \$elapsed_time -ge ${maxTime} ]]; then`,
      `                    log_error "Fallback timeout exceeded: \${elapsed_time}s >= ${maxTime}s"`,
      `                    return 1`,
      `                fi`,
      `                `,
      `                log_info "Trying fallback path \$((path_index + 1))/\${#fallback_paths[@]}: \$path_id"`,
      `                `,
      `                if execute_fallback_path "\$path_id"; then`,
      `                    log_success "Fallback path '\$path_id' succeeded"`,
      `                    set_workflow_var "fallback_used" "\$path_id"`,
      `                    set_workflow_var "fallback_attempt" "\$((path_index + 1))"`,
      `                    set_workflow_var "fallback_strategy" "sequential"`,
      `                    `,
      `                    if [[ "${continueOnSuccess}" == "false" ]]; then`,
      `                        return 0`,
      `                    fi`,
      `                else`,
      `                    log_warning "Fallback path '\$path_id' failed"`,
      `                fi`,
      `            done`,
      `            `,
      `            if [[ "${continueOnSuccess}" == "true" ]]; then`,
      `                log_info "All fallback paths attempted (continue_on_success=true)"`,
      `                return 0`,
      `            else`,
      `                log_error "All \${#fallback_paths[@]} fallback paths failed"`,
      `                return 1`,
      `            fi`,
      `            ;;`,
      `        "parallel")`,
      `            # Try all fallback paths in parallel`,
      `            local temp_dir=$(mktemp -d -t "fallback_\${BASHPID}_XXXXXX")`,
      `            local success_found="false"`,
      `            local successful_path=""`,
      `            `,
      `            # Start all fallback paths in parallel`,
      `            for path_index in "\${!fallback_paths[@]}"; do`,
      `                local path_id="\${fallback_paths[\$path_index]}"`,
      `                (`,
      `                    if execute_fallback_path "\$path_id"; then`,
      `                        echo "success:\$path_id" > "\$temp_dir/result_\$path_index"`,
      `                    else`,
      `                        echo "failure:\$path_id" > "\$temp_dir/result_\$path_index"`,
      `                    fi`,
      `                ) &`,
      `                local pid=\$!`,
      `                register_process "\$pid" "Fallback path: \$path_id"`,
      `            done`,
      `            `,
      `            # Wait for results with timeout check`,
      `            while [[ "\$success_found" == "false" ]]; do`,
      `                local elapsed_time=$(($(date +%s) - fallback_start_time))`,
      `                if [[ \$elapsed_time -ge ${maxTime} ]]; then`,
      `                    log_error "Fallback timeout exceeded: \${elapsed_time}s >= ${maxTime}s"`,
      `                    break`,
      `                fi`,
      `                `,
      `                # Check for completed results`,
      `                for result_file in "\$temp_dir"/result_*; do`,
      `                    [[ -f "\$result_file" ]] || continue`,
      `                    local result_content=$(cat "\$result_file")`,
      `                    if [[ "\$result_content" =~ ^success: ]]; then`,
      `                        success_found="true"`,
      `                        successful_path="\${result_content#success:}"`,
      `                        break`,
      `                    fi`,
      `                done`,
      `                `,
      `                [[ "\$success_found" == "false" ]] && sleep 0.1`,
      `            done`,
      `            `,
      `            # Wait for all background processes to complete`,
      `            wait`,
      `            `,
      `            # Clean up`,
      `            rm -rf "\$temp_dir"`,
      `            `,
      `            if [[ "\$success_found" == "true" ]]; then`,
      `                set_workflow_var "fallback_used" "\$successful_path"`,
      `                set_workflow_var "fallback_strategy" "parallel"`,
      `                log_success "Parallel fallback succeeded with path: \$successful_path"`,
      `                return 0`,
      `            else`,
      `                log_error "All parallel fallback paths failed"`,
      `                return 1`,
      `            fi`,
      `            ;;`,
      `        *)`,
      `            log_error "Unknown fallback strategy: \$fallback_strategy"`,
      `            return 1`,
      `            ;;`,
      `    esac`,
      `}`,
    ].join('\n');
  }
}
