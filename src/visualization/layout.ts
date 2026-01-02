/**
 * Layout Engine for React Flow Node Positioning
 *
 * This module provides automatic layout algorithms for positioning nodes
 * in React Flow compatible format, with primary support for Dagre layout.
 */

import { LayoutOptions, LayoutResult, CalculatedPosition, ReactFlowPosition } from './types.js';
import { calculateNodeDimensions, getTheme } from './themes.js';
import { WorkflowNode, WorkflowEdge } from '../dsl/types.js';
import dagre from 'dagre';

// =============================================================================
// Default Layout Configuration
// =============================================================================

export const defaultLayoutOptions: LayoutOptions = {
  algorithm: 'dagre',
  direction: 'TB', // Top to Bottom
  nodeSpacing: 100,
  rankSpacing: 150,
  marginX: 50,
  marginY: 50,
  defaultNodeWidth: 150,
  defaultNodeHeight: 50,
  nodeWidthByType: {
    start: 120,
    end: 120,
    'if-else': 160,
    llm: 180,
    agent: 160,
    code: 140,
    'variable-assignment': 180,
    loop: 160,
    iteration: 180,
    answer: 140,
  },
  nodeHeightByType: {
    start: 50,
    end: 50,
    'if-else': 60,
    llm: 60,
    agent: 60,
    code: 50,
    'variable-assignment': 50,
    loop: 60,
    iteration: 60,
    answer: 50,
  },
  edgeSpacing: 10,
  minLen: 1,
};

// =============================================================================
// Layout Engine Interface
// =============================================================================

export interface LayoutEngine {
  calculateLayout(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    options?: Partial<LayoutOptions>
  ): LayoutResult;
}

// =============================================================================
// Dagre Layout Engine
// =============================================================================

export class DagreLayoutEngine implements LayoutEngine {
  private options: LayoutOptions;

  constructor(options: Partial<LayoutOptions> = {}) {
    this.options = { ...defaultLayoutOptions, ...options };
  }

  calculateLayout(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    options?: Partial<LayoutOptions>
  ): LayoutResult {
    const startTime = performance.now();
    const layoutOptions = { ...this.options, ...options };

    // Create new dagre graph
    const graph = new dagre.graphlib.Graph();

    // Configure graph settings
    graph.setGraph({
      rankdir: layoutOptions.direction,
      nodesep: layoutOptions.nodeSpacing,
      ranksep: layoutOptions.rankSpacing,
      marginx: layoutOptions.marginX,
      marginy: layoutOptions.marginY,
    });

    // Set default edge label
    graph.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph with calculated dimensions
    nodes.forEach(node => {
      const dimensions = this.calculateNodeDimensions(node, layoutOptions);
      graph.setNode(node.id, {
        width: dimensions.width,
        height: dimensions.height,
      });
    });

    // Add edges to graph (filter out invalid edges)
    const nodeIds = new Set(nodes.map(node => node.id));
    edges.forEach(edge => {
      // Only add edge if both source and target nodes exist
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        graph.setEdge(edge.source, edge.target, {
          minlen: layoutOptions.minLen,
        });
      }
    });

    // Run the layout algorithm
    dagre.layout(graph);

    // Extract positions and calculate bounds
    const positions: Record<string, CalculatedPosition> = {};
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    graph.nodes().forEach((nodeId: string) => {
      const dagreNode = graph.node(nodeId);
      const position: CalculatedPosition = {
        x: dagreNode.x - dagreNode.width / 2,
        y: dagreNode.y - dagreNode.height / 2,
        width: dagreNode.width,
        height: dagreNode.height,
      };

      positions[nodeId] = position;

      // Update bounds
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + position.width);
      maxY = Math.max(maxY, position.y + position.height);
    });

    // Add padding to bounds
    const padding = layoutOptions.marginX;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const endTime = performance.now();

    return {
      positions,
      bounds: {
        width: maxX - minX,
        height: maxY - minY,
        minX,
        minY,
        maxX,
        maxY,
      },
      metadata: {
        algorithm: 'dagre',
        duration: endTime - startTime,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  }

  private calculateNodeDimensions(
    node: WorkflowNode,
    options: LayoutOptions
  ): { width: number; height: number } {
    // Get label for dimension calculation
    const label = node.data.title || node.data.desc || node.id;

    // Use theme-based calculation if available
    const theme = getTheme('default');
    const themeDimensions = calculateNodeDimensions(node.type, label, theme);

    // Override with layout-specific dimensions if provided
    const width =
      options.nodeWidthByType?.[node.type] || options.defaultNodeWidth || themeDimensions.width;

    const height =
      options.nodeHeightByType?.[node.type] || options.defaultNodeHeight || themeDimensions.height;

    return { width, height };
  }
}

// =============================================================================
// Custom Layout Engine for Simple Cases
// =============================================================================

export class SimpleLayoutEngine implements LayoutEngine {
  private options: LayoutOptions;

  constructor(options: Partial<LayoutOptions> = {}) {
    this.options = { ...defaultLayoutOptions, ...options };
  }

  calculateLayout(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    options?: Partial<LayoutOptions>
  ): LayoutResult {
    const startTime = performance.now();
    const layoutOptions = { ...this.options, ...options };

    const positions: Record<string, CalculatedPosition> = {};

    // Simple vertical layout
    let currentY = layoutOptions.marginY;
    let maxWidth = 0;

    nodes.forEach(node => {
      const dimensions = this.calculateNodeDimensions(node, layoutOptions);

      const x = layoutOptions.marginX;
      const y = currentY;

      positions[node.id] = {
        x,
        y,
        width: dimensions.width,
        height: dimensions.height,
      };

      maxWidth = Math.max(maxWidth, dimensions.width);
      currentY += dimensions.height + layoutOptions.rankSpacing;
    });

    const totalWidth = maxWidth + layoutOptions.marginX * 2;
    const totalHeight = currentY + layoutOptions.marginY;

    const endTime = performance.now();

    return {
      positions,
      bounds: {
        width: totalWidth,
        height: totalHeight,
        minX: 0,
        minY: 0,
        maxX: totalWidth,
        maxY: totalHeight,
      },
      metadata: {
        algorithm: 'simple',
        duration: endTime - startTime,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  }

  private calculateNodeDimensions(
    node: WorkflowNode,
    options: LayoutOptions
  ): { width: number; height: number } {
    const width = options.nodeWidthByType?.[node.type] || options.defaultNodeWidth;
    const height = options.nodeHeightByType?.[node.type] || options.defaultNodeHeight;
    return { width, height };
  }
}

// =============================================================================
// Layout Factory
// =============================================================================

export function createLayoutEngine(
  algorithm: 'dagre' | 'simple' = 'dagre',
  options?: Partial<LayoutOptions>
): LayoutEngine {
  switch (algorithm) {
    case 'dagre':
      return new DagreLayoutEngine(options);
    case 'simple':
      return new SimpleLayoutEngine(options);
    default:
      return new DagreLayoutEngine(options);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert calculated positions to React Flow positions
 */
export function toReactFlowPositions(
  positions: Record<string, CalculatedPosition>
): Record<string, ReactFlowPosition> {
  const reactFlowPositions: Record<string, ReactFlowPosition> = {};

  Object.entries(positions).forEach(([nodeId, position]) => {
    reactFlowPositions[nodeId] = {
      x: position.x,
      y: position.y,
    };
  });

  return reactFlowPositions;
}

/**
 * Normalize positions to start from (0, 0)
 */
export function normalizePositions(
  positions: Record<string, CalculatedPosition>
): Record<string, CalculatedPosition> {
  let minX = Infinity;
  let minY = Infinity;

  // Find minimum coordinates
  Object.values(positions).forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  });

  // Adjust all positions
  const normalized: Record<string, CalculatedPosition> = {};
  Object.entries(positions).forEach(([nodeId, pos]) => {
    normalized[nodeId] = {
      ...pos,
      x: pos.x - minX,
      y: pos.y - minY,
    };
  });

  return normalized;
}

/**
 * Calculate optimal viewport for React Flow
 */
export function calculateOptimalViewport(
  positions: Record<string, CalculatedPosition>,
  containerWidth: number = 1200,
  containerHeight: number = 800,
  padding: number = 50
): { x: number; y: number; zoom: number } {
  const values = Object.values(positions);
  if (values.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Calculate bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  values.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  });

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  // Calculate zoom to fit content with padding
  const zoomX = (containerWidth - 2 * padding) / contentWidth;
  const zoomY = (containerHeight - 2 * padding) / contentHeight;
  const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 100%

  // Calculate center position
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Calculate viewport position to center the content
  const x = containerWidth / 2 - centerX * zoom;
  const y = containerHeight / 2 - centerY * zoom;

  return { x, y, zoom };
}
