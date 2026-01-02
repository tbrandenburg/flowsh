/**
 * Workflow Variable Manager for flowsh
 *
 * Provides comprehensive variable scoping and lifecycle management for workflow execution.
 * Supports hierarchical scoping, variable inheritance, and safe variable access patterns.
 */

/**
 * Represents a variable scope within a workflow execution context
 */
export interface VariableScope {
  /** Parent scope for variable resolution chain */
  readonly parent?: VariableScope | undefined;
  /** Variables stored in this scope */
  readonly variables: Map<string, any>;
  /** Node ID that owns this scope */
  readonly nodeId: string;
  /** Scope type for debugging and validation */
  readonly type: ScopeType;
  /** Creation timestamp */
  readonly createdAt: Date;
}

/**
 * Types of variable scopes in workflow execution
 */
export type ScopeType = 'global' | 'node' | 'conditional' | 'loop' | 'function';

/**
 * Workflow execution context that provides access to variables and environment
 */
export interface WorkflowExecutionContext {
  /** All variables available in the execution context */
  variables: Map<string, any>;
  /** Environment variables */
  environment: Map<string, string>;
  /** Node outputs for cross-node data access */
  nodeOutputs: Map<string, any>;
  /** Current execution state */
  executionState: ExecutionState;
  /** Current active scope */
  currentScope?: VariableScope | undefined;
}

/**
 * Execution state tracking for workflow processing
 */
export interface ExecutionState {
  /** Current node being processed */
  currentNodeId?: string;
  /** Execution path taken so far */
  executionPath: string[];
  /** Whether execution is completed */
  completed: boolean;
  /** Start time of execution */
  startTime: Date;
  /** Error if execution failed */
  error?: Error;
}

/**
 * Error thrown when a variable is not found in the scope chain
 */
export class VariableNotFoundError extends Error {
  public readonly variableName: string;
  public readonly nodeId: string;
  public readonly scopeChain: string[];

  constructor(variableName: string, nodeId: string, scopeChain: string[]) {
    super(
      `Variable '${variableName}' not found in scope chain for node ${nodeId}. Searched scopes: ${scopeChain.join(' -> ')}`
    );
    this.variableName = variableName;
    this.nodeId = nodeId;
    this.scopeChain = scopeChain;
    Object.setPrototypeOf(this, VariableNotFoundError.prototype);
  }
}

/**
 * Error thrown when there are issues with workflow execution
 */
export class WorkflowExecutionError extends Error {
  public nodeId?: string | undefined;
  public override cause?: Error | undefined;

  constructor(message: string, nodeId?: string, cause?: Error) {
    super(message);
    Object.defineProperty(this, 'name', {
      value: 'WorkflowExecutionError',
      enumerable: false,
      configurable: true,
    });
    Object.setPrototypeOf(this, WorkflowExecutionError.prototype);

    if (nodeId !== undefined) {
      this.nodeId = nodeId;
    }
    if (cause !== undefined) {
      this.cause = cause;
      this.stack = `${this.stack}\nCaused by: ${this.cause.stack}`;
    }
  }
}

/**
 * Options for variable assignment
 */
interface VariableOptions {
  /** Whether the variable should be immutable after creation */
  immutable?: boolean;
}

/**
 * Audit entry for variable operations
 */
interface VariableAuditEntry {
  timestamp: Date;
  action: string;
  nodeId: string;
  variableName: string;
  value: string;
}

/**
 * Scope information for debugging
 */
interface ScopeInfo {
  nodeId: string;
  type: ScopeType;
  variableCount: number;
  parentId?: string | undefined;
  createdAt: Date;
  variables: string[];
}

/**
 * Comprehensive variable manager for workflow execution with hierarchical scoping
 *
 * Features:
 * - Hierarchical variable scoping with inheritance
 * - Variable lifecycle management (creation, mutation, cleanup)
 * - Thread-safe variable access and modification
 * - Audit logging for variable changes
 * - Memory-efficient garbage collection
 * - Support for different scope types (global, node, conditional, loop)
 *
 * @example
 * ```typescript
 * const manager = new WorkflowVariableManager();
 * const globalScope = manager.createGlobalScope();
 * manager.setVariable('global', 'environment', 'production');
 *
 * const nodeScope = manager.createNodeScope('node1');
 * manager.setVariable('node1', 'local_var', 'value');
 *
 * const value = manager.getVariable('node1', 'environment'); // Gets from parent scope
 * ```
 */
export class WorkflowVariableManager {
  private scopes: Map<string, VariableScope> = new Map();
  private globalScope: VariableScope;
  private auditLog: VariableAuditEntry[] = [];
  private readonly maxAuditEntries: number = 1000;

  constructor() {
    this.globalScope = this.createGlobalScope();
  }

  /**
   * Create the global scope for workflow execution
   */
  private createGlobalScope(): VariableScope {
    const globalScope: VariableScope = {
      variables: new Map(),
      nodeId: 'global',
      type: 'global',
      createdAt: new Date(),
    };

    this.scopes.set('global', globalScope);
    return globalScope;
  }

  /**
   * Create a new node scope with optional parent scope
   *
   * @param nodeId - Unique identifier for the node
   * @param parentNodeId - Parent node ID for scope inheritance
   * @returns The created variable scope
   */
  createNodeScope(nodeId: string, parentNodeId?: string): VariableScope {
    const parent = parentNodeId ? this.scopes.get(parentNodeId) : this.globalScope;

    if (parentNodeId && !parent) {
      throw new WorkflowExecutionError(`Parent node scope not found: ${parentNodeId}`, nodeId);
    }

    const scope: VariableScope = {
      parent,
      variables: new Map(),
      nodeId,
      type: 'node',
      createdAt: new Date(),
    };

    this.scopes.set(nodeId, scope);
    this.logAuditEntry('scope_created', nodeId, 'scope', scope.type);

    return scope;
  }

  /**
   * Create a conditional scope for if-else branches
   */
  createConditionalScope(nodeId: string, branchName: string): VariableScope {
    const parent = this.scopes.get(nodeId);
    if (!parent) {
      throw new WorkflowExecutionError(
        `Parent node scope not found for conditional: ${nodeId}`,
        nodeId
      );
    }

    const conditionalScopeId = `${nodeId}_${branchName}`;
    const scope: VariableScope = {
      parent,
      variables: new Map(),
      nodeId: conditionalScopeId,
      type: 'conditional',
      createdAt: new Date(),
    };

    this.scopes.set(conditionalScopeId, scope);
    this.logAuditEntry('conditional_scope_created', conditionalScopeId, 'branch', branchName);

    return scope;
  }

  /**
   * Set a variable value in the specified scope
   */
  setVariable(nodeId: string, name: string, value: any, options: VariableOptions = {}): void {
    const scope = this.scopes.get(nodeId);
    if (!scope) {
      throw new WorkflowExecutionError(`Node scope not found: ${nodeId}`);
    }

    // Check if variable is immutable
    const existingValue = scope.variables.get(name);
    if (existingValue && this.isImmutable(scope, name)) {
      throw new WorkflowExecutionError(
        `Cannot modify immutable variable '${name}' in scope ${nodeId}`
      );
    }

    // Sanitize the value to prevent prototype pollution
    const sanitizedValue = this.sanitizeVariableValue(value);

    // Store variable with metadata
    const variableWithMetadata = {
      value: sanitizedValue,
      immutable: options.immutable || false,
      createdAt: new Date(),
      type: typeof sanitizedValue,
    };

    scope.variables.set(name, variableWithMetadata);

    this.logAuditEntry('variable_set', nodeId, name, sanitizedValue);
  }

  /**
   * Get a variable value from the scope chain
   */
  getVariable(nodeId: string, name: string): any {
    const scopeChain: string[] = [];
    let scope = this.scopes.get(nodeId);

    while (scope) {
      scopeChain.push(scope.nodeId);

      if (scope.variables.has(name)) {
        const variableData = scope.variables.get(name);
        const value = variableData?.value !== undefined ? variableData.value : variableData;

        this.logAuditEntry('variable_get', nodeId, name, value);
        return value;
      }

      scope = scope.parent;
    }

    throw new VariableNotFoundError(name, nodeId, scopeChain);
  }

  /**
   * Check if a variable exists in the scope chain
   */
  hasVariable(nodeId: string, name: string): boolean {
    try {
      this.getVariable(nodeId, name);
      return true;
    } catch (error) {
      if (error instanceof VariableNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get all variables available in a scope chain
   */
  getAllVariables(nodeId: string): Map<string, any> {
    const allVariables = new Map<string, any>();
    const visitedScopes = new Set<string>();
    let scope = this.scopes.get(nodeId);

    // Walk up the scope chain, child scopes override parent values
    const scopeChain: VariableScope[] = [];
    while (scope && !visitedScopes.has(scope.nodeId)) {
      scopeChain.push(scope);
      visitedScopes.add(scope.nodeId);
      scope = scope.parent;
    }

    // Apply variables from parent to child (reverse order)
    scopeChain.reverse().forEach(scope => {
      scope.variables.forEach((variableData, name) => {
        const value = variableData?.value !== undefined ? variableData.value : variableData;
        allVariables.set(name, value);
      });
    });

    return allVariables;
  }

  /**
   * Delete a variable from a specific scope (not scope chain)
   */
  deleteVariable(nodeId: string, name: string): boolean {
    const scope = this.scopes.get(nodeId);
    if (!scope) {
      return false;
    }

    // Check if variable is immutable
    if (this.isImmutable(scope, name)) {
      throw new WorkflowExecutionError(
        `Cannot delete immutable variable '${name}' in scope ${nodeId}`
      );
    }

    const deleted = scope.variables.delete(name);
    if (deleted) {
      this.logAuditEntry('variable_deleted', nodeId, name, undefined);
    }

    return deleted;
  }

  /**
   * Clean up scope and all its child scopes
   */
  cleanupScope(nodeId: string): number {
    let cleanedCount = 0;
    const scopesToDelete: string[] = [];

    // Find all child scopes
    for (const [scopeId, scope] of this.scopes) {
      if (scopeId === nodeId || this.isChildScope(scope, nodeId)) {
        scopesToDelete.push(scopeId);
      }
    }

    // Delete scopes
    scopesToDelete.forEach(scopeId => {
      if (this.scopes.delete(scopeId)) {
        cleanedCount++;
        this.logAuditEntry('scope_deleted', scopeId, 'scope', 'cleanup');
      }
    });

    return cleanedCount;
  }

  /**
   * Create a workflow execution context from current state
   */
  createExecutionContext(nodeId: string): WorkflowExecutionContext {
    const scope = this.scopes.get(nodeId);
    const allVariables = this.getAllVariables(nodeId);

    return {
      variables: allVariables,
      environment: new Map(
        Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]
      ),
      nodeOutputs: new Map(), // This would be populated by the execution engine
      executionState: {
        currentNodeId: nodeId,
        executionPath: [], // This would be maintained by the execution engine
        completed: false,
        startTime: new Date(),
      },
      currentScope: scope,
    };
  }

  /**
   * Get audit log for debugging and monitoring
   */
  getAuditLog(limit: number = 100): VariableAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get scope information for debugging
   */
  getScopeInfo(nodeId: string): ScopeInfo | undefined {
    const scope = this.scopes.get(nodeId);
    if (!scope) {
      return undefined;
    }

    return {
      nodeId: scope.nodeId,
      type: scope.type,
      variableCount: scope.variables.size,
      parentId: scope.parent?.nodeId,
      createdAt: scope.createdAt,
      variables: Array.from(scope.variables.keys()),
    };
  }

  /**
   * Check if a variable is marked as immutable
   */
  private isImmutable(scope: VariableScope, name: string): boolean {
    const variableData = scope.variables.get(name);
    return variableData?.immutable === true;
  }

  /**
   * Check if a scope is a child of the specified parent
   */
  private isChildScope(scope: VariableScope, parentNodeId: string): boolean {
    let current = scope.parent;
    while (current) {
      if (current.nodeId === parentNodeId) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Sanitize variable values to prevent prototype pollution
   */
  private sanitizeVariableValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(item => this.sanitizeVariableValue(item));
      } else {
        // Create clean object without prototype pollution risk
        const clean = Object.create(null);
        for (const [key, val] of Object.entries(value)) {
          if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            clean[key] = this.sanitizeVariableValue(val);
          }
        }
        return clean;
      }
    }

    return value;
  }

  /**
   * Log audit entry for variable operations
   */
  private logAuditEntry(action: string, nodeId: string, name: string, value: any): void {
    const entry: VariableAuditEntry = {
      timestamp: new Date(),
      action,
      nodeId,
      variableName: name,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    };

    this.auditLog.push(entry);

    // Keep audit log size manageable
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.splice(0, this.auditLog.length - this.maxAuditEntries);
    }
  }
}

/**
 * Factory function to create a workflow variable manager
 *
 * @returns New WorkflowVariableManager instance
 */
export function createWorkflowVariableManager(): WorkflowVariableManager {
  return new WorkflowVariableManager();
}
