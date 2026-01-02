/**
 * Export Utilities for React Flow Visualizations
 *
 * This module provides utilities for exporting flowsh visualizations
 * to various formats including JSON, SVG, PNG, and PDF.
 */

import { ReactFlowOutput, ExportFormat, ExportOptions, ExportResult } from './types.js';
import { ThemeConfig } from './types.js';

// =============================================================================
// Export Format Handlers
// =============================================================================

/**
 * Export React Flow output to JSON format
 */
export function exportToJSON(
  reactFlowOutput: ReactFlowOutput,
  options: ExportOptions = {}
): ExportResult {
  try {
    const exportData = {
      format: 'json' as ExportFormat,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      metadata: {
        nodeCount: reactFlowOutput.nodes.length,
        edgeCount: reactFlowOutput.edges.length,
        theme: options.theme?.name || 'default',
        ...options.metadata,
      },
      data: reactFlowOutput,
    };

    const jsonString = JSON.stringify(exportData, null, options.pretty ? 2 : 0);

    return {
      success: true,
      format: 'json',
      content: jsonString,
      size: new Blob([jsonString]).size,
      metadata: exportData.metadata,
    };
  } catch (error) {
    return {
      success: false,
      format: 'json',
      error: error instanceof Error ? error.message : 'Unknown error during JSON export',
    };
  }
}

/**
 * Export React Flow output to SVG format
 * Note: This generates SVG markup that can be rendered by React Flow or standalone
 */
export function exportToSVG(
  reactFlowOutput: ReactFlowOutput,
  options: ExportOptions = {}
): ExportResult {
  try {
    const { nodes, edges } = reactFlowOutput;
    const theme = options.theme;

    // Calculate viewport dimensions
    const viewportWidth = options.width || 800;
    const viewportHeight = options.height || 600;

    // SVG header
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${viewportWidth}" height="${viewportHeight}" 
     viewBox="0 0 ${viewportWidth} ${viewportHeight}"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .node-text { font-family: Arial, sans-serif; text-anchor: middle; dominant-baseline: central; }
      .edge-line { fill: none; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${theme?.colors?.background || '#ffffff'}"/>
`;

    // Render edges first (so they appear behind nodes)
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const sourceX = sourceNode.position.x + (sourceNode.width || 120) / 2;
        const sourceY = sourceNode.position.y + (sourceNode.height || 40) / 2;
        const targetX = targetNode.position.x + (targetNode.width || 120) / 2;
        const targetY = targetNode.position.y + (targetNode.height || 40) / 2;

        const edgeStyle = theme?.edgeStyles?.['default'] || { stroke: '#b1bfca', strokeWidth: 2 };
        const strokeDasharray = edge.type === 'conditional' ? '8,4' : '';

        svgContent += `  <line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}"
                             stroke="${edgeStyle.stroke}" stroke-width="${edgeStyle.strokeWidth}"
                             stroke-dasharray="${strokeDasharray}" class="edge-line"/>\n`;
      }
    }

    // Render nodes
    for (const node of nodes) {
      const nodeStyle = theme?.nodeStyles?.[node.type] || theme?.nodeStyles?.['default'];
      const width = node.width || nodeStyle?.minWidth || 120;
      const height = node.height || nodeStyle?.minHeight || 40;

      svgContent += `  <g transform="translate(${node.position.x}, ${node.position.y})">
    <rect width="${width}" height="${height}"
          fill="${nodeStyle?.backgroundColor || '#f5f5f5'}"
          stroke="${nodeStyle?.borderColor || '#757575'}"
          stroke-width="${nodeStyle?.borderWidth || 2}"
          rx="${nodeStyle?.borderRadius || 8}"/>
    <text x="${width / 2}" y="${height / 2}"
          font-size="${nodeStyle?.fontSize || 14}"
          font-weight="${nodeStyle?.fontWeight || 'normal'}"
          fill="${nodeStyle?.color || '#424242'}"
          class="node-text">
      ${node.data?.title || node.id}
    </text>
  </g>\n`;
    }

    svgContent += '</svg>';

    return {
      success: true,
      format: 'svg',
      content: svgContent,
      size: new Blob([svgContent]).size,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        dimensions: { width: viewportWidth, height: viewportHeight },
      },
    };
  } catch (error) {
    return {
      success: false,
      format: 'svg',
      error: error instanceof Error ? error.message : 'Unknown error during SVG export',
    };
  }
}

/**
 * Export React Flow output to Mermaid diagram format
 */
export function exportToMermaid(
  reactFlowOutput: ReactFlowOutput,
  options: ExportOptions = {}
): ExportResult {
  try {
    const { nodes, edges } = reactFlowOutput;

    let mermaidContent = 'flowchart TD\n';

    // Add nodes with labels
    for (const node of nodes) {
      const nodeId = sanitizeMermaidId(node.id);
      const label = node.data?.title || node.id;
      const shape = getMermaidNodeShape(node.type);

      mermaidContent += `    ${nodeId}${shape.start}"${label}"${shape.end}\n`;
    }

    // Add edges
    for (const edge of edges) {
      const sourceId = sanitizeMermaidId(edge.source);
      const targetId = sanitizeMermaidId(edge.target);
      const edgeStyle = edge.type === 'conditional' ? '-.->|' : '-->';
      const label = edge.label ? `|${edge.label}|` : '';

      mermaidContent += `    ${sourceId} ${edgeStyle}${label} ${targetId}\n`;
    }

    // Add styling based on theme
    if (options.theme) {
      mermaidContent += '\n';
      mermaidContent += generateMermaidStyling(nodes, options.theme);
    }

    return {
      success: true,
      format: 'mermaid',
      content: mermaidContent,
      size: new Blob([mermaidContent]).size,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      format: 'mermaid',
      error: error instanceof Error ? error.message : 'Unknown error during Mermaid export',
    };
  }
}

/**
 * Export React Flow output to Graphviz DOT format
 */
export function exportToDOT(
  reactFlowOutput: ReactFlowOutput,
  options: ExportOptions = {}
): ExportResult {
  try {
    const { nodes, edges } = reactFlowOutput;

    let dotContent = 'digraph flowsh_workflow {\n';
    dotContent += '  rankdir=TD;\n';
    dotContent += '  bgcolor="' + (options.theme?.colors?.background || 'white') + '";\n';
    dotContent += '  node [fontname="Arial", fontsize=12];\n';
    dotContent += '  edge [fontname="Arial", fontsize=10];\n\n';

    // Add nodes with styling
    for (const node of nodes) {
      const nodeId = sanitizeDotId(node.id);
      const label = node.data?.title || node.id;
      const nodeStyle = getDotNodeStyle(node.type, options.theme);

      dotContent += `  ${nodeId} [label="${label}", ${nodeStyle}];\n`;
    }

    dotContent += '\n';

    // Add edges
    for (const edge of edges) {
      const sourceId = sanitizeDotId(edge.source);
      const targetId = sanitizeDotId(edge.target);
      const edgeStyle = getDotEdgeStyle(edge.type || 'default', options.theme);
      const label = edge.label ? `, label="${edge.label}"` : '';

      dotContent += `  ${sourceId} -> ${targetId} [${edgeStyle}${label}];\n`;
    }

    dotContent += '}';

    return {
      success: true,
      format: 'dot',
      content: dotContent,
      size: new Blob([dotContent]).size,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      format: 'dot',
      error: error instanceof Error ? error.message : 'Unknown error during DOT export',
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeDotId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return sanitized.match(/^[0-9]/) ? `n_${sanitized}` : sanitized;
}

function getMermaidNodeShape(nodeType: string): { start: string; end: string } {
  const shapes: Record<string, { start: string; end: string }> = {
    start: { start: '([', end: '])' },
    end: { start: '([', end: '])' },
    'if-else': { start: '{', end: '}' },
    llm: { start: '[', end: ']' },
    agent: { start: '[', end: ']' },
    code: { start: '[', end: ']' },
    'variable-assignment': { start: '[', end: ']' },
    answer: { start: '[', end: ']' },
    default: { start: '[', end: ']' },
  };

  return shapes[nodeType] || shapes['default'] || { start: '[', end: ']' };
}

function generateMermaidStyling(nodes: any[], theme: ThemeConfig): string {
  let styling = '';
  const nodeTypes = [...new Set(nodes.map(n => n.type))];

  for (let i = 0; i < nodeTypes.length; i++) {
    const nodeType = nodeTypes[i];
    const nodeStyle = theme.nodeStyles?.[nodeType] || theme.nodeStyles?.['default'];

    if (nodeStyle) {
      styling += `    classDef class${i} fill:${nodeStyle.backgroundColor},stroke:${nodeStyle.borderColor},stroke-width:${nodeStyle.borderWidth}px,color:${nodeStyle.color}\n`;

      const nodeIds = nodes
        .filter(n => n.type === nodeType)
        .map(n => sanitizeMermaidId(n.id))
        .join(',');

      if (nodeIds) {
        styling += `    class ${nodeIds} class${i}\n`;
      }
    }
  }

  return styling;
}

function getDotNodeStyle(nodeType: string, theme?: ThemeConfig): string {
  const nodeStyle = theme?.nodeStyles?.[nodeType] || theme?.nodeStyles?.['default'];

  if (!nodeStyle) {
    return 'shape=box, style=filled, fillcolor=lightgray';
  }

  const shape =
    nodeType === 'if-else'
      ? 'diamond'
      : nodeType === 'start' || nodeType === 'end'
        ? 'ellipse'
        : 'box';

  return `shape=${shape}, style=filled, fillcolor="${nodeStyle.backgroundColor}", color="${nodeStyle.borderColor}"`;
}

function getDotEdgeStyle(edgeType: string, theme?: ThemeConfig): string {
  const edgeStyle = theme?.edgeStyles?.[edgeType] || theme?.edgeStyles?.['default'];

  if (!edgeStyle) {
    return 'color=gray';
  }

  const style = edgeType === 'conditional' ? 'dashed' : 'solid';
  return `color="${edgeStyle.stroke}", style=${style}`;
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Export React Flow output to specified format
 */
export function exportVisualization(
  reactFlowOutput: ReactFlowOutput,
  format: ExportFormat,
  options: ExportOptions = {}
): ExportResult {
  switch (format) {
    case 'json':
      return exportToJSON(reactFlowOutput, options);
    case 'svg':
      return exportToSVG(reactFlowOutput, options);
    case 'mermaid':
      return exportToMermaid(reactFlowOutput, options);
    case 'dot':
      return exportToDOT(reactFlowOutput, options);
    default:
      return {
        success: false,
        format,
        error: `Unsupported export format: ${format}`,
      };
  }
}

/**
 * Get available export formats
 */
export function getAvailableFormats(): ExportFormat[] {
  return ['json', 'svg', 'mermaid', 'dot'];
}

/**
 * Validate export options for a given format
 */
export function validateExportOptions(
  format: ExportFormat,
  options: ExportOptions
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (format === 'svg') {
    if (options.width && (options.width < 100 || options.width > 10000)) {
      errors.push('SVG width must be between 100 and 10000 pixels');
    }
    if (options.height && (options.height < 100 || options.height > 10000)) {
      errors.push('SVG height must be between 100 and 10000 pixels');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
