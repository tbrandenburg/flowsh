# Feature: Fix Template Variable Initialization - Systematic Approach

## Feature Description

**The Problem**: Several advanced templates fail during "make qa" execution because variables are referenced in bash code blocks before being properly initialized at the script level. The core issue is that complex templates define many environment variables but don't ensure they are available as shell variables in subshells (bash -c blocks) where they're used.

**Current Failures**:

- `content-moderation-template.yaml`: `PROFANITY_WORDS: unbound variable` (line 553)
- `multi-format-distribution-template.yaml`: `email_content: unbound variable` (line 1096)
- `scheduled-content-generation-template.yaml`: `MAIN_CONTENT: unbound variable` (line 582)
- `circuit-breaker-template.yaml`: `PRIMARY_SUCCESS: unbound variable` (line 479)

**Root Cause**: Templates use extensive `environment_variables` sections that declare variables for template processing, but the actual shell script generation doesn't properly initialize these as global shell variables before they're used in code node bash blocks.

## User Story

As a flowsh template developer
I want all variables declared in `environment_variables` to be properly initialized as shell variables
So that templates execute successfully without "unbound variable" errors in strict bash mode (`set -euo pipefail`)

## Problem Statement

The flowsh template system allows defining environment variables for template processing, but doesn't ensure these variables are available as initialized shell variables when `bash -c` subshells execute. This causes runtime failures in strict bash mode when variables are referenced but not set.

## Solution Statement

Implement a systematic fix that simplifies template variable handling by ensuring all declared environment variables are properly initialized as shell variables at the script level before any node execution begins.

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: Template system, shell script generation, variable handling
**Dependencies**: Existing variable resolution system, shell generation pipeline

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/generation/shell-scripting/variable-init.ts` (lines 1-155) - Contains variable initialization generation logic
- `src/generation/shell-generator.ts` (lines 1-50) - Main shell generation entry point and variable processing
- `src/variables/resolver.ts` (lines 1-100) - Variable resolution from environment_variables sections
- `templates/enhanced/hello-world-template.yaml` (lines 1-42) - Working simple template pattern to follow
- `templates/advanced/content-distribution/content-moderation-template.yaml` (lines 1-100, 540-580) - Failing template pattern
- `dev/generated-outputs/templates/content-moderation-template.sh` (lines 550-570) - Generated script showing failure point

### New Files to Create

None - this is a fix to existing functionality

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `AGENTS.md` (lines 1-50) - Repository rules and guidelines
- `README.md` (lines 220-280) - Template system overview
- `src/templates/README.md` - Template system documentation (if exists)

### Patterns to Follow

**Simple Template Pattern** (from hello-world-template.yaml):

```yaml
environment_variables:
  - variable: 'greeting_target'
    name: 'Greeting Target'
    type: 'text'
    description: 'Who or what to greet in the message'
    default: 'World'
```

**Shell Variable Initialization Pattern** (from working hello-world script):

```bash
# Environment Variables
greeting_target=${greeting_target:-""}
GREETING_TARGET=${GREETING_TARGET:-""}
```

**Template Variable Usage Pattern**:

```bash
GREETING_TARGET="$(get_var "GREETING_TARGET" "generate_greeting")"
echo "Hello, $GREETING_TARGET!"
```

**Anti-pattern to Fix**:

```bash
# Variables defined in YAML but not initialized as shell vars
PROFANITY_WORDS="damn hell shit fuck ass bitch bastard crap stupid idiot moron dumb"
# This fails because PROFANITY_WORDS was never set as a shell variable
```

---

## IMPLEMENTATION PLAN

### Phase 1: Analysis and Preparation

**Understanding**: Analyze how variables flow from YAML environment_variables to shell script initialization

**Tasks:**

- Examine variable resolution pipeline from YAML to shell
- Map all failing templates and their unbound variables
- Identify why simple templates work but complex ones fail
- Document current variable initialization patterns

### Phase 2: Core Fix Implementation

**Core Change**: Ensure all environment_variables are initialized as shell variables regardless of complexity

**Tasks:**

- Update shell generation to initialize ALL declared environment variables
- Simplify variable handling by reducing complex processing where possible
- Ensure consistent variable naming between YAML and shell
- Add validation that all template-referenced variables are initialized

### Phase 3: Template Simplification

**Simplification**: Make templates show nodes clearly rather than complex variable processing

**Tasks:**

- Review failing templates for unnecessary variable complexity
- Simplify variable declarations where possible
- Ensure templates demonstrate node functionality rather than variable gymnastics
- Maintain production-ready examples without over-engineering

### Phase 4: Validation and Testing

**Validation**: Ensure all templates pass "make qa" systematically

**Tasks:**

- Test all templates locally before commit
- Run full qa pipeline to catch regressions
- Commit and push when locally passing
- Monitor CI runs with gh CLI

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### UPDATE src/generation/shell-generator.ts

- **IMPLEMENT**: Enhanced environment variable initialization in generated scripts
- **PATTERN**: Follow hello-world-template.yaml success pattern - initialize all env vars consistently
- **IMPORTS**: Import variable resolution utilities if needed
- **GOTCHA**: Ensure all variables from environment_variables YAML section are initialized as shell variables with proper defaults
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh compile templates/enhanced/hello-world-template.yaml | grep -A5 "Environment Variables"`

### UPDATE src/generation/shell-scripting/variable-init.ts

- **IMPLEMENT**: Ensure generateInitialization handles all environment_variables from YAML templates
- **PATTERN**: Mirror existing variable initialization pattern but make it comprehensive
- **IMPORTS**: Use existing ShellEscaping and ResolvedVariable types
- **GOTCHA**: Initialize variables even if they have empty defaults to prevent "unbound variable" errors
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && npm test -- --grep "variable.*init"`

### SIMPLIFY templates/advanced/content-distribution/content-moderation-template.yaml

- **IMPLEMENT**: Reduce the massive environment_variables list to only essential variables
- **PATTERN**: Follow hello-world pattern - use simple variable declarations with clear defaults
- **REMOVE**: Variables that are only used within single code blocks (make them local instead)
- **GOTCHA**: Keep template functionality but reduce variable complexity
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/content-moderation-template.yaml`

### SIMPLIFY templates/advanced/content-distribution/multi-format-distribution-template.yaml

- **IMPLEMENT**: Similar simplification to content-moderation template
- **PATTERN**: Essential variables only, local variables for single-use cases
- **REMOVE**: Unnecessary environment variable declarations
- **GOTCHA**: Maintain template's educational value while reducing complexity
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/multi-format-distribution-template.yaml`

### SIMPLIFY templates/advanced/content-distribution/scheduled-content-generation-template.yaml

- **IMPLEMENT**: Reduce variable complexity similar to other templates
- **PATTERN**: Simple environment_variables section with clear defaults
- **REMOVE**: Over-engineered variable processing
- **GOTCHA**: Focus on showing node functionality rather than variable processing
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/scheduled-content-generation-template.yaml`

### SIMPLIFY templates/advanced/reliability/circuit-breaker-template.yaml

- **IMPLEMENT**: Simplify circuit breaker template variables
- **PATTERN**: Essential circuit breaker variables only
- **REMOVE**: Unnecessary variable assignments
- **GOTCHA**: Keep circuit breaker logic clear and functional
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/reliability/circuit-breaker-template.yaml`

### UPDATE src/variables/resolver.ts

- **IMPLEMENT**: Enhanced resolution to ensure all YAML environment_variables are included in shell initialization
- **PATTERN**: Ensure comprehensive variable resolution for all declared variables
- **IMPORTS**: Use existing variable resolution patterns
- **GOTCHA**: Handle both simple and complex variable declarations consistently
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && npm test -- --grep "variable.*resolv"`

### TEST Local Validation Before Commit

- **IMPLEMENT**: Run full template validation locally to ensure all fixes work
- **PATTERN**: Sequential validation of all fixed templates
- **COMMAND**: `cd /home/tom/workspace/ai/made/workspace/flowsh && timeout 900 make qa`
- **GOTCHA**: Use proper timeout (15 minutes) as specified in AGENTS.md
- **VALIDATE**: All templates should compile and execute without unbound variable errors

### COMMIT Fix When All Templates Pass

- **IMPLEMENT**: Commit and push the systematic fix
- **PATTERN**: Create descriptive commit message explaining the fix
- **COMMAND**: `cd /home/tom/workspace/ai/made/workspace/flowsh && git add . && git commit -m "fix: systematic template variable initialization - resolve unbound variable errors" && git push`
- **GOTCHA**: Only commit when make qa passes locally
- **VALIDATE**: `cd /home/tom/workspace/ai/made/workspace/flowsh && gh run list --limit 1`

### MONITOR CI Pipeline with gh CLI

- **IMPLEMENT**: Monitor GitHub Actions workflow to ensure CI passes
- **PATTERN**: Use gh CLI to track workflow status
- **COMMAND**: `cd /home/tom/workspace/ai/made/workspace/flowsh && gh run watch`
- **GOTCHA**: Watch for any remaining failures and address them
- **VALIDATE**: CI should show all checks passing

---

## TESTING STRATEGY

### Unit Tests

**Shell Generation Tests**: Verify that shell generation properly initializes all environment variables
**Variable Resolution Tests**: Ensure all YAML environment_variables are resolved to shell variables

### Integration Tests

**Template Compilation**: All templates should compile without syntax errors
**Template Execution**: All templates should execute without unbound variable errors

### Edge Cases

- Templates with no environment_variables (should work unchanged)
- Templates with complex variable references (should be simplified)
- Templates with empty variable defaults (should initialize to empty string)
- Nested variable references within bash code blocks

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
cd /home/tom/workspace/ai/made/workspace/flowsh && npm run lint
cd /home/tom/workspace/ai/made/workspace/flowsh && npm run format:check
```

### Level 2: Unit Tests

```bash
cd /home/tom/workspace/ai/made/workspace/flowsh && npm test
cd /home/tom/workspace/ai/made/workspace/flowsh && npm test -- --grep "variable"
cd /home/tom/workspace/ai/made/workspace/flowsh && npm test -- --grep "shell.*generat"
```

### Level 3: Template Validation

```bash
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/content-moderation-template.yaml
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/multi-format-distribution-template.yaml
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/content-distribution/scheduled-content-generation-template.yaml
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh validate templates/advanced/reliability/circuit-breaker-template.yaml
```

### Level 4: Compilation Testing

```bash
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh compile templates/advanced/content-distribution/content-moderation-template.yaml >/dev/null
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh compile templates/advanced/content-distribution/multi-format-distribution-template.yaml >/dev/null
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh compile templates/advanced/content-distribution/scheduled-content-generation-template.yaml >/dev/null
cd /home/tom/workspace/ai/made/workspace/flowsh && flowsh compile templates/advanced/reliability/circuit-breaker-template.yaml >/dev/null
```

### Level 5: Full QA Pipeline

```bash
cd /home/tom/workspace/ai/made/workspace/flowsh && timeout 900 make qa
```

---

## ACCEPTANCE CRITERIA

- [ ] All 4 failing templates now pass compilation and execution
- [ ] No "unbound variable" errors in any template
- [ ] Templates are simplified to focus on node functionality rather than variable complexity
- [ ] All unit tests pass with enhanced variable handling
- [ ] Full make qa pipeline passes locally (within 15 minute timeout)
- [ ] CI pipeline passes after push
- [ ] Template patterns are consistent and follow working examples
- [ ] No regressions in working templates
- [ ] Generated shell scripts properly initialize all environment variables

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes (unit + integration)
- [ ] No linting or type checking errors
- [ ] Manual testing confirms all templates work
- [ ] Acceptance criteria all met
- [ ] Code reviewed for quality and maintainability
- [ ] Local make qa passes before commit
- [ ] Successfully pushed and CI passes

---

## NOTES

**Key Insight**: The issue isn't with complex variable processing - it's that bash subshells (`bash -c`) don't inherit variables that aren't properly exported/initialized at the script level. The fix is to ensure ALL environment_variables declared in YAML templates are initialized as shell variables before any node execution.

**Simplification Philosophy**: Templates should demonstrate flowsh node capabilities, not complex variable processing. Keep variables essential for the workflow functionality, make internal processing variables local to code blocks where they're used.

**Testing Approach**: Use the working hello-world-template.yaml as the gold standard pattern. All complex templates should follow the same basic variable initialization pattern.

**Confidence Score**: 8/10 - Clear root cause identified, systematic approach planned, working patterns available to follow.
