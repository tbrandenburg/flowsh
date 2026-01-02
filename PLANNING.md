# flowsh Development Planning

## Current Session Goals

This document tracks the current development session goals and progress.

## Active Tasks

- [ ] Set up TypeScript project structure with domain-driven architecture
- [ ] Implement YAML schema definition for flowsh workflows
- [ ] Create DSL type definitions for Phase 1 & 2 node types  
- [ ] Build YAML parsing pipeline with js-yaml integration
- [ ] Develop React Flow output transformation logic
- [ ] Integrate Commander.js CLI interface with colorful terminal UI
- [ ] Add comprehensive error handling and validation

## Next Steps

1. **Initialize Project Structure**
   - Set up package.json with TypeScript, Commander.js, js-yaml, Vitest
   - Configure tsconfig.json with strict mode enabled
   - Create domain-driven folder structure (cli/, dsl/, parsing/, graph/)
   - Set up ESLint and Prettier for code quality

2. **Core DSL Implementation**  
   - Define TypeScript interfaces for all workflow node types
   - Implement YAML schema validation using JSON Schema
   - Create internal graph representation for workflows
   - Build React Flow transformation layer

3. **CLI Development**
   - Set up Commander.js with TypeScript support
   - Implement colorful, harmonic terminal interface
   - Add progress indicators and helpful error messages
   - Create commands for parsing and validating workflows

4. **Testing & Validation**
   - Write unit tests for DSL validation logic
   - Create integration tests for YAML parsing flows  
   - Test against existing flowsh YAML examples
   - Validate React Flow output format

## Architecture Decisions

### Domain-Driven Structure
```
src/
├── cli/           # Command-line interface and user interaction
├── dsl/           # DSL definition, schema, and validation  
├── parsing/       # YAML parsing and transformation logic
├── graph/         # Internal graph representation and React Flow output
├── templates/     # Template system integration
└── utils/         # Shared utilities and helpers
```

### Technology Stack
- **TypeScript**: Strict mode for type safety and maintainability
- **Commander.js**: CLI framework for clean command structure
- **js-yaml**: Reliable YAML parsing with ecosystem compatibility
- **Vitest**: Fast testing framework with TypeScript support

### Key Design Principles
- Strong type safety throughout the system
- Clear separation of concerns between domains
- Extensible architecture for future Phase 3 features  
- Developer-friendly error messages and terminal UI
- Performance suitable for Raspberry Pi deployment

## Success Metrics

- [ ] Parse all existing flowsh YAML examples without errors
- [ ] Generate valid React Flow `{ nodes: [], edges: [] }` output  
- [ ] Support Phase 1 & 2 node types completely
- [ ] Handle template system references properly
- [ ] Provide excellent developer experience with clear, colorful CLI feedback
- [ ] Maintain TypeScript strict mode compliance
- [ ] Achieve meaningful test coverage of core functionality

## Known Challenges

### Complex Workflow Patterns
- **Sub-workflows**: Nested execution with proper variable scoping
- **Conditional branching**: If-else logic with proper error handling
- **Loops and iterations**: State management and break conditions
- **Template resolution**: Fallback mechanisms for missing templates

### Technical Considerations  
- YAML schema versioning without backward compatibility initially
- Performance optimization for large workflow files
- Memory efficiency for Raspberry Pi deployment
- Template system integration with external prompt registries

## Reference Materials

### Existing Examples
- `examples/flowsh-workflow-example.yaml` - Complex workflow with templates
- `examples/flowsh-workflow-schema.yaml` - Complete schema definition
- `examples/flowsh-workflow-schema-documentation.md` - DSL documentation

### External Documentation
- React Flow: https://reactflow.dev/learn (node/edge structures)
- js-yaml: https://github.com/nodeca/js-yaml (YAML parsing patterns)
- Commander.js: https://github.com/tj/commander.js (CLI frameworks)
- Dify.ai: https://github.com/langgenius/dify (workflow inspiration)