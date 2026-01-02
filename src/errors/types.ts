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
  readonly timestamp: Date;
  readonly correlationId?: string;

  constructor(message: string, context?: Record<string, unknown>, correlationId?: string) {
    super(message);
    this.context = context;
    this.timestamp = new Date();
    this.name = this.constructor.name;

    if (correlationId) {
      this.correlationId = correlationId;
    }

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
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
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
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
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
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
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
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
  }
}

/**
 * Generation-related errors (shell script creation, template resolution)
 */
export class FlowshGenerationError extends FlowshError {
  readonly code = 'GENERATION_ERROR' as const;
  readonly type = 'generation' as const;

  constructor(message: string, context?: Record<string, unknown>, correlationId?: string) {
    super(message, context, correlationId);
  }
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
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
  }
}

/**
 * Configuration-related errors with detailed validation context
 */
export class FlowshConfigurationError extends FlowshError {
  readonly code = 'CONFIGURATION_ERROR' as const;
  readonly type = 'configuration' as const;

  constructor(
    message: string,
    public readonly configPath?: string,
    public readonly validationErrors?: string[],
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
  }

  static invalidConfiguration(
    validationErrors: string[],
    configPath?: string,
    correlationId?: string
  ): FlowshConfigurationError {
    const message = `Configuration validation failed: ${validationErrors.join(', ')}`;
    return new FlowshConfigurationError(
      message,
      configPath,
      validationErrors,
      undefined,
      correlationId
    );
  }

  static configFileNotFound(filePath: string, correlationId?: string): FlowshConfigurationError {
    return new FlowshConfigurationError(
      `Configuration file not found: ${filePath}`,
      filePath,
      undefined,
      undefined,
      correlationId
    );
  }
}

/**
 * Template-related errors with rendering context
 */
export class FlowshTemplateError extends FlowshError {
  readonly code = 'TEMPLATE_ERROR' as const;
  readonly type = 'template' as const;

  constructor(
    message: string,
    public readonly templateName: string,
    public readonly templatePath?: string,
    public readonly renderingContext?: Record<string, unknown>,
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
  }

  static templateNotFound(templateName: string, correlationId?: string): FlowshTemplateError {
    return new FlowshTemplateError(
      `Template not found: ${templateName}`,
      templateName,
      undefined,
      undefined,
      undefined,
      correlationId
    );
  }

  static renderingFailed(
    templateName: string,
    error: string,
    renderingContext?: Record<string, unknown>,
    correlationId?: string
  ): FlowshTemplateError {
    return new FlowshTemplateError(
      `Template rendering failed: ${error}`,
      templateName,
      undefined,
      renderingContext,
      undefined,
      correlationId
    );
  }
}

/**
 * File system operation errors
 */
export class FlowshFileSystemError extends FlowshError {
  readonly code = 'FILE_SYSTEM_ERROR' as const;
  readonly type = 'filesystem' as const;

  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath: string,
    public readonly systemError?: Error,
    context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, context, correlationId);
  }

  static fileNotFound(filePath: string, correlationId?: string): FlowshFileSystemError {
    return new FlowshFileSystemError(
      `File not found: ${filePath}`,
      'read',
      filePath,
      undefined,
      undefined,
      correlationId
    );
  }

  static permissionDenied(
    filePath: string,
    operation: string,
    correlationId?: string
  ): FlowshFileSystemError {
    return new FlowshFileSystemError(
      `Permission denied for ${operation} operation on: ${filePath}`,
      operation,
      filePath,
      undefined,
      undefined,
      correlationId
    );
  }

  static fromSystemError(
    systemError: Error & { code?: string; path?: string },
    operation: string,
    correlationId?: string
  ): FlowshFileSystemError {
    const filePath = systemError.path || 'unknown';
    let message = `File system error during ${operation}: ${systemError.message}`;

    if (systemError.code) {
      message += ` (${systemError.code})`;
    }

    return new FlowshFileSystemError(
      message,
      operation,
      filePath,
      systemError,
      undefined,
      correlationId
    );
  }
}

/**
 * Recovery action interface for automatic error recovery
 */
export interface RecoveryAction {
  name: string;
  description: string;
  execute(): Promise<unknown>;
  canRecover(error: FlowshError): boolean;
}

/**
 * Error recovery registry for handling automatic recovery strategies
 */
export class ErrorRecoveryRegistry {
  private recoveryActions: Map<string, RecoveryAction[]> = new Map();

  /**
   * Register a recovery action for specific error types
   */
  registerRecoveryAction(errorCode: string, action: RecoveryAction): void {
    const actions = this.recoveryActions.get(errorCode) || [];
    actions.push(action);
    this.recoveryActions.set(errorCode, actions);
  }

  /**
   * Get available recovery actions for an error
   */
  getRecoveryActions(error: FlowshError): RecoveryAction[] {
    const actions = this.recoveryActions.get(error.code) || [];
    return actions.filter(action => action.canRecover(error));
  }

  /**
   * Attempt automatic recovery for an error
   */
  async attemptRecovery(error: FlowshError): Promise<unknown> {
    const actions = this.getRecoveryActions(error);
    if (actions.length === 0) {
      throw new Error(`No recovery actions available for error: ${error.code}`);
    }

    // Try the first available recovery action
    const action = actions[0]!;
    return action.execute();
  }
}

/**
 * Global error recovery registry
 */
export const errorRecoveryRegistry = new ErrorRecoveryRegistry();

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
