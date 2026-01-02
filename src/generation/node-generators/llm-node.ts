/**
 * LLM Node Generator
 *
 * Generates shell functions for LLM (Large Language Model) nodes.
 * Handles prompt template resolution, model configuration, and API calls.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator, ValidationResult } from './base-generator.js';

export class LLMNodeGenerator implements NodeGenerator {
  /**
   * Validates an LLM node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const data = node.data as any;

    // Check for model configuration
    if (!data.model) {
      warnings.push(`LLM node ${node.id}: No model specified, will use default 'gpt-4'`);
    } else {
      if (!data.model.name) {
        warnings.push(`LLM node ${node.id}: No model name specified, will use 'gpt-4'`);
      }
      if (!data.model.provider) {
        warnings.push(`LLM node ${node.id}: No provider specified, will use 'openai'`);
      }
    }

    // Check for prompt configuration
    if (!data.prompt_template && !data.prompt) {
      warnings.push(`LLM node ${node.id}: No prompt template or direct prompt specified`);
    }

    // Validate prompt template if present
    if (data.prompt_template) {
      if (!data.prompt_template.template_id) {
        errors.push(`LLM node ${node.id}: prompt_template specified but no template_id provided`);
      }
      if (!data.prompt_template.source) {
        warnings.push(`LLM node ${node.id}: No template source specified, will use 'library'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates shell function for an LLM node
   */
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;

    return `# Execute LLM node: ${node.id}
${functionName}() {
    log_step "🧠 Running LLM: ${data.title || node.id}"
    
    local model_name="${data.model?.name || 'gpt-4'}"
    local provider="${data.model?.provider || 'openai'}"
    
    # Prepare prompt
    local prompt=""
    if [[ -n "${data.prompt_template?.template_id || ''}" ]]; then
        local template_content
        if ! template_content=\$(resolve_template "${data.prompt_template?.template_id || ''}" "${data.prompt_template?.source || 'library'}"); then
            log_error "Failed to resolve template '${data.prompt_template?.template_id || ''}'"
            return 1
        fi
        
        if ! prompt=\$(render_template "\$template_content" "\$(get_workflow_var 'task_description' '')"); then
            log_error "Failed to render template"
            return 1
        fi
    else
        prompt="\$(get_workflow_var 'task_description' 'Default LLM prompt')"
    fi
    
    # Execute LLM call
    local llm_exit_code=0
    if [[ "\$USE_MOCK_TOOLS" == "true" ]]; then
        log_debug "Using mock LLM"
        local response
        response=\$(mock_llm "\$prompt" "\$model_name") || llm_exit_code=\$?
        
        if [[ \$llm_exit_code -eq 0 ]]; then
            set_workflow_var "${node.id}_response" "\$response"
        fi
    else
        log_warning "Real LLM integration not implemented yet, using mock"
        local response
        response=\$(mock_llm "\$prompt" "\$model_name") || llm_exit_code=\$?
        
        if [[ \$llm_exit_code -eq 0 ]]; then
            set_workflow_var "${node.id}_response" "\$response"
        fi
    fi
    
    if [[ \$llm_exit_code -ne 0 ]]; then
        handle_error \$llm_exit_code "LLM execution" "${node.id}"
        return \$llm_exit_code
    fi
    
    log_success "LLM execution completed"
    set_workflow_state "current_node" "${node.id}"
}`;
  }
}
