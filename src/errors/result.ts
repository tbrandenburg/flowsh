/**
 * Result pattern implementation for explicit error handling
 * Provides functional error handling without exceptions
 */
import { FlowshError, RecoveryAction } from './types.js';

/**
 * Success result type
 */
export interface Success<T> {
  readonly success: true;
  readonly data: T;
  readonly warnings?: string[];
}

/**
 * Failure result type
 */
export interface Failure<E = FlowshError> {
  readonly success: false;
  readonly error: E;
  readonly recovery?: RecoveryAction;
}

/**
 * Result union type
 */
export type Result<T, E = FlowshError> = Success<T> | Failure<E>;

/**
 * Creates a successful result
 */
export function success<T>(data: T, warnings?: string[]): Success<T> {
  if (warnings) {
    return {
      success: true,
      data,
      warnings,
    };
  }
  return {
    success: true,
    data,
  };
}

/**
 * Creates a failure result
 */
export function failure<E = FlowshError>(error: E, recovery?: RecoveryAction): Failure<E> {
  if (recovery) {
    return {
      success: false,
      error,
      recovery,
    };
  }
  return {
    success: false,
    error,
  };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

/**
 * Maps over the data in a successful result
 */
export function map<T, U, E>(result: Result<T, E>, mapper: (data: T) => U): Result<U, E> {
  if (isSuccess(result)) {
    return success(mapper(result.data), result.warnings);
  }
  return result;
}

/**
 * Maps over the error in a failed result
 */
export function mapError<T, E1, E2>(
  result: Result<T, E1>,
  mapper: (error: E1) => E2
): Result<T, E2> {
  if (isFailure(result)) {
    return failure(mapper(result.error), result.recovery);
  }
  return result;
}

/**
 * Chains operations on successful results (flatMap)
 */
export function chain<T, U, E>(
  result: Result<T, E>,
  chainer: (data: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return chainer(result.data);
  }
  return result;
}

/**
 * Collects all successful results and returns them as an array
 */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const successes: T[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    successes.push(result.data);
    if (result.warnings) {
      warnings.push(...result.warnings);
    }
  }

  return success(successes, warnings.length > 0 ? warnings : undefined);
}

/**
 * Partitions results into successes and failures
 */
export function partition<T, E>(
  results: Result<T, E>[]
): { successes: T[]; failures: E[]; warnings: string[] } {
  const successes: T[] = [];
  const failures: E[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (isSuccess(result)) {
      successes.push(result.data);
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    } else {
      failures.push(result.error);
    }
  }

  return { successes, failures, warnings };
}

/**
 * Provides a default value for failed results
 */
export function withDefault<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Executes a function with the result data if successful
 */
export function forEach<T, E>(result: Result<T, E>, fn: (data: T) => void): Result<T, E> {
  if (isSuccess(result)) {
    fn(result.data);
  }
  return result;
}

/**
 * Executes a function with the error if failed
 */
export function forEachError<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
  if (isFailure(result)) {
    fn(result.error);
  }
  return result;
}

/**
 * Converts a Result to a Promise
 */
export function toPromise<T, E extends Error>(result: Result<T, E>): Promise<T> {
  if (isSuccess(result)) {
    return Promise.resolve(result.data);
  }
  return Promise.reject(result.error);
}

/**
 * Converts a Promise to a Result
 */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    const data = await promise;
    return success(data);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Converts a function that throws to one that returns a Result
 */
export function tryCatch<T, A extends readonly unknown[]>(
  fn: (...args: A) => T
): (...args: A) => Result<T, Error> {
  return (...args: A) => {
    try {
      return success(fn(...args));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Converts an async function that throws to one that returns a Result
 */
export function tryAsync<T, A extends readonly unknown[]>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<Result<T, Error>> {
  return async (...args: A) => {
    return fromPromise(fn(...args));
  };
}

/**
 * Retry mechanism for operations that return Results
 */
export async function retry<T, E>(
  operation: () => Promise<Result<T, E>>,
  options: {
    maxAttempts: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: E) => boolean;
  }
): Promise<Result<T, E>> {
  const { maxAttempts, delay = 1000, backoff = 'exponential', shouldRetry } = options;

  let lastResult: Result<T, E>;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await operation();

    if (isSuccess(lastResult)) {
      return lastResult;
    }

    // Don't retry on last attempt
    if (attempt === maxAttempts) {
      break;
    }

    // Check if we should retry this error
    if (shouldRetry && !shouldRetry(lastResult.error)) {
      break;
    }

    // Calculate delay
    const currentDelay =
      backoff === 'exponential' ? delay * Math.pow(2, attempt - 1) : delay * attempt;

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, currentDelay));
  }

  return lastResult!;
}

/**
 * Circuit breaker pattern for Results
 */
export class CircuitBreaker<T, E> {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private options: {
      failureThreshold: number;
      resetTimeout: number;
      shouldTrip?: (error: E) => boolean;
    }
  ) {}

  async execute(operation: () => Promise<Result<T, E>>): Promise<Result<T, E>> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'half-open';
      } else {
        return failure(new Error('Circuit breaker is open') as unknown as E);
      }
    }

    const result = await operation();

    if (isFailure(result)) {
      const shouldTrip = this.options.shouldTrip ? this.options.shouldTrip(result.error) : true;

      if (shouldTrip) {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.options.failureThreshold) {
          this.state = 'open';
        }
      }
    } else {
      // Reset on success
      this.failures = 0;
      this.state = 'closed';
    }

    return result;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}
