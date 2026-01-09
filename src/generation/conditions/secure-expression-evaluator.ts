import {
  ConditionEvaluator,
  WorkflowContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ParsedCondition,
  ExpressionAST,
} from './types.js';
import * as fs from 'fs';
import jsep from 'jsep';

/**
 * Security error for expression evaluation violations
 */
export class ExpressionSecurityError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ExpressionSecurityError';
  }
}

/**
 * Safe evaluation context with security controls
 */
interface SafeEvaluationContext {
  variables: Record<string, unknown>;
  allowedFunctions: Set<string>;
  maxDepth: number;
  timeout: number;
}

/**
 * Secure AST-based expression evaluator that replaces the vulnerable string-based evaluator
 * Uses jsep for safe parsing and implements comprehensive security controls
 */
export class SecureExpressionEvaluator implements ConditionEvaluator {
  private currentWorkflowContext: WorkflowContext | undefined;

  private readonly allowedOperators = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    '&&',
    '||',
    '!',
    '===',
    '!==',
  ]);

  private readonly allowedFunctions = new Map<string, (...args: unknown[]) => unknown>([
    ['string', (val: unknown) => String(val)],
    ['number', (val: unknown) => Number(val)],
    [
      'length',
      (val: unknown) => {
        if (Array.isArray(val)) return val.length;
        if (typeof val === 'string') return val.length;
        return 0;
      },
    ],
    [
      'contains',
      (haystack: unknown, needle: unknown) => {
        const str = String(haystack);
        const search = String(needle);
        return str.includes(search);
      },
    ],
    [
      'matches',
      (text: unknown, pattern: unknown) => {
        const textStr = String(text);
        const patternStr = String(pattern);

        // Security: Limit regex complexity
        if (patternStr.length > 50) {
          throw new ExpressionSecurityError(
            'REGEX_TOO_COMPLEX',
            'Regular expression pattern too complex'
          );
        }

        try {
          return new RegExp(patternStr).test(textStr);
        } catch {
          throw new ExpressionSecurityError('INVALID_REGEX', 'Invalid regular expression pattern');
        }
      },
    ],
    ['lower', (val: unknown) => String(val).toLowerCase()],
    ['upper', (val: unknown) => String(val).toUpperCase()],
    ['trim', (val: unknown) => String(val).trim()],
    ['abs', (val: unknown) => Math.abs(Number(val))],
    ['min', (a: unknown, b: unknown) => Math.min(Number(a), Number(b))],
    ['max', (a: unknown, b: unknown) => Math.max(Number(a), Number(b))],
    // Add flowsh-specific functions for compatibility
    [
      'file_exists',
      (path: unknown) => {
        // Security: Only allow checking if files exist, no file system modification
        try {
          return fs.existsSync(String(path));
        } catch {
          return false;
        }
      },
    ],
    [
      'env_var',
      (name: unknown, defaultValue?: unknown) => {
        const envName = String(name);

        // First check the context environment (from workflow context)
        const contextEnv = this.currentWorkflowContext?.environment?.get(envName);
        if (contextEnv !== undefined) {
          return contextEnv;
        }

        // Then check process.env
        const processEnv = process.env[envName];
        if (processEnv !== undefined) {
          return processEnv;
        }

        // Return default value
        return String(defaultValue || '');
      },
    ],
    ['to_string', (val: unknown) => String(val || '')],
    ['to_number', (val: unknown) => Number(val) || 0],
    [
      'regex_match',
      (text: unknown, pattern: unknown) => {
        try {
          const patternStr = String(pattern);
          if (patternStr.length > 50) {
            return false; // Prevent ReDoS attacks
          }
          return new RegExp(patternStr).test(String(text || ''));
        } catch {
          return false;
        }
      },
    ],
    [
      'is_empty',
      (val: unknown) => {
        if (val == null) return true;
        if (typeof val === 'string' || Array.isArray(val)) return val.length === 0;
        if (typeof val === 'object') return Object.keys(val).length === 0;
        return false;
      },
    ],
  ]);

  evaluateExpression(expression: string, context: WorkflowContext): boolean {
    // Store context for use in functions
    this.currentWorkflowContext = context;

    // Input validation
    if (!expression || typeof expression !== 'string') {
      throw new ExpressionSecurityError(
        'INVALID_EXPRESSION',
        'Expression must be a non-empty string'
      );
    }

    if (expression.length > 500) {
      throw new ExpressionSecurityError(
        'EXPRESSION_TOO_LONG',
        'Expression exceeds maximum length of 500 characters'
      );
    }

    // Preprocess flowsh-style expressions to standard JavaScript
    const preprocessedExpression = this.preprocessFlowshExpression(expression);

    // Create safe evaluation context
    const safeContext: SafeEvaluationContext = {
      variables: this.createSecureVariableScope(context),
      allowedFunctions: new Set(this.allowedFunctions.keys()),
      maxDepth: 10,
      timeout: 1000, // 1 second timeout
    };

    try {
      const result = this.evaluateSecure(preprocessedExpression, safeContext);
      return Boolean(result);
    } catch (error) {
      if (error instanceof ExpressionSecurityError) {
        throw error; // Re-throw security errors
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to evaluate expression "${expression}": ${message}`);
    } finally {
      // Clean up context
      this.currentWorkflowContext = undefined;
    }
  }

  parseCondition(condition: string): ParsedCondition {
    try {
      // Extract flowsh variables from the original condition BEFORE preprocessing
      const flowshVariables = this.extractFlowshVariables(condition);

      // Now preprocess and parse
      const preprocessedCondition = this.preprocessFlowshExpression(condition);
      const ast = this.parseToAST(preprocessedCondition);
      const operators = this.extractOperatorsFromAST(ast);
      const functions = this.extractFunctionsFromAST(ast);

      return {
        original: condition,
        variables: flowshVariables, // Use the flowsh-style extracted variables
        operators,
        functions,
        ast: ast as ExpressionAST,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse condition: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  validateConditionSyntax(condition: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Basic input validation
      if (!condition || typeof condition !== 'string') {
        errors.push({
          code: 'EMPTY_CONDITION', // Match the expected error code
          message: 'Condition must be a non-empty string',
          path: 'root',
          line: 1,
          column: 0,
        });
        return { isValid: false, errors, warnings };
      }

      if (condition.length > 500) {
        errors.push({
          code: 'TOO_LONG',
          message: 'Condition exceeds maximum length of 500 characters',
          path: 'root',
          line: 1,
          column: 0,
        });
        return { isValid: false, errors, warnings };
      }

      // Check for flowsh-specific patterns before preprocessing
      if (condition.includes('eval(')) {
        warnings.push({
          code: 'POTENTIALLY_UNSAFE',
          message: 'Expression contains potentially unsafe pattern: eval()',
          path: 'root',
        });
      }

      // Check for unclosed braces
      const openBraces = (condition.match(/\${/g) || []).length;
      const closeBraces = (condition.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          code: 'UNCLOSED_VARIABLE_BRACE',
          message: 'Unclosed variable brace found',
          path: 'root',
          line: 1,
          column: 0,
        });
        return { isValid: false, errors, warnings };
      }

      // Preprocess flowsh syntax before parsing
      const preprocessedCondition = this.preprocessFlowshExpression(condition);

      // Parse to AST for syntax validation
      const ast = this.parseToAST(preprocessedCondition);

      // Validate AST for security (allow reasonable depth for complex expressions)
      const securityValidation = this.validateASTSecurity(ast, 10);
      if (!securityValidation.isValid) {
        errors.push(...securityValidation.errors);
      }

      // Check complexity
      const complexity = this.calculateComplexity(ast);
      if (complexity > 50) {
        warnings.push({
          code: 'HIGH_COMPLEXITY',
          message: `Expression complexity (${complexity}) is high and may impact performance`,
          path: 'root',
        });
      }

      // Check for complex property access (flowsh style) - check full variable names first
      const complexVarMatches = condition.matchAll(/\$\{([^}]+)\}/g);
      for (const match of complexVarMatches) {
        const fullVarName = match[1];
        if (fullVarName && fullVarName.split('.').length > 2) {
          warnings.push({
            code: 'COMPLEX_PROPERTY_ACCESS',
            message: `Complex property access detected: ${fullVarName}`,
            path: 'root',
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        code: 'SYNTAX_ERROR',
        message: `Syntax error: ${error instanceof Error ? error.message : String(error)}`,
        path: 'root',
        line: 1,
        column: 0,
      });

      return { isValid: false, errors, warnings };
    }
  }

  private extractFlowshVariables(condition: string): string[] {
    const variables: string[] = [];
    const matches = condition.matchAll(/\$\{([^}]+)\}/g);

    for (const match of matches) {
      const varName = match[1];
      if (varName) {
        const cleanVarName = varName.trim();

        // For property access like 'test_results.passed', add both the base and property
        if (cleanVarName.includes('.')) {
          const parts = cleanVarName.split('.');
          variables.push(...parts.map(p => p.trim()));
        }
        // For array access like 'test_results["passed"]', extract the base variable
        else if (cleanVarName.includes('[')) {
          const parts = cleanVarName.split('[');
          const baseVar = parts[0];
          if (baseVar) {
            variables.push(baseVar.trim());
            // Also extract quoted property names if any
            const quotedProps = cleanVarName.match(/\["([^"]+)"\]|\['([^']+)'\]/g);
            if (quotedProps) {
              for (const prop of quotedProps) {
                const propMatch = prop.match(/\["([^"]+)"\]|\['([^']+)'\]/);
                if (propMatch) {
                  const propName = propMatch[1] || propMatch[2];
                  if (propName) {
                    variables.push(propName);
                  }
                }
              }
            }
          }
        } else {
          variables.push(cleanVarName);
        }
      }
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  private preprocessFlowshExpression(expression: string): string {
    // Convert ${variable} syntax to standard JavaScript variable names
    // This handles property access safely by preserving the structure but validating security
    return expression.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const cleanVarName = String(varName).trim();

      // Basic security validation - prevent dangerous patterns
      if (
        cleanVarName.includes('__proto__') ||
        cleanVarName.includes('constructor') ||
        cleanVarName.includes('prototype') ||
        cleanVarName.includes('eval(') ||
        cleanVarName.includes('Function(')
      ) {
        throw new ExpressionSecurityError(
          'DANGEROUS_VARIABLE_ACCESS',
          `Dangerous pattern in variable access: ${cleanVarName}`
        );
      }

      // For property access, we need to validate the base variable name and allow safe property access
      const baseVarMatch = cleanVarName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (!baseVarMatch) {
        throw new ExpressionSecurityError(
          'INVALID_VARIABLE_NAME',
          `Invalid variable base name: ${cleanVarName}`
        );
      }

      return cleanVarName;
    });
  }

  private evaluateSecure(expression: string, context: SafeEvaluationContext): unknown {
    const startTime = Date.now();

    try {
      // Parse expression to AST
      const ast = this.parseToAST(expression);

      // Security validation
      this.validateASTSecurity(ast, context.maxDepth);

      // Evaluate with timeout check
      const result = this.evaluateAST(ast, context, startTime);

      return result;
    } catch (error) {
      if (error instanceof ExpressionSecurityError) {
        throw error;
      }
      throw new Error(
        `Expression evaluation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseToAST(expression: string): any {
    try {
      return jsep(expression);
    } catch (error) {
      throw new ExpressionSecurityError(
        'PARSE_ERROR',
        `Invalid expression syntax: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private validateASTSecurity(node: any, maxDepth: number, currentDepth = 0): ValidationResult {
    const errors: ValidationError[] = [];

    // Depth check
    if (currentDepth > maxDepth) {
      errors.push({
        code: 'TOO_DEEP',
        message: `Expression nesting exceeds maximum depth of ${maxDepth}`,
        path: 'root',
        line: 1,
        column: 0,
      });
      return { isValid: false, errors, warnings: [] };
    }

    switch (node.type) {
      case 'BinaryExpression':
      case 'LogicalExpression':
        if (!this.allowedOperators.has(node.operator)) {
          errors.push({
            code: 'FORBIDDEN_OPERATOR',
            message: `Operator '${node.operator}' is not allowed`,
            path: 'root',
            line: 1,
            column: 0,
          });
        }

        const leftResult = this.validateASTSecurity(node.left, maxDepth, currentDepth + 1);
        const rightResult = this.validateASTSecurity(node.right, maxDepth, currentDepth + 1);

        errors.push(...leftResult.errors, ...rightResult.errors);
        break;

      case 'UnaryExpression':
        if (!this.allowedOperators.has(node.operator)) {
          errors.push({
            code: 'FORBIDDEN_UNARY_OPERATOR',
            message: `Unary operator '${node.operator}' is not allowed`,
            path: 'root',
            line: 1,
            column: 0,
          });
        }

        const argResult = this.validateASTSecurity(node.argument, maxDepth, currentDepth + 1);
        errors.push(...argResult.errors);
        break;

      case 'CallExpression':
        if (!this.allowedFunctions.has(node.callee.name)) {
          errors.push({
            code: 'FORBIDDEN_FUNCTION',
            message: `Function '${node.callee.name}' is not allowed`,
            path: 'root',
            line: 1,
            column: 0,
          });
        }

        // Validate function arguments
        for (const arg of node.arguments) {
          const argResult = this.validateASTSecurity(arg, maxDepth, currentDepth + 1);
          errors.push(...argResult.errors);
        }
        break;

      case 'MemberExpression':
        // Allow safe member access but validate it carefully
        if (node.computed) {
          // For computed access like obj["prop"], validate the property name
          if (node.property.type === 'Literal') {
            const propValue = node.property.value;
            if (typeof propValue === 'string') {
              // Check for dangerous property names
              if (
                propValue.includes('__proto__') ||
                propValue.includes('constructor') ||
                propValue.includes('prototype')
              ) {
                errors.push({
                  code: 'DANGEROUS_PROPERTY_ACCESS',
                  message: `Dangerous property access: ${propValue}`,
                  path: 'root',
                  line: 1,
                  column: 0,
                });
              }
            }
          }
        } else {
          // For dot access like obj.prop
          if (node.property.type === 'Identifier') {
            const propName = node.property.name;
            if (
              propName.includes('__proto__') ||
              propName.includes('constructor') ||
              propName.includes('prototype')
            ) {
              errors.push({
                code: 'DANGEROUS_PROPERTY_ACCESS',
                message: `Dangerous property access: ${propName}`,
                path: 'root',
                line: 1,
                column: 0,
              });
            }
          }
        }

        // Recursively validate the object being accessed
        const objResult = this.validateASTSecurity(node.object, maxDepth, currentDepth + 1);
        errors.push(...objResult.errors);
        break;

      case 'Identifier':
      case 'Literal':
        // These are safe
        break;

      default:
        errors.push({
          code: 'FORBIDDEN_NODE_TYPE',
          message: `AST node type '${node.type}' is not allowed`,
          path: 'root',
          line: 1,
          column: 0,
        });
    }

    return { isValid: errors.length === 0, errors, warnings: [] };
  }

  private evaluateAST(node: any, context: SafeEvaluationContext, startTime: number): unknown {
    // Timeout check
    if (Date.now() - startTime > context.timeout) {
      throw new ExpressionSecurityError('EVALUATION_TIMEOUT', 'Expression evaluation timed out');
    }

    switch (node.type) {
      case 'Literal':
        return node.value;

      case 'Identifier':
        if (!(node.name in context.variables)) {
          throw new ExpressionSecurityError(
            'UNDEFINED_VARIABLE',
            `Variable '${node.name}' is not defined`
          );
        }
        return context.variables[node.name];

      case 'BinaryExpression':
      case 'LogicalExpression':
        const left = this.evaluateAST(node.left, context, startTime);
        const right = this.evaluateAST(node.right, context, startTime);
        return this.evaluateBinaryOperator(node.operator, left, right);

      case 'UnaryExpression':
        const argument = this.evaluateAST(node.argument, context, startTime);
        return this.evaluateUnaryOperator(node.operator, argument);

      case 'CallExpression':
        const func = this.allowedFunctions.get(node.callee.name);
        if (!func) {
          throw new ExpressionSecurityError(
            'FORBIDDEN_FUNCTION',
            `Function '${node.callee.name}' is not allowed`
          );
        }

        const args = node.arguments.map((arg: any) => this.evaluateAST(arg, context, startTime));
        return func(...args);

      case 'MemberExpression':
        const obj = this.evaluateAST(node.object, context, startTime);

        if (obj === null || obj === undefined) {
          throw new ExpressionSecurityError(
            'NULL_PROPERTY_ACCESS',
            'Cannot access property of null or undefined'
          );
        }

        let propName: string;
        if (node.computed) {
          // For obj["prop"] style access
          const prop = this.evaluateAST(node.property, context, startTime);
          propName = String(prop);
        } else {
          // For obj.prop style access
          propName = node.property.name;
        }

        // Security: Prevent access to dangerous properties
        if (
          propName.startsWith('__') ||
          propName.includes('prototype') ||
          propName === 'constructor'
        ) {
          throw new ExpressionSecurityError(
            'DANGEROUS_PROPERTY_ACCESS',
            `Access to property '${propName}' is not allowed`
          );
        }

        return (obj as any)[propName];

      default:
        throw new ExpressionSecurityError(
          'UNSUPPORTED_NODE',
          `Cannot evaluate AST node type '${node.type}'`
        );
    }
  }

  private evaluateBinaryOperator(operator: string, left: unknown, right: unknown): unknown {
    const l = left as any;
    const r = right as any;

    switch (operator) {
      case '+':
        return l + r;
      case '-':
        return l - r;
      case '*':
        return l * r;
      case '/':
        if (r === 0)
          throw new ExpressionSecurityError('DIVISION_BY_ZERO', 'Division by zero is not allowed');
        return l / r;
      case '%':
        return l % r;
      case '==':
        return l == r;
      case '!=':
        return l != r;
      case '===':
        return l === r;
      case '!==':
        return l !== r;
      case '<':
        return l < r;
      case '>':
        return l > r;
      case '<=':
        return l <= r;
      case '>=':
        return l >= r;
      case '&&':
        return l && r;
      case '||':
        return l || r;
      default:
        throw new ExpressionSecurityError(
          'UNKNOWN_OPERATOR',
          `Unknown binary operator: ${operator}`
        );
    }
  }

  private evaluateUnaryOperator(operator: string, operand: unknown): unknown {
    switch (operator) {
      case '!':
        return !operand;
      case '-':
        return -(operand as number);
      case '+':
        return +(operand as number);
      default:
        throw new ExpressionSecurityError(
          'UNKNOWN_OPERATOR',
          `Unknown unary operator: ${operator}`
        );
    }
  }

  private createSecureVariableScope(context: WorkflowContext): Record<string, unknown> {
    const secureScope: Record<string, unknown> = {};

    // Add only safe variables from context
    if (context.variables) {
      for (const [key, value] of context.variables.entries()) {
        // Sanitize key name to prevent injection
        if (this.isValidVariableName(key)) {
          secureScope[key] = this.sanitizeValue(value);
        }
      }
    }

    // Add safe environment variables (no file system access)
    if (context.environment) {
      for (const [key, value] of context.environment.entries()) {
        if (this.isValidVariableName(key)) {
          secureScope[`env_${key}`] = this.sanitizeValue(value);
        }
      }
    }

    return secureScope;
  }

  private isValidVariableName(name: string): boolean {
    // Allow only alphanumeric characters and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  private sanitizeValue(value: unknown): unknown {
    // Prevent function injection and ensure safe values
    if (typeof value === 'function') {
      return '[FUNCTION]'; // Replace functions with safe placeholder
    }

    if (value instanceof Error) {
      return value.message; // Extract just the message from errors
    }

    if (typeof value === 'object' && value !== null) {
      // Prevent prototype pollution
      return JSON.parse(JSON.stringify(value));
    }

    return value;
  }

  private extractOperatorsFromAST(node: any): string[] {
    const operators = new Set<string>();

    const traverse = (n: any) => {
      if (
        n.type === 'BinaryExpression' ||
        n.type === 'LogicalExpression' ||
        n.type === 'UnaryExpression'
      ) {
        operators.add(n.operator);
        if (n.left) traverse(n.left);
        if (n.right) traverse(n.right);
        if (n.argument) traverse(n.argument);
      } else if (n.type === 'CallExpression') {
        n.arguments.forEach(traverse);
      }
    };

    traverse(node);
    return Array.from(operators);
  }

  private extractFunctionsFromAST(node: any): string[] {
    const functions = new Set<string>();

    const traverse = (n: any) => {
      if (n.type === 'CallExpression') {
        functions.add(n.callee.name);
        n.arguments.forEach(traverse);
      } else if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression') {
        traverse(n.left);
        traverse(n.right);
      } else if (n.type === 'UnaryExpression') {
        traverse(n.argument);
      }
    };

    traverse(node);
    return Array.from(functions);
  }

  private calculateComplexity(node: any): number {
    let complexity = 1;

    const traverse = (n: any) => {
      switch (n.type) {
        case 'BinaryExpression':
        case 'LogicalExpression':
          complexity += 2;
          traverse(n.left);
          traverse(n.right);
          break;
        case 'UnaryExpression':
          complexity += 1;
          traverse(n.argument);
          break;
        case 'CallExpression':
          complexity += 3; // Functions are more complex
          n.arguments.forEach(traverse);
          break;
        case 'Identifier':
        case 'Literal':
          complexity += 1;
          break;
      }
    };

    traverse(node);
    return complexity;
  }
}

// Export the secure evaluator as the new default
export { SecureExpressionEvaluator as ExpressionEvaluator };

// Keep the old class for backward compatibility during migration
export class MathJSSecureExpressionEvaluator extends SecureExpressionEvaluator {
  // This is now just an alias to the secure implementation
}
