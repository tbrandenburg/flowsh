/**
 * Template Transform Node Generator
 *
 * Generates shell script code for advanced template processing with
 * template functions, variable substitution, and multiple template sources
 */

import { WorkflowNode, TemplateTransformNodeData } from '../../dsl/types.js';
import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';

export class TemplateTransformNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'template-transform';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const data = node.data as TemplateTransformNodeData;
    const nodeId = this.sanitizeVariableName(node.id);
    const functionName = `execute_template_transform_${nodeId}`;

    // Extract configuration with defensive programming
    const outputVar = this.sanitizeVariableName(data.output_variable || 'template_output');
    const title = data.title || node.id;
    const template = data.template || { source: 'inline', content: '' };
    const parameters = data.template_parameters || {};

    // Generate template resolution code
    const templateResolutionCode = this.generateTemplateResolution(template, node.id);

    // Generate parameter processing code
    const parametersCode = this.generateParametersCode(parameters, node.id);

    return `
${this.generateNodeComment(node)}
${functionName}() {
    log_step "🔧 Template Transform: ${this.escapeShellValue(title)}"

    local output_var="${outputVar}"
    local template_content=""

${templateResolutionCode}

    # Validate template was resolved
    if [[ -z "$template_content" ]]; then
        log_error "Failed to resolve template content"
        set_workflow_var "$output_var" ""
        return 1
    fi

    log_debug "Template resolved, length: \${#template_content} characters"

    # Apply template parameters (basic substitution)
    local rendered_content="$template_content"

${parametersCode}

    # Advanced template functions processing
    rendered_content=$(process_template_functions "$rendered_content")
    
    # Additional variable substitution for workflow variables
    rendered_content=$(substitute_variables "$rendered_content")

    # Set output variable
    set_workflow_var "$output_var" "$rendered_content"

    log_success "Template transformed and stored in $output_var"
    log_debug "Template output length: \${#rendered_content} characters"
}

# Advanced template function processor for node ${nodeId}
process_template_functions_${nodeId}() {
    local content="$1"

    # {{#date}} -> current date (YYYY-MM-DD)
    content="\${content//\\{\\{#date\\}\\}/\$(date '+%Y-%m-%d')}"

    # {{#time}} -> current time (HH:MM:SS)
    content="\${content//\\{\\{#time\\}\\}/\$(date '+%H:%M:%S')}"

    # {{#datetime}} -> current date and time (ISO 8601)
    content="\${content//\\{\\{#datetime\\}\\}/\$(date -Iseconds)}"

    # {{#timestamp}} -> current Unix timestamp
    content="\${content//\\{\\{#timestamp\\}\\}/\$(date '+%s')}"

    # {{#uuid}} -> generate UUID (fallback if uuidgen not available)
    if command -v uuidgen >/dev/null 2>&1; then
        content="\${content//\\{\\{#uuid\\}\\}/\$(uuidgen)}"
    else
        # Fallback UUID generation using date and random
        local fallback_uuid="uuid-\$(date +%s)-\$RANDOM"
        content="\${content//\\{\\{#uuid\\}\\}/\$fallback_uuid}"
    fi

    # {{#random}} -> random number (0-32767)
    content="\${content//\\{\\{#random\\}\\}/\$RANDOM}"

    # {{#hostname}} -> current hostname
    content="\${content//\\{\\{#hostname\\}\\}/\$(hostname 2>/dev/null || echo 'unknown')}"

    # {{#user}} -> current user
    content="\${content//\\{\\{#user\\}\\}/\$(whoami 2>/dev/null || echo 'unknown')}"

    # {{#pwd}} -> current working directory
    content="\${content//\\{\\{#pwd\\}\\}/\$(pwd)}"

    # Process variable-based functions with regex matching
    # {{#base64:variable}} -> base64 encode variable
    while [[ "\$content" =~ \\{\\{#base64:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local encoded_value=""
        
        if [[ -n "\$var_value" ]]; then
            if command -v base64 >/dev/null 2>&1; then
                encoded_value="\$(echo -n "\$var_value" | base64 -w 0)"
            else
                log_warning "base64 command not available, skipping encoding for \$var_name"
                encoded_value="\$var_value"
            fi
        fi
        
        content="\${content//\\{\\{#base64:\$var_name\\}\\}/\$encoded_value}"
    done

    # {{#url_encode:variable}} -> URL encode variable
    while [[ "\$content" =~ \\{\\{#url_encode:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local encoded_value=""
        
        if [[ -n "\$var_value" ]]; then
            # Simple URL encoding (encode spaces and special characters)
            encoded_value="\$(echo "\$var_value" | sed 's/ /%20/g; s/&/%26/g; s/?/%3F/g; s/=/%3D/g')"
        fi
        
        content="\${content//\\{\\{#url_encode:\$var_name\\}\\}/\$encoded_value}"
    done

    # {{#upper:variable}} -> uppercase variable
    while [[ "\$content" =~ \\{\\{#upper:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local upper_value=""
        
        if [[ -n "\$var_value" ]]; then
            upper_value="\$(echo "\$var_value" | tr '[:lower:]' '[:upper:]')"
        fi
        
        content="\${content//\\{\\{#upper:\$var_name\\}\\}/\$upper_value}"
    done

    # {{#lower:variable}} -> lowercase variable
    while [[ "\$content" =~ \\{\\{#lower:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local lower_value=""
        
        if [[ -n "\$var_value" ]]; then
            lower_value="\$(echo "\$var_value" | tr '[:upper:]' '[:lower:]')"
        fi
        
        content="\${content//\\{\\{#lower:\$var_name\\}\\}/\$lower_value}"
    done

    # {{#length:variable}} -> length of variable
    while [[ "\$content" =~ \\{\\{#length:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local length_value="\${#var_value}"
        
        content="\${content//\\{\\{#length:\$var_name\\}\\}/\$length_value}"
    done

    # {{#json_escape:variable}} -> JSON escape variable
    while [[ "\$content" =~ \\{\\{#json_escape:([^}]+)\\}\\} ]]; do
        local var_name="\${BASH_REMATCH[1]}"
        local var_value="\$(get_workflow_var "\$var_name" "")"
        local escaped_value=""
        
        if [[ -n "\$var_value" ]]; then
            # Basic JSON escaping
            escaped_value="\$(echo "\$var_value" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\\t/\\\\t/g; s/\\n/\\\\n/g; s/\\r/\\\\r/g')"
        fi
        
        content="\${content//\\{\\{#json_escape:\$var_name\\}\\}/\$escaped_value}"
    done

    echo "\$content"
}

# Use the node-specific template function processor
process_template_functions() {
    process_template_functions_${nodeId} "\$1"
}`;
  }

  private generateTemplateResolution(template: any, nodeId: string): string {
    // Defensive programming: ensure template is an object
    if (!template || typeof template !== 'object') {
      template = { source: 'inline', content: '' };
    }

    const source = template.source || 'inline';
    const templateId = template.template_id || '';
    const content = template.content || '';
    const filePath = template.file_path || '';
    const version = template.version || 'latest';

    switch (source) {
      case 'inline':
        return `    # Inline template content
    template_content='${this.escapeShellValue(content)}'
    log_debug "Using inline template content"`;

      case 'library':
      case 'customized':
      case 'built-in':
        return `    # Resolve template from library/registry
    local template_id="${this.escapeShellValue(templateId)}"
    local template_version="${version}"
    
    log_debug "Resolving template: \$template_id (version: \$template_version)"
    
    if ! template_content=\$(resolve_template "\$template_id" "\$template_version" 2>&1); then
        log_error "Failed to resolve template '\$template_id': \$template_content"
        return 1
    fi
    
    log_debug "Template resolved from library: \$template_id"`;

      case 'file':
        return `    # Load template from file
    local template_file="${this.processTemplateVariables(filePath, nodeId)}"
    
    log_debug "Loading template from file: \$template_file"
    
    if [[ ! -f "\$template_file" ]]; then
        log_error "Template file not found: \$template_file"
        return 1
    fi
    
    if ! template_content=\$(cat "\$template_file" 2>&1); then
        log_error "Failed to read template file '\$template_file': \$template_content"
        return 1
    fi
    
    log_debug "Template loaded from file: \$template_file (\${#template_content} chars)"`;

      default:
        return `    # Unknown template source: ${source}
    log_error "Unknown template source: ${source}"
    return 1`;
    }
  }

  private generateParametersCode(parameters: Record<string, any>, nodeId: string): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return '    # No template parameters configured\n    log_debug "No template parameters to process"';
    }

    let code = '    # Apply template parameters (variable substitution)\n';

    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const escapedParamName = this.escapeShellValue(paramName);
      const processedValue = this.processTemplateVariables(String(paramValue), nodeId);

      code += `    local param_value="${processedValue}"
    log_debug "Processing parameter: ${escapedParamName} = \$param_value"
    rendered_content="\${rendered_content//\\{\\{${escapedParamName}\\}\\}/\$param_value}"
    rendered_content="\${rendered_content//\\$\\{${escapedParamName}\\}/\$param_value}"\n`;
    }

    return code;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);
    const data = node.data as TemplateTransformNodeData;

    // Template transform specific validation
    if (!data.template) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_TEMPLATE',
        message: 'Template transform node must specify a template',
        nodeId: node.id,
      });
    } else {
      // Validate template configuration based on source
      const source = data.template.source;
      const validSources = ['inline', 'library', 'customized', 'built-in', 'file'];

      if (!source || !validSources.includes(source)) {
        result.errors.push({
          type: 'error',
          code: 'INVALID_TEMPLATE_SOURCE',
          message: `Invalid template source "${source}". Must be one of: ${validSources.join(', ')}`,
          nodeId: node.id,
        });
      }

      // Source-specific validation
      switch (source) {
        case 'inline':
          if (!data.template.content) {
            result.errors.push({
              type: 'error',
              code: 'MISSING_INLINE_CONTENT',
              message: 'Inline template must specify content',
              nodeId: node.id,
            });
          }
          break;

        case 'library':
        case 'customized':
        case 'built-in':
          if (!data.template.template_id) {
            result.errors.push({
              type: 'error',
              code: 'MISSING_TEMPLATE_ID',
              message: `${source} template must specify template_id`,
              nodeId: node.id,
            });
          }
          break;

        case 'file':
          if (!data.template.file_path) {
            result.errors.push({
              type: 'error',
              code: 'MISSING_FILE_PATH',
              message: 'File template must specify file_path',
              nodeId: node.id,
            });
          }
          break;
      }
    }

    if (!data.output_variable) {
      result.errors.push({
        type: 'error',
        code: 'MISSING_OUTPUT_VARIABLE',
        message: 'Template transform node must specify an output variable',
        nodeId: node.id,
      });
    }

    // Validate template parameters
    if (data.template_parameters) {
      if (typeof data.template_parameters !== 'object') {
        result.errors.push({
          type: 'error',
          code: 'INVALID_TEMPLATE_PARAMETERS',
          message: 'template_parameters must be an object',
          nodeId: node.id,
        });
      }
    }

    // Warnings for template dependencies
    if (data.template?.source === 'library' || data.template?.source === 'built-in') {
      result.warnings.push({
        type: 'warning',
        code: 'TEMPLATE_DEPENDENCY',
        message: 'Template requires external resolution - ensure template registry is accessible',
        nodeId: node.id,
      });
    }

    if (data.template?.source === 'file') {
      result.warnings.push({
        type: 'warning',
        code: 'FILE_DEPENDENCY',
        message: 'Template requires file access - ensure file path is accessible during execution',
        nodeId: node.id,
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];
    const data = node.data as TemplateTransformNodeData;

    // Extract variables from template content (for inline templates)
    if (data.template?.content) {
      variables.push(...this.extractTemplateVariables(data.template.content));
    }

    // Extract variables from file path (for file templates)
    if (data.template?.source === 'file' && data.template.file_path) {
      variables.push(...this.extractTemplateVariables(data.template.file_path));
    }

    // Extract variables from template parameters
    if (data.template_parameters) {
      for (const value of Object.values(data.template_parameters)) {
        if (typeof value === 'string') {
          variables.push(...this.extractTemplateVariables(value));
        }
      }
    }

    // Add output variable
    if (data.output_variable) {
      variables.push(this.sanitizeVariableName(data.output_variable).toUpperCase());
    }

    return [...new Set(variables)];
  }
}
