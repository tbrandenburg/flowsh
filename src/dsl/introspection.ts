/**
 * DSL Introspection System
 *
 * Provides complete DSL structure discovery for the flowsh workflow definition language.
 * Extracts schema information from TypeScript interfaces and registry system.
 */

import { NodeGeneratorRegistry } from '../generation/registry/node-generator-registry.js';
// Import types for reference only - actual values come from constants

// =============================================================================
// DSL Entity Interfaces
// =============================================================================

export interface DSLEntity {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  optional?: boolean;
}

export interface NodeTypeInfo {
  nodeType: string;
  description: string;
  implemented: boolean;
  generator: string;
}

export interface DSLStructureInfo {
  root_entities: DSLEntity[];
  graph_components: DSLEntity[];
  edge_properties: DSLEntity[];
  variable_types: Array<{ type: string; description: string }>;
  node_types: NodeTypeInfo[];
  supporting_types: Array<{ name: string; values: string[]; description: string }>;
  totals: {
    node_types: number;
    variable_types: number;
    edge_properties: number;
    root_entities: number;
  };
}

export interface DSLOverview {
  version: string;
  dsl_structure: DSLStructureInfo;
  supported_formats: string[];
  next_commands: string[];
}

// =============================================================================
// DSL Structure Constants
// =============================================================================

// Root-level workflow structure entities
export const ROOT_ENTITIES: Record<string, string> = {
  version: 'Workflow schema version',
  kind: 'Workflow type identifier',
  metadata: 'Workflow metadata (name, description, labels, etc.)',
  workflow: 'Workflow definition metadata',
  environment_variables: 'Environment variable definitions',
  conversation_variables: 'Conversation variable definitions',
  graph: 'Workflow execution graph',
  spec: 'Alternative specification structure',
} as const;

// Graph component entities
export const GRAPH_COMPONENTS: Record<string, string> = {
  nodes: 'Array of workflow nodes',
  edges: 'Array of workflow edges (node connections)',
} as const;

// Edge property entities
export const EDGE_PROPERTIES: Record<string, string> = {
  source: 'Source node ID (required)',
  target: 'Target node ID (required)',
  sourceHandle: 'Source connection point (multi-output support)',
  targetHandle: 'Target connection point (multi-input support)',
  condition: 'Conditional routing (for if-else nodes)',
  label: 'Human-readable edge description',
} as const;

// Variable type entities
export const VARIABLE_TYPE_DESCRIPTIONS: Record<string, string> = {
  text: 'Text input with optional length limits',
  'text-input': 'Interactive text input',
  select: 'Single-choice selection from options',
  number: 'Numeric input with min/max constraints',
  boolean: 'True/false values',
  object: 'Nested object structures with properties',
  array: 'Array/list structures with item definitions',
} as const;

// Supporting type entities
export const SUPPORTING_TYPES: Record<string, { values: string[]; description: string }> = {
  ModelProvider: {
    values: ['openai', 'anthropic', 'google', 'local'],
    description: 'AI model providers',
  },
  TemplateSource: {
    values: ['library', 'customized', 'built-in', 'inline', 'file'],
    description: 'Template sources',
  },
} as const;

// Node type descriptions (preserving existing mapping)
export const NODE_DESCRIPTIONS: Record<string, string> = {
  start: 'Start node - workflow entry point',
  end: 'End node - workflow completion',
  answer: 'Answer node - output with result message',
  code: 'Code node - shell command execution',
  agent: 'Agent node - CLI tool orchestration',
  llm: 'LLM node - AI model API integration',
  'variable-assignment': 'Variable assignment with expressions',
  'variable-aggregation': 'Variable aggregation (concat, sum, merge)',
  'template-transform': 'Template transformation with substitution',
  'if-else': 'Conditional branching with comparison operators',
  loop: 'Conditional repetition with safety limits',
  iteration: 'Array/list processing (sequential/parallel)',
  'parallel-iteration': 'Concurrent iteration with batching',
  'http-request': 'HTTP API calls with auth and retry',
  telegram: 'Telegram bot messaging',
  'sub-workflow': 'Sub-workflow composition',
  retry: 'Retry with exponential backoff',
  fallback: 'Fallback execution paths',
  'circuit-breaker': 'Circuit breaker pattern',
} as const;

// =============================================================================
// DSL Introspector Class
// =============================================================================

export class DSLIntrospector {
  constructor(private registry: NodeGeneratorRegistry) {}

  /**
   * Get complete DSL overview with structure information
   */
  getOverview(): DSLOverview {
    const supportedNodeTypes = this.registry.getSupportedTypes();

    return {
      version: '2.0.0-complete',
      dsl_structure: {
        root_entities: this.extractRootEntities(),
        graph_components: this.extractGraphComponents(),
        edge_properties: this.extractEdgeProperties(),
        variable_types: this.extractVariableTypes(),
        node_types: this.extractNodeTypes(supportedNodeTypes),
        supporting_types: this.extractSupportingTypes(),
        totals: {
          node_types: supportedNodeTypes.length,
          variable_types: Object.keys(VARIABLE_TYPE_DESCRIPTIONS).length,
          edge_properties: Object.keys(EDGE_PROPERTIES).length,
          root_entities: Object.keys(ROOT_ENTITIES).length,
        },
      },
      supported_formats: ['text', 'json'],
      next_commands: ['flowsh dsl <node-type>', 'flowsh dsl --format json'],
    };
  }

  /**
   * Format DSL overview as human-readable text
   */
  formatAsText(overview: DSLOverview): string {
    const { dsl_structure } = overview;

    let output = 'flowsh DSL Reference - Complete Schema Overview\n\n';

    // Root structure
    output += 'ROOT STRUCTURE:\n';
    dsl_structure.root_entities.forEach(entity => {
      output += `  ${entity.name.padEnd(25)} ${entity.description}\n`;
    });
    output += '\n';

    // Graph components
    output += 'GRAPH COMPONENTS:\n';
    dsl_structure.graph_components.forEach(component => {
      output += `  ${component.name.padEnd(25)} ${component.description}\n`;
    });
    output += '\n';

    // Edge properties
    output += 'EDGE PROPERTIES:\n';
    dsl_structure.edge_properties.forEach(prop => {
      output += `  ${prop.name.padEnd(25)} ${prop.description}\n`;
    });
    output += '\n';

    // Variable types
    output += `VARIABLE TYPES (${dsl_structure.totals.variable_types} total):\n`;
    dsl_structure.variable_types.forEach(varType => {
      output += `  ${varType.type.padEnd(25)} ${varType.description}\n`;
    });
    output += '\n';

    // Node types
    output += `NODE TYPES (${dsl_structure.totals.node_types} total):\n`;
    dsl_structure.node_types.forEach(nodeType => {
      output += `  ${nodeType.nodeType.padEnd(25)} ${nodeType.description}\n`;
    });
    output += '\n';

    // Supporting types
    output += 'SUPPORTING TYPES:\n';
    dsl_structure.supporting_types.forEach(supportingType => {
      const values = supportingType.values.join(', ');
      output += `  ${supportingType.name.padEnd(25)} ${supportingType.description}\n`;
      output += `  ${' '.repeat(27)}Values: ${values}\n`;
    });
    output += '\n';

    // Usage and examples
    output += 'Usage:\n';
    output += '  flowsh dsl <node-type>           Show detailed node specification (Phase 2)\n';
    output += '  flowsh dsl --format json         Output in JSON format\n';
    output += '  flowsh dsl --help               Show this help\n';
    output += '\n';
    output += 'Examples:\n';
    output += '  flowsh dsl                      Show complete DSL structure overview\n';
    output += '  flowsh dsl --format json        Get machine-readable schema\n';

    return output;
  }

  /**
   * Format DSL overview as JSON
   */
  formatAsJSON(overview: DSLOverview): string {
    return JSON.stringify(overview, null, 2);
  }

  // =============================================================================
  // Private Extraction Methods
  // =============================================================================

  private extractRootEntities(): DSLEntity[] {
    return Object.entries(ROOT_ENTITIES).map(([name, description]) => ({
      name,
      description,
      type: this.inferTypeFromName(name),
      optional: true,
    }));
  }

  private extractGraphComponents(): DSLEntity[] {
    return Object.entries(GRAPH_COMPONENTS).map(([name, description]) => ({
      name,
      description,
      type: name === 'nodes' ? 'WorkflowNode[]' : 'WorkflowEdge[]',
      required: true,
    }));
  }

  private extractEdgeProperties(): DSLEntity[] {
    return Object.entries(EDGE_PROPERTIES).map(([name, description]) => ({
      name,
      description,
      type: 'string',
      required: name === 'source' || name === 'target',
      optional: name !== 'source' && name !== 'target',
    }));
  }

  private extractVariableTypes(): Array<{ type: string; description: string }> {
    return Object.entries(VARIABLE_TYPE_DESCRIPTIONS).map(([type, description]) => ({
      type,
      description,
    }));
  }

  private extractNodeTypes(supportedTypes: string[]): NodeTypeInfo[] {
    return supportedTypes.map(nodeType => ({
      nodeType,
      description: NODE_DESCRIPTIONS[nodeType] || `${nodeType} node`,
      implemented: true,
      generator: this.getGeneratorName(nodeType),
    }));
  }

  private extractSupportingTypes(): Array<{ name: string; values: string[]; description: string }> {
    return Object.entries(SUPPORTING_TYPES).map(([name, { values, description }]) => ({
      name,
      values,
      description,
    }));
  }

  private inferTypeFromName(name: string): string {
    switch (name) {
      case 'version':
      case 'kind':
        return 'string';
      case 'metadata':
        return 'WorkflowMetadata';
      case 'workflow':
        return 'object';
      case 'environment_variables':
        return 'WorkflowEnvironmentVariable[]';
      case 'conversation_variables':
        return 'WorkflowConversationVariable[]';
      case 'graph':
        return 'WorkflowGraph';
      case 'spec':
        return 'WorkflowSpec';
      default:
        return 'unknown';
    }
  }

  private getGeneratorName(nodeType: string): string {
    // Convert node type to generator class name following the pattern
    const parts = nodeType.split('-');
    const capitalizedParts = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1));
    return `${capitalizedParts.join('')}NodeGenerator`;
  }
}
