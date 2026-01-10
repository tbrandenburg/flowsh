name: "Conversation Variables Enhancement PRP"
description: |
Fix broken template substitution system and enhance conversation variables with defaults,
proper shell initialization, and runtime variable handling capabilities.

## Goal

Fix the currently broken conversation variables system in flowsh and enhance it to provide:

1. **Working template substitution** - `{{user_topic}}` variables actually get replaced
2. **Automatic shell initialization** - Generate `USER_TOPIC="${USER_TOPIC:-"default"}"` code
3. **Enhanced variable-assignment nodes** - Handle missing variables gracefully with defaults/failures
4. **All 14 existing templates work** - Full backward compatibility while adding new capabilities

## Why

- **Critical Bug Fix**: Current conversation variables are completely non-functional (template substitution fails)
- **Template System Integrity**: 14 production templates define conversation_variables but they don't work
- **User Experience**: Users expect `flowsh init template.yaml` → `flowsh compile template.yaml` to work seamlessly
- **Unix Philosophy Alignment**: Enable external variable provision without breaking pipe-friendly design
- **Development Workflow**: Fix QA pipeline issues where templates with undefined variables fail

## What

### User-Visible Behavior

1. **Template Authors** can define conversation variables with defaults that actually work:

   ```yaml
   conversation_variables:
     - variable: user_topic
       type: text-input
       default: 'AI in Software Development'
       required: true
   ```

2. **End Users** can provide variables via environment or let defaults work:

   ```bash
   # Option 1: Use defaults
   flowsh compile template.yaml > script.sh

   # Option 2: Provide via environment
   export USER_TOPIC="Custom Topic"
   flowsh compile template.yaml > script.sh

   # Option 3: CLI args (future)
   flowsh compile template.yaml --var USER_TOPIC="Custom Topic" > script.sh
   ```

3. **Generated Shell Scripts** include proper variable initialization:
   ```bash
   #!/bin/bash
   # Auto-generated variable initialization
   USER_TOPIC="${USER_TOPIC:-"AI in Software Development"}"
   MAX_PARTS="${MAX_PARTS:-"3"}"
   # ... rest of workflow
   ```

### Success Criteria

- [ ] All 14 existing templates compile and execute successfully with defaults
- [ ] Template substitution works: `{{user_topic}}` becomes actual values in shell scripts
- [ ] `make qa` passes (all templates execute without variable errors)
- [ ] New variable-assignment node options handle missing variables appropriately
- [ ] Users can override defaults via environment variables
- [ ] Generated shell scripts are safe and follow `set -euo pipefail` standards
- [ ] 100% backward compatibility - no existing template breaks

## All Needed Context

### Documentation & References

```yaml
- file: templates/enhanced/opencode-essay-simple-template.yaml
  why: Primary example of broken conversation_variables usage - has defaults and {{substitution}}

- file: src/dsl/types.ts
  why: Current type definitions for conversation variables, needs enhancement for defaults/options
  critical: WorkflowConversationVariable doesn't support defaults but templates use them

- file: src/generation/generators/variable-assignment-node.ts
  why: Existing variable assignment logic, needs enhancement for on_empty/default_value handling

- file: src/generation/shell-scripting/index.ts
  why: Shell script generation pipeline, needs variable initialization generation
  line: 496 # Where conversation variables are currently processed but not used

- file: src/parsing/parser.ts
  why: YAML parsing logic for conversation_variables, may need updates for enhanced syntax
  line: 398-399 # Current parsing of conversation_variables

- file: Makefile
  why: QA pipeline that currently fails due to undefined variables in templates
  critical: make qa executes all templates including ones with Telegram nodes

- docfile: AGENTS.md
  why: Repository rules and quality standards, must maintain Unix philosophy
  critical: FORBIDDEN to create files in repo root, must use dev/ for temporary files
```

### Current Codebase Tree (Key Areas)

```bash
flowsh/
├── src/
│   ├── dsl/
│   │   ├── types.ts                    # Type definitions - needs WorkflowConversationVariable enhancement
│   │   └── validation.ts               # Schema validation
│   ├── parsing/
│   │   └── parser.ts                   # YAML parsing - conversation_variables handling
│   ├── generation/
│   │   ├── generators/
│   │   │   └── variable-assignment-node.ts  # Variable assignment logic - needs enhancement
│   │   ├── registry/                   # Plugin registry system
│   │   └── shell-scripting/
│   │       └── index.ts                # Shell generation - needs variable initialization
│   └── cli/
│       └── index.ts                    # CLI entry point
├── templates/
│   ├── enhanced/                       # 4 templates with conversation_variables
│   └── advanced/                       # 10 templates, some with conversation_variables
└── examples/
    └── nodes/                          # Example variable-assignment usage
```

### Desired Codebase Tree with New Files

```bash
flowsh/
├── src/
│   ├── variables/                      # NEW: Variable resolution system
│   │   ├── resolver.ts                 # Variable resolution logic
│   │   ├── types.ts                    # Variable resolution types
│   │   └── defaults.ts                 # Default value handling
│   ├── generation/
│   │   └── shell-scripting/
│   │       ├── variable-init.ts        # NEW: Variable initialization generation
│   │       └── template-substitution.ts # NEW: Template variable substitution
└── dev/
    ├── test-workflows/                 # Test YAML files for validation
    └── generated-scripts/              # Generated test scripts
```

### Known Gotchas of Codebase & Library Quirks

```typescript
// CRITICAL: flowsh follows strict repository rules from AGENTS.md
// - NO files in repo root except core config files
// - ALL temporary files MUST go under dev/ (gitignored)
// - MUST run "make qa" after ALL code changes
// - QA pipeline executes ALL templates including ones with Telegram nodes

// CRITICAL: Registry-based plugin system architecture
// - All node generators extend BaseNodeGenerator
// - New functionality must integrate with existing registry
// - Cannot break the plugin architecture

// CRITICAL: Shell script generation safety
// - Generated scripts must use `set -euo pipefail`
// - All variables must be properly escaped for shell injection protection
// - ShellEscaping.forExpressionContext() must be used for user input

// GOTCHA: Current conversation_variables parsing exists but is incomplete
// - Parser reads conversation_variables from YAML (parser.ts:398)
// - Shell generator references them (index.ts:496) but doesn't use them
// - WorkflowConversationVariable type doesn't match template usage

// GOTCHA: Template substitution is completely broken
// - {{user_topic}} remains literal in generated shell scripts
// - No template engine exists in the pipeline
// - Variables are parsed but never resolved or substituted

// GOTCHA: Variable naming conventions matter for Unix philosophy
// - Environment variables should be UPPER_CASE (USER_TOPIC)
// - Template variables are lowercase (user_topic)
// - Need consistent mapping between them

// GOTCHA: QA pipeline sensitivity
// - make qa runs ALL templates including ones with Telegram integration
// - Templates with undefined variables will fail script execution
// - Defaults must be comprehensive enough for QA environment
```

## Implementation Blueprint

### Data Models and Structure

First, enhance the type system to properly support conversation variables with defaults:

```typescript
// src/dsl/types.ts - Enhance WorkflowConversationVariable
export interface WorkflowConversationVariable {
  variable: string;
  name: string;
  type: VariableType;
  description?: string;
  required?: boolean;
  default?: string | number | boolean; // NEW: Support defaults
  options?: Array<{ value: string; label: string }>; // NEW: Support select options
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// src/variables/types.ts - NEW: Variable resolution types
export interface ResolvedVariable {
  name: string;
  value: string;
  source: 'environment' | 'default' | 'cli-arg' | 'required-missing';
  uppercase_name: string; // USER_TOPIC for bash
}

export interface VariableResolutionConfig {
  use_defaults: boolean;
  fail_on_missing_required: boolean;
  variable_sources: VariableSource[];
}

export type VariableSource =
  | { type: 'environment' }
  | { type: 'defaults' }
  | { type: 'cli-args'; args: Record<string, string> };
```

### List of Tasks to Complete (In Order)

```yaml
Task 1: Enhance Conversation Variables Type System
MODIFY src/dsl/types.ts:
  - FIND: "export interface WorkflowConversationVariable"
  - EXTEND: Add support for default, options, validation fields
  - PRESERVE: Existing fields for backward compatibility
  - PATTERN: Mirror SelectVariable, TextVariable interfaces that already support defaults

Task 2: Create Variable Resolution System
CREATE src/variables/resolver.ts:
  - IMPLEMENT: Variable resolution with priority order (env > defaults > required-missing)
  - PATTERN: Use neverthrow Result types for error handling (see existing codebase)
  - CRITICAL: Map lowercase template vars (user_topic) to UPPER_CASE bash vars (USER_TOPIC)

CREATE src/variables/defaults.ts:
  - IMPLEMENT: Default value processing and validation
  - HANDLE: Type conversion (string -> number/boolean as needed)
  - PATTERN: Follow existing validation patterns from src/dsl/validation.ts

Task 3: Implement Shell Variable Initialization Generation
CREATE src/generation/shell-scripting/variable-init.ts:
  - GENERATE: Bash initialization code with parameter expansion
  - PATTERN: USER_TOPIC="${USER_TOPIC:-"default_value"}"
  - CRITICAL: Use ShellEscaping for all user-provided default values
  - INTEGRATE: With existing ShellScriptBuilder class

Task 4: Implement Template Substitution Engine
CREATE src/generation/shell-scripting/template-substitution.ts:
  - REPLACE: {{user_topic}} with resolved variable values in shell scripts
  - PATTERN: Simple regex replacement, avoid complex Handlebars logic
  - CRITICAL: Handle nested quotes and shell escaping properly
  - SCOPE: Only basic substitution, no conditional logic {{#if}}

Task 5: Enhance Variable Assignment Node
MODIFY src/generation/generators/variable-assignment-node.ts:
  - ADD: on_empty, default_value, fail_on_empty options to node data interface
  - IMPLEMENT: Runtime handling of missing variables
  - PATTERN: Follow existing BaseNodeGenerator patterns
  - PRESERVE: Existing functionality for backward compatibility

Task 6: Integrate Variable Resolution into Compilation Pipeline
MODIFY src/generation/shell-scripting/index.ts:
  - FIND: generateArgumentParsing method (line ~494)
  - INTEGRATE: Variable resolution before shell script generation
  - ADD: Variable initialization generation at script start
  - PATTERN: Use existing GenerationContext for passing resolved variables

Task 7: Update All 14 Templates with Proper Defaults
MODIFY templates/enhanced/*.yaml + templates/advanced/*/*.yaml:
  - FIND: All conversation_variables sections
  - ADD: Comprehensive default values for QA pipeline compatibility
  - REMOVE: Complex {{#if}} template logic, replace with workflow nodes
  - VALIDATE: Each template compiles and executes with defaults

Task 8: Add CLI Support for Variable Overrides
MODIFY src/cli/index.ts:
  - ADD: --var flag to compile command for individual variable override
  - IMPLEMENT: Variable parsing and validation
  - INTEGRATE: With variable resolution system
  - PATTERN: Follow existing CLI argument handling patterns

Task 9: Comprehensive Testing and QA Validation
CREATE dev/test-workflows/variable-resolution-tests.yaml:
  - TEST: All variable resolution scenarios
  - TEST: Default handling, missing required variables
  - TEST: Environment variable override behavior

RUN make qa:
  - VALIDATE: All 14 templates execute successfully
  - FIX: Any remaining variable-related failures
  - CONFIRM: Backward compatibility maintained
```

### Per Task Pseudocode

```typescript
// Task 1: Enhanced Type System
interface WorkflowConversationVariable {
  variable: string;
  name: string;
  type: VariableType;
  description?: string;
  required?: boolean;
  default?: string | number | boolean; // NEW
  options?: Array<{ value: string; label: string }>; // NEW
  // PATTERN: Mirror existing Variable interfaces
}

// Task 2: Variable Resolution
class VariableResolver {
  resolve(
    convVars: WorkflowConversationVariable[],
    sources: VariableSource[]
  ): Result<ResolvedVariable[], VariableResolutionError> {
    // PRIORITY: environment > defaults > fail if required
    // MAPPING: user_topic -> USER_TOPIC
    // VALIDATION: Use existing Joi patterns
  }
}

// Task 3: Shell Initialization
class VariableInitGenerator {
  generateInitialization(resolved: ResolvedVariable[]): string {
    // PATTERN: USER_TOPIC="${USER_TOPIC:-"default"}"
    // CRITICAL: ShellEscaping.forExpressionContext(default)
    // OUTPUT: Multi-line bash variable initialization block
  }
}

// Task 4: Template Substitution
class TemplateSubstitution {
  substitute(template: string, resolved: ResolvedVariable[]): string {
    // SIMPLE: template.replace(/\{\{(\w+)\}\}/g, replacer)
    // MAPPING: {{user_topic}} -> resolved value for user_topic
    // NO COMPLEX LOGIC: No {{#if}} or conditionals
  }
}

// Task 5: Enhanced Variable Assignment
class VariableAssignmentNodeGenerator {
  generate(node: WorkflowNode, context: GenerationContext): string {
    // NEW OPTIONS:
    const on_empty = node.data.on_empty || 'fail'; // 'use_default', 'warn', 'fail'
    const default_value = node.data.default_value;
    const fail_on_empty = node.data.fail_on_empty ?? true;

    // RUNTIME HANDLING: Check variable existence, apply defaults
    // PATTERN: Follow existing error handling patterns
  }
}
```

### Integration Points

```yaml
SHELL_GENERATION:
  - modify: src/generation/shell-scripting/index.ts
  - inject: Variable initialization at script start (after shebang, before main logic)
  - pattern: "generateVariableInitialization() + existing script content"

PARSING_PIPELINE:
  - modify: src/parsing/parser.ts
  - enhance: conversation_variables parsing to handle new fields
  - validate: Schema validation for new default/options fields

CLI_INTERFACE:
  - modify: src/cli/index.ts
  - add: --var flag to compile command
  - pattern: "program.command('compile').option('--var <key=value>', 'description', collect)"

TEMPLATE_SYSTEM:
  - modify: All 14 templates in templates/enhanced/ and templates/advanced/
  - add: Comprehensive defaults for all conversation_variables
  - remove: {{#if}} conditional logic, replace with proper workflow nodes
```

## Validation Loop

### Level 1: Type Safety & Syntax

```bash
# Run these FIRST - fix any errors before proceeding
npm run build                          # TypeScript compilation
npm run lint                           # ESLint checking
npm run format:check                   # Prettier formatting
npm run test                           # Unit tests

# Expected: No TypeScript errors, linting passes, tests pass
# If errors: READ the error message, understand root cause, fix code
```

### Level 2: Template Validation

```bash
# Validate all templates compile without errors
make templates-validate                # Validate YAML syntax
flowsh validate templates/enhanced/opencode-essay-simple-template.yaml

# Test template compilation with defaults
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > dev/generated-scripts/test-essay.sh

# Expected: Clean compilation, no {{user_topic}} literals in output
# If failing: Check variable resolution and template substitution
```

### Level 3: Variable Resolution Testing

```bash
# Test environment variable override
export USER_TOPIC="Test Topic Override"
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > dev/generated-scripts/test-override.sh
grep "Test Topic Override" dev/generated-scripts/test-override.sh

# Test default value usage (no environment variables set)
unset USER_TOPIC MAX_PARTS
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > dev/generated-scripts/test-defaults.sh
grep "AI in Software Development" dev/generated-scripts/test-defaults.sh

# Expected: Variable substitution works in both scenarios
```

### Level 4: Integration Test - QA Pipeline

```bash
# The ultimate test - QA pipeline must pass completely
make qa

# This runs ALL templates including:
# - Template validation
# - Compilation
# - Execution (including Telegram templates)
# Expected: All templates execute successfully with defaults
# If failing: Templates have undefined variables or other issues
```

### Level 5: Manual End-to-End Testing

```bash
# Test the OpenCode essay workflow end-to-end
export TELEGRAM_BOT_TOKEN="test_token" TELEGRAM_CHAT_ID="test_chat"
export USER_TOPIC="Manual Test Topic" MAX_PARTS="2"

flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > dev/generated-scripts/manual-test.sh
chmod +x dev/generated-scripts/manual-test.sh

# Review generated script for proper variable initialization
head -20 dev/generated-scripts/manual-test.sh

# Expected:
# #!/bin/bash
# set -euo pipefail
# USER_TOPIC="${USER_TOPIC:-"AI in Software Development"}"
# MAX_PARTS="${MAX_PARTS:-"3"}"
```

## Final Validation Checklist

- [ ] All TypeScript compilation passes: `npm run build`
- [ ] All unit tests pass: `npm run test`
- [ ] All templates validate: `make templates-validate`
- [ ] QA pipeline passes completely: `make qa`
- [ ] Template substitution works: No `{{variables}}` in generated scripts
- [ ] Environment override works: `USER_TOPIC=override` changes output
- [ ] Default values work: Unset variables use template defaults
- [ ] Required variable validation: Missing required vars fail appropriately
- [ ] All 14 templates execute successfully with defaults
- [ ] Generated shell scripts follow safety standards (`set -euo pipefail`)
- [ ] Variable naming is consistent: lowercase YAML -> UPPERCASE bash
- [ ] Backward compatibility: Existing templates work unchanged

---

## Anti-Patterns to Avoid

- ❌ Don't break existing registry architecture - enhance within the system
- ❌ Don't create interactive features - maintain Unix philosophy
- ❌ Don't use complex template engines - keep substitution simple
- ❌ Don't ignore shell escaping - use ShellEscaping utilities
- ❌ Don't break backward compatibility - existing templates must continue working
- ❌ Don't create files in repository root - use dev/ for all temporary files
- ❌ Don't skip the QA validation - make qa must pass completely
- ❌ Don't hardcode variable names - use the conversation_variables definitions
- ❌ Don't assume environment variables exist - always provide defaults
- ❌ Don't ignore required field validation - fail fast on missing required variables
