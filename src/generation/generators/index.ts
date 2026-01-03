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

// Re-export registry types for convenience
export type { NodeGenerator, GenerationContext, GenerationOptions } from '../registry/types.js';
export { NodeGeneratorRegistry, defaultRegistry } from '../registry/node-generator-registry.js';

// Import generators for registration functions
import { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';
import { NodeGeneratorRegistry } from '../registry/node-generator-registry.js';
import { AnswerNodeGenerator, EndNodeGenerator } from './answer-node.js';
import { IfElseNodeGenerator } from './if-else-node.js';
import { StartNodeGenerator } from './start-node.js';
import { AgentNodeGenerator } from './agent-node.js';
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
}

/**
 * Get a registry pre-loaded with all default generators
 */
export function createDefaultRegistry(): NodeGeneratorRegistry {
  const registry = new NodeGeneratorRegistry();
  registerDefaultGenerators(registry);
  return registry;
}
