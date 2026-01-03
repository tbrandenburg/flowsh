/**
 * Tests for Circuit Breaker Node Generator
 */

import { WorkflowNode, CircuitBreakerNodeData } from '../../dsl/types.js';
import { CircuitBreakerNodeGenerator } from './circuit-breaker-node.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationContext } from '../registry/types.js';

describe('CircuitBreakerNodeGenerator', () => {
  let generator: CircuitBreakerNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    generator = new CircuitBreakerNodeGenerator();
    context = {
      options: {},
      variables: new Map(),
      nodeCount: 1,
      currentNodeIndex: 0,
      workflowName: 'test-workflow',
    };
  });

  describe('validation', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('circuit-breaker');
    });

    it('should validate correct circuit breaker node', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker',
        type: 'circuit-breaker',
        data: {
          failure_threshold: 5,
          timeout_duration: 60,
          success_threshold: 3,
          monitor_window: 300,
        } as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid failure_threshold', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker-1',
        type: 'circuit-breaker',
        data: {
          failure_threshold: 0,
        } as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FAILURE_THRESHOLD');
    });

    it('should fail validation for invalid timeout_duration', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker-2',
        type: 'circuit-breaker',
        data: {
          timeout_duration: 5000,
        } as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_TIMEOUT_DURATION');
    });

    it('should fail validation for invalid success_threshold', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker-3',
        type: 'circuit-breaker',
        data: {
          success_threshold: 100,
        } as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_SUCCESS_THRESHOLD');
    });

    it('should fail validation for invalid monitor_window', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker-4',
        type: 'circuit-breaker',
        data: {
          monitor_window: 30,
        } as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_MONITOR_WINDOW');
    });

    it('should fail validation for wrong node type', () => {
      const node: WorkflowNode = {
        id: 'test-circuit-breaker-5',
        type: 'retry',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_NODE_TYPE')).toBe(true);
    });
  });

  describe('generation', () => {
    it('should generate basic circuit breaker function', () => {
      const node: WorkflowNode = {
        id: 'basic-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('execute_circuit_breaker_basic_cb()');
      expect(result).toContain('log_step "⚡ Circuit Breaker: Circuit Breaker basic-cb"');
      expect(result).toContain('local failure_threshold=5');
      expect(result).toContain('local timeout_duration=60');
      expect(result).toContain('local success_threshold=3');
      expect(result).toContain('local monitor_window=300');
    });

    it('should generate custom configuration values', () => {
      const node: WorkflowNode = {
        id: 'custom-cb',
        type: 'circuit-breaker',
        data: {
          failure_threshold: 10,
          timeout_duration: 120,
          success_threshold: 5,
          monitor_window: 600,
          title: 'Custom Circuit Breaker',
        } as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local failure_threshold=10');
      expect(result).toContain('local timeout_duration=120');
      expect(result).toContain('local success_threshold=5');
      expect(result).toContain('local monitor_window=600');
      expect(result).toContain('⚡ Circuit Breaker: Custom Circuit Breaker');
    });

    it('should include state management logic', () => {
      const node: WorkflowNode = {
        id: 'state-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain(
        'local state_dir="${FLOWSH_TEMP_DIR:-/tmp}/circuit_breaker_state_cb"'
      );
      expect(result).toContain('local state_file="$state_dir/state"');
      expect(result).toContain('local failure_file="$state_dir/failures"');
      expect(result).toContain('local success_file="$state_dir/successes"');
      expect(result).toContain('local last_failure_file="$state_dir/last_failure"');
      expect(result).toContain('mkdir -p "$state_dir"');
      expect(result).toContain('register_temp_file "$state_dir"');
    });

    it('should include state initialization logic', () => {
      const node: WorkflowNode = {
        id: 'init-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('if [[ ! -f "$state_file" ]]; then');
      expect(result).toContain('echo "CLOSED" > "$state_file"');
      expect(result).toContain('echo "0" > "$failure_file"');
      expect(result).toContain('echo "0" > "$success_file"');
      expect(result).toContain('echo "0" > "$last_failure_file"');
    });

    it('should include CLOSED state logic', () => {
      const node: WorkflowNode = {
        id: 'closed-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('"CLOSED")');
      expect(result).toContain('log_debug "Circuit CLOSED - executing protected operation"');
      expect(result).toContain('execute_circuit_breaker_operation');
      expect(result).toContain('failure_count=$((failure_count + 1))');
      expect(result).toContain('if [[ $failure_count -ge $failure_threshold ]]; then');
      expect(result).toContain('echo "OPEN" > "$state_file"');
    });

    it('should include OPEN state logic', () => {
      const node: WorkflowNode = {
        id: 'open-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('"OPEN")');
      expect(result).toContain('local time_since_open=$((current_time - last_failure_time))');
      expect(result).toContain('if [[ $time_since_open -ge $timeout_duration ]]; then');
      expect(result).toContain('echo "HALF_OPEN" > "$state_file"');
      expect(result).toContain('local remaining_time=$((timeout_duration - time_since_open))');
      expect(result).toContain('log_warning "Circuit breaker OPEN - failing fast');
    });

    it('should include HALF_OPEN state logic', () => {
      const node: WorkflowNode = {
        id: 'half-open-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('"HALF_OPEN")');
      expect(result).toContain('log_debug "Circuit HALF_OPEN - testing recovery"');
      expect(result).toContain('success_count=$((success_count + 1))');
      expect(result).toContain('if [[ $success_count -ge $success_threshold ]]; then');
      expect(result).toContain('echo "CLOSED" > "$state_file"');
    });

    it('should include workflow variable tracking', () => {
      const node: WorkflowNode = {
        id: 'tracking-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('set_workflow_var "circuit_breaker_state" "OPEN"');
      expect(result).toContain('set_workflow_var "circuit_breaker_opened_at"');
      expect(result).toContain('set_workflow_var "circuit_breaker_retry_in"');
    });

    it('should include statistics function', () => {
      const node: WorkflowNode = {
        id: 'stats-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('get_circuit_breaker_stats_stats_cb()');
      expect(result).toContain('=== Circuit Breaker Stats (stats-cb) ===');
      expect(result).toContain('State: $current_state');
      expect(result).toContain('Failures: $failure_count/5');
      expect(result).toContain('Successes: $success_count/3');
    });

    it('should include monitor window cleanup logic', () => {
      const node: WorkflowNode = {
        id: 'cleanup-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain(
        'if [[ $((current_time - last_failure_time)) -gt $monitor_window ]]; then'
      );
      expect(result).toContain('echo "0" > "$failure_file"');
      expect(result).toContain('failure_count=0');
      expect(result).toContain('log_debug "Reset failure count - outside monitor window"');
    });

    it('should include comprehensive error handling', () => {
      const node: WorkflowNode = {
        id: 'error-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('*)');
      expect(result).toContain('log_error "Invalid circuit breaker state: $current_state"');
      expect(result).toContain('return 1');
    });

    it('should generate proper bash function structure', () => {
      const node: WorkflowNode = {
        id: 'structure-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      // Check function declaration
      expect(result).toContain('execute_circuit_breaker_structure_cb() {');

      // Check case statement structure
      expect(result).toContain('case "$current_state" in');
      expect(result).toContain('esac');

      // Check function closing
      expect(result).toContain('}');
    });

    it('should include proper comment header', () => {
      const node: WorkflowNode = {
        id: 'comment-cb',
        type: 'circuit-breaker',
        data: {
          title: 'My Circuit Breaker',
        } as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('# Node: comment-cb (comment_cb)');
    });

    it('should sanitize special characters in node id', () => {
      const node: WorkflowNode = {
        id: 'special-cb@123',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('execute_circuit_breaker_special_cb_123()');
      expect(result).toContain('circuit_breaker_special_cb_123');
    });
  });

  describe('circuit breaker edge cases', () => {
    it('should handle minimal configuration', () => {
      const node: WorkflowNode = {
        id: 'minimal-cb',
        type: 'circuit-breaker',
        data: {} as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      // Check defaults are applied
      expect(result).toContain('local failure_threshold=5');
      expect(result).toContain('local timeout_duration=60');
      expect(result).toContain('local success_threshold=3');
      expect(result).toContain('local monitor_window=300');
    });

    it('should handle maximum thresholds', () => {
      const node: WorkflowNode = {
        id: 'max-cb',
        type: 'circuit-breaker',
        data: {
          failure_threshold: 100,
          timeout_duration: 3600,
          success_threshold: 50,
          monitor_window: 7200,
        } as CircuitBreakerNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local failure_threshold=100');
      expect(result).toContain('local timeout_duration=3600');
      expect(result).toContain('local success_threshold=50');
      expect(result).toContain('local monitor_window=7200');
    });
  });
});
