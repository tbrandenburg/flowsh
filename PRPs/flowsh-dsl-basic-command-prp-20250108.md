# PRP: Basic flowsh dsl Command Implementation

**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: Medium (2-3 days)  
**Created**: 2025-01-08

## Context

flowsh currently has three core commands (`init`, `compile`, `validate`) following Unix philosophy. Users and AI agents need a way to dynamically discover the complete DSL structure without reading source code or documentation. This PRP implements the foundational `flowsh dsl` command that shows the complete DSL schema including root entities, graph structure, node types, edges, and variable systems with human-readable output and JSON format support.

## Feature Specification

### Core Functionality

Implement a new CLI command `flowsh dsl` that:

- Shows the complete DSL structure including root entities, graph components, and variable systems
- Lists all 19 available node types dynamically from the registry
- Lists edge properties and connection capabilities
- Shows environment and conversation variable types
- Provides human-readable output by default (Unix philosophy)
- Supports `--format json` for AI agents and tooling
- Shows brief descriptions for each DSL component
- Maintains consistency with existing flowsh CLI patterns

### Command Interface

```bash
# Default: Human-readable overview
flowsh dsl

# JSON format for programmatic consumption
flowsh dsl --format json

# Help and usage
flowsh dsl --help
```

### Output Format Requirements

#### Human-Readable Default Output

```
flowsh DSL Reference - Complete Schema Overview

ROOT STRUCTURE:
  version                  Workflow schema version
  kind                     Workflow type identifier
  metadata                 Workflow metadata (name, description, labels, etc.)
  workflow                 Workflow definition metadata
  environment_variables    Environment variable definitions
  conversation_variables   Conversation variable definitions
  graph                   Workflow execution graph
  spec                    Alternative specification structure

GRAPH COMPONENTS:
  nodes                   Array of workflow nodes (19 types available)
  edges                   Array of workflow edges (node connections)

EDGE PROPERTIES:
  source                  Source node ID (required)
  target                  Target node ID (required)
  sourceHandle           Source connection point (multi-output support)
  targetHandle           Target connection point (multi-input support)
  condition              Conditional routing (for if-else nodes)
  label                  Human-readable edge description

VARIABLE TYPES (6 total):
  text                   Text input with optional length limits
  text-input             Interactive text input
  select                 Single-choice selection from options
  number                 Numeric input with min/max constraints
  boolean                True/false values
  object                 Nested object structures with properties
  array                  Array/list structures with item definitions

NODE TYPES (19 total):
  start                  Start node - workflow entry point
  end                    End node - workflow completion
  answer                 Answer node - output with result message
  code                   Code node - shell command execution
  agent                  Agent node - CLI tool orchestration
  llm                    LLM node - AI model API integration
  variable-assignment    Variable assignment with expressions
  variable-aggregation   Variable aggregation (concat, sum, merge)
  template-transform     Template transformation with substitution
  if-else               Conditional branching with comparison operators
  loop                  Conditional repetition with safety limits
  iteration             Array/list processing (sequential/parallel)
  parallel-iteration    Concurrent iteration with batching
  http-request          HTTP API calls with auth and retry
  telegram              Telegram bot messaging
  sub-workflow          Sub-workflow composition
  retry                 Retry with exponential backoff
  fallback              Fallback execution paths
  circuit-breaker       Circuit breaker pattern

SUPPORTING TYPES:
  ModelProvider         AI model providers (openai, anthropic, google, local)
  TemplateSource        Template sources (library, file, inline, etc.)

Usage:
  flowsh dsl <node-type>           Show detailed node specification (Phase 2)
  flowsh dsl --format json         Output in JSON format
  flowsh dsl --help               Show this help

Examples:
  flowsh dsl                      Show complete DSL structure overview
  flowsh dsl --format json        Get machine-readable schema
```

#### JSON Format Output

```json
{
  "version": "2.0.0-complete",
  "dsl_structure": {
    "root_entities": [
      {
        "name": "version",
        "description": "Workflow schema version",
        "type": "string",
        "optional": true
      },
      {
        "name": "kind",
        "description": "Workflow type identifier",
        "type": "string",
        "optional": true
      },
      {
        "name": "metadata",
        "description": "Workflow metadata (name, description, labels, etc.)",
        "type": "WorkflowMetadata",
        "optional": true
      },
      {
        "name": "workflow",
        "description": "Workflow definition metadata",
        "type": "object",
        "optional": true
      },
      {
        "name": "environment_variables",
        "description": "Environment variable definitions",
        "type": "WorkflowEnvironmentVariable[]",
        "optional": true
      },
      {
        "name": "conversation_variables",
        "description": "Conversation variable definitions",
        "type": "WorkflowConversationVariable[]",
        "optional": true
      },
      {
        "name": "graph",
        "description": "Workflow execution graph",
        "type": "WorkflowGraph",
        "optional": true
      },
      {
        "name": "spec",
        "description": "Alternative specification structure",
        "type": "WorkflowSpec",
        "optional": true
      }
    ],
    "graph_components": [
      {
        "name": "nodes",
        "description": "Array of workflow nodes",
        "type": "WorkflowNode[]",
        "required": true
      },
      {
        "name": "edges",
        "description": "Array of workflow edges (node connections)",
        "type": "WorkflowEdge[]",
        "required": true
      }
    ],
    "edge_properties": [
      {
        "name": "source",
        "description": "Source node ID",
        "type": "string",
        "required": true
      },
      {
        "name": "target",
        "description": "Target node ID",
        "type": "string",
        "required": true
      },
      {
        "name": "sourceHandle",
        "description": "Source connection point (multi-output support)",
        "type": "string",
        "optional": true
      },
      {
        "name": "targetHandle",
        "description": "Target connection point (multi-input support)",
        "type": "string",
        "optional": true
      },
      {
        "name": "condition",
        "description": "Conditional routing (for if-else nodes)",
        "type": "string",
        "optional": true
      },
      {
        "name": "label",
        "description": "Human-readable edge description",
        "type": "string",
        "optional": true
      }
    ],
    "variable_types": [
      {
        "type": "text",
        "description": "Text input with optional length limits"
      },
      {
        "type": "text-input",
        "description": "Interactive text input"
      },
      {
        "type": "select",
        "description": "Single-choice selection from options"
      },
      {
        "type": "number",
        "description": "Numeric input with min/max constraints"
      },
      {
        "type": "boolean",
        "description": "True/false values"
      },
      {
        "type": "object",
        "description": "Nested object structures with properties"
      },
      {
        "type": "array",
        "description": "Array/list structures with item definitions"
      }
    ],
    "node_types": [
      {
        "nodeType": "start",
        "description": "Start node - workflow entry point",
        "implemented": true,
        "generator": "StartNodeGenerator"
      },
      {
        "nodeType": "end",
        "description": "End node - workflow completion",
        "implemented": true,
        "generator": "EndNodeGenerator"
      },
      {
        "nodeType": "llm",
        "description": "LLM node - AI model API integration",
        "implemented": true,
        "generator": "LLMNodeGenerator"
      }
      // ... other node types
    ],
    "supporting_types": [
      {
        "name": "ModelProvider",
        "values": ["openai", "anthropic", "google", "local"],
        "description": "AI model providers"
      },
      {
        "name": "TemplateSource",
        "values": ["library", "customized", "built-in", "inline", "file"],
        "description": "Template sources"
      }
    ]
  },
  "totals": {
    "node_types": 19,
    "variable_types": 6,
    "edge_properties": 6,
    "root_entities": 8
  },
  "supported_formats": ["text", "json"],
  "next_commands": ["flowsh dsl <node-type>", "flowsh dsl --format json"]
}
```

## Technical Implementation

### Architecture Integration

- **Registry Integration**: Use existing `NodeGeneratorRegistry.getSupportedTypes()` for node discovery
- **Type Discovery**: Extract complete schema from `src/dsl/types.ts` TypeScript interfaces
- **DSL Structure Mapping**: Map TypeScript interfaces to human-readable descriptions
- **CLI Integration**: Add to `src/cli/index.ts` following existing patterns

### File Changes Required

#### 1. New DSL Introspection Module

**File**: `src/dsl/introspection.ts`

```typescript
export interface DSLEntity {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  optional?: boolean;
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

export class DSLIntrospector {
  constructor(private registry: NodeGeneratorRegistry) {}

  getOverview(): DSLOverview {
    // Implementation extracts complete DSL structure from src/dsl/types.ts
  }

  formatAsText(overview: DSLOverview): string {
    // Human-readable formatter showing complete DSL structure
  }

  formatAsJSON(overview: DSLOverview): string {
    // JSON formatter with complete schema information
  }
}
```

#### 2. CLI Command Addition

**File**: `src/cli/index.ts` (add new command)

```typescript
// DSL command - explore flowsh DSL types and properties
program
  .command('dsl')
  .description('Explore flowsh DSL node types and properties')
  .option('--format <format>', 'Output format: text | json', 'text')
  .action(async (options: { format: 'text' | 'json' }) => {
    await dslCommand(options);
  });

async function dslCommand(options: { format: 'text' | 'json' }): Promise<void> {
  try {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);
    const overview = introspector.getOverview();

    if (options.format === 'json') {
      console.log(introspector.formatAsJSON(overview));
    } else {
      console.log(introspector.formatAsText(overview));
    }
  } catch (error) {
    handleError(error, 'DSL exploration');
  }
}
```

### Complete DSL Structure Mapping

The DSL includes multiple entity types beyond just nodes:

````typescript
// Root-level workflow structure entities
export const ROOT_ENTITIES = {
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
export const GRAPH_COMPONENTS = {
  nodes: 'Array of workflow nodes',
  edges: 'Array of workflow edges (node connections)',
} as const;

// Edge property entities
export const EDGE_PROPERTIES = {
  source: 'Source node ID (required)',
  target: 'Target node ID (required)',
  sourceHandle: 'Source connection point (multi-output support)',
  targetHandle: 'Target connection point (multi-input support)',
  condition: 'Conditional routing (for if-else nodes)',
  label: 'Human-readable edge description',
} as const;

// Variable type entities
export const VARIABLE_TYPE_DESCRIPTIONS = {
  text: 'Text input with optional length limits',
  'text-input': 'Interactive text input',
  select: 'Single-choice selection from options',
  number: 'Numeric input with min/max constraints',
  boolean: 'True/false values',
  object: 'Nested object structures with properties',
  array: 'Array/list structures with item definitions',
} as const;

// Supporting type entities
export const SUPPORTING_TYPES = {
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
export const NODE_DESCRIPTIONS = {
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
} as const;`

## Success Criteria

### Functional Requirements

- [ ] `flowsh dsl` command exists and runs without errors
- [ ] Shows complete DSL structure including root entities, graph components, edges, and variables
- [ ] Shows all 19 node types dynamically discovered from registry
- [ ] Shows 6 variable types with descriptions
- [ ] Shows edge properties and connection capabilities
- [ ] Human-readable output is well-formatted and comprehensive
- [ ] JSON output is valid and includes complete schema structure
- [ ] Consistent with existing CLI patterns and error handling

### Technical Requirements

- [ ] Uses existing registry system for node discovery
- [ ] Extracts complete DSL structure from `src/dsl/types.ts` interfaces
- [ ] Follows TypeScript strict mode compliance
- [ ] Includes proper error handling with flowsh error patterns
- [ ] New code has unit tests with >80% coverage
- [ ] Integration with existing CLI infrastructure

### User Experience Requirements

- [ ] Output is immediately useful for discovering complete DSL structure
- [ ] JSON format is consumable by AI agents and tools
- [ ] Help text and usage patterns match flowsh style
- [ ] Performance is fast (<100ms for command execution)
- [ ] Clear organization of DSL components (root → graph → nodes/edges → variables)

## Testing Strategy

### Unit Tests

- [ ] `DSLIntrospector.getOverview()` returns complete DSL structure
- [ ] Text formatter produces expected human-readable output with all DSL components
- [ ] JSON formatter produces valid JSON schema with complete structure
- [ ] Registry integration discovers all registered generators
- [ ] DSL structure extraction correctly maps TypeScript interfaces

### Integration Tests

- [ ] `flowsh dsl` command executes successfully
- [ ] `flowsh dsl --format json` produces valid JSON
- [ ] Error handling works for invalid arguments
- [ ] Command integrates with existing CLI help system

### Manual Testing

- [ ] Human-readable output shows complete DSL structure clearly
- [ ] JSON output can be parsed by external tools and contains all schema information
- [ ] Command behavior matches other flowsh commands
- [ ] Performance is acceptable for interactive use
- [ ] DSL structure is accurately represented and comprehensive

## Implementation Notes

### Phase 1 Scope Limitations

- **No detailed node specifications** - only overview (Phase 2 will add `flowsh dsl <node-type>`)
- **No property validation rules** - focus on structure discovery
- **No examples integration** - save for Phase 2
- **No TypeScript interface details** - human-readable descriptions only

### Design Considerations

**DSL Structure Discovery**: This implementation provides comprehensive DSL structure discovery beyond just node types. It extracts the complete schema from TypeScript interface definitions, making the full workflow definition language discoverable.

**Registry + Type System Integration**: Node discovery uses the registry system, while the broader DSL structure is extracted from the authoritative `src/dsl/types.ts` interfaces, ensuring accuracy and completeness.

**Performance**: Structure extraction is fast since it's reading from TypeScript definitions and in-memory registry. No file system operations required.

**Extensibility**: The introspection system is designed to easily extend for Phase 2 detailed node exploration while maintaining the complete DSL structure foundation.

### Validation Commands

**Build and Test**:

```bash
npm run build
npm test
```

**Manual Testing**:

```bash
flowsh dsl
flowsh dsl --format json
flowsh dsl --help
```

**Integration Testing**:

```bash
# Ensure it integrates with existing CLI
flowsh --help  # Should show dsl command
flowsh dsl | jq .  # Test JSON parsing
```

## Dependencies

- **No new external dependencies required**
- Uses existing registry system (`src/generation/registry/`)
- Uses existing CLI framework (Commander.js)
- Uses existing error handling patterns

## Documentation Updates

- [ ] Update README.md to mention `flowsh dsl` command
- [ ] Update AGENTS.md with DSL exploration capabilities
- [ ] Add command to CLI help output
- [ ] Update examples with DSL exploration workflow

## Deliverables

1. **Core Implementation**
   - `src/dsl/introspection.ts` - DSL introspection system
   - CLI command integration in `src/cli/index.ts`

2. **Tests**
   - Unit tests for introspection functionality
   - Integration tests for CLI command
   - Manual testing validation

3. **Documentation**
   - Updated README.md and AGENTS.md
   - CLI help text integration

This PRP provides the foundation for Phase 2 detailed node exploration and establishes the pattern for dynamic DSL discovery in flowsh.
````
