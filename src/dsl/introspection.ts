/**
 * DSL Introspection System
 *
 * Provides complete DSL structure discovery for the flowsh workflow definition language.
 * Extracts schema information from TypeScript interfaces and registry system.
 */

import {
  DSLTypeSchemaExtractor,
  type NodeDetailInfo,
  type PropertyInfo,
} from './type-schema-mapping.js';
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
  private schemaExtractor: DSLTypeSchemaExtractor;

  constructor(private registry: NodeGeneratorRegistry) {
    this.schemaExtractor = new DSLTypeSchemaExtractor();
  }

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
   * Get detailed node information including complete schema
   */
  getNodeDetail(nodeType: string): NodeDetailInfo {
    if (!this.registry.has(nodeType)) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }

    const properties = this.schemaExtractor.extractSchema(nodeType);
    const required = properties.filter(p => p.required).map(p => p.name);

    // Create properties object for schema
    const schemaProperties: Record<string, PropertyInfo> = {};
    properties.forEach(prop => {
      schemaProperties[prop.name] = prop;
    });

    return {
      nodeType,
      description: this.getNodeDescription(nodeType),
      category: this.getNodeCategory(nodeType),
      implemented: true,
      generator: this.getGeneratorName(nodeType),
      schema: {
        type: 'object',
        required,
        properties: schemaProperties,
      },
      templateVariables: {
        supported: ['{{variable}}', '{{#path.to.value#}}', '${variable}'],
        extraction: 'automatic',
      },
      shellGeneration: {
        features: this.getShellGenerationFeatures(nodeType),
      },
      relatedCommands: [
        `flowsh dsl ${nodeType} --format json`,
        'flowsh dsl',
        'flowsh compile workflow.yaml',
      ],
    };
  }

  /**
   * Format detailed node information as human-readable text
   */
  formatNodeAsText(detail: NodeDetailInfo): string {
    let output = `${detail.nodeType.toUpperCase()} Node - ${detail.description}\n\n`;

    // Description
    output += 'DESCRIPTION:\n';
    output += `  ${this.getDetailedNodeDescription(detail.nodeType)}\n\n`;

    // Required properties
    const required = Object.entries(detail.schema.properties).filter(([_, prop]) => prop.required);
    if (required.length > 0) {
      output += 'REQUIRED PROPERTIES:\n';
      required.forEach(([name, prop]) => {
        output += this.formatPropertyTree(name, prop, '  ');
      });
      output += '\n';
    }

    // Optional properties
    const optional = Object.entries(detail.schema.properties).filter(([_, prop]) => !prop.required);
    if (optional.length > 0) {
      output += 'OPTIONAL PROPERTIES:\n';
      optional.forEach(([name, prop]) => {
        output += this.formatPropertyTree(name, prop, '  ');
      });
      output += '\n';
    }

    // Template variables
    output += 'TEMPLATE VARIABLES:\n';
    output += `  Supports ${detail.templateVariables.supported.join(', ')} syntax\n`;
    output += `  Variables automatically extracted and validated\n\n`;

    // Shell generation
    output += 'SHELL GENERATION:\n';
    output += '  Generates secure shell script with:\n';
    detail.shellGeneration.features.forEach(feature => {
      output += `  - ${feature}\n`;
    });
    output += '\n';

    // Related commands
    output += 'MORE COMMANDS:\n';
    detail.relatedCommands.forEach(cmd => {
      output += `  ${cmd.padEnd(35)} ${this.getCommandDescription(cmd)}\n`;
    });

    return output;
  }

  /**
   * Format detailed node information as JSON
   */
  formatNodeAsJSON(detail: NodeDetailInfo): string {
    return JSON.stringify(detail, null, 2);
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

  private getNodeDescription(nodeType: string): string {
    return NODE_DESCRIPTIONS[nodeType] || `${nodeType} node`;
  }

  private getNodeCategory(nodeType: string): string {
    // Categorize nodes based on type
    if (['start', 'end', 'answer'].includes(nodeType)) return 'workflow';
    if (['llm'].includes(nodeType)) return 'ai';
    if (['code', 'agent'].includes(nodeType)) return 'execution';
    if (['if-else', 'loop', 'iteration', 'parallel-iteration'].includes(nodeType)) return 'control';
    if (['variable-assignment', 'variable-aggregation', 'template-transform'].includes(nodeType))
      return 'data';
    if (['http-request', 'telegram'].includes(nodeType)) return 'network';
    if (['retry', 'fallback', 'circuit-breaker'].includes(nodeType)) return 'reliability';
    if (['sub-workflow'].includes(nodeType)) return 'composition';
    return 'misc';
  }

  private getDetailedNodeDescription(nodeType: string): string {
    const descriptions: Record<string, string> = {
      llm: 'Execute AI model calls via API with prompt templates, context management, and memory support. Supports OpenAI, Anthropic, Google, and local models.',
      'http-request':
        'Make HTTP API calls with authentication, request/response handling, retry logic, and error handling. Supports all standard HTTP methods.',
      'circuit-breaker':
        'Implement circuit breaker pattern to prevent cascading failures by monitoring operation success/failure rates and temporarily blocking requests when failure threshold is reached.',
      code: 'Execute shell commands with environment variable support, timeout handling, and conditional routing based on success/failure.',
      telegram:
        'Send messages to Telegram chats using bot API with support for different parse modes, retry logic, and error handling.',
      'if-else':
        'Conditional branching based on variable comparisons using various operators (equality, inequality, contains, empty checks).',
      'variable-assignment':
        'Assign values to workflow variables using constants, other variables, or mathematical expressions with different write modes.',
      'variable-aggregation':
        'Combine multiple variables into a single result using various aggregation methods (concat, sum, average, merge).',
      'template-transform':
        'Transform data using template substitution with support for various template sources and parameter injection.',
      loop: 'Repeat execution of connected nodes based on conditional logic with configurable iteration limits and break conditions.',
      iteration:
        'Process arrays or lists sequentially or in parallel with support for result collection and error handling.',
      'parallel-iteration':
        'Process arrays concurrently with configurable parallelism, chunk processing, and comprehensive progress tracking.',
      retry:
        'Automatically retry failed operations with exponential backoff, configurable conditions, and timeout handling.',
      fallback:
        'Implement fallback execution paths when primary operations fail, supporting sequential or parallel fallback strategies.',
      'sub-workflow':
        'Execute other workflow files as sub-processes with input/output variable mapping and isolated execution context.',
      start: 'Define workflow entry point with input variable definitions and validation.',
      end: 'Define workflow completion point with output variable definitions.',
      answer:
        'Provide final workflow results in various formats (text, JSON, markdown) with variable substitution.',
      agent:
        'Orchestrate CLI tools and external commands with template-based parameter injection and environment configuration.',
    };
    return (
      descriptions[nodeType] || NODE_DESCRIPTIONS[nodeType] || `${nodeType} node functionality`
    );
  }

  private getShellGenerationFeatures(nodeType: string): string[] {
    const commonFeatures = [
      'Error handling and exit codes',
      'Variable substitution and validation',
    ];

    const specificFeatures: Record<string, string[]> = {
      llm: [
        'API authentication handling',
        'JSON request/response processing',
        'Error handling and retries',
        'Variable substitution and validation',
      ],
      'http-request': [
        'HTTP client with auth support',
        'Request/response handling',
        'Retry logic with backoff',
        'Error handling and validation',
      ],
      telegram: [
        'Telegram Bot API integration',
        'Message formatting and parsing',
        'Retry logic for network errors',
        'Error handling and validation',
      ],
      'circuit-breaker': [
        'Failure rate monitoring',
        'Circuit state management',
        'Request blocking logic',
        'Recovery mechanisms',
      ],
      code: [
        'Shell command execution',
        'Environment variable handling',
        'Timeout management',
        'Success/failure routing',
      ],
      agent: [
        'CLI tool orchestration',
        'Template parameter injection',
        'Environment configuration',
        'Command execution',
      ],
      'if-else': [
        'Condition evaluation',
        'Comparison operations',
        'Logical operators (and/or)',
        'Conditional routing',
      ],
      'variable-assignment': [
        'Variable assignment operations',
        'Expression evaluation',
        'Write mode handling',
        'Type conversion',
      ],
      'variable-aggregation': [
        'Multi-variable aggregation',
        'Different aggregation methods',
        'Result formatting',
        'Error handling',
      ],
      'template-transform': [
        'Template processing',
        'Parameter substitution',
        'Output variable assignment',
        'Template validation',
      ],
      loop: [
        'Loop condition evaluation',
        'Iteration counting',
        'Break condition handling',
        'Infinite loop protection',
      ],
      iteration: [
        'Array processing',
        'Sequential/parallel execution',
        'Result collection',
        'Error handling per item',
      ],
      'parallel-iteration': [
        'Concurrent processing',
        'Resource management',
        'Progress tracking',
        'Error aggregation',
      ],
      retry: [
        'Exponential backoff logic',
        'Retry condition evaluation',
        'Timeout handling',
        'Attempt counting',
      ],
      fallback: [
        'Fallback path execution',
        'Strategy implementation',
        'Success detection',
        'Time limit management',
      ],
      'sub-workflow': [
        'Sub-process execution',
        'Variable mapping',
        'Isolated context',
        'Result integration',
      ],
      start: [
        'Input variable collection',
        'Variable validation',
        'Workflow initialization',
        'Parameter parsing',
      ],
      end: ['Output formatting', 'Result validation', 'Workflow completion', 'Exit code setting'],
      answer: [
        'Result formatting',
        'Variable substitution',
        'Output type handling',
        'Final result display',
      ],
    };

    return specificFeatures[nodeType] || commonFeatures;
  }

  private formatPropertyTree(name: string, prop: PropertyInfo, indent: string): string {
    let output = '';
    const typeStr = Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type;
    const requiredMarker = prop.required ? '' : '(optional)';

    output += `${indent}${name.padEnd(20)} ${typeStr.padEnd(10)} ${prop.description} ${requiredMarker}\n`;

    // Add enum values
    if (prop.enum && prop.enum.length > 0) {
      output += `${indent}  └── Values: ${prop.enum.join(' | ')}\n`;
    }

    // Add default value
    if (prop.default !== undefined) {
      output += `${indent}  └── Default: ${prop.default}\n`;
    }

    // Add examples
    if (prop.examples && prop.examples.length > 0) {
      output += `${indent}  └── Examples: ${prop.examples.join(', ')}\n`;
    }

    // Add nested properties
    if (prop.properties && prop.properties.length > 0) {
      prop.properties.forEach((subProp, index) => {
        const isLast = index === prop.properties!.length - 1;
        const subIndent = `${indent}  ${isLast ? '└──' : '├──'} `;
        output += this.formatPropertyTree(subProp.name, subProp, subIndent);
      });
    }

    return output;
  }

  private getCommandDescription(cmd: string): string {
    if (cmd.includes('--format json')) return 'Get machine-readable schema';
    if (cmd === 'flowsh dsl') return 'Show all available node types';
    if (cmd.includes('flowsh compile')) return 'Compile workflow to shell script';
    return 'Related command';
  }
}
