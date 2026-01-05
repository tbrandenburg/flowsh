# PRP: Phase 1 - Missing Function Implementations (Quick Wins)

## PROJECT CONTEXT

**Repository**: flowsh - YAML workflow to shell script compiler
**Current Status**: 11/19 examples passing (57.9% success rate)
**Goal**: Fix missing function implementations to improve success rate to 14-15/19

## PROBLEM STATEMENT

Three node examples are failing due to missing function implementations that are called by their generators but don't exist in the generated shell scripts. These are "command not found" errors that can be fixed with mock implementations.

## FEATURE:

### Primary Objective

Add missing function mocks to `generateUtilityFunctions()` in `src/generation/shell-scripting/index.ts` to resolve "command not found" errors for:

1. **Circuit Breaker Node**: `execute_circuit_breaker_operation: command not found`
2. **Retry Node**: `execute_retry_command: command not found`
3. **Iteration Node**: `execute_iteration_iterate_files_sequential: command not found`

### Secondary Objective

Fix fallback strategy template processing in `FallbackNodeGenerator` where empty strategy values are not being processed correctly.

### Technical Requirements

- Add mock function implementations that log appropriately and return success (exit code 0)
- Functions should integrate with existing logging system (log_info, log_success, etc.)
- Functions should simulate realistic execution time (1-3 seconds) for testing
- Maintain consistency with existing mock function patterns in the codebase

### Expected Impact

- **Circuit Breaker Example**: Move from failing to passing
- **Retry Example**: Move from failing to passing
- **Iteration Example**: Move from failing to passing
- **Fallback Example**: Move from failing to passing
- **Overall Success Rate**: 11/19 → 15/19 (78.9% success)

## EXAMPLES:

### Example 1: Circuit Breaker Mock Function

```bash
# Mock circuit breaker operation for testing
execute_circuit_breaker_operation() {
    local operation_description="${1:-circuit breaker operation}"
    log_info "Mock circuit breaker: executing $operation_description"

    # Simulate operation execution time
    sleep 2

    # Simulate occasional failures for realistic circuit breaker testing
    if [[ $((RANDOM % 4)) -eq 0 ]]; then
        log_warning "Mock circuit breaker operation failed (simulated)"
        return 1
    else
        log_success "Mock circuit breaker operation completed successfully"
        return 0
    fi
}
```

### Example 2: Retry Command Mock Function

```bash
# Mock retry command execution
execute_retry_command() {
    local attempt_number="${1:-1}"
    local max_attempts="${2:-3}"
    log_info "Mock retry command execution (attempt $attempt_number/$max_attempts)"

    # Simulate work
    sleep 1

    # Simulate success after 2 attempts for realistic retry testing
    if [[ $attempt_number -ge 2 ]]; then
        log_success "Mock retry command succeeded on attempt $attempt_number"
        return 0
    else
        log_warning "Mock retry command failed on attempt $attempt_number"
        return 1
    fi
}
```

### Example 3: Sequential Iteration Mock Function

```bash
# Mock sequential iteration processing
execute_iteration_iterate_files_sequential() {
    local file_pattern="${1:-*}"
    local process_count=0

    log_info "Mock sequential iteration: processing files matching '$file_pattern'"

    # Simulate processing multiple files
    for i in {1..3}; do
        log_debug "Processing mock file $i"
        sleep 0.5
        ((process_count++))
    done

    log_success "Mock sequential iteration completed: processed $process_count files"
    return 0
}
```

## DOCUMENTATION:

### Current Codebase References

- **Shell Scripting Utils**: `src/generation/shell-scripting/index.ts` - Contains `generateUtilityFunctions()` where mock functions are added
- **Existing Mock Functions**: Lines 184-274 show patterns for `mock_opencode()`, `mock_llm()`, `mock_command()`
- **Generator Files**:
  - `src/generation/generators/circuit-breaker-node.ts` - Calls `execute_circuit_breaker_operation`
  - `src/generation/generators/retry-fallback-node.ts` - Calls `execute_retry_command`
  - Need to locate iteration node generator that calls `execute_iteration_iterate_files_sequential`

### Error Messages Reference

From `make examples-all` execution results:

- Circuit breaker: `scripts/generated-outputs/nodes/circuit-breaker-node-example.sh: line 368: execute_circuit_breaker_operation: command not found`
- Retry: `timeout: failed to run command 'execute_retry_command': No such file or directory`
- Iteration: `scripts/generated-outputs/nodes/iteration-node-example.sh: line 374: execute_iteration_iterate_files_sequential: command not found`

### Testing Documentation

- **Test Command**: `make examples-all` - Compiles and executes all 19 node examples
- **Results Location**: `scripts/execution-results/nodes/` - Contains detailed execution logs
- **Success Metric**: Examples should execute without "command not found" errors

## OTHER CONSIDERATIONS:

### Implementation Order

1. **Start with missing functions** - Add the three mock functions to `generateUtilityFunctions()`
2. **Fix fallback strategy** - Apply `processConfigValue()` to strategy field in FallbackNodeGenerator
3. **Test incrementally** - Run `make examples-all` after each function addition
4. **Verify success** - Confirm each example moves from failing to passing

### Code Integration

- Place mock functions in the existing "Resource Management Functions" section
- Follow existing patterns for logging and return codes
- Ensure functions are properly exported in the generated shell scripts
- Test that functions are available when called by node generators

### Fallback Strategy Fix

The fallback node shows `"Unknown fallback strategy: "` (empty value), indicating the template variable `${strategy}` is not being processed. Apply the same `processConfigValue()` pattern used in other generators:

```typescript
// In FallbackNodeGenerator.generate()
const strategy = this.processConfigValue(data.strategy, 'sequential');
```

### Risk Mitigation

- **Mock functions should never hang** - Include timeouts and realistic execution times
- **Consistent exit codes** - Use 0 for success, 1 for expected failures
- **Proper logging levels** - Use appropriate log levels (info, warning, success) for different scenarios
- **Resource cleanup** - Ensure mocks don't leave temporary files or processes

### Success Criteria

- **Circuit Breaker Example**: Passes execution test (`✅ Executed successfully`)
- **Retry Example**: Passes execution test with proper retry behavior simulation
- **Iteration Example**: Passes execution test with mock file processing
- **Fallback Example**: Passes execution test with non-empty strategy
- **Overall Improvement**: Move from 11/19 to 15/19 examples passing (minimum target)
- **No Regression**: Previously passing examples continue to pass

### Files to Modify

1. `src/generation/shell-scripting/index.ts` - Add mock functions to `generateUtilityFunctions()`
2. `src/generation/generators/retry-fallback-node.ts` - Fix fallback strategy processing
3. **Optional**: Locate and examine iteration node generator for completeness

### Testing Strategy

1. **Incremental testing** - Test each function addition separately
2. **Full regression test** - Run complete `make examples-all` suite
3. **Log analysis** - Review execution results for each fixed example
4. **Performance check** - Ensure mock functions complete within reasonable time (under 60s timeout)
