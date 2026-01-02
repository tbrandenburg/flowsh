/**
 * Error handling types and interfaces for flowsh
 * Provides structured error handling with detailed context and user-friendly messages
 */

/**
 * Validation result wrapper for operations that can succeed or fail
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationErrorInfo[];
  warnings: ValidationWarning[];
}

/**
 * Detailed validation error with context and suggestions
 */
export interface ValidationErrorInfo {
  type: 'syntax' | 'semantic' | 'security' | 'schema';
  code: string;
  message: string;
  path?: string;
  line?: number;
  column?: number;
  suggestion?: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning for non-fatal issues
 */
export interface ValidationWarning {
  type: 'performance' | 'compatibility' | 'best-practice';
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

/**
 * Security configuration for validation and sanitization
 */
export interface SecurityConfig {
  enableShellSanitization: boolean;
  enableYamlValidation: boolean;
  allowedCommands: string[];
  maxFileSize: number;
  timeoutMs: number;
}

/**
 * Test configuration for coverage and mocking
 */
export interface TestConfig {
  coverage: {
    threshold: number;
    include: string[];
    exclude: string[];
  };
  mocks: {
    enableCliMocks: boolean;
    enableFileMocks: boolean;
  };
}

/**
 * Base error class for all flowsh-specific errors
 */
export abstract class FlowshError extends Error {
  abstract readonly code: string;
  abstract readonly type: string;
  readonly context: Record<string, unknown> | undefined;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.context = context;
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging and debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Validation-related errors (schema, syntax, semantic issues)
 */
export class FlowshValidationError extends FlowshError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly type = 'validation' as const;

  constructor(
    message: string,
    public readonly validationErrors: ValidationErrorInfo[],
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Security-related errors (injection attempts, unsafe operations)
 */
export class FlowshSecurityError extends FlowshError {
  readonly code = 'SECURITY_ERROR' as const;
  readonly type = 'security' as const;

  constructor(
    message: string,
    public readonly securityType: 'injection' | 'unsafe_command' | 'malicious_content',
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Parsing-related errors (YAML syntax, file I/O issues)
 */
export class FlowshParseError extends FlowshError {
  readonly code = 'PARSE_ERROR' as const;
  readonly type = 'parsing' as const;

  constructor(
    message: string,
    public readonly parseDetails?: {
      line?: number;
      column?: number;
      snippet?: string;
    },
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Generation-related errors (shell script creation, template resolution)
 */
export class FlowshGenerationError extends FlowshError {
  readonly code = 'GENERATION_ERROR' as const;
  readonly type = 'generation' as const;
}

/**
 * CLI-related errors (invalid arguments, file access issues)
 */
export class FlowshCliError extends FlowshError {
  readonly code = 'CLI_ERROR' as const;
  readonly type = 'cli' as const;

  constructor(
    message: string,
    public readonly exitCode: number = 1,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Helper to create successful validation results
 */
export function createSuccess<T>(data: T, warnings: ValidationWarning[] = []): ValidationResult<T> {
  return {
    success: true,
    data,
    errors: [],
    warnings,
  };
}

/**
 * Helper to create failed validation results
 */
export function createFailure<T>(
  errors: ValidationErrorInfo[],
  warnings: ValidationWarning[] = []
): ValidationResult<T> {
  return {
    success: false,
    errors,
    warnings,
  };
}

/**
 * Helper to create validation error objects
 */
export function createValidationError(
  type: ValidationErrorInfo['type'],
  code: string,
  message: string,
  options: Partial<Omit<ValidationErrorInfo, 'type' | 'code' | 'message'>> = {}
): ValidationErrorInfo {
  return {
    type,
    code,
    message,
    severity: 'error',
    ...options,
  };
}

/**
 * Helper to create validation warning objects
 */
export function createValidationWarning(
  type: ValidationWarning['type'],
  code: string,
  message: string,
  options: Partial<Omit<ValidationWarning, 'type' | 'code' | 'message'>> = {}
): ValidationWarning {
  return {
    type,
    code,
    message,
    ...options,
  };
}
