# Feature: Migrate Examples to Templates System Consolidation

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

This feature migrates all useful examples from the `examples/` directory into the existing template system and removes the examples system entirely from the codebase. The goal is to consolidate workflow discovery into a single, production-ready template system that follows flowsh's Unix philosophy of simplicity and focused functionality.

Currently, flowsh maintains two parallel systems for workflow discovery: 31 example files in `examples/` (including 19 node examples) and 36 production templates in `templates/`. This creates confusion for users and maintenance overhead. The migration will preserve all valuable functionality while eliminating redundancy.

## User Story

As a flowsh developer or user
I want to use a single, unified template system for discovering and creating workflows
So that I don't have to navigate between examples and templates, and can access all workflow patterns through the production-ready `flowsh init` command

## Problem Statement

The current dual-system approach creates several issues:

1. **User Confusion**: Users must understand two different discovery systems (examples vs templates)
2. **Maintenance Overhead**: 31 examples + 36 templates = 67 workflow files to maintain, test, and validate
3. **Documentation Fragmentation**: References scattered across README, AGENTS.md, and build system
4. **Testing Complexity**: Separate test pipelines for examples (`make examples-all`) and templates (`make templates-all`)
5. **Development Friction**: New contributors must learn both systems and understand their differences

## Solution Statement

Migrate all useful examples into the existing three-tier template system (basic/enhanced/advanced) and remove the examples directory entirely. This leverages flowsh's already robust template infrastructure (discovery, processing, preview, validation) while eliminating redundancy.

The migration preserves all educational and functional value while providing users with a single, consistent way to discover and use workflow patterns through `flowsh init`.

## Feature Metadata

**Feature Type**: Refactor
**Estimated Complexity**: Medium
**Primary Systems Affected**: Template system, Build system, Documentation, Testing infrastructure
**Dependencies**: Existing template system (src/templates/), Build pipeline (Makefile)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/templates/discovery.ts` (lines 1-180) - Why: Template discovery and indexing system architecture
- `src/templates/processor.ts` (lines 1-120) - Why: Template processing, validation, and file creation patterns
- `src/templates/analyzer.ts` (lines 1-90) - Why: Template metadata extraction and complexity analysis
- `src/cli/index.test.ts` (lines 25-100) - Why: Test patterns that use hardcoded example paths
- `Makefile` (lines 99-166, 55) - Why: Example processing targets that need removal
- `README.md` (lines 47, 276-280) - Why: Documentation references to examples
- `AGENTS.md` (lines 28, 117, 238) - Why: Agent instructions that reference examples
- `examples/hello-world.yaml` - Why: Simple example structure vs template structure comparison
- `templates/enhanced/ai-to-telegram-simple.yaml` (lines 1-50) - Why: Template structure and metadata patterns

### New Files to Create

- `dev/test-workflows/hello-world-test.yaml` - Test workflow for CLI tests (replaces examples/hello-world.yaml)
- `dev/test-workflows/counting-loop-test.yaml` - Test workflow for CLI tests (replaces examples/counting-loop.yaml)
- `templates/enhanced/hello-world-template.yaml` - Migrate hello-world example to enhanced template
- `templates/enhanced/counting-loop-template.yaml` - Migrate counting-loop example to enhanced template
- `templates/enhanced/file-processing-template.yaml` - Migrate file-processing-iteration example
- `templates/enhanced/api-aggregation-template.yaml` - Migrate api-data-aggregation example

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [AGENTS.md Template System Guidelines](file://./AGENTS.md#11-template-system) - Template usage patterns for AI agents
- [README.md Template Documentation](file://./README.md#init-new) - Template system user documentation
- [Makefile Template Targets](file://./Makefile#173-282) - Template validation and testing patterns

### Patterns to Follow

**Template Naming Convention:**

```bash
# Enhanced templates: descriptive-name-template.yaml
templates/enhanced/hello-world-template.yaml
templates/enhanced/api-aggregation-template.yaml

# Test workflows: descriptive-name-test.yaml
dev/test-workflows/hello-world-test.yaml
```

**Template Structure Pattern (from existing templates):**

```yaml
workflow:
  name: 'Descriptive Name'
  description: 'Production-ready description focusing on use case'

# Optional: environment_variables section for production templates
environment_variables:
  - variable: 'var_name'
    name: 'Display Name'
    type: 'text'
    description: 'User guidance'

graph:
  nodes: [...]
  edges: [...]
```

**Test File Updates Pattern (src/cli/index.test.ts lines 28-96):**

```typescript
// OLD: const command = `node dist/cli/index.js compile examples/hello-world.yaml -o ${testOutputFile}`;
// NEW: const command = `node dist/cli/index.js compile dev/test-workflows/hello-world-test.yaml -o ${testOutputFile}`;
```

**Makefile Target Removal Pattern:**

```bash
# Remove entire targets: examples-all, examples-workflows, validate (examples parts)
# Update qa target: qa: check templates-all (remove examples-all)
# Update help text: Remove example-related help entries
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation - Test Infrastructure Migration

Establish test workflow files in `dev/` to replace hardcoded example dependencies in CLI tests before removing examples.

**Tasks:**

- Create `dev/test-workflows/` directory structure
- Migrate specific examples used in tests to dev test workflows
- Update CLI test files to use new paths
- Validate that tests still pass with new paths

### Phase 2: Core Implementation - Example to Template Migration

Systematically migrate valuable examples to appropriate template categories based on complexity and use case.

**Tasks:**

- Analyze each example for template category placement (enhanced vs advanced)
- Migrate workflow examples to enhanced templates with production-ready metadata
- Ensure basic templates already cover all 19 node examples (verification only)
- Create any missing enhanced templates for workflow patterns

### Phase 3: Integration - Build and Documentation System Updates

Update all references to examples throughout the codebase, documentation, and build system.

**Tasks:**

- Remove examples-related targets from Makefile
- Update documentation references across README.md, AGENTS.md, and docs/
- Update QA pipeline to remove examples dependencies
- Validate that template system provides equivalent functionality

### Phase 4: Testing & Validation - Complete System Verification

Ensure the migration maintains all functionality while providing equivalent or better user experience.

**Tasks:**

- Run comprehensive template validation
- Verify QA pipeline works without examples
- Test template discovery and creation workflows
- Validate documentation accuracy and completeness

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### CREATE dev/test-workflows/hello-world-test.yaml

- **IMPLEMENT**: Copy examples/hello-world.yaml to dev/test-workflows/hello-world-test.yaml exactly
- **PATTERN**: Mirror exact YAML structure from examples/hello-world.yaml (lines 1-42)
- **GOTCHA**: Preserve all metadata, formatting, and comments for test consistency
- **VALIDATE**: `flowsh validate dev/test-workflows/hello-world-test.yaml`

### CREATE dev/test-workflows/counting-loop-test.yaml

- **IMPLEMENT**: Copy examples/counting-loop.yaml to dev/test-workflows/counting-loop-test.yaml exactly
- **PATTERN**: Mirror exact YAML structure from examples/counting-loop.yaml
- **GOTCHA**: Maintain environment variable structures for CLI test compatibility
- **VALIDATE**: `flowsh validate dev/test-workflows/counting-loop-test.yaml`

### UPDATE src/cli/index.test.ts

- **IMPLEMENT**: Replace all 7 hardcoded example paths with dev/test-workflows/ paths
- **PATTERN**: Update string literals: `examples/hello-world.yaml` → `dev/test-workflows/hello-world-test.yaml`
- **IMPORTS**: No additional imports needed
- **GOTCHA**: Ensure test descriptions remain accurate after path changes
- **VALIDATE**: `npm run test:run src/cli/index.test.ts`

### CREATE templates/enhanced/hello-world-template.yaml

- **IMPLEMENT**: Convert examples/hello-world.yaml to production template format
- **PATTERN**: Follow template structure from templates/enhanced/ai-to-telegram-simple.yaml (lines 1-20)
- **CHANGES**: Remove YAML metadata headers, enhance descriptions for production use
- **GOTCHA**: Preserve environment_variables section structure exactly
- **VALIDATE**: `flowsh init hello-world-template dev/generated-scripts/test-hello-world.yaml && flowsh validate dev/generated-scripts/test-hello-world.yaml`

### CREATE templates/enhanced/api-aggregation-template.yaml

- **IMPLEMENT**: Convert examples/api-data-aggregation.yaml to enhanced template
- **PATTERN**: Follow enhanced template structure with production-ready descriptions
- **METADATA**: Add complexity and use case descriptions in workflow description
- **GOTCHA**: Preserve all HTTP request configurations and error handling
- **VALIDATE**: `flowsh init api-aggregation-template dev/generated-scripts/test-api.yaml && flowsh validate dev/generated-scripts/test-api.yaml`

### CREATE templates/enhanced/file-processing-template.yaml

- **IMPLEMENT**: Convert examples/file-processing-iteration.yaml to enhanced template
- **PATTERN**: Enhanced template format with iteration node showcase
- **DESCRIPTION**: Focus on real-world file processing use case
- **GOTCHA**: Preserve iteration logic and variable handling exactly
- **VALIDATE**: `flowsh init file-processing-template dev/generated-scripts/test-file.yaml && flowsh validate dev/generated-scripts/test-file.yaml`

### CREATE templates/enhanced/counting-loop-template.yaml

- **IMPLEMENT**: Convert examples/counting-loop.yaml to enhanced template
- **PATTERN**: Enhanced template format showcasing loop control structures
- **METADATA**: Highlight loop safety features and iteration controls in description
- **GOTCHA**: Preserve loop condition logic and max_iterations safety features
- **VALIDATE**: `flowsh init counting-loop-template dev/generated-scripts/test-count.yaml && flowsh validate dev/generated-scripts/test-count.yaml`

### UPDATE Makefile

- **IMPLEMENT**: Remove examples-all, examples-workflows targets and references
- **PATTERN**: Remove lines 99-166 (examples-all target), lines 147-159 (examples-workflows target)
- **UPDATE**: Change line 55 from `qa: check examples-all templates-all` to `qa: check templates-all`
- **UPDATE**: Remove examples references from help text (lines 29-32)
- **UPDATE**: Remove validate target example references (lines 162-166)
- **GOTCHA**: Ensure QA pipeline still validates all functionality through templates
- **VALIDATE**: `make help && make qa`

### UPDATE README.md

- **IMPLEMENT**: Replace examples references with template equivalents
- **UPDATE**: Line 47: Replace examples/ references with template equivalents
- **UPDATE**: Lines 276-280: Replace "examples/ directory" with "templates/ system showcase"
- **PATTERN**: Follow template-first documentation approach throughout
- **GOTCHA**: Ensure all workflow showcases still work with new template references
- **VALIDATE**: `markdown-lint README.md || echo "README updated successfully"`

### UPDATE AGENTS.md

- **IMPLEMENT**: Remove examples system references and update agent instructions
- **UPDATE**: Line 28: Remove `examples/` from standard directories list
- **UPDATE**: Line 117: Update repository structure to remove examples/
- **UPDATE**: Line 238: Remove "Generated shell scripts in examples/ should be committed"
- **PATTERN**: Update agent workflows to use template-first approach
- **VALIDATE**: `grep -q examples AGENTS.md && echo "ERROR: examples references remain" || echo "AGENTS.md updated successfully"`

### UPDATE documentation files

- **IMPLEMENT**: Batch update all PRP and docs files to replace examples references
- **PATTERN**: Replace `examples/nodes/` with `templates/basic/`, `examples/` with `templates/`
- **SCOPE**: Update docs/ directory and PRPs/ directory files
- **GOTCHA**: Preserve any workflow-specific references that still apply to templates
- **VALIDATE**: `grep -r "examples/" docs/ PRPs/ || echo "Documentation updated successfully"`

### VALIDATE template system completeness

- **IMPLEMENT**: Verify all 19 node types have basic template equivalents
- **CHECK**: Confirm all valuable workflow examples have template equivalents
- **PATTERN**: Use `flowsh init` to verify template discovery works correctly
- **GOTCHA**: Ensure no functionality gaps exist after examples removal
- **VALIDATE**: `flowsh init --help | grep -q "Available Template Categories" && make templates-all`

### REMOVE examples directory

- **IMPLEMENT**: Remove entire examples/ directory after validation
- **PATTERN**: Use `rm -rf examples/` after confirming all migrations are successful
- **GOTCHA**: This is irreversible - ensure all valuable content is migrated
- **BACKUP**: Archive critical examples to dev/archived-examples/ before deletion if needed
- **VALIDATE**: `ls examples/ 2>/dev/null && echo "ERROR: examples directory still exists" || echo "Examples directory successfully removed"`

### VALIDATE complete migration

- **IMPLEMENT**: Run full QA pipeline to ensure no regressions
- **TESTS**: Execute all validation commands to confirm system integrity
- **PATTERN**: Follow existing QA validation approach from Makefile
- **GOTCHA**: Any test failures indicate incomplete migration requiring fixes
- **VALIDATE**: `make qa && npm test && echo "Migration completed successfully"`

---

## TESTING STRATEGY

### Unit Tests

**CLI Tests**: Verify CLI commands work with new dev/test-workflows/ paths

- Test compilation with new test workflow paths
- Validate output generation with migrated test files
- Ensure error handling remains consistent

**Template System Tests**: Validate migrated templates integrate correctly

- Test template discovery includes all migrated templates
- Verify template processing handles migrated content correctly
- Confirm template validation passes for all new enhanced templates

### Integration Tests

**QA Pipeline**: Ensure make qa works without examples system

- Validate templates-all provides equivalent coverage to examples-all
- Test that template validation catches equivalent issues
- Confirm build system operates correctly without examples

**Template Creation**: Test end-to-end template usage

- Verify `flowsh init` discovers all migrated templates
- Test template creation and compilation workflows
- Validate template preview functionality works with migrated content

### Edge Cases

**Missing Template Equivalents**: Ensure no examples functionality is lost
**Path Reference Updates**: Verify all hardcoded paths are updated
**Documentation Consistency**: Confirm all references point to existing content
**Build System Completeness**: Validate QA pipeline covers all necessary validation

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npm run lint:fix
npm run format
npm run build
```

### Level 2: Unit Tests

```bash
npm run test:run
npm test src/cli/index.test.ts
```

### Level 3: Integration Tests

```bash
make templates-all
make templates-validate
make templates-syntax
```

### Level 4: Manual Validation

```bash
# Template discovery
flowsh init --help

# Template creation from migrated examples
flowsh init hello-world-template dev/generated-scripts/test1.yaml
flowsh init api-aggregation-template dev/generated-scripts/test2.yaml
flowsh init file-processing-template dev/generated-scripts/test3.yaml

# Compilation validation
flowsh validate dev/generated-scripts/test1.yaml
flowsh validate dev/generated-scripts/test2.yaml
flowsh validate dev/generated-scripts/test3.yaml

# Documentation validation
grep -r "examples/" README.md AGENTS.md docs/ PRPs/ || echo "All references updated"
```

### Level 5: Additional Validation

```bash
# Full QA pipeline (critical)
make qa

# Template system completeness
flowsh init | grep -c "template" | awk '{if($1>=36) print "✓ Template count adequate"; else print "✗ Missing templates"}'

# Build system validation
make check
```

---

## ACCEPTANCE CRITERIA

- [ ] All 7 hardcoded example paths in CLI tests updated to dev/test-workflows/
- [ ] All valuable workflow examples migrated to appropriate enhanced templates
- [ ] All 19 node examples verified to have basic template equivalents
- [ ] Makefile examples targets removed and QA pipeline updated
- [ ] README.md and AGENTS.md updated with template-first approach
- [ ] All documentation references updated across docs/ and PRPs/
- [ ] Examples directory completely removed from repository
- [ ] Template system provides equivalent functionality to examples
- [ ] Full QA pipeline passes without examples dependencies
- [ ] CLI tests pass with new test workflow paths
- [ ] Template discovery includes all migrated content
- [ ] No regressions in existing template functionality
- [ ] Documentation is accurate and complete for template-only approach

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in sequential order
- [ ] Each task validation passed before proceeding
- [ ] CLI tests updated and passing with new paths
- [ ] All valuable examples migrated to templates
- [ ] Build system updated and functioning without examples
- [ ] Documentation comprehensively updated
- [ ] Examples directory removed successfully
- [ ] Full QA pipeline passes
- [ ] Template system completeness verified
- [ ] No hardcoded example references remain in codebase

---

## NOTES

**Migration Strategy**: This refactor consolidates two parallel systems into one, following flowsh's Unix philosophy of simplicity. The template system already has robust infrastructure for discovery, processing, validation, and testing - we're leveraging this existing investment rather than rebuilding.

**Backward Compatibility**: While removing the examples directory is a breaking change for developers who reference examples directly, the functionality is preserved and enhanced through the template system. Users will benefit from a single, consistent discovery mechanism.

**Quality Assurance**: The migration preserves all testing through the existing templates-all pipeline, which provides equivalent coverage to examples-all with better production-readiness validation.

**Risk Mitigation**: Each task has immediate validation, and the migration is structured to be reversible until the final removal step. Test infrastructure is updated first to ensure continuous validation throughout the process.
