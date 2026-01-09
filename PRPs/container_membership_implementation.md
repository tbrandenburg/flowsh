# PRP: Implement Dify-style Container Membership for Bash Loop Generation

## FEATURE:

Implement Dify-style container membership (`isInIteration`, `iteration_id`) in flowsh's DSL to fix the execution orchestration bug where iteration nodes generate linear execution instead of proper Bash loops with nested child nodes.

### Current Problem

flowsh's shell generator uses linear execution (`src/generation/shell-generator.ts:422-423`) that ignores workflow graph topology. The iteration generator expects child nodes to be executed within the generated Bash loop, but the compiler cannot determine which nodes belong inside the loop body because edges only define ordering, not containment.

### Target Solution

Add minimal container membership properties to the DSL that allow the compiler to generate correct Bash loop structures:

**Current (broken) output:**

```bash
execute_iteration_content_iterator  # Sets up iteration vars, exits
execute_agent_content_writer        # Processes only first item
execute_agent_editorial_agent       # Runs regardless
```

**Desired (correct) output:**

```bash
# From content_iterator compilation with child nodes
for item in "${planning_files[@]}"; do
    set_workflow_var "iteration_item" "$item"
    set_workflow_var "iteration_index" "$index"

    # Child nodes compiled INSIDE the loop
    execute_agent_content_writer
done
set_workflow_var "iteration_completed" "true"

# Then continue to next non-child nodes
execute_agent_editorial_agent
```

### Implementation Requirements

1. **DSL Extension**: Add container membership properties to `BaseNodeData` interface
2. **Compilation Logic**: Modify shell generator to recognize container relationships
3. **Loop Generation**: Update iteration generator to emit child nodes within loops
4. **Backward Compatibility**: Ensure existing templates continue to work unchanged
5. **Comprehensive Testing**: Validate all existing examples and templates

## EXAMPLES:

### Example 1: Essay Template Fix (Primary Test Case)

File: `templates/enhanced/opencode-essay-simple-template.yaml`

**Current (no container membership):**

```yaml
- id: content_writer
  type: agent
  data:
    title: 'Content Writer Agent'
    # No container membership - compiler doesn't know it belongs in iteration
```

**Updated (with container membership):**

```yaml
- id: content_writer
  type: agent
  data:
    title: 'Content Writer Agent'
    isInIteration: true
    iteration_id: content_iterator
```

### Example 2: Nested Iteration Example

File: `examples/nodes/iteration-node-example.yaml`

**Before:**

```yaml
- id: process_item
  type: code
  data:
    command: 'echo "Processing {{iteration_item}}"'
```

**After:**

```yaml
- id: process_item
  type: code
  data:
    command: 'echo "Processing {{iteration_item}}"'
    isInIteration: true
    iteration_id: data_processor
```

### Example 3: Multiple Child Nodes in Iteration

```yaml
- id: validate_item
  type: code
  data:
    command: 'validate.sh "{{iteration_item}}"'
    isInIteration: true
    iteration_id: batch_processor

- id: transform_item
  type: agent
  data:
    command: 'opencode'
    args: ['transform']
    isInIteration: true
    iteration_id: batch_processor

- id: save_result
  type: code
  data:
    command: 'save.sh "{{iteration_result}}"'
    isInIteration: true
    iteration_id: batch_processor
```

## DOCUMENTATION:

### Primary References

- **Current Implementation**: `src/generation/generators/iteration-node.ts` - Shows partial Dify-style support (`iterator_selector`, `output_selector`)
- **Shell Generator**: `src/generation/shell-generator.ts:422-423` - Linear execution bug location
- **DSL Types**: `src/dsl/types.ts` - BaseNodeData interface to extend
- **Issue Documentation**: `docs/20250109_EXECUTION_ORCHESTRATION_ISSUE.md` - Complete analysis of the problem

### Dify.ai Reference Schema

File: `docs/dify/dify-workflow-pseudo-schema.yaml` - Shows advanced container ownership patterns

### Template Test Cases

- **Primary**: `templates/enhanced/opencode-essay-simple-template.yaml` - Main bug reproduction case
- **All Templates**: `templates/enhanced/` and `templates/advanced/` - 14 templates to validate
- **Node Examples**: `examples/nodes/` - 19+ node examples to test

### Testing Resources

- **Build Commands**: `make check` - Comprehensive quality checks
- **Example Generation**: `make examples-all` - Generate all example scripts
- **Template Validation**: `make validate` - Validate all templates

## OTHER CONSIDERATIONS:

### Backward Compatibility Strategy

- **Graceful Degradation**: Nodes without `isInIteration` behave exactly as before (linear execution)
- **Template Migration**: Existing templates continue working unchanged - container membership is additive
- **Optional Properties**: Both `isInIteration` and `iteration_id` should be optional in the DSL

### Security Considerations

- **Input Validation**: Validate that `iteration_id` references exist and are iteration/loop nodes
- **Circular References**: Prevent nodes from referencing themselves as parents
- **Type Safety**: Ensure container membership is only valid for appropriate node types

### Implementation Phases

1. **Phase 1**: Extend DSL types with container membership properties
2. **Phase 2**: Modify shell generator to group nodes by container membership
3. **Phase 3**: Update iteration generator to emit child nodes within loops
4. **Phase 4**: Test against essay template (primary validation)
5. **Phase 5**: Comprehensive testing of all templates and examples
6. **Phase 6**: Documentation updates and edge case handling

### Edge Cases to Handle

- **Multiple Iterations**: Nodes can belong to nested iterations (`isInLoop: true, loop_id: outer, isInIteration: true, iteration_id: inner`)
- **Mixed Container Types**: Support for future loop and conditional containers
- **Container Validation**: Ensure referenced container nodes exist and are appropriate types
- **Error Messages**: Clear compilation errors for invalid container membership

### Files to Modify

1. **`src/dsl/types.ts`** - Add container membership to BaseNodeData
2. **`src/generation/shell-generator.ts`** - Replace linear execution with container-aware compilation
3. **`src/generation/generators/iteration-node.ts`** - Update to emit child nodes within loops
4. **`src/dsl/validation.ts`** - Add validation for container membership
5. **Template Updates** - Add container membership to affected templates (optional, for demonstration)

### Success Criteria

- [ ] Essay template generates correct Bash loop with content_writer inside iteration
- [ ] All existing templates continue to compile and validate successfully
- [ ] All 19+ node examples continue to work unchanged
- [ ] `make check` passes all quality checks
- [ ] Generated scripts are executable and produce expected behavior
- [ ] Container membership validation prevents invalid configurations
- [ ] Documentation is updated to reflect new DSL capabilities

### Testing Strategy

1. **Unit Tests**: Test container membership validation and compilation logic
2. **Integration Tests**: Test complete workflow compilation with containers
3. **Template Tests**: Validate all 14 templates compile correctly
4. **Example Tests**: Ensure all node examples work as before
5. **Manual Testing**: Run essay template end-to-end to verify fix
6. **Regression Testing**: Confirm no existing functionality is broken
