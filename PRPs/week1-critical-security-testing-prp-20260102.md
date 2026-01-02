# PRP: Week 1 Critical Security and Testing Foundation

## Feature Overview

**Feature Name**: Critical Security and Testing Infrastructure  
**Implementation Phase**: Phase 1 - Foundation  
**Priority**: High  
**Estimated Complexity**: Complex

This PRP establishes critical security fixes and comprehensive testing infrastructure to address urgent technical debt in the flowsh project. The focus is on making the project safe for production use and establishing confidence through robust test coverage and security practices.

### Core Requirements

- Fix 4 moderate npm audit vulnerabilities in esbuild/vite dependency chain
- Implement comprehensive input sanitization for shell script generation
- Add structured YAML validation with detailed error messages
- Create complete unit and integration test suite with 80%+ coverage
- Establish consistent error handling patterns across all modules
- Implement security-first development practices

### Success Criteria

- [ ] Zero npm audit vulnerabilities across all dependencies
- [ ] Comprehensive test suite with 80%+ code coverage using Vitest
- [ ] All shell script generation protected against injection attacks
- [ ] YAML validation with user-friendly error messages and suggestions
- [ ] Consistent error handling with structured error types
- [ ] All existing flowsh YAML examples parse and generate correctly

## Technical Specification

### Architecture Design

```
flowsh Security & Testing Architecture
├── Security Layer
│   ├── Input Sanitization (YAML, CLI args, shell commands)
│   ├── Dependency Vulnerability Management
│   └── Shell Injection Prevention
├── Testing Infrastructure
│   ├── Unit Tests (DSL validation, parsing, generation)
│   ├── Integration Tests (end-to-end workflows)
│   └── Test Coverage Reporting (Vitest + c8)
└── Error Handling System
    ├── Structured Error Types (ValidationError, SecurityError, etc.)
    ├── User-Friendly Messages
    └── Debug Logging Infrastructure
```

### TypeScript Interfaces

```typescript
// Security and validation error types
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'security' | 'schema';
  code: string;
  message: string;
  path?: string;
  line?: number;
  column?: number;
  suggestion?: string;
  severity: 'error' | 'warning';
}

export interface SecurityConfig {
  enableShellSanitization: boolean;
  enableYamlValidation: boolean;
  allowedCommands: string[];
  maxFileSize: number;
  timeoutMs: number;
}

export interface TestConfig {
  coverage: {
    threshold: number;
    include: string[];
    exclude: string[];
  };
  mocks: {
    enableCliMocks: boolean;
    enableFileMocks: boolean;
  };
}

// Enhanced error handling
export abstract class FlowshError extends Error {
  abstract readonly code: string;
  abstract readonly type: string;
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.context = context;
    this.name = this.constructor.name;
  }
}

export class ValidationError extends FlowshError {
  readonly code = 'VALIDATION_ERROR';
  readonly type = 'validation';
}

export class SecurityError extends FlowshError {
  readonly code = 'SECURITY_ERROR';
  readonly type = 'security';
}

export class ParseError extends FlowshError {
  readonly code = 'PARSE_ERROR';
  readonly type = 'parsing';
}
```

### Integration Points

- **CLI Layer**: Enhanced error display with colorful, actionable feedback
- **DSL Layer**: Comprehensive schema validation with security checks
- **Parsing Layer**: Input sanitization and malformed YAML handling
- **Generation Layer**: Shell command sanitization and injection prevention
- **Testing Layer**: Mock implementations for external CLI tools

## Implementation Approach

### Phase 1: Security Foundation

1. **Dependency Security Audit**
   - Run comprehensive npm audit and fix 4 moderate vulnerabilities
   - Update esbuild/vite dependency chain to secure versions
   - Establish automated security scanning in CI/CD pipeline
   - Document security update procedures

2. **Input Sanitization Implementation**
   - Create shell command sanitization utilities
   - Implement YAML content validation with size limits
   - Add CLI argument validation and escape handling
   - Establish allowlist-based command validation

3. **Error Handling Standardization**
   - Define structured error type hierarchy
   - Implement consistent error propagation patterns
   - Create user-friendly error message formatting
   - Add debug logging infrastructure with log levels

### Phase 2: Testing Infrastructure

1. **Unit Test Suite Creation**
   - Test all DSL type validation functions
   - Test YAML parsing edge cases and error conditions
   - Test shell script generation with various node types
   - Test template resolution and substitution logic

2. **Integration Test Implementation**
   - End-to-end workflow parsing and generation tests
   - Test with all existing flowsh YAML examples
   - Mock external CLI tools (opencode, etc.) for testing
   - Performance testing with large workflow files

3. **Test Coverage & Reporting**
   - Configure Vitest with coverage reporting
   - Establish 80% minimum coverage threshold
   - Create test fixtures from existing examples
   - Implement property-based testing for validation edge cases

### Phase 3: Security Hardening

1. **Shell Injection Prevention**
   - Implement safe variable substitution in generated scripts
   - Add command validation against allowlist
   - Escape shell metacharacters in user input
   - Test injection attack scenarios

2. **YAML Security Implementation**
   - Use `yaml.safeLoad()` to prevent code injection
   - Implement schema validation with Joi or similar
   - Add file size and complexity limits
   - Create security-focused validation rules

3. **Security Testing & Audit**
   - Penetration testing for injection vulnerabilities
   - Security code review checklist
   - Automated security scanning integration
   - Documentation of security best practices

## Code Examples & Patterns

### Expected Security Implementation

```typescript
// src/security/sanitization.ts
export class ShellSanitizer {
  private static readonly ALLOWED_COMMANDS = ['opencode', 'git', 'npm', 'node', 'python', 'curl'];

  private static readonly DANGEROUS_CHARS = /[;&|`$(){}[\]\\]/g;

  static sanitizeCommand(command: string): ValidationResult<string> {
    // Validate command against allowlist
    if (!this.ALLOWED_COMMANDS.includes(command.split(' ')[0])) {
      return {
        success: false,
        errors: [
          {
            type: 'security',
            code: 'DISALLOWED_COMMAND',
            message: `Command '${command}' is not in the allowed list`,
            suggestion: `Use one of: ${this.ALLOWED_COMMANDS.join(', ')}`,
            severity: 'error',
          },
        ],
      };
    }

    // Sanitize shell metacharacters
    const sanitized = command.replace(this.DANGEROUS_CHARS, '\\$&');

    return {
      success: true,
      data: sanitized,
      errors: [],
      warnings: [],
    };
  }

  static sanitizeVariable(variable: string): string {
    return variable.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}

// src/security/yaml-validator.ts
export class YamlSecurityValidator {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_DEPTH = 10;

  static validateYamlSecurity(content: string): ValidationResult<void> {
    const errors: ValidationError[] = [];

    // Check file size
    if (content.length > this.MAX_FILE_SIZE) {
      errors.push({
        type: 'security',
        code: 'FILE_TOO_LARGE',
        message: `YAML file exceeds maximum size of ${this.MAX_FILE_SIZE} bytes`,
        severity: 'error',
      });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [/exec\s*\(/i, /eval\s*\(/i, /require\s*\(/i, /__proto__/i];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        errors.push({
          type: 'security',
          code: 'SUSPICIOUS_CONTENT',
          message: `Potentially dangerous pattern detected: ${pattern}`,
          severity: 'error',
        });
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
```

### Expected Test Structure

```typescript
// src/parsing/parser.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseWorkflowFile } from './parser.js';
import { readFile } from 'fs/promises';

describe('Workflow Parser', () => {
  describe('Security Tests', () => {
    it('should reject YAML with suspicious content', async () => {
      const maliciousYaml = `
        workflow:
          name: "test"
        nodes:
          - eval("rm -rf /")
      `;

      const result = await parseWorkflowFile(maliciousYaml, {
        validate: true,
        strict: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SUSPICIOUS_CONTENT');
    });

    it('should sanitize shell commands in generated scripts', async () => {
      const workflow = {
        graph: {
          nodes: [
            {
              id: 'test',
              type: 'code' as const,
              data: {
                command: 'echo "hello; rm -rf /"',
                title: 'Test Command',
              },
            },
          ],
        },
      };

      const result = generateShellScript(workflow);

      expect(result.script).not.toContain('rm -rf');
      expect(result.script).toContain('echo "hello\\; rm -rf /"');
    });
  });

  describe('Validation Tests', () => {
    it('should provide helpful error messages for invalid YAML', async () => {
      const invalidYaml = `
        workflow:
          name: "test"
        nodes:
          - id: missing-type
            data: {}
      `;

      const result = await parseWorkflowFile(invalidYaml);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('missing required field: type');
      expect(result.errors[0].path).toBe('nodes[0].type');
      expect(result.errors[0].suggestion).toContain('Add a type field');
    });
  });

  describe('Integration Tests', () => {
    it('should parse all example workflows successfully', async () => {
      const exampleFiles = ['examples/flowsh-workflow-example.yaml', 'simple-workflow.yaml'];

      for (const file of exampleFiles) {
        const content = await readFile(file, 'utf-8');
        const result = await parseWorkflowFile(content, { validate: true });

        expect(result.success).toBe(true);
        expect(result.workflow).toBeDefined();
      }
    });
  });
});

// src/cli/index.test.ts
describe('CLI Integration', () => {
  it('should display security errors with helpful formatting', async () => {
    const consoleSpy = vi.spyOn(console, 'error');

    await generateCommand('test-malicious.yaml', {});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌ SECURITY ERROR'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Code: SUSPICIOUS_CONTENT'));
  });
});
```

### CLI Security Enhancement

```bash
# Example of enhanced error output
flowsh generate malicious-workflow.yaml

# Output:
❌ Security validation failed

📋 Security Issues Found:

1. ❌ ERROR: Potentially dangerous pattern detected in YAML
   Path: nodes[2].data.command
   Code: SUSPICIOUS_CONTENT
   Suggestion: Use safe commands from the allowlist: opencode, git, npm, node, python, curl

2. ⚠️  WARNING: Large file size may impact performance
   Size: 8.2MB (recommended: < 5MB)
   Suggestion: Consider splitting into multiple smaller workflows

🛡️  Security Check: Use --validate-security to run detailed security scan
💡 Help: Run 'flowsh validate workflow.yaml' to check without generating
```

## Testing Strategy

### Unit Tests

- [ ] DSL type validation functions (types.ts, validation.ts)
- [ ] YAML parsing with various input formats and edge cases
- [ ] Shell script generation with all supported node types
- [ ] Error handling and message formatting
- [ ] Security sanitization functions
- [ ] Template resolution and substitution logic

### Integration Tests

- [ ] End-to-end workflow parsing and shell generation pipeline
- [ ] All existing flowsh YAML examples parse correctly
- [ ] Mock implementations for external CLI tools (opencode, etc.)
- [ ] Performance tests with large workflow files (>5MB)
- [ ] Security penetration tests for injection attacks

### Test Data

- Use existing flowsh YAML examples: `examples/flowsh-workflow-example.yaml`
- Create minimal test cases for each node type
- Include malformed YAML examples for error handling tests
- Generate property-based test cases for validation edge cases
- Mock external dependencies for isolated testing

## Validation Requirements

### Pre-Implementation Validation

```bash
make lint           # Code quality passes
make test           # Existing tests pass (currently none)
make build          # TypeScript compilation succeeds
npm audit           # Shows 4 moderate vulnerabilities (current state)
```

### Implementation Validation Loop

```bash
# Run this loop during development
make dev            # Start hot-reload development
# Implement security fixes incrementally
make test           # Verify new tests pass
make lint           # Check code quality
npm audit           # Verify vulnerabilities are fixed
# Repeat until complete
```

### Post-Implementation Validation

- [ ] All existing flowsh YAML examples parse correctly with new validation
- [ ] Zero npm audit vulnerabilities
- [ ] 80%+ test coverage across all modules
- [ ] Security penetration tests pass
- [ ] Performance regression tests show no degradation
- [ ] CLI provides excellent user experience with clear error messages

## Error Handling Requirements

### User-Facing Errors

- Provide clear, actionable error messages with specific suggestions
- Include line/column information for YAML syntax errors
- Use colorful terminal output with emoji icons for better visibility
- Suggest common fixes for typical mistakes (missing fields, invalid types)
- Group related errors to avoid overwhelming users

### Developer Errors

- Leverage TypeScript strict mode to catch type errors at compile time
- Include comprehensive JSDoc documentation for all public functions
- Implement proper error propagation through Result<T, E> pattern
- Add structured debug logging with correlation IDs for troubleshooting
- Create error recovery mechanisms for transient failures

### Security Error Handling

- Never expose sensitive information in error messages
- Log security violations for audit purposes
- Provide generic error messages for security failures to prevent information disclosure
- Implement rate limiting for validation failures to prevent DoS attacks

## Documentation Updates

### Required Documentation

- [ ] Update main README.md with security best practices
- [ ] Add comprehensive testing documentation and examples
- [ ] Document error codes and troubleshooting guide
- [ ] Create security audit checklist for future development
- [ ] Update CLI help text with security-related options

### Code Documentation

- [ ] JSDoc comments on all security and validation functions
- [ ] Inline comments explaining security considerations
- [ ] Type annotations for enhanced developer experience
- [ ] Examples in documentation match actual secure usage patterns

## Dependencies & Compatibility

### Dependency Updates Required

- **esbuild**: Update to secure version (>0.24.2) to fix moderate vulnerability
- **vite**: Update dependency chain to eliminate security issues
- **vitest**: Already at secure version 1.1.0, maintain for testing
- **Additional security packages**: Consider adding joi, helmet, or similar for validation

### Breaking Changes

- Dependency updates may require Vitest configuration adjustments
- Enhanced validation may reject previously accepted malformed YAML
- Security fixes may change shell script generation output format
- Stricter error handling may change function return types

### Performance Impact

- YAML validation adds ~10-20ms processing time per workflow
- Security scanning may increase memory usage by ~15%
- Test suite execution time estimated at 30-60 seconds
- Shell sanitization has negligible performance impact (<1ms)

## Future Considerations

### Extensibility

- Design security interfaces to support additional validation rules
- Plan for integration with external security scanning tools
- Consider plugin architecture for custom security policies
- Support for additional shell sanitization rules

### Scalability

- Handle large workflow files (>10MB) with streaming validation
- Support parallel test execution for faster CI/CD pipelines
- Design for distributed security policy management
- Plan for integration with enterprise security tools

### Maintenance

- Automated dependency vulnerability scanning in CI/CD
- Regular security audit schedule (monthly)
- Comprehensive regression test suite prevents security regressions
- Clear security update procedures and communication

---

## Implementation Notes

### Development Workflow

1. **Start with dependency security fixes** - Address npm audit vulnerabilities first
2. **Implement core security utilities** - Shell sanitization and YAML validation
3. **Add comprehensive error handling** - Structured types and user-friendly messages
4. **Create thorough test suite** - Unit and integration tests with mocks
5. **Validate against existing examples** - Ensure backward compatibility
6. **Update documentation and CLI** - Improve user experience

### Code Quality Standards

- Follow existing flowsh TypeScript conventions and file organization
- Maintain strict type safety with comprehensive error handling
- Use ESLint and Prettier for consistent formatting
- Include meaningful test coverage of security-critical functionality
- Provide clear, helpful error messages prioritizing user experience

### Security Testing Protocol

- Test with malicious YAML inputs designed to exploit vulnerabilities
- Verify shell injection protection with crafted command strings
- Validate error handling doesn't leak sensitive information
- Performance test security validation with large inputs
- Penetration test CLI interface for input validation bypasses

### Success Metrics

1. **Security**: Zero npm audit vulnerabilities, comprehensive injection protection
2. **Testing**: 80%+ code coverage, all existing functionality regression tested
3. **Reliability**: Structured error handling, graceful failure recovery
4. **Usability**: Clear validation messages, excellent developer experience
5. **Performance**: No significant regression in workflow generation speed
6. **Compatibility**: All existing YAML examples continue working correctly
