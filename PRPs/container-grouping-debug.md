# PRP: Fix Container Grouping Logic and Integration Testing

## FEATURE:

Debug and fix the `groupNodesByContainer()` function in flowsh's shell generator to properly identify child nodes with container membership properties. The current implementation has container membership detection logic that isn't correctly identifying child nodes from YAML workflows, resulting in generated shell scripts showing "# No child nodes to execute" instead of embedding child node execution within iteration loops.

**Core Issues to Address:**

1. **Container Grouping Logic**: The `groupNodesByContainer()` function in `src/generation/shell-generator.ts` (lines ~420-470) is not correctly detecting nodes with `isInIteration: true` and `iteration_id` properties
2. **YAML Property Preservation**: Verify that YAML parsing preserves container membership properties (`isInIteration`, `iteration_id`, `isInLoop`, `loop_id`) in the node data structure
3. **Property Access Pattern**: Validate that the property access pattern `(node.data as any).isInIteration` is working correctly with the parsed YAML data
4. **Integration Testing**: Test with real workflow templates (especially the essay template) to ensure proper nested Bash loop generation

**Expected Behavior:**

- Child nodes with `isInIteration: true` and `iteration_id: "parent_iteration_id"` should be detected and grouped with their parent iteration node
- Generated shell scripts should show child node execution calls embedded within the iteration's for loop
- The iteration generator should receive child nodes via `GenerationContext.childNodes` and generate nested execution calls

## EXAMPLES:

1. **Test YAML Structure** (`test-essay-template-with-containers.yaml`):

```yaml
- id: content_iterator
  type: iteration
  data:
    input_variable: planning_files

- id: content_writer
  type: agent
  data:
    isInIteration: true
    iteration_id: content_iterator
```

2. **Expected Generated Shell Output**:

```bash
for item_index in "${!input_array[@]}"; do
    # Set iteration context variables
    set_workflow_var "iteration_item" "$current_item"

    # Execute child nodes within the iteration
    execute_agent_content_writer || log_warning "Child node content_writer failed"

    # Collect results
done
```

3. **Current Broken Output**:

```bash
for item_index in "${!input_array[@]}"; do
    # No child nodes to execute
done
```

4. **Original Essay Template**: The `templates/enhanced/opencode-essay-simple-template.yaml` should generate proper nested loops instead of linear execution

## DOCUMENTATION:

1. **Container Membership Architecture**: `src/dsl/types.ts` - BaseNodeData interface with container properties
2. **Shell Generator**: `src/generation/shell-generator.ts` - Container-aware compilation logic
3. **Iteration Generator**: `src/generation/generators/iteration-node.ts` - Child node execution within loops
4. **Validation**: `src/dsl/validation.ts` - Container membership validation
5. **Generation Context**: `src/generation/registry/types.ts` - childNodes property
6. **AGENTS.md**: Registry-based plugin system architecture and testing requirements

**Testing Commands:**

```bash
# Build and validate
npm run build
make check

# Test container functionality
./dist/cli/index.js validate test-essay-template-with-containers.yaml
./dist/cli/index.js compile test-essay-template-with-containers.yaml

# Test original essay template
./dist/cli/index.js compile templates/enhanced/opencode-essay-simple-template.yaml
```

## OTHER CONSIDERATIONS:

**Security & Safety:**

- All container membership validation must maintain security checks
- Generated shell scripts must use `set -euo pipefail` for safety
- Property access must be type-safe and handle undefined values gracefully

**Debugging Strategy:**

1. Add console.log statements to `groupNodesByContainer()` to trace node detection
2. Verify YAML parsing preserves container properties by logging parsed node data
3. Test property access patterns with actual parsed YAML structures
4. Validate that `nodeData.isInIteration` and `nodeData.iteration_id` are correctly read

**Edge Cases:**

- Nodes with missing container IDs
- Invalid iteration_id references
- Multiple container membership (should be prevented by validation)
- Nested containers (future consideration)
- Empty child node arrays

**Integration Requirements:**

- All 373 existing tests must continue passing
- Backward compatibility with existing workflows without container properties
- Registry-based architecture must be preserved
- Unix philosophy: clean, readable shell script output

**Success Criteria:**

1. ✅ `groupNodesByContainer()` correctly identifies child nodes with container membership
2. ✅ Child nodes appear inside iteration loops in generated shell scripts
3. ✅ Essay template generates proper nested Bash loops instead of linear execution
4. ✅ All existing templates continue to work unchanged
5. ✅ Container validation prevents invalid configurations
6. ✅ Generated shell scripts are under 100 lines and human-readable
7. ✅ All tests pass and code quality checks succeed

**Files Requiring Changes:**

- `src/generation/shell-generator.ts` - Fix container grouping logic
- Potentially `src/parsing/` - If YAML property preservation is the issue
- Test files as needed for validation

**Gotchas:**

- TypeScript strict mode requires careful property access patterns
- YAML parsing may transform property names or types
- Container detection must handle both presence and absence of properties
- Generated shell must be executable and safe (no injection vulnerabilities)
