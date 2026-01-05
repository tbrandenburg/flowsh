/**
 * Circuit Breaker Node Generator for Phase 2C
 *
 * Implements the circuit breaker pattern to prevent cascade failures:
 * - CLOSED: Normal operation, calls pass through
 * - OPEN: Circuit tripped, calls fail fast
 * - HALF-OPEN: Testing if service has recovered
 *
 * States:
 * - Closed → Open: When failure_threshold exceeded in monitor_window
 * - Open → Half-Open: After timeout_duration expires
 * - Half-Open → Closed: After success_threshold consecutive successes
 * - Half-Open → Open: On any failure
 */

import { WorkflowNode, CircuitBreakerNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class CircuitBreakerNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'circuit-breaker';

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

    const data = node.data as CircuitBreakerNodeData;

    // Validate failure_threshold
    if (data.failure_threshold !== undefined) {
      if (
        typeof data.failure_threshold !== 'number' ||
        data.failure_threshold < 1 ||
        data.failure_threshold > 100
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_FAILURE_THRESHOLD',
          message: 'failure_threshold must be a number between 1 and 100',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    // Validate timeout_duration
    if (data.timeout_duration !== undefined) {
      if (
        typeof data.timeout_duration !== 'number' ||
        data.timeout_duration < 1 ||
        data.timeout_duration > 3600
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_TIMEOUT_DURATION',
          message: 'timeout_duration must be a number between 1 and 3600 seconds',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    // Validate success_threshold
    if (data.success_threshold !== undefined) {
      if (
        typeof data.success_threshold !== 'number' ||
        data.success_threshold < 1 ||
        data.success_threshold > 50
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_SUCCESS_THRESHOLD',
          message: 'success_threshold must be a number between 1 and 50',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    // Validate monitor_window
    if (data.monitor_window !== undefined) {
      if (
        typeof data.monitor_window !== 'number' ||
        data.monitor_window < 60 ||
        data.monitor_window > 7200
      ) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_MONITOR_WINDOW',
          message: 'monitor_window must be a number between 60 and 7200 seconds',
          nodeId: node.id,
        });
        result.valid = false;
      }
    }

    return result;
  }

  private processConfigValue(value: any, defaultValue: number, nodeId: string): string {
    if (value === undefined || value === null) {
      return defaultValue.toString();
    }

    if (typeof value === 'string') {
      // Check if it's a template variable like "${failure_threshold}"
      if (value.includes('${') || value.includes('{{')) {
        // Process template variables to generate shell variable access
        return `$(echo "${this.processTemplateVariables(value, nodeId)}" | bc -l 2>/dev/null || echo "${defaultValue}")`;
      }
      // If it's a plain string that looks like a number, return it
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return Math.floor(numValue).toString();
      }
    }

    if (typeof value === 'number') {
      return Math.floor(value).toString();
    }

    return defaultValue.toString();
  }

  override generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as CircuitBreakerNodeData;
    const nodeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = `execute_circuit_breaker_${nodeId}`;

    // Extract configuration with defaults - handle template variables
    const failureThreshold = this.processConfigValue(data.failure_threshold, 5, node.id);
    const timeoutDuration = this.processConfigValue(data.timeout_duration, 60, node.id);
    const successThreshold = this.processConfigValue(data.success_threshold, 3, node.id);
    const monitorWindow = this.processConfigValue(data.monitor_window, 300, node.id);

    return [
      `# Node: ${node.id} (${nodeId})`,
      `${functionName}() {`,
      `    log_step "⚡ Circuit Breaker: ${data.title || `Circuit Breaker ${node.id}`}"`,
      ``,
      `    local failure_threshold=${failureThreshold}`,
      `    local timeout_duration=${timeoutDuration}`,
      `    local success_threshold=${successThreshold}`,
      `    local monitor_window=${monitorWindow}`,
      `    `,
      `    # Circuit breaker state files`,
      `    local state_dir="\${FLOWSH_TEMP_DIR:-/tmp}/circuit_breaker_${nodeId}"`,
      `    local state_file="\$state_dir/state"`,
      `    local failure_file="\$state_dir/failures"`,
      `    local success_file="\$state_dir/successes"`,
      `    local last_failure_file="\$state_dir/last_failure"`,
      `    `,
      `    # Ensure state directory exists`,
      `    mkdir -p "\$state_dir"`,
      `    register_temp_file "\$state_dir"`,
      `    `,
      `    # Initialize circuit breaker state if not exists`,
      `    if [[ ! -f "\$state_file" ]]; then`,
      `        echo "CLOSED" > "\$state_file"`,
      `        echo "0" > "\$failure_file"`,
      `        echo "0" > "\$success_file"`,
      `        echo "0" > "\$last_failure_file"`,
      `    fi`,
      `    `,
      `    local current_state=$(cat "\$state_file")`,
      `    local failure_count=$(cat "\$failure_file")`,
      `    local success_count=$(cat "\$success_file")`,
      `    local last_failure_time=$(cat "\$last_failure_file")`,
      `    local current_time=$(date +%s)`,
      `    `,
      `    log_info "Circuit breaker state: \$current_state (failures: \$failure_count, successes: \$success_count)"`,
      `    `,
      `    # Clean up old failures outside monitor window`,
      `    if [[ \$((current_time - last_failure_time)) -gt \$monitor_window ]]; then`,
      `        echo "0" > "\$failure_file"`,
      `        failure_count=0`,
      `        log_debug "Reset failure count - outside monitor window"`,
      `    fi`,
      `    `,
      `    case "\$current_state" in`,
      `        "CLOSED")`,
      `            # Normal operation - allow calls`,
      `            log_debug "Circuit CLOSED - executing protected operation"`,
      `            `,
      `            if execute_circuit_breaker_operation; then`,
      `                # Success - reset failure count`,
      `                echo "0" > "\$failure_file"`,
      `                echo "0" > "\$success_file"`,
      `                log_success "Circuit breaker operation succeeded"`,
      `                return 0`,
      `            else`,
      `                # Failure - increment failure count`,
      `                failure_count=\$((failure_count + 1))`,
      `                echo "\$failure_count" > "\$failure_file"`,
      `                echo "\$current_time" > "\$last_failure_file"`,
      `                `,
      `                log_warning "Circuit breaker operation failed (failure \$failure_count/\$failure_threshold)"`,
      `                `,
      `                if [[ \$failure_count -ge \$failure_threshold ]]; then`,
      `                    echo "OPEN" > "\$state_file"`,
      `                    log_error "Circuit breaker OPENED - failure threshold reached"`,
      `                    set_workflow_var "circuit_breaker_state" "OPEN"`,
      `                    set_workflow_var "circuit_breaker_opened_at" "\$current_time"`,
      `                fi`,
      `                `,
      `                return 1`,
      `            fi`,
      `            ;;`,
      `        "OPEN")`,
      `            # Circuit is open - check if timeout has passed`,
      `            local time_since_open=\$((current_time - last_failure_time))`,
      `            `,
      `            if [[ \$time_since_open -ge \$timeout_duration ]]; then`,
      `                # Timeout passed - move to half-open`,
      `                echo "HALF_OPEN" > "\$state_file"`,
      `                echo "0" > "\$success_file"`,
      `                log_info "Circuit breaker moved to HALF_OPEN - testing recovery"`,
      `                set_workflow_var "circuit_breaker_state" "HALF_OPEN"`,
      `                `,
      `                # Try the operation`,
      `                if execute_circuit_breaker_operation; then`,
      `                    success_count=1`,
      `                    echo "\$success_count" > "\$success_file"`,
      `                    log_info "Half-open test succeeded (success 1/\$success_threshold)"`,
      `                    `,
      `                    if [[ \$success_count -ge \$success_threshold ]]; then`,
      `                        echo "CLOSED" > "\$state_file"`,
      `                        echo "0" > "\$failure_file"`,
      `                        echo "0" > "\$success_file"`,
      `                        log_success "Circuit breaker CLOSED - recovery complete"`,
      `                        set_workflow_var "circuit_breaker_state" "CLOSED"`,
      `                    fi`,
      `                    `,
      `                    return 0`,
      `                else`,
      `                    # Failed during half-open - back to open`,
      `                    echo "OPEN" > "\$state_file"`,
      `                    echo "\$current_time" > "\$last_failure_file"`,
      `                    log_error "Half-open test failed - circuit breaker back to OPEN"`,
      `                    set_workflow_var "circuit_breaker_state" "OPEN"`,
      `                    return 1`,
      `                fi`,
      `            else`,
      `                # Still in timeout period - fail fast`,
      `                local remaining_time=\$((timeout_duration - time_since_open))`,
      `                log_warning "Circuit breaker OPEN - failing fast (retry in \${remaining_time}s)"`,
      `                set_workflow_var "circuit_breaker_retry_in" "\$remaining_time"`,
      `                return 1`,
      `            fi`,
      `            ;;`,
      `        "HALF_OPEN")`,
      `            # Testing recovery - limited calls allowed`,
      `            log_debug "Circuit HALF_OPEN - testing recovery"`,
      `            `,
      `            if execute_circuit_breaker_operation; then`,
      `                # Success in half-open state`,
      `                success_count=\$((success_count + 1))`,
      `                echo "\$success_count" > "\$success_file"`,
      `                log_info "Half-open test succeeded (success \$success_count/\$success_threshold)"`,
      `                `,
      `                if [[ \$success_count -ge \$success_threshold ]]; then`,
      `                    # Enough successes - close the circuit`,
      `                    echo "CLOSED" > "\$state_file"`,
      `                    echo "0" > "\$failure_file"`,
      `                    echo "0" > "\$success_file"`,
      `                    log_success "Circuit breaker CLOSED - recovery complete"`,
      `                    set_workflow_var "circuit_breaker_state" "CLOSED"`,
      `                fi`,
      `                `,
      `                return 0`,
      `            else`,
      `                # Failure in half-open - back to open`,
      `                echo "OPEN" > "\$state_file"`,
      `                echo "\$current_time" > "\$last_failure_file"`,
      `                log_error "Half-open test failed - circuit breaker back to OPEN"`,
      `                set_workflow_var "circuit_breaker_state" "OPEN"`,
      `                return 1`,
      `            fi`,
      `            ;;`,
      `        *)`,
      `            log_error "Invalid circuit breaker state: \$current_state"`,
      `            return 1`,
      `            ;;`,
      `    esac`,
      `}`,
      ``,
      `# Get current circuit breaker statistics`,
      `get_circuit_breaker_stats_${nodeId}() {`,
      `    local state_dir="\${FLOWSH_TEMP_DIR:-/tmp}/circuit_breaker_${nodeId}"`,
      `    `,
      `    if [[ -d "\$state_dir" ]]; then`,
      `        local current_state=$(cat "\$state_dir/state" 2>/dev/null || echo "UNKNOWN")`,
      `        local failure_count=$(cat "\$state_dir/failures" 2>/dev/null || echo "0")`,
      `        local success_count=$(cat "\$state_dir/successes" 2>/dev/null || echo "0")`,
      `        `,
      `        cat << EOF`,
      `=== Circuit Breaker Stats (${node.id}) ===`,
      `State: \$current_state`,
      `Failures: \$failure_count/${failureThreshold}`,
      `Successes: \$success_count/${successThreshold}`,
      `Timeout: ${timeoutDuration}s`,
      `Monitor Window: ${monitorWindow}s`,
      `=====================================`,
      `EOF`,
      `    else`,
      `        echo "Circuit breaker not initialized"`,
      `    fi`,
      `}`,
    ]
      .filter(line => line !== '')
      .join('\n');
  }
}
