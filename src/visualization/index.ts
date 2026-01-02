/**
 * Visualization module exports
 * Provides React Flow output generation, layout algorithms, theming, and validation
 */

// Main generator
export {
  ReactFlowGenerator,
  generateReactFlowOutput,
  generateReactFlowOutputWithTheme,
} from './generator';

// Type definitions
export type {
  ReactFlowOutput,
  ReactFlowNode,
  ReactFlowEdge,
  ReactFlowPosition,
  ReactFlowViewport,
  ReactFlowNodeData,
  ReactFlowEdgeData,
  ValidationStatus,
  WorkflowMetadata,
  ValidationError,
  ValidationWarning,
  OptimizationSuggestion,
  WorkflowMetrics,
  LayoutOptions,
  CalculatedPosition,
  LayoutResult,
  NodeStyleConfig,
  EdgeStyleConfig,
  ThemeConfig,
  ReactFlowGeneratorOptions,
} from './types';

// Layout algorithms and utilities
export {
  DagreLayoutEngine,
  SimpleLayoutEngine,
  defaultLayoutOptions,
  createLayoutEngine,
  toReactFlowPositions,
  normalizePositions,
  calculateOptimalViewport,
} from './layout';

// Theming system
export {
  themes,
  getTheme,
  getNodeStyle,
  getEdgeStyle,
  calculateNodeDimensions,
  defaultTheme,
  darkTheme,
  lightTheme,
} from './themes';

// Validation system
export {
  ValidationResult,
  AdvancedGraphValidator,
  validateWorkflowGraph,
  hasCycles,
  findUnreachableNodes,
} from './validation';
