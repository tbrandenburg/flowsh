#!/bin/bash

# Test validation script for flowsh node examples
# This script validates all example files through the complete pipeline

set -e

echo "🧪 Flowsh Node Examples Validation Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
VALID_FILES=0
FAILED_FILES=0

# Directory containing examples
EXAMPLES_DIR="examples/nodes"

echo ""
echo "${BLUE}📁 Scanning for example files...${NC}"

# Check if directory exists
if [ ! -d "$EXAMPLES_DIR" ]; then
    echo "${RED}❌ Examples directory not found: $EXAMPLES_DIR${NC}"
    exit 1
fi

# Count total files
TOTAL_FILES=$(find "$EXAMPLES_DIR" -name "*.yaml" | wc -l)
echo "${BLUE}Found $TOTAL_FILES example files${NC}"

echo ""
echo "${BLUE}🔍 Phase 1: YAML Syntax Validation${NC}"
echo "-----------------------------------"

# Phase 1: YAML Syntax Validation
for file in "$EXAMPLES_DIR"/*.yaml; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo -n "Testing $filename... "
        
        # Use Node.js to validate YAML syntax
        if node -e "
            const fs = require('fs');
            const yaml = require('js-yaml');
            try {
                const content = fs.readFileSync('$file', 'utf8');
                const parsed = yaml.load(content);
                if (!parsed.graph || !parsed.graph.nodes) {
                    throw new Error('Missing required graph structure');
                }
                console.log('OK');
                process.exit(0);
            } catch (error) {
                console.error(error.message);
                process.exit(1);
            }
        " 2>/dev/null; then
            echo "${GREEN}✅ PASS${NC}"
        else
            echo "${RED}❌ FAIL${NC}"
            FAILED_FILES=$((FAILED_FILES + 1))
        fi
    fi
done

echo ""
echo "${BLUE}🔧 Phase 2: TypeScript Compilation${NC}"
echo "----------------------------------"

# Phase 2: Build the project to ensure TypeScript compilation
echo -n "Building flowsh project... "
if npm run build >/dev/null 2>&1; then
    echo "${GREEN}✅ PASS${NC}"
else
    echo "${RED}❌ FAIL - TypeScript compilation errors${NC}"
    FAILED_FILES=$((FAILED_FILES + 1))
fi

echo ""
echo "${BLUE}⚡ Phase 3: Generator Testing${NC}"
echo "-----------------------------"

# Phase 3: Test that generators can handle the example files
echo -n "Testing generator compatibility... "
if npm test src/generation/ -- --run >/dev/null 2>&1; then
    echo "${GREEN}✅ PASS${NC}"
else
    echo "${RED}❌ FAIL - Generator tests failed${NC}"
    FAILED_FILES=$((FAILED_FILES + 1))
fi

echo ""
echo "${BLUE}📊 Phase 4: Structure Analysis${NC}"
echo "-------------------------------"

# Phase 4: Analyze example structure and completeness
node -e "
const fs = require('fs');
const yaml = require('js-yaml');

const requiredNodeTypes = [
    'start', 'end', 'answer', 'code', 'agent', 'llm',
    'if-else', 'loop', 'iteration', 'parallel-iteration',
    'variable-assignment', 'variable-aggregation', 'template-transform',
    'http-request', 'sub-workflow', 'retry', 'fallback', 'circuit-breaker'
];

const files = fs.readdirSync('$EXAMPLES_DIR').filter(f => f.endsWith('.yaml'));
const coveredTypes = new Set();
let totalNodes = 0;
let totalEdges = 0;

console.log('Example Analysis:');
files.forEach(file => {
    try {
        const content = fs.readFileSync(\`$EXAMPLES_DIR/\${file}\`, 'utf8');
        const parsed = yaml.load(content);
        const nodes = parsed.graph?.nodes || [];
        const edges = parsed.graph?.edges || [];
        
        // Find the primary node type being demonstrated
        const primaryType = nodes.find(n => n.id !== 'start' && n.id !== 'end')?.type ||
                           nodes.find(n => n.type !== 'start')?.type;
        
        if (primaryType) {
            coveredTypes.add(primaryType);
        }
        
        totalNodes += nodes.length;
        totalEdges += edges.length;
        
        console.log(\`  \${file}: \${nodes.length} nodes, \${edges.length} edges, primary type: \${primaryType || 'unknown'}\`);
    } catch (error) {
        console.log(\`  \${file}: ERROR - \${error.message}\`);
    }
});

console.log(\`\nCoverage Summary:\`);
console.log(\`  Total examples: \${files.length}\`);
console.log(\`  Total nodes: \${totalNodes}\`);
console.log(\`  Total edges: \${totalEdges}\`);
console.log(\`  Node types covered: \${coveredTypes.size}/\${requiredNodeTypes.length}\`);

const missing = requiredNodeTypes.filter(type => !coveredTypes.has(type));
if (missing.length > 0) {
    console.log(\`  Missing examples: \${missing.join(', ')}\`);
} else {
    console.log(\`  ✅ All node types covered!\`);
}
"

echo ""
echo "${BLUE}📈 Final Results${NC}"
echo "=================="

VALID_FILES=$((TOTAL_FILES - FAILED_FILES))

echo "Total files tested: $TOTAL_FILES"
echo "${GREEN}Passed: $VALID_FILES${NC}"
if [ $FAILED_FILES -gt 0 ]; then
    echo "${RED}Failed: $FAILED_FILES${NC}"
else
    echo "${GREEN}Failed: $FAILED_FILES${NC}"
fi

echo ""
if [ $FAILED_FILES -eq 0 ]; then
    echo "${GREEN}🎉 All tests passed! Examples are ready for production use.${NC}"
    exit 0
else
    echo "${RED}❌ Some tests failed. Please review the errors above.${NC}"
    exit 1
fi