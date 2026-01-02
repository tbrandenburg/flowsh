/**
 * Theme Configuration for React Flow Visualization
 *
 * This module provides pre-built themes and styling configurations
 * for React Flow output generation in flowsh.
 */

import { ThemeConfig } from './types.js';

// =============================================================================
// Default Theme
// =============================================================================

export const defaultTheme: ThemeConfig = {
  name: 'default',
  colors: {
    primary: '#2196f3',
    secondary: '#757575',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#00bcd4',
    background: '#ffffff',
    text: '#212121',
    border: '#e0e0e0',
  },
  nodeStyles: {
    start: {
      backgroundColor: '#e8f5e8',
      borderColor: '#4caf50',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#2e7d32',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    end: {
      backgroundColor: '#fce4ec',
      borderColor: '#e91e63',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#ad1457',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    'if-else': {
      backgroundColor: '#fff3e0',
      borderColor: '#ff9800',
      borderWidth: 2,
      borderRadius: 12,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e65100',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    llm: {
      backgroundColor: '#e3f2fd',
      borderColor: '#2196f3',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#0d47a1',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    agent: {
      backgroundColor: '#f3e5f5',
      borderColor: '#9c27b0',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#4a148c',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    code: {
      backgroundColor: '#e0f2f1',
      borderColor: '#009688',
      borderWidth: 2,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: '600',
      color: '#00695c',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    'variable-assignment': {
      backgroundColor: '#f1f8e9',
      borderColor: '#689f38',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#33691e',
      minWidth: 160,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    loop: {
      backgroundColor: '#fff8e1',
      borderColor: '#ffa000',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e65100',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    iteration: {
      backgroundColor: '#f3e5f5',
      borderColor: '#7b1fa2',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#4a148c',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    answer: {
      backgroundColor: '#e8eaf6',
      borderColor: '#3f51b5',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1a237e',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    default: {
      backgroundColor: '#f5f5f5',
      borderColor: '#757575',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'normal',
      color: '#424242',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
  },
  edgeStyles: {
    default: {
      stroke: '#b1bfca',
      strokeWidth: 2,
      fill: 'none',
    },
    conditional: {
      stroke: '#ff9800',
      strokeWidth: 2,
      strokeDasharray: '8,4',
      fill: 'none',
    },
    error: {
      stroke: '#f44336',
      strokeWidth: 2,
      fill: 'none',
    },
    success: {
      stroke: '#4caf50',
      strokeWidth: 2,
      fill: 'none',
    },
    animated: {
      stroke: '#2196f3',
      strokeWidth: 2,
      fill: 'none',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// =============================================================================
// Dark Theme
// =============================================================================

export const darkTheme: ThemeConfig = {
  name: 'dark',
  colors: {
    primary: '#64b5f6',
    secondary: '#9e9e9e',
    success: '#81c784',
    warning: '#ffb74d',
    error: '#e57373',
    info: '#4dd0e1',
    background: '#121212',
    text: '#ffffff',
    border: '#424242',
  },
  nodeStyles: {
    start: {
      backgroundColor: '#2e7d32',
      borderColor: '#4caf50',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e8f5e8',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    end: {
      backgroundColor: '#c2185b',
      borderColor: '#e91e63',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fce4ec',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    'if-else': {
      backgroundColor: '#e65100',
      borderColor: '#ff9800',
      borderWidth: 2,
      borderRadius: 12,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff3e0',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    llm: {
      backgroundColor: '#1565c0',
      borderColor: '#2196f3',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e3f2fd',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    agent: {
      backgroundColor: '#7b1fa2',
      borderColor: '#9c27b0',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#f3e5f5',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    code: {
      backgroundColor: '#00695c',
      borderColor: '#009688',
      borderWidth: 2,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: '600',
      color: '#e0f2f1',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    'variable-assignment': {
      backgroundColor: '#558b2f',
      borderColor: '#689f38',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#f1f8e9',
      minWidth: 160,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    loop: {
      backgroundColor: '#f57c00',
      borderColor: '#ffa000',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff8e1',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    iteration: {
      backgroundColor: '#7b1fa2',
      borderColor: '#9c27b0',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#f3e5f5',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    answer: {
      backgroundColor: '#303f9f',
      borderColor: '#3f51b5',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e8eaf6',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    default: {
      backgroundColor: '#424242',
      borderColor: '#757575',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'normal',
      color: '#f5f5f5',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
  },
  edgeStyles: {
    default: {
      stroke: '#616161',
      strokeWidth: 2,
      fill: 'none',
    },
    conditional: {
      stroke: '#ffb74d',
      strokeWidth: 2,
      strokeDasharray: '8,4',
      fill: 'none',
    },
    error: {
      stroke: '#e57373',
      strokeWidth: 2,
      fill: 'none',
    },
    success: {
      stroke: '#81c784',
      strokeWidth: 2,
      fill: 'none',
    },
    animated: {
      stroke: '#64b5f6',
      strokeWidth: 2,
      fill: 'none',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// =============================================================================
// Light Theme
// =============================================================================

export const lightTheme: ThemeConfig = {
  name: 'light',
  colors: {
    primary: '#1976d2',
    secondary: '#616161',
    success: '#388e3c',
    warning: '#f57c00',
    error: '#d32f2f',
    info: '#0097a7',
    background: '#fafafa',
    text: '#212121',
    border: '#e0e0e0',
  },
  nodeStyles: {
    start: {
      backgroundColor: '#f1f8e9',
      borderColor: '#689f38',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#33691e',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    end: {
      backgroundColor: '#fde7f3',
      borderColor: '#d81b60',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#880e4f',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
    'if-else': {
      backgroundColor: '#fff8e1',
      borderColor: '#ffa000',
      borderWidth: 2,
      borderRadius: 12,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e65100',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    llm: {
      backgroundColor: '#e1f5fe',
      borderColor: '#0288d1',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#01579b',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    agent: {
      backgroundColor: '#f8e6ff',
      borderColor: '#8e24aa',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#4a148c',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    code: {
      backgroundColor: '#e0f7fa',
      borderColor: '#00acc1',
      borderWidth: 2,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: '600',
      color: '#006064',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    'variable-assignment': {
      backgroundColor: '#f1f8e9',
      borderColor: '#689f38',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#33691e',
      minWidth: 160,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    loop: {
      backgroundColor: '#fff8e1',
      borderColor: '#ffa000',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#e65100',
      minWidth: 140,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    iteration: {
      backgroundColor: '#f3e5f5',
      borderColor: '#7b1fa2',
      borderWidth: 2,
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#4a148c',
      minWidth: 150,
      minHeight: 50,
      padding: '12px',
      textAlign: 'center',
    },
    answer: {
      backgroundColor: '#e8eaf6',
      borderColor: '#3f51b5',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1a237e',
      minWidth: 130,
      minHeight: 45,
      padding: '10px',
      textAlign: 'center',
    },
    default: {
      backgroundColor: '#f5f5f5',
      borderColor: '#757575',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'normal',
      color: '#424242',
      minWidth: 120,
      minHeight: 40,
      padding: '10px',
      textAlign: 'center',
    },
  },
  edgeStyles: {
    default: {
      stroke: '#b1bfca',
      strokeWidth: 2,
      fill: 'none',
    },
    conditional: {
      stroke: '#ff9800',
      strokeWidth: 2,
      strokeDasharray: '8,4',
      fill: 'none',
    },
    error: {
      stroke: '#f44336',
      strokeWidth: 2,
      fill: 'none',
    },
    success: {
      stroke: '#4caf50',
      strokeWidth: 2,
      fill: 'none',
    },
    animated: {
      stroke: '#2196f3',
      strokeWidth: 2,
      fill: 'none',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// =============================================================================
// Theme Registry and Utilities
// =============================================================================

export const themes: Record<string, ThemeConfig> = {
  default: defaultTheme,
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Get theme by name or return default theme
 */
export function getTheme(themeName?: string | ThemeConfig): ThemeConfig {
  if (!themeName) {
    return defaultTheme;
  }

  if (typeof themeName === 'object') {
    return themeName;
  }

  return themes[themeName] || defaultTheme;
}

/**
 * Get node style for a specific node type and theme
 */
export function getNodeStyle(
  nodeType: string,
  theme: ThemeConfig = defaultTheme
): React.CSSProperties {
  const nodeStyle = theme.nodeStyles[nodeType] || theme.nodeStyles['default'];

  return {
    backgroundColor: nodeStyle?.backgroundColor || '#f5f5f5',
    borderColor: nodeStyle?.borderColor || '#757575',
    borderWidth: nodeStyle?.borderWidth || 2,
    borderStyle: 'solid',
    borderRadius: nodeStyle?.borderRadius || 8,
    fontSize: nodeStyle?.fontSize || 14,
    fontWeight: nodeStyle?.fontWeight || 'normal',
    color: nodeStyle?.color || '#424242',
    minWidth: nodeStyle?.minWidth || 120,
    minHeight: nodeStyle?.minHeight || 40,
    padding: nodeStyle?.padding || '10px',
    textAlign: nodeStyle?.textAlign || 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };
}

/**
 * Get edge style for a specific edge type and theme
 */
export function getEdgeStyle(
  edgeType: string = 'default',
  theme: ThemeConfig = defaultTheme
): React.CSSProperties {
  const edgeStyles = theme.edgeStyles as any;
  return edgeStyles[edgeType] || edgeStyles['default'] || theme.edgeStyles.default;
}

/**
 * Calculate optimal node dimensions based on content and theme
 */
export function calculateNodeDimensions(
  nodeType: string,
  content: string,
  theme: ThemeConfig = defaultTheme
): { width: number; height: number } {
  const nodeStyle = theme.nodeStyles[nodeType] || theme.nodeStyles['default'];

  if (!nodeStyle) {
    return { width: 120, height: 40 };
  }

  // Estimate text width (rough approximation)
  const charWidth = (nodeStyle.fontSize || 14) * 0.6;
  const estimatedTextWidth = content.length * charWidth;

  // Add padding and minimum width
  const paddingHorizontal = parseInt((nodeStyle.padding || '10px').replace('px', '')) * 2;
  const width = Math.max(nodeStyle.minWidth || 120, estimatedTextWidth + paddingHorizontal + 20);

  // Height is generally fixed unless we have multi-line content
  const lines = Math.ceil(content.length / 20); // Rough estimate
  const lineHeight = (nodeStyle.fontSize || 14) * 1.2;
  const paddingVertical = parseInt((nodeStyle.padding || '10px').replace('px', '')) * 2;
  const height = Math.max(nodeStyle.minHeight || 40, lines * lineHeight + paddingVertical);

  return { width, height };
}
