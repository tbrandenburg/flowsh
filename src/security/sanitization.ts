/**
 * Shell command sanitization and validation utilities
 * Provides security-focused shell command sanitization to prevent injection attacks
 */

import {
  ValidationResult,
  ValidationErrorInfo,
  createSuccess,
  createFailure,
  createValidationError,
} from '../errors/types.js';

/**
 * Shell command sanitizer with allowlist-based validation
 */
export class ShellSanitizer {
  /**
   * List of allowed commands for shell execution
   * These are considered safe for use in generated shell scripts
   */
  private static readonly ALLOWED_COMMANDS = [
    'opencode',
    'git',
    'npm',
    'node',
    'python',
    'python3',
    'pip',
    'pip3',
    'curl',
    'wget',
    'echo',
    'cat',
    'ls',
    'cd',
    'mkdir',
    'rmdir',
    'cp',
    'mv',
    'chmod',
    'grep',
    'awk',
    'sed',
    'sort',
    'uniq',
    'head',
    'tail',
    'wc',
    'find',
    'which',
    'whereis',
    'export',
    'source',
    'bash',
    'sh',
  ];

  /**
   * Dangerous shell metacharacters that need escaping or removal
   */
  private static readonly DANGEROUS_CHARS = /[;&|`$(){}[\]\\><]/g;

  /**
   * Potentially dangerous patterns that should be blocked
   */
  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf?\s+\//gi, // Dangerous recursive delete operations
    />\s*\/dev\/null/gi, // Output redirection attempts
    /\$\([^)]*\)/g, // Command substitution
    /`[^`]*`/g, // Backtick command substitution
    /\${[^}]*}/g, // Variable expansion
    /eval\s*[\('"]/gi, // eval statements
    /exec\s*[\('"]/gi, // exec statements
    /\|\s*bash/gi, // Pipe to shell
    /\|\s*sh/gi, // Pipe to shell
    /sudo\s+/gi, // Privilege escalation
    /su\s+/gi, // User switching
  ];

  /**
   * Sanitize a shell command string for safe execution
   * @param command The command string to sanitize
   * @returns ValidationResult with sanitized command or errors
   */
  static sanitizeCommand(command: string): ValidationResult<string> {
    const errors: ValidationErrorInfo[] = [];

    // Basic validation
    if (typeof command !== 'string') {
      errors.push(
        createValidationError('security', 'INVALID_COMMAND', 'Command must be a string', {
          suggestion: 'Provide a valid command string',
        })
      );
      return createFailure(errors);
    }

    const trimmedCommand = command.trim();

    // Check if command is empty after trimming
    if (!trimmedCommand) {
      errors.push(
        createValidationError('security', 'EMPTY_COMMAND', 'Command cannot be empty', {
          suggestion: 'Provide a valid command',
        })
      );
      return createFailure(errors);
    }

    // Extract the base command (first word)
    const commandParts = trimmedCommand.split(' ');
    const baseCommand = commandParts[0];

    if (!baseCommand) {
      errors.push(
        createValidationError('security', 'INVALID_COMMAND_FORMAT', 'Command format is invalid', {
          suggestion: 'Provide a valid command format',
        })
      );
      return createFailure(errors);
    }

    // Validate against allowlist
    if (!this.ALLOWED_COMMANDS.includes(baseCommand)) {
      errors.push(
        createValidationError(
          'security',
          'DISALLOWED_COMMAND',
          `Command '${baseCommand}' is not in the allowed list`,
          {
            suggestion: `Use one of the allowed commands: ${this.ALLOWED_COMMANDS.slice(0, 10).join(', ')}...`,
            path: 'command',
          }
        )
      );
      return createFailure(errors);
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(trimmedCommand)) {
        errors.push(
          createValidationError(
            'security',
            'DANGEROUS_PATTERN',
            `Potentially dangerous pattern detected in command: ${pattern}`,
            {
              suggestion: 'Remove dangerous shell operations from the command',
              path: 'command',
            }
          )
        );
      }
    }

    if (errors.length > 0) {
      return createFailure(errors);
    }

    // Sanitize shell metacharacters by escaping them
    const sanitized = trimmedCommand.replace(this.DANGEROUS_CHARS, '\\$&');

    return createSuccess(sanitized);
  }

  /**
   * Sanitize a variable name for safe use in shell scripts
   * @param variable The variable name to sanitize
   * @returns Sanitized variable name with only safe characters
   */
  static sanitizeVariable(variable: string): string {
    if (typeof variable !== 'string') {
      return 'INVALID_VAR';
    }

    if (variable === '') {
      return 'DEFAULT_VAR';
    }

    // Replace any non-alphanumeric characters (except underscore) with underscores
    let sanitized = variable.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure variable starts with letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }

    // Ensure variable is not empty
    if (!sanitized) {
      return 'DEFAULT_VAR';
    }

    return sanitized;
  }

  /**
   * Validate and sanitize shell arguments
   * @param args Array of command arguments
   * @returns ValidationResult with sanitized arguments or errors
   */
  static sanitizeArguments(args: string[]): ValidationResult<string[]> {
    const errors: ValidationErrorInfo[] = [];
    const sanitizedArgs: string[] = [];

    if (!Array.isArray(args)) {
      errors.push(
        createValidationError('security', 'INVALID_ARGS', 'Arguments must be an array of strings', {
          suggestion: 'Provide arguments as an array',
        })
      );
      return createFailure(errors);
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (typeof arg !== 'string') {
        errors.push(
          createValidationError(
            'security',
            'INVALID_ARG_TYPE',
            `Argument at index ${i} must be a string`,
            {
              path: `args[${i}]`,
              suggestion: 'Convert argument to string',
            }
          )
        );
        continue;
      }

      // Check for dangerous patterns in arguments (only the most critical ones)
      const criticalPatterns = [
        /\$\([^)]*\)/g, // Command substitution
        /`[^`]*`/g, // Backtick command substitution
        /\${[^}]*}/g, // Variable expansion
        /eval\s*[\('"]/gi, // eval statements
        /exec\s*[\('"]/gi, // exec statements
      ];

      for (const pattern of criticalPatterns) {
        if (pattern.test(arg)) {
          errors.push(
            createValidationError(
              'security',
              'DANGEROUS_ARG_PATTERN',
              `Dangerous pattern detected in argument ${i}: ${pattern}`,
              {
                path: `args[${i}]`,
                suggestion: 'Remove dangerous content from argument',
              }
            )
          );
        }
      }

      // Sanitize the argument
      const sanitizedArg = arg.replace(this.DANGEROUS_CHARS, '\\$&');
      sanitizedArgs.push(sanitizedArg);
    }

    if (errors.length > 0) {
      return createFailure(errors);
    }

    return createSuccess(sanitizedArgs);
  }

  /**
   * Build a complete sanitized shell command with arguments
   * @param baseCommand The base command to execute
   * @param args Optional arguments for the command
   * @returns ValidationResult with complete sanitized command or errors
   */
  static buildSafeCommand(baseCommand: string, args: string[] = []): ValidationResult<string> {
    // Sanitize the base command
    const commandResult = this.sanitizeCommand(baseCommand);
    if (!commandResult.success) {
      return commandResult;
    }

    // Sanitize arguments if provided
    if (args.length > 0) {
      const argsResult = this.sanitizeArguments(args);
      if (!argsResult.success) {
        return createFailure(argsResult.errors);
      }

      const fullCommand = [commandResult.data!, ...argsResult.data!].join(' ');
      return createSuccess(fullCommand);
    }

    return commandResult;
  }

  /**
   * Check if a command is in the allowed list
   * @param command Command to check
   * @returns true if command is allowed, false otherwise
   */
  static isCommandAllowed(command: string): boolean {
    if (!command || typeof command !== 'string') {
      return false;
    }

    const commandParts = command.trim().split(' ');
    const baseCommand = commandParts[0];
    return baseCommand ? this.ALLOWED_COMMANDS.includes(baseCommand) : false;
  }

  /**
   * Get the list of allowed commands
   * @returns Array of allowed command strings
   */
  static getAllowedCommands(): readonly string[] {
    return this.ALLOWED_COMMANDS;
  }
}
