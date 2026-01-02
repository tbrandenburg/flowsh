/**
 * Expression Evaluator for flowsh Workflow Conditions
 *
 * Provides secure, robust evaluation of boolean expressions in workflow conditions.
 * Supports variables, built-in functions, and complex boolean logic.
 */

import { Parser as ExprParser } from 'expr-eval';
import {
  ConditionEvaluator,
  ParsedCondition,
  ExpressionAST,
  WorkflowContext,
  ValidationResult,
  BuiltInFunctions,
  ValidationError,
  ValidationWarning,
} from './types.js';
import { existsSync } from 'fs';

/**
 * FlowshConditionEvaluator provides robust condition evaluation for workflow expressions.
 *
 * Features:
 * - Variable substitution with ${variable} syntax
 * - Built-in functions: file_exists, env_var, length, contains, is_empty, to_string, to_number
 * - JavaScript-style operators: ===, !==, &&, ||
 * - Property access: object.property notation
 * - Comprehensive syntax validation and security checks
 *
 * @example
 * ```typescript
 * const evaluator = new FlowshConditionEvaluator();
 * const context = { variables: new Map([['count', 5]]), environment: new Map(), functions: new Map() };
 * const result = evaluator.evaluateExpression('${count} > 3', context); // true
 * ```
 */
export class FlowshConditionEvaluator implements ConditionEvaluator {
  private parser: ExprParser;

  constructor() {
    this.parser = new ExprParser();

    // Override the built-in length function to handle null/undefined properly
    this.parser.unaryOps.length = (value: any): number => {
      if (value == null) return 0;
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length;
      }
      return 0;
    };
  }

  /**
   * Evaluate a condition expression with the given workflow context.
   *
   * Converts JavaScript-style syntax to expr-eval compatible format:
   * - ${variable} -> variable substitution
   * - === -> == (strict equality)
   * - && -> and, || -> or (logical operators)
   * - Handles null/undefined values safely
   *
   * @param expression - The condition expression to evaluate (e.g., "${count} > 0 && ${status} === 'ready'")
   * @param context - Workflow context containing variables, environment, and functions
   * @returns Boolean result of the expression evaluation
   * @throws Error if expression is invalid or evaluation fails
   *
   * @example
   * ```typescript
   * evaluator.evaluateExpression('${NODE_ENV} === "production"', context);
   * evaluator.evaluateExpression('length(${items}) > 0 && ${enabled}', context);
   * ```
   */
  evaluateExpression(expression: string, context: WorkflowContext): boolean {
    try {
      // Validate syntax first
      const validation = this.validateConditionSyntax(expression);
      if (!validation.isValid) {
        throw new Error(
          `Invalid condition syntax: ${validation.errors[0]?.message || 'Unknown error'}`
        );
      }

      // Prepare evaluation context
      const evalContext = this.prepareEvaluationContext(context);

      // Parse and evaluate using expr-eval
      const expr = this.parser.parse(this.preprocessExpression(expression));
      const result = Boolean(expr.evaluate(evalContext));

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to evaluate condition "${expression}": ${errorMessage}`);
    }
  }

  /**
   * Parse a condition expression and extract its components for analysis.
   *
   * @param condition - The condition expression to parse
   * @returns ParsedCondition object containing variables, operators, functions, and original expression
   * @throws Error if the expression cannot be parsed
   *
   * @example
   * ```typescript
   * const parsed = evaluator.parseCondition('${count} > 0 && length(${items}) === 3');
   * // Returns: { variables: ['count', 'items'], operators: ['>', '&&', '==='], functions: ['length'] }
   * ```
   */
  parseCondition(condition: string): ParsedCondition {
    try {
      // Extract variables and operators from original condition before preprocessing
      const originalVariables = new Set<string>();
      const originalOperators = new Set<string>();

      // Extract variables
      const originalVarPattern = /\$\{([^}]+)\}/g;
      let match;
      while ((match = originalVarPattern.exec(condition)) !== null) {
        if (match[1]) {
          // Handle property access like test_results.passed
          if (match[1].includes('.')) {
            const parts = match[1].split('.');
            parts.forEach(part => originalVariables.add(part.trim()));
          } else {
            originalVariables.add(match[1]);
          }
        }
      }

      // Extract original operators
      if (condition.includes('===')) originalOperators.add('===');
      if (condition.includes('!==')) originalOperators.add('!==');
      if (condition.includes('==') && !condition.includes('===')) originalOperators.add('==');
      if (condition.includes('!=') && !condition.includes('!==')) originalOperators.add('!=');
      if (condition.includes('&&')) originalOperators.add('&&');
      if (condition.includes('||')) originalOperators.add('||');
      if (condition.includes('>=')) originalOperators.add('>=');
      if (condition.includes('<=')) originalOperators.add('<=');
      if (condition.includes('>') && !condition.includes('>=')) originalOperators.add('>');
      if (condition.includes('<') && !condition.includes('<=')) originalOperators.add('<');
      if (condition.includes('!') && !condition.includes('!=') && !condition.includes('!=='))
        originalOperators.add('!');

      const expr = this.parser.parse(this.preprocessExpression(condition));

      // Extract variables, operators, and functions from parsed expression
      const variables = new Set<string>();
      const operators = new Set<string>();
      const functions = new Set<string>();

      this.extractElements(expr, variables, operators, functions);

      // Merge original variables and operators with extracted ones
      originalVariables.forEach(v => variables.add(v));
      originalOperators.forEach(o => operators.add(o));

      return {
        ast: this.convertToCustomAST(expr),
        variables: Array.from(variables),
        operators: Array.from(operators),
        functions: Array.from(functions),
        original: condition,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse condition "${condition}": ${errorMessage}`);
    }
  }

  /**
   * Validate condition syntax and provide comprehensive feedback.
   *
   * Checks for:
   * - Empty conditions
   * - Unmatched variable braces
   * - Syntax errors in expressions
   * - Potentially unsafe function calls
   * - Complex property access patterns
   *
   * @param condition - The condition expression to validate
   * @returns ValidationResult with isValid flag, errors array, and warnings array
   *
   * @example
   * ```typescript
   * const result = evaluator.validateConditionSyntax('${complex.nested.deep.property} > 0');
   * if (!result.isValid) {
   *   console.log('Errors:', result.errors);
   * }
   * console.log('Warnings:', result.warnings);
   * ```
   */
  validateConditionSyntax(condition: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Basic syntax validation
      if (!condition || condition.trim().length === 0) {
        errors.push({
          code: 'EMPTY_CONDITION',
          message: 'Condition cannot be empty',
          path: 'condition',
          suggestion: 'Provide a valid boolean expression',
        });
        return { isValid: false, errors, warnings };
      }

      // Check for unmatched braces in variable references
      const unclosedBraces = condition.match(/\${[^}]*$/g) || [];

      if (unclosedBraces.length > 0) {
        errors.push({
          code: 'UNCLOSED_VARIABLE_BRACE',
          message: 'Unclosed variable brace found',
          path: 'condition',
          suggestion: 'Add closing brace "}" for variable reference',
        });
      }

      // Try to parse with expr-eval
      try {
        const preprocessed = this.preprocessExpression(condition);
        this.parser.parse(preprocessed);
      } catch (parseError: unknown) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        errors.push({
          code: 'SYNTAX_ERROR',
          message: `Syntax error: ${errorMessage}`,
          path: 'condition',
          suggestion: 'Check expression syntax for missing operators or parentheses',
        });
      }

      // Check for potentially unsafe patterns
      if (condition.includes('eval(') || condition.includes('require(')) {
        warnings.push({
          code: 'POTENTIALLY_UNSAFE',
          message: 'Expression contains potentially unsafe function calls',
          path: 'condition',
          suggestion: 'Use built-in functions instead of eval() or require()',
        });
      }

      // Check for complex variable references
      const variablePattern = /\${([^}]+)}/g;
      let match;
      while ((match = variablePattern.exec(condition)) !== null) {
        const variableName = match[1];
        if (variableName && variableName.includes('.')) {
          // Check if it's a complex property access (more than 2 levels)
          const levels = variableName.split('.').length;
          if (levels > 2 || !this.isValidPropertyAccess(variableName)) {
            warnings.push({
              code: 'COMPLEX_PROPERTY_ACCESS',
              message: `Complex property access detected: ${variableName}`,
              path: 'condition',
              suggestion: 'Ensure property exists on the referenced object',
            });
          }
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${errorMessage}`,
        path: 'condition',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Preprocess the condition to handle flowsh-specific syntax
   */
  private preprocessExpression(expression: string): string {
    // Convert ${variable} syntax to variable
    let processed = expression.replace(/\$\{([^}]+)\}/g, '$1');

    // Convert JavaScript-style operators to expr-eval compatible ones
    processed = processed.replace(/===/g, '=='); // Convert === to ==
    processed = processed.replace(/!==/g, '!='); // Convert !== to !=
    processed = processed.replace(/&&/g, ' and '); // Convert && to and
    processed = processed.replace(/\|\|/g, ' or '); // Convert || to or
    processed = processed.replace(/!/g, ' not '); // Convert ! to not (be careful with !=)

    // Fix the not != issue (we don't want "not =" we want "!=")
    processed = processed.replace(/ not =/g, '!=');

    // Handle property access - convert bracket notation to dot notation for expr-eval
    // Convert obj["prop"] to obj.prop since expr-eval supports dot notation better
    processed = processed.replace(
      /([a-zA-Z_][a-zA-Z0-9_]*)\["([a-zA-Z_][a-zA-Z0-9_]*)"\]/g,
      '$1.$2'
    );

    return processed;
  }

  /**
   * Prepare evaluation context with variables and functions
   */
  private prepareEvaluationContext(context: WorkflowContext): Record<string, any> {
    const evalContext: Record<string, any> = {};

    // Add variables
    for (const [key, value] of context.variables) {
      evalContext[key] = value;
    }

    // Add environment variables
    for (const [key, value] of context.environment) {
      evalContext[`env_${key}`] = value;
    }

    // Add built-in functions with context access
    Object.assign(evalContext, this.createBuiltInFunctionsWithContext(context));

    // Add context functions if provided
    for (const [key, func] of context.functions) {
      evalContext[key] = func;
    }

    return evalContext;
  }

  /**
   * Create built-in functions with access to context
   */
  private createBuiltInFunctionsWithContext(context: WorkflowContext): BuiltInFunctions {
    return {
      file_exists: (path: string): boolean => {
        if (typeof path !== 'string') return false;
        return existsSync(path);
      },

      env_var: (name: string, defaultValue: string = ''): string => {
        if (typeof name !== 'string') return defaultValue;
        // First check context environment, then process.env
        return context.environment.get(name) || process.env[name] || defaultValue;
      },

      length: (value: any): number => {
        if (value == null) return 0;
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length;
        }
        if (typeof value === 'object') {
          return Object.keys(value).length;
        }
        return 0;
      },

      contains: (haystack: any, needle: any): boolean => {
        if (haystack == null) return false;
        if (typeof haystack === 'string') {
          return haystack.includes(String(needle));
        }
        if (Array.isArray(haystack)) {
          return haystack.includes(needle);
        }
        if (typeof haystack === 'object') {
          return Object.values(haystack).includes(needle);
        }
        return false;
      },

      is_empty: (value: any): boolean => {
        if (value == null) return true;
        if (typeof value === 'string') return value.length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
      },

      to_string: (value: any): string => {
        if (value == null) return '';
        return String(value);
      },

      to_number: (value: any): number => {
        if (value == null) return 0;
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      },

      regex_match: (text: string, pattern: string): boolean => {
        if (typeof text !== 'string' || typeof pattern !== 'string') return false;
        try {
          return new RegExp(pattern).test(text);
        } catch {
          return false;
        }
      },
    };
  }

  /**
   * Extract variables, operators, and functions from parsed expression
   */
  private extractElements(
    expr: any,
    variables: Set<string>,
    operators: Set<string>,
    functions: Set<string>
  ): void {
    if (!expr) return;

    // Handle expr-eval token-based structure
    if (expr.tokens && Array.isArray(expr.tokens)) {
      for (const token of expr.tokens) {
        this.extractFromToken(token, variables, operators, functions);
      }
    }
  }

  /**
   * Extract elements from a single token
   */
  private extractFromToken(
    token: any,
    variables: Set<string>,
    operators: Set<string>,
    functions: Set<string>
  ): void {
    if (!token) return;

    switch (token.type) {
      case 'IVAR':
        // Variable reference
        if (token.value && typeof token.value === 'string') {
          // Handle property access in variables (e.g., "test_results.passed" -> ["test_results", "passed"])
          const parts = token.value.split('.');
          for (const part of parts) {
            if (part) variables.add(part);
          }
        }
        break;

      case 'IOP1':
        // Unary operator or function
        if (token.value && typeof token.value === 'string') {
          functions.add(token.value);
        }
        break;

      case 'IOP2':
        // Binary operator
        if (token.value && typeof token.value === 'string') {
          operators.add(token.value);
        }
        break;

      case 'IEXPR':
        // Nested expression
        if (Array.isArray(token.value)) {
          for (const subToken of token.value) {
            this.extractFromToken(subToken, variables, operators, functions);
          }
        }
        break;

      // Ignore literal values, numbers, etc.
      default:
        break;
    }
  }

  /**
   * Convert expr-eval AST to our custom AST format
   */
  private convertToCustomAST(expr: any): ExpressionAST {
    if (!expr) {
      return { type: 'literal', value: null };
    }

    switch (expr.type) {
      case 'Literal':
        return { type: 'literal', value: expr.value };

      case 'Variable':
        return { type: 'variable', name: expr.name };

      case 'BinaryExpression':
        return {
          type: 'binary',
          operator: expr.operator,
          left: this.convertToCustomAST(expr.left),
          right: this.convertToCustomAST(expr.right),
        };

      case 'UnaryExpression':
        return {
          type: 'unary',
          operator: expr.operator,
          right: this.convertToCustomAST(expr.argument),
        };

      case 'CallExpression':
        return {
          type: 'function',
          name: expr.callee?.name || 'unknown',
          args: expr.arguments?.map((arg: any) => this.convertToCustomAST(arg)) || [],
        };

      case 'MemberExpression':
        return {
          type: 'member',
          left: this.convertToCustomAST(expr.object),
          property: String(expr.property?.name || expr.property?.value || 'unknown'),
        };

      default:
        return { type: 'literal', value: expr.value || null };
    }
  }

  /**
   * Validate property access syntax
   */
  private isValidPropertyAccess(propertyPath: string): boolean {
    // Check for valid property access patterns
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    return validPattern.test(propertyPath);
  }
}

/**
 * Factory function to create a condition evaluator instance.
 *
 * @returns A new FlowshConditionEvaluator instance
 *
 * @example
 * ```typescript
 * const evaluator = createConditionEvaluator();
 * const result = evaluator.evaluateExpression('${count} > 0', context);
 * ```
 */
export function createConditionEvaluator(): ConditionEvaluator {
  return new FlowshConditionEvaluator();
}
