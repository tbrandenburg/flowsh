/**
 * React Flow Output Types for flowsh Visualization
 *
 * This module defines the type system for React Flow compatible output,
 * ensuring proper structure and compatibility with React Flow rendering.
 */

// React Flow types and interfaces

// =============================================================================
// React Flow Compatible Types
// =============================================================================

export interface ReactFlowPosition {
  x: number;
  y: number;
}

export interface ReactFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ValidationStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReactFlowNodeData {
  label: string;
  nodeType: string;
  title?: string;
  description?: string;
  validationStatus: ValidationStatus;
  executionStatus: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  metadata?: Record<string, any>;
  // Original workflow node data for reference
  originalData: any;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: ReactFlowPosition;
  data: ReactFlowNodeData;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  className?: string;
  hidden?: boolean;
  selected?: boolean;
  dragging?: boolean;
  // Handle positions for connections
  sourcePosition?: 'top' | 'right' | 'bottom' | 'left';
  targetPosition?: 'top' | 'right' | 'bottom' | 'left';
}

export interface ReactFlowEdgeData {
  label?: string;
  condition?: string;
  weight?: number;
  executionOrder?: number;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  label?: string;
  labelStyle?: React.CSSProperties;
  labelBgStyle?: React.CSSProperties;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
  data?: ReactFlowEdgeData;
  hidden?: boolean;
  selected?: boolean;
}

export interface WorkflowMetadata {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  created_by?: string;
  updated_by?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  // Visualization specific metadata
  nodeCount: number;
  edgeCount: number;
  complexity: number;
  estimatedExecutionTime: number;
  criticalPath: string[];
}

export interface ReactFlowOutput {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  viewport: ReactFlowViewport;
  metadata: WorkflowMetadata;
  // Additional visualization data
  layout: {
    algorithm: 'dagre' | 'elk' | 'custom';
    direction: 'TB' | 'BT' | 'LR' | 'RL';
    spacing: {
      nodeSpacing: number;
      rankSpacing: number;
      marginX: number;
      marginY: number;
    };
  };
  validation: {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: OptimizationSuggestion[];
  };
}

// =============================================================================
// Validation and Analysis Types
// =============================================================================

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: Record<string, any>;
  nodeId?: string;
  edgeId?: string;
}

export interface OptimizationSuggestion {
  type: 'performance' | 'optimization' | 'best_practice' | 'security';
  message: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  nodeId?: string;
  edgeId?: string;
  details?: Record<string, any>;
}

export interface WorkflowMetrics {
  nodeCount: number;
  edgeCount: number;
  complexity: number;
  estimatedExecutionTime: number;
  criticalPath: string[];
  unreachableNodes: string[];
  cycles: string[][];
  // Performance metrics
  maxDepth: number;
  branchingFactor: number;
  parallelizationPotential: number;
}

// =============================================================================
// Layout Algorithm Types
// =============================================================================

export interface LayoutOptions {
  algorithm: 'dagre' | 'elk' | 'custom';
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing: number;
  rankSpacing: number;
  marginX: number;
  marginY: number;
  // Node size settings
  defaultNodeWidth: number;
  defaultNodeHeight: number;
  nodeWidthByType?: Record<string, number>;
  nodeHeightByType?: Record<string, number>;
  // Edge settings
  edgeSpacing: number;
  minLen?: number;
}

export interface CalculatedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  positions: Record<string, CalculatedPosition>;
  bounds: {
    width: number;
    height: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  metadata: {
    algorithm: string;
    duration: number;
    nodeCount: number;
    edgeCount: number;
  };
}

// =============================================================================
// Styling Types
// =============================================================================

export interface NodeStyleConfig {
  [nodeType: string]: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    fontSize: number;
    fontWeight: string | number;
    color: string;
    minWidth: number;
    minHeight: number;
    padding: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

export interface EdgeStyleConfig {
  [edgeType: string]: React.CSSProperties;
  default: React.CSSProperties;
  conditional: React.CSSProperties;
  error: React.CSSProperties;
  success: React.CSSProperties;
  animated: React.CSSProperties;
}

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    text: string;
    border: string;
  };
  nodeStyles: NodeStyleConfig;
  edgeStyles: EdgeStyleConfig;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

// =============================================================================
// Generator Configuration
// =============================================================================

export interface ReactFlowGeneratorOptions {
  layout: LayoutOptions;
  theme: ThemeConfig | 'default' | 'dark' | 'light';
  validation: {
    enabled: boolean;
    strict: boolean;
    includeWarnings: boolean;
  };
  optimization: {
    calculateMetrics: boolean;
    findCriticalPath: boolean;
    detectCycles: boolean;
    findUnreachableNodes: boolean;
  };
  viewport: {
    center: boolean;
    fit: boolean;
    padding: number;
    minZoom: number;
    maxZoom: number;
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type ExportFormat = 'json' | 'svg' | 'mermaid' | 'dot' | 'png' | 'pdf';

export interface ExportOptions {
  theme?: ThemeConfig;
  width?: number;
  height?: number;
  pretty?: boolean;
  metadata?: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  content?: string;
  size?: number;
  metadata?: Record<string, any>;
  error?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isReactFlowNode(obj: any): obj is ReactFlowNode {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    obj.position &&
    typeof obj.position.x === 'number' &&
    typeof obj.position.y === 'number' &&
    obj.data &&
    typeof obj.data.label === 'string'
  );
}

export function isReactFlowEdge(obj: any): obj is ReactFlowEdge {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.source === 'string' &&
    typeof obj.target === 'string'
  );
}

export function isReactFlowOutput(obj: any): obj is ReactFlowOutput {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges) &&
    obj.viewport &&
    obj.metadata &&
    obj.layout &&
    obj.validation
  );
}
