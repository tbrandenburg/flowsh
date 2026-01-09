# Adding Generator Tests - Quick Guide

This guide shows how to add tests for flowsh generator functions.

## When to Add Tests

Add tests when:

- Creating a new generator for a node type
- Modifying existing generator logic
- Fixing generator bugs

## Basic Pattern

All generator tests follow the same pattern, based on existing tests like `http-request-node.test.ts`:

```typescript
import { generateYourNode } from './your-node.js';
import { describe, test, expect } from 'vitest';

describe('YourNode Generator', () => {
  test('should generate basic node code', () => {
    const nodeData = {
      // minimal node configuration
    };

    const result = generateYourNode('test_id', nodeData);

    expect(result).toContain('execute_your_node_test_id()');
    expect(result).toContain('# Your Node: Test');
  });

  test('should handle template variables', () => {
    const nodeData = {
      someField: '${test_var}',
    };

    const result = generateYourNode('test_id', nodeData);

    expect(result).toContain('${test_var}');
  });
});
```

## Quick Setup Steps

1. **Create test file**: `src/generation/generators/your-node.test.ts`

2. **Copy existing test structure** from a similar generator (e.g., `code-node.test.ts` for script nodes, `llm-node.test.ts` for API nodes)

3. **Write basic tests**:
   - Function naming (`execute_*_nodeId()`)
   - Basic structure
   - Template variable handling
   - Node-specific features

4. **Run tests**: `npm test`

## Example Test Cases

### Function Generation

```typescript
test('should generate function with correct naming', () => {
  const result = generateYourNode('my_test', nodeData);
  expect(result).toContain('execute_your_node_my_test()');
});
```

### Template Variables

```typescript
test('should preserve template variables', () => {
  const nodeData = { message: '${user_input}' };
  const result = generateYourNode('test', nodeData);
  expect(result).toContain('${user_input}');
});
```

### Error Handling

```typescript
test('should validate required fields', () => {
  const incompleteData = {
    /* missing required fields */
  };
  expect(() => generateYourNode('test', incompleteData)).toThrow();
});
```

### Node-Specific Features

Test the unique aspects of your node type:

- API endpoints for HTTP nodes
- Model configurations for LLM nodes
- Script execution for code nodes
- Message formatting for telegram nodes

## File Locations

- **Generator**: `src/generation/generators/your-node.ts`
- **Test file**: `src/generation/generators/your-node.test.ts`
- **Example**: Look at `agent-node.test.ts`, `llm-node.test.ts`, `code-node.test.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run specific generator test
npm test -- your-node.test.ts

# Run with coverage
npm test -- --coverage
```

## Test Requirements

- Cover basic code generation
- Test template variable handling
- Verify function naming conventions
- Test node-specific features
- Keep tests simple and focused

## Getting Help

- Study existing generator tests in `src/generation/generators/`
- Copy patterns from similar node types
- Keep it simple - follow KISS principle
- Focus on core functionality testing

The goal is reliability, not 100% coverage. Test the important paths that could break compilation.
