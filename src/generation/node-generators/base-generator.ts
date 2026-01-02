/**
 * Base Node Generator Interface
 *
 * Defines the common interface for all node type generators in flowsh workflows.
 */

import { WorkflowNode } from '../../dsl/types.js';

export interface NodeGenerator<T extends WorkflowNode = WorkflowNode> {
  generateShell(node: T, functionName: string): string;
  validateNode?(node: T): ValidationResult;
  getRequiredVariables?(node: T): string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationContext {
  variables: Map<string, any>;
  nodeIndex: Map<string, WorkflowNode>;
  options: GenerationOptions;
}

export interface GenerationOptions {
  includeMocks?: boolean;
  shell?: 'bash' | 'zsh';
  verbose?: boolean;
  defaultTimeout?: number;
  headerTemplate?: string;
}
