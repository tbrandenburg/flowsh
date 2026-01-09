/**
 * Tests for Agent Node Generator
 */

import type { WorkflowNode, AgentNodeData } from '../../dsl/types.js';
import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentNodeGenerator } from './agent-node.js';

describe('AgentNodeGenerator', () => {
  let generator: AgentNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new AgentNodeGenerator();
    mockContext = {
      options: { verbose: false, shell: 'bash' },
      variables: new Map(),
      nodeCount: 5,
      currentNodeIndex: 1,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('agent');
    });
  });

  describe('generate', () => {
    it('should generate basic agent execution', () => {
      const node: WorkflowNode = {
        id: 'simple_agent',
        type: 'agent',
        data: {
          command: 'echo',
          args: ['hello', 'world'],
          title: 'Simple Agent',
        } as AgentNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_agent_simple_agent()');
      expect(result).toContain('log_step "🤖 Executing agent: Simple Agent"');
      expect(result).toContain('echo hello world');
      expect(result).toContain('set_workflow_var "agent_simple_agent_output"');
      expect(result).toContain('set_workflow_var "agent_simple_agent_success"');
    });

    it('should generate agent with working directory', () => {
      const node: WorkflowNode = {
        id: 'dir_agent',
        type: 'agent',
        data: {
          command: 'ls',
          working_directory: '/tmp',
          title: 'Directory Agent',
        } as AgentNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_agent_dir_agent()');
      expect(result).toContain('local original_dir="$PWD"');
      expect(result).toContain('local working_dir="/tmp"');
      expect(result).toContain('cd "$working_dir"');
    });

    it('should generate agent with environment variables', () => {
      const node: WorkflowNode = {
        id: 'env_agent',
        type: 'agent',
        data: {
          command: 'printenv',
          environment_variables: {
            TEST_VAR: 'test_value',
            API_KEY: '{{API_TOKEN}}',
          },
          title: 'Environment Agent',
        } as AgentNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_agent_env_agent()');
      expect(result).toContain('# Set up environment variables');
      expect(result).toContain('export TEST_VAR="test_value"');
      expect(result).toContain('export API_KEY="$(get_var "API_TOKEN" "env_agent")"');
    });

    it('should generate agent with timeout', () => {
      const node: WorkflowNode = {
        id: 'timeout_agent',
        type: 'agent',
        data: {
          command: 'sleep',
          args: ['10'],
          timeout: 5,
          title: 'Timeout Agent',
        } as AgentNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_agent_timeout_agent()');
      expect(result).toContain('# Execute with 5s timeout');
      expect(result).toContain('timeout 5 sleep 10');
    });

    it('should generate agent with prompt template', () => {
      const node: WorkflowNode = {
        id: 'prompt_agent',
        type: 'agent',
        data: {
          command: 'opencode',
          prompt_template: {
            type: 'prompt',
            source: 'inline',
            content: 'Please analyze this code: {{CODE_SNIPPET}}',
          },
          template_parameters: {
            CODE_SNIPPET: 'console.log("hello");',
          },
          title: 'Prompt Agent',
        } as AgentNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_agent_prompt_agent()');
      expect(result).toContain('# Prepare agent prompt');
      expect(result).toContain("read -r -d '' prompt_content << AGENT_PROMPT_EOF");
      expect(result).toContain('Please analyze this code: console.log("hello");');
      expect(result).toContain('opencode "$prompt_content"');
    });
  });

  describe('validate', () => {
    it('should validate valid agent node', () => {
      const node: WorkflowNode = {
        id: 'valid_agent',
        type: 'agent',
        data: {
          command: 'echo',
          args: ['test'],
        } as AgentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject agent node without command', () => {
      const node: WorkflowNode = {
        id: 'invalid_agent',
        type: 'agent',
        data: {} as AgentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_AGENT_COMMAND');
    });

    it('should warn about high timeout', () => {
      const node: WorkflowNode = {
        id: 'high_timeout_agent',
        type: 'agent',
        data: {
          command: 'sleep',
          timeout: 600, // 10 minutes
        } as AgentNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HIGH_TIMEOUT');
    });
  });

  describe('getVariables', () => {
    it('should extract template variables from command and args', () => {
      const node: WorkflowNode = {
        id: 'var_agent',
        type: 'agent',
        data: {
          command: '{{TOOL_NAME}}',
          args: ['--input', '{{INPUT_FILE}}', '--output', '{{OUTPUT_FILE}}'],
        } as AgentNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('TOOL_NAME');
      expect(variables).toContain('INPUT_FILE');
      expect(variables).toContain('OUTPUT_FILE');
      expect(variables).toContain('AGENT_VAR_AGENT_OUTPUT');
      expect(variables).toContain('AGENT_VAR_AGENT_SUCCESS');
    });

    it('should extract variables from environment variables and working directory', () => {
      const node: WorkflowNode = {
        id: 'complex_agent',
        type: 'agent',
        data: {
          command: 'node',
          working_directory: '{{PROJECT_DIR}}/scripts',
          environment_variables: {
            NODE_ENV: '{{ENVIRONMENT}}',
            API_URL: '{{BASE_URL}}/api',
          },
        } as AgentNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('PROJECT_DIR');
      expect(variables).toContain('ENVIRONMENT');
      expect(variables).toContain('BASE_URL');
    });
  });
});
