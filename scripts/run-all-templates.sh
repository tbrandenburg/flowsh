#!/bin/bash
set -euo pipefail

# Template execution script for flowsh
# Extracted from Makefile to avoid shell complexity issues

success=0
total=0

echo "🔍 Processing production templates..."

for template in templates/basic/*-template.yaml templates/enhanced/*-simple.yaml templates/enhanced/*-template.yaml templates/advanced/*/*.yaml; do
    if [ -f "$template" ]; then
        total=$((total + 1))
        echo "Processing: $template"
        basename=$(basename "$template" .yaml)
        script_file="dev/generated-outputs/templates/$basename.sh"
        result_file="dev/execution-results/templates/$basename.result"
        
        if node dist/cli/index.js compile "$template" > "$script_file" 2>/dev/null; then
            echo "  ✅ Generated: $script_file"
            if bash -n "$script_file" 2>/dev/null; then
                echo "  ✅ Shell syntax valid"
            else
                echo "  ❌ Invalid shell syntax in $script_file"
                bash -n "$script_file" 2>&1 | head -3 | sed 's/^/    /'
                continue
            fi
            
            chmod +x "$script_file"
            echo "  🚀 Executing: $basename (production template - may require env vars)"
            
            # Note: Templates may require API keys and environment variables for execution
            if timeout 120 "$script_file" > "$result_file" 2>&1; then
                echo "  ✅ Executed successfully"
                success=$((success + 1))
            else
                # Check if this is expected behavior due to missing API keys, env vars, or template variables
                # NOTE: We no longer accept "invalid variable name" or shell script errors as "expected behavior"
                if grep -q "✅.*succeeded\|✅.*completed\|Workflow completed successfully" "$result_file"; then
                    echo "  ✅ Executed successfully"
                    success=$((success + 1))
                # STRICT ERROR CLASSIFICATION - Zero tolerance for critical failures
                elif grep -q "unbound variable\|syntax error\|command not found.*get_var\|Failed to resolve template content\|division by zero" "$result_file"; then
                    echo "  ❌ CRITICAL FAILURE - Shell script error detected"
                    echo "    Critical errors:"
                    grep "unbound variable\|syntax error\|command not found.*get_var\|Failed to resolve template content\|division by zero" "$result_file" | head -3 | sed 's/^/      /'
                elif grep -q "Missing.*API.*key\|OPENAI_API_KEY.*required\|Telegram chat_id is required\|requires.*API.*key" "$result_file" && \
                     ! grep -q "unbound variable\|syntax error\|Failed to resolve template content\|division by zero" "$result_file"; then
                    echo "  ⚠️  ACCEPTABLE - Missing environment variables (template functional)"
                    success=$((success + 1))
                elif grep -q "Mock circuit breaker.*operation failed\|Circuit breaker operation failed\|Mock circuit breaker: operation failed" "$result_file" && \
                     ! grep -q "unbound variable\|syntax error\|command not found.*get_var\|Failed to resolve template content\|division by zero" "$result_file"; then
                    echo "  ✅ Expected behavior - circuit breaker demonstrating failure handling"
                    success=$((success + 1))
                else
                    echo "  ❌ Execution failed - see $result_file"
                    tail -3 "$result_file" | sed 's/^/    /'
                fi
            fi
        else
            echo "  ❌ Failed to compile $template"
        fi
    fi
done

echo ""
echo "📊 Results: $success/$total templates executed successfully"
if [ $success -eq $total ]; then
    echo "🎉 All templates passed!"
else
    echo "⚠️  Some templates failed - check dev/execution-results/templates/ for details"
    exit 1
fi