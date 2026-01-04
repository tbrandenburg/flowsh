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
    return `echo "${processedAnswer}"`;
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
