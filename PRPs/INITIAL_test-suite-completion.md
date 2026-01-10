## FEATURE: Complete Test Suite Hardening Implementation

**Base PRP Reference**: `test-suite-hardening-critical-countermeasures-prp-20260111.md`

This PRP addresses the remaining **15% of critical work** needed to achieve 100% production readiness from the base Test Suite Hardening PRP. The base PRP successfully implemented template consolidation (19 basic templates + 14 existing = 33 total templates), but **3 critical blockers** remain preventing full deployment.

**Current Status Analysis**:

- ✅ **Template Consolidation**: COMPLETED (33 templates unified under templates/ hierarchy)
- ✅ **Basic Template System**: COMPLETED (19 basic templates converted from examples/nodes/)
- ⚠️ **Template Pass Rate**: 97% (32/33) - **2 templates failing execution**
- ❌ **Escaping Standardization**: NOT IMPLEMENTED - generators still use custom escaping
- ❌ **CI/CD Integration**: NOT IMPLEMENTED - no automated quality gates
- ❌ **Pre-commit Hooks**: NOT IMPLEMENTED - no syntax validation gates

## EXAMPLES:

### Critical Blocker 1: Template Execution Failures

```bash
# Current failing templates identified:
templates/basic/variable-assignment-basic-template.yaml
# Error: "line 423: Entry: command not found"

templates/enhanced/opencode-essay-simple-template.yaml
# Error: "execute_iteration_content_iterator_sequential: command not found"

# These failures block 100% template pass rate requirement
```

### Critical Blocker 2: Inconsistent Escaping Causing Shell Syntax Errors

```typescript
// Current pattern in generators - INCONSISTENT:
// telegram-node.ts - Custom escaping logic
const escapingCode = this.generateEscapingCode(parseMode);

// variable-assignment-node.ts - Different approach
// Convert single-quoted echo to double-quoted with proper escaping

// llm-node.ts - Another custom implementation
// Each generator reinvents escaping with different bugs
```

### Critical Blocker 3: Missing Production Quality Gates

```bash
# NO CI/CD pipeline exists:
ls .github/workflows/  # Empty - no automated validation

# NO pre-commit hooks active:
ls .git/hooks/pre-commit  # Only samples, no active validation

# NO syntax validation in build process:
make templates-syntax  # Command doesn't exist yet
```

## DOCUMENTATION:

### Architecture References

- **Base PRP**: `/PRPs/test-suite-hardening-critical-countermeasures-prp-20260111.md`
- **Repository Rules**: `/AGENTS.md` - Critical quality assurance requirements
- **Current Template System**: `/templates/` hierarchy (basic/, enhanced/, advanced/)

### Implementation Requirements

- **Shell Escaping Standards**: Follow Unix philosophy - readable, safe, predictable
- **Template Validation**: YAML structure + Shell syntax + Execution testing
- **CI/CD Integration**: Block deployment on any template failures
- **Pre-commit Validation**: Prevent broken templates from being committed

### Quality Standards

- **100% Template Pass Rate**: All 33 templates must compile and execute successfully
- **Zero Shell Syntax Errors**: bash -n validation must pass for all generated scripts
- **Standardized Escaping**: Single utility library used by all generators
- **Production Quality Gates**: Automated validation prevents regression

## OTHER CONSIDERATIONS:

### Security & Safety

- **Shell Injection Prevention**: Centralized escaping must prevent command injection
- **Template Variable Security**: Proper validation of user-provided template variables
- **Generated Script Safety**: All scripts use `set -euo pipefail` for error handling

### Performance Requirements

- **Fast Validation**: Template syntax checking must complete in <30 seconds
- **Parallel Testing**: Template execution testing should leverage parallel processing
- **Build Integration**: Quality gates must not significantly slow development workflow

### Backward Compatibility

- **Template API Stability**: Existing template creation patterns must continue working
- **Generator Interface**: Node generator interface must remain stable during escaping migration
- **CLI Compatibility**: `flowsh init`, `flowsh compile`, `flowsh validate` behavior preserved

### Success Criteria

1. **Template Execution**: `make templates-all` shows 33/33 successful executions
2. **Shell Syntax**: `make templates-syntax` shows 33/33 valid shell syntax (new command)
3. **CI/CD Integration**: GitHub Actions workflow validates templates on every PR
4. **Pre-commit Hooks**: Local validation prevents syntax errors from being committed
5. **Escaping Migration**: All 19+ generators use centralized escaping utilities
6. **Documentation Cleanup**: Remove references to deprecated examples/nodes/ directory

### Integration Points

- **Registry System**: Escaping changes must integrate cleanly with existing node registry
- **Template Metadata**: Enhanced templates require proper complexity/env var documentation
- **CLI Interface**: Quality gate commands must integrate with existing Makefile targets
- **Error Reporting**: Clear error messages when templates fail validation or execution

### Technical Debt Elimination

- **Single Testing Command**: Unified `make templates-all` replaces fragmented approaches
- **Consolidated Escaping**: Eliminate 19 different escaping implementations
- **Automated Quality**: Replace manual template validation with automated gates
- **Clean Directory Structure**: Complete removal of examples/nodes/ dual maintenance

This focused completion work builds directly on the 85% completion achieved by the base PRP, targeting the specific blockers preventing production deployment while preserving all architectural decisions and progress made in the initial implementation.
