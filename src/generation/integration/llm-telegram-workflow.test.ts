/**
 * LLM→Telegram Workflow Integration Tests
 *
 * Comprehensive integration tests for AI content generation and Telegram delivery workflows.
 * Tests the complete pipeline from LLM content creation to Telegram message delivery,
 * including variable substitution, error handling, and message formatting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultRegistry } from '../generators/index.js';
import type { GenerationContext } from '../registry/types.js';
import type {
  WorkflowNode,
  TelegramNodeData,
  VariableAssignmentNodeData,
} from '../../dsl/types.js';

// Simplified interfaces for testing (mirrors llm-node.test.ts approach)
interface SimpleLLMData {
  title?: string;
  model?: string | { name?: string; model?: string };
  prompt?: string; // Legacy format for backward compatibility
  prompt_template?: Array<{ role: string; text: string }> | { content: string }; // New format
  api_key_env?: string;
  timeout?: number;
  fallback_response?: string;
}

describe('LLM→Telegram Workflow Integration Tests', () => {
  let registry: ReturnType<typeof createDefaultRegistry>;
  let mockContext: GenerationContext;

  beforeEach(() => {
    registry = createDefaultRegistry();
    mockContext = {
      options: { verbose: false, shell: 'bash' },
      variables: new Map(),
      nodeCount: 5,
      currentNodeIndex: 1,
      workflowName: 'llm-telegram-test',
    };
  });

  describe('Core Workflow Components', () => {
    it('should have all required generators for LLM→Telegram workflow', () => {
      // Essential generators for LLM→Telegram workflows
      const requiredGenerators = ['start', 'llm', 'variable-assignment', 'telegram', 'answer'];

      for (const genType of requiredGenerators) {
        const generator = registry.get(genType);
        expect(generator, `Required generator ${genType} should be available`).toBeDefined();
        expect(generator!.nodeType).toBe(genType);
      }
    });

    it('should support additional workflow enhancement generators', () => {
      // Optional but commonly used generators in LLM→Telegram workflows
      const enhancementGenerators = [
        'code', // Environment validation
        'if-else', // Conditional logic
        'retry', // Error handling
        'fallback', // Backup strategies
        'http-request', // API integrations
      ];

      for (const genType of enhancementGenerators) {
        const generator = registry.get(genType);
        expect(generator, `Enhancement generator ${genType} should be available`).toBeDefined();
      }
    });
  });

  describe('LLM Content Generation Integration', () => {
    it('should generate LLM node with prompt_template array format', () => {
      const llmGenerator = registry.get('llm');
      expect(llmGenerator).toBeDefined();

      const llmNode: WorkflowNode = {
        id: 'generate_riddle',
        type: 'llm',
        data: {
          title: 'Generate AI Riddle',
          model: 'gpt-4',
          prompt_template: [
            {
              role: 'system',
              text: 'You are a creative riddle generator who creates educational riddles about science and space.',
            },
            {
              role: 'user',
              text: 'Create an engaging riddle about ${topic}. Include both question and answer. Make it fun and educational.',
            },
          ],
          api_key_env: 'OPENAI_API_KEY',
          timeout: 30,
        } as SimpleLLMData,
      };

      const result = llmGenerator?.generate(llmNode, mockContext);
      expect(result).toBeDefined();
      expect(result).toContain('# Node: generate_riddle');
      expect(result).toContain('set_var "LLM_CONTENT"');
      expect(result).toContain('$(get_workflow_var "TOPIC" "default")'); // Template variable processed
      expect(result).toContain('"role":"system"');
      expect(result).toContain('"role":"user"');
      expect(result).toContain('educational riddles about science');
      expect(result).not.toContain('"content": "Hello"'); // Should not use hardcoded Hello
    });

    it('should generate LLM node with legacy prompt format', () => {
      const llmGenerator = registry.get('llm');
      expect(llmGenerator).toBeDefined();

      const llmNode: WorkflowNode = {
        id: 'simple_llm',
        type: 'llm',
        data: {
          title: 'Simple LLM Call',
          model: 'gpt-3.5-turbo',
          prompt: 'Create a riddle about ${content_topic}',
          api_key_env: 'OPENAI_API_KEY',
        } as SimpleLLMData,
      };

      const result = llmGenerator!.generate(llmNode, mockContext);

      expect(result).toContain('set_var "LLM_CONTENT"');
      expect(result).toContain('$(get_workflow_var "CONTENT_TOPIC" "default")');
      expect(result).not.toContain('prompt_template'); // Should use legacy prompt field
    });

    it('should extract variables from LLM prompt templates', () => {
      const llmGenerator = registry.get('llm');
      expect(llmGenerator).toBeDefined();

      const llmNode: WorkflowNode = {
        id: 'llm_with_vars',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt_template: [
            { role: 'user', text: 'Generate content about ${topic} for audience ${audience_type}' },
          ],
        } as SimpleLLMData,
      };

      if (llmGenerator) {
        // @ts-expect-error - llmGenerator is verified to exist above
        const variables = llmGenerator.getVariables(llmNode);
        expect(variables).toContain('LLM_CONTENT'); // Output variable
      }
    });
  });

  describe('Variable Assignment Integration', () => {
    it('should handle template variables in Telegram message formatting', () => {
      const varGenerator = registry.get('variable-assignment');
      expect(varGenerator).toBeDefined();

      const formatNode: WorkflowNode = {
        id: 'format_message',
        type: 'variable-assignment',
        data: {
          variable: 'telegram_message',
          assignment_type: 'constant',
          value:
            '🎯 <b>Daily Riddle Challenge</b> 🎯\n\n${llm_content}\n\n💭 <i>Can you solve it?</i>\n\n🤖 <i>Powered by flowsh</i>',
        } as VariableAssignmentNodeData,
      };

      const result = varGenerator!.generate(formatNode, mockContext);

      expect(result).toContain('set_var "TELEGRAM_MESSAGE"');
      expect(result).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(result).not.toContain('${llm_content}'); // Should be processed, not literal
      expect(result).toContain('Daily Riddle Challenge'); // HTML content preserved
      expect(result).toContain('<b>'); // HTML tags preserved
    });

    it('should handle multiple template variables in message formatting', () => {
      const varGenerator = registry.get('variable-assignment');
      const complexFormatNode: WorkflowNode = {
        id: 'complex_format',
        type: 'variable-assignment',
        data: {
          variable: 'full_message',
          assignment_type: 'constant',
          value:
            '👋 Hello ${user_name}!\n\n📝 Your ${content_type}: ${llm_content}\n\n📊 Status: ${delivery_status}',
        } as VariableAssignmentNodeData,
      };

      const result = varGenerator!.generate(complexFormatNode, mockContext);

      expect(result).toContain('$(get_workflow_var "USER_NAME" "default")');
      expect(result).toContain('$(get_workflow_var "CONTENT_TYPE" "default")');
      expect(result).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(result).toContain('$(get_workflow_var "DELIVERY_STATUS" "default")');
    });

    it('should extract variables from assignment nodes', () => {
      const varGenerator = registry.get('variable-assignment');
      const formatNode: WorkflowNode = {
        id: 'format_node',
        type: 'variable-assignment',
        data: {
          variable: 'formatted_output',
          assignment_type: 'constant',
          value: 'Formatted content',
        } as VariableAssignmentNodeData,
      };

      // @ts-expect-error - varGenerator verified to exist
      const variables = varGenerator!.getVariables(formatNode);
      expect(variables).toEqual(['FORMATTED_OUTPUT']); // Should be uppercase
    });
  });

  describe('Telegram Delivery Integration', () => {
    it('should generate Telegram node with template variable message', () => {
      const telegramGenerator = registry.get('telegram');
      expect(telegramGenerator).toBeDefined();

      const telegramNode: WorkflowNode = {
        id: 'send_message',
        type: 'telegram',
        data: {
          title: 'Send to Telegram',
          bot_token_env: 'TELEGRAM_BOT_TOKEN',
          chat_id_env: 'TELEGRAM_CHAT_ID',
          message: '${telegram_message}',
          parse_mode: 'HTML',
          timeout: 30,
        } as TelegramNodeData,
      };

      const result = telegramGenerator!.generate(telegramNode, mockContext);

      expect(result).toContain('# Node: send_message');
      expect(result).toContain('$(get_workflow_var "TELEGRAM_MESSAGE" "default")');
      expect(result).not.toContain('${telegram_message}'); // Should be processed
      expect(result).toContain('"parse_mode":"HTML"');
      expect(result).toContain('set_var "TELEGRAM_SUCCESS"');
    });

    it('should handle direct message content in Telegram node', () => {
      const telegramGenerator = registry.get('telegram');
      const directTelegramNode: WorkflowNode = {
        id: 'direct_message',
        type: 'telegram',
        data: {
          bot_token_env: 'TELEGRAM_BOT_TOKEN',
          chat_id_env: 'TELEGRAM_CHAT_ID',
          message: 'Hello from flowsh! Here is your content: ${llm_content}',
          parse_mode: 'Markdown',
        } as TelegramNodeData,
      };

      const result = telegramGenerator!.generate(directTelegramNode, mockContext);

      expect(result).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(result).toContain('"parse_mode":"Markdown"');
      expect(result).toContain('Hello from flowsh'); // Direct content preserved
    });

    it('should extract variables from Telegram nodes', () => {
      const telegramGenerator = registry.get('telegram');
      const telegramNode: WorkflowNode = {
        id: 'telegram_node',
        type: 'telegram',
        data: {
          bot_token_env: 'TELEGRAM_BOT_TOKEN',
          chat_id_env: 'TELEGRAM_CHAT_ID',
          message: 'Test message',
        } as TelegramNodeData,
      };

      // @ts-expect-error - telegramGenerator verified to exist
      const variables = telegramGenerator!.getVariables(telegramNode);
      expect(variables).toContain('TELEGRAM_SUCCESS'); // Output variable
    });
  });

  describe('End-to-End Workflow Simulation', () => {
    it('should support complete LLM→Format→Telegram workflow chain', () => {
      const llmGenerator = registry.get('llm');
      const varGenerator = registry.get('variable-assignment');
      const telegramGenerator = registry.get('telegram');

      // Step 1: LLM generates content
      const llmNode: WorkflowNode = {
        id: 'generate_content',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt_template: [{ role: 'user', text: 'Create a ${content_type} about ${topic}' }],
        } as SimpleLLMData,
      };

      const llmResult = llmGenerator!.generate(llmNode, mockContext);
      expect(llmResult).toContain('set_var "LLM_CONTENT"'); // Produces LLM_CONTENT

      // Step 2: Format the message
      const formatNode: WorkflowNode = {
        id: 'format_message',
        type: 'variable-assignment',
        data: {
          variable: 'telegram_message',
          assignment_type: 'constant',
          value: '📢 New ${content_type}!\n\n${llm_content}\n\n✨ Topic: ${topic}',
        } as VariableAssignmentNodeData,
      };

      const formatResult = varGenerator!.generate(formatNode, mockContext);
      expect(formatResult).toContain('set_var "TELEGRAM_MESSAGE"'); // Produces TELEGRAM_MESSAGE
      expect(formatResult).toContain('$(get_workflow_var "LLM_CONTENT" "default")'); // Uses LLM output

      // Step 3: Send via Telegram
      const telegramNode: WorkflowNode = {
        id: 'send_telegram',
        type: 'telegram',
        data: {
          bot_token_env: 'TELEGRAM_BOT_TOKEN',
          chat_id_env: 'TELEGRAM_CHAT_ID',
          message: '${telegram_message}',
          parse_mode: 'HTML',
        } as TelegramNodeData,
      };

      const telegramResult = telegramGenerator!.generate(telegramNode, mockContext);
      expect(telegramResult).toContain('set_var "TELEGRAM_SUCCESS"'); // Produces TELEGRAM_SUCCESS
      expect(telegramResult).toContain('$(get_workflow_var "TELEGRAM_MESSAGE" "default")'); // Uses formatted message
    });

    it('should handle workflow with fallback content', () => {
      const llmGenerator = registry.get('llm');
      const varGenerator = registry.get('variable-assignment');

      // LLM with fallback
      const llmNode: WorkflowNode = {
        id: 'llm_with_fallback',
        type: 'llm',
        data: {
          model: 'gpt-4',
          prompt: 'Generate a riddle about space',
          fallback_response: '🌟 Demo Riddle: What has rings but no fingers? Answer: Saturn!',
          timeout: 30,
        } as SimpleLLMData,
      };

      const llmResult = llmGenerator!.generate(llmNode, mockContext);
      expect(llmResult).toContain('Demo Riddle: What has rings'); // Fallback content included

      // Variable assignment using the LLM output (with fallback)
      const formatNode: WorkflowNode = {
        id: 'format_with_fallback',
        type: 'variable-assignment',
        data: {
          variable: 'final_message',
          assignment_type: 'constant',
          value: '🎯 Daily Challenge 🎯\n\n${llm_content}\n\n💡 Generated by AI',
        } as VariableAssignmentNodeData,
      };

      const formatResult = varGenerator!.generate(formatNode, mockContext);
      expect(formatResult).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(formatResult).toContain('Daily Challenge'); // Static content preserved
    });
  });

  describe('Variable Flow and Dependencies', () => {
    it('should maintain proper variable dependencies in workflow chain', () => {
      // Test that variables flow correctly through the pipeline
      const generators = {
        llm: registry.get('llm'),
        var: registry.get('variable-assignment'),
        telegram: registry.get('telegram'),
      };

      // Each generator should be available
      Object.values(generators).forEach(gen => expect(gen).toBeDefined());

      // LLM produces LLM_CONTENT
      // @ts-expect-error - generators verified to exist
      const llmVars = generators.llm!.getVariables({
        id: 'test',
        type: 'llm',
        data: { model: 'gpt-4', prompt: 'test' },
      } as WorkflowNode);
      expect(llmVars).toContain('LLM_CONTENT');

      // Variable assignment produces TELEGRAM_MESSAGE
      // @ts-expect-error - generators verified to exist
      const varVars = generators.var!.getVariables({
        id: 'test',
        type: 'variable-assignment',
        data: { variable: 'telegram_message', assignment_type: 'constant', value: 'test' },
      } as WorkflowNode);
      expect(varVars).toContain('TELEGRAM_MESSAGE');

      // Telegram produces TELEGRAM_SUCCESS
      // @ts-expect-error - generators verified to exist
      const telegramVars = generators.telegram!.getVariables({
        id: 'test',
        type: 'telegram',
        data: { bot_token_env: 'BOT_TOKEN', chat_id_env: 'CHAT_ID', message: 'test' },
      } as WorkflowNode);
      expect(telegramVars).toContain('TELEGRAM_SUCCESS');
    });

    it('should handle complex variable substitution patterns', () => {
      const varGenerator = registry.get('variable-assignment');

      // Test nested substitutions and special characters
      const complexNode: WorkflowNode = {
        id: 'complex_vars',
        type: 'variable-assignment',
        data: {
          variable: 'complex_message',
          assignment_type: 'constant',
          value:
            '🎉 Results for ${user_name}:\n📊 AI Response: ${llm_content}\n✅ Status: ${telegram_success}\n⏰ Generated at: $(date)',
        } as VariableAssignmentNodeData,
      };

      const result = varGenerator!.generate(complexNode, mockContext);

      // All template variables should be processed
      expect(result).toContain('$(get_workflow_var "USER_NAME" "default")');
      expect(result).toContain('$(get_workflow_var "LLM_CONTENT" "default")');
      expect(result).toContain('$(get_workflow_var "TELEGRAM_SUCCESS" "default")');

      // Shell commands should be preserved
      expect(result).toContain('$(date)');

      // Special characters should be preserved
      expect(result).toContain('🎉');
      expect(result).toContain('📊');
      expect(result).toContain('✅');
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle missing template variables gracefully', () => {
      const varGenerator = registry.get('variable-assignment');

      const nodeWithMissingVars: WorkflowNode = {
        id: 'missing_vars_test',
        type: 'variable-assignment',
        data: {
          variable: 'message_with_missing',
          assignment_type: 'constant',
          value: 'Content: ${missing_variable} - this should still work',
        } as VariableAssignmentNodeData,
      };

      const result = varGenerator!.generate(nodeWithMissingVars, mockContext);

      // Should still generate valid shell code with default values
      expect(result).toContain('$(get_workflow_var "MISSING_VARIABLE" "default")');
      expect(result).toContain('set_var "MESSAGE_WITH_MISSING"');
    });

    it('should validate workflow component availability for production deployment', () => {
      // Ensure all critical components are available for production workflows
      const productionComponents = [
        'start', // Workflow entry point
        'code', // Environment validation
        'llm', // AI content generation
        'variable-assignment', // Message formatting
        'telegram', // Message delivery
        'if-else', // Conditional logic
        'retry', // Error recovery
        'answer', // Workflow completion
      ];

      for (const component of productionComponents) {
        const generator = registry.get(component);
        expect(generator, `Production component ${component} must be available`).toBeDefined();
        expect(generator!.nodeType, `${component} must have correct nodeType`).toBe(component);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should generate workflow components efficiently', () => {
      const startTime = Date.now();

      // Generate multiple workflow components
      const llmGen = registry.get('llm');
      const varGen = registry.get('variable-assignment');
      const telegramGen = registry.get('telegram');

      for (let i = 0; i < 50; i++) {
        const llmNode: WorkflowNode = {
          id: `llm_${i}`,
          type: 'llm',
          data: { model: 'gpt-4', prompt: `Test prompt ${i}` },
        } as WorkflowNode;

        llmGen!.generate(llmNode, mockContext);

        const varNode: WorkflowNode = {
          id: `var_${i}`,
          type: 'variable-assignment',
          data: { variable: `test_var_${i}`, assignment_type: 'constant', value: `Value ${i}` },
        } as WorkflowNode;

        varGen!.generate(varNode, mockContext);

        const telegramNode: WorkflowNode = {
          id: `telegram_${i}`,
          type: 'telegram',
          data: { bot_token_env: 'TOKEN', chat_id_env: 'CHAT', message: `Message ${i}` },
        } as WorkflowNode;

        telegramGen!.generate(telegramNode, mockContext);
      }

      const duration = Date.now() - startTime;

      // Should be able to generate 150 nodes (50x3) in under 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should handle large template variable substitutions efficiently', () => {
      const varGenerator = registry.get('variable-assignment');

      // Create a message with many template variables
      const manyVarsValue = Array.from({ length: 20 }, (_, i) => `Var${i}: \${variable_${i}}`).join(
        '\n'
      );

      const largeVarNode: WorkflowNode = {
        id: 'large_vars',
        type: 'variable-assignment',
        data: {
          variable: 'large_message',
          assignment_type: 'constant',
          value: manyVarsValue,
        } as VariableAssignmentNodeData,
      };

      const startTime = Date.now();
      const result = varGenerator!.generate(largeVarNode, mockContext);
      const duration = Date.now() - startTime;

      // Should handle 20 variable substitutions quickly
      expect(duration).toBeLessThan(50);

      // All variables should be processed
      for (let i = 0; i < 20; i++) {
        expect(result).toContain(`$(get_workflow_var "VARIABLE_${i}" "default")`);
      }
    });
  });
});
