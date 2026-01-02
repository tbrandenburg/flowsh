/**
 * Answer Node Generator
 *
 * Generates shell functions for Answer nodes that provide final workflow output.
 * Handles variable substitution and workflow completion signaling.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator, ValidationResult } from './base-generator.js';

export class AnswerNodeGenerator implements NodeGenerator {
  /**
   * Validates an Answer node configuration
   */
  validateNode(node: WorkflowNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const data = node.data as any;

    // Check for answer content
    if (!data.answer) {
      warnings.push(
        `Answer node ${node.id}: No answer text specified, will use default 'Workflow completed'`
      );
    }

    // Validate answer is a string if present
    if (data.answer && typeof data.answer !== 'string') {
      errors.push(`Answer node ${node.id}: answer must be a string`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates shell function for an Answer node
   */
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;

    return `# Execute answer node: ${node.id}
${functionName}() {
    log_step "📤 Providing Answer: ${data.title || node.id}"
    
    local answer_text="${data.answer || 'Workflow completed'}"
    local final_answer
    final_answer=\$(substitute_variables "\$answer_text")
    
    echo "=========================="
    echo "WORKFLOW RESULT"
    echo "=========================="
    echo "\$final_answer"
    echo "=========================="
    
    log_success "Workflow completed successfully"
    set_workflow_state "current_node" "${node.id}"
    set_workflow_state "completed" "true"
}`;
  }
}
