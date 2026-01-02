/**
 * React Flow Generator for flowsh Workflows
 *
 * This module converts flowsh workflow definitions into React Flow compatible
 * JSON format with proper positioning, styling, and metadata.
 */

import {
  ReactFlowOutput,
  ReactFlowNode,
  ReactFlowEdge,
  ReactFlowGeneratorOptions,
  ValidationStatus,
  WorkflowMetadata,
  ReactFlowViewport,
} from './types.js';
import { createLayoutEngine, toReactFlowPositions, calculateOptimalViewport } from './layout.js';
import { WorkflowNode, WorkflowEdge as FlowshEdge, FlowshWorkflow } from '../dsl/types.js';
import { validateWorkflowGraph, hasCycles, findUnreachableNodes } from './validation.js';
import { getTheme, getNodeStyle, getEdgeStyle } from './themes.js';

// =============================================================================
// Default Configuration
// =============================================================================

const defaultOptions: ReactFlowGeneratorOptions = {
  layout: {
    algorithm: 'dagre',
    direction: 'TB',
    nodeSpacing: 100,
    rankSpacing: 150,
    marginX: 50,
    marginY: 50,
    defaultNodeWidth: 150,
    defaultNodeHeight: 50,
    edgeSpacing: 10,
    minLen: 1,
  },
  theme: 'default',
  validation: {
    enabled: true,
    strict: false,
    includeWarnings: true,
  },
  optimization: {
    calculateMetrics: true,
    findCriticalPath: false,
    detectCycles: true,
    findUnreachableNodes: true,
  },
  viewport: {
    center: true,
    fit: true,
    padding: 50,
    minZoom: 0.1,
    maxZoom: 2.0,
  },
};

// =============================================================================
// Main React Flow Generator Class
// =============================================================================

export class ReactFlowGenerator {
  private options: ReactFlowGeneratorOptions;

  constructor(options?: Partial<ReactFlowGeneratorOptions>) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Generate React Flow output from flowsh workflow
   */
  generateReactFlowOutput(workflow: FlowshWorkflow): ReactFlowOutput {
    // Extract graph from workflow
    const graph = workflow.spec?.graph || workflow.graph;
    if (!graph) {
      throw new Error('Workflow must contain a valid graph specification');
    }

    // Get theme configuration
    const theme = getTheme(this.options.theme);

    // Calculate layout positions
    const algorithm =
      this.options.layout.algorithm === 'elk' || this.options.layout.algorithm === 'custom'
        ? 'dagre'
        : this.options.layout.algorithm;

    const layoutEngine = createLayoutEngine(algorithm, this.options.layout);
    const layoutResult = layoutEngine.calculateLayout(graph.nodes, graph.edges);

    // Convert positions to React Flow format
    const positions = toReactFlowPositions(layoutResult.positions);

    // Generate React Flow nodes
    const nodes = this.generateNodes(graph.nodes, positions, theme);

    // Generate React Flow edges
    const edges = this.generateEdges(graph.edges, theme);

    // Calculate optimal viewport
    const viewport = this.calculateViewport(layoutResult.positions);

    // Extract workflow metadata
    const metadata = this.extractMetadata(workflow, graph.nodes, graph.edges);

    // Perform validation if enabled
    const validation = this.options.validation.enabled
      ? this.validateWorkflow(graph.nodes, graph.edges)
      : { isValid: true, errors: [], warnings: [], suggestions: [] };

    return {
      nodes,
      edges,
      viewport,
      metadata,
      layout: {
        algorithm: algorithm,
        direction: this.options.layout.direction,
        spacing: {
          nodeSpacing: this.options.layout.nodeSpacing,
          rankSpacing: this.options.layout.rankSpacing,
          marginX: this.options.layout.marginX,
          marginY: this.options.layout.marginY,
        },
      },
      validation,
    };
  }

  /**
   * Generate React Flow nodes from workflow nodes
   */
  private generateNodes(
    workflowNodes: WorkflowNode[],
    positions: Record<string, { x: number; y: number }>,
    theme: any
  ): ReactFlowNode[] {
    return workflowNodes.map(node => {
      const position = positions[node.id] || { x: 0, y: 0 };
      const nodeStyle = getNodeStyle(node.type, theme);

      // Create validation status
      const validationStatus: ValidationStatus = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      // Validate node structure
      if (!node.id || !node.type) {
        validationStatus.isValid = false;
        validationStatus.errors.push('Node missing required id or type');
      }

      const label = this.getNodeLabel(node);
      const title = node.data.title || node.data.desc || label;
      const description = node.data.description || node.data.desc || 'No description';

      return {
        id: node.id,
        type: this.getReactFlowNodeType(node.type),
        position,
        data: {
          label,
          nodeType: node.type,
          title,
          description,
          validationStatus,
          executionStatus: 'pending' as const,
          originalData: node.data,
        },
        style: nodeStyle,
        className: `flowsh-node flowsh-node-${node.type}`,
        sourcePosition: this.getNodeHandlePosition('source'),
        targetPosition: this.getNodeHandlePosition('target'),
      };
    });
  }

  /**
   * Generate React Flow edges from workflow edges
   */
  private generateEdges(workflowEdges: FlowshEdge[], theme: any): ReactFlowEdge[] {
    return workflowEdges.map((edge, index) => {
      const edgeType = this.getEdgeType(edge);
      const edgeStyle = getEdgeStyle(edgeType, theme);
      const isAnimated = this.shouldAnimateEdge(edge);
      const label = this.getEdgeLabel(edge);

      const reactFlowEdge: ReactFlowEdge = {
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        type: edgeType === 'conditional' ? 'smoothstep' : 'default',
        animated: isAnimated,
        style: edgeStyle,
        labelStyle: {
          fontSize: 12,
          fill: theme.colors?.text || '#666',
          fontWeight: '500',
        },
        labelBgStyle: {
          fill: theme.colors?.background || '#ffffff',
          fillOpacity: 0.8,
        },
        labelBgPadding: [4, 8] as [number, number],
        labelBgBorderRadius: 4,
        data: {
          condition: edge.condition || '',
          label: edge.label || '',
        },
      };

      // Add optional properties only if they exist
      if (edge.sourceHandle) {
        reactFlowEdge.sourceHandle = edge.sourceHandle;
      }
      if (edge.targetHandle) {
        reactFlowEdge.targetHandle = edge.targetHandle;
      }
      if (label) {
        reactFlowEdge.label = label;
      }

      return reactFlowEdge;
    });
  }

  /**
   * Get display label for a node
   */
  private getNodeLabel(node: WorkflowNode): string {
    return (
      node.data.title ||
      node.data.desc ||
      node.data.description ||
      `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node` ||
      node.id
    );
  }

  /**
   * Get React Flow node type for rendering
   */
  private getReactFlowNodeType(nodeType: string): string {
    // Map flowsh node types to React Flow types
    const typeMap: Record<string, string> = {
      start: 'input',
      end: 'output',
      'if-else': 'default',
      llm: 'default',
      agent: 'default',
      code: 'default',
      'variable-assignment': 'default',
      loop: 'default',
      iteration: 'default',
      answer: 'default',
    };

    return typeMap[nodeType] || 'default';
  }

  /**
   * Get handle positions for node connections
   */
  private getNodeHandlePosition(
    handleType: 'source' | 'target'
  ): 'top' | 'right' | 'bottom' | 'left' {
    // Default positions based on layout direction
    if (this.options.layout.direction === 'TB' || this.options.layout.direction === 'BT') {
      return handleType === 'source' ? 'bottom' : 'top';
    } else {
      return handleType === 'source' ? 'right' : 'left';
    }
  }

  /**
   * Determine edge type for styling
   */
  private getEdgeType(edge: FlowshEdge): string {
    if (edge.condition) {
      return 'conditional';
    }
    if (edge.label?.toLowerCase().includes('error')) {
      return 'error';
    }
    if (edge.label?.toLowerCase().includes('success')) {
      return 'success';
    }
    return 'default';
  }

  /**
   * Determine if edge should be animated
   */
  private shouldAnimateEdge(edge: FlowshEdge): boolean {
    // Animate conditional edges or edges with special labels
    return !!(edge.condition || edge.label?.toLowerCase().includes('active'));
  }

  /**
   * Get display label for edge
   */
  private getEdgeLabel(edge: FlowshEdge): string | undefined {
    if (edge.label) {
      return edge.label;
    }
    if (edge.condition) {
      return edge.condition;
    }
    return undefined;
  }

  /**
   * Calculate optimal viewport for the workflow
   */
  private calculateViewport(positions: Record<string, any>): ReactFlowViewport {
    const viewport = calculateOptimalViewport(
      positions,
      1200, // Default container width
      800, // Default container height
      this.options.viewport.padding
    );

    return {
      x: this.options.viewport.center ? viewport.x : 0,
      y: this.options.viewport.center ? viewport.y : 0,
      zoom: this.options.viewport.fit
        ? Math.max(
            this.options.viewport.minZoom,
            Math.min(viewport.zoom, this.options.viewport.maxZoom)
          )
        : 1.0,
    };
  }

  /**
   * Extract workflow metadata
   */
  private extractMetadata(
    workflow: FlowshWorkflow,
    nodes: WorkflowNode[],
    edges: FlowshEdge[]
  ): WorkflowMetadata {
    const metadata: WorkflowMetadata = {
      id: workflow.metadata?.id || `workflow-${Date.now()}`,
      name: workflow.metadata?.name || workflow.workflow?.name || 'Untitled Workflow',
      description:
        workflow.metadata?.description || workflow.workflow?.description || 'No description',
      version:
        workflow.metadata?.version || workflow.workflow?.version || workflow.version || '1.0.0',
      nodeCount: nodes.length,
      edgeCount: edges.length,
      complexity: this.calculateComplexity(nodes, edges),
      estimatedExecutionTime: this.estimateExecutionTime(nodes),
      criticalPath: [], // Will be calculated if optimization is enabled
    };

    // Add optional properties only if they exist
    if (workflow.metadata?.created_by) {
      metadata.created_by = workflow.metadata.created_by;
    }
    if (workflow.metadata?.updated_by) {
      metadata.updated_by = workflow.metadata.updated_by;
    }
    if (workflow.metadata?.labels) {
      metadata.labels = workflow.metadata.labels;
    }
    if (workflow.metadata?.annotations) {
      metadata.annotations = workflow.metadata.annotations;
    }

    return metadata;
  }

  /**
   * Advanced workflow validation using the validation module
   */
  private validateWorkflow(nodes: WorkflowNode[], edges: FlowshEdge[]) {
    // Create a WorkflowGraph structure
    const graph = { nodes, edges };

    // Use the advanced validation system
    const validationResult = validateWorkflowGraph(graph);

    // Check for invalid edges
    const nodeIds = new Set(nodes.map(n => n.id));
    const invalidEdges = edges.filter(
      edge => !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
    );

    if (invalidEdges.length > 0) {
      invalidEdges.forEach(edge => {
        const errorBase = {
          severity: 'error' as const,
          ...(edge.id && { edgeId: edge.id }),
        };

        if (!nodeIds.has(edge.source)) {
          validationResult.errors.push({
            code: 'INVALID_EDGE_SOURCE',
            message: `Edge references non-existent source node: ${edge.source}`,
            ...errorBase,
          });
        }
        if (!nodeIds.has(edge.target)) {
          validationResult.errors.push({
            code: 'INVALID_EDGE_TARGET',
            message: `Edge references non-existent target node: ${edge.target}`,
            ...errorBase,
          });
        }
      });
      validationResult.isValid = false;
    }

    // Check for cycles if enabled
    if (this.options.optimization.detectCycles && hasCycles(graph)) {
      validationResult.errors.push({
        code: 'GRAPH_HAS_CYCLES',
        message: 'Workflow contains cycles that may cause infinite loops',
        severity: 'error' as const,
      });
      validationResult.isValid = false;
    }

    // Check for unreachable nodes if enabled
    if (this.options.optimization.findUnreachableNodes) {
      const unreachableNodes = findUnreachableNodes(graph);
      if (unreachableNodes.length > 0) {
        validationResult.warnings.push({
          code: 'UNREACHABLE_NODES',
          message: `Found ${unreachableNodes.length} unreachable node(s): ${unreachableNodes.join(', ')}`,
          details: { nodes: unreachableNodes },
        });
      }
    }

    return validationResult;
  }

  /**
   * Calculate workflow complexity score
   */
  private calculateComplexity(nodes: WorkflowNode[], edges: FlowshEdge[]): number {
    let complexity = nodes.length * 2;

    // Add complexity based on node types
    nodes.forEach(node => {
      switch (node.type) {
        case 'if-else':
          complexity += 5;
          break;
        case 'loop':
        case 'iteration':
          complexity += 8;
          break;
        case 'llm':
        case 'agent':
          complexity += 3;
          break;
        default:
          complexity += 1;
      }
    });

    // Add edge complexity
    complexity += edges.length;

    return complexity;
  }

  /**
   * Estimate execution time in seconds
   */
  private estimateExecutionTime(nodes: WorkflowNode[]): number {
    let totalTime = 0;

    nodes.forEach(node => {
      switch (node.type) {
        case 'llm':
          totalTime += 10; // 10 seconds for LLM calls
          break;
        case 'agent':
          totalTime += 5; // 5 seconds for agent calls
          break;
        case 'code':
          totalTime += 2; // 2 seconds for code execution
          break;
        case 'if-else':
          totalTime += 0.1; // Minimal time for conditionals
          break;
        default:
          totalTime += 1;
      }
    });

    return totalTime;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate React Flow output from workflow with default options
 */
export function generateReactFlowOutput(
  workflow: FlowshWorkflow,
  options?: Partial<ReactFlowGeneratorOptions>
): ReactFlowOutput {
  const generator = new ReactFlowGenerator(options);
  return generator.generateReactFlowOutput(workflow);
}

/**
 * Generate React Flow output with specific theme
 */
export function generateReactFlowOutputWithTheme(
  workflow: FlowshWorkflow,
  themeName: 'default' | 'dark' | 'light' = 'default'
): ReactFlowOutput {
  return generateReactFlowOutput(workflow, { theme: themeName });
}
