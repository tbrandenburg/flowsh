# Current Development Task

## Active Task: DSL Definition and YAML Parsing System

**Status**: Ready to begin implementation
**Priority**: High  
**Complexity**: Medium-High

### Task Description
Implement a robust DSL definition and YAML parsing system that converts flowsh workflow configurations into React Flow compatible graph structures. This forms the core foundation for the workflow-to-shell generator.

### Key Components to Build
1. **DSL Type Definitions**: TypeScript interfaces for all workflow node types
2. **YAML Schema**: JSON Schema validation for workflow structure  
3. **Parsing Pipeline**: js-yaml integration with error handling
4. **Graph Transformation**: Internal representation to React Flow format
5. **Template Integration**: Support for template/prompt registry references
6. **CLI Interface**: Commander.js with colorful terminal UI

### Immediate Next Steps
1. Initialize Node.js project with TypeScript configuration
2. Set up domain-driven folder structure  
3. Define core DSL interfaces for Phase 1 & 2 nodes
4. Implement basic YAML parsing with validation
5. Create React Flow output transformation
6. Add CLI commands for parsing workflows

### Success Criteria  
- Parse existing flowsh YAML examples successfully
- Generate valid React Flow output format
- Handle complex patterns: sub-workflows, conditionals, iterations
- Provide clear error messages for invalid YAML
- Support template system references

### Files to Reference
- `CLAUDE.md` - Complete development guidelines
- `INITIAL.md` - Detailed feature requirements
- `examples/flowsh-workflow-*.yaml` - Reference workflow examples
- `PRPs/templates/prp_base.md` - Implementation template structure

### Development Commands
```bash
make install    # Install dependencies
make dev        # Start development with hot-reload  
make build      # TypeScript compilation
make test       # Run test suite
make lint       # Code quality checks
```

### Architecture Focus
- TypeScript strict mode for type safety
- Domain-driven structure (cli/, dsl/, parsing/, graph/)
- Modular, extensible design for future features
- Performance suitable for Raspberry Pi systems

## Blockers & Dependencies
- None currently identified
- Ready to proceed with implementation

## Context Requirements
- Read existing flowsh examples to understand YAML structure
- Research React Flow node/edge format requirements
- Review template system integration patterns
- Consider complex workflow pattern handling (sub-workflows, loops)