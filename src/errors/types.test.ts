/**
 * Tests for error handling types and utilities
 */
import {
  FlowshError,
  FlowshValidationError,
  FlowshSecurityError,
  FlowshParseError,
  FlowshGenerationError,
  FlowshCliError,
  createSuccess,
  createFailure,
  createValidationError,
  createValidationWarning,
} from './types.js';
import { describe, it, expect } from 'vitest';

describe('Error Types', () => {
  describe('ValidationResult', () => {
    it('should create successful validation result', () => {
      const result = createSuccess('test data', []);

      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should create successful validation result with warnings', () => {
      const warning = createValidationWarning('performance', 'SLOW_OP', 'Operation is slow');
      const result = createSuccess('test data', [warning]);

      expect(result.success).toBe(true);
      expect(result.data).toBe('test data');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Operation is slow');
    });

    it('should create failed validation result', () => {
      const error = createValidationError('syntax', 'INVALID_SYNTAX', 'Invalid syntax detected');
      const result = createFailure([error]);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid syntax detected');
    });

    it('should create failed validation result with warnings', () => {
      const error = createValidationError('syntax', 'INVALID_SYNTAX', 'Invalid syntax detected');
      const warning = createValidationWarning('performance', 'SLOW_OP', 'Operation is slow');
      const result = createFailure([error], [warning]);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('ValidationError helpers', () => {
    it('should create validation error with all fields', () => {
      const error = createValidationError(
        'security',
        'SECURITY_ISSUE',
        'Security problem detected',
        {
          path: 'nodes[0].command',
          line: 15,
          column: 10,
          suggestion: 'Use a safe command',
        }
      );

      expect(error.type).toBe('security');
      expect(error.code).toBe('SECURITY_ISSUE');
      expect(error.message).toBe('Security problem detected');
      expect(error.path).toBe('nodes[0].command');
      expect(error.line).toBe(15);
      expect(error.column).toBe(10);
      expect(error.suggestion).toBe('Use a safe command');
      expect(error.severity).toBe('error');
    });

    it('should create validation error with minimal fields', () => {
      const error = createValidationError('syntax', 'SYNTAX_ERROR', 'Bad syntax');

      expect(error.type).toBe('syntax');
      expect(error.code).toBe('SYNTAX_ERROR');
      expect(error.message).toBe('Bad syntax');
      expect(error.severity).toBe('error');
      expect(error.path).toBeUndefined();
      expect(error.line).toBeUndefined();
      expect(error.column).toBeUndefined();
      expect(error.suggestion).toBeUndefined();
    });

    it('should create validation warning with all fields', () => {
      const warning = createValidationWarning(
        'best-practice',
        'DEPRECATED_USAGE',
        'This usage is deprecated',
        {
          path: 'workflow.version',
          suggestion: 'Use the new version format',
        }
      );

      expect(warning.type).toBe('best-practice');
      expect(warning.code).toBe('DEPRECATED_USAGE');
      expect(warning.message).toBe('This usage is deprecated');
      expect(warning.path).toBe('workflow.version');
      expect(warning.suggestion).toBe('Use the new version format');
    });
  });

  describe('FlowshError base class', () => {
    class TestError extends FlowshError {
      readonly code = 'TEST_ERROR' as const;
      readonly type = 'test' as const;
    }

    it('should create error with message only', () => {
      const error = new TestError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.type).toBe('test');
      expect(error.context).toBeUndefined();
      expect(error.name).toBe('TestError');
    });

    it('should create error with context', () => {
      const context = { file: 'test.yaml', line: 42 };
      const error = new TestError('Test error message', context);

      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual(context);
    });

    it('should serialize to JSON correctly', () => {
      const context = { file: 'test.yaml', line: 42 };
      const error = new TestError('Test error message', context);
      const json = error.toJSON();

      expect(json.name).toBe('TestError');
      expect(json.type).toBe('test');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.message).toBe('Test error message');
      expect(json.context).toEqual(context);
      expect(json.stack).toBeDefined();
    });
  });

  describe('Specific error classes', () => {
    it('should create FlowshValidationError correctly', () => {
      const validationErrors = [createValidationError('syntax', 'BAD_SYNTAX', 'Invalid YAML')];
      const error = new FlowshValidationError('Validation failed', validationErrors);

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.type).toBe('validation');
      expect(error.message).toBe('Validation failed');
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it('should create FlowshSecurityError correctly', () => {
      const error = new FlowshSecurityError('Security violation', 'injection');

      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.type).toBe('security');
      expect(error.message).toBe('Security violation');
      expect(error.securityType).toBe('injection');
    });

    it('should create FlowshParseError correctly', () => {
      const parseDetails = { line: 10, column: 5, snippet: 'invalid: [' };
      const error = new FlowshParseError('Parse failed', parseDetails);

      expect(error.code).toBe('PARSE_ERROR');
      expect(error.type).toBe('parsing');
      expect(error.message).toBe('Parse failed');
      expect(error.parseDetails).toEqual(parseDetails);
    });

    it('should create FlowshGenerationError correctly', () => {
      const error = new FlowshGenerationError('Generation failed');

      expect(error.code).toBe('GENERATION_ERROR');
      expect(error.type).toBe('generation');
      expect(error.message).toBe('Generation failed');
    });

    it('should create FlowshCliError correctly', () => {
      const error = new FlowshCliError('CLI error occurred', 2);

      expect(error.code).toBe('CLI_ERROR');
      expect(error.type).toBe('cli');
      expect(error.message).toBe('CLI error occurred');
      expect(error.exitCode).toBe(2);
    });

    it('should create FlowshCliError with default exit code', () => {
      const error = new FlowshCliError('CLI error occurred');

      expect(error.exitCode).toBe(1);
    });
  });
});
