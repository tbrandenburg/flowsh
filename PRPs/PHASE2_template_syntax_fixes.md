# PRP: Phase 2 - Template and Syntax Fixes (Medium Priority)

## PROJECT CONTEXT

**Repository**: flowsh - YAML workflow to shell script compiler
**Previous Phase**: Successfully implemented missing function mocks (Phase 1)
**Current Status**: Expected 15/19 examples passing after Phase 1
**Goal**: Fix template processing and shell syntax issues to reach 17-18/19 examples passing

## PROBLEM STATEMENT

After fixing missing function implementations, several examples still fail due to template variable processing issues and shell syntax errors. These require deeper fixes to the node generators and template systems.

## FEATURE:

### Primary Objectives

1. **Code Node Args Processing** - Fix argument concatenation in `code-node.ts`
   - **Error**: `find: paths must precede expression: 'f'`
   - **Issue**: Our previous fix to add args array processing isn't working correctly
   - **Need**: Debug and fix proper command + args concatenation

2. **HTTP Request Variable Escaping** - Fix shell variable assignment syntax
   - **Error**: `local: 'Resource, updated_by: flowsh, timestamp: 2024-01-01T12:00:00Z}': not a valid identifier`
   - **Issue**: Complex JSON-like strings breaking shell variable assignment
   - **Need**: Proper shell escaping for HTTP request body generation

3. **Fallback Node Strategy Processing** - Ensure template variables work correctly
   - **Error**: `Unknown fallback strategy: ` (empty strategy)
   - **Issue**: Strategy template variable may still not be processed after Phase 1 fix
   - **Need**: Verify and enhance template variable processing

### Secondary Objectives

- **Debug Code Node**: Understand why the args array fix didn't resolve the issue
- **Enhance HTTP Generator**: Improve JSON/complex string handling in shell variables
- **Template System Robustness**: Ensure all template variables are processed consistently

### Technical Requirements

- **Shell Compatibility**: Generated code must be valid bash/shell syntax
- **Template Variable Processing**: All `${variable}` patterns must resolve correctly
- **JSON Handling**: Complex data structures must be properly escaped for shell
- **Argument Processing**: Command arguments must be correctly concatenated and quoted
- **Error Prevention**: Prevent shell syntax errors from malformed variable assignments

### Expected Impact

- **Code Node Example**: Move from failing to passing
- **HTTP Request Example**: Move from failing to passing
- **Fallback Node Example**: Move from failing to passing (if not fixed in Phase 1)
- **Overall Success Rate**: 15/19 → 18/19 (94.7% success)

## EXAMPLES:

### Example 1: Code Node Proper Args Processing

**Current Issue**: `mkdir -p /tmp/flowsh-code-example` becomes `find: paths must precede expression`

**Expected Fix**:

```typescript
// In CodeNodeGenerator.generate()
generate(node: WorkflowNode, _context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo "No command specified"');
    const args = this.getNodeData(node, 'args', []);

    // Build the full command with proper quoting
    let fullCommand = String(command);

    if (Array.isArray(args) && args.length > 0) {
      const quotedArgs = args.map(arg => {
        const argStr = String(arg);
        // Quote arguments that contain spaces or special characters
        return argStr.includes(' ') || argStr.includes('*') ? `"${argStr}"` : argStr;
      });
      fullCommand = `${fullCommand} ${quotedArgs.join(' ')}`;
    }

    return this.processTemplateVariables(fullCommand, node.id);
}
```

### Example 2: HTTP Request JSON Escaping

**Current Issue**: JSON content breaks shell variable assignment

**Expected Fix**:

```typescript
// In HTTP request generator
private escapeForShellVariable(content: string): string {
    return content
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/"/g, '\\"')     // Escape quotes
        .replace(/`/g, '\\`')     // Escape backticks
        .replace(/\$/g, '\\$')    // Escape dollar signs
        .replace(/\n/g, '\\n');   // Escape newlines
}

// Usage
const requestBody = this.escapeForShellVariable(JSON.stringify(bodyData));
return `local request_body="${requestBody}"`;
```

### Example 3: Template Variable Debug Logging

**Add debugging to template processing**:

```typescript
private processConfigValue(value: any, defaultValue: any): string {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const variableName = value.slice(2, -1);
        const result = `\$(get_workflow_var "${variableName}" "${defaultValue}")`;
        console.log(`Template variable processed: ${value} -> ${result}`);
        return result;
    }
    return value?.toString() || defaultValue.toString();
}
```

## DOCUMENTATION:

### Current Generator Files

- **Code Node**: `src/generation/generators/code-node.ts` - Lines 15-22 contain current args processing
- **HTTP Request**: `src/generation/generators/http-request-node.ts` - Contains request body generation
- **Fallback Node**: `src/generation/generators/retry-fallback-node.ts` - FallbackNodeGenerator section
- **Base Generator**: `src/generation/generators/base-generator.ts` - Contains `processTemplateVariables()` method

### Error Analysis Files

- **Code Node Error**: `scripts/execution-results/nodes/code-node-example.result`
- **HTTP Request Error**: `scripts/execution-results/nodes/http-request-node-example.result`
- **Fallback Node Error**: `scripts/execution-results/nodes/fallback-node-example.result`

### Generated Scripts Location

- **Generated Scripts**: `scripts/generated-outputs/nodes/` - Contains the actual shell scripts with syntax errors
- **Code Example**: `scripts/generated-outputs/nodes/code-node-example.sh` - Line with broken find command
- **HTTP Example**: `scripts/generated-outputs/nodes/http-request-node-example.sh` - Line with broken variable assignment

### Shell Syntax References

- **Bash Manual**: Command argument handling and variable assignment rules
- **Shell Quoting**: Best practices for handling special characters in shell variables
- **JSON in Shell**: Techniques for safely embedding JSON data in shell scripts

## OTHER CONSIDERATIONS:

### Debugging Strategy

1. **Examine Generated Scripts**: Look at the actual shell code being generated
2. **Add Debug Logging**: Temporarily add console.log statements to generators
3. **Test Incrementally**: Fix one issue at a time and test immediately
4. **Compare Working Examples**: Look at passing examples for patterns

### Code Node Investigation

The args fix should have worked, so investigate:

- Are args being read correctly from YAML?
- Is the command concatenation happening?
- Are template variables in args being processed?
- Is there a quoting/escaping issue?

**Debug Steps**:

```typescript
console.log('Command:', command);
console.log('Args:', args);
console.log('Full command:', fullCommand);
console.log('Processed command:', processedCommand);
```

### HTTP Request JSON Handling

The error suggests a JSON structure is being treated as a shell variable name:

- Identify where the JSON is coming from
- Ensure proper escaping before shell variable assignment
- Consider using heredoc syntax for complex JSON:

```bash
local request_body=$(cat <<'EOF'
{"key": "value", "complex": "data"}
EOF
)
```

### Template Variable Consistency

Ensure all generators use the same template processing pattern:

- Check that `processConfigValue()` is applied to all configurable fields
- Verify that template variables resolve before shell script generation
- Add validation to catch unresolved template variables

### Shell Syntax Validation

Consider adding shell syntax validation:

- Use `bash -n script.sh` to check syntax before execution
- Add linting for generated shell scripts
- Implement quotes/escaping validation

### Risk Mitigation

- **Incremental Testing**: Fix one generator at a time
- **Backup Known Working**: Keep current passing examples working
- **Shell Safety**: Ensure all generated code is safe shell syntax
- **Template Validation**: Verify template variables resolve correctly

### Success Criteria

- **Code Node Example**: Successfully executes mkdir command with proper arguments
- **HTTP Request Example**: Properly handles JSON data without shell syntax errors
- **Fallback Node Example**: Uses non-empty strategy value from template processing
- **Generated Scripts**: All shell scripts pass `bash -n` syntax validation
- **Overall Success**: Move from ~15/19 to 17-18/19 examples passing
- **No Regression**: All previously passing examples continue to pass

### Files to Modify

1. **Primary**:
   - `src/generation/generators/code-node.ts` - Fix args concatenation
   - `src/generation/generators/http-request-node.ts` - Fix JSON escaping
   - `src/generation/generators/retry-fallback-node.ts` - Verify fallback strategy processing

2. **Possible**:
   - `src/generation/generators/base-generator.ts` - Enhance template processing if needed
   - Generator validation methods - Add shell syntax checks

### Testing Approach

1. **Individual Generator Testing**: Test each fixed generator separately
2. **Shell Syntax Validation**: Verify generated scripts with `bash -n`
3. **Template Resolution**: Confirm all `${variable}` patterns resolve
4. **Full Regression Test**: Run complete `make examples-all` suite
5. **Manual Verification**: Check specific error lines are fixed in generated scripts

### Edge Cases to Consider

- **Special Characters**: Commands/args containing quotes, spaces, backticks
- **Empty Values**: Template variables that resolve to empty strings
- **Complex JSON**: Nested objects, arrays, special characters in JSON
- **Shell Reserved Words**: Commands that might conflict with shell keywords
