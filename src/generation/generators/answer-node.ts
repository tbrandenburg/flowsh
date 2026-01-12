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
        // Use smart escaping that preserves get_var calls and shell variable references
        const escapedLine = this.escapeForEcho(line);
        return `echo "${escapedLine}"`;
      });
      return echoCommands.join('\n');
    }

    // For single-line content, use echo with proper escaping
    const escapedAnswer = this.escapeForEcho(processedAnswer);
    return `echo "${escapedAnswer}"`;
  }

  /**
   * Smart escaping for echo statements that preserves flowsh template variables
   * Avoids double-escaping get_var calls while still protecting against shell injection
   */
  private escapeForEcho(text: string): string {
    // Split the text around get_var calls and shell variable references
    const parts = text.split(/(get_var "[^"]*" "[^"]*"|\$\([^)]*\)|\$\{[^}]*\})/);

    return parts
      .map((part, index) => {
        // Even indices are regular text, odd indices are special patterns
        if (index % 2 === 0) {
          // Regular text - escape quotes, backticks, and backslashes but preserve newlines
          return part
            .replace(/\\/g, '\\\\') // Escape backslashes first
            .replace(/"/g, '\\"') // Escape double quotes
            .replace(/`/g, '\\`'); // Escape backticks
        } else {
          // get_var calls or shell expansions - don't escape the internal structure
          return part;
        }
      })
      .join('');
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
