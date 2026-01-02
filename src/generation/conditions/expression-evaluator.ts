import { ConditionEvaluator, WorkflowContext, ValidationResult, ParsedCondition } from './types.js';
import {
  SecureExpressionEvaluator,
  ExpressionSecurityError,
} from './secure-expression-evaluator.js';

/**
 * SECURITY FIX: Replace vulnerable string-based evaluator with secure AST-based implementation
 * This class now delegates to the SecureExpressionEvaluator to prevent code injection
 */
export class MathJSSecureExpressionEvaluator implements ConditionEvaluator {
  private secureEvaluator = new SecureExpressionEvaluator();

  evaluateExpression(expression: string, context: WorkflowContext): boolean {
    try {
      return this.secureEvaluator.evaluateExpression(expression, context);
    } catch (error) {
      if (error instanceof ExpressionSecurityError) {
        throw error; // Re-throw security errors
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to evaluate condition "${expression}": ${message}`);
    }
  }

  parseCondition(condition: string): ParsedCondition {
    return this.secureEvaluator.parseCondition(condition);
  }

  validateConditionSyntax(condition: string): ValidationResult {
    return this.secureEvaluator.validateConditionSyntax(condition);
  }
}

// Export both the new secure evaluator and the old one for backward compatibility
export const FlowshConditionEvaluator = MathJSSecureExpressionEvaluator;

// Re-export the secure evaluator and security error for direct access
export { SecureExpressionEvaluator, ExpressionSecurityError };
