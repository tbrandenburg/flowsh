# flowsh Phase 2A: Essential Loops Implementation

**Creation Date**: January 3, 2026  
**Implementation Phase**: Phase 2A - Essential Control Flow  
**Priority**: CRITICAL  
**Estimated Effort**: 2-3 weeks  
**Success Criteria**: Loop and Iteration nodes fully functional with clean generated scripts

## Problem Statement

flowsh currently only supports Phase 1 (MVP) node types, limiting it to linear workflows. To be practically useful for real-world automation, flowsh needs Phase 2A control flow capabilities: **Loop Nodes** for conditional repetition and **Iteration Nodes** for batch processing workflows.

**Current Gap**:

- Loop and Iteration types are defined in DSL but have no generators
- Users cannot create workflows with repetitive processing
- Complex automation workflows are impossible to express

**Business Impact**:

- flowsh cannot compete with GitHub Actions, Ansible for real automation
- Users must implement repetition manually in shell scripts
- Limits adoption for practical workflow automation use cases

## Success Criteria

### Primary Goals

1. **Loop Nodes**: Generate clean bash loops with condition evaluation and proper variable scoping
2. **Iteration Nodes**: Generate sequential array processing with result collection
3. **Clean Generated Scripts**: Maintain "jq of Workflows" philosophy of readable output
4. **Test Coverage**: Comprehensive tests for all new node generators
5. **Documentation**: Updated examples and CLI validation for new node types

### Quality Metrics

- ✅ All existing tests continue passing (89/89)
- ✅ Loop workflows execute correctly with proper exit conditions
- ✅ Iteration workflows process arrays and collect results accurately
- ✅ Generated scripts remain clean and debuggable (&lt;100 lines for typical workflows)
- ✅ Error handling prevents infinite loops and graceful failure modes

## Technical Specification

### Architecture Decisions (Based on Best Practices Analysis)

#### Loop Node Strategy: Function-Based with Local Scoping

```bash
# Generated Loop Node Pattern
execute_loop_${node_id}() {
    log_step "🔄 Starting Loop: ${node.data.title}"

    local loop_counter=0
    local max_iterations=${node.data.max_iterations:-100}
    local continue_loop=true

    while [[ "$continue_loop" == "true" && $loop_counter -lt $max_iterations ]]; do
        # Evaluate loop condition
        if ! evaluate_condition "${loop_condition_expression}"; then
            log_info "Loop exit condition met at iteration $loop_counter"
            break
        fi

        # Execute loop body nodes with iteration context
        execute_loop_body_${loop_counter}() {
            local iteration_number=$1
            # Set loop variables available to child nodes
            set_workflow_var "loop_index" "$iteration_number"
            set_workflow_var "loop_iteration" "$iteration_number"

            # Execute child nodes here
            ${child_node_calls}
        }

        execute_loop_body_${loop_counter} "$loop_counter"
        ((loop_counter++))
    done

    log_success "Loop completed after $loop_counter iterations"
}
```

#### Iteration Node Strategy: Sequential Processing with Result Collection

```bash
# Generated Iteration Node Pattern
execute_iteration_${node_id}() {
    log_step "🔁 Starting Iteration: ${node.data.title}"

    local input_variable="${node.data.input_variable}"
    local output_variable="${node.data.output_variable:-iteration_results}"
    local input_array_raw="$(get_workflow_var "$input_variable")"

    # Parse input array (newline-separated values)
    local -a input_array
    while IFS= read -r item; do
        [[ -n "$item" ]] && input_array+=("$item")
    done <<< "$input_array_raw"

    local -a output_results=()

    for item_index in "${!input_array[@]}"; do
        local current_item="${input_array[$item_index]}"

        # Execute iteration body with item context
        execute_iteration_body_${item_index}() {
            local iteration_item="$1"
            local iteration_index="$2"

            # Set iteration variables available to child nodes
            set_workflow_var "iteration_item" "$iteration_item"
            set_workflow_var "iteration_index" "$iteration_index"

            # Execute child nodes here
            ${child_node_calls}

            # Return result from child execution
            echo "$(get_workflow_var 'iteration_result' '')"
        }

        local iteration_result
        iteration_result=$(execute_iteration_body_${item_index} "$current_item" "$item_index")
        output_results+=("$iteration_result")

        log_debug "Processed item $item_index: $current_item -> $iteration_result"
    done

    # Aggregate results
    local aggregated_results
    aggregated_results=$(IFS=$'\n'; echo "${output_results[*]}")
    set_workflow_var "$output_variable" "$aggregated_results"

    log_success "Iteration completed: processed ${#input_array[@]} items"
}
```

### Implementation Components

#### 1. Loop Node Generator (`src/generation/generators/loop-node.ts`)

```typescript
export class LoopNodeGenerator extends BaseNodeGenerator {
  getNodeType(): NodeType {
    return 'loop';
  }

  generateShellScript(
    node: WorkflowNode,
    context: GenerationContext,
    options: GenerationOptions
  ): string {
    const data = node.data as LoopNodeData;

    // Validate loop configuration
    this.validateLoopConfig(data);

    // Generate condition evaluation logic
    const conditionCode = this.generateConditionEvaluation(data.condition);

    // Generate loop structure with proper scoping
    return this.generateLoopFunction(node, conditionCode, context, options);
  }

  private validateLoopConfig(data: LoopNodeData): void {
    if (!data.condition) {
      throw new Error('Loop node must have a condition');
    }
    if (data.max_iterations && data.max_iterations < 1) {
      throw new Error('max_iterations must be positive');
    }
  }

  private generateConditionEvaluation(condition: IfElseCondition): string {
    // Reuse condition evaluation from if-else node
    return ConditionEvaluator.generateConditionCheck(condition);
  }

  private generateLoopFunction(
    node: WorkflowNode,
    conditionCode: string,
    context: GenerationContext,
    options: GenerationOptions
  ): string {
    const data = node.data as LoopNodeData;
    const functionName = `execute_loop_${this.sanitizeId(node.id)}`;

    return `
# Execute loop node: ${node.id}
${functionName}() {
    ${this.generateLoopHeader(data)}
    
    while [[ "$continue_loop" == "true" && $loop_counter -lt $max_iterations ]]; do
        ${conditionCode}
        
        if ! evaluate_condition; then
            log_info "Loop exit condition met at iteration $loop_counter"
            break
        fi
        
        ${this.generateLoopBody(node, context, options)}
        
        ((loop_counter++))
    done
    
    ${this.generateLoopFooter()}
}`;
  }
}
```

#### 2. Iteration Node Generator (`src/generation/generators/iteration-node.ts`)

```typescript
export class IterationNodeGenerator extends BaseNodeGenerator {
  getNodeType(): NodeType {
    return 'iteration';
  }

  generateShellScript(
    node: WorkflowNode,
    context: GenerationContext,
    options: GenerationOptions
  ): string {
    const data = node.data as IterationNodeData;

    // Validate iteration configuration
    this.validateIterationConfig(data);

    // Generate iteration processing logic
    return this.generateIterationFunction(node, context, options);
  }

  private validateIterationConfig(data: IterationNodeData): void {
    if (!data.input_variable) {
      throw new Error('Iteration node must have input_variable');
    }
  }

  private generateIterationFunction(
    node: WorkflowNode,
    context: GenerationContext,
    options: GenerationOptions
  ): string {
    const data = node.data as IterationNodeData;
    const functionName = `execute_iteration_${this.sanitizeId(node.id)}`;

    return `
# Execute iteration node: ${node.id}
${functionName}() {
    ${this.generateIterationHeader(data)}
    
    for item_index in "\${!input_array[@]}"; do
        local current_item="\${input_array[$item_index]}"
        
        ${this.generateIterationBody(node, context, options)}
        
        output_results+=("$iteration_result")
    done
    
    ${this.generateIterationFooter(data)}
}`;
  }
}
```

#### 3. Enhanced Condition Evaluator (`src/generation/conditions/loop-condition-evaluator.ts`)

- Extend existing condition evaluation for loop contexts
- Support loop-specific variables (`loop_index`, `loop_iteration`)
- Add break condition handling

#### 4. Registry Integration

- Register new generators in `registerDefaultGenerators()`
- Update `createDefaultRegistry()` to include loop/iteration support
- Ensure proper generator ordering for complex workflows

### Testing Strategy

#### Unit Tests

```typescript
// tests/generation/generators/loop-node.test.ts
describe('LoopNodeGenerator', () => {
  it('should generate proper while loop structure', () => {
    const generator = new LoopNodeGenerator();
    const result = generator.generateShellScript(mockLoopNode, mockContext, mockOptions);

    expect(result).toContain('while [[ "$continue_loop" == "true"');
    expect(result).toContain('local loop_counter=0');
    expect(result).toContain('((loop_counter++))');
  });

  it('should include max_iterations protection', () => {
    const result = generator.generateShellScript(mockLoopNodeWithMax, mockContext, mockOptions);
    expect(result).toContain('loop_counter -lt $max_iterations');
  });

  it('should handle condition evaluation', () => {
    const result = generator.generateShellScript(
      mockLoopNodeWithCondition,
      mockContext,
      mockOptions
    );
    expect(result).toContain('evaluate_condition');
  });
});
```

#### Integration Tests

```typescript
// tests/integration/phase2a-workflows.test.ts
describe('Phase 2A Workflows', () => {
  it('should execute simple counting loop', async () => {
    const workflow = loadWorkflow('examples/counting-loop.yaml');
    const result = await executeWorkflow(workflow);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Loop completed after 5 iterations');
  });

  it('should process file list iteration', async () => {
    const workflow = loadWorkflow('examples/file-processing-iteration.yaml');
    const result = await executeWorkflow(workflow);

    expect(result.exitCode).toBe(0);
    expect(result.variables.processed_files).toHaveLength(3);
  });
});
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. **Enhanced Condition Evaluator**: Extend existing system for loop contexts
2. **Loop Node Generator**: Basic while loop generation with condition evaluation
3. **Basic Testing**: Unit tests for loop generator functionality
4. **Registry Integration**: Register loop generator in default registry

### Phase 2: Iteration Support (Week 2)

1. **Iteration Node Generator**: Array processing with result collection
2. **Variable Context**: Loop and iteration variable management
3. **Integration Testing**: End-to-end workflow execution tests
4. **Example Workflows**: Create test YAML examples for validation

### Phase 3: Polish & Validation (Week 3)

1. **Error Handling**: Infinite loop protection, graceful failures
2. **Performance Testing**: Large iteration handling and memory usage
3. **Documentation**: Update README, CLI help, and example documentation
4. **CLI Validation**: Ensure new node types validate correctly

## Example Workflows

### Loop Example (`examples/counting-loop.yaml`)

```yaml
workflow:
  name: 'Counting Loop Example'
  description: 'Demonstrate basic loop functionality'

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Initialize'
        variables:
          - variable: 'counter'
            type: 'number'
            default: 0

    - id: 'count_loop'
      type: 'loop'
      data:
        title: 'Count to 5'
        condition:
          variable: 'counter'
          comparison_operator: '<'
          value: 5
        max_iterations: 10

    - id: 'increment'
      type: 'variable-assignment'
      data:
        title: 'Increment Counter'
        variable: 'counter'
        assignment_type: 'expression'
        expression: '{{counter}} + 1'

    - id: 'display'
      type: 'code'
      data:
        title: 'Display Count'
        command: 'echo'
        args: ['Current count: {{counter}}']

    - id: 'end'
      type: 'answer'
      data:
        title: 'Complete'
        answer: 'Counting completed! Final count: {{counter}}'

  edges:
    - source: 'start'
      target: 'count_loop'
    - source: 'count_loop'
      target: 'increment'
    - source: 'increment'
      target: 'display'
    - source: 'display'
      target: 'count_loop' # Loop back
    - source: 'count_loop'
      target: 'end'
      condition: 'exit' # When loop exits
```

### Iteration Example (`examples/file-processing.yaml`)

```yaml
workflow:
  name: 'File Processing Iteration'
  description: 'Process multiple files in batch'

graph:
  nodes:
    - id: 'start'
      type: 'start'
      data:
        title: 'Initialize'
        variables:
          - variable: 'file_list'
            type: 'array'
            default: ['file1.txt', 'file2.txt', 'file3.txt']

    - id: 'process_files'
      type: 'iteration'
      data:
        title: 'Process Each File'
        input_variable: 'file_list'
        output_variable: 'processed_results'

    - id: 'process_single_file'
      type: 'code'
      data:
        title: 'Process File'
        command: 'wc'
        args: ['-l', '{{iteration_item}}']

    - id: 'collect_result'
      type: 'variable-assignment'
      data:
        title: 'Collect Result'
        variable: 'iteration_result'
        assignment_type: 'variable'
        source_variable: 'process_output'

    - id: 'end'
      type: 'answer'
      data:
        title: 'Complete'
        answer: 'Processed {{file_list.length}} files. Results: {{processed_results}}'

  edges:
    - source: 'start'
      target: 'process_files'
    - source: 'process_files'
      target: 'process_single_file'
    - source: 'process_single_file'
      target: 'collect_result'
    - source: 'collect_result'
      target: 'process_files' # Continue iteration
    - source: 'process_files'
      target: 'end'
      condition: 'complete' # When iteration completes
```

## Risk Assessment & Mitigation

### Technical Risks

1. **Infinite Loops**: Mitigated by max_iterations protection and condition validation
2. **Variable Scoping Issues**: Mitigated by function-based isolation and explicit variable passing
3. **Complex Edge Routing**: Mitigated by clear loop entry/exit edge handling
4. **Performance with Large Arrays**: Mitigated by sequential processing and memory management

### Implementation Risks

1. **Breaking Existing Functionality**: Mitigated by comprehensive regression testing
2. **Generated Script Complexity**: Mitigated by maintaining clean, readable output patterns
3. **Condition Evaluation Complexity**: Mitigated by reusing existing if-else condition logic

## Validation & Acceptance Criteria

### Functional Validation

- [ ] Loop workflows execute with proper condition evaluation
- [ ] Iteration workflows process arrays and collect results
- [ ] Loop variables (loop_index, iteration_item) are accessible to child nodes
- [ ] Exit conditions prevent infinite loops
- [ ] Generated scripts remain clean and debuggable

### Performance Validation

- [ ] Loops with 100+ iterations execute without memory issues
- [ ] Iterations with 50+ items process efficiently
- [ ] Generated script size remains reasonable (&lt;200 lines for complex workflows)

### Quality Validation

- [ ] All existing tests continue passing (89/89)
- [ ] New unit tests achieve >95% code coverage
- [ ] Integration tests cover loop and iteration scenarios
- [ ] Error handling prevents system failures

## Success Metrics

### Completion Criteria

1. **Functional**: Loop and Iteration nodes generate working bash scripts
2. **Quality**: Generated scripts maintain flowsh's clean output philosophy
3. **Testing**: Comprehensive test coverage with regression protection
4. **Documentation**: Examples and CLI validation updated for new capabilities

### Post-Implementation

- flowsh supports essential Phase 2A control flow capabilities
- Users can create practical automation workflows with repetition
- Foundation prepared for Phase 2B enhanced features
- Maintained compatibility with existing Phase 1 workflows

This PRP delivers the critical missing functionality that transforms flowsh from a simple linear workflow tool into a practical automation platform capable of real-world repetitive processing tasks.
