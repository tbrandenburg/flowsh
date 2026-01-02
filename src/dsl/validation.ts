/**
 * DSL Validation and Utility Functions
 *
 * Provides validation logic and utility functions for flowsh workflows.
 */

import {
  FlowshWorkflow,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowGraph,
  Variable,
  VariableType,
} from './types.js';

// =============================================================================
// Validation Error Types
// =============================================================================

export interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
  nodeId?: string;
  suggestions?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Validates a complete flowsh workflow
 */
export function validateWorkflow(workflow: FlowshWorkflow): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate basic structure
  if (!workflow.workflow?.name && !workflow.metadata?.name) {
    errors.push({
      type: 'error',
      code: 'MISSING_NAME',
      message: 'Workflow must have a name in either workflow.name or metadata.name',
      path: 'workflow.name | metadata.name',
    });
  }

  // Get the graph from either location
  const graph = workflow.graph ?? workflow.spec?.graph;
  if (!graph) {
    errors.push({
      type: 'error',
      code: 'MISSING_GRAPH',
      message: 'Workflow must have a graph definition',
      path: 'graph | spec.graph',
    });
    return { valid: false, errors, warnings };
  }

  // Validate graph structure
  const graphValidation = validateGraph(graph);
  errors.push(...graphValidation.errors);
  warnings.push(...graphValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates workflow graph structure
 */
export function validateGraph(graph: WorkflowGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!graph.nodes || graph.nodes.length === 0) {
    errors.push({
      type: 'error',
      code: 'EMPTY_GRAPH',
      message: 'Workflow graph must contain at least one node',
      path: 'graph.nodes',
    });
    return { valid: false, errors, warnings };
  }

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  const duplicateIds: string[] = [];

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      duplicateIds.push(node.id);
    } else {
      nodeIds.add(node.id);
    }
  }

  if (duplicateIds.length > 0) {
    errors.push({
      type: 'error',
      code: 'DUPLICATE_NODE_IDS',
      message: `Duplicate node IDs found: ${duplicateIds.join(', ')}`,
      path: 'graph.nodes[].id',
    });
  }

  // Validate individual nodes
  for (const node of graph.nodes) {
    const nodeValidation = validateNode(node);
    errors.push(...nodeValidation.errors.map(e => ({ ...e, nodeId: node.id })));
    warnings.push(...nodeValidation.warnings.map(w => ({ ...w, nodeId: node.id })));
  }

  // Validate edges
  if (graph.edges) {
    for (const edge of graph.edges) {
      const edgeValidation = validateEdge(edge, nodeIds);
      errors.push(...edgeValidation.errors);
      warnings.push(...edgeValidation.warnings);
    }
  }

  // Check for workflow connectivity
  const connectivityValidation = validateConnectivity(graph);
  errors.push(...connectivityValidation.errors);
  warnings.push(...connectivityValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates individual workflow nodes
 */
export function validateNode(node: WorkflowNode): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!node.id) {
    errors.push({
      type: 'error',
      code: 'MISSING_NODE_ID',
      message: 'Node must have an ID',
      path: 'id',
    });
  }

  if (!isValidNodeType(node.type)) {
    errors.push({
      type: 'error',
      code: 'INVALID_NODE_TYPE',
      message: `Invalid node type: ${node.type}`,
      path: 'type',
      suggestions: ['start', 'end', 'llm', 'if-else', 'code', 'agent', 'loop', 'iteration'],
    });
  }

  if (!node.data) {
    errors.push({
      type: 'error',
      code: 'MISSING_NODE_DATA',
      message: 'Node must have data configuration',
      path: 'data',
    });
  }

  // Type-specific validation
  switch (node.type) {
    case 'llm':
      if (!('model' in node.data) || !node.data.model) {
        errors.push({
          type: 'error',
          code: 'MISSING_LLM_MODEL',
          message: 'LLM node must have model configuration',
          path: 'data.model',
        });
      }
      break;

    case 'code':
      if (!('command' in node.data) || !node.data.command) {
        errors.push({
          type: 'error',
          code: 'MISSING_CODE_COMMAND',
          message: 'Code node must have a command',
          path: 'data.command',
        });
      }
      break;

    case 'agent':
      if (!('command' in node.data) || !node.data.command) {
        errors.push({
          type: 'error',
          code: 'MISSING_AGENT_COMMAND',
          message: 'Agent node must have a command',
          path: 'data.command',
        });
      }
      break;

    case 'if-else':
      if (
        !('conditions' in node.data) ||
        !node.data.conditions ||
        node.data.conditions.length === 0
      ) {
        errors.push({
          type: 'error',
          code: 'MISSING_IF_CONDITIONS',
          message: 'If-else node must have at least one condition',
          path: 'data.conditions',
        });
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates workflow edges
 */
export function validateEdge(edge: WorkflowEdge, nodeIds: Set<string>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!edge.source) {
    errors.push({
      type: 'error',
      code: 'MISSING_EDGE_SOURCE',
      message: 'Edge must have a source node ID',
      path: 'source',
    });
  } else if (!nodeIds.has(edge.source)) {
    errors.push({
      type: 'error',
      code: 'INVALID_EDGE_SOURCE',
      message: `Edge source node '${edge.source}' does not exist`,
      path: 'source',
    });
  }

  if (!edge.target) {
    errors.push({
      type: 'error',
      code: 'MISSING_EDGE_TARGET',
      message: 'Edge must have a target node ID',
      path: 'target',
    });
  } else if (!nodeIds.has(edge.target)) {
    errors.push({
      type: 'error',
      code: 'INVALID_EDGE_TARGET',
      message: `Edge target node '${edge.target}' does not exist`,
      path: 'target',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates workflow connectivity (reachability, cycles, etc.)
 */
export function validateConnectivity(graph: WorkflowGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Find start and end nodes
  const startNodes = graph.nodes.filter(node => node.type === 'start');
  const endNodes = graph.nodes.filter(node => node.type === 'end' || node.type === 'answer');

  if (startNodes.length === 0) {
    warnings.push({
      type: 'warning',
      code: 'NO_START_NODE',
      message: 'Workflow has no start node',
      suggestions: ['Add a start node to define workflow entry point'],
    });
  }

  if (startNodes.length > 1) {
    warnings.push({
      type: 'warning',
      code: 'MULTIPLE_START_NODES',
      message: 'Workflow has multiple start nodes',
      suggestions: ['Consider using a single start node for clarity'],
    });
  }

  if (endNodes.length === 0) {
    warnings.push({
      type: 'warning',
      code: 'NO_END_NODE',
      message: 'Workflow has no end or answer node',
      suggestions: ['Add an end or answer node to define workflow completion'],
    });
  }

  // Check for unreachable nodes
  if (startNodes.length > 0 && graph.edges) {
    const reachable = findReachableNodes(startNodes[0]!.id, graph.edges);
    const unreachableNodes = graph.nodes.filter(node => !reachable.has(node.id));

    if (unreachableNodes.length > 0) {
      warnings.push({
        type: 'warning',
        code: 'UNREACHABLE_NODES',
        message: `Unreachable nodes found: ${unreachableNodes.map(n => n.id).join(', ')}`,
        suggestions: ['Connect unreachable nodes to the main workflow or remove them'],
      });
    }
  }

  // Check for circular dependencies (simple cycle detection)
  if (graph.edges) {
    const cycles = detectCycles(
      graph.nodes.map(n => n.id),
      graph.edges
    );
    if (cycles.length > 0) {
      warnings.push({
        type: 'warning',
        code: 'CIRCULAR_DEPENDENCIES',
        message: `Potential cycles detected in workflow graph`,
        suggestions: ['Review workflow logic to ensure proper termination conditions'],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if a node type is valid
 */
export function isValidNodeType(type: string): type is NodeType {
  const validTypes: NodeType[] = [
    'start',
    'end',
    'llm',
    'if-else',
    'variable-assignment',
    'code',
    'agent',
    'loop',
    'iteration',
    'variable-aggregation',
    'template-transform',
    'answer',
  ];
  return validTypes.includes(type as NodeType);
}

/**
 * Checks if a variable type is valid
 */
export function isValidVariableType(type: string): type is VariableType {
  const validTypes: VariableType[] = [
    'text',
    'select',
    'number',
    'boolean',
    'object',
    'array',
    'text-input',
  ];
  return validTypes.includes(type as VariableType);
}

/**
 * Validates a variable definition
 */
export function validateVariable(variable: Variable): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!variable.variable) {
    errors.push({
      type: 'error',
      code: 'MISSING_VARIABLE_NAME',
      message: 'Variable must have a name',
      path: 'variable',
    });
  }

  if (!isValidVariableType(variable.type)) {
    errors.push({
      type: 'error',
      code: 'INVALID_VARIABLE_TYPE',
      message: `Invalid variable type: ${variable.type}`,
      path: 'type',
      suggestions: ['text', 'select', 'number', 'boolean', 'object', 'array', 'text-input'],
    });
  }

  // Type-specific validation
  switch (variable.type) {
    case 'select':
      if ('options' in variable && (!variable.options || variable.options.length === 0)) {
        errors.push({
          type: 'error',
          code: 'MISSING_SELECT_OPTIONS',
          message: 'Select variable must have options',
          path: 'options',
        });
      }
      break;

    case 'number':
      if (
        'min' in variable &&
        'max' in variable &&
        variable.min !== undefined &&
        variable.max !== undefined &&
        variable.min > variable.max
      ) {
        errors.push({
          type: 'error',
          code: 'INVALID_NUMBER_RANGE',
          message: 'Number variable min value cannot be greater than max value',
          path: 'min/max',
        });
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Finds all nodes reachable from a starting node
 */
function findReachableNodes(startNodeId: string, edges: WorkflowEdge[]): Set<string> {
  const reachable = new Set<string>();
  const toVisit = [startNodeId];

  while (toVisit.length > 0) {
    const currentId = toVisit.shift()!;
    if (reachable.has(currentId)) continue;

    reachable.add(currentId);

    // Find all nodes this node connects to
    const outgoingEdges = edges.filter(edge => edge.source === currentId);
    for (const edge of outgoingEdges) {
      if (!reachable.has(edge.target)) {
        toVisit.push(edge.target);
      }
    }
  }

  return reachable;
}

/**
 * Simple cycle detection using DFS
 */
function detectCycles(nodeIds: string[], edges: WorkflowEdge[]): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart));
      return;
    }

    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    // Visit all neighbors
    const outgoingEdges = edges.filter(edge => edge.source === nodeId);
    for (const edge of outgoingEdges) {
      dfs(edge.target, [...path]);
    }

    recursionStack.delete(nodeId);
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return cycles;
}

/**
 * Extracts variable references from a text template
 */
export function extractVariableReferences(text: string): string[] {
  const references: string[] = [];
  const regex = /\{\{#([^#]+)#\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      references.push(match[1]);
    }
  }

  return references;
}

/**
 * Validates that all variable references in templates exist
 */
export function validateVariableReferences(
  workflow: FlowshWorkflow,
  availableVariables: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const graph = workflow.graph ?? workflow.spec?.graph;
  if (!graph) return { valid: true, errors: [], warnings: [] };

  for (const node of graph.nodes) {
    // Check prompt templates for variable references
    if ('prompt_template' in node.data && node.data.prompt_template) {
      let templateText = '';

      if (typeof node.data.prompt_template === 'object') {
        if ('content' in node.data.prompt_template && node.data.prompt_template.content) {
          templateText = node.data.prompt_template.content;
        }
      } else if (Array.isArray(node.data.prompt_template)) {
        templateText = (node.data.prompt_template as Array<{ text: string }>)
          .map((msg: { text: string }) => msg.text)
          .join(' ');
      }

      const references = extractVariableReferences(templateText);
      for (const ref of references) {
        if (!availableVariables.has(ref)) {
          errors.push({
            type: 'error',
            code: 'UNDEFINED_VARIABLE_REFERENCE',
            message: `Variable reference '${ref}' is not defined`,
            path: `node[${node.id}].prompt_template`,
            nodeId: node.id,
          });
        }
      }
    }

    // Check other fields that might contain variable references
    if ('answer' in node.data && node.data.answer) {
      const references = extractVariableReferences(node.data.answer);
      for (const ref of references) {
        if (!availableVariables.has(ref)) {
          errors.push({
            type: 'error',
            code: 'UNDEFINED_VARIABLE_REFERENCE',
            message: `Variable reference '${ref}' is not defined`,
            path: `node[${node.id}].answer`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
