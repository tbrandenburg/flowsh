# PRP: Phase 1 - Critical Runtime Fixes

**PRP ID**: phase1-critical-runtime-fixes-prp-20250109  
**Date**: January 9, 2026  
**Priority**: URGENT  
**Timeline**: 1-2 weeks  
**Context**: Critical runtime issues discovered during OpenCode integration work

---

## Objective

Fix critical runtime issues in flowsh that cause generated shell scripts to fail despite successful validation. Focus on bash quoting problems, template variable processing inconsistencies, and developer tooling gaps that affect production reliability.

## Background

During OpenCode Poem to Telegram template development, we discovered that templates validate successfully but can fail at runtime due to:

- Bash quoting issues with template variables containing spaces/special characters
- Inconsistent template variable processing (`${var}`, `{{var}}`, `$(get_var ...)`)
- Lack of debug/dry-run modes for troubleshooting
- Poor error messages without context

These issues represent a fundamental reliability problem that must be addressed before flowsh can be trusted for production use.

## Detailed Requirements

### 1. Fix Bash Quoting & Escaping Problems

**Problem**: Template variables with spaces/special characters break generated scripts

- `poem_theme="hello world"` generates `opencode run "hello world"` but variable substitution can break quoting
- Scripts fail at runtime despite successful validation

**Requirements**:

- [ ] Review all generators in `src/generation/generators/` for quoting issues
- [ ] Implement consistent escaping strategy across all node types
- [ ] Test with edge cases (spaces, special chars, quotes, newlines)
- [ ] Ensure all generated shell scripts properly quote variable substitutions
- [ ] Add comprehensive test cases for problematic characters

**Files to modify**:

- `src/generation/generators/*.ts` (all generator files)
- `src/generation/shell-scripting/index.ts`
- Add new test files for quoting scenarios

### 2. Resolve Template Variable Substitution Inconsistencies

**Problem**: Multiple syntax formats with inconsistent behavior

- `$(get_var "TEST_PROMPT" "test_opencode")` appearing in heredocs instead of actual values
- Generated scripts contain shell command syntax instead of resolved values

**Requirements**:

- [ ] Standardize on single variable syntax (recommend `{{var}}`)
- [ ] Fix heredoc variable processing to use actual values
- [ ] Ensure runtime values vs. shell commands are properly distinguished
- [ ] Update all templates to use consistent syntax
- [ ] Add validation for unsupported variable syntax patterns

**Files to modify**:

- `src/generation/template-engine/index.ts`
- `src/generation/generators/agent-node.ts` (primary focus)
- `templates/enhanced/*.yaml`
- `templates/advanced/*/*.yaml`

### 3. Add Debug/Dry-Run Modes

**Problem**: Cannot inspect generated scripts without executing them

**Requirements**:

- [ ] Add `flowsh compile --debug` flag to show variable substitution steps
- [ ] Add `flowsh compile --dry-run` flag for validation without side effects
- [ ] Add `flowsh compile --verbose` flag to show generator decisions
- [ ] Output should show step-by-step template processing
- [ ] Include variable resolution details in debug mode

**Files to modify**:

- `src/cli/index.ts` (add new CLI options)
- `src/generation/shell-generator.ts` (add debug output)
- `src/generation/generators/base-generator.ts` (debug infrastructure)

### 4. Improve Error Messages with Context

**Problem**: Generic validation errors don't help locate problems

**Requirements**:

- [ ] Add file paths and line numbers to error messages
- [ ] Suggest fixes for common issues
- [ ] Better validation reporting with specific node references
- [ ] Show which template or workflow file caused the error
- [ ] Include suggested resolution steps in error messages

**Files to modify**:

- `src/parsing/parser.ts`
- `src/dsl/validation.ts`
- `src/errors/types.ts`
- `src/security/yaml-validator.ts`

## Technical Approach

### Bash Quoting Strategy

1. Implement a central `shellEscape()` function for consistent quoting
2. Use bash parameter expansion with proper quoting: `"${var}"`
3. Escape special characters according to bash rules
4. Test with edge cases in automated test suite

### Variable Processing Fix

1. Audit all template processing code for inconsistent patterns
2. Implement single source of truth for variable resolution
3. Ensure heredoc processing resolves variables at generation time
4. Add validation to prevent shell command syntax in final output

### Debug Infrastructure

1. Add compilation context tracking throughout generation pipeline
2. Implement step-by-step logging for template processing
3. Create structured debug output that's easy to parse
4. Ensure debug mode doesn't affect normal operation performance

## Success Criteria

### Must Have

- [ ] All 14 templates compile and execute without bash quoting errors
- [ ] All 19+ node examples in `examples/nodes/` compile and execute successfully
- [ ] All workflow examples in `examples/` compile and execute successfully
- [ ] Template variables consistently resolve to actual values (not shell commands)
- [ ] `--debug` and `--dry-run` modes available and functional
- [ ] Error messages include file context and suggested fixes
- [ ] Zero regression in existing working templates, examples, or workflows

### Quality Gates

- [ ] All existing tests pass (unit tests, integration tests, manual tests)
- [ ] New test coverage for edge cases (spaces, quotes, special chars)
- [ ] Template integration tests pass
- [ ] Node example integration tests pass
- [ ] Workflow example integration tests pass
- [ ] Test suite runs successfully with new debug/dry-run modes
- [ ] Documentation updated for new CLI flags

## Testing Strategy

### Unit Tests

- [ ] Test `shellEscape()` function with all special characters
- [ ] Test each generator with problematic variable values
- [ ] Test debug output formatting and completeness

### Integration Tests

- [ ] Execute all 14 templates with edge case variables
- [ ] Execute all 19+ node examples with problematic variable values
- [ ] Execute all workflow examples in `examples/` directory
- [ ] Test `examples/counting-loop.yaml`, `examples/api-data-aggregation.yaml`, `examples/hello-world.yaml`
- [ ] Verify no shell syntax errors in any generated scripts
- [ ] Test debug mode with complex workflows and node examples
- [ ] Ensure `make examples-all` and `make templates-all` succeed

### Edge Case Testing

- [ ] Variables with spaces: `"hello world"`
- [ ] Variables with quotes: `'single' and "double"`
- [ ] Variables with shell metacharacters: `$()`, `$(`, backticks
- [ ] Variables with newlines and special characters

## Risk Mitigation

### Backward Compatibility

- Maintain support for existing template syntax during transition
- Provide clear migration guide for any breaking changes
- Test all existing examples and templates for regressions

### Quality Assurance

- Run comprehensive test suite before and after changes
- Validate generated scripts execute successfully
- Ensure debug mode doesn't impact performance

## Validation Approach

### Before Implementation

1. Document all current quoting issues with specific examples
2. Create comprehensive test cases for edge scenarios
3. Identify all template processing code paths

### During Implementation

1. Test each component change independently
2. Verify debug output is helpful and accurate
3. Ensure error messages provide actionable information

### After Implementation

1. Execute all templates with problematic variables
2. Execute all node examples with edge case scenarios
3. Execute all workflow examples to ensure no regressions
4. Verify no shell errors in any generated scripts (templates, examples, workflows)
5. Test debug and dry-run modes with complex workflows and node examples
6. Confirm error messages help users resolve issues quickly
7. Run full test suite (`npm test`) and Makefile targets (`make check`, `make examples-all`, `make templates-all`)
8. Verify all Makefile integration tests pass

## Dependencies

- Agent node fixes (completed) provide foundation
- Generator registry system must remain stable
- Template system architecture should not change significantly

## Deliverables

### Code Changes

1. Updated generator files with consistent quoting
2. Fixed template processing engine
3. New CLI debug and dry-run modes
4. Improved error handling and messaging

### Tests

1. Comprehensive unit tests for edge cases
2. Integration tests for all templates
3. Debug mode functionality tests

### Documentation

1. Updated CLI help for new flags
2. Developer guide for debugging templates
3. Migration guide if syntax changes required

---

**Next Steps**: Begin with comprehensive audit of current quoting issues, then implement `shellEscape()` function and test with edge cases.
