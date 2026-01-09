/**
 * Integration tests for DSL node detail exploration (PRP: Phase 2)
 */

import { createDefaultRegistry } from '../generation/generators/index.js';
import { DSLIntrospector } from './introspection.js';
import { describe, it, expect } from 'vitest';

describe('DSL Node Detail Exploration (PRP Phase 2)', () => {
  it('should provide detailed schema for LLM node', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    const detail = introspector.getNodeDetail('llm');

    expect(detail.nodeType).toBe('llm');
    expect(detail.description).toContain('LLM node');
    expect(detail.category).toBe('ai');
    expect(detail.implemented).toBe(true);
    expect(detail.generator).toBe('LlmNodeGenerator');

    // Check required properties
    expect(detail.schema.required).toContain('model');
    expect(detail.schema.properties.model.required).toBe(true);
    expect(detail.schema.properties.model.type).toBe('object');

    // Check optional properties
    expect(detail.schema.properties.prompt_template.required).toBe(false);
    expect(detail.schema.properties.template_parameters.required).toBe(false);

    // Check template variables
    expect(detail.templateVariables.supported).toContain('{{variable}}');
    expect(detail.templateVariables.supported).toContain('{{#path.to.value#}}');
    expect(detail.templateVariables.supported).toContain('${variable}');

    // Check shell generation features
    expect(detail.shellGeneration.features).toContain('API authentication handling');
    expect(detail.shellGeneration.features).toContain('JSON request/response processing');
  });

  it('should provide detailed schema for HTTP request node', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    const detail = introspector.getNodeDetail('http-request');

    expect(detail.nodeType).toBe('http-request');
    expect(detail.category).toBe('network');

    // Check required properties
    expect(detail.schema.required).toContain('url');
    expect(detail.schema.required).toContain('method');
    expect(detail.schema.properties.url.required).toBe(true);
    expect(detail.schema.properties.method.required).toBe(true);
    expect(detail.schema.properties.method.enum).toContain('GET');
    expect(detail.schema.properties.method.enum).toContain('POST');
  });

  it('should handle all 19+ node types without errors', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);
    const supportedTypes = registry.getSupportedTypes();

    expect(supportedTypes.length).toBeGreaterThanOrEqual(19);

    supportedTypes.forEach(nodeType => {
      expect(() => {
        const detail = introspector.getNodeDetail(nodeType);
        expect(detail.nodeType).toBe(nodeType);
        expect(detail.implemented).toBe(true);
        expect(detail.schema.type).toBe('object');
        expect(Array.isArray(detail.schema.required)).toBe(true);
        expect(typeof detail.schema.properties).toBe('object');
      }).not.toThrow(`Failed for node type: ${nodeType}`);
    });
  });

  it('should format node details as text correctly', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    const detail = introspector.getNodeDetail('llm');
    const textOutput = introspector.formatNodeAsText(detail);

    expect(textOutput).toContain('LLM Node -');
    expect(textOutput).toContain('DESCRIPTION:');
    expect(textOutput).toContain('REQUIRED PROPERTIES:');
    expect(textOutput).toContain('OPTIONAL PROPERTIES:');
    expect(textOutput).toContain('TEMPLATE VARIABLES:');
    expect(textOutput).toContain('SHELL GENERATION:');
    expect(textOutput).toContain('MORE COMMANDS:');
    expect(textOutput).toContain('model                object');
  });

  it('should format node details as JSON correctly', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    const detail = introspector.getNodeDetail('llm');
    const jsonOutput = introspector.formatNodeAsJSON(detail);

    const parsed = JSON.parse(jsonOutput);
    expect(parsed.nodeType).toBe('llm');
    expect(parsed.schema.type).toBe('object');
    expect(parsed.templateVariables.supported).toContain('{{variable}}');
    expect(parsed.shellGeneration.features).toContain('API authentication handling');
  });

  it('should throw error for unknown node type', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    expect(() => {
      introspector.getNodeDetail('unknown-node-type');
    }).toThrow('Unknown node type: unknown-node-type');
  });

  it('should categorize nodes correctly', () => {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    // Test categorization
    expect(introspector.getNodeDetail('llm').category).toBe('ai');
    expect(introspector.getNodeDetail('http-request').category).toBe('network');
    expect(introspector.getNodeDetail('code').category).toBe('execution');
    expect(introspector.getNodeDetail('if-else').category).toBe('control');
    expect(introspector.getNodeDetail('variable-assignment').category).toBe('data');
    expect(introspector.getNodeDetail('retry').category).toBe('reliability');
    expect(introspector.getNodeDetail('sub-workflow').category).toBe('composition');
    expect(introspector.getNodeDetail('start').category).toBe('workflow');
  });
});
