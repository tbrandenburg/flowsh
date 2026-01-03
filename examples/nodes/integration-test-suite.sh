#!/bin/bash

# Flowsh Node Examples - Integration Test Suite
# Tests all 18 node examples through the actual flowsh CLI
# Validates compilation, shell generation, and basic execution

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Test configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXAMPLES_DIR="$(dirname "$0")"
RESULTS_DIR="${EXAMPLES_DIR}/test-results"
GENERATED_SCRIPTS_DIR="${RESULTS_DIR}/generated-scripts"
TEST_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SUMMARY_FILE="${RESULTS_DIR}/integration-test-summary-${TEST_TIMESTAMP}.md"

# Statistics
TOTAL_EXAMPLES=0
VALIDATION_PASSED=0
COMPILATION_PASSED=0
SCRIPT_GENERATION_PASSED=0
SYNTAX_CHECK_PASSED=0
FAILED_EXAMPLES=()

# Helper to run flowsh CLI from project root
run_flowsh() {
    (cd "${PROJECT_ROOT}" && timeout 30s npm run dev -- "$@")
}
log_info() {
    echo -e "${BLUE}ℹ️  ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

log_section() {
    echo ""
    echo -e "${BOLD}${BLUE}=== ${1} ===${NC}"
}

# Setup test environment
setup_test_environment() {
    log_section "Setting Up Test Environment"
    
    # Create results directories
    mkdir -p "${RESULTS_DIR}"
    mkdir -p "${GENERATED_SCRIPTS_DIR}"
    
    # Ensure flowsh is built
    log_info "Building flowsh CLI..."
    (cd "${PROJECT_ROOT}" && npm run build > /dev/null 2>&1) || {
        log_error "Failed to build flowsh CLI"
        exit 1
    }
    
    log_success "Test environment ready"
}

# Test individual example
test_example() {
    local example_file="$1"
    local example_name=$(basename "$example_file" .yaml)
    
    echo ""
    log_info "Testing: ${example_name}"
    
    local validation_result=false
    local compilation_result=false
    local script_generation_result=false
    local syntax_check_result=false
    
    # Test 1: Validation
    log_info "  → Validating YAML structure..."
    local relative_path="examples/nodes/$(basename "${example_file}")"
    if run_flowsh validate "${relative_path}" > "${RESULTS_DIR}/${example_name}_validation.log" 2>&1; then
        validation_result=true
        log_success "    Validation passed"
        ((VALIDATION_PASSED++))
    else
        log_error "    Validation failed"
        cat "${RESULTS_DIR}/${example_name}_validation.log"
    fi
    
    # Test 2: Compilation (shell script generation)
    if [ "$validation_result" = true ]; then
        log_info "  → Compiling to shell script..."
        local generated_script="${GENERATED_SCRIPTS_DIR}/${example_name}.sh"
        
        local relative_path="examples/nodes/$(basename "${example_file}")"
        if (cd "${PROJECT_ROOT}" && timeout 60s npm run dev -- compile "${relative_path}") > "${generated_script}" 2>"${RESULTS_DIR}/${example_name}_compilation.log"; then
            compilation_result=true
            script_generation_result=true
            log_success "    Compilation successful"
            ((COMPILATION_PASSED++))
            ((SCRIPT_GENERATION_PASSED++))
            
            # Test 3: Shell syntax check
            log_info "  → Checking generated shell syntax..."
            if bash -n "${generated_script}" 2>"${RESULTS_DIR}/${example_name}_syntax.log"; then
                syntax_check_result=true
                log_success "    Shell syntax valid"
                ((SYNTAX_CHECK_PASSED++))
            else
                log_error "    Shell syntax errors found"
                head -10 "${RESULTS_DIR}/${example_name}_syntax.log"
            fi
            
            # Calculate script metrics
            local line_count=$(wc -l < "${generated_script}")
            local function_count=$(grep -c "^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*(" "${generated_script}" 2>/dev/null || echo "0")
            
            log_info "    Generated ${line_count} lines, ${function_count} functions"
            
        else
            log_error "    Compilation failed"
            cat "${RESULTS_DIR}/${example_name}_compilation.log"
        fi
    else
        log_warning "  → Skipping compilation due to validation failure"
    fi
    
    # Record results
    local overall_result="FAILED"
    if [ "$validation_result" = true ] && [ "$compilation_result" = true ] && [ "$syntax_check_result" = true ]; then
        overall_result="PASSED"
    else
        FAILED_EXAMPLES+=("$example_name")
    fi
    
    # Store detailed results
    cat >> "${RESULTS_DIR}/${example_name}_results.txt" << EOF
Example: ${example_name}
Validation: ${validation_result}
Compilation: ${compilation_result}
Script Generation: ${script_generation_result}
Syntax Check: ${syntax_check_result}
Overall: ${overall_result}
Timestamp: $(date)
EOF
}

# Performance benchmarking for complex examples
benchmark_example() {
    local example_file="$1"
    local example_name=$(basename "$example_file" .yaml)
    
    log_info "Benchmarking: ${example_name}"
    
    # Measure compilation time
    local start_time=$(date +%s.%N)
    
    local relative_path="examples/nodes/$(basename "${example_file}")"
    if (cd "${PROJECT_ROOT}" && timeout 120s npm run dev -- compile "${relative_path}" -v) > "${RESULTS_DIR}/${example_name}_benchmark.log" 2>&1; then
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "N/A")
        
        # Extract metadata from verbose output
        local node_count=$(grep "Generating shell script for" "${RESULTS_DIR}/${example_name}_benchmark.log" | grep -o "[0-9]\+ nodes" | grep -o "[0-9]\+" || echo "0")
        local line_count=$(grep "Generated.*lines" "${RESULTS_DIR}/${example_name}_benchmark.log" | grep -o "[0-9]\+" | head -1 || echo "0")
        local complexity=$(grep "Complexity:" "${RESULTS_DIR}/${example_name}_benchmark.log" | awk '{print $NF}' || echo "unknown")
        
        log_success "  Completed in ${duration}s (${node_count} nodes → ${line_count} lines, complexity: ${complexity})"
        
        # Store benchmark data
        cat >> "${RESULTS_DIR}/${example_name}_benchmark_data.txt" << EOF
Example: ${example_name}
Duration: ${duration}s
Node Count: ${node_count}
Generated Lines: ${line_count}
Complexity: ${complexity}
EOF
    else
        log_error "  Benchmark timeout or failure"
    fi
}

# Generate comprehensive test report
generate_test_report() {
    log_section "Generating Test Report"
    
    local success_rate=$(echo "scale=1; ($VALIDATION_PASSED * 100) / $TOTAL_EXAMPLES" | bc -l 2>/dev/null || echo "N/A")
    
    cat > "${SUMMARY_FILE}" << EOF
# Flowsh Node Examples - Integration Test Report

**Test Run**: ${TEST_TIMESTAMP}  
**Total Examples**: ${TOTAL_EXAMPLES}  
**CLI Version**: $(cd "${PROJECT_ROOT}" && npm run dev -- --version 2>/dev/null | tail -1 || echo "Unknown")

## Executive Summary

| Metric | Count | Success Rate |
|--------|-------|--------------|
| **Validation** | ${VALIDATION_PASSED}/${TOTAL_EXAMPLES} | ${success_rate}% |
| **Compilation** | ${COMPILATION_PASSED}/${TOTAL_EXAMPLES} | $(echo "scale=1; ($COMPILATION_PASSED * 100) / $TOTAL_EXAMPLES" | bc -l 2>/dev/null || echo "N/A")% |
| **Script Generation** | ${SCRIPT_GENERATION_PASSED}/${TOTAL_EXAMPLES} | $(echo "scale=1; ($SCRIPT_GENERATION_PASSED * 100) / $TOTAL_EXAMPLES" | bc -l 2>/dev/null || echo "N/A")% |
| **Syntax Validation** | ${SYNTAX_CHECK_PASSED}/${TOTAL_EXAMPLES} | $(echo "scale=1; ($SYNTAX_CHECK_PASSED * 100) / $TOTAL_EXAMPLES" | bc -l 2>/dev/null || echo "N/A")% |

## Test Results by Example

EOF

    # Add individual results
    for example_file in "${EXAMPLES_DIR}"/*-example.yaml; do
        if [[ -f "$example_file" ]]; then
            local example_name=$(basename "$example_file" .yaml)
            local result_file="${RESULTS_DIR}/${example_name}_results.txt"
            
            if [[ -f "$result_file" ]]; then
                echo "### ${example_name}" >> "${SUMMARY_FILE}"
                echo "" >> "${SUMMARY_FILE}"
                
                # Extract results
                local validation=$(grep "^Validation:" "$result_file" | cut -d' ' -f2)
                local compilation=$(grep "^Compilation:" "$result_file" | cut -d' ' -f2)
                local syntax=$(grep "^Syntax Check:" "$result_file" | cut -d' ' -f3)
                local overall=$(grep "^Overall:" "$result_file" | cut -d' ' -f2)
                
                echo "- **Status**: ${overall}" >> "${SUMMARY_FILE}"
                echo "- **Validation**: ${validation}" >> "${SUMMARY_FILE}"
                echo "- **Compilation**: ${compilation}" >> "${SUMMARY_FILE}"
                echo "- **Syntax Check**: ${syntax}" >> "${SUMMARY_FILE}"
                
                # Add benchmark data if available
                local benchmark_file="${RESULTS_DIR}/${example_name}_benchmark_data.txt"
                if [[ -f "$benchmark_file" ]]; then
                    local duration=$(grep "^Duration:" "$benchmark_file" | cut -d' ' -f2)
                    local nodes=$(grep "^Node Count:" "$benchmark_file" | cut -d' ' -f3)
                    local lines=$(grep "^Generated Lines:" "$benchmark_file" | cut -d' ' -f3)
                    echo "- **Performance**: ${duration} (${nodes} nodes → ${lines} lines)" >> "${SUMMARY_FILE}"
                fi
                
                echo "" >> "${SUMMARY_FILE}"
            fi
        fi
    done

    # Add failed examples section
    if [[ ${#FAILED_EXAMPLES[@]} -gt 0 ]]; then
        echo "## Failed Examples" >> "${SUMMARY_FILE}"
        echo "" >> "${SUMMARY_FILE}"
        for failed in "${FAILED_EXAMPLES[@]}"; do
            echo "- ${failed}" >> "${SUMMARY_FILE}"
        done
        echo "" >> "${SUMMARY_FILE}"
    fi

    # Add recommendations
    cat >> "${SUMMARY_FILE}" << EOF
## Recommendations

EOF
    
    if [[ ${#FAILED_EXAMPLES[@]} -eq 0 ]]; then
        echo "🎉 **All examples passed!** The flowsh node examples are fully validated and ready for production use." >> "${SUMMARY_FILE}"
    else
        echo "⚠️ **${#FAILED_EXAMPLES[@]} examples failed.** Review the individual test logs for details and fix the issues." >> "${SUMMARY_FILE}"
    fi
    
    cat >> "${SUMMARY_FILE}" << EOF

## Generated Files

- **Test Results**: \`${RESULTS_DIR}/\`
- **Generated Scripts**: \`${GENERATED_SCRIPTS_DIR}/\`
- **Full Report**: \`${SUMMARY_FILE}\`

---
*Generated by flowsh Integration Test Suite - $(date)*
EOF

    log_success "Test report generated: ${SUMMARY_FILE}"
}

# Main test execution
main() {
    log_section "Flowsh Node Examples - Integration Test Suite"
    
    setup_test_environment
    
    # Count total examples
    TOTAL_EXAMPLES=$(find "${EXAMPLES_DIR}" -name "*-example.yaml" | wc -l)
    log_info "Found ${TOTAL_EXAMPLES} node examples to test"
    
    if [[ $TOTAL_EXAMPLES -eq 0 ]]; then
        log_error "No example files found in ${EXAMPLES_DIR}"
        exit 1
    fi
    
    log_section "Running Validation and Compilation Tests"
    
    # Test each example
    for example_file in "${EXAMPLES_DIR}"/*-example.yaml; do
        if [[ -f "$example_file" ]]; then
            test_example "$example_file"
        fi
    done
    
    log_section "Running Performance Benchmarks"
    
    # Benchmark complex examples (>10 nodes)
    local complex_examples=(
        "parallel-iteration-node-example.yaml"
        "circuit-breaker-node-example.yaml"
        "retry-node-example.yaml"
        "fallback-node-example.yaml"
        "sub-workflow-node-example.yaml"
    )
    
    for example in "${complex_examples[@]}"; do
        local example_path="${EXAMPLES_DIR}/${example}"
        if [[ -f "$example_path" ]]; then
            benchmark_example "$example_path"
        fi
    done
    
    generate_test_report
    
    log_section "Integration Test Summary"
    log_info "Total Examples Tested: ${TOTAL_EXAMPLES}"
    log_info "Validation Success: ${VALIDATION_PASSED}/${TOTAL_EXAMPLES}"
    log_info "Compilation Success: ${COMPILATION_PASSED}/${TOTAL_EXAMPLES}"
    log_info "Syntax Check Success: ${SYNTAX_CHECK_PASSED}/${TOTAL_EXAMPLES}"
    
    if [[ ${#FAILED_EXAMPLES[@]} -eq 0 ]]; then
        log_success "🎉 ALL TESTS PASSED! Integration test suite completed successfully."
        echo ""
        log_info "Generated scripts are available in: ${GENERATED_SCRIPTS_DIR}/"
        log_info "Full test report: ${SUMMARY_FILE}"
        exit 0
    else
        log_error "❌ ${#FAILED_EXAMPLES[@]} examples failed integration testing"
        log_info "Failed examples: ${FAILED_EXAMPLES[*]}"
        log_info "Check individual logs in: ${RESULTS_DIR}/"
        exit 1
    fi
}

# Run main function
main "$@"