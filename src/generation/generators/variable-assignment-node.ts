/**
 * Variable Assignment Node Generator
 *
 * Generates shell script code for variable assignment nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';
import { ShellEscaping } from '../shell-scripting/escaping.js';

export class VariableAssignmentNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'variable-assignment';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const rawVariable = this.getNodeData(node, 'variable', 'TEMP_VAR');
    const variable = this.sanitizeVariableName(String(rawVariable));
    const assignmentType = String(this.getNodeData(node, 'assignment_type', 'constant'));

    // NEW: Enhanced variable handling options (opt-in)
    const onEmpty = this.getNodeData(node, 'on_empty', undefined);
    const defaultValue = this.getNodeData(node, 'default_value', undefined);
    const failOnEmpty = this.getNodeData(node, 'fail_on_empty', undefined);

    // Only use enhanced features if explicitly configured
    const useEnhancedFeatures =
      onEmpty !== undefined || defaultValue !== undefined || failOnEmpty !== undefined;

    if (assignmentType === 'expression') {
      if (useEnhancedFeatures) {
        return this.generateExpressionAssignment(
          node,
          variable,
          String(onEmpty || 'fail'),
          defaultValue,
          Boolean(failOnEmpty !== false)
        );
      } else {
        return this.generateLegacyExpressionAssignment(node, variable);
      }
    } else {
      if (useEnhancedFeatures) {
        return this.generateConstantAssignment(
          node,
          variable,
          String(onEmpty || 'fail'),
          defaultValue,
          Boolean(failOnEmpty !== false)
        );
      } else {
        return this.generateLegacyConstantAssignment(node, variable);
      }
    }
  }

  /**
   * Legacy expression assignment (backward compatibility)
   */
  private generateLegacyExpressionAssignment(node: WorkflowNode, variable: string): string {
    const rawExpression = this.getNodeData(node, 'expression', '');
    let expression = this.processConfigValue(rawExpression, '');

    if (expression) {
      // Handle multiline expressions by converting to single line
      expression = expression.replace(/\n/g, ' ').trim();

      // Use standardized expression escaping to prevent command injection
      expression = ShellEscaping.forExpressionContext(expression);

      // Use command substitution to execute the expression and capture its output
      return `# Node: ${node.id}
${variable.toUpperCase()}=$(${expression})
set_var "${variable.toUpperCase()}" "\$${variable.toUpperCase()}" "${node.id}"`;
    } else {
      // Fallback to empty if no expression
      return `set_var "${variable.toUpperCase()}" "" "${node.id}"`;
    }
  }

  /**
   * Legacy constant assignment (backward compatibility)
   */
  private generateLegacyConstantAssignment(node: WorkflowNode, variable: string): string {
    const rawValue = this.getNodeData(node, 'value', '');
    const rawValueStr = String(rawValue);

    // Check if the constant value contains template variables
    if (rawValueStr.includes('${')) {
      // Process template variables in the constant value
      const processedValue = this.processConfigValue(rawValue, '');
      return `set_var "${variable.toUpperCase()}" "${processedValue}" "${node.id}"`;
    } else {
      // Regular constant value without template variables
      const value = ShellEscaping.forShellVariable(rawValueStr);
      return `set_var "${variable.toUpperCase()}" ${value} "${node.id}"`;
    }
  }

  /**
   * Generate expression-based assignment with enhanced error handling
   */
  private generateExpressionAssignment(
    node: WorkflowNode,
    variable: string,
    onEmpty: string,
    defaultValue: any,
    failOnEmpty: boolean
  ): string {
    const rawExpression = this.getNodeData(node, 'expression', '');
    let expression = this.processConfigValue(rawExpression, '');

    if (expression) {
      expression = expression.replace(/\n/g, ' ').trim();
      expression = ShellEscaping.forExpressionContext(expression);

      const varUpper = variable.toUpperCase();
      let assignmentCode = `# Node: ${node.id}\n`;
      assignmentCode += `${varUpper}=$(${expression})\n`;

      // Add enhanced variable handling
      assignmentCode += this.generateVariableHandling(
        varUpper,
        onEmpty,
        defaultValue,
        failOnEmpty,
        node.id
      );

      return assignmentCode;
    } else {
      // Handle empty expression case
      return this.generateEmptyExpressionHandling(
        variable,
        onEmpty,
        defaultValue,
        failOnEmpty,
        node.id
      );
    }
  }

  /**
   * Generate constant value assignment with enhanced error handling
   */
  private generateConstantAssignment(
    node: WorkflowNode,
    variable: string,
    onEmpty: string,
    defaultValue: any,
    failOnEmpty: boolean
  ): string {
    const rawValue = this.getNodeData(node, 'value', '');
    const rawValueStr = String(rawValue);
    const varUpper = variable.toUpperCase();

    if (rawValueStr.includes('${')) {
      const processedValue = this.processConfigValue(rawValue, '');
      return `set_var "${varUpper}" "${processedValue}" "${node.id}"`;
    } else {
      const value = ShellEscaping.forShellVariable(rawValueStr);
      let assignmentCode = `set_var "${varUpper}" ${value} "${node.id}"\n`;

      // Add enhanced variable handling for constant assignments too
      if (rawValueStr === '' || rawValueStr === null || rawValueStr === undefined) {
        assignmentCode += this.generateVariableHandling(
          varUpper,
          onEmpty,
          defaultValue,
          failOnEmpty,
          node.id
        );
      }

      return assignmentCode;
    }
  }

  /**
   * Generate variable handling logic for empty/missing values
   */
  private generateVariableHandling(
    varUpper: string,
    onEmpty: string,
    defaultValue: any,
    failOnEmpty: boolean,
    nodeId: string
  ): string {
    let handlingCode = '';

    switch (onEmpty) {
      case 'use_default':
        if (defaultValue !== undefined && defaultValue !== null && String(defaultValue) !== '') {
          const escapedDefault = ShellEscaping.forShellVariable(String(defaultValue));
          handlingCode += `if [[ -z "\${${varUpper}:-}" ]]; then\n`;
          handlingCode += `    ${varUpper}=${escapedDefault}\n`;
          handlingCode += `    set_var "${varUpper}" "\$${varUpper}" "${nodeId}"\n`;
          handlingCode += `fi\n`;
        }
        break;

      case 'warn':
        handlingCode += `if [[ -z "\${${varUpper}:-}" ]]; then\n`;
        handlingCode += `    echo "Warning: Variable '${varUpper}' is empty in node '${nodeId}'" >&2\n`;
        if (defaultValue !== undefined && defaultValue !== null) {
          const escapedDefault = ShellEscaping.forShellVariable(String(defaultValue));
          handlingCode += `    ${varUpper}=${escapedDefault}\n`;
          handlingCode += `    set_var "${varUpper}" "\$${varUpper}" "${nodeId}"\n`;
        }
        handlingCode += `fi\n`;
        break;

      case 'fail':
      default:
        if (failOnEmpty) {
          handlingCode += `if [[ -z "\${${varUpper}:-}" ]]; then\n`;
          handlingCode += `    echo "Error: Required variable '${varUpper}' is empty in node '${nodeId}'" >&2\n`;
          handlingCode += `    exit 1\n`;
          handlingCode += `fi\n`;
        }
        break;
    }

    return handlingCode;
  }

  /**
   * Handle empty expression case
   */
  private generateEmptyExpressionHandling(
    variable: string,
    onEmpty: string,
    defaultValue: any,
    failOnEmpty: boolean,
    nodeId: string
  ): string {
    const varUpper = variable.toUpperCase();

    if (onEmpty === 'use_default' && defaultValue !== undefined) {
      const escapedDefault = ShellEscaping.forShellVariable(String(defaultValue));
      return `set_var "${varUpper}" ${escapedDefault} "${nodeId}"`;
    } else if (onEmpty === 'warn') {
      let code = `echo "Warning: Empty expression in variable assignment node '${nodeId}'" >&2\n`;
      if (defaultValue !== undefined) {
        const escapedDefault = ShellEscaping.forShellVariable(String(defaultValue));
        code += `set_var "${varUpper}" ${escapedDefault} "${nodeId}"`;
      } else {
        code += `set_var "${varUpper}" "" "${nodeId}"`;
      }
      return code;
    } else {
      if (failOnEmpty) {
        return `echo "Error: Empty expression in required variable assignment node '${nodeId}'" >&2\nexit 1`;
      } else {
        return `set_var "${varUpper}" "" "${nodeId}"`;
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
