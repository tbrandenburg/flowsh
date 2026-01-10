## FEATURE:

Complete the remaining critical work from the Test Suite Hardening Critical Countermeasures PRP to achieve 100% production readiness. The base PRP (PRPs/test-suite-hardening-critical-countermeasures-prp-20260111.md) is 85% complete but has critical blockers preventing deployment.

**Current Status Analysis:**

- Template consolidation: 85% complete (examples/nodes/ cleanup needed)
- Test pass rate: 91% (32/35 templates pass - TARGET: 100%)
- Syntax validation: 70% complete (infrastructure done, CI/CD integration missing)
- Escaping standardization: 60% complete (core generators not migrated)

**Critical Blockers Identified:**

1. **Template Execution Failures (CRITICAL)**: 3/35 templates failing execution
   - `circuit-breaker-basic-template.yaml` - Mock operation failure behavior
   - `variable-assignment-basic-template.yaml` - `Entry: command not found` error
   - `opencode-essay-simple-template.yaml` - Missing sequential iteration function

2. **Incomplete Escaping Migration (SECURITY RISK)**: Key generators still using custom escaping
   - LLM node: Custom JSON escaping instead of standardized `escapeForJSON()`
   - Telegram node: Custom escaping functions instead of standardized utilities
   - HTTP node: Custom variable escaping patterns

3. **Missing Production Quality Gates**: No automated validation in deployment pipeline
   - CI/CD integration not implemented (.github/workflows/quality-gates.yml missing)
   - Pre-commit hooks not implemented for syntax validation
   - Documentation still references old examples/ structure

**Objective:** Achieve 100% implementation of the 4 critical countermeasures to establish production-ready development culture with zero tolerance for test failures and systematic quality gates.

## EXAMPLES:

**Template Execution Success Pattern:**

```bash
# Current failing command:
make templates-all
# Shows: 32/35 templates successful (91%)

# Target successful command:
make templates-all
# Must show: 35/35 templates successful (100%)
```

**Escaping Standardization Pattern:**

```typescript
// BEFORE (custom escaping in LLM node):
const escapedContent = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');

// AFTER (standardized escaping):
import { ShellEscaping } from '../shell-scripting/shell-escaping.js';
const escapedContent = ShellEscaping.escapeForJSON(content);
```

**CI/CD Quality Gate Pattern:**

```yaml
# .github/workflows/quality-gates.yml
- name: Validate All Templates
  run: |
    make templates-validate  # YAML validation
    make templates-syntax    # Shell syntax validation  
    make templates-all       # Full execution testing
```

## DOCUMENTATION:

**Primary Reference:**

- `PRPs/test-suite-hardening-critical-countermeasures-prp-20260111.md` - Base PRP with detailed technical requirements and success criteria

**Implementation Status Documentation:**

- Current implementation analysis shows specific files and line numbers where work is needed
- Success criteria clearly defined for each countermeasure
- Architecture patterns established for escaping and validation

**Key Technical Resources:**

- `src/generation/shell-scripting/shell-escaping.ts` - Central escaping library (already implemented)
- `src/generation/generators/` - Node generators requiring escaping migration
- `Makefile` - Template validation targets (templates-syntax, templates-validate, templates-all)
- `templates/basic/` - 35 templates requiring 100% pass rate

## OTHER CONSIDERATIONS:

**Critical Success Metrics (Non-negotiable):**

- 100% template pass rate (35/35) in `make templates-all`
- Zero shell syntax errors across all templates
- All generators using standardized escaping (no custom escaping logic)
- CI/CD pipeline blocks deployment on template failures
- Pre-commit hooks prevent syntax errors from being committed

**Security Implications:**

- Incomplete escaping migration creates command injection risks
- Custom escaping logic in LLM/Telegram/HTTP nodes must be eliminated
- Template execution failures could mask security vulnerabilities

**Development Workflow Impact:**

- Until 100% pass rate achieved, development culture still tolerates failures
- Missing CI/CD integration means broken templates can reach production
- Dual maintenance burden persists until examples/nodes/ cleanup

**Timeline Constraints:**

- Phase 1 (Critical Fixes): 1-2 days maximum
- Phase 2 (Production Quality): 2-3 days maximum
- Total completion target: Within 1 week to maintain momentum

**Risk Mitigation:**

- Each template fix must be individually validated before proceeding
- Escaping migration must include comprehensive regression testing
- CI/CD integration should be tested with intentionally broken templates
- Documentation updates required after examples/nodes/ removal

**Success Validation Commands:**

```bash
# Must all pass for PRP completion:
make templates-all          # 35/35 successful
make templates-syntax       # 35/35 valid shell syntax
make templates-validate     # 35/35 valid YAML
flowsh init                 # Shows 35 unified templates
ls examples/nodes/          # Should return "No such file or directory"
```
