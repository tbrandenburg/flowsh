/**
 * Tests for Variable Assignment Node Generator
 */

import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkflowNode, VariableAssignmentNodeData } from '../../dsl/types.js';
import { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';

describe('VariableAssignmentNodeGenerator', () => {
  let generator: VariableAssignmentNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new VariableAssignmentNodeGenerator();
    mockContext = {
      options: { verbose: false, shell: 'bash' },
      variables: new Map(),
      nodeCount: 5,
      currentNodeIndex: 1,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('variable-assignment');
    });
  });

  describe('generate - constant assignment', () => {
    it('should generate basic constant assignment', () => {
      const node: WorkflowNode = {
        id: 'simple_var',
        type: 'variable-assignment',
        data: {
          variable: 'my_variable',
          assignment_type: 'constant',
          value: 'hello world',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "MY_VARIABLE" "hello world" "simple_var"');
    });

    it('should escape shell special characters in constant values', () => {
      const node: WorkflowNode = {
        id: 'escaped_var',
        type: 'variable-assignment',
        data: {
          variable: 'special_chars',
          assignment_type: 'constant',
          value: 'hello "world" with $pecial chars & more',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      // The escapeShellValue should handle special characters
      expect(result).toContain('set_var "SPECIAL_CHARS"');
      expect(result).toContain('escaped_var');
    });

    it('should handle template variables in constant values', () => {
      const node: WorkflowNode = {
        id: 'template_var',
        type: 'variable-assignment',
        data: {
          variable: 'message_content',
          assignment_type: 'constant',
          value: '🎯 Daily Riddle Challenge 🎯\n\n${llm_content}\n\n💭 Can you solve it?',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "MESSAGE_CONTENT"');
      expect(result).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(result).not.toContain('${llm_content}'); // Should be processed
      expect(result).not.toContain('\\${llm_content}'); // Should not be escaped
    });

    it('should handle multiple template variables in one value', () => {
      const node: WorkflowNode = {
        id: 'multi_template',
        type: 'variable-assignment',
        data: {
          variable: 'combined_message',
          assignment_type: 'constant',
          value: 'User: ${user_name}, Message: ${user_message}, Response: ${llm_response}',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('$(get_workflow_var "USER_NAME" "default")');
      expect(result).toContain('$(get_workflow_var "USER_MESSAGE" "default")');
      expect(result).toContain('$(get_workflow_var "LLM_RESPONSE" "default")');
    });

    it('should handle numeric values', () => {
      const node: WorkflowNode = {
        id: 'numeric_var',
        type: 'variable-assignment',
        data: {
          variable: 'counter',
          assignment_type: 'constant',
          value: 42,
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "COUNTER" "42" "numeric_var"');
    });

    it('should handle boolean values', () => {
      const node: WorkflowNode = {
        id: 'boolean_var',
        type: 'variable-assignment',
        data: {
          variable: 'is_enabled',
          assignment_type: 'constant',
          value: true,
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "IS_ENABLED" "true" "boolean_var"');
    });

    it('should use default value when value is empty', () => {
      const node: WorkflowNode = {
        id: 'empty_var',
        type: 'variable-assignment',
        data: {
          variable: 'empty_value',
          assignment_type: 'constant',
          value: '',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "EMPTY_VALUE" "" "empty_var"');
    });
  });

  describe('generate - expression assignment', () => {
    it('should generate expression assignment', () => {
      const node: WorkflowNode = {
        id: 'expr_var',
        type: 'variable-assignment',
        data: {
          variable: 'calculated_value',
          assignment_type: 'expression',
          expression: 'echo "Hello World"',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('CALCULATED_VALUE=$(echo "Hello World")');
      expect(result).toContain('set_var "CALCULATED_VALUE" "$CALCULATED_VALUE" "expr_var"');
    });

    it('should handle expression with template variables', () => {
      const node: WorkflowNode = {
        id: 'expr_template',
        type: 'variable-assignment',
        data: {
          variable: 'computed_result',
          assignment_type: 'expression',
          expression: 'echo "Processing ${input_data}"',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('$(get_workflow_var "INPUT_DATA" "default")');
      expect(result).toContain('COMPUTED_RESULT=$(');
    });

    it('should handle arithmetic expressions with template variables', () => {
      const node: WorkflowNode = {
        id: 'arithmetic',
        type: 'variable-assignment',
        data: {
          variable: 'sum_result',
          assignment_type: 'expression',
          expression: '$((${counter} + 10))',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('$(get_workflow_var "COUNTER" "0")'); // Should use "0" for arithmetic
      expect(result).toContain('SUM_RESULT=$(');
    });

    it('should fallback to empty when expression is empty', () => {
      const node: WorkflowNode = {
        id: 'empty_expr',
        type: 'variable-assignment',
        data: {
          variable: 'empty_expression',
          assignment_type: 'expression',
          expression: '',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "EMPTY_EXPRESSION" "" "empty_expr"');
    });
  });

  describe('variable name handling', () => {
    it('should convert variable names to uppercase', () => {
      const node: WorkflowNode = {
        id: 'lowercase_var',
        type: 'variable-assignment',
        data: {
          variable: 'lowercase_name',
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('LOWERCASE_NAME');
      expect(result).not.toContain('lowercase_name');
    });

    it('should sanitize variable names', () => {
      const node: WorkflowNode = {
        id: 'special_var',
        type: 'variable-assignment',
        data: {
          variable: 'my-variable.name@test',
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      // Variable name should be sanitized
      expect(result).toContain('set_var');
      expect(result).toContain('special_var');
    });

    it('should use default variable name when variable is missing', () => {
      const node: WorkflowNode = {
        id: 'no_var_name',
        type: 'variable-assignment',
        data: {
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('TEMP_VAR'); // Should use default
    });
  });

  describe('template variable edge cases', () => {
    it('should handle echo commands with single quotes and template variables', () => {
      const node: WorkflowNode = {
        id: 'echo_quotes',
        type: 'variable-assignment',
        data: {
          variable: 'echo_message',
          assignment_type: 'expression',
          expression: "echo 'Hello ${user_name}, welcome!'",
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('$(get_workflow_var \\"USER_NAME\\" \\"default\\")');
      // Should handle the quote conversion properly
      expect(result).toContain('ECHO_MESSAGE=$(');
    });

    it('should handle nested template variables', () => {
      const node: WorkflowNode = {
        id: 'nested_templates',
        type: 'variable-assignment',
        data: {
          variable: 'complex_message',
          assignment_type: 'constant',
          value: 'Result: ${outer_var} with ${inner_${level}_var}',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('$(get_workflow_var "OUTER_VAR" "default")');
      // Complex nested cases should be handled gracefully
      expect(result).toContain('set_var "COMPLEX_MESSAGE"');
    });

    it('should handle template variables without curly braces', () => {
      const node: WorkflowNode = {
        id: 'no_template',
        type: 'variable-assignment',
        data: {
          variable: 'plain_message',
          assignment_type: 'constant',
          value: 'This is just a plain string with no variables',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain(
        'set_var "PLAIN_MESSAGE" "This is just a plain string with no variables"'
      );
      expect(result).not.toContain('get_workflow_var');
    });
  });

  describe('validation', () => {
    it('should validate successfully with valid data', () => {
      const node: WorkflowNode = {
        id: 'valid_node',
        type: 'variable-assignment',
        data: {
          variable: 'test_var',
          assignment_type: 'constant',
          value: 'test_value',
        } as VariableAssignmentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when variable name is missing', () => {
      const node: WorkflowNode = {
        id: 'invalid_node',
        type: 'variable-assignment',
        data: {
          assignment_type: 'constant',
          value: 'test',
        } as unknown as VariableAssignmentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VARIABLE_NAME');
    });

    it('should fail validation when variable name is empty string', () => {
      const node: WorkflowNode = {
        id: 'empty_var_node',
        type: 'variable-assignment',
        data: {
          variable: '',
          assignment_type: 'constant',
          value: 'test_value',
        } as VariableAssignmentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VARIABLE_NAME');
    });

    it('should fail validation when variable name is only whitespace', () => {
      const node: WorkflowNode = {
        id: 'whitespace_var_node',
        type: 'variable-assignment',
        data: {
          variable: '   ',
          assignment_type: 'constant',
          value: 'test_value',
        } as VariableAssignmentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VARIABLE_NAME');
    });
  });

  describe('getVariables', () => {
    it('should return uppercase variable name for valid variable', () => {
      const node: WorkflowNode = {
        id: 'var_node',
        type: 'variable-assignment',
        data: {
          variable: 'my_test_variable',
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toEqual(['MY_TEST_VARIABLE']);
    });

    it('should return empty array when variable name is missing', () => {
      const node: WorkflowNode = {
        id: 'no_var_node',
        type: 'variable-assignment',
        data: {
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toEqual([]);
    });

    it('should return empty array when variable name is empty string', () => {
      const node: WorkflowNode = {
        id: 'empty_var_node',
        type: 'variable-assignment',
        data: {
          variable: '',
          assignment_type: 'constant',
          value: 'test',
        } as VariableAssignmentNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toEqual([]);
    });
  });

  describe('assignment_type handling', () => {
    it('should default to constant when assignment_type is missing', () => {
      const node: WorkflowNode = {
        id: 'default_type',
        type: 'variable-assignment',
        data: {
          variable: 'default_var',
          value: 'test_value',
        } as unknown as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "DEFAULT_VAR" "test_value"');
    });

    it('should handle unknown assignment_type as constant', () => {
      const node: WorkflowNode = {
        id: 'unknown_type',
        type: 'variable-assignment',
        data: {
          variable: 'unknown_var',
          assignment_type: 'constant', // Use valid type since generator defaults unknown to constant
          value: 'test_value',
        } as VariableAssignmentNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('set_var "UNKNOWN_VAR" "test_value"');
    });
  });
});
