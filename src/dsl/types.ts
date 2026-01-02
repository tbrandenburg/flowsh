/**
 * Core DSL Type Definitions for flowsh Workflows
 *
 * This module defines the complete type system for flowsh workflow YAML files,
 * ensuring type safety throughout the parsing and generation process.
 */

// =============================================================================
// Base Types and Utilities
// =============================================================================

export type NodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'if-else'
  | 'variable-assignment'
  | 'code'
  | 'agent'
  | 'loop'
  | 'iteration'
  | 'variable-aggregation'
  | 'template-transform'
  | 'answer';

export type VariableType =
  | 'text'
  | 'select'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'text-input';

export type TemplateSource = 'library' | 'customized' | 'built-in' | 'inline';

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'local';

// =============================================================================
// Variable Definitions
// =============================================================================

export interface BaseVariable {
  variable: string;
  type: VariableType;
  label?: string;
  description?: string;
  required?: boolean;
}

export interface TextVariable extends BaseVariable {
  type: 'text' | 'text-input';
  default?: string;
  max_length?: number;
}

export interface SelectVariable extends BaseVariable {
  type: 'select';
  options: string[];
  default?: string;
}

export interface NumberVariable extends BaseVariable {
  type: 'number';
  default?: number;
  min?: number;
  max?: number;
}

export interface BooleanVariable extends BaseVariable {
  type: 'boolean';
  default?: boolean;
}

export interface ObjectVariable extends BaseVariable {
  type: 'object';
  properties?: Record<string, BaseVariable>;
}

export interface ArrayVariable extends BaseVariable {
  type: 'array';
  items?: BaseVariable;
}

export type Variable =
  | TextVariable
  | SelectVariable
  | NumberVariable
  | BooleanVariable
  | ObjectVariable
  | ArrayVariable;

// =============================================================================
// Template System
// =============================================================================

export interface PromptTemplate {
  type: 'prompt';
  source: TemplateSource;
  template_id?: string;
  version?: string;
  content?: string; // For inline templates
}

export interface TemplateParameters {
  [key: string]: string | number | boolean | undefined;
}

export interface TemplateDependency {
  template_id: string;
  type: 'prompt';
  source: TemplateSource;
  version?: string;
}

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

// =============================================================================
// Model Configuration
// =============================================================================

export interface ModelCompletionParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
}

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
  mode: 'chat' | 'completion';
  completion_params?: ModelCompletionParams;
}

// =============================================================================
// Node Data Interfaces
// =============================================================================

export interface BaseNodeData {
  title?: string;
  desc?: string;
  description?: string;
}

export interface StartNodeData extends BaseNodeData {
  variables?: Variable[];
}

export interface EndNodeData extends BaseNodeData {
  outputs?: Variable[];
}

export interface LLMNodeData extends BaseNodeData {
  model: ModelConfig;
  prompt_template?: PromptTemplate | PromptMessage[];
  template_parameters?: TemplateParameters;
  advanced_prompt_config?: {
    app_mode?: string;
    model_mode?: string;
    pre_prompt?: string;
    prompt_type?: string;
    chat_prompt_config?: Record<string, unknown>;
    completion_prompt_config?: Record<string, unknown>;
  };
  context?: {
    enabled?: boolean;
    variable?: string;
  };
  vision?: {
    enabled?: boolean;
    configs?: {
      detail?: 'low' | 'high' | 'auto';
    };
  };
  memory?: {
    role_prefix?: {
      user?: string;
      assistant?: string;
    };
    query_prompt_template?: string;
    window?: {
      enabled?: boolean;
      size?: number;
    };
  };
}

export interface IfElseCondition {
  variable: string;
  comparison_operator:
    | '=='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'contains'
    | 'not_contains'
    | 'is_empty'
    | 'is_not_empty';
  value?: string | number | boolean;
}

export interface IfElseNodeData extends BaseNodeData {
  conditions: IfElseCondition[];
  logical_operator?: 'and' | 'or';
}

export interface VariableAssignmentNodeData extends BaseNodeData {
  variable: string;
  assignment_type: 'constant' | 'variable' | 'expression';
  value?: string | number | boolean;
  source_variable?: string;
  expression?: string;
  write_mode?: 'over-write' | 'append' | 'clear';
}

export interface CodeNodeData extends BaseNodeData {
  command: string;
  args?: string[];
  working_directory?: string;
  environment_variables?: Record<string, string>;
  on_success?: string; // Target node ID
  on_failure?: string; // Target node ID
  timeout?: number;
}

export interface AgentNodeData extends BaseNodeData {
  command: string;
  args?: string[];
  prompt_template?: PromptTemplate;
  template_parameters?: TemplateParameters;
  working_directory?: string;
  environment_variables?: Record<string, string>;
  timeout?: number;
}

export interface LoopNodeData extends BaseNodeData {
  condition: IfElseCondition;
  max_iterations?: number;
  break_on?: 'condition' | 'max_iterations';
}

export interface IterationNodeData extends BaseNodeData {
  input_variable: string;
  output_variable?: string;
  parallel?: boolean;
  max_parallel?: number;
}

export interface VariableAggregationNodeData extends BaseNodeData {
  input_variables: string[];
  output_variable: string;
  aggregation_method: 'concat' | 'sum' | 'avg' | 'merge' | 'collect';
  separator?: string; // For concat method
}

export interface TemplateTransformNodeData extends BaseNodeData {
  template: PromptTemplate;
  template_parameters: TemplateParameters;
  output_variable: string;
}

export interface AnswerNodeData extends BaseNodeData {
  answer: string; // Can contain variable references
  type?: 'text' | 'json' | 'markdown';
}

// =============================================================================
// Node Interface
// =============================================================================

export type NodeData =
  | StartNodeData
  | EndNodeData
  | LLMNodeData
  | IfElseNodeData
  | VariableAssignmentNodeData
  | CodeNodeData
  | AgentNodeData
  | LoopNodeData
  | IterationNodeData
  | VariableAggregationNodeData
  | TemplateTransformNodeData
  | AnswerNodeData;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: NodeData;
}

// =============================================================================
// Edge Interface
// =============================================================================

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string; // For conditional edges (if-else nodes)
  label?: string;
}

// =============================================================================
// Workflow Interface
// =============================================================================

export interface WorkflowMetadata {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  created_by?: string;
  updated_by?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowEnvironmentVariable {
  variable: string;
  name: string;
  type: VariableType;
  description?: string;
  options?: string[];
}

export interface WorkflowConversationVariable {
  variable: string;
  name: string;
  type: VariableType;
  description?: string;
}

export interface WorkflowSpec {
  template_dependencies?: TemplateDependency[];
  environment_variables?: WorkflowEnvironmentVariable[];
  conversation_variables?: WorkflowConversationVariable[];
  graph: WorkflowGraph;
}

export interface FlowshWorkflow {
  version?: string;
  kind?: string;
  metadata?: WorkflowMetadata;
  workflow?: {
    name: string;
    description?: string;
    version?: string;
    template_dependencies?: TemplateDependency[];
  };
  environment_variables?: WorkflowEnvironmentVariable[];
  conversation_variables?: WorkflowConversationVariable[];
  graph?: WorkflowGraph;
  spec?: WorkflowSpec;
}

// =============================================================================
// Utility Types for Type Guards
// =============================================================================

export function isStartNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'start'; data: StartNodeData } {
  return node.type === 'start';
}

export function isEndNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'end'; data: EndNodeData } {
  return node.type === 'end';
}

export function isLLMNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'llm'; data: LLMNodeData } {
  return node.type === 'llm';
}

export function isIfElseNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'if-else'; data: IfElseNodeData } {
  return node.type === 'if-else';
}

export function isCodeNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'code'; data: CodeNodeData } {
  return node.type === 'code';
}

export function isAgentNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'agent'; data: AgentNodeData } {
  return node.type === 'agent';
}

export function isVariableAssignmentNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'variable-assignment'; data: VariableAssignmentNodeData } {
  return node.type === 'variable-assignment';
}

export function isLoopNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'loop'; data: LoopNodeData } {
  return node.type === 'loop';
}

export function isIterationNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'iteration'; data: IterationNodeData } {
  return node.type === 'iteration';
}

export function isVariableAggregationNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'variable-aggregation'; data: VariableAggregationNodeData } {
  return node.type === 'variable-aggregation';
}

export function isTemplateTransformNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'template-transform'; data: TemplateTransformNodeData } {
  return node.type === 'template-transform';
}

export function isAnswerNode(
  node: WorkflowNode
): node is WorkflowNode & { type: 'answer'; data: AnswerNodeData } {
  return node.type === 'answer';
}
