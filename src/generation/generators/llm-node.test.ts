/**
 * Tests for LLM Node Generator
 */

import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkflowNode } from '../../dsl/types.js';
import { LLMNodeGenerator } from './llm-node.js';

// Simple interface for the data the generator actually expects
interface SimpleLLMData {
  title?: string;
  model?: string | { name?: string; model?: string };
  prompt?: string; // Legacy format for backward compatibility
  prompt_template?: Array<{ role: string; text: string }> | { content: string }; // New format
}

describe('LLMNodeGenerator', () => {
  let generator: LLMNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new LLMNodeGenerator();
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
      expect(generator.nodeType).toBe('llm');
    });
  });

  describe('generate', () => {
    it('should generate basic LLM call with string model', () => {
      const node: WorkflowNode = {
        id: 'simple_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: 'Hello, how are you?',
          title: 'Simple LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('extract_llm_content()');
      expect(result).toContain('Three-stage LLM fallback: OpenAI -> LLMv7 -> Demo');
      expect(result).toContain('\\"model\\":\\"gpt-3.5-turbo\\"');
      expect(result).toContain('\\"content\\":\\"Hello, how are you?\\"'); // Escaped for shell script
      expect(result).toContain('set_workflow_var "LLM_CONTENT"');
      expect(result).toContain('set_workflow_var "LLM_SUCCESS"');
    });

    it('should generate LLM call with object model config', () => {
      const node: WorkflowNode = {
        id: 'object_model_llm',
        type: 'llm',
        data: {
          model: { name: 'gpt-4', provider: 'openai' },
          prompt: 'Analyze this data',
          title: 'Object Model LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('\\"model\\":\\"gpt-4\\"');
      expect(result).toContain('\\"content\\":\\"Analyze this data\\"'); // Escaped for shell script
    });

    it('should handle template variables in prompt', () => {
      const node: WorkflowNode = {
        id: 'template_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: 'Analyze {{DATA_SOURCE}} with focus on {{FOCUS_AREA}}',
          title: 'Template LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('$(get_var "DATA_SOURCE" "template_llm")');
      expect(result).toContain('$(get_var "FOCUS_AREA" "template_llm")');
    });

    it('should default model to gpt-4 when model is empty', () => {
      const node: WorkflowNode = {
        id: 'default_model_llm',
        type: 'llm',
        data: {
          prompt: 'What is AI?',
          title: 'Default Model LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('\\"model\\":\\"gpt-4\\"');
      expect(result).toContain('\\"content\\":\\"What is AI?\\"'); // Escaped for shell script
    });

    it('should include OpenAI API key check', () => {
      const node: WorkflowNode = {
        id: 'api_key_llm',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt: 'Test prompt',
          title: 'API Key LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('if [[ -n "${OPENAI_API_KEY:-}" ]]; then');
      expect(result).toContain('Using OpenAI API...');
      expect(result).toContain('Authorization: Bearer $OPENAI_API_KEY');
    });

    it('should include LLMv7 fallback', () => {
      const node: WorkflowNode = {
        id: 'fallback_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: 'Fallback test',
          title: 'Fallback LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('trying LLMv7...');
      expect(result).toContain('https://api.llm7.io/v1/chat/completions');
      expect(result).toContain('\\"model\\":\\"default\\"');
    });

    it('should include mock response as final fallback', () => {
      const node: WorkflowNode = {
        id: 'mock_fallback_llm',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt: 'Mock test',
          title: 'Mock Fallback LLM',
        } as SimpleLLMData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('Mock LLM Response: This is a simulated response');
      expect(result).toContain('Using mock response as final fallback');
      expect(result).toContain('Original prompt was:');
    });

    it('should return mock response when includeMocks option is true', () => {
      const node: WorkflowNode = {
        id: 'mock_mode_llm',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt: 'Mock mode test',
          title: 'Mock Mode LLM',
        } as SimpleLLMData,
      };

      const mockModeContext = {
        ...mockContext,
        options: { ...mockContext.options, includeMocks: true },
      };

      const result = generator.generate(node, mockModeContext);

      expect(result).toBe('echo "Mock LLM Response for: Mock mode test"');
    });
  });

  describe('validate', () => {
    it('should validate valid LLM node', () => {
      const node: WorkflowNode = {
        id: 'valid_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: 'Valid prompt',
        } as SimpleLLMData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about missing model', () => {
      const node: WorkflowNode = {
        id: 'no_model_llm',
        type: 'llm',
        data: {
          prompt: 'Valid prompt',
        } as SimpleLLMData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true); // Still valid, just warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('MISSING_LLM_MODEL');
    });

    it('should reject LLM node without prompt', () => {
      const node: WorkflowNode = {
        id: 'no_prompt_llm',
        type: 'llm',
        data: {
          model: 'gpt-4',
        } as SimpleLLMData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_LLM_PROMPT');
    });

    it('should reject LLM node with empty prompt', () => {
      const node: WorkflowNode = {
        id: 'empty_prompt_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: '',
        } as SimpleLLMData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_LLM_PROMPT');
    });
  });

  describe('getVariables', () => {
    it('should extract template variables from prompt', () => {
      const node: WorkflowNode = {
        id: 'var_llm',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt: 'Analyze ${USER_INPUT} and provide ${RESPONSE_TYPE} response',
        } as SimpleLLMData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('USER_INPUT');
      expect(variables).toContain('RESPONSE_TYPE');
      expect(variables).toContain('LLM_CONTENT');
      expect(variables).toContain('LLM_SUCCESS');
    });

    it('should include standard output variables', () => {
      const node: WorkflowNode = {
        id: 'output_vars_llm',
        type: 'llm',
        data: {
          model: 'gpt-3.5-turbo',
          prompt: 'Simple prompt without variables',
        } as SimpleLLMData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('LLM_CONTENT');
      expect(variables).toContain('LLM_SUCCESS');
    });
  });
});
