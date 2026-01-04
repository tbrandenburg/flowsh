/**
 * Agent Node Generator
 *
 * Generates shell script code for agent orchestration nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class AgentNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'agent';

  generate(node: WorkflowNode, context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo "No command"');

    if (context.options.includeMocks) {
      return `echo "Mock agent: ${String(command)}"`;
    }

    // Process template variables and return simple agent execution
    return this.processTemplateVariables(String(command), node.id);
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // Agent-specific validation
    const command = this.getNodeData(node, 'command', '');
    if (!command || String(command).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_AGENT_COMMAND',
        message: 'Agent node must have a command',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const command = this.getNodeData(node, 'command', '');
    return this.extractTemplateVariables(String(command));
  }
}
