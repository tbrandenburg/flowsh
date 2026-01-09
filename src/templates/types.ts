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

  /** Main category (enhanced/advanced) */
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
 * Preview information for a template
 */
export interface TemplatePreview {
  /** Template identifier */
  templateId: string;

  /** Template category (enhanced/advanced) */
  category: string;

  /** Template subcategory if applicable */
  subcategory?: string;

  /** Template description */
  description: string;

  /** Raw template content */
  content: string;

  /** Template metadata */
  metadata: TemplateMetadata;

  /** Placeholder variables found in template */
  placeholders: string[];

  /** Required environment variables */
  requiredVariables: string[];
}

/**
 * Metadata about a template
 */
export interface TemplateMetadata {
  /** Complexity level based on node count and types */
  complexity: 'low' | 'medium' | 'high';

  /** Number of workflow nodes */
  nodeCount: number;

  /** Number of workflow edges */
  edgeCount: number;

  /** Types of nodes used in the workflow */
  nodeTypes: string[];

  /** Estimated lines in generated shell script */
  estimatedScriptLines: number;

  /** Required environment variables extracted from template */
  requiredEnvironmentVars: string[];
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
