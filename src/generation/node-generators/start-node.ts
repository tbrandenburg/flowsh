/**
 * Start Node Generator
 *
 * Generates shell functions for workflow start nodes.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator } from './base-generator.js';

export class StartNodeGenerator implements NodeGenerator {
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;

    return `# Execute start node: ${node.id}
${functionName}() {
    log_step "🚀 Starting Workflow: ${data.title || node.id}"
    
    # Initialize workflow state
    set_workflow_state "current_node" "${node.id}"
    set_workflow_state "status" "running"
    set_workflow_state "start_time" "\$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    # Set initial variables from node data
    ${this.generateInitialVariables(data)}
    
    log_info "Workflow started successfully"
}`;
  }

  private generateInitialVariables(data: any): string {
    if (!data.variables || typeof data.variables !== 'object') {
      return '# No initial variables defined';
    }

    const variableAssignments = Object.entries(data.variables)
      .map(([key, value]) => {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        const sanitizedValue =
          typeof value === 'string' ? value.replace(/"/g, '\\"') : String(value);
        return `    set_workflow_var "${sanitizedKey}" "${sanitizedValue}"`;
      })
      .join('\n');

    return variableAssignments || '# No valid variables to initialize';
  }
}
