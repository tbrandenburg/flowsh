# PRP: Phase 2 - Developer Experience Enhancements

**PRP ID**: phase2-developer-experience-enhancements-prp-20250109  
**Date**: January 9, 2026  
**Priority**: HIGH  
**Timeline**: 3-5 days (not 2-3 weeks)  
**Prerequisites**: Phase 1 critical fixes completed  
**Context**: Improve development velocity and template reliability after core runtime issues resolved

---

## Objective

Enhance developer experience and template system reliability by implementing **simple, focused** improvements following the KISS principle. This phase builds on Phase 1 fixes to create essential safety nets and usability improvements without over-engineering.

## Background

With critical runtime issues resolved in Phase 1, we need to establish **minimal but effective** development infrastructure to:

- Prevent regression of issues like the agent args bug (simple tests for critical generators)
- Ensure templates don't fail at runtime due to missing environment variables (basic validation)
- Provide basic template discovery improvements (simple CLI enhancements)
- Create lightweight testing practices for ongoing development

**KISS Principle**: Focus on simple, effective solutions that solve real problems without creating unnecessary complexity. Avoid comprehensive frameworks in favor of targeted fixes.

## Detailed Requirements (KISS Approach)

### 1. Fix Existing Broken Tests + Add Basic Tests for Critical Generators

**Problem**: Some existing tests are broken, and critical generators lack basic tests

**Simple Solution**:

- [ ] Fix broken telegram-node tests (function naming convention changed)
- [ ] Add basic unit tests for 3 critical generators: `agent-node.ts`, `llm-node.ts`, `code-node.ts`
- [ ] Use existing simple test patterns, no new frameworks

**Files to modify**:

- `src/generation/generators/telegram-node.test.ts` (fix broken tests)
- `src/generation/generators/agent-node.test.ts` (create)
- `src/generation/generators/llm-node.test.ts` (create)
- `src/generation/generators/code-node.test.ts` (create)

**Approach**: Follow existing test patterns from `http-request-node.test.ts`. Simple input/output validation.

### 2. Basic Template Environment Variable Validation

**Problem**: Templates fail at runtime when required environment variables are missing

**Simple Solution**:

- [ ] Add simple environment variable checks to template validation
- [ ] Warn users about missing `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY` etc. before compilation
- [ ] No complex dependency analysis, just scan for common patterns

**Files to modify**:

- `src/templates/processor.ts` (add basic env var scanning)
- `src/cli/index.ts` (show warnings during compilation)

**Approach**: Simple regex scanning for `${VAR_NAME}` patterns and known required variables.

### 3. Simple Template Discovery Enhancement

**Problem**: Limited template discovery capabilities

**Simple Solution**:

- [ ] Add `--list-templates` flag to `flowsh init` command
- [ ] Add `--search <keyword>` flag to `flowsh init` command
- [ ] Show template descriptions and required environment variables
- [ ] No new command groups, just enhance existing `init` command

**Files to modify**:

- `src/cli/index.ts` (add flags to init command)
- `src/templates/discovery.ts` (enhance discovery logic)

**Approach**: Extend existing init command with simple flags, avoid creating new command groups.

### 4. Lightweight Template Runtime Validation

**Problem**: Templates validate syntactically but may fail at runtime

**Simple Solution**:

- [ ] Add `make test-templates` target that compiles all templates
- [ ] Basic compilation test without Docker or complex execution
- [ ] Just ensure all templates compile to valid shell scripts
- [ ] Report which templates have issues

**Files to modify**:

- `Makefile` (add simple test-templates target)
- `scripts/test-templates.sh` (create simple compilation test script)

**Approach**: Simple shell script that tries to compile each template and reports failures.

## Success Criteria (KISS Focused)

### Must Have

- [ ] Fix broken telegram-node tests (5 min fix)
- [ ] Add basic tests for 3 critical generators: agent, llm, code (simple input/output validation)
- [ ] Add basic environment variable validation warnings during compilation
- [ ] Add `--list-templates` and `--search` flags to `flowsh init`
- [ ] Add `make test-templates` target for basic compilation testing

### Quality Gates

- [ ] All existing tests pass (`npm test`)
- [ ] New generator tests follow existing simple patterns
- [ ] Template compilation warnings appear for missing env vars
- [ ] Enhanced `flowsh init` commands work as documented
- [ ] `make test-templates` reports compilation status for all templates
- [ ] No breaking changes to existing CLI interface

## Implementation Plan (KISS Focused)

### Day 1: Quick Fixes

- Fix broken telegram-node tests (function naming)
- Add basic tests for agent-node.ts (follow existing http-request-node.test.ts pattern)

### Day 2: Basic Generator Tests

- Add basic tests for llm-node.ts and code-node.ts
- Simple input/output validation, no complex mocking

### Day 3: Environment Variable Validation

- Add basic env var scanning to template processor
- Show warnings during `flowsh compile` for missing common vars

### Day 4: Template Discovery Enhancement

- Add `--list-templates` and `--search` flags to `flowsh init`
- Simple keyword matching, no complex search algorithms

### Day 5: Template Compilation Testing

- Create `make test-templates` target
- Simple script that compiles all templates and reports failures

## Approach Philosophy (KISS)

1. **Fix First**: Fix broken tests before adding new ones
2. **Simple Patterns**: Follow existing test patterns, don't create new frameworks
3. **Targeted Solutions**: Solve specific pain points, avoid comprehensive systems
4. **No Over-Engineering**: Basic validation and discovery, not complex search engines
5. **Maintainable**: Simple code that future contributors can understand and extend

## Risk Mitigation (KISS)

### Avoiding Over-Engineering

- Start with simplest solutions that solve real problems
- Use existing patterns and tools
- No new complex frameworks or architectures

### Maintaining Compatibility

- All changes are additive, no breaking changes
- Follow existing code conventions and patterns
- Test changes don't affect existing functionality

## Dependencies

- Phase 1 critical fixes must be completed
- No new external dependencies required
- Use existing testing and CLI infrastructure

## Deliverables

### Testing Improvements

1. Fixed telegram-node tests
2. Basic unit tests for 3 critical generators (agent, llm, code)

### Template Enhancements

1. Basic environment variable validation warnings
2. Enhanced `flowsh init` with `--list-templates` and `--search` flags
3. Simple `make test-templates` target for compilation validation

### Documentation

1. Updated CLI help text for new init flags
2. Simple contributor guide for adding generator tests

---

**Next Steps**: Start with fixing broken telegram-node tests, then add basic tests for agent-node following existing patterns.
