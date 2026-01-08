# PRP: flowsh init --preview Feature Implementation

**Date**: 2025-01-08  
**Status**: Planning  
**Priority**: Medium  
**Type**: Feature Enhancement

## Overview

Extend the `flowsh init` command with a `--preview` flag that displays template content before creating files, enabling users and AI agents to evaluate template suitability without file system modifications.

## Philosophy: Preview-First Decision Making

**Before implementing template previews, ask**:

- How does this support the "jq of Workflows" philosophy of simplicity?
- What information helps users make the right template choice?
- How can we maintain the clean CLI interface while adding useful functionality?

**Core principles**:

1. **Informed Decision-Making**: Users should see exactly what they're getting before committing
2. **Non-Destructive Exploration**: Preview without creating files or directories
3. **Consistent Experience**: Preview behavior should mirror actual template processing

## Problem Statement

Currently, users must choose templates based only on:

- Template names and categories from `flowsh init` listing
- README files (when present)
- Trial-and-error template creation followed by file inspection

This creates friction in template selection, especially for:

- **AI agents** evaluating template fit for user requirements
- **New users** unfamiliar with workflow patterns
- **Developers** comparing similar templates (e.g., `ai-to-telegram` vs `ai-to-telegram-simple`)

## Success Criteria

### Must Have

- [ ] `flowsh init [TEMPLATE] --preview` displays template content to stdout
- [ ] Preview shows resolved template with placeholder variables highlighted
- [ ] Command provides clear, actionable information for template selection
- [ ] Zero file system modifications during preview
- [ ] Consistent with existing `flowsh init` UX patterns

### Should Have

- [ ] Template metadata display (description, node types, complexity)
- [ ] Required variables/environment variables listing
- [ ] Estimated script length and complexity indicators
- [ ] Support for all 14 existing production templates

### Could Have

- [ ] `--preview --json` for machine-readable output
- [ ] Template comparison mode (`--preview template1,template2`)
- [ ] Integration with `flowsh init` interactive selection

## Technical Requirements

### Command Syntax

```bash
# Primary use case
flowsh init ai-to-telegram-simple --preview

# Alternative patterns to consider
flowsh init --preview ai-to-telegram-simple
flowsh init ai-to-telegram-simple -p

# Enhanced output
flowsh init ai-to-telegram-simple --preview --verbose
```

### Expected Output Format

```yaml
# Template: ai-to-telegram-simple
# Category: Enhanced Templates
# Description: AI content generation with Telegram delivery
# Complexity: Low (3 nodes, 2 edges)
# Required Variables: OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
# Estimated Script Length: ~45 lines

workflow:
  name: 'AI to Telegram Simple'
  description: 'Generate AI content and send via Telegram'

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Start'
        variables:
          - variable: 'topic'
            type: 'text'
            label: 'Content Topic'
            default: '{{CONTENT_TOPIC}}' # ← Highlighted placeholder
    # ... rest of template content
```

### Implementation Strategy

#### Phase 1: Core Preview Functionality

1. **Extend CLI Interface** (`src/cli/index.ts`)
   - Add `--preview` flag to init command
   - Validate mutually exclusive with target file parameter
   - Route to preview handler instead of file creation

2. **Create Preview Service** (`src/templates/preview.ts`)
   - Load template content using existing `TemplateProcessor`
   - Display template without variable substitution
   - Highlight placeholder variables for user awareness
   - Extract and display metadata

3. **Template Analysis** (`src/templates/analyzer.ts`)
   - Calculate complexity metrics (node count, edge count)
   - Extract required variables and environment variables
   - Estimate generated script characteristics
   - Identify node types used

#### Phase 2: Enhanced Metadata

1. **Template Statistics**
   - Node type breakdown and complexity scoring
   - Required external dependencies (APIs, services)
   - Execution time estimates

2. **User Guidance**
   - Template selection recommendations
   - Usage examples and common patterns
   - Related templates suggestions

### Code Structure

```typescript
// src/templates/preview.ts
export interface TemplatePreview {
  templateId: string;
  category: string;
  description: string;
  content: string;
  metadata: TemplateMetadata;
  placeholders: string[];
  requiredVariables: string[];
}

export interface TemplateMetadata {
  complexity: 'low' | 'medium' | 'high';
  nodeCount: number;
  edgeCount: number;
  nodeTypes: string[];
  estimatedScriptLines: number;
  requiredEnvironmentVars: string[];
}

export async function previewTemplate(templateId: string): Promise<TemplatePreview> {
  // Implementation
}
```

### Integration Points

#### Existing Systems

- **Template Discovery** (`src/templates/discovery.ts`) - Reuse template loading logic
- **Template Processor** (`src/templates/processor.ts`) - Leverage existing processing pipeline
- **CLI Framework** (`src/cli/index.ts`) - Extend existing command structure

#### Modified Files

- `src/cli/index.ts` - Add preview flag and routing
- `src/templates/init-command.ts` - Add preview mode handling
- `src/templates/types.ts` - Add preview-specific type definitions

#### New Files

- `src/templates/preview.ts` - Core preview functionality
- `src/templates/analyzer.ts` - Template analysis utilities
- `src/templates/preview.test.ts` - Preview functionality tests

## Implementation Plan

### Sprint 1: Foundation (1-2 days)

- [ ] Design and implement core `TemplatePreview` interface
- [ ] Create basic preview service with template loading
- [ ] Extend CLI to accept `--preview` flag
- [ ] Add basic template content display

### Sprint 2: Enhanced Display (1 day)

- [ ] Implement template metadata extraction
- [ ] Add placeholder variable highlighting
- [ ] Design clean, informative output format
- [ ] Add complexity and statistics calculation

### Sprint 3: Polish & Testing (1 day)

- [ ] Comprehensive test coverage for preview functionality
- [ ] Integration with all 14 existing templates
- [ ] Error handling for invalid templates
- [ ] Documentation and help text updates

### Sprint 4: Validation (0.5 days)

- [ ] Manual testing across all template categories
- [ ] Performance testing with large templates
- [ ] UX validation with realistic scenarios

## Technical Considerations

### Security & Safety

- **No File System Modifications**: Preview mode must never create, modify, or delete files
- **Template Validation**: Ensure malicious templates cannot exploit preview functionality
- **Resource Limits**: Prevent excessive memory usage with large templates

### Performance

- **Fast Response**: Preview should be near-instantaneous for user experience
- **Caching Strategy**: Consider caching template analysis for repeated previews
- **Memory Efficiency**: Process templates without loading unnecessary dependencies

### Error Handling

```typescript
// Example error scenarios
- Template not found: "❌ Template 'invalid-name' not found. Run 'flowsh init' to see available templates."
- Template parse error: "❌ Template 'broken-template' has syntax errors: [specific error]"
- System errors: "❌ Preview failed: [technical error message]"
```

### Backwards Compatibility

- Existing `flowsh init` behavior remains unchanged
- New `--preview` flag is purely additive
- No breaking changes to template system or file formats

## Anti-Patterns to Avoid

❌ **Heavy Processing**: Don't perform full template compilation during preview

- Why bad: Slow response times hurt user experience
- Better: Parse and display raw template with minimal processing

❌ **File System Dependencies**: Don't create temporary files or directories

- Why bad: Violates preview-only contract, potential security issues
- Better: Keep all operations in memory

❌ **Information Overload**: Don't dump entire template analysis in preview

- Why bad: Too much information makes decision-making harder
- Better: Show essential information with optional verbose mode

❌ **Inconsistent Output**: Don't use different formatting than actual templates

- Why bad: Creates false expectations about template structure
- Better: Show exact template content that would be created

## Testing Strategy

### Unit Tests

```typescript
describe('Template Preview', () => {
  it('should load and display template content', () => {});
  it('should highlight placeholder variables', () => {});
  it('should calculate template metadata accurately', () => {});
  it('should handle invalid templates gracefully', () => {});
});
```

### Integration Tests

- Preview all 14 production templates
- Test CLI flag combinations
- Validate output format consistency
- Test error scenarios

### Manual Testing

- AI agent template selection workflows
- New user template exploration scenarios
- Template comparison use cases

## Documentation Updates

### README.md

Update examples section with preview usage:

```bash
# Explore templates before creating
flowsh init ai-to-telegram-simple --preview
flowsh init circuit-breaker --preview

# Create after previewing
flowsh init ai-to-telegram-simple my-workflow.yaml
```

### AGENTS.md

Add guidance for AI agents using preview functionality:

- Use `--preview` for template evaluation
- Parse preview output for template suitability
- Consider template complexity in selection

### Help Text

```bash
flowsh init --help
# Add preview option documentation
  --preview, -p    Display template content without creating files
```

## Success Metrics

### Immediate (MVP)

- [ ] All 14 templates preview successfully
- [ ] Preview displays in <500ms for any template
- [ ] Zero file system modifications during preview
- [ ] Clear, actionable template information displayed

### Short-term (4 weeks)

- [ ] User feedback indicates improved template selection
- [ ] Reduced trial-and-error template creation
- [ ] AI agents effectively use preview for template selection

### Long-term (12 weeks)

- [ ] Template preview becomes standard workflow for users
- [ ] Increased template usage diversity (not just popular templates)
- [ ] Foundation for future template enhancement features

## Risk Assessment

### Technical Risks

- **Template Processing Complexity**: Some templates might have complex dependencies
  - Mitigation: Start with simple templates, add complex template support iteratively
- **Output Format Consistency**: Different templates might need different preview formats
  - Mitigation: Define standard preview format, handle edge cases gracefully

### UX Risks

- **Information Overload**: Too much information in preview could confuse users
  - Mitigation: Focus on essential information, provide verbose flag for details

- **False Expectations**: Preview might not match exact file output
  - Mitigation: Ensure preview shows actual template content, document any limitations

### Maintenance Risks

- **Template System Changes**: Future template format changes could break preview
  - Mitigation: Design preview system to work with existing template infrastructure

## Future Enhancements

### Phase 2 Possibilities

- **Interactive Template Selection**: Integrate preview into `flowsh init` interactive mode
- **Template Comparison**: `flowsh init --compare template1,template2`
- **JSON Output**: `--preview --json` for programmatic consumption
- **Template Search**: `flowsh init --search "telegram ai"` with preview integration

### Template System Evolution

- **Template Metadata**: Standardized metadata in template files
- **Template Documentation**: Embedded documentation and usage examples
- **Template Dependencies**: Clear dependency and requirement specification

## Conclusion

The `flowsh init --preview` feature aligns with flowsh's Unix philosophy of providing simple, focused tools that work well together. By enabling informed template selection without file system modifications, this feature reduces friction in the workflow creation process while maintaining the clean, pipe-friendly interface that defines flowsh.

This enhancement particularly benefits AI agents and new users who need to evaluate template suitability before committing to file creation, supporting flowsh's goal of being "The jq of Workflows" - simple, powerful, and universally useful.

---

**Next Actions:**

1. Review PRP with team/maintainers
2. Create GitHub issue with PRP reference
3. Begin Sprint 1 implementation
4. Set up testing framework for preview functionality
