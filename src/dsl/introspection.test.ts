/**
 * Tests for DSL Introspection functionality
 */
import {
  DSLIntrospector,
  ROOT_ENTITIES,
  GRAPH_COMPONENTS,
  EDGE_PROPERTIES,
  VARIABLE_TYPE_DESCRIPTIONS,
  NODE_DESCRIPTIONS,
  SUPPORTING_TYPES,
} from './introspection.js';
import { NodeGeneratorRegistry } from '../generation/registry/node-generator-registry.js';
import { createDefaultRegistry } from '../generation/generators/index.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DSLIntrospector', () => {
  let registry: NodeGeneratorRegistry;
  let introspector: DSLIntrospector;

  beforeEach(() => {
    registry = createDefaultRegistry();
    introspector = new DSLIntrospector(registry);
  });

  describe('getOverview()', () => {
    it('should return complete DSL structure overview', () => {
      const overview = introspector.getOverview();

      expect(overview).toBeDefined();
      expect(overview.version).toBe('2.0.0-complete');
      expect(overview.supported_formats).toEqual(['text', 'json']);
      expect(overview.next_commands).toEqual([
        'flowsh dsl <node-type>',
        'flowsh dsl --format json',
      ]);
    });

    it('should include all root entities', () => {
      const overview = introspector.getOverview();
      const rootEntityNames = overview.dsl_structure.root_entities.map(e => e.name);

      expect(rootEntityNames).toContain('version');
      expect(rootEntityNames).toContain('kind');
      expect(rootEntityNames).toContain('metadata');
      expect(rootEntityNames).toContain('workflow');
      expect(rootEntityNames).toContain('environment_variables');
      expect(rootEntityNames).toContain('conversation_variables');
      expect(rootEntityNames).toContain('graph');
      expect(rootEntityNames).toContain('spec');
    });

    it('should include correct graph components', () => {
      const overview = introspector.getOverview();
      const components = overview.dsl_structure.graph_components;

      expect(components).toHaveLength(2);
      expect(components.find(c => c.name === 'nodes')).toBeDefined();
      expect(components.find(c => c.name === 'edges')).toBeDefined();
    });

    it('should include all edge properties', () => {
      const overview = introspector.getOverview();
      const edgeProps = overview.dsl_structure.edge_properties.map(p => p.name);

      expect(edgeProps).toContain('source');
      expect(edgeProps).toContain('target');
      expect(edgeProps).toContain('sourceHandle');
      expect(edgeProps).toContain('targetHandle');
      expect(edgeProps).toContain('condition');
      expect(edgeProps).toContain('label');
    });

    it('should include all variable types', () => {
      const overview = introspector.getOverview();
      const varTypes = overview.dsl_structure.variable_types.map(v => v.type);

      expect(varTypes).toContain('text');
      expect(varTypes).toContain('text-input');
      expect(varTypes).toContain('select');
      expect(varTypes).toContain('number');
      expect(varTypes).toContain('boolean');
      expect(varTypes).toContain('object');
      expect(varTypes).toContain('array');
    });

    it('should discover all registered node types', () => {
      const overview = introspector.getOverview();
      const nodeTypes = overview.dsl_structure.node_types.map(n => n.nodeType);

      // Should include all expected node types
      expect(nodeTypes).toContain('start');
      expect(nodeTypes).toContain('end');
      expect(nodeTypes).toContain('llm');
      expect(nodeTypes).toContain('if-else');
      expect(nodeTypes).toContain('variable-assignment');
      expect(nodeTypes).toContain('code');
      expect(nodeTypes).toContain('agent');
      expect(nodeTypes).toContain('loop');
      expect(nodeTypes).toContain('iteration');
      expect(nodeTypes).toContain('parallel-iteration');
      expect(nodeTypes).toContain('retry');
      expect(nodeTypes).toContain('fallback');
      expect(nodeTypes).toContain('circuit-breaker');
      expect(nodeTypes).toContain('telegram');
      expect(nodeTypes).toContain('answer');
    });

    it('should include supporting types', () => {
      const overview = introspector.getOverview();
      const supportingTypes = overview.dsl_structure.supporting_types;

      const modelProvider = supportingTypes.find(s => s.name === 'ModelProvider');
      expect(modelProvider).toBeDefined();
      expect(modelProvider?.values).toEqual(['openai', 'anthropic', 'google', 'local']);

      const templateSource = supportingTypes.find(s => s.name === 'TemplateSource');
      expect(templateSource).toBeDefined();
      expect(templateSource?.values).toEqual([
        'library',
        'customized',
        'built-in',
        'inline',
        'file',
      ]);
    });

    it('should have correct totals', () => {
      const overview = introspector.getOverview();
      const totals = overview.dsl_structure.totals;

      expect(totals.node_types).toBe(registry.getSupportedTypes().length);
      expect(totals.variable_types).toBe(Object.keys(VARIABLE_TYPE_DESCRIPTIONS).length);
      expect(totals.edge_properties).toBe(Object.keys(EDGE_PROPERTIES).length);
      expect(totals.root_entities).toBe(Object.keys(ROOT_ENTITIES).length);
    });
  });

  describe('formatAsText()', () => {
    it('should format overview as human-readable text', () => {
      const overview = introspector.getOverview();
      const text = introspector.formatAsText(overview);

      expect(text).toContain('flowsh DSL Reference - Complete Schema Overview');
      expect(text).toContain('ROOT STRUCTURE:');
      expect(text).toContain('GRAPH COMPONENTS:');
      expect(text).toContain('EDGE PROPERTIES:');
      expect(text).toContain('VARIABLE TYPES');
      expect(text).toContain('NODE TYPES');
      expect(text).toContain('SUPPORTING TYPES:');
      expect(text).toContain('Usage:');
      expect(text).toContain('Examples:');
    });

    it('should include node type descriptions', () => {
      const overview = introspector.getOverview();
      const text = introspector.formatAsText(overview);

      expect(text).toContain('Start node - workflow entry point');
      expect(text).toContain('LLM node - AI model API integration');
      expect(text).toContain('Conditional branching with comparison operators');
    });

    it('should include variable type descriptions', () => {
      const overview = introspector.getOverview();
      const text = introspector.formatAsText(overview);

      expect(text).toContain('Text input with optional length limits');
      expect(text).toContain('Single-choice selection from options');
      expect(text).toContain('True/false values');
    });
  });

  describe('formatAsJSON()', () => {
    it('should format overview as valid JSON', () => {
      const overview = introspector.getOverview();
      const jsonString = introspector.formatAsJSON(overview);

      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(parsed.version).toBe('2.0.0-complete');
      expect(parsed.dsl_structure).toBeDefined();
      expect(parsed.supported_formats).toEqual(['text', 'json']);
    });

    it('should include all structure information in JSON', () => {
      const overview = introspector.getOverview();
      const jsonString = introspector.formatAsJSON(overview);
      const parsed = JSON.parse(jsonString);

      expect(parsed.dsl_structure.root_entities).toBeDefined();
      expect(parsed.dsl_structure.graph_components).toBeDefined();
      expect(parsed.dsl_structure.edge_properties).toBeDefined();
      expect(parsed.dsl_structure.variable_types).toBeDefined();
      expect(parsed.dsl_structure.node_types).toBeDefined();
      expect(parsed.dsl_structure.supporting_types).toBeDefined();
      expect(parsed.dsl_structure.totals).toBeDefined();
    });
  });
});

describe('DSL Constants', () => {
  it('should have comprehensive root entities', () => {
    expect(ROOT_ENTITIES.version).toBe('Workflow schema version');
    expect(ROOT_ENTITIES.kind).toBe('Workflow type identifier');
    expect(ROOT_ENTITIES.graph).toBe('Workflow execution graph');
  });

  it('should have correct graph components', () => {
    expect(GRAPH_COMPONENTS.nodes).toBe('Array of workflow nodes');
    expect(GRAPH_COMPONENTS.edges).toBe('Array of workflow edges (node connections)');
  });

  it('should have complete edge properties', () => {
    expect(EDGE_PROPERTIES.source).toBe('Source node ID (required)');
    expect(EDGE_PROPERTIES.target).toBe('Target node ID (required)');
    expect(EDGE_PROPERTIES.condition).toBe('Conditional routing (for if-else nodes)');
  });

  it('should have all variable type descriptions', () => {
    expect(VARIABLE_TYPE_DESCRIPTIONS.text).toBe('Text input with optional length limits');
    expect(VARIABLE_TYPE_DESCRIPTIONS.select).toBe('Single-choice selection from options');
    expect(VARIABLE_TYPE_DESCRIPTIONS.boolean).toBe('True/false values');
  });

  it('should have node descriptions for all types', () => {
    expect(NODE_DESCRIPTIONS.start).toBe('Start node - workflow entry point');
    expect(NODE_DESCRIPTIONS.llm).toBe('LLM node - AI model API integration');
    expect(NODE_DESCRIPTIONS['if-else']).toBe('Conditional branching with comparison operators');
  });

  it('should have supporting type definitions', () => {
    expect(SUPPORTING_TYPES.ModelProvider.values).toEqual([
      'openai',
      'anthropic',
      'google',
      'local',
    ]);
    expect(SUPPORTING_TYPES.TemplateSource.values).toEqual([
      'library',
      'customized',
      'built-in',
      'inline',
      'file',
    ]);
  });
});
