/**
 * Tests for Condition Expression Evaluator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlowshConditionEvaluator } from './expression-evaluator.js';
import { WorkflowContext } from './types.js';

describe('FlowshConditionEvaluator', () => {
  let evaluator: FlowshConditionEvaluator;
  let context: WorkflowContext;

  beforeEach(() => {
    evaluator = new FlowshConditionEvaluator();
    context = {
      variables: new Map<string, any>([
        ['NODE_ENV', 'production'],
        ['test_count', 5],
        ['status', 'ready'],
        ['test_results', { passed: 10, failed: 0 }],
        ['items', ['a', 'b', 'c']],
        ['empty_string', ''],
        ['null_value', null],
      ]),
      environment: new Map<string, string>([
        ['CI', 'true'],
        ['PATH', '/usr/bin'],
      ]),
      functions: new Map<string, Function>(),
    };
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple variable comparisons', () => {
      expect(evaluator.evaluateExpression('${NODE_ENV} === "production"', context)).toBe(true);
      expect(evaluator.evaluateExpression('${NODE_ENV} === "development"', context)).toBe(false);
    });

    it('should evaluate numeric comparisons', () => {
      expect(evaluator.evaluateExpression('${test_count} > 0', context)).toBe(true);
      expect(evaluator.evaluateExpression('${test_count} < 3', context)).toBe(false);
      expect(evaluator.evaluateExpression('${test_count} === 5', context)).toBe(true);
    });

    it('should evaluate complex boolean expressions', () => {
      expect(
        evaluator.evaluateExpression('${NODE_ENV} === "production" && ${test_count} > 0', context)
      ).toBe(true);
      expect(
        evaluator.evaluateExpression('${NODE_ENV} === "production" || ${test_count} < 0', context)
      ).toBe(true);
      expect(
        evaluator.evaluateExpression('${NODE_ENV} === "development" && ${test_count} > 0', context)
      ).toBe(false);
    });

    it('should evaluate property access', () => {
      expect(evaluator.evaluateExpression('${test_results["passed"]} > 0', context)).toBe(true);
      expect(evaluator.evaluateExpression('${test_results["failed"]} === 0', context)).toBe(true);
    });

    it('should evaluate built-in functions', () => {
      expect(evaluator.evaluateExpression('length(${items}) === 3', context)).toBe(true);
      expect(evaluator.evaluateExpression('contains(${items}, "b")', context)).toBe(true);
      expect(evaluator.evaluateExpression('contains(${items}, "d")', context)).toBe(false);
      expect(evaluator.evaluateExpression('is_empty(${empty_string})', context)).toBe(true);
      expect(evaluator.evaluateExpression('is_empty(${status})', context)).toBe(false);
    });

    it('should evaluate environment variables', () => {
      expect(evaluator.evaluateExpression('env_var("CI") === "true"', context)).toBe(true);
      expect(
        evaluator.evaluateExpression('env_var("NONEXISTENT", "default") === "default"', context)
      ).toBe(true);
    });

    it('should handle file existence checks', () => {
      // Note: These will test the function but may fail based on actual file system
      expect(() =>
        evaluator.evaluateExpression('file_exists("/nonexistent/path")', context)
      ).not.toThrow();
    });

    it('should handle regex matching', () => {
      expect(evaluator.evaluateExpression('regex_match(${status}, "^ready$")', context)).toBe(true);
      expect(evaluator.evaluateExpression('regex_match(${status}, "^not")', context)).toBe(false);
    });

    it('should throw on invalid syntax', () => {
      expect(() => evaluator.evaluateExpression('${invalid syntax', context)).toThrow();
      expect(() => evaluator.evaluateExpression('${test_count} ===', context)).toThrow();
    });
  });

  describe('parseCondition', () => {
    it('should parse simple conditions and extract variables', () => {
      const parsed = evaluator.parseCondition('${NODE_ENV} === "production"');
      expect(parsed.variables).toContain('NODE_ENV');
      expect(parsed.operators).toContain('===');
      expect(parsed.original).toBe('${NODE_ENV} === "production"');
    });

    it('should parse complex conditions', () => {
      const parsed = evaluator.parseCondition('${test_count} > 0 && length(${items}) === 3');
      expect(parsed.variables).toEqual(expect.arrayContaining(['test_count', 'items']));
      expect(parsed.operators).toEqual(expect.arrayContaining(['>', '&&', '===']));
      expect(parsed.functions).toContain('length');
    });

    it('should handle property access in parsing', () => {
      const parsed = evaluator.parseCondition('${test_results.passed} > 0');
      expect(parsed.variables).toEqual(expect.arrayContaining(['test_results', 'passed']));
    });
  });

  describe('validateConditionSyntax', () => {
    it('should validate correct syntax', () => {
      const result = evaluator.validateConditionSyntax('${NODE_ENV} === "production"');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty conditions', () => {
      const result = evaluator.validateConditionSyntax('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('EMPTY_CONDITION');
    });

    it('should detect unclosed variable braces', () => {
      const result = evaluator.validateConditionSyntax('${NODE_ENV === "production"');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('UNCLOSED_VARIABLE_BRACE');
    });

    it('should detect syntax errors', () => {
      const result = evaluator.validateConditionSyntax('${test_count} > > 5');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'SYNTAX_ERROR')).toBe(true);
    });

    it('should warn about potentially unsafe patterns', () => {
      const result = evaluator.validateConditionSyntax('eval("dangerous code")');
      expect(result.warnings.some(w => w.code === 'POTENTIALLY_UNSAFE')).toBe(true);
    });

    it('should warn about complex property access', () => {
      const result = evaluator.validateConditionSyntax('${complex.nested.deep.property} > 0');
      expect(result.warnings.some(w => w.code === 'COMPLEX_PROPERTY_ACCESS')).toBe(true);
    });
  });

  describe('built-in functions', () => {
    it('should handle file_exists function', () => {
      expect(evaluator.evaluateExpression('file_exists("package.json")', context)).toBe(true);
      expect(
        evaluator.evaluateExpression('file_exists("/definitely/nonexistent/file")', context)
      ).toBe(false);
    });

    it('should handle type conversion functions', () => {
      expect(evaluator.evaluateExpression('to_string(${test_count}) === "5"', context)).toBe(true);
      expect(evaluator.evaluateExpression('to_number("10") === 10', context)).toBe(true);
    });

    it('should handle null and undefined values safely', () => {
      expect(evaluator.evaluateExpression('is_empty(${null_value})', context)).toBe(true);
      expect(evaluator.evaluateExpression('length(${null_value}) === 0', context)).toBe(true);
      expect(evaluator.evaluateExpression('to_string(${null_value}) === ""', context)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle nested function calls', () => {
      expect(evaluator.evaluateExpression('length(to_string(${test_count})) === 1', context)).toBe(
        true
      );
    });

    it('should handle mixed data types in comparisons', () => {
      expect(evaluator.evaluateExpression('to_number("5") === ${test_count}', context)).toBe(true);
      expect(evaluator.evaluateExpression('contains(to_string(${test_count}), "5")', context)).toBe(
        true
      );
    });

    it('should handle whitespace and formatting variations', () => {
      expect(evaluator.evaluateExpression('   ${NODE_ENV}   ===   "production"   ', context)).toBe(
        true
      );
      expect(evaluator.evaluateExpression('${test_count}>0&&${status}==="ready"', context)).toBe(
        true
      );
    });
  });
});
