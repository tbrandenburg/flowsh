#!/bin/bash
#
# Template Compilation Testing Script
# 
# This script provides basic compilation testing for flowsh templates
# Used by the make test-templates target and can be run standalone
#
# Usage: 
#   ./scripts/test-templates.sh [--verbose] [--pattern <pattern>]
#   make test-templates

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATES_DIR="${PROJECT_DIR}/templates"
CLI_PATH="${PROJECT_DIR}/dist/cli/index.js"

# Default settings
VERBOSE=false
PATTERN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --pattern|-p)
            PATTERN="$2"
            shift 2
            ;;
        --help|-h)
            echo "Template Compilation Testing Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v       Show detailed output for each template"
            echo "  --pattern, -p       Only test templates matching pattern (e.g., 'ai-*')"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                        # Test all templates"
            echo "  $0 --verbose             # Test with detailed output"
            echo "  $0 --pattern 'ai-*'      # Test only AI templates"
            echo "  $0 --pattern '*simple*'  # Test only simple templates"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success")
            echo -e "  ${GREEN}✅ ${message}${NC}"
            ;;
        "error")
            echo -e "  ${RED}❌ ${message}${NC}"
            ;;
        "info")
            echo -e "${BLUE}${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
    esac
}

# Check if flowsh CLI is built
if [[ ! -f "$CLI_PATH" ]]; then
    print_status "error" "flowsh CLI not found at $CLI_PATH"
    echo "Please run 'npm run build' first"
    exit 1
fi

# Make CLI executable if needed
chmod +x "$CLI_PATH"

print_status "info" "Testing template compilation..."
echo ""

# Find templates to test
if [[ -n "$PATTERN" ]]; then
    TEMPLATE_FILES=($(find "$TEMPLATES_DIR" -name "*.yaml" -path "*/${PATTERN}" 2>/dev/null || true))
    if [[ ${#TEMPLATE_FILES[@]} -eq 0 ]]; then
        # Try glob pattern matching
        TEMPLATE_FILES=($(find "$TEMPLATES_DIR" -name "$PATTERN" 2>/dev/null || true))
    fi
else
    TEMPLATE_FILES=($(find "$TEMPLATES_DIR" -name "*.yaml" | sort))
fi

if [[ ${#TEMPLATE_FILES[@]} -eq 0 ]]; then
    if [[ -n "$PATTERN" ]]; then
        print_status "warning" "No templates found matching pattern: $PATTERN"
    else
        print_status "warning" "No template files found in $TEMPLATES_DIR"
    fi
    exit 1
fi

# Test each template
success_count=0
total_count=0

for template_path in "${TEMPLATE_FILES[@]}"; do
    if [[ ! -f "$template_path" ]]; then
        continue
    fi
    
    total_count=$((total_count + 1))
    template_name=$(basename "$template_path")
    
    echo "Testing compilation: $template_name"
    
    # Run compilation test with --dry-run to avoid file creation
    if "$CLI_PATH" compile "$template_path" --dry-run >/dev/null 2>&1; then
        print_status "success" "Compiles successfully"
        success_count=$((success_count + 1))
        
        if [[ "$VERBOSE" == "true" ]]; then
            # Show basic compilation info
            compilation_info=$("$CLI_PATH" compile "$template_path" --dry-run 2>&1 | grep -E "(Nodes:|Edges:|lines|complexity)" || true)
            if [[ -n "$compilation_info" ]]; then
                echo "$compilation_info" | sed 's/^/    /'
            fi
        fi
    else
        print_status "error" "Compilation failed"
        
        # Show error details
        error_output=$("$CLI_PATH" compile "$template_path" --dry-run 2>&1 | head -3)
        echo "$error_output" | sed 's/^/    /'
    fi
    echo ""
done

# Summary
echo ""
print_status "info" "📊 Results: $success_count/$total_count templates compile successfully"

if [[ $success_count -eq $total_count ]]; then
    print_status "success" "🎉 All templates compile successfully!"
    exit 0
else
    failed_count=$((total_count - success_count))
    print_status "warning" "⚠️  $failed_count template(s) failed compilation"
    exit 1
fi