# PRP: CLI Output Option Implementation

**Feature Name**: CLI Output Option for FlowSH Compile Command
**Implementation Phase**: Phase 1 Enhancement
**Priority**: Medium
**Estimated Complexity**: Simple

## Feature Overview

Add `--output/-o` option to the FlowSH CLI compile command to write generated shell scripts directly to a file instead of stdout, improving developer workflow and enabling better automation.

### Core Requirements

- Add `-o, --output <file>` option to the existing compile command
- Create parent directories automatically when they don't exist
- Overwrite existing files without prompting for streamlined workflow
- Maintain backward compatibility - continue stdout output when no output option specified
- Implement basic error handling for file system operations

### Success Criteria

- [ ] Can generate files with both `-o` and `--output` flags
- [ ] Automatically creates directory structure when needed
- [ ] Stdout behavior unchanged when no output option used
- [ ] Graceful error handling for file write failures
- [ ] All existing functionality remains unchanged
- [ ] New feature works with all existing YAML workflow examples

## Technical Specification

### Architecture Design

```
CLI Command Layer
├── Commander.js Option Parsing
│   ├── -o, --output <file> option added
│   └── Optional parameter handling
├── compileCommand Function Enhancement
│   ├── Output parameter integration
│   ├── File path validation
│   └── Directory creation logic
└── File System Operations
    ├── fs.mkdirSync for directory creation
    ├── fs.writeFileSync for file output
    └── Error handling wrapper
```

### TypeScript Interfaces

```typescript
// Enhanced compile command options
interface CompileCommandOptions {
  output?: string; // File path for generated script
}

// File operation result type
interface FileWriteResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
```

### Integration Points

- **CLI Layer**: Commander.js command option addition at `src/cli/index.ts:132`
- **File System**: Node.js fs and path modules for file operations
- **Error Handling**: Integration with existing error reporting patterns
- **Backward Compatibility**: No changes to existing stdout behavior

## Implementation Approach

### Phase 1: Core Foundation

1. **Add Commander.js Option Definition**
   - Modify existing compile command definition around line 132
   - Add `.option('-o, --output <file>', 'output generated script to file')`
   - Update command action handler to accept options parameter

2. **Enhance compileCommand Function**
   - Add optional output parameter to function signature
   - Implement conditional logic: output to file OR stdout
   - Add basic parameter validation for file path

3. **File System Integration**
   - Import fs and path modules at top of file
   - Implement directory creation with `fs.mkdirSync(path.dirname(), { recursive: true })`
   - Implement file writing with `fs.writeFileSync()`

### Phase 2: Integration & Enhancement

1. **Error Handling Implementation**
   - Wrap file operations in try-catch blocks
   - Provide user-friendly error messages for common failures
   - Handle edge cases like permission issues and invalid paths

2. **Path Validation and Normalization**
   - Use path.resolve() to handle relative vs absolute paths
   - Validate output directory is writable before attempting write
   - Handle special characters and spaces in file paths correctly

3. **Testing and Validation**
   - Test with all existing workflow examples
   - Verify directory creation works across platforms
   - Validate backward compatibility maintained

### Phase 3: Polish & Optimization

1. **User Experience Improvements**
   - Add success confirmation message when file written
   - Provide helpful error context (permissions, disk space, etc.)
   - Ensure consistent behavior across operating systems

2. **Documentation Updates**
   - Update CLI help text with usage examples
   - Add examples to README showing both usage patterns
   - Document any platform-specific behavior

## Code Examples & Patterns

### Expected CLI Usage

```bash
# Basic file output
flowsh compile examples/hello-world.yaml -o scripts/hello-world.sh

# Long form option
flowsh compile workflow.yaml --output /tmp/generated/script.sh

# Directory creation
flowsh compile workflow.yaml -o new-folder/subfolder/script.sh

# Backward compatibility maintained
flowsh compile workflow.yaml > manual-redirect.sh
flowsh compile workflow.yaml | tee script.sh
```

### Implementation Pattern (src/cli/index.ts)

```typescript
// Around line 132 - Add option to existing command
.option('-o, --output <file>', 'output generated script to file')
.action(async (yamlFile: string, options: CompileCommandOptions) => {
  await compileCommand(yamlFile, options.output);
});

// Enhanced compileCommand function
async function compileCommand(yamlFile: string, outputFile?: string): Promise<void> {
  try {
    const generateResult = await generateShellScript(yamlFile);

    if (outputFile) {
      // Create directories if they don't exist
      const outputDir = path.dirname(outputFile);
      if (outputDir !== '.') {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(outputFile, generateResult.script);
      console.log(`Generated script saved to: ${outputFile}`);
    } else {
      // Existing behavior - output to stdout
      console.log(generateResult.script);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

### Error Handling Pattern

```typescript
// Comprehensive error handling for file operations
function writeScriptToFile(script: string, outputFile: string): void {
  try {
    const resolvedPath = path.resolve(outputFile);
    const outputDir = path.dirname(resolvedPath);

    // Create directory structure
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(resolvedPath, script);
    console.log(`✓ Generated script saved to: ${resolvedPath}`);
  } catch (error) {
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied writing to: ${outputFile}`);
    } else if (error.code === 'ENOSPC') {
      throw new Error(`No space left on device for: ${outputFile}`);
    } else {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }
}
```

## Testing Strategy

### Unit Tests

- [ ] Test option parsing with both `-o` and `--output` flags
- [ ] Test directory creation for non-existent paths
- [ ] Test file overwrite behavior without confirmation
- [ ] Test error handling for permission failures
- [ ] Test backward compatibility when no output option specified

### Integration Tests

- [ ] End-to-end test with existing YAML examples
- [ ] Test with complex directory structures
- [ ] Verify generated files have correct content and permissions
- [ ] Test cross-platform behavior (Windows/Unix path handling)

### Test Cases

```typescript
// Example unit test structure
describe('CLI Output Option', () => {
  test('should write to file when -o option provided', async () => {
    const tempFile = path.join(tmpdir(), 'test-output.sh');
    await compileCommand('examples/hello-world.yaml', tempFile);
    expect(fs.existsSync(tempFile)).toBe(true);
  });

  test('should create directories when they do not exist', async () => {
    const tempFile = path.join(tmpdir(), 'new/nested/output.sh');
    await compileCommand('examples/hello-world.yaml', tempFile);
    expect(fs.existsSync(tempFile)).toBe(true);
  });

  test('should still output to stdout when no output option', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    await compileCommand('examples/hello-world.yaml');
    expect(consoleSpy).toHaveBeenCalled();
  });
});
```

## Validation Requirements

### Pre-Implementation Validation

```bash
make lint           # Code quality passes
make test           # Existing tests pass
make build          # TypeScript compilation succeeds
npm run test:examples  # All YAML examples parse correctly
```

### Implementation Validation Loop

```bash
# Development validation cycle
make dev            # Start development mode
# Implement changes incrementally
npm test -- --watch  # Run tests in watch mode
make lint           # Check code quality after changes
# Test manual scenarios:
# flowsh compile examples/hello-world.yaml -o test/output.sh
# flowsh compile examples/hello-world.yaml --output test/output2.sh
# flowsh compile examples/hello-world.yaml  # Verify stdout still works
```

### Post-Implementation Validation

- [ ] All existing YAML examples compile successfully to files
- [ ] All existing YAML examples still compile to stdout when no option specified
- [ ] New option works with complex nested directory paths
- [ ] File permissions are appropriate on generated scripts
- [ ] CLI help text shows new option correctly
- [ ] No breaking changes to existing workflows

## Error Handling Requirements

### User-Facing Errors

- Provide clear, actionable error messages for file system failures
- Include specific file paths in error messages for context
- Handle common scenarios like permission denied and disk full
- Use consistent error formatting with existing CLI patterns

### Error Message Examples

```typescript
// Good error messages for users
'Error: Permission denied writing to: /root/protected/script.sh';
'Error: No space left on device for: /tmp/script.sh';
'Error: Invalid file path: /invalid\0/path.sh';
'Error: Unable to create directory: /readonly/path/';
```

### Developer Experience

- Maintain TypeScript strict mode compliance
- Add JSDoc documentation for new function parameters
- Include debug logging for file operations when needed
- Proper error propagation through the command chain

## Dependencies & Compatibility

### Existing Dependencies Used

- **fs (Node.js built-in)**: File system operations
- **path (Node.js built-in)**: Path manipulation and validation
- **Commander.js (existing)**: CLI option parsing
- **Existing error handling patterns**: Consistent error reporting

### No New Dependencies Required

- Implementation uses only Node.js built-in modules
- Leverages existing Commander.js setup
- No additional npm packages needed

### Breaking Changes

- **None**: Feature is purely additive
- Existing CLI behavior unchanged when no output option used
- All current scripts and automation continue to work
- Backward compatibility maintained 100%

### Performance Impact

- **Minimal**: File writing is typically faster than console output
- **Memory**: No additional memory overhead
- **Raspberry Pi Compatibility**: File operations are standard and supported

## Documentation Updates

### Required Documentation

- [ ] Update README.md with new CLI option examples
- [ ] Add usage examples showing both stdout and file output modes
- [ ] Update CLI help text with option description
- [ ] Include examples folder demonstrating typical usage patterns

### CLI Help Text Update

```bash
# Updated help output should include:
Usage: flowsh compile [options] <yaml-file>

Compile a FlowSH YAML workflow to a shell script

Options:
  -o, --output <file>  output generated script to file
  -h, --help          display help for command

Examples:
  flowsh compile workflow.yaml                    # Output to stdout
  flowsh compile workflow.yaml -o script.sh       # Save to file
  flowsh compile workflow.yaml --output script.sh # Save to file (long form)
```

## Future Considerations

### Extensibility

- Design supports future enhancements like output format options
- File writing logic can be extended for other output types
- Directory creation pattern can be reused for other commands

### Potential Enhancements

- Add `--force` option to explicitly control file overwrite behavior
- Support for output format specification (bash, sh, zsh specific)
- Integration with template system for custom script headers
- Batch compilation mode for multiple files

### Maintenance

- Simple implementation minimizes maintenance overhead
- Standard Node.js APIs ensure long-term compatibility
- Clear separation of concerns for easy testing and debugging

---

## Implementation Checklist

### Development Tasks

- [ ] Add Commander.js option definition to compile command
- [ ] Modify compileCommand function signature to accept output parameter
- [ ] Implement directory creation logic with fs.mkdirSync
- [ ] Implement file writing logic with fs.writeFileSync
- [ ] Add comprehensive error handling with user-friendly messages
- [ ] Add success confirmation message when file is written

### Testing Tasks

- [ ] Write unit tests for option parsing
- [ ] Write unit tests for file operations
- [ ] Write unit tests for error scenarios
- [ ] Test with all existing YAML examples
- [ ] Test cross-platform compatibility
- [ ] Test edge cases (special characters, long paths, etc.)

### Documentation Tasks

- [ ] Update CLI help text
- [ ] Add examples to README
- [ ] Update any relevant documentation files
- [ ] Verify JSDoc comments are complete

### Validation Tasks

- [ ] Run full test suite
- [ ] Test manually with various YAML files
- [ ] Verify backward compatibility maintained
- [ ] Check TypeScript compilation passes
- [ ] Validate linting passes

---

## Notes for Implementation

### Code Quality Standards

- Follow existing flowsh TypeScript conventions
- Maintain strict type safety throughout implementation
- Use existing error handling patterns for consistency
- Include meaningful JSDoc comments for the new functionality

### Key Implementation Points

1. **File Location**: Primary changes in `src/cli/index.ts` around lines 24-135
2. **Import Additions**: Add `import { fs, path } from 'fs'` and `import * as path from 'path'`
3. **Function Signature**: Modify `compileCommand(yamlFile: string, outputFile?: string)`
4. **Conditional Logic**: Use simple if/else to choose output method
5. **Error Handling**: Wrap file operations in try-catch with specific error messages

### Testing Priority

- Focus on backward compatibility validation
- Ensure all existing examples still work
- Test directory creation thoroughly
- Validate error messages are helpful and accurate

This implementation provides a clean, simple enhancement to FlowSH's CLI interface while maintaining full backward compatibility and following established code patterns in the project.
