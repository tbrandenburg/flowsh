# AGENTS.md — AI Agent Instructions

This file provides machine-readable guidance for AI coding agents working in this repository.
It complements (but does not replace) README.md, which is intended for humans.

Agents should read this file first and follow it strictly.

---

## 🚫 CRITICAL REPOSITORY RULE

**FORBIDDEN: Placing non-repository-root files in the repository root.**

AI agents must NEVER create temporary files, generated scripts, test files, or any other non-essential files directly in the repository root directory.

**ALL temporary, generated, or development files must be placed under `dev/`:**

- `dev/generated-scripts/` - Temporary shell scripts and generated files
- `dev/test-workflows/` - Test YAML files and temporary workflow data
- `dev/working-files/` - Development workspace and working files
- `dev/outputs/` - Temporary outputs, logs, and debug files

**Only these files are permitted in the repository root:**

- Core configuration files: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`
- Documentation: `README.md`, `AGENTS.md`, `LICENSE`
- Build/development tools: `Makefile`, `.gitignore`
- Standard directories: `src/`, `templates/`, `examples/`, `docs/`, `dev/`

**The entire `dev/` folder is gitignored - use it freely for all temporary work.**

**Violation of this rule will result in immediate cleanup and reorganization.**

---

## 🚫 CRITICAL QUALITY ASSURANCE RULE

**MANDATORY: Run "make qa" after ALL code modifications.**

AI agents must ALWAYS run `make qa` after making any changes to the codebase.

**If "make qa" fails, you MUST fix all issues before proceeding.**

**Violation of this rule will result in broken builds and failed workflows.**

---

## 1. Project Overview

**Project Name**: flowsh

**Purpose**:
flowsh is "The jq of Workflows" - a simple YAML workflow to shell script compiler that follows the Unix philosophy. It converts YAML workflow definitions into clean, readable, executable shell scripts. The tool is designed to be the `jq` equivalent for workflows - focused, simple, and extremely good at one specific task.

**Primary Goals for AI Agents**:

- Make safe, minimal, and well-scoped changes that preserve the Unix philosophy
- Follow existing patterns and conventions throughout the TypeScript codebase
- Prefer correctness and clarity over cleverness - generated shell scripts must be readable
- Avoid speculative refactors unless explicitly requested
- Maintain the registry-based plugin system architecture
- Preserve the security validation and input sanitization layers
- Keep the CLI interface simple (only `compile`, `validate`, `init`, and `dsl` commands)

---

## 2. Tech Stack

**Languages**:

- TypeScript (primary, compiled to ES2022 modules)
- Shell/Bash (target output language)
- YAML (workflow definition language)

**Frameworks / Libraries**:

- Commander.js (CLI framework)
- js-yaml (YAML parsing)
- Joi (schema validation)
- Vitest (testing framework)
- lodash-es, mathjs, uuid, neverthrow (utilities)
- chalk, boxen, figlet, inquirer, ora (CLI aesthetics)

**Runtime & Tooling**:

- Node.js 18+ (ES Modules)
- TypeScript compiler (tsc)
- npm (package manager)
- ESLint + Prettier (code quality)
- Makefile (development workflows)

Agents should not introduce new dependencies without explicit instruction. The project values simplicity and minimal dependencies.

---

## 3. Repository Structure

```
flowsh/
├── src/                     # TypeScript source code
│   ├── cli/                 # Command-line interface (entry point)
│   ├── templates/          # Template system for workflow initialization
│   ├── parsing/            # YAML workflow parsing with security validation
│   ├── dsl/                # Domain-specific language types (workflow definitions)
│   ├── generation/         # Shell script generation engine
│   │   ├── generators/     # Registry-based node type generators
│   │   ├── registry/       # Plugin registry system for extensibility
│   │   ├── performance/    # Compilation monitoring and progress tracking
│   │   └── shell-scripting/ # Shell utility functions and script building
│   ├── security/           # Security validation and input sanitization
│   ├── config/             # Configuration management
│   ├── logging/            # Logging utilities
│   └── errors/             # Error handling and custom error types
├── templates/              # 14 production-ready workflow templates
│   ├── enhanced/           # Simple, ready-to-use templates (4)
│   └── advanced/          # Complex workflows by category (10)
├── examples/               # Example workflows and node demonstrations
│   ├── nodes/              # Individual node type examples (19+ types)
│   └── *.yaml              # Complete workflow examples
├── dev/                    # ALL temporary/generated files (gitignored)
│   ├── generated-scripts/  # Temporary shell scripts and generated files
│   ├── test-workflows/     # Test YAML files and temporary workflow data
│   ├── working-files/      # Development workspace and working files
│   ├── outputs/            # Temporary outputs, logs, and debug files
│   ├── execution-results/  # Test execution outputs
│   └── test-scripts/       # Manual test scripts
├── docs/                   # Documentation
└── PRPs/                   # Project Requirements & Planning documents
```

**Key Architecture**: Registry-based plugin system with clear separation between parsing, validation, generation, and security layers.

---

## 4. Setup & Build Commands

Agents should rely on these commands to run, test, and validate changes:

```bash
# Core development
npm install                  # Install dependencies
npm run build               # Compile TypeScript to dist/
npm run dev                 # Development with hot-reload using tsx
npm run start               # Run compiled CLI

# Code quality
npm run lint                # ESLint checking
npm run lint:fix            # ESLint with auto-fix
npm run format              # Prettier formatting
npm run format:check        # Check Prettier formatting
npm test                    # Run Vitest test suite

# Makefile workflows (preferred for comprehensive operations)
make check                  # Run all quality checks (lint + format + test + build)
make example                # Generate shell script from main example
make examples-all           # Generate scripts from all 19+ node examples
make validate               # Validate example workflows
make clean                  # Remove build artifacts

# flowsh CLI usage
flowsh init                             # List available templates
flowsh init [template] [target.yaml]   # Create workflow from template
flowsh compile workflow.yaml > script.sh    # Compile workflow to shell
flowsh validate workflow.yaml               # Validate workflow syntax
flowsh dsl [--format json]                  # Explore flowsh DSL structure and node types
```

---

## 5. Testing & Validation

Agents must run relevant tests and add tests for new functionality when reasonable.

**Test Framework**: Vitest with 80% coverage requirements (branches, functions, lines, statements)
**Test Structure**:

- Unit tests: `*.test.ts` files throughout source
- Manual tests: `dev/test-scripts/` (shell scripts for development testing)

**Validation Requirements**:

- All workflow examples must compile successfully
- Generated shell scripts must be executable and safe
- Security validation must pass for all inputs
- No infinite loop conditions in generated scripts

---

## 6. Code Style & Conventions

**Follow existing formatting and naming patterns:**

- **TypeScript Style**: ES2022 with strict type checking enabled
- **Formatting**: Prettier with 100-character line length, single quotes, semicolons
- **Import Order**: Node built-ins → external packages → @-scoped → relative imports
- **Naming**:
  - kebab-case for files and directories
  - camelCase for variables and functions
  - PascalCase for types and interfaces
  - UPPER_SNAKE_CASE for constants
- **Functions**: Prefer small, focused functions with clear single responsibilities
- **Comments**: Use JSDoc for public APIs, inline comments for complex logic
- **Error Handling**: Use custom error types and neverthrow Result types where appropriate

**Registry Pattern**: New node types must follow the registry-based generator pattern in `src/generation/generators/`

---

## 7. Environment & Configuration

**Environment variables must never be committed.**

- No .env files in repository
- Configuration through `src/config/` module only
- CLI tools should use non-interactive flags for automation
- Generated shell scripts must be self-contained with no external dependencies

**Configuration Files**:

- `tsconfig.json` - TypeScript compiler settings (strict mode enabled)
- `.eslintrc.cjs` - ESLint configuration (TypeScript-aware)
- `.prettierrc` - Code formatting with import sorting
- `vitest.config.ts` - Test configuration with coverage thresholds

---

## 8. Git & PR Workflow

**Use clear commit messages following conventional commit format.**
**Prefer small, focused PRs.**

Typical workflow:

1. Run `make check` before commits
2. Ensure all examples compile and validate
3. Add tests for new node types or functionality
4. Update documentation if adding features
5. Generated shell scripts in examples/ should be committed for validation

---

## 9. Command Execution Safety

When running shell or bash commands, agents must:

- Assume commands may **time out** (default 10-second test timeout)
- Never require **interactive user input**
- Prefer non-interactive flags (`--yes`, `--no-input`, `--ci`)
- Avoid long-running or blocking processes
- Use `set -euo pipefail` in generated shell scripts for safety
- Validate all template substitutions to prevent command injection

**If a command may hang or wait for input, do not run it.**

**Safe command patterns**:

```bash
# Good - non-interactive
npm ci --silent
flowsh validate --verbose
make examples-all

# Bad - may require interaction
npm install
git commit (without -m)
npm audit fix
```

---

## 10. Guardrails

Agents must NOT:

- Delete files without explicit instruction
- Commit secrets or credentials
- Perform large refactors unless requested
- Break the simple four-command CLI interface (`init`, `compile`, `validate`, `dsl`)
- Add complexity that violates the Unix philosophy
- Modify the core security validation without careful review
- Change the registry architecture without understanding implications
- Generate shell scripts with potential security vulnerabilities
- Add interactive features that break the "pipe-friendly" design
- Introduce breaking changes to the YAML DSL without versioning

**Registry Safety**: Adding new node types is encouraged, but changes to the registry system itself require careful consideration.

**Security First**: All YAML parsing and shell script generation must maintain security validation.

---

## 11. Template System

**Agent Priority: Use templates first when creating workflows**

flowsh includes a comprehensive template system with 14 production-ready workflows. Agents should **always start with templates** rather than creating workflows from scratch.

**Template Discovery:**

```bash
flowsh init                    # Show all available templates hierarchically
flowsh init --help            # Same as above
```

**Template Categories:**

- **Enhanced (4)**: Simple, ready-to-use templates
  - `ai-to-telegram-simple`, `data-pipeline-simple`, `ai-to-telegram`, `data-pipeline`
- **Advanced (10)**: Complex workflows by subcategory
  - `ai-workflows/`: `ai-chat-memory`, `multi-stage-ai-workflows`
  - `content-distribution/`: `content-moderation`, `multi-format-distribution`, `scheduled-content-generation`
  - `data-processing/`: `data-validation-cleanup`, `parallel-processing-aggregation`
  - `devops-automation/`: `automated-testing-monitoring`
  - `meta-workflows/`: `interactive-workflow-builder`
  - `reliability/`: `circuit-breaker`

**Template Usage Pattern for Agents:**

1. **Always check templates first**: `flowsh init` to see available options
2. **Preview template content**: Use `flowsh init [template-name] --preview` to evaluate template suitability
3. **Choose appropriate template**: Match user requirements to template categories based on preview
4. **Create from template**: `flowsh init [template-name] [output-file]`
5. **Validate**: `flowsh validate [output-file]`
6. **Customize if needed**: Edit the generated workflow file
7. **Test compile**: `flowsh compile [output-file]`

**Template Preview Guidelines for AI Agents:**

- Use `--preview` for template evaluation before creating files
- Parse preview output for template suitability assessment:
  - Check complexity level (low/medium/high) against user requirements
  - Verify required environment variables are available
  - Confirm node types match the intended functionality
  - Review estimated script length for appropriateness
- Consider template complexity in selection (prefer simpler templates when possible)
- Preview multiple templates to compare options before deciding

**Template File Locations:**

- Templates: `templates/enhanced/` and `templates/advanced/[category]/`
- All templates validate and compile successfully
- Templates include comprehensive examples of node usage patterns

**Security Note**: Template system includes path traversal protection and input sanitization.

---

## 12. flowsh-Specific Context

**Core Workflow Node Types** (19+ supported):

- **Basic**: start, end, code, answer, agent
- **AI/LLM**: llm (API integration)
- **Control Flow**: if-else, loop, iteration, parallel-iteration
- **Data**: variable-assignment, variable-aggregation, template-transform
- **Network**: http-request, telegram
- **Reliability**: retry, fallback, circuit-breaker
- **Composition**: sub-workflow

**Key Features to Preserve**:

- Template variable substitution: `{{variable}}`
- Registry-based node generators for extensibility
- Security validation for all inputs
- Performance monitoring and compilation progress
- Clean, readable shell script output
- Unix philosophy: "Do one thing well"

**Generated Shell Script Requirements**:

- Must be self-contained (no external dependencies)
- Must use `set -euo pipefail` for safety
- Must include proper error handling and exit codes
- Must be under 100 lines when possible
- Must be human-readable and debuggable

---

## 13. Final Reminder

This repository values **predictability, readability, and safety** above all else. The Unix philosophy guides all decisions: flowsh should remain a focused, simple tool that does one thing extremely well - converting YAML workflows into clean shell scripts.

When in doubt, choose the simpler approach that maintains compatibility with the existing registry system and preserves the clean CLI interface.
