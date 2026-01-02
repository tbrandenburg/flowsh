import {
  ConditionEvaluator,
  WorkflowContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ParsedCondition,
  ExpressionAST,
} from './types.js';
import { existsSync } from 'fs';

/**
 * Secure expression evaluator that handles flowsh workflow conditions
 */
export class MathJSSecureExpressionEvaluator implements ConditionEvaluator {
  evaluateExpression(expression: string, context: WorkflowContext): boolean {
    // Validate syntax first - throw if invalid
    const validation = this.validateConditionSyntax(expression);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(e => e.message).join('; ');
      throw new Error(`Invalid expression syntax: ${errorMessages}`);
    }

    try {
      const scope = this.createScope(context);
      const processed = this.preprocessExpression(expression);
      const result = this.evaluate(processed, scope);
      return Boolean(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to evaluate condition "${expression}": ${message}`);
    }
  }

  parseCondition(condition: string): ParsedCondition {
    const variables = this.extractVariables(condition);
    const operators = this.extractOperators(condition);
    const functions = this.extractFunctions(condition);
    const ast = this.buildAST(condition);

    return {
      original: condition,
      variables,
      operators,
      functions,
      ast,
    };
  }

  validateConditionSyntax(condition: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!condition?.trim()) {
      errors.push({
        code: 'EMPTY_CONDITION',
        message: 'Condition cannot be empty',
        path: 'condition',
        suggestion: 'Provide a valid boolean expression',
      });
    }

    // Check for unclosed braces
    const openBraces = (condition.match(/\${/g) || []).length;
    const closeBraces = (condition.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        code: 'UNCLOSED_VARIABLE_BRACE',
        message: 'Unclosed variable brace found',
        path: 'condition',
        suggestion: 'Add closing brace "}" for variable reference',
      });
    }

    // Check for incomplete operators (operators at the end)
    const processed = this.preprocessExpression(condition);
    if (processed.match(/[=!<>]+\s*$/)) {
      errors.push({
        code: 'SYNTAX_ERROR',
        message: 'Incomplete comparison operator at end of expression',
        path: 'condition',
        suggestion: 'Complete the comparison with a value',
      });
    }

    // Check for double operators (like "> >", "= =", etc.)
    if (processed.match(/[=!<>]+\s+[=!<>]+/)) {
      errors.push({
        code: 'SYNTAX_ERROR',
        message: 'Invalid double operators found',
        path: 'condition',
        suggestion: 'Remove duplicate or spaced operators',
      });
    }

    // Check for invalid syntax patterns like spaces in variable names
    if (condition.match(/\$\{[^}]*\s+[^}]*\}/)) {
      errors.push({
        code: 'SYNTAX_ERROR',
        message: 'Invalid syntax in variable name',
        path: 'condition',
        suggestion: 'Variable names cannot contain spaces',
      });
    }

    // Check for dangerous patterns
    if (condition.includes('eval(')) {
      warnings.push({
        code: 'POTENTIALLY_UNSAFE',
        message: 'Expression contains potentially unsafe pattern: eval()',
        path: 'condition',
        suggestion: 'Avoid eval() function calls',
      });
    }

    // Check for complex property access
    const variables = this.extractVariables(condition);
    for (const variable of variables) {
      if (variable.split('.').length > 2) {
        warnings.push({
          code: 'COMPLEX_PROPERTY_ACCESS',
          message: `Complex property access detected: ${variable}`,
          path: 'condition',
          suggestion: 'Ensure property exists on the referenced object',
        });
      }
    }

    // Test evaluation safely - only if no syntax errors found
    if (errors.length === 0) {
      try {
        this.preprocessExpression(condition);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          code: 'SYNTAX_ERROR',
          message: `Syntax error: ${message}`,
          path: 'condition',
          suggestion: 'Check expression syntax',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private buildAST(condition: string): ExpressionAST {
    // Simple AST builder for basic conditions
    // This is a minimal implementation to satisfy the interface
    const processed = this.preprocessExpression(condition);

    if (processed.includes('&&')) {
      const parts = processed.split('&&');
      return {
        type: 'binary',
        operator: '&&',
        left: this.buildAST(parts[0]?.trim() || ''),
        right: this.buildAST(parts.slice(1).join('&&').trim()),
      };
    }

    if (processed.includes('||')) {
      const parts = processed.split('||');
      return {
        type: 'binary',
        operator: '||',
        left: this.buildAST(parts[0]?.trim() || ''),
        right: this.buildAST(parts.slice(1).join('||').trim()),
      };
    }

    // Check for comparison operators
    const comparisonOps = ['===', '!==', '>=', '<=', '>', '<', '==', '!='];
    for (const op of comparisonOps) {
      if (processed.includes(op)) {
        const parts = processed.split(op);
        if (parts.length === 2) {
          return {
            type: 'binary',
            operator: op,
            left: this.buildAST(parts[0]?.trim() || ''),
            right: this.buildAST(parts[1]?.trim() || ''),
          };
        }
      }
    }

    // Function call
    const funcMatch = processed.match(/^(\w+)\((.*)\)$/);
    if (funcMatch) {
      const [, name, args] = funcMatch;
      return {
        type: 'function',
        name: name || '',
        args: args ? [this.buildAST(args)] : [],
      };
    }

    // Variable or literal
    if (processed.match(/^\d+(\.\d+)?$/)) {
      return { type: 'literal', value: Number(processed) };
    }
    if (processed.match(/^".*"$/)) {
      return { type: 'literal', value: processed.slice(1, -1) };
    }
    if (processed === 'true' || processed === 'false') {
      return { type: 'literal', value: processed === 'true' };
    }

    return { type: 'variable', name: processed };
  }

  private preprocessExpression(expression: string): string {
    // Replace ${var} with var, handle property access
    return expression.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      if (varName.includes('[') && varName.includes(']')) {
        return varName.replace(/\["([^"]+)"\]/g, '.$1').replace(/\['([^']+)'\]/g, '.$1');
      }
      return varName;
    });
  }

  private createScope(context: WorkflowContext): Record<string, any> {
    const scope: Record<string, any> = {};

    // Add variables
    context.variables.forEach((value, key) => {
      scope[key] = value;
    });

    // Add environment variables
    context.environment.forEach((value, key) => {
      scope[key] = value;
    });

    // Add built-in functions
    scope['file_exists'] = (path: string) => existsSync(path);
    scope['env_var'] = (name: string, defaultValue?: string) => {
      // First check context environment, then process.env, then default
      const contextValue = context.environment.get(name);
      if (contextValue !== undefined) return contextValue;
      const processValue = process.env[name];
      if (processValue !== undefined) return processValue;
      return defaultValue || '';
    };
    scope['length'] = (value: any) => {
      if (value == null) return 0;
      if (typeof value === 'string' || Array.isArray(value)) return value.length;
      if (typeof value === 'object') return Object.keys(value).length;
      return 0;
    };
    scope['contains'] = (haystack: any, needle: any) => {
      if (haystack == null) return false;
      if (typeof haystack === 'string') return haystack.includes(String(needle));
      if (Array.isArray(haystack)) return haystack.includes(needle);
      return false;
    };
    scope['is_empty'] = (value: any) => {
      if (value == null) return true;
      if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    };
    scope['to_string'] = (value: any) => String(value || '');
    scope['to_number'] = (value: any) => Number(value) || 0;
    scope['regex_match'] = (str: any, pattern: string) => {
      try {
        return new RegExp(pattern).test(String(str || ''));
      } catch {
        return false;
      }
    };

    return scope;
  }

  private evaluate(expression: string, scope: Record<string, any>): any {
    // Handle boolean operations first (higher precedence)
    if (expression.includes('&&')) {
      const andIndex = expression.indexOf('&&');
      const left = expression.substring(0, andIndex).trim();
      const right = expression.substring(andIndex + 2).trim();
      const leftResult = this.evaluate(left, scope);
      const rightResult = this.evaluate(right, scope);
      const result = Boolean(leftResult) && Boolean(rightResult);
      return result;
    }

    if (expression.includes('||')) {
      const orIndex = expression.indexOf('||');
      const left = expression.substring(0, orIndex).trim();
      const right = expression.substring(orIndex + 2).trim();
      const leftResult = this.evaluate(left, scope);
      const rightResult = this.evaluate(right, scope);
      const result = Boolean(leftResult) || Boolean(rightResult);
      return result;
    }

    // Handle comparisons
    const comparisonRegexes = [
      { regex: /(.+?)\s*===\s*(.+)/, op: '===' },
      { regex: /(.+?)\s*!==\s*(.+)/, op: '!==' },
      { regex: /(.+?)\s*>=\s*(.+)/, op: '>=' },
      { regex: /(.+?)\s*<=\s*(.+)/, op: '<=' },
      { regex: /(.+?)\s*>\s*(.+)/, op: '>' },
      { regex: /(.+?)\s*<\s*(.+)/, op: '<' },
      { regex: /(.+?)\s*==\s*(.+)/, op: '==' },
      { regex: /(.+?)\s*!=\s*(.+)/, op: '!=' },
    ];

    for (const { regex, op } of comparisonRegexes) {
      const match = expression.match(regex);
      if (match) {
        const leftValue = match[1]?.trim();
        const rightValue = match[2]?.trim();
        if (leftValue && rightValue) {
          const left = this.evaluateExpr(leftValue, scope);
          const right = this.evaluateExpr(rightValue, scope);
          return this.compare(left, right, op);
        }
      }
    }

    // If no operators, evaluate as single expression
    return this.evaluateExpr(expression.trim(), scope);
  }

  private evaluateExpr(expr: string, scope: Record<string, any>): any {
    const trimmed = expr.trim();

    // String literal
    if (trimmed.match(/^".*"$/) || trimmed.match(/^'.*'$/)) {
      return trimmed.slice(1, -1);
    }

    // Number literal
    if (trimmed.match(/^\d+(\.\d+)?$/)) {
      return Number(trimmed);
    }

    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Function call
    const funcMatch = trimmed.match(/^(\w+)\((.*)\)$/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const argsStr = funcMatch[2];
      if (funcName) {
        const func = scope[funcName];
        if (typeof func === 'function') {
          const args = this.parseArgs(argsStr || '', scope);
          return func(...args);
        } else {
          throw new Error(`Unknown function: ${funcName}`);
        }
      }
    }

    // Property access
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      const firstPart = parts[0];
      if (firstPart) {
        let value = scope[firstPart];
        for (let i = 1; i < parts.length; i++) {
          if (value && typeof value === 'object') {
            const part = parts[i];
            if (part) {
              value = value[part];
            }
          } else {
            return undefined;
          }
        }
        return value;
      }
    }

    // Variable
    return scope[trimmed];
  }

  private parseArgs(argsStr: string, scope: Record<string, any>): any[] {
    if (!argsStr.trim()) return [];

    const args: any[] = [];
    const parts = argsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.match(/^".*"$/)) {
        args.push(part.slice(1, -1));
      } else if (part.match(/^'.*'$/)) {
        args.push(part.slice(1, -1));
      } else if (part.match(/^\d+(\.\d+)?$/)) {
        args.push(Number(part));
      } else {
        args.push(this.evaluateExpr(part, scope));
      }
    }

    return args;
  }

  private compare(left: any, right: any, op: string): boolean {
    switch (op) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '==':
        return left == right; // eslint-disable-line eqeqeq
      case '!=':
        return left != right; // eslint-disable-line eqeqeq
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      default:
        throw new Error(`Unknown operator: ${op}`);
    }
  }

  private extractVariables(condition: string): string[] {
    const variables: string[] = [];
    const matches = condition.matchAll(/\$\{([^}]+)\}/g);

    for (const match of matches) {
      const varName = match[1];
      if (varName) {
        // Handle property access - extract both main variable and properties
        if (varName.includes('.')) {
          // Add the full property path
          variables.push(varName);
          // Also add individual parts
          const parts = varName.split('.');
          variables.push(...parts);
        } else {
          variables.push(varName);
        }
      }
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  private extractOperators(condition: string): string[] {
    const operators: string[] = [];
    const operatorRegex = /(===|!==|==|!=|>=|<=|>|<|&&|\|\||!)/g;
    const matches = condition.matchAll(operatorRegex);

    for (const match of matches) {
      if (match[0]) {
        operators.push(match[0]);
      }
    }

    return operators;
  }

  private extractFunctions(condition: string): string[] {
    const functions: string[] = [];
    const functionRegex = /(\w+)\s*\(/g;
    const matches = condition.matchAll(functionRegex);

    for (const match of matches) {
      if (match[1]) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)]; // Remove duplicates
  }
}

// Export both the new secure evaluator and the old one for backward compatibility
export const FlowshConditionEvaluator = MathJSSecureExpressionEvaluator;
