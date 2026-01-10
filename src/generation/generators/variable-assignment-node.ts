/**
 * Variable Assignment Node Generator
 *
 * Generates shell script code for variable assignment nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class VariableAssignmentNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'variable-assignment';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const rawVariable = this.getNodeData(node, 'variable', 'TEMP_VAR');
    const variable = this.sanitizeVariableName(String(rawVariable));
    const assignmentType = String(this.getNodeData(node, 'assignment_type', 'constant'));

    if (assignmentType === 'expression') {
      // Handle expression-based assignment
      const rawExpression = this.getNodeData(node, 'expression', '');
      let expression = this.processConfigValue(rawExpression, '');

      if (expression) {
        // Handle multiline expressions by converting to single line
        expression = expression.replace(/\n/g, ' ').trim();

        // Escape single quotes in the expression to prevent shell syntax errors
        expression = expression.replace(/'/g, "\\'");

        // Use command substitution to execute the expression and capture its output
        return `# Node: ${node.id}
${variable.toUpperCase()}=$(${expression})
set_var "${variable.toUpperCase()}" "\$${variable.toUpperCase()}" "${node.id}"`;
      } else {
        // Fallback to empty if no expression
        return `set_var "${variable.toUpperCase()}" "" "${node.id}"`;
      }
    } else {
      // Handle constant value assignment with template variable support
      const rawValue = this.getNodeData(node, 'value', '');
      const rawValueStr = String(rawValue);

      // Check if the constant value contains template variables
      if (rawValueStr.includes('${')) {
        // Process template variables in the constant value
        const processedValue = this.processConfigValue(rawValue, '');
        return `set_var "${variable.toUpperCase()}" "${processedValue}" "${node.id}"`;
      } else {
        // Regular constant value without template variables
        const value = this.escapeShellValue(rawValueStr);
        return `set_var "${variable.toUpperCase()}" "${value}" "${node.id}"`;
      }
    }
  }

  /**
   * Process configuration values with template variable substitution
   * Enhanced version with optimized regex patterns and edge case handling
   */
  private processConfigValue(value: any, defaultValue: any): string {
    if (!value) return defaultValue.toString();

    const stringValue = value.toString();

    // Optimize: Early return if no template variables detected
    if (!this.hasTemplateVariables(stringValue)) {
      return stringValue;
    }

    // Enhanced arithmetic context detection with better regex performance
    const hasArithmeticContext = this.detectArithmeticContext(stringValue);

    // Optimized template variable replacement with improved regex
    let result = this.replaceTemplateVariables(stringValue, hasArithmeticContext);

    // Enhanced quote handling for complex cases
    result = this.normalizeQuotedExpressions(result);

    return result;
  }

  /**
   * Efficiently detect if string contains template variables
   * Optimized for performance with early detection
   */
  private hasTemplateVariables(input: string): boolean {
    // Optimized: Use indexOf for faster initial check before regex
    if (input.indexOf('${') === -1) {
      return false;
    }

    // Enhanced: Check for valid template variable patterns
    return /\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(input);
  }

  /**
   * Detect arithmetic context with optimized regex patterns
   * Handles edge cases like nested arithmetic and complex expressions
   */
  private detectArithmeticContext(input: string): boolean {
    // Enhanced regex to handle multiple arithmetic patterns and nested contexts
    return /\$\(\((?:[^()$]|\$\{[^}]+\}|\([^)]*\))*\$\{[^}]+\}(?:[^()$]|\$\{[^}]+\}|\([^)]*\))*\)\)/.test(
      input
    );
  }

  /**
   * Replace template variables with optimized pattern matching
   * Handles complex variable names and edge cases
   */
  private replaceTemplateVariables(input: string, hasArithmeticContext: boolean): string {
    // Enhanced regex pattern with better performance and edge case handling
    // Matches: ${valid_var_name} but not ${}, ${123invalid}, or malformed patterns
    return input.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match: string, varName: string) => {
      // Validate variable name before processing
      if (!this.isValidVariableName(varName)) {
        // Keep original if variable name is invalid
        return _match;
      }

      const sanitizedVar = this.sanitizeVariableName(varName).toUpperCase();

      if (hasArithmeticContext) {
        // For arithmetic expressions, use numeric default
        return `$(get_workflow_var "${sanitizedVar}" "0")`;
      } else {
        // For string expressions, use string default
        return `$(get_workflow_var "${sanitizedVar}" "default")`;
      }
    });
  }

  /**
   * Validate variable name according to shell variable naming rules
   */
  private isValidVariableName(name: string): boolean {
    // Enhanced validation: Must start with letter or underscore, followed by alphanumeric or underscore
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length > 0 && name.length <= 255;
  }

  /**
   * Normalize quoted expressions with enhanced handling
   * Fixes complex quoting issues and nested expressions
   */
  private normalizeQuotedExpressions(input: string): string {
    // Handle echo commands with single quotes containing template variables
    if (this.isSingleQuotedEcho(input) && input.includes('$(get_workflow_var')) {
      return this.convertToDoubleQuotedEcho(input);
    }

    // Handle other complex quoting scenarios
    return this.fixNestedQuoteIssues(input);
  }

  /**
   * Check if input is a single-quoted echo command
   */
  private isSingleQuotedEcho(input: string): boolean {
    return input.startsWith("echo '") && input.endsWith("'") && input.length > 7; // Must have content between quotes
  }

  /**
   * Convert single-quoted echo to double-quoted with proper escaping
   */
  private convertToDoubleQuotedEcho(input: string): string {
    const innerContent = input.slice(6, -1); // Remove 'echo ' prefix and trailing quote
    const escapedContent = innerContent.replace(/"/g, '\\"'); // Escape inner double quotes
    return `echo "${escapedContent}"`;
  }

  /**
   * Fix nested quote issues in complex expressions
   */
  private fixNestedQuoteIssues(input: string): string {
    // Handle cases where template variables create quote nesting issues
    // This is a placeholder for more complex quote normalization logic
    // that could be added based on specific edge cases encountered
    return input;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // Variable assignment specific validation
    const variable = this.getNodeData(node, 'variable', '');
    if (!variable || String(variable).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_VARIABLE_NAME',
        message: 'Variable assignment node must specify a variable name',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variable = this.getNodeData(node, 'variable', '');
    if (variable && String(variable).trim() !== '') {
      return [this.sanitizeVariableName(String(variable)).toUpperCase()];
    }
    return [];
  }
}
