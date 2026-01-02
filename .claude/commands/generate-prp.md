# Generate PRP (Product Requirement Prompt)

Creates a comprehensive Product Requirement Prompt from an initial feature specification.

## Usage

```
/generate-prp <initial-file-path>
```

## What it does

1. **Reads the initial specification** from the provided file path
2. **Validates the project structure** (checks for necessary files and dependencies)
3. **Generates a comprehensive PRP** with:
   - Detailed technical requirements
   - Implementation approach
   - Code examples and patterns
   - Testing strategy
   - Success criteria

## Example

```
/generate-prp INITIAL.md
```

## Process

### 1. Project Validation
- Verify package.json exists with correct dependencies (TypeScript, Commander.js, js-yaml, Vitest)
- Check tsconfig.json has strict mode enabled
- Confirm domain-driven folder structure exists or needs creation
- Validate existing flowsh YAML examples are accessible

### 2. Technical Analysis
- Parse the feature requirements from the initial specification
- Analyze existing codebase patterns and architecture
- Identify integration points with current flowsh structure
- Map DSL requirements to TypeScript type definitions

### 3. PRP Generation
Create a detailed prompt covering:
- **Architecture**: Domain-driven structure, TypeScript interfaces, module boundaries
- **Implementation**: Step-by-step development approach, core algorithms, validation logic
- **Integration**: React Flow output format, template system connection, CLI interface
- **Testing**: Unit test patterns for DSL validation, integration tests for YAML parsing
- **Developer Experience**: Error handling, terminal UI, progress feedback

### 4. Output Structure
The generated PRP includes:
- Clear implementation phases with specific deliverables
- TypeScript code examples for key interfaces and functions
- YAML parsing pipeline with validation checkpoints
- React Flow transformation logic with proper typing
- Comprehensive error handling with user-friendly messages
- Testing patterns specific to flowsh's DSL and workflow requirements

### 5. Quality Checks
- Ensure all flowsh examples are referenced correctly
- Validate technical approaches align with project goals
- Confirm implementation supports Phase 1 & 2 node types
- Verify template system integration points are covered
- Check terminal UI requirements are addressed

## Output Location

Generated PRPs are saved to: `PRPs/feature-name-YYYYMMDD.md`

The filename is automatically generated based on the feature name and current date.

## Notes

- Always run validation commands first: `make lint && make test`
- Ensure all existing flowsh YAML examples parse without errors
- Generated PRP should enable building the feature incrementally
- Focus on type safety and maintainability throughout implementation