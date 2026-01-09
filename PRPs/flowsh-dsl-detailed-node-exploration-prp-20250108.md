# PRP: Detailed Node Exploration flowsh dsl <node-type>

**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: Large (4-5 days)  
**Created**: 2025-01-08  
**Depends On**: flowsh-dsl-basic-command-prp-20250108.md

## Context

Building on the basic `flowsh dsl` command (Phase 1), users and AI agents need detailed exploration of specific node types including properties and type constraints. This PRP implements `flowsh dsl <node-type>` with comprehensive node specification display supporting both human-readable and JSON formats.

## Feature Specification

### Core Functionality

Implement detailed node exploration that:

- Shows complete specification for any node type (19+ supported)
- Extracts property information directly from TypeScript interfaces
- Provides JSON Schema-style output for tooling
- Maintains consistency with Phase 1 output formats

### Command Interface

```bash
# Default: Human-readable detailed specification
flowsh dsl llm
flowsh dsl http-request
flowsh dsl code

# JSON format for programmatic consumption
flowsh dsl llm --format json
flowsh dsl circuit-breaker --format json

# Help and usage
flowsh dsl <node-type> --help
```

### Output Format Requirements

#### Human-Readable Detailed Output

```
LLM Node - AI Model Integration

DESCRIPTION:
  Execute AI model calls via API with prompt templates, context management,
  and memory support. Supports OpenAI, Anthropic, Google, and local models.

REQUIRED PROPERTIES:
  model                object    Model configuration (provider, name, mode)
    ├── provider       string    Model provider: 'openai' | 'anthropic' | 'google' | 'local'
    ├── name          string    Model name (e.g., 'gpt-4', 'claude-3-sonnet')
    └── mode          string    Execution mode: 'chat' | 'completion'

OPTIONAL PROPERTIES:
  prompt_template      object|array  Prompt configuration
    ├── type          string    Template type: 'prompt'
    ├── source        string    Source: 'library' | 'customized' | 'built-in' | 'inline' | 'file'
    ├── content       string    Inline template content
    └── template_id   string    Template registry ID

  template_parameters  object    Template variable substitutions
    └── [key]         any       Variable name → value mappings

  model.completion_params  object    Model-specific parameters
    ├── temperature   number    Randomness (0.0-2.0, default: 0.7)
    ├── max_tokens    number    Maximum response tokens
    ├── top_p         number    Nucleus sampling (0.0-1.0)
    └── frequency_penalty number Frequency penalty (-2.0-2.0)

TEMPLATE VARIABLES:
  Supports {{variable}}, {{#path.to.value#}}, ${variable} syntax
  Variables automatically extracted and validated

SHELL GENERATION:
  Generates secure shell script with:
  - API authentication handling
  - JSON request/response processing
  - Error handling and retries
  - Variable substitution and validation

MORE COMMANDS:
  flowsh dsl llm --format json    Get machine-readable schema
  flowsh dsl                      Show all available node types
```

#### JSON Schema Format Output

```json
{
  "nodeType": "llm",
  "description": "AI Model Integration",
  "category": "ai",
  "implemented": true,
  "generator": "LLMNodeGenerator",
  "schema": {
    "type": "object",
    "required": ["model"],
    "properties": {
      "title": {
        "type": "string",
        "description": "Human-readable node title",
        "required": false
      },
      "model": {
        "type": "object",
        "required": true,
        "description": "Model configuration",
        "properties": {
          "provider": {
            "type": "string",
            "required": true,
            "enum": ["openai", "anthropic", "google", "local"],
            "description": "Model provider"
          },
          "name": {
            "type": "string",
            "required": true,
            "description": "Model name/ID",
            "examples": ["gpt-4", "claude-3-sonnet-20240229"]
          },
          "mode": {
            "type": "string",
            "required": true,
            "enum": ["chat", "completion"],
            "default": "chat",
            "description": "Execution mode"
          },
          "completion_params": {
            "type": "object",
            "required": false,
            "properties": {
              "temperature": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 2.0,
                "default": 0.7,
                "description": "Controls randomness in responses"
              },
              "max_tokens": {
                "type": "number",
                "minimum": 1,
                "description": "Maximum tokens in response"
              }
            }
          }
        }
      },
      "prompt_template": {
        "type": ["object", "array"],
        "required": false,
        "description": "Prompt configuration"
      },
      "template_parameters": {
        "type": "object",
        "required": false,
        "description": "Template variable substitutions",
        "additionalProperties": true
      }
    }
  },
  "templateVariables": {
    "supported": ["{{var}}", "{{#path.to.var#}}", "${var}"],
    "extraction": "automatic"
  },
  "shellGeneration": {
    "features": [
      "API authentication handling",
      "JSON request/response processing",
      "Error handling and retries",
      "Variable substitution and validation"
    ]
  },
  "relatedCommands": ["flowsh dsl llm --format json", "flowsh dsl", "flowsh compile workflow.yaml"]
}
```

## Technical Implementation

### Architecture Integration

- **Type Reflection**: Extract schema from TypeScript DSL type definitions
- **Schema Generation**: Convert TypeScript interfaces to JSON Schema format

### File Changes Required

#### 1. Enhanced DSL Introspection Module

**File**: `src/dsl/introspection.ts` (extend from Phase 1)

```typescript
export interface PropertyInfo {
  name: string;
  type: string | string[];
  required: boolean;
  description: string;
  enum?: string[];
  default?: any;
  minimum?: number;
  maximum?: number;
  examples?: any[];
  properties?: PropertyInfo[]; // For nested objects
  additionalProperties?: boolean;
}

export interface NodeDetailInfo {
  nodeType: string;
  description: string;
  category: string;
  implemented: boolean;
  generator: string;
  schema: {
    type: 'object';
    required: string[];
    properties: Record<string, PropertyInfo>;
  };
  templateVariables: {
    supported: string[];
    extraction: string;
  };
  shellGeneration: {
    features: string[];
  };
  relatedCommands: string[];
}

export class DSLIntrospector {
  // ... existing methods from Phase 1

  getNodeDetail(nodeType: string): NodeDetailInfo {
    // Implementation here
  }

  formatNodeAsText(detail: NodeDetailInfo): string {
    // Human-readable detailed formatter
  }

  formatNodeAsJSON(detail: NodeDetailInfo): string {
    // JSON schema formatter
  }

  private extractPropertiesFromType(nodeType: string): PropertyInfo[] {
    // Use TypeScript type reflection to extract properties
  }
}
```

#### 2. Type Schema Mapping System

**File**: `src/dsl/type-schema-mapping.ts`

```typescript
import {
  LLMNodeData,
  CodeNodeData,
  HttpRequestNodeData,
  // ... import all node data types
} from './types.js';

export interface TypeSchemaExtractor {
  extractSchema(nodeType: string): PropertyInfo[];
}

export class DSLTypeSchemaExtractor implements TypeSchemaExtractor {
  extractSchema(nodeType: string): PropertyInfo[] {
    switch (nodeType) {
      case 'llm':
        return this.extractLLMSchema();
      case 'code':
        return this.extractCodeSchema();
      case 'http-request':
        return this.extractHttpRequestSchema();
      // ... handle all node types
      default:
        return this.extractBaseSchema();
    }
  }

  private extractLLMSchema(): PropertyInfo[] {
    return [
      {
        name: 'model',
        type: 'object',
        required: true,
        description: 'Model configuration',
        properties: [
          {
            name: 'provider',
            type: 'string',
            required: true,
            enum: ['openai', 'anthropic', 'google', 'local'],
            description: 'Model provider',
          },
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Model name/ID',
            examples: ['gpt-4', 'claude-3-sonnet-20240229'],
          },
          // ... more properties
        ],
      },
      // ... more top-level properties
    ];
  }
}
```

#### 3. CLI Command Extension

**File**: `src/cli/index.ts` (extend existing dsl command)

```typescript
// Update DSL command to handle node-type argument
program
  .command('dsl')
  .description('Explore flowsh DSL node types and properties')
  .argument('[node-type]', 'Specific node type to explore in detail')
  .option('--format <format>', 'Output format: text | json', 'text')
  .action(async (nodeType?: string, options: { format: 'text' | 'json' } = { format: 'text' }) => {
    await dslCommand(nodeType, options);
  });

async function dslCommand(
  nodeType?: string,
  options: { format: 'text' | 'json' } = { format: 'text' }
): Promise<void> {
  try {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    if (nodeType) {
      // Node detail mode
      if (!registry.has(nodeType)) {
        console.error(`❌ Unknown node type: ${nodeType}`);
        console.error(`💡 Run 'flowsh dsl' to see available node types`);
        process.exit(1);
      }

      const detail = introspector.getNodeDetail(nodeType);

      if (options.format === 'json') {
        console.log(introspector.formatNodeAsJSON(detail));
      } else {
        console.log(introspector.formatNodeAsText(detail));
      }
    } else {
      // Overview mode (Phase 1 functionality)
      const overview = introspector.getOverview();

      if (options.format === 'json') {
        console.log(introspector.formatAsJSON(overview));
      } else {
        console.log(introspector.formatAsText(overview));
      }
    }
  } catch (error) {
    handleError(error, 'DSL exploration');
  }
}
```

### Property Schema Definitions

Each node type requires detailed property mapping. Key patterns:

```typescript
// Common base properties for all nodes
const BASE_PROPERTIES: PropertyInfo[] = [
  {
    name: 'title',
    type: 'string',
    required: false,
    description: 'Human-readable node title',
  },
  {
    name: 'desc',
    type: 'string',
    required: false,
    description: 'Node description',
  },
];

// Complex nested object example
const LLM_MODEL_PROPERTY: PropertyInfo = {
  name: 'model',
  type: 'object',
  required: true,
  description: 'Model configuration',
  properties: [
    {
      name: 'provider',
      type: 'string',
      required: true,
      enum: ['openai', 'anthropic', 'google', 'local'],
      description: 'Model provider',
    },
    {
      name: 'completion_params',
      type: 'object',
      required: false,
      description: 'Model-specific parameters',
      properties: [
        {
          name: 'temperature',
          type: 'number',
          required: false,
          minimum: 0.0,
          maximum: 2.0,
          default: 0.7,
          description: 'Controls randomness in responses',
        },
      ],
    },
  ],
};
```

## Success Criteria

### Functional Requirements

- [ ] `flowsh dsl <node-type>` shows complete specification for all 19+ node types
- [ ] Property information is accurate and matches TypeScript definitions
- [ ] JSON output is valid JSON Schema format
- [ ] Error handling for invalid node types

### Technical Requirements

- [ ] Schema extraction works for all node data types
- [ ] Performance is acceptable (<500ms per node)
- [ ] Memory usage is reasonable for type reflection

### User Experience Requirements

- [ ] Human-readable output is comprehensive but scannable
- [ ] JSON format provides complete schema for tooling
- [ ] Property trees clearly show nested structure
- [ ] Related commands guide next steps

## Testing Strategy

### Unit Tests

- [ ] Schema extraction for each node type produces correct properties
- [ ] JSON output validates against JSON Schema specification
- [ ] Text formatting produces consistent output

### Integration Tests

- [ ] `flowsh dsl llm` executes and shows complete specification
- [ ] `flowsh dsl http-request --format json` produces valid schema
- [ ] Error handling for `flowsh dsl invalid-node`
- [ ] All 19+ node types can be explored without errors

### Node Type Coverage Tests

```bash
# Ensure all registered node types work
for node in $(flowsh dsl --format json | jq -r '.categories[].nodes[].nodeType'); do
  echo "Testing: $node"
  flowsh dsl $node > /dev/null || echo "FAILED: $node"
  flowsh dsl $node --format json | jq . > /dev/null || echo "FAILED JSON: $node"
done
```

### Manual Testing

- [ ] Human output is readable and informative for complex nodes (LLM, HTTP)
- [ ] JSON can be consumed by external schema validation tools
- [ ] Property descriptions are clear and actionable

## Implementation Challenges

### Type System Reflection

**Challenge**: Extract detailed schema from TypeScript interfaces at runtime  
**Solution**: Static analysis approach - pre-generate schema mappings at build time

### Schema Completeness

**Challenge**: Ensuring all 19+ node types have complete, accurate schemas  
**Solution**: Unit tests that verify schema completeness against type definitions

## Implementation Notes

### Dependency on Phase 1

This PRP builds directly on the basic `flowsh dsl` command. The introspection infrastructure from Phase 1 is extended rather than replaced.

### Type Safety Considerations

Schema extraction must maintain type safety. Any runtime reflection should be validated against TypeScript definitions to prevent drift.

### Performance Optimization

- Cache schema extraction results
- Pre-compile schema mappings at build time

### Extensibility Design

The schema extraction system should easily support:

- New node types added to the registry
- Additional output formats (future)

### Validation Commands

**Build and Test**:

```bash
npm run build
npm test
```

**Manual Testing All Node Types**:

```bash
# Test basic functionality
flowsh dsl llm
flowsh dsl code --format json

# Test error handling
flowsh dsl invalid-node-type

# Test all registered nodes
flowsh dsl --format json | jq -r '.categories[].nodes[].nodeType' | while read node; do
  echo "=== Testing $node ==="
  flowsh dsl "$node"
  echo "JSON format:"
  flowsh dsl "$node" --format json | jq -r '.nodeType'
done
```

**Schema Validation**:

```bash
# Validate JSON output against JSON Schema
flowsh dsl llm --format json | ajv validate --spec=draft2020
```

## Dependencies

- **Phase 1**: flowsh-dsl-basic-command-prp-20250108.md must be implemented first
- **JSON Schema**: Consider adding JSON Schema validation library for output validation
- **TypeScript Reflection**: May need build-time type analysis tools

## Documentation Updates

- [ ] Update README.md with detailed node exploration examples
- [ ] Update AGENTS.md with schema querying capabilities
- [ ] Add comprehensive CLI help for node-type argument
- [ ] Document JSON Schema format for external tool integration

## Deliverables

1. **Enhanced Introspection System**
   - Extended `src/dsl/introspection.ts` with detailed node exploration
   - `src/dsl/type-schema-mapping.ts` for property extraction

2. **Complete Node Type Coverage**
   - Schema definitions for all 19+ node types

3. **CLI Integration**
   - Extended dsl command with node-type argument
   - JSON and text output formats
   - Comprehensive error handling

4. **Testing Suite**
   - Unit tests for all schema extraction
   - Integration tests for all node types
   - Performance and validation tests

This PRP provides comprehensive DSL exploration capabilities that make flowsh highly discoverable for both human users and AI agents, establishing the foundation for advanced workflow generation tooling.
