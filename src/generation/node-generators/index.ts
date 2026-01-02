/**
 * Node Generator Registry
 *
 * Exports all node generators and provides a registry for dynamic node type handling.
 */

export { StartNodeGenerator } from './start-node.js';
export { AgentNodeGenerator } from './agent-node.js';
export { LLMNodeGenerator } from './llm-node.js';
export { CodeNodeGenerator } from './code-node.js';
export { AnswerNodeGenerator } from './answer-node.js';
export { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';
export { IfElseNodeGenerator } from './if-else-node.js';
export {
  NodeGenerator,
  ValidationResult,
  GenerationContext,
  GenerationOptions,
} from './base-generator.js';

import { WorkflowNode } from '../../dsl/types.js';
import { StartNodeGenerator } from './start-node.js';
import { AgentNodeGenerator } from './agent-node.js';
import { LLMNodeGenerator } from './llm-node.js';
import { CodeNodeGenerator } from './code-node.js';
import { AnswerNodeGenerator } from './answer-node.js';
import { VariableAssignmentNodeGenerator } from './variable-assignment-node.js';
import { IfElseNodeGenerator } from './if-else-node.js';
import { NodeGenerator } from './base-generator.js';

/**
 * Registry of all available node generators
 */
export const NODE_GENERATORS = {
  start: new StartNodeGenerator(),
  agent: new AgentNodeGenerator(),
  llm: new LLMNodeGenerator(),
  code: new CodeNodeGenerator(),
  answer: new AnswerNodeGenerator(),
  'variable-assignment': new VariableAssignmentNodeGenerator(),
  'if-else': new IfElseNodeGenerator(),
} as const;

/**
 * Get the appropriate generator for a node type
 */
export function getGeneratorForNode(node: WorkflowNode): NodeGenerator | null {
  const nodeType = node.type;

  switch (nodeType) {
    case 'start':
      return NODE_GENERATORS.start;
    case 'agent':
      return NODE_GENERATORS.agent;
    case 'llm':
      return NODE_GENERATORS.llm;
    case 'code':
      return NODE_GENERATORS.code;
    case 'answer':
      return NODE_GENERATORS.answer;
    case 'variable-assignment':
      return NODE_GENERATORS['variable-assignment'];
    case 'if-else':
      return NODE_GENERATORS['if-else'];
    default:
      return null;
  }
}

/**
 * Generate shell function for any supported node type
 */
export function generateNodeFunction(node: WorkflowNode, functionName: string): string {
  const generator = getGeneratorForNode(node);

  if (!generator) {
    throw new Error(`No generator available for node type: ${node.type}`);
  }

  return generator.generateShell(node, functionName);
}
