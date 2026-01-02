/**
 * Agent Node Generator
 *
 * Generates shell functions for agent execution nodes.
 */

import { WorkflowNode } from '../../dsl/types.js';
import { NodeGenerator } from './base-generator.js';

export class AgentNodeGenerator implements NodeGenerator {
  generateShell(node: WorkflowNode, functionName: string): string {
    const data = node.data as any;
    const agentName = data.agent?.name || 'default-agent';
    const command = data.agent?.command || agentName;
    const args = data.agent?.arguments || [];
    const timeout = data.agent?.timeout || 300;

    return `# Execute agent node: ${node.id}
${functionName}() {
    log_step "🤖 Running Agent: ${data.title || agentName}"
    
    local agent_command="${command}"
    local agent_args=(${args.map((arg: string) => `"${arg}"`).join(' ')})
    local agent_timeout=${timeout}
    
    ${this.generateInputPreparation(data)}
    
    # Execute agent with timeout
    local agent_exit_code=0
    if [[ "\$USE_MOCK_TOOLS" == "true" ]]; then
        ${this.generateMockExecution(agentName)}
    else
        ${this.generateRealExecution()}
    fi
    
    # Handle agent result
    if [[ \$agent_exit_code -eq 0 ]]; then
        log_info "Agent '\$agent_command' completed successfully"
        ${this.generateSuccessHandling(data)}
    else
        log_error "Agent '\$agent_command' failed with exit code \$agent_exit_code"
        return \$agent_exit_code
    fi
    
    set_workflow_state "current_node" "${node.id}"
}`;
  }

  private generateInputPreparation(data: any): string {
    if (!data.inputs || Object.keys(data.inputs).length === 0) {
      return '# No inputs to prepare';
    }

    const inputPrep = Object.entries(data.inputs)
      .map(([key, value]) => {
        const varValue =
          typeof value === 'string' && value.startsWith('${')
            ? `\$(get_workflow_var "${value.slice(2, -1)}" "")`
            : `"${value}"`;
        return `    export ${key.toUpperCase()}=${varValue}`;
      })
      .join('\n');

    return `# Prepare agent inputs\n${inputPrep}`;
  }

  private generateMockExecution(agentName: string): string {
    return `log_debug "Using mock agent execution"
        local mock_output="Mock output from ${agentName}"
        local mock_result="Mock result: success"
        
        echo "\$mock_output"
        set_workflow_var "agent_output" "\$mock_output"
        set_workflow_var "agent_result" "\$mock_result"
        agent_exit_code=0`;
  }

  private generateRealExecution(): string {
    return `log_debug "Executing agent: \$agent_command with args: \${agent_args[*]}"
        
        # Execute with timeout
        local output
        if output=\$(timeout "\$agent_timeout" "\$agent_command" "\${agent_args[@]}" 2>&1); then
            agent_exit_code=0
        else
            agent_exit_code=\$?
        fi
        
        # Store output
        set_workflow_var "agent_output" "\$output"
        
        # Log output (truncated for readability)
        if [[ \${#output} -gt 200 ]]; then
            log_debug "Agent output (truncated): \${output:0:200}..."
        else
            log_debug "Agent output: \$output"
        fi`;
  }

  private generateSuccessHandling(data: any): string {
    const outputs = data.outputs || {};

    if (Object.keys(outputs).length === 0) {
      return '# No outputs to process';
    }

    const outputProcessing = Object.entries(outputs)
      .map(([key, mapping]: [string, any]) => {
        if (typeof mapping === 'string') {
          return `        set_workflow_var "${key}" "\$(get_workflow_var "${mapping}" "")"`;
        } else if (mapping?.source === 'agent_output') {
          return `        set_workflow_var "${key}" "\$output"`;
        } else {
          return `        set_workflow_var "${key}" "${mapping?.default || ''}"`;
        }
      })
      .join('\n');

    return `# Process agent outputs\n${outputProcessing}`;
  }
}
