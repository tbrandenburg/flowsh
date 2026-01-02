/**
 * Advanced Graph Validation for flowsh Workflows
 *
 * This module provides comprehensive graph analysis and validation,
 * including cycle detection, unreachable node analysis, and performance optimization.
 */

import {
  ValidationError,
  ValidationWarning,
  OptimizationSuggestion,
  WorkflowMetrics,
} from './types.js';
import { WorkflowGraph } from '../dsl/types.js';

// =============================================================================
// Validation Result Interface
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: OptimizationSuggestion[];
  metrics: WorkflowMetrics;
}

// =============================================================================
// Advanced Graph Validator Class
// =============================================================================

export class AdvancedGraphValidator {
  private graph: WorkflowGraph | null = null;

  /**
   * Main validation entry point
   */
  validateWorkflowGraph(graph: WorkflowGraph): ValidationResult {
    this.graph = graph;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: OptimizationSuggestion[] = [];

    // Structural validation
    const structuralIssues = this.validateGraphStructure();
    errors.push(...structuralIssues.errors);
    warnings.push(...structuralIssues.warnings);

    // Cycle detection
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      errors.push({
        code: 'GRAPH_HAS_CYCLES',
        message: `Graph contains ${cycles.length} cycle(s)`,
        details: { cycles },
        severity: 'error',
      });
    }

    // Unreachable node detection
    const unreachableNodes = this.findUnreachableNodes();
    if (unreachableNodes.length > 0) {
      warnings.push({
        code: 'UNREACHABLE_NODES',
        message: `Found ${unreachableNodes.length} unreachable node(s)`,
        details: { nodes: unreachableNodes },
      });
    }

    // Dead end detection (nodes with no outgoing edges except end nodes)
    const deadEnds = this.findDeadEndNodes();
    if (deadEnds.length > 0) {
      warnings.push({
        code: 'DEAD_END_NODES',
        message: `Found ${deadEnds.length} dead end node(s)`,
        details: { nodes: deadEnds },
      });
    }

    // Performance analysis
    const metrics = this.calculateWorkflowMetrics();
    if (metrics.complexity > 100) {
      suggestions.push({
        type: 'performance',
        message: 'Consider breaking down complex workflow into sub-workflows',
        impact: 'high',
        effort: 'medium',
      });
    }

    // Critical path analysis
    if (metrics.criticalPath.length > 20) {
      suggestions.push({
        type: 'optimization',
        message: 'Long critical path detected - consider parallelization',
        impact: 'medium',
        effort: 'high',
      });
    }

    // Branch validation
    const branchIssues = this.validateBranching();
    warnings.push(...branchIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      metrics: {
        ...metrics,
        unreachableNodes,
        cycles,
      },
    };
  }

  /**
   * Validate basic graph structure
   */
  private validateGraphStructure(): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.graph) {
      errors.push({
        code: 'INVALID_GRAPH',
        message: 'Graph is null or undefined',
        severity: 'error',
      });
      return { errors, warnings };
    }

    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    const duplicates = new Set<string>();

    this.graph.nodes.forEach(node => {
      if (!node.id) {
        errors.push({
          code: 'MISSING_NODE_ID',
          message: 'Node is missing required ID',
          severity: 'error',
          nodeId: 'unknown',
        });
        return;
      }

      if (nodeIds.has(node.id)) {
        duplicates.add(node.id);
      } else {
        nodeIds.add(node.id);
      }
    });

    if (duplicates.size > 0) {
      errors.push({
        code: 'DUPLICATE_NODE_IDS',
        message: `Duplicate node IDs found: ${Array.from(duplicates).join(', ')}`,
        severity: 'error',
        details: { duplicates: Array.from(duplicates) },
      });
    }

    // Check for invalid edge references
    this.graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge references non-existent source node: ${edge.source}`,
          severity: 'error',
          edgeId: edge.id || `edge-${index}`,
        });
      }

      if (!nodeIds.has(edge.target)) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge references non-existent target node: ${edge.target}`,
          severity: 'error',
          edgeId: edge.id || `edge-${index}`,
        });
      }
    });

    // Check for start and end nodes
    const startNodes = this.graph.nodes.filter(n => n.type === 'start');
    const endNodes = this.graph.nodes.filter(n => n.type === 'end');

    if (startNodes.length === 0) {
      warnings.push({
        code: 'NO_START_NODES',
        message: 'Workflow has no start nodes',
      });
    }

    if (endNodes.length === 0) {
      warnings.push({
        code: 'NO_END_NODES',
        message: 'Workflow has no end nodes',
      });
    }

    if (startNodes.length > 1) {
      warnings.push({
        code: 'MULTIPLE_START_NODES',
        message: `Workflow has ${startNodes.length} start nodes`,
        details: { nodes: startNodes.map(n => n.id) },
      });
    }

    return { errors, warnings };
  }

  /**
   * Detect cycles in the graph using DFS
   */
  private detectCycles(): string[][] {
    if (!this.graph) return [];

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = this.graph!.edges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        const targetId = edge.target;

        if (!visited.has(targetId)) {
          dfs(targetId, [...path, nodeId]);
        } else if (recursionStack.has(targetId)) {
          // Found a cycle
          const cycleStart = path.indexOf(targetId);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), nodeId, targetId]);
          } else {
            cycles.push([...path, nodeId, targetId]);
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    // Start DFS from all nodes (to catch disconnected cycles)
    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Find unreachable nodes from start nodes
   */
  private findUnreachableNodes(): string[] {
    if (!this.graph) return [];

    const startNodes = this.graph.nodes.filter(node => node.type === 'start');
    if (startNodes.length === 0) {
      // If no start nodes, consider all nodes as potentially unreachable
      return this.graph.nodes.map(node => node.id);
    }

    const reachable = new Set<string>();
    const queue = startNodes.map(node => node.id);

    // BFS to find all reachable nodes
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;

      reachable.add(nodeId);

      // Add all target nodes to queue
      const outgoingEdges = this.graph.edges.filter(edge => edge.source === nodeId);
      queue.push(...outgoingEdges.map(edge => edge.target));
    }

    return this.graph.nodes.map(node => node.id).filter(nodeId => !reachable.has(nodeId));
  }

  /**
   * Find dead end nodes (no outgoing edges, except end nodes)
   */
  private findDeadEndNodes(): string[] {
    if (!this.graph) return [];

    const deadEnds: string[] = [];

    for (const node of this.graph.nodes) {
      if (node.type === 'end') continue; // End nodes are expected to have no outgoing edges

      const outgoingEdges = this.graph.edges.filter(edge => edge.source === node.id);
      if (outgoingEdges.length === 0) {
        deadEnds.push(node.id);
      }
    }

    return deadEnds;
  }

  /**
   * Validate branching logic (if-else nodes should have proper conditions)
   */
  private validateBranching(): ValidationWarning[] {
    if (!this.graph) return [];

    const warnings: ValidationWarning[] = [];

    const ifElseNodes = this.graph.nodes.filter(node => node.type === 'if-else');

    for (const node of ifElseNodes) {
      const outgoingEdges = this.graph.edges.filter(edge => edge.source === node.id);

      if (outgoingEdges.length < 2) {
        warnings.push({
          code: 'INSUFFICIENT_BRANCHES',
          message: `If-else node "${node.id}" has fewer than 2 outgoing branches`,
          nodeId: node.id,
        });
      }

      // Check if edges have condition labels
      const edgesWithConditions = outgoingEdges.filter(edge => edge.condition || edge.label);
      if (edgesWithConditions.length === 0 && outgoingEdges.length > 1) {
        warnings.push({
          code: 'MISSING_CONDITIONS',
          message: `If-else node "${node.id}" has branches without condition labels`,
          nodeId: node.id,
        });
      }
    }

    return warnings;
  }

  /**
   * Calculate comprehensive workflow metrics
   */
  private calculateWorkflowMetrics(): WorkflowMetrics {
    if (!this.graph) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        complexity: 0,
        estimatedExecutionTime: 0,
        criticalPath: [],
        unreachableNodes: [],
        cycles: [],
        maxDepth: 0,
        branchingFactor: 0,
        parallelizationPotential: 0,
      };
    }

    const nodeCount = this.graph.nodes.length;
    const edgeCount = this.graph.edges.length;

    // Calculate complexity based on node types and connections
    const complexity = this.calculateComplexityScore();

    // Estimate execution time based on node types
    const estimatedExecutionTime = this.estimateExecutionTime();

    // Find critical path (longest path through the graph)
    const criticalPath = this.findCriticalPath();

    // Calculate graph topology metrics
    const maxDepth = this.calculateMaxDepth();
    const branchingFactor = this.calculateAverageBranchingFactor();
    const parallelizationPotential = this.calculateParallelizationPotential();

    return {
      nodeCount,
      edgeCount,
      complexity,
      estimatedExecutionTime,
      criticalPath,
      unreachableNodes: [], // Will be filled by caller
      cycles: [], // Will be filled by caller
      maxDepth,
      branchingFactor,
      parallelizationPotential,
    };
  }

  /**
   * Calculate complexity score based on node types and structure
   */
  private calculateComplexityScore(): number {
    if (!this.graph) return 0;

    let score = 0;

    // Base complexity from node count
    score += this.graph.nodes.length * 2;

    // Additional complexity for specific node types
    for (const node of this.graph.nodes) {
      switch (node.type) {
        case 'if-else':
          score += 5; // Branching adds complexity
          break;
        case 'loop':
        case 'iteration':
          score += 10; // Loops add significant complexity
          break;
        case 'llm':
        case 'agent':
          score += 3; // AI calls are moderately complex
          break;
        default:
          score += 1;
      }
    }

    // Edge complexity (connectivity)
    score += this.graph.edges.length;

    // Branching factor complexity
    const avgBranching = this.calculateAverageBranchingFactor();
    score += avgBranching * 2;

    return score;
  }

  /**
   * Estimate total execution time
   */
  private estimateExecutionTime(): number {
    if (!this.graph) return 0;

    let totalTime = 0;

    for (const node of this.graph.nodes) {
      switch (node.type) {
        case 'llm':
          totalTime += 15; // 15 seconds for LLM calls
          break;
        case 'agent':
          totalTime += 8; // 8 seconds for agent calls
          break;
        case 'code':
          totalTime += 3; // 3 seconds for code execution
          break;
        case 'if-else':
          totalTime += 0.1; // Minimal time for conditionals
          break;
        case 'variable-assignment':
          totalTime += 0.5; // Variable operations
          break;
        default:
          totalTime += 1;
      }
    }

    return totalTime;
  }

  /**
   * Find the critical path (longest execution path)
   */
  private findCriticalPath(): string[] {
    if (!this.graph) return [];

    const startNodes = this.graph.nodes.filter(node => node.type === 'start');
    if (startNodes.length === 0) return [];

    let longestPath: string[] = [];
    let maxLength = 0;

    // For each start node, find the longest path
    for (const startNode of startNodes) {
      const path = this.findLongestPathFromNode(startNode.id);
      if (path.length > maxLength) {
        maxLength = path.length;
        longestPath = path;
      }
    }

    return longestPath;
  }

  /**
   * Find longest path from a specific node using DFS
   */
  private findLongestPathFromNode(nodeId: string): string[] {
    if (!this.graph) return [];

    const visited = new Set<string>();
    let longestPath: string[] = [];

    const dfs = (currentId: string, path: string[]): void => {
      if (visited.has(currentId)) return; // Avoid cycles

      visited.add(currentId);
      const newPath = [...path, currentId];

      if (newPath.length > longestPath.length) {
        longestPath = [...newPath];
      }

      const outgoingEdges = this.graph!.edges.filter(edge => edge.source === currentId);

      for (const edge of outgoingEdges) {
        dfs(edge.target, newPath);
      }

      visited.delete(currentId); // Allow revisiting in different paths
    };

    dfs(nodeId, []);
    return longestPath;
  }

  /**
   * Calculate maximum depth of the graph
   */
  private calculateMaxDepth(): number {
    if (!this.graph) return 0;

    const startNodes = this.graph.nodes.filter(node => node.type === 'start');
    if (startNodes.length === 0) return 0;

    let maxDepth = 0;

    for (const startNode of startNodes) {
      const depth = this.calculateDepthFromNode(startNode.id);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Calculate depth from a specific node
   */
  private calculateDepthFromNode(nodeId: string): number {
    if (!this.graph) return 0;

    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (currentId: string, depth: number): void => {
      if (visited.has(currentId)) return;

      visited.add(currentId);
      maxDepth = Math.max(maxDepth, depth);

      const outgoingEdges = this.graph!.edges.filter(edge => edge.source === currentId);

      for (const edge of outgoingEdges) {
        dfs(edge.target, depth + 1);
      }
    };

    dfs(nodeId, 1);
    return maxDepth;
  }

  /**
   * Calculate average branching factor
   */
  private calculateAverageBranchingFactor(): number {
    if (!this.graph || this.graph.nodes.length === 0) return 0;

    let totalBranches = 0;
    let nodesWithBranches = 0;

    for (const node of this.graph.nodes) {
      const outgoingEdges = this.graph.edges.filter(edge => edge.source === node.id);
      if (outgoingEdges.length > 0) {
        totalBranches += outgoingEdges.length;
        nodesWithBranches++;
      }
    }

    return nodesWithBranches > 0 ? totalBranches / nodesWithBranches : 0;
  }

  /**
   * Calculate parallelization potential (0-1 score)
   */
  private calculateParallelizationPotential(): number {
    if (!this.graph) return 0;

    let parallelPaths = 0;
    let totalPaths = 0;

    // Count nodes that have multiple incoming edges (merge points)
    for (const node of this.graph.nodes) {
      const incomingEdges = this.graph.edges.filter(edge => edge.target === node.id);
      if (incomingEdges.length > 1) {
        parallelPaths += incomingEdges.length - 1; // -1 because sequential would be 1 path
      }
      totalPaths += Math.max(1, incomingEdges.length);
    }

    return totalPaths > 0 ? parallelPaths / totalPaths : 0;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Validate workflow graph with default validator
 */
export function validateWorkflowGraph(graph: WorkflowGraph): ValidationResult {
  const validator = new AdvancedGraphValidator();
  return validator.validateWorkflowGraph(graph);
}

/**
 * Quick cycle detection
 */
export function hasCycles(graph: WorkflowGraph): boolean {
  const validator = new AdvancedGraphValidator();
  const result = validator.validateWorkflowGraph(graph);
  return result.metrics.cycles.length > 0;
}

/**
 * Find unreachable nodes
 */
export function findUnreachableNodes(graph: WorkflowGraph): string[] {
  const validator = new AdvancedGraphValidator();
  const result = validator.validateWorkflowGraph(graph);
  return result.metrics.unreachableNodes;
}
