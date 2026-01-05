/**
 * Start Node Generator
 *
 * Generates shell script code for workflow start nodes
 */

import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class StartNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'start';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const title = this.getNodeData(node, 'title', 'Start');
    const variables = this.getNodeData(node, 'variables', []) as Array<{
      variable: string;
      default?: any;
    }>;

    let result = `# Starting workflow node: ${node.id} (${String(title)})`;

    // Generate set_var calls for each variable with its default value
    if (Array.isArray(variables)) {
      variables.forEach(varDef => {
        const varName = this.sanitizeVariableName(String(varDef.variable)).toUpperCase();
        const defaultValue = varDef.default ? String(varDef.default) : '';
        result += `\nset_var "${varName}" "${this.escapeShellValue(defaultValue)}" "${node.id}"`;
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    // Start nodes might define initial variables
    const variables = this.getNodeData(node, 'variables', []) as Array<{ variable: string }>;
    if (Array.isArray(variables)) {
      return variables.map(v => this.sanitizeVariableName(String(v.variable)).toUpperCase());
    }
    return [];
  }
}
