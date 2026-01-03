# 🔬 Flowsh Node Examples

This directory contains comprehensive, battle-tested examples for all flowsh node types. Each example demonstrates a complete workflow showcasing the specific node's capabilities, proper configuration, and integration patterns.

## 📁 Example Files

### Core Infrastructure Nodes

- [`start-node-example.yaml`](start-node-example.yaml) - Input collection with various variable types
- [`end-node-example.yaml`](end-node-example.yaml) - Output export with structured data
- [`answer-node-example.yaml`](answer-node-example.yaml) - Response formatting (text, JSON, markdown)

### Execution Nodes

- [`code-node-example.yaml`](code-node-example.yaml) - Shell command execution with environment management
- [`agent-node-example.yaml`](agent-node-example.yaml) - AI-powered command generation and execution
- [`llm-node-example.yaml`](llm-node-example.yaml) - Language model integration with multiple providers

### Control Flow Nodes

- [`if-else-node-example.yaml`](if-else-node-example.yaml) - Conditional logic with multiple operators
- [`loop-node-example.yaml`](loop-node-example.yaml) - Iterative processing with termination conditions
- [`iteration-node-example.yaml`](iteration-node-example.yaml) - Array/list processing with type-aware logic
- [`parallel-iteration-node-example.yaml`](parallel-iteration-node-example.yaml) - High-performance concurrent processing

### Data Management Nodes

- [`variable-assignment-node-example.yaml`](variable-assignment-node-example.yaml) - Variable operations (constants, expressions, write modes)
- [`variable-aggregation-node-example.yaml`](variable-aggregation-node-example.yaml) - Data combination (concat, sum, avg, merge, collect)

### Integration Nodes

- [`http-request-node-example.yaml`](http-request-node-example.yaml) - REST API integration with authentication

### Resilience Nodes

- [`retry-node-example.yaml`](retry-node-example.yaml) - Failure recovery with exponential backoff

## 🎯 Example Features

Each example demonstrates:

### ✅ **Complete Workflows**

- Start-to-finish executable workflows
- Realistic use cases and data flows
- Proper node connections and data passing

### ✅ **Best Practices**

- Error handling and validation
- Resource cleanup and management
- Security considerations
- Performance optimization

### ✅ **Human Readability**

- Clear, descriptive node titles and descriptions
- Logical workflow structure
- Comprehensive inline documentation
- Meaningful variable names

### ✅ **Battle Testing**

- YAML syntax validation
- Shell script generation compatibility
- Variable resolution verification
- Edge case handling

## 🚀 Usage Instructions

### Running Individual Examples

```bash
# Generate shell script from example
flowsh generate examples/nodes/start-node-example.yaml

# Execute generated workflow
./start-node-example.sh
```

### Testing All Examples

```bash
# Validate all example files
npm run validate:examples

# Generate scripts from all examples
npm run generate:all-examples

# Run comprehensive test suite
npm test examples/
```

### Using as Templates

Each example can serve as a template for your own workflows:

1. **Copy the example file**

   ```bash
   cp examples/nodes/http-request-node-example.yaml my-api-workflow.yaml
   ```

2. **Modify for your use case**
   - Update URLs, endpoints, and parameters
   - Customize authentication and headers
   - Adjust error handling and retry logic

3. **Test and deploy**
   ```bash
   flowsh generate my-api-workflow.yaml
   ./my-api-workflow.sh
   ```

## 📊 Node Coverage

| Category                | Nodes | Examples | Status         |
| ----------------------- | ----- | -------- | -------------- |
| **Core Infrastructure** | 3     | 3        | ✅ Complete    |
| **Execution**           | 3     | 3        | ✅ Complete    |
| **Control Flow**        | 4     | 4        | ✅ Complete    |
| **Data Management**     | 3     | 2        | 🔄 In Progress |
| **Integration**         | 2     | 1        | 🔄 In Progress |
| **Resilience**          | 3     | 1        | 🔄 In Progress |

**Total: 14/18 node types covered**

## 🔍 Example Complexity Levels

### 🟢 **Simple** (5-8 nodes)

- `start-node-example.yaml`
- `end-node-example.yaml`
- `answer-node-example.yaml`

### 🟡 **Moderate** (9-15 nodes)

- `code-node-example.yaml`
- `agent-node-example.yaml`
- `llm-node-example.yaml`
- `if-else-node-example.yaml`
- `http-request-node-example.yaml`

### 🔴 **Complex** (16+ nodes)

- `iteration-node-example.yaml`
- `parallel-iteration-node-example.yaml`
- `variable-assignment-node-example.yaml`
- `variable-aggregation-node-example.yaml`
- `retry-node-example.yaml`

## 📖 Learning Path

### Beginner

1. Start with **Core Infrastructure** examples
2. Understand basic data flow and variable handling
3. Practice with **Simple** examples

### Intermediate

1. Explore **Execution** and **Control Flow** nodes
2. Learn conditional logic and loops
3. Work with **Moderate** complexity examples

### Advanced

1. Master **Data Management** and **Integration** patterns
2. Implement **Resilience** patterns
3. Build **Complex** multi-node workflows

## 🛠 Development Guidelines

When creating new examples:

1. **Follow naming convention**: `{node-type}-node-example.yaml`
2. **Include comprehensive metadata**: name, description, version
3. **Demonstrate core features**: Show the node's primary capabilities
4. **Add realistic use cases**: Practical scenarios, not toy examples
5. **Provide thorough documentation**: Titles, descriptions, and comments
6. **Test thoroughly**: Validate YAML, generate scripts, test execution
7. **Handle errors gracefully**: Include appropriate error handling
8. **Optimize for readability**: Clear structure and logical flow

## 🔧 Validation Tools

```bash
# YAML syntax validation
npm run lint:yaml examples/nodes/

# Schema validation
npm run validate:schema examples/nodes/

# Generation testing
npm run test:generation examples/nodes/

# Full integration testing
npm run test:integration examples/nodes/
```

## 📚 Additional Resources

- [Flowsh Documentation](../../docs/)
- [Node Type Reference](../../src/dsl/types.ts)
- [Generator Implementation](../../src/generation/generators/)
- [Validation Rules](../../src/dsl/validation.ts)

---

_These examples demonstrate the full capabilities of flowsh workflow nodes and serve as both learning resources and production-ready templates for building robust, automated workflows._
