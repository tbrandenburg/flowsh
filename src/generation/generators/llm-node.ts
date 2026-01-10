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
   * Process prompt template into messages array for API call
   */
  private processPromptTemplate(node: WorkflowNode): Array<{ role: string; content: string }> {
    // Check for prompt_template first (new format)
    const promptTemplate = this.getNodeData(node, 'prompt_template', null);

    if (promptTemplate) {
      // Handle array of PromptMessage objects
      if (Array.isArray(promptTemplate)) {
        return (promptTemplate as any[]).map((msg: any) => ({
          role: msg.role || 'user',
          content: this.processTemplateVariables(msg.text || '', node.id),
        }));
      }

      // Handle complex template object with content field
      if (typeof promptTemplate === 'object' && promptTemplate !== null) {
        const templateObj = promptTemplate as Record<string, any>;
        if (templateObj['content']) {
          const content = this.processTemplateVariables(templateObj['content'], node.id);
          return [{ role: 'user', content }];
        }

        // Handle simple object with direct text
        if (templateObj['text']) {
          const content = this.processTemplateVariables(templateObj['text'], node.id);
          return [{ role: 'user', content }];
        }
      }
    }

    // Fall back to simple prompt field (legacy format)
    const simplePrompt = this.getNodeData(node, 'prompt', 'Hello');
    const content = this.processTemplateVariables(String(simplePrompt), node.id);
    return [{ role: 'user', content }];
  }

  /**
   * Generate LLMv7 API call with messages array
   */
  private generateLlmv7Call(messages: Array<{ role: string; content: string }>): string {
    const messagesJson = JSON.stringify(messages).replace(/'/g, "\\'");
    return `curl -s -X POST "https://api.llm7.io/v1/chat/completions" \\
      -H "Content-Type: application/json" \\
      -d '{"model": "default", "messages": ${messagesJson}}' \\
      --connect-timeout 30 --max-time 60`;
  }

  /**
   * Generate OpenAI API call with messages array
   */
  private generateOpenAICall(
    modelName: string,
    messages: Array<{ role: string; content: string }>
  ): string {
    // Use double quotes for curl data and escape only what's needed for JSON
    const messagesJson = JSON.stringify(messages).replace(/"/g, '\\"').replace(/\$/g, '\\$');
    return `curl -s -X POST "https://api.openai.com/v1/chat/completions" \\
      -H "Authorization: Bearer $OPENAI_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d "{\\"model\\": \\"${modelName}\\", \\"messages\\": ${messagesJson}}" \\
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

    // Process prompt template - handle different formats
    const promptMessages = this.processPromptTemplate(node);

    if (context.options.includeMocks) {
      const mockContent =
        promptMessages.length > 0
          ? `Mock LLM Response for: ${promptMessages[promptMessages.length - 1]?.content || 'No content'}`
          : 'Mock LLM Response';
      return `echo "${mockContent}"`;
    }

    return `${this.generateResponseValidation()}

# Three-stage LLM fallback: OpenAI -> LLMv7 -> Demo
llm_response=""
llm_content=""

# Stage 1: Try OpenAI if API key is available
if [[ -n "\${OPENAI_API_KEY:-}" ]]; then
    log_info "Using OpenAI API..."
    llm_response=$(${this.generateOpenAICall(modelName, promptMessages)})
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
    
    llm_response=$(${this.generateLlmv7Call(promptMessages)})
    if extract_llm_content "$llm_response" >/dev/null 2>&1; then
        llm_content=$(extract_llm_content "$llm_response")
        log_info "LLMv7 API successful"
    else
        log_warning "LLMv7 API also failed, using mock response"
    fi
fi

# Stage 3: Final fallback to demo response
if [[ -z "$llm_content" ]]; then
    llm_content="Mock LLM Response: This is a simulated response because all API calls failed. Original prompt was: ${promptMessages[promptMessages.length - 1]?.content || 'No prompt'}"
    log_warning "Using mock response as final fallback"
fi

# Store the content in workflow variable for other nodes to reference
set_workflow_var "LLM_CONTENT" "$llm_content"
set_workflow_var "LLM_SUCCESS" "true"

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

    // Check for both prompt_template and legacy prompt
    const promptTemplate = this.getNodeData(node, 'prompt_template', '');
    const prompt = this.getNodeData(node, 'prompt', '');

    if (
      (!promptTemplate || String(promptTemplate).trim() === '') &&
      (!prompt || String(prompt).trim() === '')
    ) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_LLM_PROMPT',
        message: 'LLM node must have either a prompt_template or prompt',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    let templateVars: string[] = [];

    // Extract template variables from prompt_template first, then fallback to prompt
    const promptTemplate = this.getNodeData(node, 'prompt_template', null);

    if (promptTemplate) {
      // Handle array of PromptMessage objects
      if (Array.isArray(promptTemplate)) {
        for (const msg of promptTemplate as any[]) {
          const messageVars = this.extractTemplateVariables(msg.text || '');
          templateVars.push(...messageVars);
        }
      }

      // Handle complex template object with content field
      else if (typeof promptTemplate === 'object' && promptTemplate !== null) {
        const templateObj = promptTemplate as Record<string, any>;
        if (templateObj['content']) {
          const contentVars = this.extractTemplateVariables(templateObj['content']);
          templateVars.push(...contentVars);
        }

        // Handle simple object with direct text
        if (templateObj['text']) {
          const textVars = this.extractTemplateVariables(templateObj['text']);
          templateVars.push(...textVars);
        }
      }
    }

    // Fall back to simple prompt field (legacy format)
    else {
      const simplePrompt = this.getNodeData(node, 'prompt', '');
      const promptVars = this.extractTemplateVariables(String(simplePrompt));
      templateVars.push(...promptVars);
    }

    // Add standard output variables that this node creates
    const outputVars = ['LLM_CONTENT', 'LLM_SUCCESS'];

    // Remove duplicates
    const allVars = [...new Set([...templateVars, ...outputVars])];
    return allVars;
  }
}
