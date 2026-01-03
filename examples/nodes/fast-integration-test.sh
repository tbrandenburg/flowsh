#!/bin/bash

# Fast Integration Test for Flowsh Node Examples
# Quick validation of all 18 examples through CLI

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXAMPLES_DIR="$(dirname "$0")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Results tracking
declare -a PASSED_EXAMPLES=()
declare -a FAILED_EXAMPLES=()
declare -a WARNING_EXAMPLES=()

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  ${1}${NC}"; }
log_success() { echo -e "${GREEN}✅ ${1}${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  ${1}${NC}"; }
log_error() { echo -e "${RED}❌ ${1}${NC}"; }

# Test single example
test_example() {
    local example_file="$1"
    local example_name=$(basename "$example_file" .yaml)
    local relative_path="examples/nodes/${example_name}.yaml"
    
    printf "%-35s " "${example_name}:"
    
    # Test validation
    if (cd "${PROJECT_ROOT}" && timeout 30s npm run dev -- validate "${relative_path}" > /dev/null 2>/tmp/flowsh_test_${example_name}.log); then
        # Check for warnings
        if grep -q "Warnings:" /tmp/flowsh_test_${example_name}.log 2>/dev/null; then
            echo -e "${YELLOW}WARN${NC} (has warnings)"
            WARNING_EXAMPLES+=("$example_name")
        else
            echo -e "${GREEN}PASS${NC}"
            PASSED_EXAMPLES+=("$example_name")
        fi
        
        # Test compilation
        if (cd "${PROJECT_ROOT}" && timeout 60s npm run dev -- compile "${relative_path}" > /tmp/flowsh_script_${example_name}.sh 2>/dev/null); then
            # Test syntax
            if bash -n /tmp/flowsh_script_${example_name}.sh 2>/dev/null; then
                local line_count=$(wc -l < /tmp/flowsh_script_${example_name}.sh)
                printf " → Generated %d lines\n" "$line_count"
            else
                echo -e " → ${RED}Syntax Error${NC}"
                FAILED_EXAMPLES+=("$example_name")
            fi
        else
            echo -e " → ${RED}Compilation Failed${NC}"
            FAILED_EXAMPLES+=("$example_name")
        fi
    else
        echo -e "${RED}FAIL${NC} (validation failed)"
        FAILED_EXAMPLES+=("$example_name")
    fi
    
    # Clean up temp files
    rm -f /tmp/flowsh_test_${example_name}.log /tmp/flowsh_script_${example_name}.sh
}

main() {
    echo "🔧 Flowsh Node Examples - Fast Integration Test"
    echo "================================================"
    
    # Build project
    log_info "Building flowsh CLI..."
    (cd "${PROJECT_ROOT}" && npm run build > /dev/null 2>&1) || {
        log_error "Failed to build flowsh CLI"
        exit 1
    }
    
    # Count examples
    local total_examples=$(find "${EXAMPLES_DIR}" -name "*-example.yaml" | wc -l)
    log_info "Testing ${total_examples} node examples..."
    echo
    
    # Test each example
    for example_file in "${EXAMPLES_DIR}"/*-example.yaml; do
        if [[ -f "$example_file" ]]; then
            test_example "$example_file"
        fi
    done
    
    echo
    echo "📊 Test Results Summary"
    echo "======================"
    
    local passed_count=${#PASSED_EXAMPLES[@]}
    local warning_count=${#WARNING_EXAMPLES[@]}
    local failed_count=${#FAILED_EXAMPLES[@]}
    
    log_success "Passed: ${passed_count}/${total_examples}"
    if [[ $warning_count -gt 0 ]]; then
        log_warning "With Warnings: ${warning_count}/${total_examples}"
    fi
    if [[ $failed_count -gt 0 ]]; then
        log_error "Failed: ${failed_count}/${total_examples}"
    fi
    
    # Show failed examples
    if [[ ${#FAILED_EXAMPLES[@]} -gt 0 ]]; then
        echo
        log_error "Failed Examples:"
        for failed in "${FAILED_EXAMPLES[@]}"; do
            echo "  - $failed"
        done
    fi
    
    # Show warning examples  
    if [[ ${#WARNING_EXAMPLES[@]} -gt 0 ]]; then
        echo
        log_warning "Examples with Warnings (template literal injections):"
        for warned in "${WARNING_EXAMPLES[@]}"; do
            echo "  - $warned"
        done
    fi
    
    echo
    if [[ $failed_count -eq 0 ]]; then
        log_success "🎉 All examples are working! Integration test passed."
        if [[ $warning_count -gt 0 ]]; then
            log_info "Note: ${warning_count} examples have security warnings (template literal injections)"
            log_info "These are expected for examples that demonstrate variable substitution"
        fi
        exit 0
    else
        log_error "❌ ${failed_count} examples failed. Check individual examples for issues."
        exit 1
    fi
}

main "$@"