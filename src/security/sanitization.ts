/**
 * Shell command sanitization and validation utilities
 * Provides comprehensive security-focused shell command sanitization to prevent injection attacks
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
    'timeout',
    'ulimit',
    'umask',
    'stat',
    'date',
    'sleep',
    'touch',
    'jq',
    'tr',
    'base64',
    'xargs',
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
    /\${[^}]*}/g, // Variable expansion (except in allowed contexts)
    /eval\s*[\('"]/gi, // eval statements
    /exec\s*[\('"]/gi, // exec statements
    /\|\s*bash/gi, // Pipe to shell
    /\|\s*sh/gi, // Pipe to shell
    /sudo\s+/gi, // Privilege escalation
    /su\s+/gi, // User switching
    /chmod\s+[0-7]{3,4}\s+\//gi, // Dangerous chmod operations
    /chown\s+.*\s+\//gi, // Ownership changes
    /dd\s+if=/gi, // Direct disk access
    /mkfifo/gi, // Named pipe creation
    /nc\s+.*\s+\d+/gi, // Netcat usage
    /telnet/gi, // Telnet connections
  ];

  /**
   * File path patterns that should be restricted
   */
  private static readonly RESTRICTED_PATHS = [
    /\/etc\//gi,
    /\/proc\//gi,
    /\/sys\//gi,
    /\/dev\//gi,
    /\/root\//gi,
    /\/boot\//gi,
    /\/var\/log\//gi,
    /\/usr\/bin\//gi,
    /\/usr\/sbin\//gi,
    /\/sbin\//gi,
    /\/bin\//gi,
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

    // Check for restricted file paths
    for (const pathPattern of this.RESTRICTED_PATHS) {
      if (pathPattern.test(trimmedCommand)) {
        errors.push(
          createValidationError(
            'security',
            'RESTRICTED_PATH',
            `Command accesses restricted path: ${pathPattern}`,
            {
              suggestion: 'Avoid accessing system directories',
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
   * Sanitize file paths to prevent directory traversal attacks
   * @param path The file path to sanitize
   * @returns ValidationResult with sanitized path or errors
   */
  static sanitizeFilePath(path: string): ValidationResult<string> {
    const errors: ValidationErrorInfo[] = [];

    if (typeof path !== 'string') {
      errors.push(
        createValidationError('security', 'INVALID_PATH', 'Path must be a string', {
          suggestion: 'Provide a valid path string',
        })
      );
      return createFailure(errors);
    }

    const trimmedPath = path.trim();

    if (!trimmedPath) {
      errors.push(
        createValidationError('security', 'EMPTY_PATH', 'Path cannot be empty', {
          suggestion: 'Provide a valid path',
        })
      );
      return createFailure(errors);
    }

    // Check for path traversal attempts
    if (trimmedPath.includes('..')) {
      errors.push(
        createValidationError('security', 'PATH_TRAVERSAL', 'Path traversal detected', {
          suggestion: 'Use relative paths within the working directory',
        })
      );
      return createFailure(errors);
    }

    // Check for absolute paths to system directories
    for (const restrictedPattern of this.RESTRICTED_PATHS) {
      if (restrictedPattern.test(trimmedPath)) {
        errors.push(
          createValidationError(
            'security',
            'RESTRICTED_PATH_ACCESS',
            `Access to restricted path detected: ${restrictedPattern}`,
            {
              suggestion: 'Use paths within user directories only',
            }
          )
        );
      }
    }

    if (errors.length > 0) {
      return createFailure(errors);
    }

    // Normalize the path
    const sanitized = trimmedPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    return createSuccess(sanitized);
  }

  /**
   * Sanitize environment variable values
   * @param value The environment variable value to sanitize
   * @returns ValidationResult with sanitized value or errors
   */
  static sanitizeEnvValue(value: string): ValidationResult<string> {
    const errors: ValidationErrorInfo[] = [];

    if (typeof value !== 'string') {
      errors.push(
        createValidationError(
          'security',
          'INVALID_ENV_VALUE',
          'Environment value must be a string',
          {
            suggestion: 'Provide a valid string value',
          }
        )
      );
      return createFailure(errors);
    }

    // Check for command injection in environment values
    const dangerousPatterns = [
      /\$\([^)]*\)/g, // Command substitution
      /`[^`]*`/g, // Backtick command substitution
      /;\s*[a-zA-Z]/g, // Command chaining
      /\|\s*[a-zA-Z]/g, // Pipe to commands
      /&&\s*[a-zA-Z]/g, // And operator with commands
      /\|\|\s*[a-zA-Z]/g, // Or operator with commands
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(value)) {
        errors.push(
          createValidationError(
            'security',
            'DANGEROUS_ENV_VALUE',
            `Dangerous pattern detected in environment value: ${pattern}`,
            {
              suggestion: 'Remove shell metacharacters from environment values',
            }
          )
        );
      }
    }

    if (errors.length > 0) {
      return createFailure(errors);
    }

    // Escape special characters but allow normal variable expansion
    const sanitized = value.replace(/([;&|`(){}[\]\\><])/g, '\\$1');

    return createSuccess(sanitized);
  }

  /**
   * Generate secure shell function wrapper
   * @param functionName Name of the shell function
   * @param commands Array of commands to execute
   * @returns Secure shell function
   */
  static generateSecureFunction(functionName: string, commands: string[]): string {
    const sanitizedName = this.sanitizeVariable(functionName);

    const sanitizedCommands = commands
      .map(cmd => {
        const result = this.sanitizeCommand(cmd);
        return result.success ? result.data! : `# INVALID COMMAND: ${cmd}`;
      })
      .join('\n    ');

    return `
# Secure function: ${sanitizedName}
${sanitizedName}() {
    # Set strict error handling
    set -euo pipefail
    
    # Set resource limits
    ulimit -t 300  # CPU time: 5 minutes
    ulimit -v 1048576  # Virtual memory: 1GB
    ulimit -u 50   # Max processes
    ulimit -n 100  # Max open files
    
    # Set secure umask
    umask 077
    
    # Execute commands
    ${sanitizedCommands}
    
    # Restore defaults
    set +euo pipefail
}`;
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

  /**
   * Generate secure temporary file name
   * @param prefix Optional prefix for the file name
   * @returns Secure temporary file name
   */
  static generateSecureTempFileName(prefix: string = 'flowsh'): string {
    const sanitizedPrefix = this.sanitizeVariable(prefix);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${sanitizedPrefix}_${timestamp}_${random}`;
  }

  /**
   * Validate and sanitize a complete script
   * @param script The shell script to validate
   * @returns ValidationResult with sanitized script or errors
   */
  static sanitizeScript(script: string): ValidationResult<string> {
    const errors: ValidationErrorInfo[] = [];

    if (typeof script !== 'string') {
      errors.push(
        createValidationError('security', 'INVALID_SCRIPT', 'Script must be a string', {
          suggestion: 'Provide a valid script string',
        })
      );
      return createFailure(errors);
    }

    const lines = script.split('\n');
    const sanitizedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        sanitizedLines.push(lines[i] || '');
        continue;
      }

      // Validate each command line
      const commandResult = this.sanitizeCommand(line);
      if (!commandResult.success) {
        errors.push(
          ...commandResult.errors.map(e =>
            createValidationError('security', 'SCRIPT_LINE_ERROR', `Line ${i + 1}: ${e.message}`, {
              path: `line:${i + 1}`,
              suggestion: e.suggestion || 'Fix the command syntax',
            })
          )
        );
      } else {
        sanitizedLines.push(commandResult.data || line);
      }
    }

    if (errors.length > 0) {
      return createFailure(errors);
    }

    return createSuccess(sanitizedLines.join('\n'));
  }
}
