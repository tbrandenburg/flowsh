/**
 * Types for Condition Evaluation System
 *
 * Provides TypeScript interfaces for expression parsing, evaluation,
 * and validation in flowsh workflow conditions.
 */

export interface ConditionEvaluator {
  evaluateExpression(expression: string, context: WorkflowContext): boolean;
  parseCondition(condition: string): ParsedCondition;
  validateConditionSyntax(condition: string): ValidationResult;
}

export interface ParsedCondition {
  /** Abstract syntax tree of the parsed condition */
  ast: ExpressionAST;
  /** Variables referenced in the condition */
  variables: string[];
  /** Operators used in the condition */
  operators: string[];
  /** Functions called in the condition */
  functions: string[];
  /** Original condition string */
  original: string;
}

export interface ExpressionAST {
  type: 'binary' | 'unary' | 'literal' | 'variable' | 'function' | 'member';
  left?: ExpressionAST;
  right?: ExpressionAST;
  operator?: string;
  value?: any;
  name?: string;
  args?: ExpressionAST[];
  property?: string;
}

export interface WorkflowContext {
  /** Workflow variables available for condition evaluation */
  variables: Map<string, any>;
  /** Environment variables */
  environment: Map<string, string>;
  /** Built-in functions available in conditions */
  functions: Map<string, Function>;
  /** Current node ID being processed */
  currentNode?: string;
}

export interface ValidationResult {
  /** Whether the condition is valid */
  isValid: boolean;
  /** Validation errors found */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /** Error code for categorization */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Path to the error in the condition */
  path: string;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Suggested fix for the error */
  suggestion?: string;
}

export interface ValidationWarning {
  /** Warning code for categorization */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Path to the warning in the condition */
  path: string;
  /** Suggested improvement */
  suggestion?: string;
}

export interface EvaluationResult {
  /** Result of the condition evaluation */
  result: boolean;
  /** Variables used during evaluation */
  variables: Record<string, any>;
  /** Time taken to evaluate (in milliseconds) */
  evaluationTime: number;
  /** Debug information for troubleshooting */
  debugInfo?: {
    ast: ExpressionAST;
    steps: EvaluationStep[];
  };
}

export interface EvaluationStep {
  /** Step description */
  description: string;
  /** Intermediate result */
  result: any;
  /** Variables at this step */
  variables: Record<string, any>;
}

/**
 * Built-in functions available in condition expressions
 */
export interface BuiltInFunctions {
  /** Check if a file exists */
  file_exists: (path: string) => boolean;
  /** Get environment variable */
  env_var: (name: string, defaultValue?: string) => string;
  /** Get length of array or string */
  length: (value: any) => number;
  /** Check if string/array contains value */
  contains: (haystack: any, needle: any) => boolean;
  /** Convert value to string */
  to_string: (value: any) => string;
  /** Convert value to number */
  to_number: (value: any) => number;
  /** Check if value is empty */
  is_empty: (value: any) => boolean;
  /** Regular expression match */
  regex_match: (text: string, pattern: string) => boolean;
}
