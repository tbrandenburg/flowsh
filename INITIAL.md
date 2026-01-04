## FEATURE:

Add basic variable management system with setter/getter functions and debug logging to replace the current direct variable assignment approach in generated shell scripts.

### Current Behavior:

```bash
# Direct variable assignment
USER_NAME="Alice"
RESULT="${USER_NAME}_processed"
```

### Desired Behavior:

```bash
# Function-based variable management with debug support
set_var "USER_NAME" "Alice" "node1"
RESULT=$(get_var "USER_NAME" "node2")_processed
set_var "RESULT" "$RESULT" "node2"

# Debug output (when FLOWSH_DEBUG=true):
# [DEBUG] node1: SET USER_NAME = 'Alice'
# [DEBUG] node2: GET USER_NAME = 'Alice'
# [DEBUG] node2: SET RESULT = 'Alice_processed'
```

### Requirements:

- Replace current direct variable assignment with `set_var()`/`get_var()` functions
- Add simple debug logging controlled by `FLOWSH_DEBUG=true` environment variable
- Debug output goes to stderr with format: `[DEBUG] node_id: SET/GET VAR_NAME = 'value'`
- Node ID parameter required (use "root" or "none" if not provided)
- No audit log storage - only real-time debug output
- Maintain 100% backward compatibility - existing workflows continue to work
- Integrate with variable assignment nodes and template variable processing

## EXAMPLES:

### Basic Variable Operations:

```bash
# Setting variables
set_var "USER_NAME" "Alice" "assign_user_node"
set_var "COUNT" "42" "initialize_node"

# Getting variables
name=$(get_var "USER_NAME" "process_node")
count=$(get_var "COUNT" "calculate_node")

# Template variable processing (automatic conversion)
# YAML: "Hello {{user_name}}"
# Generated: "Hello $(get_var "USER_NAME" "template_node")"
```

### Debug Output Example:

```bash
# When FLOWSH_DEBUG=true
$ FLOWSH_DEBUG=true ./workflow.sh
[DEBUG] assign_user_node: SET USER_NAME = 'Alice'
[DEBUG] initialize_node: SET COUNT = '42'
[DEBUG] process_node: GET USER_NAME = 'Alice'
[DEBUG] calculate_node: GET COUNT = '42'
[DEBUG] result_node: SET RESULT = 'Alice_processed_42'
Workflow completed successfully
```

### Variable Assignment Node Integration:

```yaml
# YAML workflow node
- id: 'set_user'
  type: 'variable-assignment'
  data:
    variable: 'user_name'
    value: 'Alice'

# Generated shell code (automatic conversion)
set_var "USER_NAME" "Alice" "set_user"
```

## DOCUMENTATION:

- Current shell script generator: `src/generation/shell-generator.ts` (lines 289-333)
- Variable assignment node generator: `src/generation/generators/variable-assignment-node.ts`
- Template processing in base generator: `src/generation/generators/base-generator.ts` (lines 95-122)
- Example generated scripts: `scripts/generated-outputs/nodes/variable-assignment-node-example.sh`

## OTHER CONSIDERATIONS:

### Implementation Details:

- Generate `set_var()` and `get_var()` functions at the top of every shell script
- Modify variable assignment node generator to use `set_var()` instead of direct assignment
- Update template variable processing to use `get_var()` instead of `${VAR_NAME}`
- Add debug mode check in both functions using `FLOWSH_DEBUG` environment variable
- Use `declare -g` in `set_var()` to ensure global variable assignment
- Use `${!var_name}` indirect expansion in `get_var()` for dynamic variable access

### Backward Compatibility:

- All existing workflows must continue to generate and execute correctly
- No breaking changes to YAML workflow syntax
- Generated shell scripts should work identically with or without debug mode
- Performance impact should be minimal (simple function calls)

### Integration Points:

- Variable assignment nodes: Replace direct assignment with `set_var()` calls
- Template variables: Convert `{{variable}}` to `$(get_var "VARIABLE" "node_id")`
- Base generator utilities: Update template processing functions
- Shell script header: Add variable management functions to every generated script

### Success Criteria:

- All existing workflow examples in `examples/` continue to generate without errors
- Generated shell scripts execute correctly and produce same output as before
- Debug logging works when `FLOWSH_DEBUG=true` is set
- Variable assignment nodes use new function-based approach
- Template variables properly resolve using getter functions
- No performance degradation in workflow execution
- Clean, readable generated shell code
