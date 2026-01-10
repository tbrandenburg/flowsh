name: "Variable Resolution Finalization PRP"
description: |
Complete the integration of the existing variable resolution system into flowsh's compilation
pipeline to fix template default handling and achieve full QA pipeline success.

## Goal

Complete the final 20% of the conversation variables enhancement by integrating the existing
variable resolution infrastructure into the main compilation pipeline.

**Current Status**: All core components implemented (~80% done) but not connected
**Target**: Full template default integration + `make qa` success

## Why

- **Critical Integration Gap**: Variable resolution system exists but isn't used in compilation
- **Broken Template Defaults**: Generated scripts show `USER_TOPIC=${USER_TOPIC:-""}` instead of template defaults
- **QA Pipeline Blocking**: `make qa` likely fails due to undefined variables in generated scripts
- **User Experience**: Templates with conversation_variables don't work as expected
- **Unix Philosophy**: Keep it simple - just fix the integration, skip unnecessary --var flag

## What

### User-Visible Behavior

**Current (Broken)**:

```bash
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > script.sh
# Generated script has: USER_TOPIC=${USER_TOPIC:-""}
```

**After Fix (Working)**:

```bash
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > script.sh
# Generated script has: USER_TOPIC=${USER_TOPIC:-"AI in Software Development"}

# Users can then run with defaults or override
./script.sh                                    # Uses template defaults
USER_TOPIC="Custom Topic" ./script.sh         # Uses environment override
```

### Success Criteria

- [ ] Template defaults properly integrated into generated shell scripts
- [ ] `make qa` passes completely (all 14 templates execute successfully)
- [ ] Generated scripts follow safety standards (`set -euo pipefail`)
- [ ] 100% backward compatibility maintained
- [ ] No CLI --var flag needed (Unix philosophy violation)

## All Needed Context

### Existing Infrastructure (Already Implemented ✅)

```yaml
- directory: src/variables/
  status: COMPLETE - All classes implemented
  files:
    - resolver.ts: Variable resolution with priority order
    - defaults.ts: Default value processing
    - types.ts: Complete type definitions
    - index.ts: Proper exports

- file: src/dsl/types.ts
  status: COMPLETE - WorkflowConversationVariable enhanced with defaults/options
  line: 434-447

- file: src/generation/shell-scripting/variable-init.ts
  status: COMPLETE - Shell variable initialization generation

- file: src/generation/shell-scripting/template-substitution.ts
  status: COMPLETE - Template {{variable}} substitution engine

- file: src/generation/generators/variable-assignment-node.ts
  status: COMPLETE - Enhanced with on_empty/default_value options
  line: 22-24
```

### Integration Point (Needs Connection ❌)

```yaml
- file: src/generation/shell-generator.ts
  status: NEEDS_INTEGRATION
  line: 391-406 # generateVariableSetup() function
  issue: Still uses basic implementation, doesn't import/use variable resolution system
  critical: This is the main integration point that connects everything

- file: src/generation/shell-scripting/index.ts
  status: NEEDS_REVIEW
  line: 496 # Where conversation variables are referenced but not used
  issue: May need updates to use new variable resolution flow
```

### Template Status (Ready ✅)

```yaml
- templates: All 14 templates have proper conversation_variables with defaults
  location: templates/enhanced/*.yaml + templates/advanced/*/*.yaml
  example: templates/enhanced/opencode-essay-simple-template.yaml
  status: READY - conversation_variables sections properly defined
```

### Known Gotchas

```typescript
// CRITICAL: Repository rules from AGENTS.md
// - Must run "make qa" after ALL changes
// - ALL temporary files go under dev/ (gitignored)
// - Generated scripts must use `set -euo pipefail`

// GOTCHA: Main integration point is generateVariableSetup()
// - Current implementation in src/generation/shell-generator.ts:391-406
// - Generates basic bash parameter expansion
// - Needs to be replaced with VariableResolver + VariableInitGenerator flow

// GOTCHA: Variable name mapping
// - Template: user_topic (lowercase)
// - Bash: USER_TOPIC (UPPERCASE)
// - VariableResolver already handles this mapping correctly

// GOTCHA: Shell escaping is critical
// - All user-provided defaults must use ShellEscaping.forExpressionContext()
// - VariableInitGenerator already implements this correctly

// GOTCHA: QA pipeline includes Telegram templates
// - make qa executes ALL templates including ones requiring Telegram tokens
// - Templates must have comprehensive defaults for QA environment
// - Already implemented in templates, just need proper integration
```

## Implementation Blueprint

### Integration Architecture

The integration is straightforward since all components exist:

```typescript
// Current Flow (BROKEN)
generateVariableSetup(workflow: Workflow): string {
  // Basic parameter expansion without template defaults
  return conversation_variables.map(v =>
    `${v.variable.toUpperCase()}=\${${v.variable.toUpperCase()}:-""}`
  ).join('\n');
}

// Target Flow (WORKING)
generateVariableSetup(workflow: Workflow): string {
  // 1. Resolve variables with template defaults
  const resolved = VariableResolver.resolve(workflow.conversation_variables, [
    { type: 'environment' },
    { type: 'defaults' }
  ]);

  // 2. Generate proper initialization
  return VariableInitGenerator.generateCompleteSetup(resolved.unwrap());
}
```

### List of Tasks to Complete (In Order)

```yaml
Task 1: Update Shell Generator Integration Point
MODIFY src/generation/shell-generator.ts:
  - FIND: generateVariableSetup() function (lines 391-406)
  - REPLACE: Basic implementation with variable resolution integration
  - IMPORTS: Add VariableResolver, VariableInitGenerator, TemplateSubstitution
  - PATTERN: Follow existing error handling patterns with neverthrow Result types

Task 2: Test Integration with Primary Template
TEST templates/enhanced/opencode-essay-simple-template.yaml:
  - COMPILE: flowsh compile template.yaml > dev/generated-scripts/test.sh
  - VERIFY: Generated script contains proper defaults from conversation_variables
  - EXPECTED: USER_TOPIC=${USER_TOPIC:-"AI in Software Development"}
  - EXPECTED: MAX_PARTS=${MAX_PARTS:-"3"}

Task 3: Template Substitution Integration (If Needed)
ANALYZE: Whether {{variable}} patterns in workflow nodes need substitution
  - SCOPE: Only if templates use {{user_topic}} in workflow node content
  - INTEGRATE: TemplateSubstitution into node content generation if needed
  - PATTERN: Apply substitution before shell escaping

Task 4: Full QA Pipeline Validation
RUN make qa:
  - VALIDATE: All 14 templates compile without errors
  - VALIDATE: All generated scripts execute without undefined variable errors
  - FIX: Any remaining integration issues
  - CRITICAL: QA pipeline must pass completely

Task 5: Manual End-to-End Testing
TEST complete workflow:
  - COMPILE: Multiple templates with different conversation_variables
  - EXECUTE: Generated scripts with and without environment overrides
  - VERIFY: Template defaults work, environment overrides work
  - CONFIRM: Unix philosophy maintained (compile once, run many ways)
```

### Per Task Implementation Details

```typescript
// Task 1: Shell Generator Integration
// File: src/generation/shell-generator.ts

// BEFORE (lines 391-406)
private generateVariableSetup(workflow: Workflow): string {
  // Basic implementation
}

// AFTER (complete replacement)
import { VariableResolver } from '../variables/resolver';
import { VariableInitGenerator } from './shell-scripting/variable-init';

private generateVariableSetup(workflow: Workflow): string {
  if (!workflow.conversation_variables?.length) {
    return '';
  }

  // Resolve variables with template defaults
  const resolutionResult = VariableResolver.resolve(
    workflow.conversation_variables,
    [
      { type: 'environment' },
      { type: 'defaults' }
    ]
  );

  if (resolutionResult.isErr()) {
    throw new Error(`Variable resolution failed: ${resolutionResult.error.message}`);
  }

  // Generate complete variable initialization
  return VariableInitGenerator.generateCompleteSetup(resolutionResult.value);
}
```

## Validation Loop

### Level 1: Integration Testing

```bash
# Test primary template compilation
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > dev/generated-scripts/integration-test.sh

# Verify proper variable initialization
head -10 dev/generated-scripts/integration-test.sh
# EXPECTED:
# #!/bin/bash
# set -euo pipefail
# USER_TOPIC="${USER_TOPIC:-"AI in Software Development"}"
# MAX_PARTS="${MAX_PARTS:-"3"}"

# MUST NOT CONTAIN: USER_TOPIC="${USER_TOPIC:-""}"
```

### Level 2: QA Pipeline Success

```bash
# The ultimate validation
make qa

# EXPECTED: All templates execute successfully
# IF FAILING: Integration is incomplete or templates have issues
```

### Level 3: Runtime Behavior Testing

```bash
# Test default usage
./dev/generated-scripts/integration-test.sh
# EXPECTED: Uses template defaults successfully

# Test environment override
USER_TOPIC="Override Test" ./dev/generated-scripts/integration-test.sh
# EXPECTED: Uses override value successfully
```

## Final Validation Checklist

- [ ] `generateVariableSetup()` uses VariableResolver and VariableInitGenerator
- [ ] Generated scripts contain template defaults, not empty strings
- [ ] `make qa` passes completely
- [ ] All 14 templates compile and execute successfully
- [ ] Environment variable override works at runtime
- [ ] Template defaults work when no environment variables set
- [ ] Generated scripts follow safety standards (`set -euo pipefail`)
- [ ] Backward compatibility maintained (existing templates unchanged)
- [ ] No CLI --var flag implemented (Unix philosophy preserved)

---

## Success Definition

**Primary**: Generated shell scripts contain proper template defaults from conversation_variables
**Secondary**: `make qa` passes completely with all 14 templates executing successfully  
**Tertiary**: Users can compile once and run with various environment variable configurations

This finalization should take the existing ~80% complete implementation to 100% functional state.
