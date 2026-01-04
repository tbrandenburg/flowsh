# PRP: Variable Management System with Debug Logging

## FEATURE SPECIFICATION

### Overview

Implement a basic variable management system with setter/getter functions and debug logging to replace the current direct variable assignment approach in generated shell scripts.

### Current State Analysis

- Direct variable assignments like `USER_NAME="Alice"` and `RESULT="${USER_NAME}_processed"`
- No centralized variable management or debugging capabilities
- Template variables use direct shell variable expansion `${VAR_NAME}`

### Target State

- Function-based variable management with `set_var()` and `get_var()` functions
- Debug logging controlled by `FLOWSH_DEBUG=true` environment variable
- All variable operations logged with node context for debugging
- 100% backward compatibility maintained

## TECHNICAL REQUIREMENTS

### Core Functions

1. **set_var(var_name, value, node_id)**
   - Uses `declare -g` for global variable assignment
   - Logs debug info when `FLOWSH_DEBUG=true`
   - Format: `[DEBUG] node_id: SET VAR_NAME = 'value'`
   - Output to stderr

2. **get_var(var_name, node_id)**
   - Uses `${!var_name}` indirect expansion for dynamic access
   - Logs debug info when `FLOWSH_DEBUG=true`
   - Format: `[DEBUG] node_id: GET VAR_NAME = 'value'`
   - Returns variable value to stdout

### Integration Points

- **Shell Script Generator** (`src/generation/shell-generator.ts:289-333`): Add functions to script header
- **Variable Assignment Node** (`src/generation/generators/variable-assignment-node.ts`): Replace direct assignment
- **Template Processing** (`src/generation/generators/base-generator.ts:95-122`): Convert `{{variable}}` to getter calls
- **Generated Scripts** (`scripts/generated-outputs/nodes/variable-assignment-node-example.sh`): Update examples

## IMPLEMENTATION PLAN

### Phase 1: Core Function Development

**Files to modify:**

- `src/generation/shell-generator.ts`

**Tasks:**

1. Create `generateVariableFunctions()` method
2. Add function generation to script header
3. Implement debug logging logic
4. Test function generation in isolation

**Validation:**

- Functions appear in generated scripts
- Debug mode toggles correctly
- Function syntax is valid bash

### Phase 2: Variable Assignment Integration

**Files to modify:**

- `src/generation/generators/variable-assignment-node.ts`

**Tasks:**

1. Replace direct assignment with `set_var()` calls
2. Pass node ID from workflow context
3. Handle edge cases (empty values, special characters)
4. Update unit tests

**Validation:**

- Variable assignment nodes generate `set_var()` calls
- Node IDs propagate correctly
- All test cases pass

### Phase 3: Template Variable Conversion

**Files to modify:**

- `src/generation/generators/base-generator.ts`

**Tasks:**

1. Update template processing to use `get_var()`
2. Convert `{{variable}}` patterns to `$(get_var "VARIABLE" "node_id")`
3. Handle template variable naming conventions
4. Test complex template scenarios

**Validation:**

- Template variables resolve correctly
- Complex templates with multiple variables work
- Generated code is readable

### Phase 4: Testing & Validation

**Files to create/modify:**

- Test files for new functionality
- Update existing test suites
- Validate example workflows

**Tasks:**

1. Create unit tests for variable functions
2. Test debug logging output
3. Validate all example workflows
4. Performance testing
5. Backward compatibility verification

**Validation:**

- All existing examples generate without errors
- Generated scripts execute correctly
- Debug output matches expected format
- No performance degradation

## EXAMPLES

### Basic Usage

```bash
# Before (direct assignment)
USER_NAME="Alice"
RESULT="${USER_NAME}_processed"

# After (function-based)
set_var "USER_NAME" "Alice" "node1"
RESULT=$(get_var "USER_NAME" "node2")_processed
set_var "RESULT" "$RESULT" "node2"
```

### Debug Output

```bash
$ FLOWSH_DEBUG=true ./workflow.sh
[DEBUG] assign_user_node: SET USER_NAME = 'Alice'
[DEBUG] initialize_node: SET COUNT = '42'
[DEBUG] process_node: GET USER_NAME = 'Alice'
[DEBUG] calculate_node: GET COUNT = '42'
[DEBUG] result_node: SET RESULT = 'Alice_processed_42'
Workflow completed successfully
```

### YAML to Shell Conversion

```yaml
# YAML workflow node
- id: 'set_user'
  type: 'variable-assignment'
  data:
    variable: 'user_name'
    value: 'Alice'

# Generated shell code
set_var "USER_NAME" "Alice" "set_user"
```

### Template Variable Processing

```yaml
# YAML template: "Hello {{user_name}}"
# Generated: "Hello $(get_var "USER_NAME" "template_node")"
```

## SUCCESS CRITERIA

### Functional Requirements

- [ ] All existing workflows in `examples/` generate without errors
- [ ] Generated shell scripts execute correctly and produce identical output
- [ ] Debug logging works when `FLOWSH_DEBUG=true` is set
- [ ] Variable assignment nodes use new function-based approach
- [ ] Template variables properly resolve using getter functions

### Non-Functional Requirements

- [ ] No performance degradation in workflow execution
- [ ] Clean, readable generated shell code
- [ ] 100% backward compatibility maintained
- [ ] No breaking changes to YAML workflow syntax

### Quality Assurance

- [ ] Comprehensive test coverage for new functionality
- [ ] All edge cases handled (empty values, special characters, long variable names)
- [ ] Error handling for invalid variable names or missing variables
- [ ] Documentation updated to reflect new approach

## IMPLEMENTATION NOTES

### Code Generation Strategy

1. **Function Placement**: Add variable management functions at the top of every generated script after shebang and before any other code
2. **Node ID Handling**: Use "root" as default node ID when not provided from workflow context
3. **Error Handling**: Functions should handle invalid inputs gracefully and provide meaningful error messages
4. **Performance**: Keep function implementations lightweight to minimize overhead

### Backward Compatibility Considerations

- Existing direct variable assignments should continue to work alongside function-based approach
- No changes to YAML workflow syntax required
- Generated scripts should work identically with or without debug mode
- Template variable syntax remains unchanged in YAML files

### Debug Output Specifications

- All debug output goes to stderr to avoid interfering with script output
- Format: `[DEBUG] node_id: SET/GET VAR_NAME = 'value'`
- Single quotes around values to clearly show boundaries
- Node ID helps trace variable operations through workflow execution

### Testing Strategy

1. **Unit Tests**: Test individual functions with various inputs
2. **Integration Tests**: Test end-to-end workflow generation and execution
3. **Regression Tests**: Ensure all existing examples continue to work
4. **Performance Tests**: Measure impact of function calls vs direct assignment
5. **Compatibility Tests**: Verify scripts work across different shell environments

## RISK MITIGATION

### Potential Issues

1. **Shell Compatibility**: Functions may not work in all shell environments
   - _Mitigation_: Test with common shells (bash, sh, zsh)
   - _Fallback_: Provide compatibility checks in generated code

2. **Variable Name Conflicts**: Function names might conflict with user variables
   - _Mitigation_: Use prefixed function names (`flowsh_set_var`, `flowsh_get_var`)
   - _Testing_: Validate with workflows containing similar variable names

3. **Performance Impact**: Function calls add overhead vs direct assignment
   - _Mitigation_: Keep functions lightweight, measure performance impact
   - _Monitoring_: Add optional performance logging mode

4. **Debug Output Volume**: Large workflows might produce excessive debug output
   - _Mitigation_: Consider debug levels or filtering options
   - _Documentation_: Provide guidance on managing debug output

### Rollback Plan

- Feature can be disabled via configuration flag
- Direct assignment fallback mode available
- Gradual rollout possible (opt-in initially)
- Clear migration path for existing projects

## COMPLETION CHECKLIST

### Development Phase

- [ ] Core function implementation complete
- [ ] Shell script generator updated
- [ ] Variable assignment node generator modified
- [ ] Template processing updated
- [ ] Unit tests written and passing

### Validation Phase

- [ ] All existing examples generate successfully
- [ ] Generated scripts execute without errors
- [ ] Debug logging produces expected output
- [ ] Performance impact measured and acceptable
- [ ] Cross-shell compatibility verified

### Documentation Phase

- [ ] Code comments added to all modified files
- [ ] User documentation updated
- [ ] Developer documentation updated
- [ ] Example workflows updated to demonstrate new features
- [ ] Migration guide created for existing projects

### Release Phase

- [ ] Feature flag configuration implemented
- [ ] Backward compatibility verified
- [ ] Release notes prepared
- [ ] Deployment plan finalized
- [ ] Monitoring and alerting configured
