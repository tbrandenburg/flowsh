/**
 * Advanced Visualization Features Test
 *
 * Test the new themes, export options, and layout features
 */

import {
  exportVisualization,
  exportToJSON,
  exportToSVG,
  exportToMermaid,
  exportToDOT,
  getAvailableFormats,
  validateExportOptions,
} from '../export.js';
import {
  highContrastTheme,
  professionalTheme,
  developerTheme,
  colorblindFriendlyTheme,
  solarizedTheme,
} from '../advanced-themes.js';
import { ReactFlowOutput, ExportFormat } from '../types.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { defaultTheme } from '../themes.js';

describe('Advanced Visualization Features', () => {
  let mockReactFlowOutput: ReactFlowOutput;

  beforeEach(() => {
    mockReactFlowOutput = {
      nodes: [
        {
          id: 'start',
          type: 'start',
          position: { x: 50, y: 50 },
          width: 120,
          height: 40,
          data: {
            label: 'Start',
            nodeType: 'start',
            title: 'Workflow Start',
            validationStatus: { isValid: true, errors: [], warnings: [] },
            executionStatus: 'pending',
            originalData: {},
          },
        },
        {
          id: 'llm-node',
          type: 'llm',
          position: { x: 250, y: 150 },
          width: 150,
          height: 50,
          data: {
            label: 'LLM Process',
            nodeType: 'llm',
            title: 'AI Processing',
            validationStatus: { isValid: true, errors: [], warnings: [] },
            executionStatus: 'pending',
            originalData: {},
          },
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 450, y: 250 },
          width: 120,
          height: 40,
          data: {
            label: 'End',
            nodeType: 'end',
            title: 'Workflow End',
            validationStatus: { isValid: true, errors: [], warnings: [] },
            executionStatus: 'pending',
            originalData: {},
          },
        },
      ],
      edges: [
        {
          id: 'start-to-llm',
          source: 'start',
          target: 'llm-node',
          type: 'default',
          label: 'Process',
        },
        {
          id: 'llm-to-end',
          source: 'llm-node',
          target: 'end',
          type: 'conditional',
          label: 'Complete',
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: {
        name: 'Test Workflow',
        description: 'Test workflow for visualization',
        nodeCount: 3,
        edgeCount: 2,
        complexity: 2,
        estimatedExecutionTime: 100,
        criticalPath: ['start', 'llm-node', 'end'],
      },
      layout: {
        algorithm: 'dagre',
        direction: 'TB',
        spacing: {
          nodeSpacing: 50,
          rankSpacing: 100,
          marginX: 20,
          marginY: 20,
        },
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      },
    };
  });

  describe('Advanced Themes', () => {
    it('should have all advanced theme properties', () => {
      const themes = [
        highContrastTheme,
        professionalTheme,
        developerTheme,
        colorblindFriendlyTheme,
        solarizedTheme,
      ];

      themes.forEach(theme => {
        expect(theme.name).toBeDefined();
        expect(theme.colors).toBeDefined();
        expect(theme.nodeStyles).toBeDefined();
        expect(theme.edgeStyles).toBeDefined();
        expect(theme.spacing).toBeDefined();

        // Check that theme has essential colors
        expect(theme.colors.primary).toBeDefined();
        expect(theme.colors.background).toBeDefined();
        expect(theme.colors.text).toBeDefined();

        // Check that theme has essential node styles
        expect(theme.nodeStyles.start).toBeDefined();
        expect(theme.nodeStyles.end).toBeDefined();
        expect(theme.nodeStyles.default).toBeDefined();
      });
    });

    it('should have accessibility features in high contrast theme', () => {
      expect(highContrastTheme.name).toBe('high-contrast');
      expect(highContrastTheme.nodeStyles.start.borderWidth).toBeGreaterThanOrEqual(3);
      expect(highContrastTheme.nodeStyles.start.fontSize).toBeGreaterThanOrEqual(16);
      expect(highContrastTheme.edgeStyles.default.strokeWidth).toBeGreaterThanOrEqual(3);
    });

    it('should have professional styling in professional theme', () => {
      expect(professionalTheme.name).toBe('professional');
      expect(professionalTheme.colors.primary).toBe('#2c3e50');
      expect(professionalTheme.nodeStyles.start.backgroundColor).toBe('#2ecc71');
    });

    it('should have developer-friendly colors in developer theme', () => {
      expect(developerTheme.name).toBe('developer');
      expect(developerTheme.colors.background).toBe('#282c34');
      expect(developerTheme.nodeStyles.code.backgroundColor).toBe('#1e2127');
    });

    it('should use colorblind-safe colors', () => {
      expect(colorblindFriendlyTheme.name).toBe('colorblind-friendly');
      // Check for specific colorblind-safe colors
      expect(colorblindFriendlyTheme.colors.primary).toBe('#0173b2');
      expect(colorblindFriendlyTheme.colors.success).toBe('#029e73');
    });

    it('should match solarized color scheme', () => {
      expect(solarizedTheme.name).toBe('solarized');
      expect(solarizedTheme.colors.background).toBe('#fdf6e3');
      expect(solarizedTheme.colors.primary).toBe('#268bd2');
    });
  });

  describe('Export Functionality', () => {
    it('should get available export formats', () => {
      const formats = getAvailableFormats();
      expect(formats).toContain('json');
      expect(formats).toContain('svg');
      expect(formats).toContain('mermaid');
      expect(formats).toContain('dot');
      expect(formats.length).toBeGreaterThanOrEqual(4);
    });

    it('should validate export options correctly', () => {
      const validOptions = { width: 800, height: 600 };
      const result1 = validateExportOptions('svg', validOptions);
      expect(result1.valid).toBe(true);
      expect(result1.errors).toHaveLength(0);

      const invalidOptions = { width: 50, height: 20000 };
      const result2 = validateExportOptions('svg', invalidOptions);
      expect(result2.valid).toBe(false);
      expect(result2.errors.length).toBeGreaterThan(0);
    });

    describe('JSON Export', () => {
      it('should export to JSON format', () => {
        const result = exportToJSON(mockReactFlowOutput, { pretty: true });

        expect(result.success).toBe(true);
        expect(result.format).toBe('json');
        expect(result.content).toBeDefined();
        expect(result.size).toBeGreaterThan(0);

        const parsed = JSON.parse(result.content!);
        expect(parsed.format).toBe('json');
        expect(parsed.data.nodes).toHaveLength(3);
        expect(parsed.data.edges).toHaveLength(2);
        expect(parsed.metadata.nodeCount).toBe(3);
      });

      it('should include theme information in metadata', () => {
        const result = exportToJSON(mockReactFlowOutput, {
          theme: professionalTheme,
          metadata: { author: 'Test User' },
        });

        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.content!);
        expect(parsed.metadata.theme).toBe('professional');
        expect(parsed.metadata.author).toBe('Test User');
      });
    });

    describe('SVG Export', () => {
      it('should export to SVG format', () => {
        const result = exportToSVG(mockReactFlowOutput, {
          theme: defaultTheme,
          width: 800,
          height: 600,
        });

        expect(result.success).toBe(true);
        expect(result.format).toBe('svg');
        expect(result.content).toBeDefined();
        expect(result.content).toContain('<svg');
        expect(result.content).toContain('</svg>');
        expect(result.content).toContain('viewBox="0 0 800 600"');
      });

      it('should include all nodes and edges in SVG', () => {
        const result = exportToSVG(mockReactFlowOutput, { theme: defaultTheme });

        expect(result.success).toBe(true);
        expect(result.content).toContain('Workflow Start');
        expect(result.content).toContain('AI Processing');
        expect(result.content).toContain('Workflow End');
        expect(result.metadata?.nodeCount).toBe(3);
      });

      it('should apply theme colors in SVG', () => {
        const result = exportToSVG(mockReactFlowOutput, {
          theme: professionalTheme,
        });

        expect(result.success).toBe(true);
        expect(result.content).toContain(professionalTheme.colors.background);
      });
    });

    describe('Mermaid Export', () => {
      it('should export to Mermaid format', () => {
        const result = exportToMermaid(mockReactFlowOutput);

        expect(result.success).toBe(true);
        expect(result.format).toBe('mermaid');
        expect(result.content).toBeDefined();
        expect(result.content).toContain('flowchart TD');
      });

      it('should sanitize node IDs for Mermaid', () => {
        const result = exportToMermaid(mockReactFlowOutput);

        expect(result.success).toBe(true);
        expect(result.content).toContain('llm_node');
        expect(result.content).not.toContain('llm-node');
      });

      it('should include conditional edge styling', () => {
        const result = exportToMermaid(mockReactFlowOutput);

        expect(result.success).toBe(true);
        expect(result.content).toContain('-.->');
      });

      it('should include theme-based styling', () => {
        const result = exportToMermaid(mockReactFlowOutput, {
          theme: professionalTheme,
        });

        expect(result.success).toBe(true);
        expect(result.content).toContain('classDef');
        expect(result.content).toContain('class ');
      });
    });

    describe('DOT Export', () => {
      it('should export to DOT format', () => {
        const result = exportToDOT(mockReactFlowOutput);

        expect(result.success).toBe(true);
        expect(result.format).toBe('dot');
        expect(result.content).toBeDefined();
        expect(result.content).toContain('digraph flowsh_workflow {');
        expect(result.content).toContain('rankdir=TD;');
      });

      it('should sanitize node IDs for DOT', () => {
        const result = exportToDOT(mockReactFlowOutput);

        expect(result.success).toBe(true);
        expect(result.content).toContain('llm_node');
        expect(result.content).not.toContain('llm-node');
      });

      it('should apply theme colors to DOT output', () => {
        const result = exportToDOT(mockReactFlowOutput, {
          theme: professionalTheme,
        });

        expect(result.success).toBe(true);
        expect(result.content).toContain(professionalTheme.colors.background);
      });

      it('should use different shapes for different node types', () => {
        const result = exportToDOT(mockReactFlowOutput, { theme: defaultTheme });

        expect(result.success).toBe(true);
        expect(result.content).toContain('shape=ellipse'); // start/end nodes
        expect(result.content).toContain('shape=box'); // llm node
      });
    });

    describe('Universal Export Function', () => {
      it('should export to all supported formats', () => {
        const formats: ExportFormat[] = ['json', 'svg', 'mermaid', 'dot'];

        formats.forEach(format => {
          const result = exportVisualization(mockReactFlowOutput, format);
          expect(result.success).toBe(true);
          expect(result.format).toBe(format);
          expect(result.content).toBeDefined();
        });
      });

      it('should handle unsupported formats gracefully', () => {
        const result = exportVisualization(mockReactFlowOutput, 'unsupported' as ExportFormat);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unsupported export format');
      });

      it('should pass options to format handlers', () => {
        const result = exportVisualization(mockReactFlowOutput, 'json', {
          pretty: true,
          theme: professionalTheme,
        });

        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.content!);
        expect(parsed.metadata.theme).toBe('professional');
      });
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle empty workflows', () => {
      const emptyWorkflow: ReactFlowOutput = {
        ...mockReactFlowOutput,
        nodes: [],
        edges: [],
      };

      const formats: ExportFormat[] = ['json', 'svg', 'mermaid', 'dot'];

      formats.forEach(format => {
        const result = exportVisualization(emptyWorkflow, format);
        expect(result.success).toBe(true);
      });
    });

    it('should handle large workflows efficiently', () => {
      // Create a large workflow
      const largeWorkflow: ReactFlowOutput = {
        ...mockReactFlowOutput,
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          type: 'llm',
          position: { x: i * 50, y: i * 30 },
          width: 120,
          height: 40,
          data: {
            label: `Node ${i}`,
            nodeType: 'llm',
            title: `Processing Node ${i}`,
            validationStatus: { isValid: true, errors: [], warnings: [] },
            executionStatus: 'pending',
            originalData: {},
          },
        })),
        edges: Array.from({ length: 99 }, (_, i) => ({
          id: `edge-${i}`,
          source: `node-${i}`,
          target: `node-${i + 1}`,
        })),
      };

      const start = Date.now();
      const result = exportVisualization(largeWorkflow, 'json');
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Large workflow export completed in ${duration}ms`);
    });

    it('should handle invalid data gracefully', () => {
      const invalidWorkflow = {
        ...mockReactFlowOutput,
        nodes: null as any,
      };

      const result = exportVisualization(invalidWorkflow, 'json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
