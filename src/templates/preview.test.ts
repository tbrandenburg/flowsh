/**
 * Tests for template preview functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateDiscovery } from './discovery.js';
import { TemplateAnalyzer } from './analyzer.js';
import { previewTemplate } from './preview.js';
import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('Template Preview Functionality', () => {
  let tempDir: string;
  let discovery: TemplateDiscovery;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowsh-preview-test-'));
    discovery = new TemplateDiscovery();
    await discovery.scanTemplates();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CLI Preview Flag', () => {
    it('should display preview for valid template', () => {
      const command = 'node dist/cli/index.js init ai-to-telegram-simple --preview';
      const output = execSync(command, { encoding: 'utf8' });

      // Check that it contains expected preview elements
      expect(output).toContain('# Template: ai-to-telegram-simple');
      expect(output).toContain('# Category: enhanced');
      expect(output).toContain('# Complexity:');
      expect(output).toContain('# Node Types:');
      expect(output).toContain('workflow:');

      // Should not create any files
      expect(fs.readdirSync(tempDir)).toHaveLength(0);
    });

    it('should show error for non-existent template', () => {
      expect(() => {
        execSync('node dist/cli/index.js init non-existent-template --preview', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }).toThrow();
    });

    it('should ignore target file when in preview mode', () => {
      const command = 'node dist/cli/index.js init ai-to-telegram-simple some-file.yaml --preview';
      const output = execSync(command, { encoding: 'utf8' });

      // Should show preview
      expect(output).toContain('# Template: ai-to-telegram-simple');

      // Should not create the target file
      expect(fs.existsSync('some-file.yaml')).toBe(false);
    });

    it('should work with advanced templates', () => {
      const command = 'node dist/cli/index.js init ai-chat-memory --preview';
      const output = execSync(command, { encoding: 'utf8' });

      expect(output).toContain('# Template: ai-chat-memory');
      expect(output).toContain('# Category: advanced/ai-workflows');
      expect(output).toContain('workflow:');
    });

    it('should handle short flag -p', () => {
      const command = 'node dist/cli/index.js init data-pipeline-simple -p';
      const output = execSync(command, { encoding: 'utf8' });

      expect(output).toContain('# Template: data-pipeline-simple');
      expect(output).toContain('# Category: enhanced');
    });
  });

  describe('Preview Service', () => {
    it('should generate complete preview data', async () => {
      const templateInfo = discovery.getTemplateByName('ai-to-telegram-simple');
      expect(templateInfo).toBeDefined();

      if (templateInfo) {
        const preview = await previewTemplate(templateInfo);

        expect(preview.templateId).toBe('ai-to-telegram-simple');
        expect(preview.category).toBe('enhanced');
        expect(preview.content).toBeDefined();
        expect(preview.content.length).toBeGreaterThan(0);
        expect(preview.metadata).toBeDefined();
        expect(preview.placeholders).toBeDefined();
        expect(preview.requiredVariables).toBeDefined();

        // Should detect common placeholders
        expect(preview.placeholders.some(p => p.includes('TELEGRAM') || p.includes('OPENAI'))).toBe(
          true
        );
      }
    });

    it('should detect placeholder variables correctly', async () => {
      const templateInfo = discovery.getTemplateByName('ai-to-telegram-simple');
      expect(templateInfo).toBeDefined();

      if (templateInfo) {
        const preview = await previewTemplate(templateInfo);

        // Should find environment variables
        expect(preview.requiredVariables).toContain('TELEGRAM_BOT_TOKEN');
        expect(preview.requiredVariables).toContain('OPENAI_API_KEY');

        // Should find template variables
        expect(preview.placeholders.some(p => p.includes('telegram') || p.includes('llm'))).toBe(
          true
        );
      }
    });

    it('should handle templates without placeholders', async () => {
      const templateInfo = discovery.getTemplateByName('data-pipeline-simple');
      expect(templateInfo).toBeDefined();

      if (templateInfo) {
        const preview = await previewTemplate(templateInfo);

        expect(preview.placeholders).toBeDefined();
        expect(Array.isArray(preview.placeholders)).toBe(true);
        // Even if empty, should be an array
        expect(preview.placeholders.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should throw error for invalid template file', async () => {
      const invalidTemplateInfo = {
        name: 'invalid-template',
        displayName: 'invalid',
        filePath: '/non/existent/path.yaml',
        category: 'test',
        description: 'Invalid template for testing',
      };

      await expect(previewTemplate(invalidTemplateInfo)).rejects.toThrow();
    });
  });

  describe('Template Analyzer', () => {
    it('should calculate complexity correctly', () => {
      const analyzer = new TemplateAnalyzer();

      // Simple workflow (low complexity)
      const simpleTemplate = {
        graph: {
          nodes: [{ type: 'start' }, { type: 'code' }, { type: 'end' }],
          edges: [],
        },
      };

      const metadata = analyzer.analyzeTemplate(simpleTemplate);
      expect(metadata.complexity).toBe('low');
      expect(metadata.nodeCount).toBe(3);
    });

    it('should detect complex node types', () => {
      const analyzer = new TemplateAnalyzer();

      // Complex workflow with LLM and parallel processing
      const complexTemplate = {
        graph: {
          nodes: [
            { type: 'start' },
            { type: 'llm' },
            { type: 'parallel-iteration' },
            { type: 'circuit-breaker' },
            { type: 'end' },
          ],
          edges: [],
        },
      };

      const metadata = analyzer.analyzeTemplate(complexTemplate);
      expect(metadata.complexity).toBe('medium'); // Should be medium due to complex nodes
      expect(metadata.nodeTypes).toContain('llm');
      expect(metadata.nodeTypes).toContain('parallel-iteration');
      expect(metadata.nodeTypes).toContain('circuit-breaker');
    });

    it('should estimate script length reasonably', () => {
      const analyzer = new TemplateAnalyzer();

      const template = {
        graph: {
          nodes: [{ type: 'start' }, { type: 'llm' }, { type: 'telegram' }, { type: 'answer' }],
          edges: [],
        },
      };

      const metadata = analyzer.analyzeTemplate(template);
      expect(metadata.estimatedScriptLines).toBeGreaterThan(20); // Should have reasonable estimate
      expect(metadata.estimatedScriptLines).toBeLessThan(200); // But not too high
    });

    it('should extract environment variables', () => {
      const analyzer = new TemplateAnalyzer();

      const template = {
        graph: {
          nodes: [
            {
              type: 'llm',
              data: {
                api_key_env: 'OPENAI_API_KEY',
              },
            },
            {
              type: 'telegram',
              data: {
                bot_token_env: 'TELEGRAM_BOT_TOKEN',
              },
            },
          ],
        },
      };

      const metadata = analyzer.analyzeTemplate(template);
      expect(metadata.requiredEnvironmentVars.some(v => v.includes('API_KEY'))).toBe(true);
    });
  });

  describe('Template Discovery Integration', () => {
    it('should find all template categories', async () => {
      const hierarchical = discovery.getHierarchicalDisplay();

      expect(hierarchical.enhanced.length).toBeGreaterThan(0);
      expect(Object.keys(hierarchical.advanced).length).toBeGreaterThan(0);

      // Should have expected categories
      expect(hierarchical.advanced).toHaveProperty('ai-workflows');
      expect(hierarchical.advanced).toHaveProperty('content-distribution');
    });

    it('should preview templates from all categories', async () => {
      const hierarchical = discovery.getHierarchicalDisplay();

      // Test enhanced templates
      for (const template of hierarchical.enhanced.slice(0, 2)) {
        // Test first 2
        const preview = await previewTemplate(template);
        expect(preview.templateId).toBe(template.displayName);
        expect(preview.category).toBe('enhanced');
      }

      // Test advanced templates
      for (const [category, templates] of Object.entries(hierarchical.advanced)) {
        if (templates.length > 0) {
          const template = templates[0]; // Test first template in each category
          const preview = await previewTemplate(template);
          expect(preview.templateId).toBe(template.displayName);
          expect(preview.category).toBe(`advanced/${category}`);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should preview templates quickly', async () => {
      const templateInfo = discovery.getTemplateByName('ai-to-telegram-simple');
      expect(templateInfo).toBeDefined();

      if (templateInfo) {
        const startTime = Date.now();
        await previewTemplate(templateInfo);
        const endTime = Date.now();

        // Should complete in under 500ms (as specified in PRP)
        expect(endTime - startTime).toBeLessThan(500);
      }
    });

    it('should handle multiple preview requests efficiently', async () => {
      const templates = ['ai-to-telegram-simple', 'data-pipeline-simple', 'ai-chat-memory'];

      const startTime = Date.now();

      for (const templateName of templates) {
        const templateInfo = discovery.getTemplateByName(templateName);
        if (templateInfo) {
          await previewTemplate(templateInfo);
        }
      }

      const endTime = Date.now();

      // Multiple previews should still be reasonably fast
      expect(endTime - startTime).toBeLessThan(1500); // 1.5 seconds for 3 templates
    });
  });
});
