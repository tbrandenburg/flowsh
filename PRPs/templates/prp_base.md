# PRP Base Template for flowsh Development

Use this template structure when creating Product Requirement Prompts for flowsh features.

## Feature Overview

**Feature Name**: [Clear, descriptive name]
**Implementation Phase**: [Phase 1/2/3 according to flowsh roadmap]
**Priority**: [High/Medium/Low]
**Estimated Complexity**: [Simple/Medium/Complex]

### Core Requirements
- [Requirement 1: Specific, testable requirement]
- [Requirement 2: Integration requirement with existing flowsh components]
- [Requirement 3: Performance or compatibility requirement]

### Success Criteria
- [ ] [Specific, measurable success criterion]
- [ ] [Integration test or validation requirement]
- [ ] [Performance or quality benchmark]

## Technical Specification

### Architecture Design
```
[ASCII diagram or description of component relationships]
```

### TypeScript Interfaces
```typescript
// Core interfaces for this feature
interface FeatureData {
  // Define strict types for feature data
}
```

### Integration Points
- **CLI Layer**: Integration with Commander.js command structure
- **DSL Layer**: Schema updates or extensions required
- **Parsing Layer**: YAML processing changes needed  
- **Graph Layer**: React Flow output modifications
- **Template System**: Template registry integration requirements

## Implementation Approach

### Phase 1: Core Foundation
1. [Foundational step with specific deliverable]
2. [Basic functionality implementation]
3. [Initial testing and validation]

### Phase 2: Integration & Enhancement
1. [Integration with existing flowsh components]
2. [Enhanced functionality and error handling]
3. [Comprehensive testing and documentation]

### Phase 3: Polish & Optimization
1. [Performance optimization]
2. [Developer experience improvements]
3. [Production readiness validation]

## Code Examples & Patterns

### Expected Input (YAML)
```yaml
# Provide specific YAML examples relevant to this feature
workflow:
  name: "Example for Feature"
  # ... detailed example
```

### Expected Output (TypeScript)
```typescript
// Show expected data structures and transformations
const result: ExpectedType = {
  // ... example output
};
```

### CLI Usage
```bash
# Show how users will interact with this feature
flowsh command --option value input.yaml
```

## Testing Strategy

### Unit Tests
- [ ] [Specific unit test requirement]
- [ ] [DSL validation test cases]  
- [ ] [Error handling test scenarios]

### Integration Tests
- [ ] [End-to-end workflow test]
- [ ] [Integration with existing flowsh examples]
- [ ] [Performance test on target systems]

### Test Data
- Use existing flowsh YAML examples: `examples/flowsh-workflow-example.yaml`
- Create minimal test cases for edge conditions
- Include invalid YAML examples to test error handling

## Validation Requirements

### Pre-Implementation Validation
```bash
make lint           # Code quality passes
make test           # Existing tests pass
make build          # TypeScript compilation succeeds
```

### Implementation Validation Loop
```bash
# Run this loop during development
make dev            # Start hot-reload development
# Implement feature incrementally
make test           # Verify tests pass
make lint           # Check code quality
# Repeat until complete
```

### Post-Implementation Validation
- [ ] All existing flowsh YAML examples still parse correctly
- [ ] New feature functionality works as specified
- [ ] React Flow output remains valid
- [ ] CLI interface provides good user experience
- [ ] Performance acceptable on Raspberry Pi

## Error Handling Requirements

### User-Facing Errors
- Provide clear, actionable error messages
- Include specific line/column information for YAML errors
- Use colorful terminal output for better visibility
- Suggest common fixes for typical mistakes

### Developer Errors
- Leverage TypeScript strict mode to catch type errors
- Include comprehensive JSDoc documentation
- Implement proper error propagation through the system
- Add debug logging for troubleshooting

## Documentation Updates

### Required Documentation
- [ ] Update main README.md with new functionality
- [ ] Add feature-specific documentation
- [ ] Include code examples and usage patterns
- [ ] Update CLI help text and command documentation

### Code Documentation
- [ ] JSDoc comments on all public interfaces
- [ ] Inline comments for complex algorithms
- [ ] Type annotations for better developer experience
- [ ] Examples in documentation match actual usage

## Dependencies & Compatibility

### New Dependencies
- [List any new npm packages required]
- [Justify each dependency and alternatives considered]
- [Ensure compatibility with existing package versions]

### Breaking Changes
- [Document any potential breaking changes]
- [Migration strategy for existing users]
- [Backward compatibility considerations]

### Performance Impact
- [Memory usage impact assessment]
- [Processing time considerations for large workflows]
- [Raspberry Pi compatibility verification required]

## Future Considerations

### Extensibility
- Design interfaces to support future Phase 3 node types
- Consider plugin architecture for custom node implementations
- Plan for additional output formats beyond React Flow

### Scalability
- Handle large workflow files efficiently
- Support parallel processing where appropriate
- Design for distributed template registry integration

### Maintenance
- Clear separation of concerns for easy maintenance
- Comprehensive test coverage for regression prevention
- Documentation that stays current with implementation

---

## Implementation Notes

### Development Workflow
1. Start with TypeScript interface definitions
2. Implement core logic with comprehensive error handling  
3. Add CLI integration with proper terminal UI
4. Write thorough tests including edge cases
5. Validate against existing flowsh examples
6. Update documentation and examples

### Code Quality Standards
- Follow existing flowsh TypeScript conventions
- Maintain strict type safety throughout
- Use ESLint and Prettier for consistent formatting
- Include meaningful test coverage of core functionality
- Provide clear, helpful error messages for users

### Integration Testing
- Test with all existing flowsh YAML examples
- Verify React Flow output compatibility
- Validate template system integration  
- Ensure CLI commands work as documented
- Check performance on resource-constrained systems