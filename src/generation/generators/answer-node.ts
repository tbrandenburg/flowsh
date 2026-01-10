/**
 * Answer/End Node Generator
 *
 * Generates shell script code for workflow end/answer nodes
 */

import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class AnswerNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'answer';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const answer = this.getNodeData(node, 'answer', 'Workflow completed');
    const processedAnswer = this.processTemplateVariables(String(answer), node.id);

    // For multiline content, split into lines and echo each one
    if (processedAnswer.includes('\n')) {
      const lines = processedAnswer.split('\n');
      const echoCommands = lines.map(line => {
        const escapedLine = line.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\\/g, '\\\\');
        return `echo "${escapedLine}"`;
      });
      return echoCommands.join('\n');
    }

    // For single-line content, use echo with proper escaping
    const escapedAnswer = processedAnswer.replace(/"/g, '\\"').replace(/`/g, '\\`');
    return `echo "${escapedAnswer}"`;
  }

  getVariables(node: WorkflowNode): string[] {
    const answer = this.getNodeData(node, 'answer', '');
    return this.extractTemplateVariables(String(answer));
  }
}

export class EndNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'end';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const title = this.getNodeData(node, 'title', 'End');
    return `# Ending workflow node: ${node.id} (${String(title)})`;
  }
}
