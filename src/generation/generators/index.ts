/**
 * Node Generators Index
 *
 * Exports all available node generators and provides registration helpers
 */

export { BaseNodeGenerator } from './base-generator.js';
export { CodeNodeGenerator } from './code-node.js';
export { AgentNodeGenerator } from './agent-node.js';
export { LLMNodeGenerator } from './llm-node.js';
export { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';
export { IfElseNodeGenerator } from './if-else-node.js';
export { StartNodeGenerator } from './start-node.js';
export { AnswerNodeGenerator, EndNodeGenerator } from './answer-node.js';
export { LoopNodeGenerator } from './loop-node.js';
export { IterationNodeGenerator } from './iteration-node.js';
export { VariableAggregationNodeGenerator } from './variable-aggregation-node.js';
export { TemplateTransformNodeGenerator } from './template-transform-node.js';
export { HttpRequestNodeGenerator } from './http-request-node.js';
export { SubWorkflowNodeGenerator } from './sub-workflow-node.js';

// Re-export registry types for convenience
export type { NodeGenerator, GenerationContext, GenerationOptions } from '../registry/types.js';
export { NodeGeneratorRegistry, defaultRegistry } from '../registry/node-generator-registry.js';

// Import generators for registration functions
import { VariableAggregationNodeGenerator } from './variable-aggregation-node.js';
import { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';
import { NodeGeneratorRegistry } from '../registry/node-generator-registry.js';
import { TemplateTransformNodeGenerator } from './template-transform-node.js';
import { AnswerNodeGenerator, EndNodeGenerator } from './answer-node.js';
import { SubWorkflowNodeGenerator } from './sub-workflow-node.js';
import { HttpRequestNodeGenerator } from './http-request-node.js';
import { IterationNodeGenerator } from './iteration-node.js';
import { IfElseNodeGenerator } from './if-else-node.js';
import { StartNodeGenerator } from './start-node.js';
import { AgentNodeGenerator } from './agent-node.js';
import { LoopNodeGenerator } from './loop-node.js';
import { CodeNodeGenerator } from './code-node.js';
import { LLMNodeGenerator } from './llm-node.js';

/**
 * Register all default node generators with the provided registry
 * @param registry - The registry to register generators with
 */
export function registerDefaultGenerators(registry: NodeGeneratorRegistry): void {
  registry.register(new StartNodeGenerator());
  registry.register(new EndNodeGenerator());
  registry.register(new AnswerNodeGenerator());
  registry.register(new CodeNodeGenerator());
  registry.register(new AgentNodeGenerator());
  registry.register(new LLMNodeGenerator());
  registry.register(new VariableAssignmentNodeGenerator());
  registry.register(new IfElseNodeGenerator());
  registry.register(new LoopNodeGenerator());
  registry.register(new IterationNodeGenerator());
  registry.register(new VariableAggregationNodeGenerator());
  registry.register(new TemplateTransformNodeGenerator());
  registry.register(new HttpRequestNodeGenerator());
  registry.register(new SubWorkflowNodeGenerator());
}

/**
 * Get a registry pre-loaded with all default generators
 */
export function createDefaultRegistry(): NodeGeneratorRegistry {
  const registry = new NodeGeneratorRegistry();
  registerDefaultGenerators(registry);
  return registry;
}
