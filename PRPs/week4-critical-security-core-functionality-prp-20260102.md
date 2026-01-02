## FEATURE: Week 4 Critical Security Fixes and Core Functionality Completion

Address critical security vulnerabilities and implement missing core workflow processing functionality. This week transforms flowsh from a sophisticated prototype into a fully functional workflow processor capable of handling real-world scenarios with proper condition evaluation and security.

## Core Requirements:

### 1. Critical Security Vulnerability Remediation

- Replace vulnerable expr-eval dependency (prototype pollution CVE)
- Implement secure expression evaluation with mathjs or custom parser
- Add comprehensive security testing for expression evaluation
- Conduct security audit of all dependencies and code paths

### 2. Complete Condition Evaluation System

- Implement robust condition evaluation for workflow if-else logic
- Add variable resolution within condition expressions
- Support complex property access and nested object evaluation
- Handle edge cases: null values, type coercion, operator precedence

### 3. Variable Context Management

- Create workflow execution context with variable scoping
- Implement variable assignment and retrieval across nodes
- Support environment variable integration in conditions
- Add variable lifecycle management (creation, mutation, cleanup)

### 4. Integration Testing Infrastructure

- Create end-to-end workflow processing tests
- Validate complete YAML → shell script generation pipeline
- Test condition evaluation with real workflow examples
- Add performance benchmarking for workflow processing

## EXAMPLES:

### Security-First Expression Evaluation:

```typescript
// Before: Vulnerable expr-eval usage
import { Parser } from 'expr-eval'; // VULNERABLE to prototype pollution

// After: Secure mathjs implementation
interface SecureExpressionEvaluator {
  evaluateCondition(expression: string, context: WorkflowContext): boolean;
  validateSyntax(expression: string): ValidationResult;
  sanitizeExpression(expression: string): string;
}

class MathJSConditionEvaluator implements SecureExpressionEvaluator {
  private mathjs: any;
  private securityConfig: SecurityConfig;

  evaluateCondition(expression: string, context: WorkflowContext): boolean {
    // Sanitize input
    const sanitized = this.sanitizeExpression(expression);

    // Create secure scope
    const scope = this.createSecureScope(context);

    // Evaluate with restricted functions
    return this.mathjs.evaluate(sanitized, scope);
  }

  private createSecureScope(context: WorkflowContext): Record<string, any> {
    return {
      // Only allow safe variables and functions
      ...this.extractSafeVariables(context),
      ...this.getBuiltInFunctions(),
    };
  }
}
```

### Complete Condition Evaluation:

```typescript
// Real workflow condition handling
interface WorkflowExecutionContext {
  variables: Map<string, any>;
  environment: Map<string, string>;
  nodeOutputs: Map<string, any>;
  executionState: ExecutionState;
}

class WorkflowConditionProcessor {
  async evaluateIfElseCondition(
    condition: string,
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    // Handle complex conditions like:
    // "${test_results.passed} > 0 && ${environment} === 'production'"

    const resolved = await this.resolveVariables(condition, context);
    const result = await this.evaluator.evaluateCondition(resolved, context);

    this.logger.debug('Condition evaluation', {
      condition,
      resolved,
      result,
      variables: Array.from(context.variables.keys()),
    });

    return result;
  }

  private async resolveVariables(
    expression: string,
    context: WorkflowExecutionContext
  ): Promise<string> {
    // Replace ${variable} with actual values
    // Support nested properties: ${test_results.passed}
    // Handle environment variables: ${ENV_VAR}
    // Add type checking and validation
  }
}
```

### Variable Context Management:

```typescript
interface VariableScope {
  readonly parent?: VariableScope;
  readonly variables: Map<string, any>;
  readonly nodeId: string;
}

class WorkflowVariableManager {
  private scopes: Map<string, VariableScope> = new Map();
  private globalScope: VariableScope;

  createNodeScope(nodeId: string, parentNodeId?: string): VariableScope {
    const parent = parentNodeId ? this.scopes.get(parentNodeId) : this.globalScope;
    const scope: VariableScope = {
      parent,
      variables: new Map(),
      nodeId,
    };

    this.scopes.set(nodeId, scope);
    return scope;
  }

  setVariable(nodeId: string, name: string, value: any): void {
    const scope = this.scopes.get(nodeId);
    if (!scope) {
      throw new WorkflowExecutionError(`Node scope not found: ${nodeId}`);
    }

    scope.variables.set(name, value);

    this.logger.debug('Variable assignment', {
      nodeId,
      variable: name,
      type: typeof value,
      scope: scope.nodeId,
    });
  }

  getVariable(nodeId: string, name: string): any {
    let scope = this.scopes.get(nodeId);

    while (scope) {
      if (scope.variables.has(name)) {
        return scope.variables.get(name);
      }
      scope = scope.parent;
    }

    throw new VariableNotFoundError(
      `Variable '${name}' not found in scope chain for node ${nodeId}`
    );
  }
}
```

### Integration Testing Framework:

```typescript
describe('End-to-End Workflow Processing', () => {
  let processor: WorkflowProcessor;
  let tempDir: string;

  beforeEach(async () => {
    processor = new WorkflowProcessor({
      security: { strictMode: true },
      logging: { level: 'debug' },
    });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowsh-test-'));
  });

  it('should process simple conditional workflow', async () => {
    const workflowYaml = `
      metadata:
        name: "conditional-test"
      spec:
        graph:
          nodes:
            - id: "start"
              type: "start"
              data: { variables: { count: 5, status: "ready" } }
            - id: "condition"
              type: "if-else"
              data: { condition: "\${count} > 3 && \${status} === 'ready'" }
            - id: "success"
              type: "answer"
              data: { message: "Condition met" }
            - id: "failure"
              type: "answer"
              data: { message: "Condition not met" }
          edges:
            - source: "start", target: "condition"
            - source: "condition", target: "success", condition: "true"
            - source: "condition", target: "failure", condition: "false"
    `;

    const result = await processor.processWorkflow(workflowYaml);

    expect(result.success).toBe(true);
    expect(result.shellScript).toContain('Condition met');
    expect(result.executionPath).toEqual(['start', 'condition', 'success']);
  });

  it('should handle complex nested conditions', async () => {
    // Test nested property access: ${test_results.api.status}
    // Test environment variables: ${NODE_ENV}
    // Test type conversions and edge cases
  });

  it('should prevent security vulnerabilities', async () => {
    const maliciousWorkflow = `
      spec:
        graph:
          nodes:
            - id: "malicious"
              type: "if-else"
              data: { condition: "constructor.constructor('return process')().env.SECRET" }
    `;

    await expect(processor.processWorkflow(maliciousWorkflow)).rejects.toThrow(
      SecurityViolationError
    );
  });
});
```

## DOCUMENTATION:

### Security & Expression Evaluation:

- **MathJS Security**: https://mathjs.org/docs/expressions/security.html - Secure expression evaluation
- **Prototype Pollution Prevention**: https://github.com/HoLyVieR/prototype-pollution-nsec18 - Understanding the vulnerability
- **Safe Expression Parsing**: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html - OWASP security guidelines
- **Node.js Security Best Practices**: https://nodejs.org/en/docs/guides/security/ - Comprehensive security guide

### Variable Context & Scoping:

- **JavaScript Scope Patterns**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures - Scope management concepts
- **Workflow Variable Patterns**: https://docs.github.com/en/actions/learn-github-actions/contexts - GitHub Actions variable context
- **Template Variable Resolution**: https://handlebarsjs.com/guide/expressions.html - Variable resolution patterns
- **Context Management**: https://docs.temporal.io/workflows#workflow-context - Workflow execution context

### Testing & Integration:

- **End-to-End Testing**: https://playwright.dev/docs/test-runners - E2E testing patterns
- **Security Testing**: https://owasp.org/www-project-top-ten/ - Security testing checklist
- **Performance Testing**: https://nodejs.org/en/docs/guides/simple-profiling/ - Node.js performance profiling
- **Workflow Testing Patterns**: https://docs.github.com/en/actions/automating-builds-and-tests/about-continuous-integration - CI/CD testing patterns

## OTHER CONSIDERATIONS:

### Security Architecture:

- Implement defense-in-depth for expression evaluation
- Add input sanitization at multiple layers (parser, evaluator, executor)
- Create security configuration profiles (strict, permissive, custom)
- Implement security audit logging for all expression evaluations

### Performance Optimizations:

- Cache compiled expressions to avoid repeated parsing
- Implement expression complexity limits to prevent DoS attacks
- Add timeout controls for long-running condition evaluations
- Optimize variable resolution for large contexts

### Error Recovery Patterns:

- Implement graceful fallback for condition evaluation failures
- Add retry logic for transient evaluation errors
- Create detailed error context for debugging complex conditions
- Implement circuit breakers for repeated evaluation failures

### Condition Evaluation Features:

- Support for mathematical operations and functions
- String manipulation and regex matching capabilities
- Date/time operations and comparisons
- Array and object manipulation in conditions

### Variable Lifecycle Management:

- Implement variable garbage collection for long-running workflows
- Add variable change tracking and audit trails
- Support for immutable variables and constants
- Create variable validation and type enforcement

### Integration Testing Strategy:

- Test all existing example workflows end-to-end
- Create performance benchmarks for workflow processing
- Add compatibility testing with different shell environments
- Implement regression testing for security vulnerabilities

### Monitoring Integration:

- Add metrics for condition evaluation performance
- Track security violation attempts and patterns
- Monitor variable access patterns for optimization
- Create alerting for unusual evaluation patterns

### Backward Compatibility:

- Maintain compatibility with existing workflow definitions
- Provide migration tools for security-sensitive workflows
- Document security improvements and breaking changes
- Add compatibility flags for gradual migration

### Success Criteria:

1. **Security**: Zero critical or high severity vulnerabilities in dependency scan
2. **Functionality**: All example workflows process successfully with correct condition evaluation
3. **Performance**: Condition evaluation completes within 100ms for typical expressions
4. **Integration**: End-to-end tests cover >90% of workflow processing paths
5. **Quality**: All existing tests continue to pass plus new security and integration tests
6. **Robustness**: Graceful handling of malformed expressions and edge cases

### Risk Mitigation:

- **Security Risk**: Comprehensive security testing and external audit
- **Performance Risk**: Benchmarking and optimization before release
- **Compatibility Risk**: Extensive testing with existing workflows
- **Complexity Risk**: Incremental implementation with continuous validation
