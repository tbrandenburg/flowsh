## FEATURE: flowsh init Command - Template-based Workflow Initialization

### Core Functionality

Add a new `flowsh init` command to the flowsh CLI that enables users to easily create workflow files from the existing template collection in the `templates/` directory.

**Command Interface:**

- `flowsh init` - Display available templates in hierarchical format for discovery
- `flowsh init --help` - Display available templates and usage (same as above)
- `flowsh init [TEMPLATE] [TARGET_FILE]` - Create workflow file from template

**Template Selection Design:**

- **Discovery (Hierarchical Display)**: Show templates organized by directory structure (enhanced/, advanced/subcategories) to help users understand complexity levels and categories
- **Selection (Flat Commands)**: Use clean template names without paths or extensions for simple command execution
- **Example**: `templates/advanced/reliability/circuit-breaker-template.yaml` becomes `flowsh init circuit-breaker-template my-workflow.yaml`

### Detailed Requirements

**Template Processing:**

- Simple file copy from `templates/` directory to target location
- Strip template-specific comments during copy
- No variable substitution or placeholder processing
- Preserve core workflow structure and functionality

**Validation & Quality Assurance:**

- Use existing flowsh validation engine to check templates before copying
- Ensure copied workflow files pass `flowsh validate` requirements
- Validate template integrity as part of copy process

**Error Handling & Unix Philosophy:**

- **File Conflicts**: Overwrite target file if it already exists (no prompts)
- **Directory Creation**: Create target directories recursively if they don't exist
- **Invalid Template**: Print error message, display available templates list, exit with non-zero code
- **Non-interactive**: No user prompts, fully scriptable and pipe-friendly

**CLI Integration:**

- Leverage existing CLI patterns from `compile` and `validate` commands
- Match existing error message formats and output styling
- Consistent with current Commander.js CLI structure
- Follow established logging and error handling patterns

### Implementation Considerations

**Template Discovery:**

- Scan `templates/` directory recursively for `.yaml` files
- Build template name mapping (remove `.yaml` and `-template` suffixes for cleaner UX)
- Display in hierarchical structure showing organization and complexity levels

**File Operations:**

- Recursive directory creation for target paths
- File overwrite without confirmation (Unix philosophy)
- Preserve file permissions and timestamps where appropriate

**Cross-Platform Compatibility:**

- Template names must be UNIX and Windows filesystem safe
- Handle path separators correctly across platforms
- Robust file operation error handling

## EXAMPLES:

**Basic Usage Examples:**

```bash
# List all available templates
flowsh init

# Show help and available templates (same as above)
flowsh init --help

# Create workflow from enhanced template
flowsh init ai-to-telegram-simple my-bot.yaml

# Create workflow in subdirectory (auto-creates path)
flowsh init circuit-breaker workflows/resilient-api.yaml

# Create workflow from advanced template
flowsh init ai-chat-memory chat-session.yaml
```

**Expected Output Format:**

```
$ flowsh init
# or
$ flowsh init --help

Usage:
  flowsh init [TEMPLATE] [TARGET_FILE]

Available templates:
  enhanced:
    - ai-to-telegram-simple
    - ai-to-telegram-template
    - data-pipeline-simple
    - data-pipeline-template

  advanced:
    ai-workflows:
      - ai-chat-memory-template
    reliability:
      - circuit-breaker-template
    content-distribution:
      - content-moderation-template
    data-processing:
      - data-validation-cleanup-template
```

**Error Handling Examples:**

```bash
# Invalid template name
$ flowsh init invalid-template my-workflow.yaml
Error: Template 'invalid-template' not found.

Available templates:
[... full template list ...]

# Missing target file parameter
$ flowsh init circuit-breaker-template
Error: Missing required parameter TARGET_FILE
Usage: flowsh init [TEMPLATE] [TARGET_FILE]
```

## DOCUMENTATION:

**Existing Codebase References:**

- `src/cli/` - Current CLI implementation with Commander.js patterns
- `src/parsing/` - YAML parsing and validation logic to reuse
- `examples/` - Reference for template structure and organization
- `templates/` - 14 existing production-ready templates to expose via init command

**Technical Documentation:**

- Commander.js CLI framework: https://github.com/tj/commander.js/
- Node.js fs operations: https://nodejs.org/api/fs.html
- Path manipulation: https://nodejs.org/api/path.html

**flowsh-Specific Context:**

- Current CLI commands (`compile`, `validate`) for pattern consistency
- Existing validation engine integration points
- Error handling and logging patterns established in codebase
- Registry-based architecture for potential future template extensibility

## OTHER CONSIDERATIONS:

**Testing Requirements:**

- End-to-end testing for both sunny day and rainy day scenarios
- All 14 existing templates must work correctly with init command
- Test template name uniqueness validation (prevent conflicts)
- Cross-platform filesystem compatibility tests (UNIX/Windows safe names)
- Integration with existing Vitest test suite patterns
- Validation that copied templates pass `flowsh validate` checks

**Code Quality & Maintenance:**

- Follow existing TypeScript patterns and code organization
- Integrate with current error handling and logging systems
- Maintain consistency with existing CLI command structure
- Preserve flowsh's Unix philosophy: simple, focused, pipe-friendly

**Future Extensibility:**

- Template name mapping system should handle future template additions
- Directory structure scanning should be flexible for template reorganization
- Command structure should support potential future features (custom template directories)

**Documentation Updates:**

- Update README.md with new `init` command documentation
- Update AGENTS.md with init command usage patterns
- Include command examples in project documentation
- Document template organization and naming conventions

**Security & Robustness:**

- Rely on OS-level file permissions for security (no additional restrictions needed)
- Robust error handling for file system operations
- Input validation for template names and file paths
- Graceful handling of file system edge cases (permissions, disk space, etc.)

**Success Criteria:**

- Command seamlessly integrates with existing flowsh CLI experience
- All existing templates accessible and functional via init command
- Error messages are clear, helpful, and consistent with existing patterns
- Generated workflow files are immediately usable with `flowsh compile` and `flowsh validate`
- Implementation follows established flowsh coding patterns and architecture
- Comprehensive test coverage ensures reliability across platforms and scenarios
