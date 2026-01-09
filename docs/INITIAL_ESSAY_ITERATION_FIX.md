## FEATURE:

Fix OpenCode Essay Simple Template - Incorrect Iteration Pattern Implementation

**Current Issue Analysis:**

The `templates/enhanced/opencode-essay-simple-template.yaml` has a critical workflow design flaw: the `content_writer` agent is not properly included within the `content_iterator` iteration loop. Currently, the content writer executes only once outside the iteration instead of executing for each planning file discovered.

**Root Cause:**

The template uses incorrect edge structure for flowsh's iteration pattern. Comparing with working examples like `examples/nodes/iteration-node-example.yaml`, the missing elements are:

1. **Missing Loop-Back Edge**: No edge from `content_writer` back to `content_iterator`
2. **Missing Iteration Complete Edge**: No `condition: 'iteration_complete'` edge from iterator to next node
3. **Incorrect Flow**: Current flow goes iterator → writer → editorial, should be iterator → writer → iterator (loop) → editorial (on complete)

**Verification Evidence:**

Generated shell script shows sequential execution instead of iteration:

```bash
execute_iteration_content_iterator()  # Executes once
execute_agent_content_writer()        # Executes once (WRONG)
execute_agent_editorial_agent()       # Executes once
```

Should be:

```bash
execute_iteration_content_iterator()  # Manages iteration
  → execute_agent_content_writer()    # Executes FOR EACH planning file
execute_agent_editorial_agent()       # Only after all iterations complete
```

**Impact:**

- Essay sections are not written individually per planning document
- Multi-agent workflow fails to process multiple content sections
- Template demonstrates incorrect flowsh iteration usage pattern

## EXAMPLES:

**Working Iteration Pattern (from examples/nodes/iteration-node-example.yaml):**

```yaml
edges:
  # Start iteration
  - source: 'initialize_results'
    target: 'iterate_files'

  # Iteration body - process each file
  - source: 'iterate_files'
    target: 'get_current_file'
  - source: 'get_current_file'
    target: 'analyze_file_type'
  # ... processing nodes ...
  - source: 'create_file_report'
    target: 'iterate_files' # LOOP BACK TO ITERATOR

  # When iteration completes
  - source: 'iterate_files'
    target: 'collect_iteration_results'
    condition: 'iteration_complete' # COMPLETION CONDITION
```

**Current Broken Pattern (in essay template):**

```yaml
edges:
  - source: find_plan_files
    target: content_iterator
  - source: content_iterator
    target: content_writer # NO LOOP BACK!
  - source: content_writer
    target: editorial_agent # BYPASSES ITERATION!
```

**Required Fix Pattern:**

```yaml
edges:
  - source: find_plan_files
    target: content_iterator
  - source: content_iterator
    target: content_writer # Into iteration body
  - source: content_writer
    target: content_iterator # LOOP BACK (missing)
  - source: content_iterator
    target: editorial_agent # ONLY when iteration_complete
    condition: 'iteration_complete'
```

## DOCUMENTATION:

**flowsh Iteration Node Reference:**

- **DSL Documentation**: `flowsh dsl iteration` - Shows required/optional properties
- **Working Example**: `examples/nodes/iteration-node-example.yaml` - Demonstrates complete iteration pattern with edges
- **Template System**: `flowsh init --help` - Shows template discovery and validation process
- **Compilation**: `flowsh compile` - Generates shell scripts showing execution flow

**Iteration Node Edge Patterns:**

From working examples in codebase:

1. **Entry Edge**: `source: previous_node → target: iteration_node`
2. **Body Entry**: `source: iteration_node → target: first_body_node`
3. **Body Processing**: `source: body_node → target: next_body_node` (standard flow)
4. **Loop Back**: `source: last_body_node → target: iteration_node` (critical for iteration)
5. **Completion**: `source: iteration_node → target: post_iteration_node` with `condition: 'iteration_complete'`

**Validation Commands:**

```bash
flowsh validate templates/enhanced/opencode-essay-simple-template.yaml
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml
flowsh init opencode-essay-simple-template test.yaml && flowsh compile test.yaml
```

## OTHER CONSIDERATIONS:

**Testing Requirements:**

1. **Template Validation**: Fixed template must pass `flowsh validate`
2. **Compilation Test**: Must generate correct shell script with iteration loop
3. **End-to-End Test**: Template instantiation → compilation → execution simulation
4. **Pattern Verification**: Compare generated script structure with working iteration examples

**Template System Integration:**

- Must maintain compatibility with existing template discovery system
- Preserve all existing conversation variables and configuration
- Keep template metadata and README documentation current
- Ensure template preview functionality shows correct structure

**Security and Safety:**

- Maintain all existing shell script safety features (`set -euo pipefail`)
- Preserve environment variable validation
- Keep timeout and error handling for OpenCode agent calls
- Maintain Telegram delivery security patterns

**Related Template Impact:**

Check if other templates in `templates/` directory use iteration patterns:

- Verify no other templates have the same edge pattern error
- Consider if this pattern appears in advanced templates
- Update template documentation if iteration pattern guidance is needed

**Success Criteria:**

1. **Structural Fix**: Template edges follow correct iteration pattern
2. **Generation Fix**: Compiled shell script shows content_writer in loop
3. **Execution Fix**: Instantiated template processes each planning file individually
4. **Validation Success**: Template passes all flowsh validation checks
5. **Pattern Compliance**: Matches proven iteration examples in codebase

**Implementation Verification:**

```bash
# Create test instance
flowsh init opencode-essay-simple-template test-essay-fixed.yaml

# Compile and check structure
flowsh compile test-essay-fixed.yaml > test-script.sh

# Verify iteration pattern in generated script
grep -A 10 -B 5 "execute_agent_content_writer" test-script.sh

# Should show content_writer called within iteration loop, not as standalone
```

**Downstream Effects:**

- Template users will get correct multi-section essay generation
- Demonstrates proper flowsh iteration usage for template authors
- Maintains OpenCode integration patterns established in template system
