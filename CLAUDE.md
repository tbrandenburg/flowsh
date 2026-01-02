# flowsh - AI Assistant Guidelines

## Project Overview

flowsh is a workflow-to-shell generator for AI agent orchestration. It converts visual AI workflows defined in YAML into portable, self-contained shell scripts. The project focuses on bridging the gap between visual workflow design and shell-based execution.

**Current Focus**: Building a robust DSL definition and YAML parsing system that outputs React Flow compatible graphs, with initial shell script generation capabilities.

## Tech Stack

### Core Technologies
- **TypeScript**: Strong type safety, maintainability, and long-term scalability
- **Node.js**: Runtime environment, compiling TypeScript to JavaScript
- **Commander.js**: CLI framework - lightweight, excellent TypeScript support
- **js-yaml**: YAML parsing - well-maintained, reliable, ecosystem standard

### Development Tools
- **Vitest**: Testing framework - speed, TypeScript-first support
- **ESLint**: Code quality and linting
- **Prettier**: Code formatting
- **tsx**: Hot-reload during development
- **tsc**: TypeScript compilation

### Package Management
- **npm/pnpm**: Dependency management (pnpm preferred for performance)

## Project Awareness & Context

- Always read PLANNING.md at the start of a new conversation
- Check TASK.md before starting work
- Use consistent domain-driven file organization
- Refer to existing flowsh YAML examples in `examples/` folder for DSL patterns
- The project is inspired by dify.ai workflow orchestration patterns

## Architecture & Code Structure

### Domain-Driven Organization
```
src/
├── cli/           # Command-line interface and user interaction
├── dsl/           # DSL definition, schema, and validation
├── parsing/       # YAML parsing and transformation logic  
├── graph/         # Internal graph representation and React Flow output
├── generation/    # Shell script generation (future phase)
├── templates/     # Template system and prompt registry integration
└── utils/         # Shared utilities and helpers
```

### File Organization Principles
- Keep files reasonably small and focused
- Favor composable functions and clear abstractions
- Separate concerns clearly between domains
- Avoid unnecessary complexity

### TypeScript Configuration
- **Strict mode enabled**: `strict: true`
- **No implicit any**: Catch type issues early
- **Strict null checks**: Prevent null/undefined errors
- Strong type safety especially important for DSL and parsing logic

## Code Quality Standards

### Linting & Formatting
- **ESLint**: Code quality rules and best practices
- **Prettier**: Consistent code formatting
- Keep formatting concerns separate from linting rules
- Follow standard TypeScript best practices

### Testing Strategy
- **Vitest**: Primary testing framework
- **Unit tests**: DSL validation, core logic, parsing functions
- **Integration tests**: End-to-end YAML parsing flows
- **Focus**: Meaningful coverage of core logic (DSL, parsing, transformation)
- **Property-based testing**: Consider for DSL validation edge cases

### Code Complexity
- Files kept small and focused
- Clear abstractions and composable functions
- Avoid deep nesting and complex control flow
- Prefer explicit over implicit behavior

## Development Workflow

### Available Make Targets
```bash
make install    # Install dependencies
make dev        # Start CLI in development mode with hot-reload
make run        # Run CLI locally (built output)  
make build      # TypeScript compilation
make lint       # Run ESLint
make format     # Run Prettier
make test       # Run full test suite
make clean      # Remove build artifacts
```

### Development Commands
- **Hot-reload**: `tsx` for fast iteration during development
- **Build**: `tsc` for TypeScript compilation (simple initial setup)
- **Package manager**: npm/pnpm (pnpm preferred for performance)

## DSL & Workflow System

### Supported Node Types (Phase 1 & 2)
**Phase 1 (MVP)**:
- Start/End Nodes: Variable definitions and workflow boundaries
- LLM Nodes: AI model integration with prompt templates
- If-Else Nodes: Conditional workflow branching  
- Variable Assignment: Dynamic variable management
- Code Nodes: Bash command execution
- Agent Nodes: CLI tool orchestration
- Basic Template Substitution: Variable interpolation

**Phase 2 (Enhanced Control)**:
- Loop Nodes: Conditional repetition with break conditions
- Iteration Nodes: Array/list processing workflows
- Variable Aggregation: Collect and merge results
- Template Transform Nodes: Advanced template processing
- Sub-Workflows: Nested workflow execution

### Complex Workflow Patterns
- **Sub-workflows**: Nested execution with proper scoping
- **If/Else branches**: Conditional logic and routing
- **Loops and iterations**: Repetitive processing with state management
- **Template system**: Reference prompts from template/prompt registry

### YAML Schema & Validation
- State-of-the-art YAML schema definition
- Off-the-shelf validators for basic validation initially
- Schema versioning support (no backwards compatibility yet)
- Comprehensive error messages for validation failures

## React Flow Compatibility

### Output Format
- Generate standard `{ nodes: [], edges: [] }` structure
- Compatible with React Flow rendering requirements
- Focus on structural compatibility rather than styling initially

### Graph Representation
- Internal graph representation separate from React Flow output
- Clean transformation layer between internal model and React Flow format
- Support for complex workflow patterns (nested, conditional, iterative)

## Template System Integration

### Prompt Registry Support
- Reference prompts stored in template/prompt registry
- Template resolution and substitution system
- Support for external template sources
- Fallback mechanisms for missing templates

## Performance & Compatibility

### System Requirements
- **Target**: Work efficiently on small systems (Raspberry Pi)
- **Memory**: Reasonable memory usage for YAML parsing
- **Performance**: No specific requirements initially, focus on correctness

### Scalability Considerations
- Modular architecture for future expansion
- Clean separation of concerns
- Extensible plugin system for new node types

## Terminal UI & User Experience

### UI Principles
- **Colorful**: Harmonic color scheme for better readability
- **Simple**: Clean, uncluttered interface design
- **Geeky**: Technical aesthetic appealing to developers
- **Clear feedback**: Helpful error messages and progress indicators

### Color Palette Guidelines
- Use harmonic, accessible colors
- Consistent color coding for different message types
- High contrast for readability in various terminals

## Known Gotchas & Technical Considerations

### YAML Parsing Challenges
- **Complex nested structures**: Handle deep workflow hierarchies
- **Circular references**: Detect and prevent infinite loops
- **Large files**: Efficient parsing for complex workflows
- **Safe loading**: Use `yaml.load()` safely to avoid code injection

### DSL Complexity Areas
- **Sub-workflow scoping**: Variable isolation and inheritance
- **Conditional branching**: Proper edge case handling
- **Loop state management**: Iteration variables and exit conditions
- **Template resolution**: Fallback and error handling

### TypeScript Specific
- **Type safety**: Strict typing for DSL structures
- **Schema validation**: Runtime type checking vs compile-time
- **Generic types**: Flexible but type-safe DSL node definitions

### Development Gotchas
- **Hot-reload**: Ensure tsx works with TypeScript strict mode
- **Module imports**: Use proper ES module imports/exports
- **Path resolution**: Configure TypeScript paths correctly

## Success Criteria

### Primary Goals
1. **YAML Parsing**: Parse existing flowsh YAML examples successfully
2. **Graph Generation**: Output valid React Flow `{ nodes: [], edges: [] }` format
3. **Shell Generation**: Generate simple shell scripts from workflows
4. **Template Support**: Handle template references and substitution
5. **Validation**: Clear, helpful error messages for invalid YAML

### Quality Metrics
- All existing examples parse without errors
- Generated React Flow graphs render correctly
- Shell scripts execute successfully for basic workflows
- Developer-friendly error messages and CLI feedback
- Clean, maintainable codebase architecture

## AI Behavior Rules

### Core Principles
- **Never assume missing context**: Ask questions if workflow structure is unclear
- **Never hallucinate libraries**: Only use documented APIs and established patterns
- **Always confirm file paths**: Verify paths exist before referencing them
- **Type safety first**: Leverage TypeScript's type system throughout

### Development Approach
- Start with simple, working implementations
- Build incrementally with clear milestones
- Focus on robustness over performance initially
- Maintain clean separation of concerns

### Error Handling
- Provide clear, actionable error messages
- Include context about what failed and why
- Suggest fixes when possible
- Fail fast with meaningful diagnostics

### Documentation
- Keep code self-documenting with clear names
- Add JSDoc comments for public APIs
- Include examples in documentation
- Update docs when behavior changes