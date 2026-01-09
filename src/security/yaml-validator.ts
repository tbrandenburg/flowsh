/**
 * YAML security validation utilities
 * Provides security-focused YAML validation to prevent malicious content and attacks
 */

import {
  ValidationResult,
  ValidationErrorInfo,
  ValidationWarning,
  createSuccess,
  createFailure,
  createValidationError,
  createValidationWarning,
} from '../errors/types.js';

/**
 * YAML security validator with content analysis and size limits
 */
export class YamlSecurityValidator {
  /**
   * Maximum file size for YAML content (10MB)
   */
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Maximum nesting depth to prevent recursion attacks
   */
  private static readonly MAX_DEPTH = 15;

  /**
   * Maximum number of nodes to prevent DoS attacks
   */
  private static readonly MAX_NODES = 10000;

  /**
   * Warning threshold for file size (5MB)
   */
  private static readonly SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024; // 5MB

  /**
   * Suspicious patterns that could indicate malicious content
   */
  private static readonly SUSPICIOUS_PATTERNS = [
    {
      pattern: /exec\s*\(/gi,
      description: 'JavaScript exec function call',
      severity: 'error' as const,
    },
    {
      pattern: /eval\s*\(/gi,
      description: 'JavaScript eval function call',
      severity: 'error' as const,
    },
    {
      pattern: /require\s*\(/gi,
      description: 'Node.js require function call',
      severity: 'error' as const,
    },
    {
      pattern: /__proto__/gi,
      description: 'Prototype pollution attempt',
      severity: 'error' as const,
    },
    {
      pattern: /constructor/gi,
      description: 'Constructor property access',
      severity: 'warning' as const,
    },
    {
      pattern: /function.*\(/gi,
      description: 'Function declaration',
      severity: 'warning' as const,
    },
    {
      pattern: /javascript:/gi,
      description: 'JavaScript protocol',
      severity: 'error' as const,
    },
    // {
    //   pattern: /data:\s*[a-zA-Z0-9\/\+;=]+/gi,
    //   description: 'Data URL scheme',
    //   severity: 'warning' as const,
    // },
    // Template literal pattern removed - flowsh uses ${variable} syntax legitimately
    {
      pattern: /<!--.*-->/gi,
      description: 'HTML comments',
      severity: 'warning' as const,
    },
  ];

  /**
   * Dangerous YAML keys that should be blocked
   */
  private static readonly DANGEROUS_KEYS = [
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
  ];

  /**
   * Validate YAML content for security issues
   * @param content The YAML content string to validate
   * @param options Optional validation options
   * @returns ValidationResult with security validation results
   */
  static validateYamlSecurity(
    content: string,
    options: {
      maxFileSize?: number;
      maxDepth?: number;
      maxNodes?: number;
      strictMode?: boolean;
    } = {}
  ): ValidationResult<void> {
    const errors: ValidationErrorInfo[] = [];
    const warnings: ValidationWarning[] = [];

    // Use provided options or defaults
    const maxFileSize = options.maxFileSize ?? this.MAX_FILE_SIZE;
    const maxDepth = options.maxDepth ?? this.MAX_DEPTH;
    const maxNodes = options.maxNodes ?? this.MAX_NODES;
    const strictMode = options.strictMode ?? false;

    // Basic content validation
    if (!content || typeof content !== 'string') {
      errors.push(
        createValidationError(
          'security',
          'INVALID_CONTENT',
          'YAML content must be a non-empty string',
          { suggestion: 'Provide valid YAML content' }
        )
      );
      return createFailure(errors, warnings);
    }

    // Check file size
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > maxFileSize) {
      errors.push(
        createValidationError(
          'security',
          'FILE_TOO_LARGE',
          `YAML file exceeds maximum size of ${maxFileSize} bytes (current: ${contentSize} bytes)`,
          {
            suggestion: 'Split the file into smaller chunks or reduce content',
          }
        )
      );
    } else if (contentSize > this.SIZE_WARNING_THRESHOLD) {
      warnings.push(
        createValidationWarning(
          'performance',
          'LARGE_FILE_SIZE',
          `Large YAML file detected (${contentSize} bytes)`,
          {
            suggestion: 'Consider splitting into smaller files for better performance',
          }
        )
      );
    }

    // Check for suspicious patterns
    for (const { pattern, description, severity } of this.SUSPICIOUS_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, match.index ?? 0);

        if (severity === 'error' || strictMode) {
          errors.push(
            createValidationError(
              'security',
              'SUSPICIOUS_CONTENT',
              `Potentially dangerous pattern detected: ${description}`,
              {
                line: lineNumber,
                suggestion: `Remove or escape the ${description.toLowerCase()}`,
              }
            )
          );
        } else {
          warnings.push(
            createValidationWarning(
              'best-practice',
              'SUSPICIOUS_CONTENT_WARNING',
              `Potentially suspicious pattern detected: ${description}`,
              {
                suggestion: `Review the ${description.toLowerCase()} for security implications`,
              }
            )
          );
        }
      }
    }

    // Check for dangerous keys (basic string search)
    for (const dangerousKey of this.DANGEROUS_KEYS) {
      const keyPattern = new RegExp(`\\b${dangerousKey}\\b`, 'gi');
      const matches = Array.from(content.matchAll(keyPattern));

      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, match.index ?? 0);

        errors.push(
          createValidationError(
            'security',
            'DANGEROUS_KEY',
            `Dangerous key detected: ${dangerousKey}`,
            {
              line: lineNumber,
              suggestion: `Remove or rename the key '${dangerousKey}'`,
            }
          )
        );
      }
    }

    // Estimate complexity (rough heuristic)
    const estimatedNodes = this.estimateNodeCount(content);
    if (estimatedNodes > maxNodes) {
      errors.push(
        createValidationError(
          'security',
          'TOO_MANY_NODES',
          `YAML appears to contain too many nodes (estimated: ${estimatedNodes}, max: ${maxNodes})`,
          {
            suggestion: 'Simplify the YAML structure or split into multiple files',
          }
        )
      );
    }

    // Estimate depth (rough heuristic)
    const estimatedDepth = this.estimateDepth(content);
    if (estimatedDepth > maxDepth) {
      errors.push(
        createValidationError(
          'security',
          'TOO_DEEP_NESTING',
          `YAML nesting is too deep (estimated: ${estimatedDepth}, max: ${maxDepth})`,
          {
            suggestion: 'Reduce nesting depth in the YAML structure',
          }
        )
      );
    }

    return errors.length > 0 ? createFailure(errors, warnings) : createSuccess(undefined, warnings);
  }

  /**
   * Validate parsed YAML object for dangerous properties
   * @param yamlObject The parsed YAML object to validate
   * @returns ValidationResult with object validation results
   */
  static validateYamlObject(yamlObject: unknown): ValidationResult<void> {
    const errors: ValidationErrorInfo[] = [];
    const warnings: ValidationWarning[] = [];

    if (!yamlObject || typeof yamlObject !== 'object') {
      return createSuccess(undefined, warnings);
    }

    // Check for dangerous keys in the object
    this.checkObjectForDangerousKeys(yamlObject, errors, warnings, '');

    return errors.length > 0 ? createFailure(errors, warnings) : createSuccess(undefined, warnings);
  }

  /**
   * Get line number for a given character index in content
   * @param content The content string
   * @param index The character index
   * @returns The line number (1-based)
   */
  private static getLineNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  /**
   * Estimate the number of nodes in YAML content (rough heuristic)
   * @param content The YAML content
   * @returns Estimated node count
   */
  private static estimateNodeCount(content: string): number {
    // Count lines with colons (key-value pairs) and dashes (array items)
    const keyValueLines = (content.match(/^\s*[\w\-"']+\s*:/gm) || []).length;
    const arrayItemLines = (content.match(/^\s*-\s/gm) || []).length;

    return keyValueLines + arrayItemLines;
  }

  /**
   * Estimate the maximum nesting depth in YAML content (rough heuristic)
   * @param content The YAML content
   * @returns Estimated maximum depth
   */
  private static estimateDepth(content: string): number {
    const lines = content.split('\n');
    let maxDepth = 0;

    for (const line of lines) {
      const trimmedLine = line.trimStart();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const indentLevel = (line.length - trimmedLine.length) / 2; // Assuming 2-space indentation
        maxDepth = Math.max(maxDepth, Math.floor(indentLevel));
      }
    }

    return maxDepth;
  }

  /**
   * Recursively check object for dangerous keys
   * @param obj The object to check
   * @param errors Array to collect errors
   * @param warnings Array to collect warnings
   * @param path Current object path for error reporting
   */
  private static checkObjectForDangerousKeys(
    obj: unknown,
    errors: ValidationErrorInfo[],
    warnings: ValidationWarning[],
    path: string
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkObjectForDangerousKeys(item, errors, warnings, `${path}[${index}]`);
      });
      return;
    }

    const objectKeys = Object.keys(obj as Record<string, unknown>);

    for (const key of objectKeys) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check if key itself is dangerous
      if (this.DANGEROUS_KEYS.includes(key)) {
        errors.push(
          createValidationError(
            'security',
            'DANGEROUS_OBJECT_KEY',
            `Dangerous object key detected: ${key}`,
            {
              path: currentPath,
              suggestion: `Remove or rename the key '${key}'`,
            }
          )
        );
      }

      // Recursively check nested objects
      const value = (obj as Record<string, unknown>)[key];
      this.checkObjectForDangerousKeys(value, errors, warnings, currentPath);
    }
  }

  /**
   * Get default security configuration
   * @returns Default SecurityConfig object
   */
  static getDefaultSecurityConfig() {
    return {
      enableShellSanitization: true,
      enableYamlValidation: true,
      allowedCommands: [
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
      ],
      maxFileSize: this.MAX_FILE_SIZE,
      timeoutMs: 30000, // 30 second timeout
    };
  }
}
