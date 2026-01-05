# PRP: Modification - LLM Node Two-Stage Fallback System

## TYPE: MODIFICATION

## SUMMARY:

Enhance the existing LLM node generator to implement a two-stage fallback system: first try LLMv7 (api.llm7.io) when OpenAI API key is missing, then fallback to demo responses if LLMv7 fails.

## CURRENT BEHAVIOR:

The LLM node generator in `src/generation/generators/llm-node.ts` currently has a simple binary fallback:

- If `OPENAI_API_KEY` is present → Use OpenAI API
- If `OPENAI_API_KEY` is missing → Use mock/demo responses

## PROPOSED BEHAVIOR:

Implement a three-tier fallback system:

1. **Primary**: OpenAI API (when `OPENAI_API_KEY` is available)
2. **Secondary**: LLMv7 API (when OpenAI key missing but network available)
3. **Tertiary**: Demo responses (when both APIs fail)

## TECHNICAL REQUIREMENTS:

### 1. LLMv7 Integration

- **Endpoint**: `https://api.llm7.io/v1/chat/completions`
- **Authentication**: No API key required (use "unused" or omit)
- **Request Format**: OpenAI-compatible JSON
- **Model**: Use "default" for LLMv7 model selection
- **Response**: Standard OpenAI chat completion format

### 2. Fallback Logic Flow

```bash
# Generated shell script should follow this logic:
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
    # Try OpenAI API first
    llm_response=$(curl -s -X POST "https://api.openai.com/v1/chat/completions" ...)
    if [[ $? -eq 0 && -n "$llm_response" ]]; then
        # OpenAI success
    else
        log_warning "OpenAI API failed, trying LLMv7..."
        # Fall back to LLMv7
    fi
else
    log_info "OPENAI_API_KEY not set, using LLMv7..."
    # Try LLMv7 first when no OpenAI key
fi

# LLMv7 attempt
llm_response=$(curl -s -X POST "https://api.llm7.io/v1/chat/completions" ...)
if [[ $? -eq 0 && -n "$llm_response" ]]; then
    # LLMv7 success
else
    log_warning "LLMv7 API also failed, using mock response"
    # Final fallback to demo response
fi
```

### 3. Error Handling

- **Network timeouts**: Set reasonable timeout for API calls (30s)
- **JSON parsing**: Validate response structure before processing
- **Rate limits**: Handle HTTP 429 responses gracefully
- **Connection failures**: Detect and handle network connectivity issues

### 4. Response Processing

- Both OpenAI and LLMv7 return compatible JSON structures
- Extract `choices[0].message.content` from both APIs
- Maintain consistent output format regardless of API used
- Log which API was successfully used for debugging

## IMPLEMENTATION PLAN:

### Phase 1: Enhance LLM Node Generator

**File**: `src/generation/generators/llm-node.ts`

1. **Add LLMv7 function**:

   ```typescript
   function generateLlmv7Call(modelName: string, prompt: string): string {
     return `
   llm_response=$(curl -s -X POST "https://api.llm7.io/v1/chat/completions" \\
       -H "Content-Type: application/json" \\
       -d '{"model": "default", "messages": [{"role": "user", "content": "${prompt}"}]}' \\
       --connect-timeout 30 --max-time 60)
       `;
   }
   ```

2. **Modify main generation logic**:
   - Replace current binary if/else with three-stage fallback
   - Add proper error checking for each API call
   - Include appropriate logging messages

3. **Add response validation**:
   ```bash
   # Validate JSON response and extract content
   if echo "$llm_response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
       echo "$llm_response" | jq -r '.choices[0].message.content'
   else
       # Try next fallback
   fi
   ```

### Phase 2: Update Tests

**Files**: `tests/**/*.test.ts`

1. **Unit Tests**:
   - Test LLMv7 call generation
   - Test three-stage fallback logic
   - Test error handling scenarios

2. **Integration Tests**:
   - Mock API responses for both OpenAI and LLMv7
   - Test actual network calls (with mocking)
   - Validate generated shell script execution

### Phase 3: Update Examples

**Files**: `examples/nodes/llm-*.yaml`

1. **Add documentation** about the new fallback behavior
2. **Update example outputs** to show the new logging messages
3. **Test all LLM examples** to ensure they still compile correctly

## VALIDATION CRITERIA:

### Functional Requirements:

- [ ] OpenAI API still works when key is provided
- [ ] LLMv7 API is called when OpenAI key is missing
- [ ] Demo responses are used when both APIs fail
- [ ] Generated shell scripts are executable and safe
- [ ] All existing LLM node examples still compile
- [ ] Error messages are clear and informative

### Quality Requirements:

- [ ] Code follows existing TypeScript patterns in the codebase
- [ ] Generated shell scripts follow `set -euo pipefail` safety practices
- [ ] No breaking changes to existing YAML DSL syntax
- [ ] Proper error handling prevents script failures
- [ ] Logging uses existing `log_warning` and `log_info` functions

### Performance Requirements:

- [ ] API calls have reasonable timeouts (30s connect, 60s total)
- [ ] Failed API calls don't cause excessive delays
- [ ] Fallback logic executes quickly
- [ ] Generated scripts remain under 100 lines when possible

## TESTING SCENARIOS:

### 1. Normal Operation

```yaml
# Test with OpenAI key present
export OPENAI_API_KEY="sk-test..."
flowsh compile examples/nodes/llm-basic.yaml | bash
```

### 2. LLMv7 Fallback

```yaml
# Test without OpenAI key (should use LLMv7)
unset OPENAI_API_KEY
flowsh compile examples/nodes/llm-basic.yaml | bash
```

### 3. Complete Fallback

```yaml
# Test with network issues (should use demo)
# Mock network failure or invalid responses
```

### 4. Integration Test

```bash
# Verify all 19+ node examples still work
make examples-all
make validate
```

## SECURITY CONSIDERATIONS:

### Input Sanitization:

- All template variables must be properly escaped for JSON
- Prevent command injection in curl parameters
- Validate model names and prompts before API calls

### API Security:

- LLMv7 doesn't require authentication, but validate responses
- Don't log sensitive prompt content in error messages
- Handle API rate limiting gracefully

### Generated Script Safety:

- Maintain `set -euo pipefail` in generated scripts
- Proper error handling prevents script continuation on failures
- No secret exposure in generated shell code

## SUCCESS METRICS:

### Immediate Success:

- All existing tests pass
- All example workflows compile successfully
- LLMv7 API calls work without authentication
- Graceful degradation to demo responses

### Long-term Benefits:

- Reduced dependency on OpenAI API keys for development
- Better developer experience for testing workflows
- More robust LLM node behavior in various environments
- Maintained Unix philosophy of "fail gracefully"

## ROLLBACK PLAN:

If issues arise:

1. **Revert**: `git revert` the changes to `llm-node.ts`
2. **Hotfix**: Temporarily disable LLMv7 fallback with feature flag
3. **Validation**: Re-run `make check` to ensure system stability

The modification preserves the existing API interface and only enhances the generated shell script logic, making rollback straightforward.

## RELATED DOCUMENTATION:

### LLMv7 API Reference:

- **Quickstart**: https://docs.llm7.io/quickstart
- **Endpoint**: `https://api.llm7.io/v1/chat/completions`
- **Authentication**: No key required for basic usage
- **Rate Limits**: Reasonable limits for development use

### flowsh Architecture:

- **Registry System**: `src/generation/registry/`
- **Node Generators**: `src/generation/generators/`
- **Security Layer**: `src/security/`
- **Shell Utilities**: `src/generation/shell-scripting/`

### Testing Resources:

- **Manual Tests**: `tests/manual/`
- **Example Workflows**: `examples/nodes/llm-*.yaml`
- **Integration Tests**: `tests/integration/`
