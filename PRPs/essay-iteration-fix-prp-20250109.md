# OpenCode Essay Template Iteration Pattern Fix - PRP

**Created:** January 9, 2026  
**Type:** Bug Fix / Template Correction  
**Priority:** High  
**Complexity:** Medium

## OBJECTIVE

Fix the OpenCode Essay Simple Template (`templates/enhanced/opencode-essay-simple-template.yaml`) to properly implement flowsh's iteration pattern, ensuring the content writer agent executes for each planning file rather than only once outside the iteration loop.

## PROBLEM STATEMENT

### Current Broken Behavior

- Template defines `content_iterator` (iteration node) and `content_writer` (agent node)
- Edge structure bypasses proper iteration: `content_iterator → content_writer → editorial_agent`
- Content writer executes only once, not for each planning file
- Generated shell script shows sequential execution instead of iteration loop

### Root Cause Analysis

Incorrect edge pattern implementation compared to working flowsh iteration examples:

**Missing Elements:**

1. Loop-back edge from `content_writer` to `content_iterator`
2. `condition: 'iteration_complete'` edge for iteration termination
3. Proper iteration body flow structure

**Evidence:**

```bash
# Current (broken) - from compiled script
execute_iteration_content_iterator()  # Executes once
execute_agent_content_writer()        # Executes once (WRONG)
execute_agent_editorial_agent()       # Executes once

# Should be:
execute_iteration_content_iterator()  # Manages loop
  → execute_agent_content_writer()    # FOR EACH planning file
execute_agent_editorial_agent()       # After iteration complete
```

## REQUIREMENTS

### Functional Requirements

- [x] **FR1**: Content writer must execute for each planning file discovered
- [x] **FR2**: Iteration must follow flowsh's proven pattern from examples
- [x] **FR3**: Template must pass `flowsh validate` checks
- [x] **FR4**: Generated shell script must show correct iteration structure
- [x] **FR5**: All existing template functionality must be preserved

### Technical Requirements

- [x] **TR1**: Fix edge structure in template YAML file
- [x] **TR2**: Add missing loop-back edge: `content_writer → content_iterator`
- [x] **TR3**: Add completion edge with condition: `content_iterator → editorial_agent` (condition: 'iteration_complete')
- [x] **TR4**: Maintain all existing node configurations
- [x] **TR5**: Preserve template metadata and documentation

### Validation Requirements

- [x] **VR1**: Template instantiation via `flowsh init` succeeds
- [x] **VR2**: Template compilation via `flowsh compile` succeeds
- [x] **VR3**: Generated script structure matches working iteration examples
- [x] **VR4**: End-to-end test shows multi-file processing capability

## EXAMPLES

### Reference Pattern (from examples/nodes/iteration-node-example.yaml)

```yaml
edges:
  # Into iteration
  - source: 'initialize_results'
    target: 'iterate_files'

  # Iteration body
  - source: 'iterate_files'
    target: 'get_current_file'
  - source: 'get_current_file'
    target: 'analyze_file_type'
  # ... processing chain ...
  - source: 'create_file_report'
    target: 'iterate_files' # LOOP BACK (critical)

  # Iteration completion
  - source: 'iterate_files'
    target: 'collect_iteration_results'
    condition: 'iteration_complete' # COMPLETION CONDITION
```

### Required Fix for Essay Template

```yaml
edges:
  # Existing edges (keep these)
  - source: find_plan_files
    target: content_iterator

  # Fixed iteration pattern
  - source: content_iterator
    target: content_writer # Into iteration body
  - source: content_writer
    target: content_iterator # LOOP BACK (add this)

  # Iteration completion (fix this)
  - source: content_iterator
    target: editorial_agent
    condition: 'iteration_complete' # Add condition

  # Rest of workflow (keep existing)
  - source: editorial_agent
    target: prepare_message
  # ... etc
```

## IMPLEMENTATION STRATEGY

### Phase 1: Analysis and Verification

1. **Document Current State**

   ```bash
   flowsh validate templates/enhanced/opencode-essay-simple-template.yaml
   flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > current-broken.sh
   ```

2. **Analyze Working Pattern**

   ```bash
   flowsh validate examples/nodes/iteration-node-example.yaml
   flowsh compile examples/nodes/iteration-node-example.yaml > working-example.sh
   ```

3. **Compare Edge Structures**
   - Extract edge patterns from both files
   - Identify exact differences in iteration handling

### Phase 2: Template Correction

1. **Backup Current Template**

   ```bash
   cp templates/enhanced/opencode-essay-simple-template.yaml templates/enhanced/opencode-essay-simple-template.yaml.backup
   ```

2. **Apply Edge Fixes**
   - Modify edges section in template YAML
   - Add loop-back edge: `source: content_writer → target: content_iterator`
   - Modify completion edge to include `condition: 'iteration_complete'`

3. **Validate Fix**
   ```bash
   flowsh validate templates/enhanced/opencode-essay-simple-template.yaml
   ```

### Phase 3: Testing and Verification

1. **Template Instantiation Test**

   ```bash
   flowsh init opencode-essay-simple-template test-fixed.yaml
   flowsh validate test-fixed.yaml
   ```

2. **Compilation Structure Test**

   ```bash
   flowsh compile test-fixed.yaml > fixed-script.sh
   # Verify iteration pattern in generated shell script
   grep -A 20 -B 5 "execute_agent_content_writer" fixed-script.sh
   ```

3. **Pattern Verification Test**
   - Compare generated script structure with working iteration examples
   - Ensure content_writer is called within iteration loop
   - Verify iteration variables are properly set

### Phase 4: Documentation Update

1. **Template README** - Update if iteration pattern is documented
2. **Template Metadata** - Verify template discovery information is current
3. **Example Verification** - Ensure template demonstrates correct flowsh usage

## ACCEPTANCE CRITERIA

### Must Have (Definition of Done)

- [ ] **AC1**: Template passes `flowsh validate` without errors
- [ ] **AC2**: Template compiles to shell script without warnings
- [ ] **AC3**: Generated shell script shows content_writer within iteration loop
- [ ] **AC4**: Edge structure matches proven flowsh iteration pattern
- [ ] **AC5**: All existing template functionality preserved (Telegram, OpenCode agents, etc.)

### Should Have (Quality Gates)

- [ ] **AC6**: Template instantiation works without errors
- [ ] **AC7**: Compiled script structure matches working examples
- [ ] **AC8**: Template demonstrates best practice iteration usage
- [ ] **AC9**: No regression in other template functionality

### Nice to Have (Enhancements)

- [ ] **AC10**: Template comments explain iteration pattern
- [ ] **AC11**: Template README documents iteration workflow
- [ ] **AC12**: Additional templates reviewed for similar issues

## TESTING STRATEGY

### Unit Tests

1. **Template Validation**

   ```bash
   flowsh validate templates/enhanced/opencode-essay-simple-template.yaml
   ```

2. **Template Compilation**
   ```bash
   flowsh compile templates/enhanced/opencode-essay-simple-template.yaml
   ```

### Integration Tests

1. **Template Instantiation**

   ```bash
   flowsh init opencode-essay-simple-template test-essay.yaml
   flowsh validate test-essay.yaml
   flowsh compile test-essay.yaml
   ```

2. **Generated Script Analysis**
   ```bash
   # Verify iteration structure
   grep -n "execute_agent_content_writer" compiled-script.sh
   grep -n "iteration_complete" compiled-script.sh
   ```

### End-to-End Tests

1. **Multi-File Processing Simulation**
   - Create test environment with multiple planning files
   - Execute generated script (with mocked OpenCode calls)
   - Verify content_writer processes each file individually

2. **Workflow Completion Test**
   - Verify entire workflow completes successfully
   - Check Telegram delivery still works
   - Ensure editorial agent runs only after all content sections processed

## RISKS AND MITIGATION

### High Risk

- **Risk**: Breaking existing template functionality
  - **Mitigation**: Comprehensive backup and rollback plan
  - **Detection**: Full template test suite before deployment

### Medium Risk

- **Risk**: Generated script syntax errors
  - **Mitigation**: Script compilation testing in Phase 3
  - **Detection**: Shell script linting and basic execution test

### Low Risk

- **Risk**: Template metadata inconsistency
  - **Mitigation**: Template discovery system validation
  - **Detection**: `flowsh init` listing verification

## DELIVERABLES

1. **Fixed Template File** - `templates/enhanced/opencode-essay-simple-template.yaml`
2. **Validation Report** - Demonstrating all tests pass
3. **Before/After Comparison** - Generated script structure differences
4. **Testing Documentation** - Commands and results for verification

## SUCCESS METRICS

### Primary Success Indicators

- Template validates and compiles without errors
- Content writer executes in iteration loop (not standalone)
- Generated essay has proper multi-section processing

### Secondary Success Indicators

- Template instantiation time < 5 seconds
- No regression in existing template features
- Pattern matches established flowsh iteration examples

## IMPLEMENTATION NOTES

### Key Files to Modify

- `templates/enhanced/opencode-essay-simple-template.yaml` - Primary fix target
- Test files for verification only

### Edge Pattern Specific Changes

```yaml
# REMOVE (current broken):
- source: content_writer
  target: editorial_agent

# ADD (correct pattern):
- source: content_writer
  target: content_iterator

# MODIFY (add condition):
- source: content_iterator
  target: editorial_agent
  condition: 'iteration_complete'
```

### Verification Commands

```bash
# Pre-fix validation
flowsh validate templates/enhanced/opencode-essay-simple-template.yaml

# Apply fix (manual YAML edit)

# Post-fix validation
flowsh validate templates/enhanced/opencode-essay-simple-template.yaml
flowsh compile templates/enhanced/opencode-essay-simple-template.yaml > fixed-script.sh

# Pattern verification
grep -A 10 -B 5 "content_writer" fixed-script.sh
```

---

**PRP Status**: Ready for Implementation  
**Estimated Effort**: 2-4 hours  
**Technical Debt**: None created, fixes existing architectural issue
