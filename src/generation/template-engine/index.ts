/**
 * Template Engine for flowsh Workflows
 *
 * Handles template resolution, rendering, and variable substitution.
 * Supports library templates, custom templates, and built-in fallbacks.
 */

import { FlowshWorkflow } from '../../dsl/types.js';

/**
 * Template dependency interface
 */
interface TemplateDependency {
  template_id: string;
  source: string;
  version?: string;
}

/**
 * Template resolution result
 */
export interface TemplateResolution {
  content: string;
  success: boolean;
  errors: string[];
}

/**
 * Template Engine class for handling workflow templates
 */
export class TemplateEngine {
  private dependencies: TemplateDependency[];

  constructor(workflow: FlowshWorkflow) {
    this.dependencies =
      workflow.workflow?.template_dependencies || workflow.spec?.template_dependencies || [];
  }

  /**
   * Generates the template system shell functions
   */
  generateTemplateSystem(): string {
    let templateCases = '';

    for (const dep of this.dependencies) {
      templateCases += `        "${dep.template_id}")
            cat <<'TEMPLATE'
# Template: ${dep.template_id}
# Source: ${dep.source}
# Version: ${dep.version || 'latest'}
You are an AI assistant. Please process this request: {{task_description}}

Be helpful, accurate, and concise in your response.
TEMPLATE
            ;;
`;
    }

    return `# =============================================================================
# TEMPLATE SYSTEM
# =============================================================================

# Template resolution with fallback system
resolve_template() {
    local template_id="\$1"
    local source="\${2:-library}"
    
    log_debug "Resolving template: \$template_id from \$source"
    
    case "\$template_id" in
${templateCases}        "task-planner")
            cat <<'TEMPLATE'
You are a task planner. Break down this task: {{task_description}}

Create actionable steps and implement them systematically.
Focus on:
1. Understanding requirements
2. Breaking down into subtasks  
3. Implementation planning
4. Testing strategy

Keep your response concise and actionable.
TEMPLATE
            ;;
        "code-reviewer")
            cat <<'TEMPLATE'
Review and analyze this task: {{task_description}}

Provide feedback on:
1. Code quality and best practices
2. Potential security issues
3. Performance considerations
4. Testing coverage
TEMPLATE
            ;;
        *)
            log_error "Unknown template '\$template_id'"
            return 1
            ;;
    esac
}

# Template rendering with variable substitution
render_template() {
    local template="\$1"
    local task_description="\$2"
    
    # Validate inputs
    [[ -z "\$template" ]] && {
        log_error "Template content is empty"
        return 1
    }
    [[ -z "\$task_description" ]] && {
        log_error "Task description is empty"
        return 1
    }
    
    # Use the variable substitution function
    local rendered_template="\$(substitute_variables "\$template")"
    
    # Handle specific variable substitutions for backward compatibility
    rendered_template=\$(echo "\$rendered_template" | sed "s|{{task_description}}|\$task_description|g")
    
    echo "\$rendered_template"
}`;
  }

  /**
   * Resolves a template by ID and source
   */
  resolveTemplate(templateId: string, _source: string = 'library'): TemplateResolution {
    // Find dependency
    const dependency = this.dependencies.find(dep => dep.template_id === templateId);

    if (dependency) {
      return {
        content: this.generateTemplateContent(dependency),
        success: true,
        errors: [],
      };
    }

    // Check built-in templates
    const builtIn = this.getBuiltInTemplate(templateId);
    if (builtIn) {
      return {
        content: builtIn,
        success: true,
        errors: [],
      };
    }

    return {
      content: '',
      success: false,
      errors: [`Template '${templateId}' not found`],
    };
  }

  /**
   * Renders a template with variable substitution
   */
  renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  /**
   * Gets the list of template dependencies
   */
  getDependencies(): TemplateDependency[] {
    return [...this.dependencies];
  }

  /**
   * Validates that all referenced templates are available
   */
  validateTemplates(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const dep of this.dependencies) {
      if (!dep.template_id) {
        errors.push('Template dependency missing template_id');
      }
      if (!dep.source) {
        errors.push(`Template '${dep.template_id}' missing source`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates template content for a dependency
   */
  private generateTemplateContent(dependency: TemplateDependency): string {
    return `# Template: ${dependency.template_id}
# Source: ${dependency.source}
# Version: ${dependency.version || 'latest'}
You are an AI assistant. Please process this request: {{task_description}}

Be helpful, accurate, and concise in your response.`;
  }

  /**
   * Gets built-in template content
   */
  private getBuiltInTemplate(templateId: string): string | null {
    switch (templateId) {
      case 'task-planner':
        return `You are a task planner. Break down this task: {{task_description}}

Create actionable steps and implement them systematically.
Focus on:
1. Understanding requirements
2. Breaking down into subtasks  
3. Implementation planning
4. Testing strategy

Keep your response concise and actionable.`;

      case 'code-reviewer':
        return `Review and analyze this task: {{task_description}}

Provide feedback on:
1. Code quality and best practices
2. Potential security issues
3. Performance considerations
4. Testing coverage`;

      default:
        return null;
    }
  }
}
