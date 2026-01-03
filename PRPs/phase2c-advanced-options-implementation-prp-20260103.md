# flowsh Phase 2C: Advanced Options Implementation

**Creation Date**: January 3, 2026  
**Implementation Phase**: Phase 2C - Advanced Control Flow Options  
**Priority**: MEDIUM  
**Estimated Effort**: 2-3 weeks  
**Success Criteria**: Production-ready advanced features with parallel processing and enhanced error handling

## Problem Statement

Following Phases 2A (Essential Loops) and 2B (Enhanced Features) completion, flowsh needs advanced capabilities to compete with enterprise workflow platforms: **Parallel Iteration Processing** for performance, **Advanced Sub-Workflow Support** for modularity, and **Enhanced Error Handling** for production reliability.

**Current Gap Post-2B**:

- Iteration processing is sequential only (performance limitation)
- Sub-workflows are basic with limited scoping capabilities
- Error handling lacks retry strategies and fallback mechanisms
- No advanced debugging and monitoring capabilities for complex workflows

**Business Impact**:

- Cannot handle large-scale batch processing efficiently
- Limited modularity for complex enterprise workflows
- Production deployments lack robust error recovery
- Performance bottlenecks prevent adoption for high-throughput scenarios

## Success Criteria

### Primary Goals

1. **Parallel Iteration Processing**: True background parallelism with configurable concurrency
2. **Advanced Sub-Workflow Support**: Full recursive workflow execution with complex scoping
3. **Enhanced Error Handling**: Retry nodes, fallback paths, and comprehensive error recovery
4. **Performance Monitoring**: Built-in metrics and profiling for complex workflows
5. **Production Hardening**: Memory management, resource limits, and graceful degradation

### Quality Metrics

- ✅ Parallel iterations achieve 3-5x performance improvement on multi-core systems
- ✅ Sub-workflows support complex nested scenarios with proper variable isolation
- ✅ Error handling prevents workflow failures and provides actionable recovery paths
- ✅ Performance monitoring tracks resource usage and identifies bottlenecks
- ✅ Memory usage remains bounded even for large parallel workloads
- ✅ Generated scripts maintain readability despite advanced functionality

## Technical Specification

### Architecture Decisions (Advanced Pattern Implementation)

#### Parallel Iteration Strategy: Background Process Management

```bash
# Generated Parallel Iteration Node Pattern
execute_parallel_iteration_${node_id}() {
    log_step "🔁 Parallel Iteration: ${node.data.title}"

    local input_variable="${node.data.input_variable}"
    local output_variable="${node.data.output_variable:-iteration_results}"
    local max_parallel="${node.data.max_parallel:-4}"
    local input_array_raw="$(get_workflow_var "$input_variable")"

    # Parse input array
    local -a input_array=()
    while IFS= read -r item; do
        [[ -n "$item" ]] && input_array+=("$item")
    done <<< "$input_array_raw"

    # Setup parallel processing infrastructure
    local temp_dir=$(mktemp -d)
    local -a active_pids=()
    local -a completed_results=()
    local processing_index=0

    # Progress tracking
    local total_items=${#input_array[@]}
    local completed_items=0

    log_info "Starting parallel processing of $total_items items (max parallel: $max_parallel)"

    # Process items with controlled parallelism
    for item_index in "${!input_array[@]}"; do
        local current_item="${input_array[$item_index]}"

        # Wait if we've reached max parallel limit
        while (( ${#active_pids[@]} >= max_parallel )); do
            # Check for completed processes
            local -a new_pids=()
            for pid in "${active_pids[@]}"; do
                if kill -0 "$pid" 2>/dev/null; then
                    new_pids+=("$pid")  # Still running
                else
                    # Process completed
                    wait "$pid"  # Get exit code
                    local exit_code=$?

                    if [[ $exit_code -eq 0 ]]; then
                        ((completed_items++))
                        log_progress "Completed $completed_items/$total_items items"
                    else
                        log_warning "Parallel iteration item failed with exit code $exit_code"
                    fi
                fi
            done
            active_pids=("${new_pids[@]}")

            # Brief sleep to prevent busy waiting
            [[ ${#active_pids[@]} -ge $max_parallel ]] && sleep 0.1
        done

        # Start new background iteration
        (
            # Set up isolated context for parallel execution
            local iteration_temp_dir="$temp_dir/item_$item_index"
            mkdir -p "$iteration_temp_dir"
            cd "$iteration_temp_dir"

            # Set iteration context variables
            export ITERATION_ITEM="$current_item"
            export ITERATION_INDEX="$item_index"
            export ITERATION_TEMP_DIR="$iteration_temp_dir"

            # Execute iteration body in isolated environment
            execute_parallel_iteration_body() {
                # Override variable functions for parallel isolation
                local -A parallel_vars=()
                parallel_vars["iteration_item"]="$current_item"
                parallel_vars["iteration_index"]="$item_index"

                get_workflow_var() {
                    if [[ -n "${parallel_vars[$1]:-}" ]]; then
                        echo "${parallel_vars[$1]}"
                    else
                        # Access parent variables (read-only)
                        echo "$(get_parent_workflow_var "$1" "$2")"
                    fi
                }

                set_workflow_var() {
                    parallel_vars["$1"]="$2"
                    # Also save to file for result collection
                    echo "$1=$2" >> "$iteration_temp_dir/variables.out"
                }

                # Execute child nodes here (would be generated based on workflow)
                ${parallel_iteration_body_nodes}

                # Output final result
                echo "$(get_workflow_var 'iteration_result' '')" > "$iteration_temp_dir/result.out"
            }

            # Execute with error handling
            if ! execute_parallel_iteration_body; then
                echo "ERROR: Parallel iteration failed" > "$iteration_temp_dir/error.out"
                exit 1
            fi
        ) &

        local bg_pid=$!
        active_pids+=("$bg_pid")
        log_debug "Started parallel iteration for item $item_index (PID: $bg_pid)"
    done

    # Wait for all remaining processes to complete
    log_info "Waiting for remaining parallel iterations to complete..."
    for pid in "${active_pids[@]}"; do
        wait "$pid"
        ((completed_items++))
    done

    # Collect results in original order
    local -a final_results=()
    for item_index in "${!input_array[@]}"; do
        local result_file="$temp_dir/item_$item_index/result.out"
        if [[ -f "$result_file" ]]; then
            final_results+=("$(cat "$result_file")")
        else
            log_warning "No result found for item $item_index"
            final_results+=("")
        fi
    done

    # Store aggregated results
    local aggregated_results
    aggregated_results=$(IFS=$'\n'; echo "${final_results[*]}")
    set_workflow_var "$output_variable" "$aggregated_results"

    # Cleanup
    rm -rf "$temp_dir"

    log_success "Parallel iteration completed: processed $total_items items"
}
```

#### Advanced Sub-Workflow Strategy: Recursive Workflow Execution

```bash
# Generated Advanced Sub-Workflow Node Pattern
execute_advanced_subworkflow_${node_id}() {
    log_step "🏗️ Advanced Sub-Workflow: ${node.data.title}"

    local subworkflow_file="$(substitute_variables "${node.data.workflow_file}")"
    local execution_mode="${node.data.execution_mode:-isolated}"
    local -A input_mappings=()
    local -A output_mappings=()

    # Parse input/output mappings
    while IFS='=' read -r sub_var parent_var; do
        input_mappings["$sub_var"]="$(get_workflow_var "$parent_var" "")"
    done <<< "${node.data.input_mappings}"

    while IFS='=' read -r sub_var parent_var; do
        output_mappings["$sub_var"]="$parent_var"
    done <<< "${node.data.output_mappings}"

    case "$execution_mode" in
        "isolated")
            # Full isolation - sub-workflow cannot access parent variables
            execute_isolated_subworkflow
            ;;
        "inherited")
            # Partial inheritance - sub-workflow inherits parent variables but changes don't propagate
            execute_inherited_subworkflow
            ;;
        "shared")
            # Shared context - sub-workflow can modify parent variables directly
            execute_shared_subworkflow
            ;;
    esac
}

execute_isolated_subworkflow() {
    local subworkflow_temp_dir=$(mktemp -d)

    # Execute sub-workflow in completely isolated environment
    (
        # Create isolated variable space
        declare -A workflow_vars=()

        # Initialize with mapped inputs only
        for sub_var in "${!input_mappings[@]}"; do
            workflow_vars["$sub_var"]="${input_mappings[$sub_var]}"
        done

        # Override variable functions for complete isolation
        get_workflow_var() {
            echo "${workflow_vars[$1]:-$2}"
        }

        set_workflow_var() {
            workflow_vars["$1"]="$2"
        }

        # Execute sub-workflow (recursive flowsh execution)
        log_info "Executing isolated sub-workflow: $subworkflow_file"

        # Parse and execute sub-workflow YAML
        # This requires recursive call to flowsh compiler/executor
        if command -v flowsh >/dev/null 2>&1; then
            # Use flowsh to execute sub-workflow
            local subworkflow_script="$subworkflow_temp_dir/subworkflow.sh"

            if flowsh compile "$subworkflow_file" > "$subworkflow_script"; then
                # Inject input variables into sub-workflow execution
                for sub_var in "${!workflow_vars[@]}"; do
                    export "WORKFLOW_VAR_$sub_var"="${workflow_vars[$sub_var]}"
                done

                # Execute sub-workflow script
                bash "$subworkflow_script"
                local sub_exit_code=$?

                if [[ $sub_exit_code -eq 0 ]]; then
                    # Extract output variables (would need mechanism to export from sub-workflow)
                    # For now, use file-based variable passing
                    if [[ -f "$subworkflow_temp_dir/outputs.env" ]]; then
                        while IFS='=' read -r var_name var_value; do
                            workflow_vars["$var_name"]="$var_value"
                        done < "$subworkflow_temp_dir/outputs.env"
                    fi
                else
                    log_error "Sub-workflow execution failed with exit code: $sub_exit_code"
                    exit $sub_exit_code
                fi
            else
                log_error "Failed to compile sub-workflow: $subworkflow_file"
                exit 1
            fi
        else
            log_error "flowsh command not available for sub-workflow execution"
            exit 1
        fi

        # Export mapped outputs
        for sub_var in "${!output_mappings[@]}"; do
            if [[ -n "${workflow_vars[$sub_var]:-}" ]]; then
                echo "$sub_var=${workflow_vars[$sub_var]}"
            fi
        done
    ) > "$subworkflow_temp_dir/outputs.txt"

    local sub_exit_code=$?

    if [[ $sub_exit_code -eq 0 ]]; then
        # Read outputs back into parent scope
        while IFS='=' read -r sub_var sub_value; do
            local parent_var="${output_mappings[$sub_var]:-}"
            if [[ -n "$parent_var" ]]; then
                set_workflow_var "$parent_var" "$sub_value"
            fi
        done < "$subworkflow_temp_dir/outputs.txt"

        log_success "Isolated sub-workflow completed successfully"
    else
        log_error "Sub-workflow failed with exit code: $sub_exit_code"

        # Handle sub-workflow failure based on error handling strategy
        case "${node.data.error_handling:-fail}" in
            "ignore")
                log_info "Ignoring sub-workflow failure as configured"
                ;;
            "continue")
                log_warning "Continuing despite sub-workflow failure"
                set_workflow_var "subworkflow_failed" "true"
                ;;
            *)
                rm -rf "$subworkflow_temp_dir"
                return $sub_exit_code
                ;;
        esac
    fi

    rm -rf "$subworkflow_temp_dir"
}
```

#### Enhanced Error Handling Strategy: Retry and Fallback Mechanisms

```bash
# Generated Error Handling Node Patterns

# Retry Node Pattern
execute_retry_${node_id}() {
    log_step "🔄 Retry Handler: ${node.data.title}"

    local max_attempts="${node.data.max_attempts:-3}"
    local retry_delay="${node.data.retry_delay:-2}"
    local backoff_multiplier="${node.data.backoff_multiplier:-1.5}"
    local retry_condition="${node.data.retry_condition:-any_failure}"

    local attempt=1
    local current_delay="$retry_delay"

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Retry attempt $attempt/$max_attempts"

        # Execute retry target nodes
        if execute_retry_target_nodes; then
            log_success "Retry succeeded on attempt $attempt"
            return 0
        else
            local exit_code=$?
            log_warning "Retry attempt $attempt failed (exit code: $exit_code)"

            # Check if we should retry based on condition
            case "$retry_condition" in
                "any_failure")
                    should_retry=true
                    ;;
                "timeout_only")
                    [[ $exit_code -eq 124 ]] && should_retry=true || should_retry=false
                    ;;
                "network_only")
                    # Check for network-related exit codes
                    [[ $exit_code -eq 6 || $exit_code -eq 7 ]] && should_retry=true || should_retry=false
                    ;;
                *)
                    should_retry=false
                    ;;
            esac

            if [[ $attempt -lt $max_attempts && "$should_retry" == "true" ]]; then
                log_info "Waiting ${current_delay}s before retry..."
                sleep "$current_delay"

                # Apply backoff multiplier
                current_delay=$(echo "$current_delay * $backoff_multiplier" | bc -l | cut -d'.' -f1)
            fi
        fi

        ((attempt++))
    done

    log_error "All retry attempts failed"
    return 1
}

# Fallback Node Pattern
execute_fallback_${node_id}() {
    log_step "🛡️ Fallback Handler: ${node.data.title}"

    local fallback_strategy="${node.data.strategy:-sequential}"
    local -a fallback_paths=(${node.data.fallback_paths[@]})

    case "$fallback_strategy" in
        "sequential")
            # Try each fallback path in order until one succeeds
            for path_index in "${!fallback_paths[@]}"; do
                local path_id="${fallback_paths[$path_index]}"
                log_info "Trying fallback path: $path_id"

                if execute_fallback_path "$path_id"; then
                    log_success "Fallback path '$path_id' succeeded"
                    set_workflow_var "fallback_used" "$path_id"
                    return 0
                else
                    log_warning "Fallback path '$path_id' failed"
                fi
            done

            log_error "All fallback paths failed"
            return 1
            ;;

        "parallel")
            # Execute all fallback paths in parallel, use first successful
            local -a fallback_pids=()
            local temp_dir=$(mktemp -d)

            for path_index in "${!fallback_paths[@]}"; do
                local path_id="${fallback_paths[$path_index]}"
                (
                    if execute_fallback_path "$path_id"; then
                        echo "SUCCESS:$path_id" > "$temp_dir/result_$path_index"
                    else
                        echo "FAILED:$path_id" > "$temp_dir/result_$path_index"
                    fi
                ) &
                fallback_pids+=($!)
            done

            # Wait for first success or all failures
            local success_found=false
            while [[ ${#fallback_pids[@]} -gt 0 && "$success_found" == "false" ]]; do
                for i in "${!fallback_pids[@]}"; do
                    local pid="${fallback_pids[$i]}"

                    if ! kill -0 "$pid" 2>/dev/null; then
                        # Process completed
                        wait "$pid"

                        local result_file="$temp_dir/result_$i"
                        if [[ -f "$result_file" ]]; then
                            local result=$(cat "$result_file")
                            if [[ "$result" =~ ^SUCCESS: ]]; then
                                local successful_path="${result#SUCCESS:}"
                                log_success "Parallel fallback '$successful_path' succeeded"
                                set_workflow_var "fallback_used" "$successful_path"
                                success_found=true

                                # Kill remaining processes
                                for remaining_pid in "${fallback_pids[@]}"; do
                                    kill "$remaining_pid" 2>/dev/null || true
                                done
                                break
                            fi
                        fi

                        # Remove completed PID
                        unset 'fallback_pids[i]'
                    fi
                done

                # Re-index array to remove gaps
                fallback_pids=("${fallback_pids[@]}")
                sleep 0.1
            done

            rm -rf "$temp_dir"

            if [[ "$success_found" == "false" ]]; then
                log_error "All parallel fallback paths failed"
                return 1
            fi
            ;;
    esac
}
```

### Implementation Components

#### 1. Parallel Iteration Generator (`src/generation/generators/parallel-iteration-node.ts`)

- Background process management with configurable concurrency
- Result collection and ordering preservation
- Resource management and cleanup
- Progress tracking and monitoring

#### 2. Advanced Sub-Workflow Generator (`src/generation/generators/advanced-sub-workflow-node.ts`)

- Recursive flowsh execution for true sub-workflow support
- Multiple execution modes (isolated, inherited, shared)
- Complex input/output mapping with type conversion
- Error propagation and handling strategies

#### 3. Enhanced Error Handling Generators

- **Retry Node Generator** (`retry-node.ts`): Configurable retry logic with backoff
- **Fallback Node Generator** (`fallback-node.ts`): Multiple fallback strategies
- **Circuit Breaker Generator** (`circuit-breaker-node.ts`): Prevent cascade failures

#### 4. Performance Monitoring Integration (`src/generation/performance/advanced-monitoring.ts`)

- Resource usage tracking (CPU, memory, I/O)
- Execution time profiling for each node
- Bottleneck identification and reporting
- Performance metrics aggregation

#### 5. Memory Management Utilities (`src/generation/utils/resource-management.ts`)

- Temporary file cleanup automation
- Process lifecycle management
- Memory usage monitoring and limits
- Resource leak detection

### Testing Strategy

#### Performance Tests

```typescript
describe('Parallel Processing Performance', () => {
  it('should achieve 3x speedup with 4 parallel workers', async () => {
    // Compare sequential vs parallel execution times
  });

  it('should handle 1000+ items without memory issues', async () => {
    // Test memory usage with large datasets
  });

  it('should properly clean up resources after completion', async () => {
    // Test for resource leaks and proper cleanup
  });
});
```

#### Error Handling Tests

```typescript
describe('Advanced Error Handling', () => {
  it('should retry with exponential backoff', async () => {
    // Test retry behavior and timing
  });

  it('should execute fallback paths correctly', async () => {
    // Test fallback strategy execution
  });

  it('should prevent infinite retry loops', async () => {
    // Test retry limits and circuit breaker behavior
  });
});
```

#### Sub-Workflow Tests

```typescript
describe('Advanced Sub-Workflows', () => {
  it('should execute nested workflows with proper isolation', async () => {
    // Test variable scoping and isolation
  });

  it('should handle recursive workflow calls', async () => {
    // Test deep nesting and recursive execution
  });

  it('should properly map complex input/output variables', async () => {
    // Test variable mapping and type conversion
  });
});
```

## Implementation Plan

### Phase 1: Parallel Processing (Week 1)

1. **Parallel Iteration Generator**: Background process management
2. **Resource Management**: Memory and process lifecycle utilities
3. **Testing**: Performance benchmarks and resource usage tests
4. **Integration**: Registry updates and CLI validation

### Phase 2: Advanced Error Handling (Week 2)

1. **Retry and Fallback Generators**: Comprehensive error recovery
2. **Circuit Breaker Implementation**: Cascade failure prevention
3. **Error Strategy Framework**: Configurable error handling policies
4. **Integration Testing**: Error scenario validation

### Phase 3: Production Hardening (Week 3)

1. **Advanced Sub-Workflow Support**: Recursive execution framework
2. **Performance Monitoring**: Built-in metrics and profiling
3. **Production Features**: Logging, monitoring, graceful degradation
4. **Documentation**: Advanced usage examples and best practices

## Success Metrics & Validation

### Performance Validation

- [ ] Parallel iterations achieve 3-5x speedup on multi-core systems
- [ ] Memory usage remains bounded for large parallel workloads (&lt;1GB for 1000+ items)
- [ ] Resource cleanup prevents leaks and accumulation
- [ ] Performance monitoring accurately tracks bottlenecks

### Reliability Validation

- [ ] Error handling prevents workflow failures in 95%+ of error scenarios
- [ ] Retry mechanisms recover from transient failures effectively
- [ ] Fallback paths provide graceful degradation
- [ ] Sub-workflows maintain proper isolation and error propagation

### Production Validation

- [ ] Generated scripts remain readable despite advanced functionality
- [ ] All existing functionality continues working (regression protection)
- [ ] Documentation covers advanced usage patterns
- [ ] CLI validation supports all new node types and configurations

This PRP completes the flowsh Phase 2 roadmap, delivering enterprise-grade workflow automation capabilities with performance, reliability, and production-ready features that compete with established platforms like GitHub Actions, Jenkins, and Ansible.
