/**
 * Tests for Variable Aggregation Node Generator
 */

import type { WorkflowNode, VariableAggregationNodeData } from '../../dsl/types.js';
import { VariableAggregationNodeGenerator } from './variable-aggregation-node.js';
import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('VariableAggregationNodeGenerator', () => {
  let generator: VariableAggregationNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new VariableAggregationNodeGenerator();
    mockContext = {
      options: {
        verbose: false,
        shell: 'bash',
      },
      variables: new Map(),
      nodeCount: 5,
      currentNodeIndex: 1,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('variable-aggregation');
    });
  });

  describe('generate - concat method', () => {
    it('should generate concat aggregation code', () => {
      const node: WorkflowNode = {
        id: 'agg_1',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: ['first', 'second', 'third'],
          output_variable: 'concatenated',
          separator: ' | ',
          title: 'Concatenate Variables',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_agg_1()');
      expect(result).toContain('log_step "📊 Variable Aggregation: Concatenate Variables"');
      expect(result).toContain('local method="concat"');
      expect(result).toContain('"concat")');
    });

    it('should handle empty input variables', () => {
      const node: WorkflowNode = {
        id: 'empty_agg',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: [],
          output_variable: 'result',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('execute_aggregation_empty_agg()');
      expect(result).toContain('local -a input_vars=()');
    });
  });

  describe('generate - sum method', () => {
    it('should generate sum aggregation with arithmetic operations', () => {
      const node: WorkflowNode = {
        id: 'sum_1',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'sum',
          input_variables: ['num1', 'num2', 'num3'],
          output_variable: 'total',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_sum_1()');
      expect(result).toContain('"sum")');
      expect(result).toContain('local total=0');
      expect(result).toContain('valid_count');
    });
  });

  describe('generate - avg method', () => {
    it('should generate average aggregation with division', () => {
      const node: WorkflowNode = {
        id: 'avg_1',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'avg',
          input_variables: ['score1', 'score2', 'score3'],
          output_variable: 'average',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_avg_1()');
      expect(result).toContain('"avg")');
      expect(result).toContain('local total=0');
      expect(result).toContain('local valid_count=0');
    });
  });

  describe('generate - collect method', () => {
    it('should generate collect aggregation as JSON array', () => {
      const node: WorkflowNode = {
        id: 'collect_1',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'collect',
          input_variables: ['item1', 'item2', 'item3'],
          output_variable: 'collection',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_collect_1()');
      expect(result).toContain('"collect")');
      expect(result).toContain('jq');
    });
  });

  describe('generate - merge method', () => {
    it('should generate merge aggregation for JSON objects', () => {
      const node: WorkflowNode = {
        id: 'merge_1',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'merge',
          input_variables: ['obj1', 'obj2'],
          output_variable: 'merged',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_merge_1()');
      expect(result).toContain('"merge")');
      expect(result).toContain('jq');
    });
  });

  describe('validation', () => {
    it('should validate node structure', () => {
      const validNode: WorkflowNode = {
        id: 'valid_agg',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: ['var1'],
          output_variable: 'result',
        } as VariableAggregationNodeData,
      };

      const result = generator.validate?.(validNode);
      expect(result?.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in variable names', () => {
      const node: WorkflowNode = {
        id: 'special_chars_123',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: ['var_with_underscore', 'var_dash'],
          output_variable: 'result_output',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_aggregation_special_chars_123()');
      expect(result).toContain('local output_var="result_output"');
    });

    it('should handle missing title with fallback to node id', () => {
      const node: WorkflowNode = {
        id: 'no_title',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: ['var1'],
          output_variable: 'result',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('log_step "📊 Variable Aggregation: no_title"');
    });
  });

  describe('shell script structure', () => {
    it('should generate proper bash function structure', () => {
      const node: WorkflowNode = {
        id: 'structure_test',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'concat',
          input_variables: ['var1'],
          output_variable: 'result',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      // Check function declaration
      expect(result).toMatch(/execute_aggregation_structure_test\(\)\s*\{/);

      // Check proper closing
      expect(result).toContain('}');

      // Check key components
      expect(result).toContain('log_step');
      expect(result).toContain('log_success');
    });

    it('should include proper variable scoping', () => {
      const node: WorkflowNode = {
        id: 'scoping_test',
        type: 'variable-aggregation',
        data: {
          aggregation_method: 'sum',
          input_variables: ['a', 'b'],
          output_variable: 'total',
        } as VariableAggregationNodeData,
      };

      const result = generator.generate(node, mockContext);

      // Check local variable declarations
      expect(result).toContain('local -a input_vars=');
      expect(result).toContain('local output_var=');
      expect(result).toContain('local method=');
    });
  });
});
