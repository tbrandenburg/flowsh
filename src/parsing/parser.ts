/**
 * YAML Parser for flowsh Workflows
 *
 * Handles parsing and validation of flowsh YAML workflow files with comprehensive
 * error handling and type safety.
 */

import { validateWorkflow, ValidationResult, ValidationError } from '../dsl/validation.js';
import { ValidationErrorInfo, ValidationWarning } from '../errors/types.js';
import { YamlSecurityValidator } from '../security/yaml-validator.js';
import { FlowshWorkflow } from '../dsl/types.js';
import { readFile } from 'fs/promises';
import * as yaml from 'js-yaml';

// =============================================================================
// Parser Configuration
// =============================================================================

export interface ParserOptions {
  /** Validate the workflow after parsing */
  validate?: boolean;
  /** Strict mode - fail on warnings */
  strict?: boolean;
  /** Schema version to validate against */
  schemaVersion?: string;
}

export interface ParseResult {
  /** Successfully parsed workflow */
  workflow?: FlowshWorkflow;
  /** Validation result if validation was performed */
  validation?: ValidationResult;
  /** Parser-specific errors */
  errors: ValidationError[];
  /** Parser-specific warnings */
  warnings: ValidationError[];
  /** Success status */
  success: boolean;
}

// =============================================================================
// Main Parser Functions
// =============================================================================

/**
 * Parses a flowsh workflow from a YAML string
 */
export async function parseWorkflowYAML(
  yamlContent: string,
  options: ParserOptions = {}
): Promise<ParseResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const { validate = true, strict = false } = options;

  try {
    // Security validation before parsing
    const securityResult = YamlSecurityValidator.validateYamlSecurity(yamlContent, {
      strictMode: strict,
    });

    if (!securityResult.success) {
      // Convert security errors to parser format
      const securityErrors: ValidationError[] = securityResult.errors.map(
        (error: ValidationErrorInfo) => ({
          type: 'error',
          code: 'SECURITY_VALIDATION_FAILED',
          message: error.message,
        })
      );

      return {
        errors: securityErrors,
        warnings: [],
        success: false,
      };
    }

    // Add warnings if any
    if (securityResult.warnings.length > 0) {
      const securityWarnings: ValidationError[] = securityResult.warnings.map(
        (warning: ValidationWarning) => ({
          type: 'warning',
          code: 'SECURITY_WARNING',
          message: warning.message,
        })
      );

      if (strict) {
        // In strict mode, treat warnings as errors
        return {
          errors: securityWarnings.map(w => ({ ...w, type: 'error' as const })),
          warnings: [],
          success: false,
        };
      } else {
        warnings.push(...securityWarnings);
      }
    }

    // Add warnings if any
    if (securityResult.warnings.length > 0) {
      const securityWarnings: ValidationError[] = securityResult.warnings.map(
        (warning: ValidationWarning) => ({
          type: 'warning',
          code: 'SECURITY_WARNING',
          message: warning.message,
        })
      );

      if (strict) {
        // In strict mode, treat warnings as errors
        return {
          errors: securityWarnings.map(w => ({ ...w, type: 'error' as const })),
          warnings: [],
          success: false,
        };
      } else {
        warnings.push(...securityWarnings);
      }
    }

    // Parse YAML with FAILSAFE schema for maximum security
    const parsed = yaml.load(yamlContent, {
      schema: yaml.FAILSAFE_SCHEMA, // SECURITY FIX: Use FAILSAFE_SCHEMA instead of CORE_SCHEMA to prevent prototype pollution
      filename: 'workflow.yaml',
    }) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return {
        errors: [
          {
            type: 'error',
            code: 'INVALID_YAML_STRUCTURE',
            message: 'YAML must contain an object at the root level',
          },
        ],
        warnings: [],
        success: false,
      };
    }

    // SECURITY FIX: Add comprehensive post-parse object validation to prevent prototype pollution
    const securityValidationResult = validateObjectSecurity(parsed as Record<string, unknown>);
    if (!securityValidationResult.isSecure) {
      return {
        errors: [
          {
            type: 'error',
            code: 'SECURITY_VIOLATION',
            message: securityValidationResult.reason || 'Object contains security violations',
          },
        ],
        warnings: [],
        success: false,
      };
    }

    // Transform to our workflow format
    const workflow = transformParsedYAML(parsed as Record<string, unknown>);

    let validation: ValidationResult | undefined;

    if (validate) {
      validation = validateWorkflow(workflow);

      if (!validation.valid) {
        errors.push(...validation.errors);
      }

      if (strict && validation.warnings.length > 0) {
        errors.push(...validation.warnings.map(w => ({ ...w, type: 'error' as const })));
      } else if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings);
      }
    }

    const result: ParseResult = {
      workflow,
      errors,
      warnings,
      success: errors.length === 0,
    };

    if (validation) {
      result.validation = validation;
    }

    return result;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      const yamlError: ValidationError = {
        type: 'error',
        code: 'YAML_PARSE_ERROR',
        message: `YAML parsing failed: ${error.message}`,
      };

      if (error.mark) {
        yamlError.path = `Line ${error.mark.line + 1}, Column ${error.mark.column + 1}`;
      }

      return {
        errors: [yamlError],
        warnings: [],
        success: false,
      };
    }

    return {
      errors: [
        {
          type: 'error',
          code: 'UNEXPECTED_ERROR',
          message: `Unexpected error during parsing: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      warnings: [],
      success: false,
    };
  }
}

/**
 * Parses a flowsh workflow from a file path
 */
export async function parseWorkflowFile(
  filePath: string,
  options: ParserOptions = {}
): Promise<ParseResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return await parseWorkflowYAML(content, options);
  } catch (error) {
    return {
      errors: [
        {
          type: 'error' as const,
          code: 'PARSE_FILE_READ_ERROR',
          message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          path: filePath,
        },
      ],
      warnings: [],
      success: false,
    };
  }
}

// =============================================================================
// Security Validation for Post-Parse Objects
// =============================================================================

/**
 * Security validation result for parsed objects
 */
interface ObjectSecurityValidationResult {
  isSecure: boolean;
  reason?: string;
}

/**
 * SECURITY FIX: Comprehensive post-parse object validation to prevent prototype pollution
 * and other object-based attacks after YAML parsing
 */
function validateObjectSecurity(
  obj: Record<string, unknown>,
  path = 'root',
  depth = 0
): ObjectSecurityValidationResult {
  // Prevent deep nesting attacks
  if (depth > 10) {
    return {
      isSecure: false,
      reason: `Object nesting exceeds safe limit at path: ${path}`,
    };
  }

  // Check for dangerous property names that could lead to prototype pollution
  const dangerousKeys = ['__proto__', 'constructor', 'prototype', 'valueOf', 'toString'];

  for (const key of Object.keys(obj)) {
    // Check for dangerous key names
    if (dangerousKeys.includes(key)) {
      return {
        isSecure: false,
        reason: `Dangerous property name detected: ${key} at path: ${path}`,
      };
    }

    // Check for suspicious key patterns
    if (key.startsWith('__') || key.includes('prototype')) {
      return {
        isSecure: false,
        reason: `Suspicious property name detected: ${key} at path: ${path}`,
      };
    }

    const value = obj[key];
    const currentPath = `${path}.${key}`;

    // Recursively validate nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nestedResult = validateObjectSecurity(
        value as Record<string, unknown>,
        currentPath,
        depth + 1
      );
      if (!nestedResult.isSecure) {
        return nestedResult;
      }
    }

    // Validate array contents
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const arrayValue = value[i];
        if (arrayValue !== null && typeof arrayValue === 'object' && !Array.isArray(arrayValue)) {
          const arrayResult = validateObjectSecurity(
            arrayValue as Record<string, unknown>,
            `${currentPath}[${i}]`,
            depth + 1
          );
          if (!arrayResult.isSecure) {
            return arrayResult;
          }
        }
      }
    }

    // Prevent function injection
    if (typeof value === 'function') {
      return {
        isSecure: false,
        reason: `Function detected in object at path: ${currentPath}`,
      };
    }
  }

  return { isSecure: true };
}

// =============================================================================
// YAML Structure Transformation
// =============================================================================

/**
 * Transforms parsed YAML object to FlowshWorkflow format
 * Handles multiple possible YAML structures for flexibility
 */
function transformParsedYAML(parsed: Record<string, unknown>): FlowshWorkflow {
  const workflow: FlowshWorkflow = {};

  // Handle version and kind
  if (typeof parsed['version'] === 'string') {
    workflow.version = parsed['version'];
  }

  if (typeof parsed['kind'] === 'string') {
    workflow.kind = parsed['kind'];
  }

  // Handle metadata section
  if (parsed['metadata'] && typeof parsed['metadata'] === 'object') {
    workflow.metadata = transformMetadata(parsed['metadata'] as Record<string, unknown>);
  }

  // Handle workflow section (legacy format)
  if (parsed['workflow'] && typeof parsed['workflow'] === 'object') {
    const workflowObj = parsed['workflow'] as Record<string, unknown>;
    const name = String(workflowObj['name'] || '');

    workflow.workflow = { name };

    if (workflowObj['description']) {
      workflow.workflow.description = String(workflowObj['description']);
    }

    if (workflowObj['version']) {
      workflow.workflow.version = String(workflowObj['version']);
    }

    // Handle template dependencies
    if (Array.isArray(workflowObj['template_dependencies'])) {
      workflow.workflow.template_dependencies = workflowObj['template_dependencies'].map(
        transformTemplateDependency
      );
    }
  }

  // Handle environment variables
  if (Array.isArray(parsed['environment_variables'])) {
    workflow.environment_variables = parsed['environment_variables'].map(
      transformEnvironmentVariable
    );
  }

  // Handle conversation variables
  if (Array.isArray(parsed['conversation_variables'])) {
    workflow.conversation_variables = parsed['conversation_variables'].map(
      transformConversationVariable
    );
  }

  // Handle graph (direct or in spec)
  if (parsed['graph'] && typeof parsed['graph'] === 'object') {
    workflow.graph = transformGraph(parsed['graph'] as Record<string, unknown>);
  } else if (parsed['spec'] && typeof parsed['spec'] === 'object') {
    const spec = parsed['spec'] as Record<string, unknown>;
    const workflowSpec: any = {
      graph:
        spec['graph'] && typeof spec['graph'] === 'object'
          ? transformGraph(spec['graph'] as Record<string, unknown>)
          : { nodes: [], edges: [] },
    };

    if (Array.isArray(spec['template_dependencies'])) {
      workflowSpec.template_dependencies = spec['template_dependencies'].map(
        transformTemplateDependency
      );
    }

    if (Array.isArray(spec['environment_variables'])) {
      workflowSpec.environment_variables = spec['environment_variables'].map(
        transformEnvironmentVariable
      );
    }

    if (Array.isArray(spec['conversation_variables'])) {
      workflowSpec.conversation_variables = spec['conversation_variables'].map(
        transformConversationVariable
      );
    }

    workflow.spec = workflowSpec;
  }

  return workflow;
}

/**
 * Transforms metadata object
 */
function transformMetadata(
  metadata: Record<string, unknown>
): NonNullable<FlowshWorkflow['metadata']> {
  const result: any = {
    name: String(metadata['name'] || ''),
  };

  if (metadata['id']) {
    result.id = String(metadata['id']);
  }

  if (metadata['description']) {
    result.description = String(metadata['description']);
  }

  if (metadata['version']) {
    result.version = String(metadata['version']);
  }

  if (metadata['created_by']) {
    result.created_by = String(metadata['created_by']);
  }

  if (metadata['updated_by']) {
    result.updated_by = String(metadata['updated_by']);
  }

  if (metadata['labels'] && typeof metadata['labels'] === 'object') {
    result.labels = transformStringRecord(metadata['labels'] as Record<string, unknown>);
  }

  if (metadata['annotations'] && typeof metadata['annotations'] === 'object') {
    result.annotations = transformStringRecord(metadata['annotations'] as Record<string, unknown>);
  }

  return result;
}

/**
 * Transforms graph object
 */
function transformGraph(graph: Record<string, unknown>): NonNullable<FlowshWorkflow['graph']> {
  let nodes: any[] = [];

  if (Array.isArray(graph['nodes'])) {
    // Handle array format: nodes: [ {id: "start", ...}, ... ]
    nodes = graph['nodes'].map(transformNode);
  } else if (graph['nodes'] && typeof graph['nodes'] === 'object') {
    // Handle object format: nodes: { start_node: {id: "start", ...}, ... }
    const nodesObj = graph['nodes'] as Record<string, unknown>;
    nodes = Object.values(nodesObj).map(transformNode);
  }

  let edges: any[] = [];

  if (Array.isArray(graph['edges'])) {
    edges = graph['edges'].map(transformEdge);
  } else if (graph['edges'] && typeof graph['edges'] === 'object') {
    // Handle object format for edges too
    const edgesObj = graph['edges'] as Record<string, unknown>;
    edges = Object.values(edgesObj).map(transformEdge);
  }

  return { nodes, edges };
}

/**
 * Transforms a workflow node from parsed YAML
 */
function transformNode(nodeData: unknown): any {
  if (!nodeData || typeof nodeData !== 'object') {
    throw new Error('Invalid node data structure');
  }

  const node = nodeData as Record<string, unknown>;

  return {
    id: String(node['id'] || ''),
    type: String(node['type'] || ''),
    data: transformNodeData(
      node['data'] as Record<string, unknown> | undefined,
      String(node['type'] || '')
    ),
  };
}

/**
 * Transforms node data based on node type
 */
function transformNodeData(data: Record<string, unknown> | undefined, nodeType: string): any {
  if (!data) return {};

  const baseData: any = {};

  if (data['title']) {
    baseData.title = String(data['title']);
  }

  if (data['desc']) {
    baseData.desc = String(data['desc']);
  }

  if (data['description']) {
    baseData.description = String(data['description']);
  }

  switch (nodeType) {
    case 'start':
      if (Array.isArray(data['variables'])) {
        baseData.variables = data['variables'].map(transformVariable);
      }
      return baseData;

    case 'end':
      if (Array.isArray(data['outputs'])) {
        baseData.outputs = data['outputs'].map(transformVariable);
      }
      return baseData;

    case 'llm':
      if (data['model'] && typeof data['model'] === 'object') {
        baseData.model = transformModel(data['model'] as Record<string, unknown>);
      }
      if (data['prompt']) {
        baseData.prompt = String(data['prompt']);
      }
      if (data['prompt_template']) {
        baseData.prompt_template = transformPromptTemplate(data['prompt_template']);
      }
      if (data['template_parameters'] && typeof data['template_parameters'] === 'object') {
        baseData.template_parameters = transformStringRecord(
          data['template_parameters'] as Record<string, unknown>
        );
      }
      if (data['advanced_prompt_config']) {
        baseData.advanced_prompt_config = data['advanced_prompt_config'];
      }
      if (data['context']) {
        baseData.context = data['context'];
      }
      if (data['vision']) {
        baseData.vision = data['vision'];
      }
      if (data['memory']) {
        baseData.memory = data['memory'];
      }
      return baseData;

    case 'if-else':
      baseData.conditions = Array.isArray(data['conditions'])
        ? data['conditions'].map(transformCondition)
        : [];
      baseData.logical_operator = data['logical_operator']
        ? String(data['logical_operator'])
        : 'and';
      return baseData;

    case 'code':
      baseData.command = String(data['command'] || '');
      if (Array.isArray(data['args'])) {
        baseData.args = data['args'].map(String);
      }
      if (data['working_directory']) {
        baseData.working_directory = String(data['working_directory']);
      }
      if (data['environment_variables'] && typeof data['environment_variables'] === 'object') {
        baseData.environment_variables = transformStringRecord(
          data['environment_variables'] as Record<string, unknown>
        );
      }
      if (data['on_success']) {
        baseData.on_success = String(data['on_success']);
      }
      if (data['on_failure']) {
        baseData.on_failure = String(data['on_failure']);
      }
      if (data['timeout']) {
        baseData.timeout = Number(data['timeout']);
      }
      return baseData;

    case 'agent':
      baseData.command = String(data['command'] || '');
      if (Array.isArray(data['args'])) {
        baseData.args = data['args'].map(String);
      }
      if (data['prompt_template']) {
        baseData.prompt_template = transformPromptTemplate(data['prompt_template']);
      }
      if (data['template_parameters'] && typeof data['template_parameters'] === 'object') {
        baseData.template_parameters = transformStringRecord(
          data['template_parameters'] as Record<string, unknown>
        );
      }
      if (data['working_directory']) {
        baseData.working_directory = String(data['working_directory']);
      }
      if (data['environment_variables'] && typeof data['environment_variables'] === 'object') {
        baseData.environment_variables = transformStringRecord(
          data['environment_variables'] as Record<string, unknown>
        );
      }
      if (data['timeout']) {
        baseData.timeout = Number(data['timeout']);
      }
      return baseData;

    case 'variable-assignment':
      baseData.variable = String(data['variable'] || '');
      baseData.assignment_type = String(data['assignment_type'] || 'constant');
      if (data['value'] !== undefined) {
        baseData.value = data['value'];
      }
      if (data['source_variable']) {
        baseData.source_variable = String(data['source_variable']);
      }
      if (data['expression']) {
        baseData.expression = String(data['expression']);
      }
      baseData.write_mode = data['write_mode'] ? String(data['write_mode']) : 'over-write';
      return baseData;

    case 'answer':
      baseData.answer = String(data['answer'] || '');
      baseData.type = data['type'] ? String(data['type']) : 'text';
      return baseData;

    default:
      return { ...baseData, ...data };
  }
}

/**
 * Helper transformation functions
 */
function transformVariable(variableData: unknown): any {
  if (!variableData || typeof variableData !== 'object') {
    return {};
  }

  const variable = variableData as Record<string, unknown>;
  const result: any = {
    variable: String(variable['variable'] || ''),
    type: String(variable['type'] || 'text'),
    required: Boolean(variable['required']),
  };

  if (variable['label']) {
    result.label = String(variable['label']);
  }

  if (variable['description']) {
    result.description = String(variable['description']);
  }

  if (variable['options'] && Array.isArray(variable['options'])) {
    result.options = variable['options'].map(String);
  }

  if (variable['default'] !== undefined) {
    result.default = variable['default'];
  }

  if (variable['min'] !== undefined) {
    result.min = Number(variable['min']);
  }

  if (variable['max'] !== undefined) {
    result.max = Number(variable['max']);
  }

  return result;
}

function transformModel(model: Record<string, unknown>): any {
  const result: any = {
    provider: String(model['provider'] || 'openai'),
    name: String(model['name'] || 'gpt-4'),
    mode: String(model['mode'] || 'chat'),
  };

  if (model['completion_params'] && typeof model['completion_params'] === 'object') {
    result.completion_params = model['completion_params'];
  }

  return result;
}

function transformPromptTemplate(promptTemplate: unknown): any {
  if (Array.isArray(promptTemplate)) {
    return promptTemplate.map((msg: any) => ({
      role: String(msg?.['role'] || 'user'),
      text: String(msg?.['text'] || ''),
    }));
  }

  if (typeof promptTemplate === 'object' && promptTemplate !== null) {
    const template = promptTemplate as Record<string, unknown>;
    const result: any = {
      type: String(template['type'] || 'prompt'),
      source: String(template['source'] || 'inline'),
    };

    if (template['template_id']) {
      result.template_id = String(template['template_id']);
    }

    if (template['version']) {
      result.version = String(template['version']);
    }

    if (template['content']) {
      result.content = String(template['content']);
    }

    return result;
  }

  return promptTemplate;
}

function transformCondition(condition: unknown): any {
  if (!condition || typeof condition !== 'object') {
    return {};
  }

  const cond = condition as Record<string, unknown>;
  const result: any = {
    variable: String(cond['variable'] || ''),
    comparison_operator: String(cond['comparison_operator'] || '=='),
  };

  if (cond['value'] !== undefined) {
    result.value = cond['value'];
  }

  return result;
}

function transformEdge(edgeData: unknown): any {
  if (!edgeData || typeof edgeData !== 'object') {
    return {};
  }

  const edge = edgeData as Record<string, unknown>;
  const result: any = {
    source: String(edge['source'] || ''),
    target: String(edge['target'] || ''),
  };

  if (edge['id']) {
    result.id = String(edge['id']);
  }

  if (edge['sourceHandle']) {
    result.sourceHandle = String(edge['sourceHandle']);
  }

  if (edge['targetHandle']) {
    result.targetHandle = String(edge['targetHandle']);
  }

  if (edge['condition']) {
    result.condition = String(edge['condition']);
  }

  if (edge['label']) {
    result.label = String(edge['label']);
  }

  return result;
}

function transformTemplateDependency(dep: unknown): any {
  if (!dep || typeof dep !== 'object') {
    return {};
  }

  const dependency = dep as Record<string, unknown>;
  const result: any = {
    template_id: String(dependency['template_id'] || ''),
    type: String(dependency['type'] || 'prompt'),
    source: String(dependency['source'] || 'library'),
  };

  if (dependency['version']) {
    result.version = String(dependency['version']);
  }

  return result;
}

function transformEnvironmentVariable(variable: unknown): any {
  if (!variable || typeof variable !== 'object') {
    return {};
  }

  const env = variable as Record<string, unknown>;
  const result: any = {
    variable: String(env['variable'] || ''),
    name: String(env['name'] || ''),
    type: String(env['type'] || 'text'),
  };

  if (env['description']) {
    result.description = String(env['description']);
  }

  if (Array.isArray(env['options'])) {
    result.options = env['options'].map(String);
  }

  return result;
}

function transformConversationVariable(variable: unknown): any {
  if (!variable || typeof variable !== 'object') {
    return {};
  }

  const conv = variable as Record<string, unknown>;
  const result: any = {
    variable: String(conv['variable'] || ''),
    name: String(conv['name'] || ''),
    type: String(conv['type'] || 'object'),
  };

  if (conv['description']) {
    result.description = String(conv['description']);
  }

  return result;
}

function transformStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = String(value);
  }
  return result;
}
