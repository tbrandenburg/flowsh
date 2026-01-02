/**
 * Template Engine for flowsh Workflows
 *
 * Handles template resolution, rendering, and variable substitution.
 * Supports multiple sources (HTTP, file, git, registry), caching, and validation.
 */

import { FlowshGenerationError } from '../../errors/types.js';
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
 * Template source configuration
 */
interface TemplateSource {
  type: 'http' | 'file' | 'git' | 'registry';
  url: string;
  authentication?: AuthConfig;
  caching?: CacheConfig;
}

/**
 * Authentication configuration for template sources
 */
interface AuthConfig {
  type: 'bearer' | 'basic' | 'header';
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  headerValue?: string;
}

/**
 * Caching configuration
 */
interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size in bytes
}

/**
 * Template registry configuration
 */
interface TemplateRegistry {
  sources: TemplateSource[];
  fallbackStrategy: 'error' | 'inline' | 'default';
  cacheTTL: number;
  maxCacheSize: number;
  timeout: number;
}

/**
 * Cached template entry
 */
interface CachedTemplate {
  content: string;
  timestamp: number;
  source: string;
  version?: string;
  size: number;
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
 * Template validation result
 */
interface TemplateValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Template Engine class for handling workflow templates
 */
export class TemplateEngine {
  private dependencies: TemplateDependency[];
  private cache = new Map<string, CachedTemplate>();
  private registry: TemplateRegistry;
  private cacheSize = 0;

  constructor(workflow: FlowshWorkflow) {
    this.dependencies =
      workflow.workflow?.template_dependencies || workflow.spec?.template_dependencies || [];

    // Initialize template registry with default configuration
    const registryToken = process.env['TEMPLATE_REGISTRY_TOKEN'];

    const httpSource: TemplateSource = {
      type: 'http',
      url: process.env['TEMPLATE_REGISTRY_URL'] || 'https://templates.flowsh.dev',
      caching: { enabled: true, ttl: 1800, maxSize: 2 * 1024 * 1024 },
    };

    if (registryToken) {
      httpSource.authentication = {
        type: 'bearer',
        token: registryToken,
      };
    }

    this.registry = {
      sources: [
        {
          type: 'file',
          url: './templates',
          caching: { enabled: true, ttl: 3600, maxSize: 1024 * 1024 },
        },
        httpSource,
      ],
      fallbackStrategy: 'default',
      cacheTTL: 3600,
      maxCacheSize: 10 * 1024 * 1024, // 10MB
      timeout: 30,
    };
  }

  /**
   * Resolves a template by ID and source with caching
   */
  async resolveTemplate(templateId: string, version?: string): Promise<string> {
    const cacheKey = `${templateId}:${version || 'latest'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.content;
    }

    // Try each source until successful
    for (const source of this.registry.sources) {
      try {
        const template = await this.loadFromSource(source, templateId, version);

        // Validate template
        const validation = await this.validateTemplate(template);
        if (!validation.isValid) {
          throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }

        // Cache successful result
        this.cacheTemplate(cacheKey, template, source.url, version);

        return template;
      } catch (error) {
        console.warn(
          `Template source failed: ${source.url} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Handle fallback strategy
    return this.handleTemplateFallback(templateId, version);
  }

  /**
   * Renders a template with variable substitution
   */
  renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Replace {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    // Replace ${variableName} placeholders for shell compatibility
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\$\\{\\s*${key}\\s*\\}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    return rendered;
  }

  /**
   * Generates the template system shell functions
   */
  generateTemplateSystem(): string {
    let templateCases = '';

    for (const dep of this.dependencies) {
      templateCases += `        "${dep.template_id}")
            cat <<'TEMPLATE'
${this.generateTemplateContent(dep)}
TEMPLATE
            ;;
`;
    }

    return `# =============================================================================
# TEMPLATE SYSTEM
# =============================================================================

# Template cache directory
TEMPLATE_CACHE_DIR="\${FLOWSH_TEMP_DIR:-/tmp/flowsh}/templates"
mkdir -p "\$TEMPLATE_CACHE_DIR"

# Template resolution with comprehensive source support
resolve_template() {
    local template_id="\$1"
    local version="\${2:-latest}"
    local cache_key="\${template_id}:\${version}"
    local cache_file="\$TEMPLATE_CACHE_DIR/\$cache_key"

    log_debug "\$correlation_id" "Resolving template: \$template_id (version: \$version)"

    # Check local cache first
    if [ -f "\$cache_file" ]; then
        local cache_age=\$(($(date +%s) - $(stat -c %Y "\$cache_file" 2>/dev/null || echo 0)))
        if [ \$cache_age -lt ${this.registry.cacheTTL} ]; then
            log_debug "\$correlation_id" "Template cache hit: \$template_id"
            cat "\$cache_file"
            return 0
        else
            log_debug "\$correlation_id" "Template cache expired: \$template_id"
            rm -f "\$cache_file"
        fi
    fi

    # Try built-in templates first
    case "\$template_id" in
${templateCases}        "task-planner")
            local content='You are a task planner. Break down this task: {{task_description}}

Create actionable steps and implement them systematically.
Focus on:
1. Understanding requirements
2. Breaking down into subtasks  
3. Implementation planning
4. Testing strategy

Keep your response concise and actionable.'
            echo "\$content" > "\$cache_file"
            echo "\$content"
            return 0
            ;;
        "code-reviewer")
            local content='Review and analyze this task: {{task_description}}

Provide feedback on:
1. Code quality and best practices
2. Potential security issues
3. Performance considerations
4. Testing coverage'
            echo "\$content" > "\$cache_file"
            echo "\$content"
            return 0
            ;;
    esac

    # Try external sources
    ${this.generateExternalSourceResolution()}

    # Handle fallback strategy
    case "${this.registry.fallbackStrategy}" in
        "error")
            log_error "\$correlation_id" "Template not found: \$template_id"
            return 1
            ;;
        "inline")
            log_warning "\$correlation_id" "Using template ID as inline content: \$template_id"
            echo "\$template_id"
            ;;
        "default")
            log_warning "\$correlation_id" "Using default template for: \$template_id"
            local default_content="Default template content for \$template_id: {{task_description}}"
            echo "\$default_content" > "\$cache_file"
            echo "\$default_content"
            ;;
    esac
}

# Enhanced template rendering with comprehensive variable substitution
render_template() {
    local template="\$1"
    local variables="\$2"
    
    # Validate inputs
    if [ -z "\$template" ]; then
        log_error "\$correlation_id" "Template content is empty"
        return 1
    fi
    
    log_debug "\$correlation_id" "Rendering template with variables"
    
    # Start with the template
    local rendered="\$template"
    
    # Replace common workflow variables
    rendered=\$(echo "\$rendered" | sed "s|{{task_description}}|\$(get_workflow_var 'task_description' 'Default task')|g")
    rendered=\$(echo "\$rendered" | sed "s|{{input_data}}|\$variables|g")
    rendered=\$(echo "\$rendered" | sed "s|{{correlation_id}}|\$correlation_id|g")
    rendered=\$(echo "\$rendered" | sed "s|{{timestamp}}|\$(date -Iseconds)|g")
    
    # Apply variable substitution function for \${} patterns
    rendered=\$(substitute_variables "\$rendered" "\$variables")
    
    echo "\$rendered"
}

# Advanced variable substitution supporting nested and complex patterns
substitute_variables() {
    local content="\$1"
    local input_data="\$2"
    
    # Replace \${variable} patterns with workflow variables
    local result="\$content"
    
    # Extract all variable references
    local vars=\$(echo "\$content" | grep -o '\${[^}]*}' | sort -u)
    
    for var_ref in \$vars; do
        # Remove \${} wrapper
        local var_name=\$(echo "\$var_ref" | sed 's/\${\\([^}]*\\)}/\\1/')
        
        # Get variable value
        local var_value=\$(get_variable_value "\$var_name" "\$input_data")
        
        # Replace in result
        result=\$(echo "\$result" | sed "s|\\\${$var_name}|\$var_value|g")
    done
    
    echo "\$result"
}

# Get variable value from workflow state or input data
get_variable_value() {
    local var_name="\$1"
    local input_data="\$2"
    
    # Try workflow variable first
    local value=\$(get_workflow_var "\$var_name" "")
    
    if [ -n "\$value" ]; then
        echo "\$value"
        return 0
    fi
    
    # Try environment variable
    local env_value=\$(eval "echo \\\$\$var_name" 2>/dev/null || echo "")
    if [ -n "\$env_value" ]; then
        echo "\$env_value"
        return 0
    fi
    
    # Return empty string as fallback
    echo ""
}

# Validate template content
validate_template() {
    local template="\$1"
    local template_id="\$2"
    
    # Basic validation checks
    if [ -z "\$template" ]; then
        log_error "\$correlation_id" "Template validation failed: empty content" "{\\"template_id\\": \\"\$template_id\\"}"
        return 1
    fi
    
    # Check for potentially dangerous content
    if echo "\$template" | grep -q '\$(.*rm.*-rf'; then
        log_error "\$correlation_id" "Template validation failed: dangerous command detected" "{\\"template_id\\": \\"\$template_id\\"}"
        return 1
    fi
    
    # Check template size (max 1MB)
    local template_size=\${#template}
    if [ \$template_size -gt 1048576 ]; then
        log_error "\$correlation_id" "Template validation failed: size too large (\$template_size bytes)" "{\\"template_id\\": \\"\$template_id\\"}"
        return 1
    fi
    
    log_debug "\$correlation_id" "Template validation passed: \$template_id (\$template_size bytes)"
    return 0
}`;
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
   * Gets the list of template dependencies
   */
  getDependencies(): TemplateDependency[] {
    return [...this.dependencies];
  }

  /**
   * Clears the template cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number; entries: number; maxSize: number } {
    return {
      size: this.cacheSize,
      entries: this.cache.size,
      maxSize: this.registry.maxCacheSize,
    };
  }

  // Private helper methods

  private async loadFromSource(
    source: TemplateSource,
    templateId: string,
    version?: string
  ): Promise<string> {
    switch (source.type) {
      case 'http':
        return this.loadFromHTTP(source, templateId, version);
      case 'file':
        return this.loadFromFile(source, templateId, version);
      case 'git':
        return this.loadFromGit(source, templateId, version);
      case 'registry':
        return this.loadFromRegistry(source, templateId, version);
      default:
        throw new Error(`Unsupported template source type: ${source.type}`);
    }
  }

  private async loadFromHTTP(
    source: TemplateSource,
    templateId: string,
    version?: string
  ): Promise<string> {
    const url = `${source.url}/templates/${templateId}${version ? `?version=${version}` : ''}`;

    const headers: Record<string, string> = {
      Accept: 'text/plain',
      'User-Agent': 'flowsh-template-engine/1.0',
    };

    // Add authentication headers
    if (source.authentication) {
      switch (source.authentication.type) {
        case 'bearer':
          if (source.authentication.token) {
            headers['Authorization'] = `Bearer ${source.authentication.token}`;
          }
          break;
        case 'basic':
          if (source.authentication.username && source.authentication.password) {
            const credentials = Buffer.from(
              `${source.authentication.username}:${source.authentication.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'header':
          if (source.authentication.headerName && source.authentication.headerValue) {
            headers[source.authentication.headerName] = source.authentication.headerValue;
          }
          break;
      }
    }

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.registry.timeout * 1000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(
        `Failed to load template from HTTP: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async loadFromFile(
    _source: TemplateSource,
    _templateId: string,
    _version?: string
  ): Promise<string> {
    // For Node.js environment, we would use fs module
    // For now, throw an error as we're in a browser-like environment
    throw new Error('File system template loading not supported in this environment');
  }

  private async loadFromGit(
    _source: TemplateSource,
    _templateId: string,
    _version?: string
  ): Promise<string> {
    // Git template loading would require git commands or API calls
    throw new Error('Git template loading not yet implemented');
  }

  private async loadFromRegistry(
    source: TemplateSource,
    templateId: string,
    version?: string
  ): Promise<string> {
    // Registry-specific loading logic
    return this.loadFromHTTP(source, templateId, version);
  }

  private async validateTemplate(template: string): Promise<TemplateValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template || template.trim().length === 0) {
      errors.push('Template content is empty');
    }

    // Size validation
    if (template.length > 1024 * 1024) {
      // 1MB limit
      errors.push('Template size exceeds 1MB limit');
    }

    // Security validation - check for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf/gi,
      /\$\(.*rm.*\)/gi,
      /eval\s*[\('"]/gi,
      /exec\s*[\('"]/gi,
      /sudo\s+/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(template)) {
        errors.push(`Template contains potentially dangerous pattern: ${pattern}`);
      }
    }

    // Syntax validation - check for balanced braces
    const openBraces = (template.match(/{{/g) || []).length;
    const closeBraces = (template.match(/}}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Template has unbalanced template braces {{ }}');
    }

    const openShellVars = (template.match(/\${/g) || []).length;
    const closeShellVars = (template.match(/}/g) || []).length;
    if (openShellVars > closeShellVars) {
      warnings.push('Template may have unbalanced shell variable references ${ }');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private cacheTemplate(key: string, content: string, source: string, version?: string): void {
    const entry: CachedTemplate = {
      content,
      timestamp: Date.now(),
      source,
      size: content.length,
    };

    if (version) {
      entry.version = version;
    }

    // Implement cache size limit
    if (this.cacheSize + entry.size > this.registry.maxCacheSize) {
      this.evictOldestEntries(entry.size);
    }

    this.cache.set(key, entry);
    this.cacheSize += entry.size;
  }

  private evictOldestEntries(neededSize: number): void {
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    let freedSize = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      freedSize += entry.size;

      if (freedSize >= neededSize) {
        break;
      }
    }
  }

  private isCacheExpired(entry: CachedTemplate): boolean {
    return Date.now() - entry.timestamp > this.registry.cacheTTL * 1000;
  }

  private handleTemplateFallback(templateId: string, _version?: string): string {
    switch (this.registry.fallbackStrategy) {
      case 'error':
        throw new FlowshGenerationError(`Template '${templateId}' not found`);
      case 'inline':
        return templateId; // Use template ID as content
      case 'default':
        return `Default template content for ${templateId}: {{task_description}}`;
      default:
        throw new FlowshGenerationError(
          `Unknown fallback strategy: ${this.registry.fallbackStrategy}`
        );
    }
  }

  private generateTemplateContent(dependency: TemplateDependency): string {
    return `# Template: ${dependency.template_id}
# Source: ${dependency.source}
# Version: ${dependency.version || 'latest'}

You are an AI assistant processing: {{task_description}}

Please provide a helpful, accurate, and concise response based on the task requirements.

Context:
- Template ID: ${dependency.template_id}
- Input Data: {{input_data}}
- Timestamp: {{timestamp}}`;
  }

  private generateExternalSourceResolution(): string {
    const sourceAttempts = this.registry.sources
      .map((source, index) => {
        return `
    # Try source ${index + 1}: ${source.type} - ${source.url}
    log_debug "\$correlation_id" "Attempting template resolution from ${source.type}: ${source.url}"
    
    if resolve_from_${source.type}_source "\$template_id" "\$version" "${source.url}" > "\$cache_file.tmp"; then
        if validate_template "\$(cat "\$cache_file.tmp")" "\$template_id"; then
            mv "\$cache_file.tmp" "\$cache_file"
            cat "\$cache_file"
            return 0
        else
            log_warning "\$correlation_id" "Template validation failed from ${source.type} source"
            rm -f "\$cache_file.tmp"
        fi
    else
        log_debug "\$correlation_id" "Failed to resolve from ${source.type} source: ${source.url}"
        rm -f "\$cache_file.tmp"
    fi`;
      })
      .join('\n');

    return `${sourceAttempts}

# Source resolution functions
resolve_from_http_source() {
    local template_id="\$1"
    local version="\$2" 
    local base_url="\$3"
    local url="\$base_url/templates/\$template_id"
    
    if [ "\$version" != "latest" ]; then
        url="\$url?version=\$version"
    fi
    
    curl -s --max-time ${this.registry.timeout} \\
         -H "Accept: text/plain" \\
         -H "User-Agent: flowsh-template-engine/1.0" \\
         "\$url" 2>/dev/null
}

resolve_from_file_source() {
    local template_id="\$1"
    local version="\$2"
    local base_path="\$3"
    local file_path="\$base_path/\$template_id"
    
    if [ "\$version" != "latest" ]; then
        file_path="\$file_path.\$version"
    fi
    
    if [ -f "\$file_path" ]; then
        cat "\$file_path"
        return 0
    fi
    
    return 1
}

resolve_from_git_source() {
    local template_id="\$1"
    local version="\$2"
    local repo_url="\$3"
    
    # Git resolution not yet implemented
    log_warning "\$correlation_id" "Git template resolution not implemented"
    return 1
}

resolve_from_registry_source() {
    local template_id="\$1"
    local version="\$2"
    local registry_url="\$3"
    
    # Use HTTP resolution for registry
    resolve_from_http_source "\$template_id" "\$version" "\$registry_url"
}`;
  }
}
