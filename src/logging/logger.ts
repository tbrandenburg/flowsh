/**
 * Structured logging system for flowsh
 * Provides comprehensive logging with correlation IDs, performance metrics, and configurable output
 */
import { LoggingConfig } from '../config/types.js';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

/**
 * Log levels supported by the system
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Log context interface for structured metadata
 */
export interface LogContext {
  /** Unique correlation ID for tracing requests */
  correlationId?: string;
  /** Operation or action being performed */
  operation?: string;
  /** File or module where the log originated */
  module?: string;
  /** Function name where the log originated */
  function?: string;
  /** Duration of an operation in milliseconds */
  duration?: number;
  /** Memory usage information */
  memoryUsage?: NodeJS.MemoryUsage;
  /** Error information */
  error?: Error | unknown;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Performance timing information
 */
export interface PerformanceTimer {
  start: number;
  end?: number;
  duration?: number;
}

/**
 * Structured logger class
 */
export class StructuredLogger {
  private logger: winston.Logger;
  public readonly config: LoggingConfig;
  private correlationId?: string;
  private timers: Map<string, PerformanceTimer> = new Map();

  constructor(config: LoggingConfig) {
    this.config = config;
    this.logger = this.createLogger();

    if (config.enableCorrelationIds) {
      this.correlationId = uuidv4();
    }
  }

  /**
   * Create Winston logger instance with configured transports
   */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Create format based on configuration
    const format =
      this.config.format === 'json'
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(info => {
              // Redact secrets if enabled
              if (this.config.enableSecretsRedaction) {
                return this.redactSecrets(JSON.stringify(info));
              }
              return JSON.stringify(info);
            })
          )
        : winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.printf(info => {
              const {
                timestamp,
                level,
                message,
                correlationId,
                operation,
                module,
                duration,
                ...meta
              } = info;

              let logLine = `${timestamp} [${level.toUpperCase()}]`;

              if (correlationId) {
                logLine += ` [${correlationId}]`;
              }

              if (operation) {
                logLine += ` [${operation}]`;
              }

              if (module) {
                logLine += ` ${module}:`;
              }

              logLine += ` ${message}`;

              if (duration !== undefined) {
                logLine += ` (${duration}ms)`;
              }

              if (Object.keys(meta).length > 0) {
                logLine += ` ${JSON.stringify(meta)}`;
              }

              // Redact secrets if enabled
              if (this.config.enableSecretsRedaction) {
                return this.redactSecrets(logLine);
              }

              return logLine;
            })
          );

    // Add console transport
    if (this.config.destination === 'console' || this.config.destination === 'both') {
      transports.push(
        new winston.transports.Console({
          level: this.config.level,
          format,
        })
      );
    }

    // Add file transport
    if (
      (this.config.destination === 'file' || this.config.destination === 'both') &&
      this.config.filePath
    ) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          level: this.config.level,
          format,
          maxsize: 10 * 1024 * 1024, // 10MB max file size
          maxFiles: 5, // Keep 5 rotated files
          tailable: true,
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Redact sensitive information from log messages
   */
  private redactSecrets(text: string): string {
    const redactionPatterns = [
      /(password|secret|key|token)(\s*[:=]\s*)([^\s,}]+)/gi,
      /(Bearer\s+)([^\s,}]+)/gi,
      /(api[_-]?key)(\s*[:=]\s*)([^\s,}]+)/gi,
    ];

    let redacted = text;
    redactionPatterns.forEach(pattern => {
      redacted = redacted.replace(pattern, '$1$2***REDACTED***');
    });

    return redacted;
  }

  /**
   * Set correlation ID for this logger instance
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Partial<LogContext>): StructuredLogger {
    const childLogger = new StructuredLogger(this.config);
    if (context.correlationId) {
      childLogger.correlationId = context.correlationId;
    } else if (this.correlationId) {
      childLogger.correlationId = this.correlationId;
    }
    return childLogger;
  }

  /**
   * Start a performance timer
   */
  startTimer(name: string): void {
    this.timers.set(name, {
      start: Date.now(),
    });
  }

  /**
   * End a performance timer and return duration
   */
  endTimer(name: string): number | undefined {
    const timer = this.timers.get(name);
    if (!timer) {
      return undefined;
    }

    const end = Date.now();
    const duration = end - timer.start;

    timer.end = end;
    timer.duration = duration;

    return duration;
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log a performance metric
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    if (!this.config.enablePerformanceLogs) {
      return;
    }

    this.log('info', `Performance: ${operation}`, {
      ...context,
      operation,
      duration,
      type: 'performance',
    });
  }

  /**
   * Log memory usage
   */
  memory(operation: string, context?: LogContext): void {
    if (!this.config.enablePerformanceLogs) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    this.log('debug', `Memory usage: ${operation}`, {
      ...context,
      operation,
      memoryUsage,
      type: 'memory',
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logData: any = {
      message,
      correlationId: context?.correlationId || this.correlationId,
      operation: context?.operation,
      module: context?.module,
      function: context?.function,
      duration: context?.duration,
      memoryUsage: context?.memoryUsage,
    };

    // Add error information if present
    if (context?.error) {
      if (context.error instanceof Error) {
        logData.error = {
          name: context.error.name,
          message: context.error.message,
          stack: context.error.stack,
        };
      } else {
        logData.error = context.error;
      }
    }

    // Add any additional context
    if (context) {
      Object.keys(context).forEach(key => {
        if (
          ![
            'correlationId',
            'operation',
            'module',
            'function',
            'duration',
            'memoryUsage',
            'error',
          ].includes(key)
        ) {
          logData[key] = context[key];
        }
      });
    }

    this.logger.log(level, logData);
  }

  /**
   * Create an operation logger for tracking complex operations
   */
  createOperationLogger(operationName: string, context?: Partial<LogContext>): OperationLogger {
    return new OperationLogger(this, operationName, context);
  }
}

/**
 * Operation logger for tracking complex operations with automatic timing
 */
export class OperationLogger {
  private logger: StructuredLogger;
  private operationName: string;
  private context: Partial<LogContext>;
  private startTime: number;
  private timerName: string;

  constructor(logger: StructuredLogger, operationName: string, context?: Partial<LogContext>) {
    this.logger = logger;
    this.operationName = operationName;
    this.context = { ...context, operation: operationName };
    this.startTime = Date.now();
    this.timerName = `operation_${operationName}_${Date.now()}`;

    this.logger.startTimer(this.timerName);
    this.logger.info(`Started operation: ${operationName}`, this.context);
  }

  /**
   * Log info message within operation context
   */
  info(message: string, additionalContext?: Partial<LogContext>): void {
    this.logger.info(message, { ...this.context, ...additionalContext });
  }

  /**
   * Log warning message within operation context
   */
  warn(message: string, additionalContext?: Partial<LogContext>): void {
    this.logger.warn(message, { ...this.context, ...additionalContext });
  }

  /**
   * Log error message within operation context
   */
  error(message: string, additionalContext?: Partial<LogContext>): void {
    this.logger.error(message, { ...this.context, ...additionalContext });
  }

  /**
   * Complete the operation and log duration
   */
  complete(message?: string): number {
    const duration = this.logger.endTimer(this.timerName) || Date.now() - this.startTime;

    this.logger.info(message || `Completed operation: ${this.operationName}`, {
      ...this.context,
      duration,
    });

    if (this.logger.config.enablePerformanceLogs) {
      this.logger.performance(this.operationName, duration, this.context);
    }

    return duration;
  }

  /**
   * Fail the operation with error details
   */
  fail(error: Error | string, additionalContext?: Partial<LogContext>): void {
    const duration = this.logger.endTimer(this.timerName) || Date.now() - this.startTime;

    const errorContext = {
      ...this.context,
      ...additionalContext,
      duration,
      error: typeof error === 'string' ? new Error(error) : error,
    };

    this.logger.error(`Failed operation: ${this.operationName}`, errorContext);
  }
}

/**
 * Global logger instance (will be initialized with configuration)
 */
let globalLogger: StructuredLogger | undefined;

/**
 * Initialize global logger with configuration
 */
export function initializeLogger(config: LoggingConfig): StructuredLogger {
  globalLogger = new StructuredLogger(config);
  return globalLogger;
}

/**
 * Get global logger instance
 */
export function getLogger(): StructuredLogger {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initializeLogger() first.');
  }
  return globalLogger;
}

/**
 * Create a logger with specific correlation ID
 */
export function createLogger(correlationId?: string): StructuredLogger {
  const logger = getLogger();
  if (correlationId) {
    return logger.child({ correlationId });
  }
  return logger;
}
