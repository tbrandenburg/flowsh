/**
 * Node Generator Registry Types
 *
 * Defines interfaces for extensible node generation system
 */

import { ValidationResult } from '../../dsl/validation.js';
import { WorkflowNode } from '../../dsl/types.js';

/**
 * Context provided to node generators during compilation
 */
export interface GenerationContext {
  /** Generation options */
  options: GenerationOptions;
  /** Available variables in current scope */
  variables: Map<string, string>;
  /** Total number of nodes in workflow */
  nodeCount: number;
  /** Current node index being processed */
  currentNodeIndex: number;
  /** Workflow metadata */
  workflowName: string;
}

/**
 * Enhanced generation options with performance controls
 */
export interface GenerationOptions {
  /** Include mock implementations for testing */
  includeMocks?: boolean;
  /** Shell type to target */
  shell?: 'bash' | 'zsh';
  /** Include verbose debugging output */
  verbose?: boolean;
  /** Enable debug mode with enhanced tracing */
  debug?: boolean;
  /** Default timeout for agent calls */
  defaultTimeout?: number;
  /** Compilation timeout in milliseconds */
  compilationTimeout?: number;
  /** Maximum number of nodes allowed */
  maxNodes?: number;
  /** Maximum workflow file size in bytes */
  maxFileSize?: number;
}

/**
 * Interface for node generators that can produce shell script code
 */
export interface NodeGenerator {
  /** Unique identifier for the node type this generator handles */
  readonly nodeType: string;

  /**
   * Generate shell script code for the given node
   * @param node - The workflow node to generate code for
   * @param context - Generation context and options
   * @returns Generated shell script code for this node
   */
  generate(node: WorkflowNode, context: GenerationContext): string;

  /**
   * Optional validation specific to this node type
   * @param node - The workflow node to validate
   * @returns Validation result with any errors or warnings
   */
  validate?(node: WorkflowNode): ValidationResult;

  /**
   * Optional method to extract variables this node declares or uses
   * @param node - The workflow node to analyze
   * @returns Array of variable names used by this node
   */
  getVariables?(node: WorkflowNode): string[];
}

/**
 * Result of node generation process
 */
export interface NodeGenerationResult {
  /** Generated shell script code */
  code: string;
  /** Variables declared by this node */
  declaredVariables: string[];
  /** Variables referenced by this node */
  referencedVariables: string[];
  /** Any warnings during generation */
  warnings: string[];
}

/**
 * Registry error types
 */
export class NodeGeneratorError extends Error {
  constructor(
    message: string,
    public readonly nodeType: string,
    public readonly nodeId?: string
  ) {
    super(message);
    this.name = 'NodeGeneratorError';
  }
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}
