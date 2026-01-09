/**
 * DSL Type Schema Mapping System
 *
 * Extracts detailed property information from TypeScript node data interfaces
 * to provide comprehensive schema information for DSL introspection.
 */

// =============================================================================
// Property Information Interfaces
// =============================================================================

export interface PropertyInfo {
  name: string;
  type: string | string[];
  required: boolean;
  description: string;
  enum?: string[];
  default?: any;
  minimum?: number;
  maximum?: number;
  examples?: any[];
  properties?: PropertyInfo[]; // For nested objects
  additionalProperties?: boolean;
}

export interface NodeDetailInfo {
  nodeType: string;
  description: string;
  category: string;
  implemented: boolean;
  generator: string;
  schema: {
    type: 'object';
    required: string[];
    properties: Record<string, PropertyInfo>;
  };
  templateVariables: {
    supported: string[];
    extraction: string;
  };
  shellGeneration: {
    features: string[];
  };
  relatedCommands: string[];
}

// =============================================================================
// Base Property Definitions
// =============================================================================

const BASE_NODE_PROPERTIES: PropertyInfo[] = [
  {
    name: 'title',
    type: 'string',
    required: false,
    description: 'Human-readable node title',
  },
  {
    name: 'desc',
    type: 'string',
    required: false,
    description: 'Node description (alias for description)',
  },
  {
    name: 'description',
    type: 'string',
    required: false,
    description: 'Node description',
  },
];

// =============================================================================
// Type Schema Extractor
// =============================================================================

export interface TypeSchemaExtractor {
  extractSchema(nodeType: string): PropertyInfo[];
}

export class DSLTypeSchemaExtractor implements TypeSchemaExtractor {
  extractSchema(nodeType: string): PropertyInfo[] {
    const baseProperties = [...BASE_NODE_PROPERTIES];

    switch (nodeType) {
      case 'start':
        return baseProperties.concat(this.extractStartSchema());
      case 'end':
        return baseProperties.concat(this.extractEndSchema());
      case 'answer':
        return baseProperties.concat(this.extractAnswerSchema());
      case 'llm':
        return baseProperties.concat(this.extractLLMSchema());
      case 'code':
        return baseProperties.concat(this.extractCodeSchema());
      case 'agent':
        return baseProperties.concat(this.extractAgentSchema());
      case 'if-else':
        return baseProperties.concat(this.extractIfElseSchema());
      case 'variable-assignment':
        return baseProperties.concat(this.extractVariableAssignmentSchema());
      case 'loop':
        return baseProperties.concat(this.extractLoopSchema());
      case 'iteration':
        return baseProperties.concat(this.extractIterationSchema());
      case 'variable-aggregation':
        return baseProperties.concat(this.extractVariableAggregationSchema());
      case 'template-transform':
        return baseProperties.concat(this.extractTemplateTransformSchema());
      case 'http-request':
        return baseProperties.concat(this.extractHttpRequestSchema());
      case 'sub-workflow':
        return baseProperties.concat(this.extractSubWorkflowSchema());
      case 'parallel-iteration':
        return baseProperties.concat(this.extractParallelIterationSchema());
      case 'retry':
        return baseProperties.concat(this.extractRetrySchema());
      case 'fallback':
        return baseProperties.concat(this.extractFallbackSchema());
      case 'circuit-breaker':
        return baseProperties.concat(this.extractCircuitBreakerSchema());
      case 'telegram':
        return baseProperties.concat(this.extractTelegramSchema());
      default:
        return baseProperties;
    }
  }

  private extractStartSchema(): PropertyInfo[] {
    return [
      {
        name: 'variables',
        type: 'array',
        required: false,
        description: 'Variable definitions for workflow inputs',
        properties: [
          {
            name: 'variable',
            type: 'string',
            required: true,
            description: 'Variable name',
          },
          {
            name: 'type',
            type: 'string',
            required: true,
            description: 'Variable type',
            enum: ['text', 'select', 'number', 'boolean', 'object', 'array', 'text-input'],
          },
          {
            name: 'label',
            type: 'string',
            required: false,
            description: 'Human-readable label',
          },
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'Variable description',
          },
          {
            name: 'required',
            type: 'boolean',
            required: false,
            description: 'Whether variable is required',
            default: false,
          },
        ],
      },
    ];
  }

  private extractEndSchema(): PropertyInfo[] {
    return [
      {
        name: 'outputs',
        type: 'array',
        required: false,
        description: 'Output variable definitions',
        properties: [
          {
            name: 'variable',
            type: 'string',
            required: true,
            description: 'Output variable name',
          },
          {
            name: 'type',
            type: 'string',
            required: true,
            description: 'Output variable type',
            enum: ['text', 'select', 'number', 'boolean', 'object', 'array', 'text-input'],
          },
        ],
      },
    ];
  }

  private extractAnswerSchema(): PropertyInfo[] {
    return [
      {
        name: 'answer',
        type: 'string',
        required: true,
        description: 'Answer text (can contain variable references)',
      },
      {
        name: 'type',
        type: 'string',
        required: false,
        description: 'Answer format type',
        enum: ['text', 'json', 'markdown'],
        default: 'text',
      },
    ];
  }

  private extractLLMSchema(): PropertyInfo[] {
    return [
      {
        name: 'model',
        type: 'object',
        required: true,
        description: 'Model configuration',
        properties: [
          {
            name: 'provider',
            type: 'string',
            required: true,
            enum: ['openai', 'anthropic', 'google', 'local'],
            description: 'Model provider',
          },
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Model name/ID',
            examples: ['gpt-4', 'claude-3-sonnet-20240229', 'gemini-pro'],
          },
          {
            name: 'mode',
            type: 'string',
            required: true,
            enum: ['chat', 'completion'],
            default: 'chat',
            description: 'Execution mode',
          },
          {
            name: 'completion_params',
            type: 'object',
            required: false,
            description: 'Model-specific parameters',
            properties: [
              {
                name: 'temperature',
                type: 'number',
                required: false,
                minimum: 0.0,
                maximum: 2.0,
                default: 0.7,
                description: 'Controls randomness in responses',
              },
              {
                name: 'max_tokens',
                type: 'number',
                required: false,
                minimum: 1,
                description: 'Maximum tokens in response',
              },
              {
                name: 'top_p',
                type: 'number',
                required: false,
                minimum: 0.0,
                maximum: 1.0,
                description: 'Nucleus sampling parameter',
              },
              {
                name: 'frequency_penalty',
                type: 'number',
                required: false,
                minimum: -2.0,
                maximum: 2.0,
                description: 'Frequency penalty for repetition',
              },
              {
                name: 'presence_penalty',
                type: 'number',
                required: false,
                minimum: -2.0,
                maximum: 2.0,
                description: 'Presence penalty for new topics',
              },
            ],
          },
        ],
      },
      {
        name: 'prompt_template',
        type: ['object', 'array'],
        required: false,
        description: 'Prompt configuration',
        properties: [
          {
            name: 'type',
            type: 'string',
            required: false,
            enum: ['prompt'],
            description: 'Template type',
          },
          {
            name: 'source',
            type: 'string',
            required: false,
            enum: ['library', 'customized', 'built-in', 'inline', 'file'],
            description: 'Template source',
          },
          {
            name: 'content',
            type: 'string',
            required: false,
            description: 'Inline template content',
          },
          {
            name: 'template_id',
            type: 'string',
            required: false,
            description: 'Template registry ID',
          },
        ],
      },
      {
        name: 'template_parameters',
        type: 'object',
        required: false,
        description: 'Template variable substitutions',
        additionalProperties: true,
      },
    ];
  }

  private extractCodeSchema(): PropertyInfo[] {
    return [
      {
        name: 'command',
        type: 'string',
        required: true,
        description: 'Shell command to execute',
      },
      {
        name: 'args',
        type: 'array',
        required: false,
        description: 'Command arguments',
      },
      {
        name: 'working_directory',
        type: 'string',
        required: false,
        description: 'Working directory for command execution',
      },
      {
        name: 'environment_variables',
        type: 'object',
        required: false,
        description: 'Environment variables for command',
        additionalProperties: true,
      },
      {
        name: 'on_success',
        type: 'string',
        required: false,
        description: 'Target node ID for successful execution',
      },
      {
        name: 'on_failure',
        type: 'string',
        required: false,
        description: 'Target node ID for failed execution',
      },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Command timeout in seconds',
        minimum: 1,
      },
    ];
  }

  private extractAgentSchema(): PropertyInfo[] {
    return [
      {
        name: 'command',
        type: 'string',
        required: true,
        description: 'CLI tool command to execute',
      },
      {
        name: 'args',
        type: 'array',
        required: false,
        description: 'Command arguments',
      },
      {
        name: 'prompt_template',
        type: 'object',
        required: false,
        description: 'Prompt template configuration',
      },
      {
        name: 'template_parameters',
        type: 'object',
        required: false,
        description: 'Template variable substitutions',
        additionalProperties: true,
      },
      {
        name: 'working_directory',
        type: 'string',
        required: false,
        description: 'Working directory for command execution',
      },
      {
        name: 'environment_variables',
        type: 'object',
        required: false,
        description: 'Environment variables for command',
        additionalProperties: true,
      },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Command timeout in seconds',
        minimum: 1,
      },
    ];
  }

  private extractIfElseSchema(): PropertyInfo[] {
    return [
      {
        name: 'conditions',
        type: 'array',
        required: true,
        description: 'Array of conditions to evaluate',
        properties: [
          {
            name: 'variable',
            type: 'string',
            required: true,
            description: 'Variable to compare',
          },
          {
            name: 'comparison_operator',
            type: 'string',
            required: true,
            enum: [
              '==',
              '!=',
              '>',
              '<',
              '>=',
              '<=',
              'contains',
              'not_contains',
              'is_empty',
              'is_not_empty',
            ],
            description: 'Comparison operator',
          },
          {
            name: 'value',
            type: ['string', 'number', 'boolean'],
            required: false,
            description: 'Value to compare against',
          },
        ],
      },
      {
        name: 'logical_operator',
        type: 'string',
        required: false,
        enum: ['and', 'or'],
        default: 'and',
        description: 'Logical operator for multiple conditions',
      },
    ];
  }

  private extractVariableAssignmentSchema(): PropertyInfo[] {
    return [
      {
        name: 'variable',
        type: 'string',
        required: true,
        description: 'Variable name to assign',
      },
      {
        name: 'assignment_type',
        type: 'string',
        required: true,
        enum: ['constant', 'variable', 'expression'],
        description: 'Type of assignment',
      },
      {
        name: 'value',
        type: ['string', 'number', 'boolean'],
        required: false,
        description: 'Constant value (for constant assignment)',
      },
      {
        name: 'source_variable',
        type: 'string',
        required: false,
        description: 'Source variable (for variable assignment)',
      },
      {
        name: 'expression',
        type: 'string',
        required: false,
        description: 'Expression to evaluate (for expression assignment)',
      },
      {
        name: 'write_mode',
        type: 'string',
        required: false,
        enum: ['over-write', 'append', 'clear'],
        default: 'over-write',
        description: 'How to write the value',
      },
    ];
  }

  private extractLoopSchema(): PropertyInfo[] {
    return [
      {
        name: 'condition',
        type: 'object',
        required: true,
        description: 'Loop condition',
        properties: [
          {
            name: 'variable',
            type: 'string',
            required: true,
            description: 'Variable to test',
          },
          {
            name: 'comparison_operator',
            type: 'string',
            required: true,
            enum: [
              '==',
              '!=',
              '>',
              '<',
              '>=',
              '<=',
              'contains',
              'not_contains',
              'is_empty',
              'is_not_empty',
            ],
            description: 'Comparison operator',
          },
          {
            name: 'value',
            type: ['string', 'number', 'boolean'],
            required: false,
            description: 'Value to compare against',
          },
        ],
      },
      {
        name: 'max_iterations',
        type: 'number',
        required: false,
        description: 'Maximum loop iterations',
        minimum: 1,
        default: 100,
      },
      {
        name: 'break_on',
        type: 'string',
        required: false,
        enum: ['condition', 'max_iterations'],
        default: 'condition',
        description: 'When to break the loop',
      },
    ];
  }

  private extractIterationSchema(): PropertyInfo[] {
    return [
      {
        name: 'input_variable',
        type: 'string',
        required: true,
        description: 'Array/list variable to iterate over',
      },
      {
        name: 'output_variable',
        type: 'string',
        required: false,
        description: 'Variable to store iteration results',
      },
      {
        name: 'parallel',
        type: 'boolean',
        required: false,
        description: 'Whether to run iterations in parallel',
        default: false,
      },
      {
        name: 'max_parallel',
        type: 'number',
        required: false,
        description: 'Maximum parallel iterations',
        minimum: 1,
        default: 4,
      },
    ];
  }

  private extractVariableAggregationSchema(): PropertyInfo[] {
    return [
      {
        name: 'input_variables',
        type: 'array',
        required: true,
        description: 'Variables to aggregate',
      },
      {
        name: 'output_variable',
        type: 'string',
        required: true,
        description: 'Output variable for aggregation result',
      },
      {
        name: 'aggregation_method',
        type: 'string',
        required: true,
        enum: ['concat', 'sum', 'avg', 'merge', 'collect'],
        description: 'Aggregation method',
      },
      {
        name: 'separator',
        type: 'string',
        required: false,
        description: 'Separator for concat method',
        default: ' ',
      },
    ];
  }

  private extractTemplateTransformSchema(): PropertyInfo[] {
    return [
      {
        name: 'template',
        type: 'object',
        required: true,
        description: 'Template configuration',
        properties: [
          {
            name: 'type',
            type: 'string',
            required: true,
            enum: ['prompt'],
            description: 'Template type',
          },
          {
            name: 'source',
            type: 'string',
            required: true,
            enum: ['library', 'customized', 'built-in', 'inline', 'file'],
            description: 'Template source',
          },
          {
            name: 'content',
            type: 'string',
            required: false,
            description: 'Inline template content',
          },
          {
            name: 'template_id',
            type: 'string',
            required: false,
            description: 'Template registry ID',
          },
        ],
      },
      {
        name: 'template_parameters',
        type: 'object',
        required: true,
        description: 'Template variable substitutions',
        additionalProperties: true,
      },
      {
        name: 'output_variable',
        type: 'string',
        required: true,
        description: 'Variable to store transformed result',
      },
    ];
  }

  private extractHttpRequestSchema(): PropertyInfo[] {
    return [
      {
        name: 'url',
        type: 'string',
        required: true,
        description: 'HTTP request URL',
      },
      {
        name: 'method',
        type: 'string',
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method',
      },
      {
        name: 'headers',
        type: 'string',
        required: false,
        description: 'Multi-line string with header: value pairs',
      },
      {
        name: 'body',
        type: 'string',
        required: false,
        description: 'Request body',
      },
      {
        name: 'body_type',
        type: 'string',
        required: false,
        enum: ['json', 'form', 'xml', 'text'],
        default: 'json',
        description: 'Request body type',
      },
      {
        name: 'auth_type',
        type: 'string',
        required: false,
        enum: ['none', 'bearer', 'basic', 'api_key'],
        default: 'none',
        description: 'Authentication type',
      },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Request timeout in seconds',
        minimum: 1,
        default: 30,
      },
      {
        name: 'retries',
        type: 'number',
        required: false,
        description: 'Number of retry attempts',
        minimum: 0,
        default: 3,
      },
      {
        name: 'error_handling',
        type: 'string',
        required: false,
        enum: ['fail', 'ignore', 'continue'],
        default: 'fail',
        description: 'How to handle request errors',
      },
    ];
  }

  private extractSubWorkflowSchema(): PropertyInfo[] {
    return [
      {
        name: 'workflow_file',
        type: 'string',
        required: true,
        description: 'Path to sub-workflow YAML file',
      },
      {
        name: 'input_mappings',
        type: 'string',
        required: false,
        description: 'Multi-line string with input_name=variable_source pairs',
      },
      {
        name: 'output_mappings',
        type: 'string',
        required: false,
        description: 'Multi-line string with output_name=parent_variable pairs',
      },
    ];
  }

  private extractParallelIterationSchema(): PropertyInfo[] {
    return [
      {
        name: 'input_variable',
        type: 'string',
        required: true,
        description: 'Array/list variable to iterate over',
      },
      {
        name: 'output_variable',
        type: 'string',
        required: false,
        description: 'Variable to store iteration results',
      },
      {
        name: 'max_parallel',
        type: 'number',
        required: false,
        description: 'Maximum concurrent executions',
        minimum: 1,
        default: 4,
      },
      {
        name: 'chunk_size',
        type: 'number',
        required: false,
        description: 'Process items in chunks (optimization)',
        minimum: 1,
      },
      {
        name: 'progress_tracking',
        type: 'boolean',
        required: false,
        description: 'Enable progress reporting',
        default: true,
      },
      {
        name: 'error_handling',
        type: 'string',
        required: false,
        enum: ['fail', 'ignore', 'continue'],
        default: 'fail',
        description: 'How to handle individual item failures',
      },
    ];
  }

  private extractRetrySchema(): PropertyInfo[] {
    return [
      {
        name: 'max_attempts',
        type: 'number',
        required: false,
        description: 'Maximum retry attempts',
        minimum: 1,
        default: 3,
      },
      {
        name: 'retry_delay',
        type: 'number',
        required: false,
        description: 'Base delay between retries in seconds',
        minimum: 0,
        default: 2,
      },
      {
        name: 'backoff_multiplier',
        type: 'number',
        required: false,
        description: 'Exponential backoff multiplier',
        minimum: 1.0,
        default: 1.5,
      },
      {
        name: 'retry_condition',
        type: 'string',
        required: false,
        enum: ['any_failure', 'timeout_only', 'network_only'],
        default: 'any_failure',
        description: 'When to retry',
      },
      {
        name: 'timeout',
        type: 'number',
        required: false,
        description: 'Overall timeout for the retry operation',
        minimum: 1,
      },
    ];
  }

  private extractFallbackSchema(): PropertyInfo[] {
    return [
      {
        name: 'strategy',
        type: 'string',
        required: false,
        enum: ['sequential', 'parallel'],
        default: 'sequential',
        description: 'Fallback execution strategy',
      },
      {
        name: 'fallback_paths',
        type: 'array',
        required: true,
        description: 'Array of fallback node IDs or workflow paths',
      },
      {
        name: 'max_fallback_time',
        type: 'number',
        required: false,
        description: 'Maximum time to spend on fallbacks',
        minimum: 1,
      },
      {
        name: 'continue_on_success',
        type: 'boolean',
        required: false,
        description: 'Whether to continue after first successful fallback',
        default: false,
      },
    ];
  }

  private extractCircuitBreakerSchema(): PropertyInfo[] {
    return [
      {
        name: 'failure_threshold',
        type: 'number',
        required: false,
        description: 'Number of failures before opening circuit',
        minimum: 1,
        default: 5,
      },
      {
        name: 'timeout_duration',
        type: 'number',
        required: false,
        description: 'How long circuit stays open in seconds',
        minimum: 1,
        default: 60,
      },
      {
        name: 'success_threshold',
        type: 'number',
        required: false,
        description: 'Successes needed to close circuit',
        minimum: 1,
        default: 3,
      },
      {
        name: 'monitor_window',
        type: 'number',
        required: false,
        description: 'Time window for failure counting in seconds',
        minimum: 1,
        default: 300,
      },
    ];
  }

  private extractTelegramSchema(): PropertyInfo[] {
    return [
      {
        name: 'message',
        type: 'string',
        required: true,
        description: 'Message content to send',
      },
      {
        name: 'chat_id',
        type: 'string',
        required: false,
        description: 'Telegram chat ID (can use TELEGRAM_CHAT_ID env var)',
      },
      {
        name: 'bot_token',
        type: 'string',
        required: false,
        description: 'Telegram bot token (can use TELEGRAM_BOT_TOKEN env var)',
      },
      {
        name: 'parse_mode',
        type: 'string',
        required: false,
        enum: ['HTML', 'Markdown', 'MarkdownV2'],
        default: 'HTML',
        description: 'Message parse mode',
      },
      {
        name: 'max_retries',
        type: 'number',
        required: false,
        description: 'Maximum retry attempts',
        minimum: 0,
        default: 3,
      },
      {
        name: 'disable_notification',
        type: 'boolean',
        required: false,
        description: 'Disable notification for this message',
        default: false,
      },
      {
        name: 'reply_to_message_id',
        type: 'number',
        required: false,
        description: 'ID of message to reply to',
        minimum: 1,
      },
      {
        name: 'error_handling',
        type: 'string',
        required: false,
        enum: ['fail', 'ignore', 'continue'],
        default: 'fail',
        description: 'How to handle send errors',
      },
    ];
  }
}
