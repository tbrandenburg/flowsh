/**
 * Tests for Parallel Iteration Node Generator
 */

import { ParallelIterationNodeGenerator } from './parallel-iteration-node';
import { WorkflowNode, ParallelIterationNodeData } from '../../dsl/types';
import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationContext } from '../registry/types';

describe('ParallelIterationNodeGenerator', () => {
  let generator: ParallelIterationNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    generator = new ParallelIterationNodeGenerator();
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
      expect(generator.nodeType).toBe('parallel-iteration');
    });
  });

  describe('validation', () => {
    it('should validate correct parallel iteration node', () => {
      const node: WorkflowNode = {
        id: 'test-parallel-1',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items_list',
          output_variable: 'results',
          max_parallel: 4,
          progress_tracking: true,
          error_handling: 'fail',
        } as ParallelIterationNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing input_variable', () => {
      const node: WorkflowNode = {
        id: 'test-parallel-2',
        type: 'parallel-iteration',
        data: {
          output_variable: 'results',
        } as ParallelIterationNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_INPUT_VARIABLE');
    });

    it('should fail validation for invalid max_parallel', () => {
      const node: WorkflowNode = {
        id: 'test-parallel-3',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
          max_parallel: 100, // Too high
        } as ParallelIterationNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_CONCURRENCY');
    });

    it('should fail validation for wrong node type', () => {
      const node: WorkflowNode = {
        id: 'test-wrong-type',
        type: 'start', // Wrong type
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_NODE_TYPE')).toBe(true);
    });
  });

  describe('generation', () => {
    it('should generate basic parallel iteration function', () => {
      const node: WorkflowNode = {
        id: 'parallel-test',
        type: 'parallel-iteration',
        data: {
          title: 'Process Items in Parallel',
          input_variable: 'source_items',
          output_variable: 'processed_results',
          max_parallel: 3,
          progress_tracking: true,
          error_handling: 'fail',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check function name
      expect(result).toContain('execute_parallel_iteration_parallel_test()');

      // Check title and logging
      expect(result).toContain('Process Items in Parallel');
      expect(result).toContain('log_step "🔁 Parallel Iteration:');

      // Check configuration
      expect(result).toContain('local input_variable="source_items"');
      expect(result).toContain('local output_variable="processed_results"');
      expect(result).toContain('local max_parallel=3');
      expect(result).toContain('local progress_tracking=true');
      expect(result).toContain('local error_handling="fail"');
    });

    it('should generate default values when optional parameters are missing', () => {
      const node: WorkflowNode = {
        id: 'simple-parallel',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check defaults
      expect(result).toContain('local output_variable="parallel_iteration_results"');
      expect(result).toContain('local max_parallel=4'); // Default
      expect(result).toContain('local progress_tracking=true'); // Default
      expect(result).toContain('local error_handling="fail"'); // Default
    });

    it('should handle progress tracking disabled', () => {
      const node: WorkflowNode = {
        id: 'no-progress',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
          progress_tracking: false,
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local progress_tracking=false');
      expect(result).toContain('# Progress tracking disabled');
    });

    it('should include proper error handling logic', () => {
      const node: WorkflowNode = {
        id: 'error-handling-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
          error_handling: 'continue',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local error_handling="continue"');
      expect(result).toContain('case "$error_handling" in');
      expect(result).toContain('"fail")');
      expect(result).toContain('"continue"|"ignore"');
    });

    it('should include parallel processing infrastructure', () => {
      const node: WorkflowNode = {
        id: 'infrastructure-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
          max_parallel: 6,
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check parallel processing setup
      expect(result).toContain('local temp_dir=$(mktemp -d)');
      expect(result).toContain('local -a active_pids=()');
      expect(result).toContain('while (( ${#active_pids[@]} >= max_parallel )); do');

      // Check background process management
      expect(result).toContain('kill -0 "$pid" 2>/dev/null');
      expect(result).toContain('wait "$pid"');
      expect(result).toContain(') &');
      expect(result).toContain('local bg_pid=$!');

      // Check cleanup
      expect(result).toContain('rm -rf "$temp_dir"');
    });

    it('should include iteration context setup', () => {
      const node: WorkflowNode = {
        id: 'context-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check iteration context variables
      expect(result).toContain('export ITERATION_ITEM="$current_item"');
      expect(result).toContain('export ITERATION_INDEX="$item_index"');
      expect(result).toContain('export ITERATION_TEMP_DIR="$iteration_temp_dir"');

      // Check result collection
      expect(result).toContain('echo "$current_item" > "$iteration_temp_dir/result.out"');
      expect(result).toContain('cat "$result_file"');
    });

    it('should include performance reporting', () => {
      const node: WorkflowNode = {
        id: 'performance-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('local success_rate=$(( (completed_items * 100) / total_items ))');
      expect(result).toContain('log_success "Parallel iteration completed:');
      expect(result).toContain('log_warning "Parallel iteration had $failed_items failures"');
    });

    it('should sanitize variable names and values', () => {
      const node: WorkflowNode = {
        id: 'sanitize-test-123',
        type: 'parallel-iteration',
        data: {
          title: 'Test "Special" Characters & Symbols',
          input_variable: 'input-with-dashes',
          output_variable: 'output.with.dots',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check sanitized function name
      expect(result).toContain('execute_parallel_iteration_sanitize_test_123()');

      // Check sanitized variable names
      expect(result).toContain('local input_variable="input_with_dashes"');
      expect(result).toContain('local output_variable="output_with_dots"');

      // Check escaped title
      expect(result).toContain('Test \\"Special\\" Characters & Symbols');
    });

    it('should include input validation and empty handling', () => {
      const node: WorkflowNode = {
        id: 'validation-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check input validation
      expect(result).toContain('local input_array_raw="$(get_workflow_var "$input_variable")"');
      expect(result).toContain('if [[ -z "$input_array_raw" ]]; then');
      expect(result).toContain("log_warning \"Input variable '$input_variable' is empty");

      // Check empty array handling
      expect(result).toContain('local total_items=${#input_array[@]}');
      expect(result).toContain('if [[ $total_items -eq 0 ]]; then');
      expect(result).toContain('log_info "No items to process in parallel iteration"');
    });
  });

  describe('shell structure', () => {
    it('should generate proper bash function structure', () => {
      const node: WorkflowNode = {
        id: 'structure-test',
        type: 'parallel-iteration',
        data: {
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      // Check function structure
      expect(result).toMatch(/execute_parallel_iteration_structure_test\(\) \{[\s\S]*\}/);
      expect(result).toContain('return 0');

      // Check proper variable declarations
      expect(result).toMatch(/local \w+=/);

      // Check proper array handling
      expect(result).toContain('local -a input_array=()');
      expect(result).toContain('local -a active_pids=()');
      expect(result).toContain('local -a final_results=()');
    });

    it('should include proper comment header', () => {
      const node: WorkflowNode = {
        id: 'comment-test',
        type: 'parallel-iteration',
        data: {
          title: 'My Parallel Process',
          input_variable: 'items',
        } as ParallelIterationNodeData,
      };

      const result = generator.generate(node, context);

      expect(result).toContain('# Node: comment-test (My Parallel Process)');
    });
  });
});

describe('ParallelIterationNodeGenerator edge cases', () => {
  let generator: ParallelIterationNodeGenerator;
  let context: GenerationContext;

  beforeEach(() => {
    generator = new ParallelIterationNodeGenerator();
    context = {
      options: {},
      variables: new Map(),
      nodeCount: 1,
      currentNodeIndex: 0,
      workflowName: 'test-workflow',
    };
  });

  it('should handle minimal configuration', () => {
    const node: WorkflowNode = {
      id: 'minimal',
      type: 'parallel-iteration',
      data: {
        input_variable: 'items',
      } as ParallelIterationNodeData,
    };

    const result = generator.generate(node, context);
    expect(result).toContain('execute_parallel_iteration_minimal()');
    expect(result).toContain('return 0');
  });

  it('should handle maximum parallel workers', () => {
    const node: WorkflowNode = {
      id: 'max-workers',
      type: 'parallel-iteration',
      data: {
        input_variable: 'items',
        max_parallel: 50, // Maximum allowed
      } as ParallelIterationNodeData,
    };

    // Should validate successfully
    const validation = generator.validate(node);
    expect(validation.valid).toBe(true);

    const result = generator.generate(node, context);
    expect(result).toContain('local max_parallel=50');
  });

  it('should handle single parallel worker', () => {
    const node: WorkflowNode = {
      id: 'single-worker',
      type: 'parallel-iteration',
      data: {
        input_variable: 'items',
        max_parallel: 1, // Sequential processing
      } as ParallelIterationNodeData,
    };

    const validation = generator.validate(node);
    expect(validation.valid).toBe(true);

    const result = generator.generate(node, context);
    expect(result).toContain('local max_parallel=1');
  });

  it('should handle special characters in node id', () => {
    const node: WorkflowNode = {
      id: 'test-node_with-special.chars@123',
      type: 'parallel-iteration',
      data: {
        input_variable: 'items',
      } as ParallelIterationNodeData,
    };

    const result = generator.generate(node, context);
    // Should sanitize the node ID for function name
    expect(result).toContain('execute_parallel_iteration_test_node_with_special_chars_123()');
  });
});
