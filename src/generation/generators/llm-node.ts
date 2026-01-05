/**
 * LLM Node Generator
 *
 * Generates shell script code for LLM integration nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class LLMNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'llm';

  /**
   * Generate LLMv7 API call
   */
  private generateLlmv7Call(prompt: string): string {
    return `curl -s -X POST "https://api.llm7.io/v1/chat/completions" \\
      -H "Content-Type: application/json" \\
      -d '{"model": "default", "messages": [{"role": "user", "content": "${prompt}"}]}' \\
      --connect-timeout 30 --max-time 60`;
  }

  /**
   * Generate OpenAI API call
   */
  private generateOpenAICall(modelName: string, prompt: string): string {
    return `curl -s -X POST "https://api.openai.com/v1/chat/completions" \\
      -H "Authorization: Bearer $OPENAI_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"model": "${modelName}", "messages": [{"role": "user", "content": "${prompt}"}]}' \\
      --connect-timeout 30 --max-time 60`;
  }

  /**
   * Generate JSON response validation function
   */
  private generateResponseValidation(): string {
    return `# Function to validate and extract content from API response
extract_llm_content() {
    local response="$1"
    if [[ -n "$response" ]] && echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
        echo "$response" | jq -r '.choices[0].message.content'
        return 0
    else
        return 1
    fi
}`;
  }

  generate(node: WorkflowNode, context: GenerationContext): string {
    const modelData = this.getNodeData(node, 'model', 'gpt-4');
    const prompt = this.getNodeData(node, 'prompt', 'Hello');

    // Handle model data - could be string or object
    let modelName: string;
    if (typeof modelData === 'string') {
      modelName = modelData;
    } else if (typeof modelData === 'object' && modelData !== null) {
      // Extract model name from object structure
      const modelObj = modelData as Record<string, any>;
      modelName = modelObj['name'] || modelObj['model'] || 'gpt-4';
    } else {
      modelName = 'gpt-4';
    }

    if (context.options.includeMocks) {
      return `echo "Mock LLM Response for: ${String(prompt)}"`;
    }

    // Generate curl-based LLM call - ensure prompt is a string and handle undefined
    const promptStr = String(prompt || 'Hello');
    const processedPrompt = this.processTemplateVariables(promptStr, node.id);

    return `${this.generateResponseValidation()}

# Three-stage LLM fallback: OpenAI -> LLMv7 -> Demo
llm_response=""
llm_content=""

# Stage 1: Try OpenAI if API key is available
if [[ -n "\${OPENAI_API_KEY:-}" ]]; then
    log_info "Using OpenAI API..."
    llm_response=$(${this.generateOpenAICall(modelName, processedPrompt)})
    if extract_llm_content "$llm_response" >/dev/null 2>&1; then
        llm_content=$(extract_llm_content "$llm_response")
        log_info "OpenAI API successful"
    else
        log_warning "OpenAI API failed, trying LLMv7..."
    fi
fi

# Stage 2: Try LLMv7 if OpenAI failed or no key available
if [[ -z "$llm_content" ]]; then
    if [[ -z "\${OPENAI_API_KEY:-}" ]]; then
        log_info "OPENAI_API_KEY not set, using LLMv7..."
    fi
    
    llm_response=$(${this.generateLlmv7Call(processedPrompt)})
    if extract_llm_content "$llm_response" >/dev/null 2>&1; then
        llm_content=$(extract_llm_content "$llm_response")
        log_info "LLMv7 API successful"
    else
        log_warning "LLMv7 API also failed, using mock response"
    fi
fi

# Stage 3: Final fallback to demo response
if [[ -z "$llm_content" ]]; then
    llm_content="Mock LLM Response: This is a simulated response because all API calls failed. Original prompt was: ${processedPrompt}"
    log_warning "Using mock response as final fallback"
fi

# Output the final content
echo "$llm_content"`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // LLM-specific validation
    const model = this.getNodeData(node, 'model', '');
    if (!model || String(model).trim() === '') {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_LLM_MODEL',
        message: 'LLM node should specify a model (defaulting to gpt-4)',
        nodeId: node.id,
      });
    }

    const prompt = this.getNodeData(node, 'prompt', '');
    if (!prompt || String(prompt).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_LLM_PROMPT',
        message: 'LLM node must have a prompt',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const prompt = this.getNodeData(node, 'prompt', '');
    return this.extractTemplateVariables(String(prompt));
  }
}
