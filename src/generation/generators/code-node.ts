/**
 * Code Node Generator
 *
 * Generates shell script code for code execution nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class CodeNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'code';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const command = this.getNodeData(node, 'command', 'echo "No command specified"');

    // Process template variables with sanitization
    const processedCommand = this.processTemplateVariables(String(command));

    return processedCommand;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // Code-specific validation
    const command = this.getNodeData(node, 'command', '');
    if (!command || String(command).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_CODE_COMMAND',
        message: 'Code node must have a command',
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
