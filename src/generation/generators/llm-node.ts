/**
 * LLM Node Generator
 *
 * Generates shell script code for LLM integration nodes
 */

import { ValidationResult } from '../../dsl/validation.js';
import { GenerationContext } from '../registry/types.js';
import { BaseNodeGenerator } from './base-generator.js';
import { WorkflowNode } from '../../dsl/types.js';

export class LLMNodeGenerator extends BaseNodeGenerator {
  readonly nodeType = 'llm';

  generate(node: WorkflowNode, context: GenerationContext): string {
    const model = this.getNodeData(node, 'model', 'gpt-4');
    const prompt = this.getNodeData(node, 'prompt', 'Hello');

    if (context.options.includeMocks) {
      return `echo "Mock LLM Response for: ${String(prompt)}"`;
    }

    // Generate curl-based LLM call
    const processedPrompt = this.processTemplateVariables(String(prompt));

    return `curl -s -X POST "https://api.openai.com/v1/chat/completions" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${String(model)}", "messages": [{"role": "user", "content": "${processedPrompt}"}]}'`;
  }

  override validate(node: WorkflowNode): ValidationResult {
    const result = super.validate(node);

    // LLM-specific validation
    const model = this.getNodeData(node, 'model', '');
    if (!model || String(model).trim() === '') {
      result.warnings.push({
        type: 'warning',
        code: 'MISSING_LLM_MODEL',
        message: 'LLM node should specify a model (defaulting to gpt-4)',
        nodeId: node.id,
      });
    }

    const prompt = this.getNodeData(node, 'prompt', '');
    if (!prompt || String(prompt).trim() === '') {
      result.errors.push({
        type: 'error',
        code: 'MISSING_LLM_PROMPT',
        message: 'LLM node must have a prompt',
        nodeId: node.id,
      });
      result.valid = false;
    }

    return result;
  }

  getVariables(node: WorkflowNode): string[] {
    const prompt = this.getNodeData(node, 'prompt', '');
    return this.extractTemplateVariables(String(prompt));
  }
}
