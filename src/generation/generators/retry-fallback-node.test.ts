/**
 * Tests for Retry and Fallback Node Generators
 */

import { RetryNodeGenerator, FallbackNodeGenerator } from './retry-fallback-node';
import { WorkflowNode, RetryNodeData, FallbackNodeData } from '../../dsl/types';
import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationContext } from '../registry/types';

describe('RetryNodeGenerator', () => {
  let generator: RetryNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    generator = new RetryNodeGenerator();
    context = {
      options: {},
      variables: new Map(),
      nodeCount: 1,
      currentNodeIndex: 0,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('retry');
    });
  });

  describe('validation', () => {
    it('should validate correct retry node', () => {
      const node: WorkflowNode = {
        id: 'test-retry-1',
        type: 'retry',
        data: {
          max_attempts: 5,
          retry_delay: 3,
          backoff_multiplier: 2.0,
          retry_condition: 'network_only',
          timeout: 60,
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid max_attempts', () => {
      const node: WorkflowNode = {
        id: 'test-retry-2',
        type: 'retry',
        data: {
          max_attempts: 50, // Too high
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_MAX_ATTEMPTS');
    });

    it('should fail validation for invalid retry_delay', () => {
      const node: WorkflowNode = {
        id: 'test-retry-3',
        type: 'retry',
        data: {
          retry_delay: 500, // Too high
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_RETRY_DELAY')).toBe(true);
    });

    it('should fail validation for invalid backoff_multiplier', () => {
      const node: WorkflowNode = {
        id: 'test-retry-4',
        type: 'retry',
        data: {
          backoff_multiplier: 10.0, // Too high
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_BACKOFF_MULTIPLIER')).toBe(true);
    });

    it('should fail validation for invalid retry_condition', () => {
      const node: WorkflowNode = {
        id: 'test-retry-5',
        type: 'retry',
        data: {
          retry_condition: 'invalid_condition' as any,
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_RETRY_CONDITION')).toBe(true);
    });

    it('should fail validation for wrong node type', () => {
      const node: WorkflowNode = {
        id: 'test-wrong-type',
        type: 'start', // Wrong type
        data: {
          max_attempts: 3,
        } as RetryNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_NODE_TYPE')).toBe(true);
    });
  });

  describe('generation', () => {
    it('should generate basic retry function', () => {
      const node: WorkflowNode = {
        id: 'retry-test',
        type: 'retry',
        data: {
          title: 'API Call Retry',
          max_attempts: 4,
          retry_delay: 5,
          backoff_multiplier: 1.8,
          retry_condition: 'timeout_only',
        } as RetryNodeData,
      };

      const result = generator.generate(node, context);

      // Check function name
      expect(result).toContain('execute_retry_retry_test()');

      // Check title and logging
      expect(result).toContain('API Call Retry');
      expect(result).toContain('log_step "🔄 Retry Handler:');

      // Check configuration
      expect(result).toContain('local max_attempts=4');
      expect(result).toContain('local retry_delay=5');
      expect(result).toContain('local backoff_multiplier=1.8');
      expect(result).toContain('local retry_condition="timeout_only"');
    });

    it('should generate default values when optional parameters are missing', () => {
      const node: WorkflowNode = {
        id: 'simple-retry',
        type: 'retry',
        data: {} as RetryNodeData,
      };

      const result = generator.generate(node, context);

      // Check defaults
      expect(result).toContain('local max_attempts=3'); // Default
      expect(result).toContain('local retry_delay=5'); // Default
      expect(result).toContain('local backoff_multiplier=2'); // Default
      expect(result).toContain('local retry_condition="any_failure"'); // Default
    });

    it('should include timeout handling when specified', () => {
      const node: WorkflowNode = {
        id: 'timeout-retry',
        type: 'retry',
        data: {
          timeout: 120,
        } as RetryNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local timeout_seconds=120');
      expect(result).toContain('# Execute with timeout');
      expect(result).toContain('timeout ${timeout_seconds} execute_retry_command');
    });

    it('should include retry loop logic', () => {
      const node: WorkflowNode = {
        id: 'loop-test',
        type: 'retry',
        data: {
          max_attempts: 3,
        } as RetryNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('for attempt in $(seq 1 $max_attempts); do');
      expect(result).toContain('log_info "Retry attempt $attempt/$max_attempts');
      expect(result).toContain('if execute_retry_command; then');
    });

    it('should include exponential backoff calculation', () => {
      const node: WorkflowNode = {
        id: 'backoff-test',
        type: 'retry',
        data: {
          backoff_multiplier: 2.0,
        } as RetryNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain(
        'local delay_time=$(echo "$retry_delay * ($backoff_multiplier ^ ($attempt - 1))" | bc -l)'
      );
    });

    it('should generate appropriate retry condition checks', () => {
      const timeoutNode: WorkflowNode = {
        id: 'timeout-condition',
        type: 'retry',
        data: { retry_condition: 'timeout_only' } as RetryNodeData,
      };

      const timeoutResult = generator.generate(timeoutNode, context);
      expect(timeoutResult).toContain('if [[ $exit_code -eq 124 || $exit_code -eq 142 ]]; then');

      const networkNode: WorkflowNode = {
        id: 'network-condition',
        type: 'retry',
        data: { retry_condition: 'network_only' } as RetryNodeData,
      };

      const networkResult = generator.generate(networkNode, context);
      expect(networkResult).toContain('case $exit_code in');
      expect(networkResult).toContain('6|7|28|35|56)  # curl network error codes');

      const anyNode: WorkflowNode = {
        id: 'any-condition',
        type: 'retry',
        data: { retry_condition: 'any_failure' } as RetryNodeData,
      };

      const anyResult = generator.generate(anyNode, context);
      expect(anyResult).toContain('should_retry=true');
    });

    it('should include comprehensive error handling', () => {
      const node: WorkflowNode = {
        id: 'error-test',
        type: 'retry',
        data: {} as RetryNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('log_error "All $max_attempts retry attempts failed"');
      expect(result).toContain('return $exit_code');
    });
  });

  describe('shell structure', () => {
    it('should generate proper bash function structure', () => {
      const node: WorkflowNode = {
        id: 'structure-test',
        type: 'retry',
        data: {} as RetryNodeData,
      };

      const result = generator.generate(node, context);

      // Check function structure
      expect(result).toMatch(/execute_retry_structure_test\(\) \{[\s\S]*\}/);

      // Check proper variable declarations
      expect(result).toMatch(/local \w+=/);

      // Check loop structure
      expect(result).toContain('for attempt in $(seq 1 $max_attempts); do');
      expect(result).toContain('done');
    });

    it('should include proper comment header', () => {
      const node: WorkflowNode = {
        id: 'comment-test',
        type: 'retry',
        data: {
          title: 'My Retry Handler',
        } as RetryNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('# Node: comment-test (comment_test)');
    });
  });
});

describe('FallbackNodeGenerator', () => {
  let generator: FallbackNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    generator = new FallbackNodeGenerator();
    context = {
      options: {},
      variables: new Map(),
      nodeCount: 1,
      currentNodeIndex: 0,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('fallback');
    });
  });

  describe('validation', () => {
    it('should validate correct fallback node', () => {
      const node: WorkflowNode = {
        id: 'test-fallback-1',
        type: 'fallback',
        data: {
          strategy: 'sequential',
          fallback_paths: ['path1', 'path2', 'path3'],
          max_fallback_time: 300,
          continue_on_success: false,
        } as FallbackNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing fallback paths', () => {
      const node: WorkflowNode = {
        id: 'test-fallback-2',
        type: 'fallback',
        data: {
          fallback_paths: [],
        } as FallbackNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_FALLBACK_PATHS');
    });

    it('should fail validation for invalid strategy', () => {
      const node: WorkflowNode = {
        id: 'test-fallback-3',
        type: 'fallback',
        data: {
          strategy: 'invalid_strategy' as any,
          fallback_paths: ['path1'],
        } as FallbackNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_STRATEGY')).toBe(true);
    });

    it('should fail validation for wrong node type', () => {
      const node: WorkflowNode = {
        id: 'test-wrong-type',
        type: 'start', // Wrong type
        data: {
          fallback_paths: ['path1'],
        } as FallbackNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_NODE_TYPE')).toBe(true);
    });
  });

  describe('generation', () => {
    it('should generate basic fallback function', () => {
      const node: WorkflowNode = {
        id: 'fallback-test',
        type: 'fallback',
        data: {
          title: 'Database Connection Fallback',
          strategy: 'sequential',
          fallback_paths: ['primary_db', 'secondary_db', 'cache_db'],
          max_fallback_time: 180,
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      // Check function name
      expect(result).toContain('execute_fallback_fallback_test()');

      // Check title and logging
      expect(result).toContain('Database Connection Fallback');
      expect(result).toContain('log_step "🛡️ Fallback Handler:');

      // Check configuration
      expect(result).toContain('local fallback_strategy="sequential"');
      expect(result).toContain('local max_fallback_time=180');
      expect(result).toContain('local -a fallback_paths=("primary_db" "secondary_db" "cache_db")');
    });

    it('should generate default values when optional parameters are missing', () => {
      const node: WorkflowNode = {
        id: 'simple-fallback',
        type: 'fallback',
        data: {
          fallback_paths: ['path1', 'path2'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      // Check defaults
      expect(result).toContain('local fallback_strategy="sequential"'); // Default
      expect(result).toContain('local max_fallback_time=300'); // Default
      expect(result).toContain('local continue_on_success=false'); // Default
    });

    it('should generate sequential strategy logic', () => {
      const node: WorkflowNode = {
        id: 'sequential-test',
        type: 'fallback',
        data: {
          strategy: 'sequential',
          fallback_paths: ['path1', 'path2'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('case "$fallback_strategy" in');
      expect(result).toContain('"sequential")');
      expect(result).toContain('for path_index in "${!fallback_paths[@]}"; do');
      expect(result).toContain('if execute_fallback_path "$path_id"; then');
      expect(result).toContain('log_success "Fallback path \'$path_id\' succeeded"');
    });

    it('should generate parallel strategy logic', () => {
      const node: WorkflowNode = {
        id: 'parallel-test',
        type: 'fallback',
        data: {
          strategy: 'parallel',
          fallback_paths: ['path1', 'path2', 'path3'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('"parallel")');
      expect(result).toContain('local temp_dir=$(mktemp -d -t "fallback_${BASHPID}_XXXXXX")');
      expect(result).toContain('execute_fallback_path "$path_id"');
      expect(result).toContain('register_process "$pid" "Fallback path: $path_id"');
      expect(result).toContain('while [[ "$success_found" == "false" ]]; do');
    });

    it('should include timeout handling', () => {
      const node: WorkflowNode = {
        id: 'timeout-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1'],
          max_fallback_time: 60,
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local elapsed_time=$(($(date +%s) - fallback_start_time))');
      expect(result).toContain('if [[ $elapsed_time -ge 60 ]]; then');
      expect(result).toContain('log_error "Fallback timeout exceeded:');
    });

    it('should handle continue_on_success option', () => {
      const continueNode: WorkflowNode = {
        id: 'continue-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1', 'path2'],
          continue_on_success: true,
        } as FallbackNodeData,
      };

      const continueResult = generator.generate(continueNode, context);
      expect(continueResult).toContain('local continue_on_success=true');
      expect(continueResult).toContain('if [[ "true" == "false" ]]; then');

      const stopNode: WorkflowNode = {
        id: 'stop-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1', 'path2'],
          continue_on_success: false,
        } as FallbackNodeData,
      };

      const stopResult = generator.generate(stopNode, context);
      expect(stopResult).toContain('local continue_on_success=false');
    });

    it('should include result tracking', () => {
      const node: WorkflowNode = {
        id: 'tracking-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1', 'path2'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('set_workflow_var "fallback_used" "$path_id"');
      expect(result).toContain('set_workflow_var "fallback_attempt"');
      expect(result).toContain('set_workflow_var "fallback_strategy"');
    });

    it('should include comprehensive error handling', () => {
      const node: WorkflowNode = {
        id: 'error-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1', 'path2'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('log_error "All ${#fallback_paths[@]} fallback paths failed"');
      // Note: Only sequential strategy generated since no strategy specified (defaults to sequential)
      // expect(result).toContain('log_error "All parallel fallback paths failed"');
      expect(result).toContain('return 1');
      expect(result).toContain('return 0');
    });
  });

  describe('shell structure', () => {
    it('should generate proper bash function structure', () => {
      const node: WorkflowNode = {
        id: 'structure-test',
        type: 'fallback',
        data: {
          fallback_paths: ['path1'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      // Check function structure
      expect(result).toMatch(/execute_fallback_structure_test\(\) \{[\s\S]*\}/);

      // Check proper variable declarations
      expect(result).toMatch(/local \w+=/);

      // Check array declaration
      expect(result).toContain('local -a fallback_paths=');
    });

    it('should include proper comment header', () => {
      const node: WorkflowNode = {
        id: 'comment-test',
        type: 'fallback',
        data: {
          title: 'My Fallback Handler',
          fallback_paths: ['path1'],
        } as FallbackNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('# Node: comment-test (comment_test)');
    });
  });
});

describe('Retry and Fallback Edge Cases', () => {
  let retryGenerator: RetryNodeGenerator;
  let fallbackGenerator: FallbackNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    retryGenerator = new RetryNodeGenerator();
    fallbackGenerator = new FallbackNodeGenerator();
    context = {
      options: {},
      variables: new Map(),
      nodeCount: 1,
      currentNodeIndex: 0,
      workflowName: 'test-workflow',
    };
  });

  describe('retry edge cases', () => {
    it('should handle minimal retry configuration', () => {
      const node: WorkflowNode = {
        id: 'minimal-retry',
        type: 'retry',
        data: {} as RetryNodeData,
      };

      const result = retryGenerator.generate(node, context);
      expect(result).toContain('execute_retry_minimal_retry()');
      expect(result).toContain('return 0');
    });

    it('should handle maximum retry attempts', () => {
      const node: WorkflowNode = {
        id: 'max-retry',
        type: 'retry',
        data: {
          max_attempts: 20, // Maximum allowed
        } as RetryNodeData,
      };

      const validation = retryGenerator.validate(node);
      expect(validation.valid).toBe(true);

      const result = retryGenerator.generate(node, context);
      expect(result).toContain('local max_attempts=20');
    });

    it('should handle zero retry delay', () => {
      const node: WorkflowNode = {
        id: 'no-delay-retry',
        type: 'retry',
        data: {
          retry_delay: 0,
        } as RetryNodeData,
      };

      const validation = retryGenerator.validate(node);
      expect(validation.valid).toBe(true);

      const result = retryGenerator.generate(node, context);
      expect(result).toContain('local retry_delay=0');
    });

    it('should sanitize special characters in node id', () => {
      const node: WorkflowNode = {
        id: 'retry-node@with-special.chars#123',
        type: 'retry',
        data: {} as RetryNodeData,
      };

      const result = retryGenerator.generate(node, context);
      expect(result).toContain('execute_retry_retry_node_with_special_chars_123()');
    });
  });

  describe('fallback edge cases', () => {
    it('should handle single fallback path', () => {
      const node: WorkflowNode = {
        id: 'single-fallback',
        type: 'fallback',
        data: {
          fallback_paths: ['single_path'],
        } as FallbackNodeData,
      };

      const validation = fallbackGenerator.validate(node);
      expect(validation.valid).toBe(true);

      const result = fallbackGenerator.generate(node, context);
      expect(result).toContain('local -a fallback_paths=("single_path")');
    });

    it('should handle many fallback paths', () => {
      const paths = Array.from({ length: 10 }, (_, i) => `path_${i + 1}`);
      const node: WorkflowNode = {
        id: 'many-fallbacks',
        type: 'fallback',
        data: {
          fallback_paths: paths,
        } as FallbackNodeData,
      };

      const validation = fallbackGenerator.validate(node);
      expect(validation.valid).toBe(true);

      const result = fallbackGenerator.generate(node, context);
      expect(result).toContain('path_1');
      expect(result).toContain('path_10');
    });

    it('should handle special characters in fallback paths', () => {
      const node: WorkflowNode = {
        id: 'special-paths',
        type: 'fallback',
        data: {
          fallback_paths: ['path with spaces', 'path/with/slashes', 'path"with"quotes'],
        } as FallbackNodeData,
      };

      const result = fallbackGenerator.generate(node, context);
      expect(result).toContain('path with spaces');
      expect(result).toContain('path/with/slashes');
      expect(result).toContain('path\\"with\\"quotes');
    });
  });
});
