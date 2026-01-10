/**
 * Type definitions for the flowsh template system
 */

/**
 * Information about a discovered template
 */
export interface TemplateInfo {
  /** Full template name including suffixes (circuit-breaker-template) */
  name: string;

  /** Display name with suffixes removed (circuit-breaker) */
  displayName: string;

  /** Absolute path to the template file */
  filePath: string;

  /** Main category (basic/enhanced/advanced) */
  category: string;

  /** Subcategory if applicable (reliability, ai-workflows, etc.) */
  subcategory?: string;

  /** Description extracted from template metadata */
  description?: string;
}

/**
 * Result of template processing operations
 */
export interface ProcessResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Path to the created file if successful */
  filePath?: string;

  /** Error message if operation failed */
  error?: string;

  /** Additional validation errors */
  validationErrors?: string[];
}

/**
 * Hierarchical structure for template display
 */
export interface HierarchicalTemplates {
  /** Basic templates (individual node examples) */
  basic: TemplateInfo[];

  /** Enhanced templates (simpler, ready-to-use) */
  enhanced: TemplateInfo[];

  /** Advanced templates grouped by subcategory */
  advanced: {
    [subcategory: string]: TemplateInfo[];
  };
}

/**
 * Create a successful process result
 */
export function createSuccessResult(filePath: string): ProcessResult {
  return {
    success: true,
    filePath,
  };
}

/**
 * Create a failed process result
 */
export function createErrorResult(error: string, validationErrors?: string[]): ProcessResult {
  const result: ProcessResult = {
    success: false,
    error,
  };

  if (validationErrors) {
    result.validationErrors = validationErrors;
  }

  return result;
}
