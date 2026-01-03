/**
 * If-Else Node Generator
 *
 * Generates shell script code for conditional logic nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class IfElseNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'if-else';

  generate(node: WorkflowNode, _context: GenerationContext): string {
    const condition = this.getNodeData(node, 'condition', 'true');
    const thenAction = this.getNodeData(node, 'then', 'echo "Condition passed"');
    const elseAction = this.getNodeData(node, 'else', 'echo "Condition failed"');

    // Process template variables in all parts
    const processedCondition = this.processTemplateVariables(String(condition));
    const processedThen = this.processTemplateVariables(String(thenAction));
    const processedElse = this.processTemplateVariables(String(elseAction));

    return `if ${processedCondition}; then
  ${processedThen}
else
  ${processedElse}
fi`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // If-else specific validation
    const condition = this.getNodeData(node, 'condition', '');
    if (!condition || String(condition).trim() === '') {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_IF_CONDITION',
        message: 'If-else node should specify a condition (defaulting to "true")',
        nodeId: node.id,
      });
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const variables: string[] = [];

    const condition = this.getNodeData(node, 'condition', '');
    const thenAction = this.getNodeData(node, 'then', '');
    const elseAction = this.getNodeData(node, 'else', '');

    variables.push(...this.extractTemplateVariables(String(condition)));
    variables.push(...this.extractTemplateVariables(String(thenAction)));
    variables.push(...this.extractTemplateVariables(String(elseAction)));

    // Remove duplicates
    return [...new Set(variables)];
  }
}
