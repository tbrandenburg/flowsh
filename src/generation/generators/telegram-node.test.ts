/**
 * Tests for Telegram Node Generator
 */

import type { WorkflowNode, TelegramNodeData } from '../../dsl/types.js';
import type { GenerationContext } from '../registry/types.js';
import { TelegramNodeGenerator } from './telegram-node.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TelegramNodeGenerator', () => {
  let generator: TelegramNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new TelegramNodeGenerator();
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
      expect(generator.nodeType).toBe('telegram');
    });
  });

  describe('generate', () => {
    it('should generate basic message with environment variables', () => {
      const node: WorkflowNode = {
        id: 'send_message',
        type: 'telegram',
        data: {
          message: 'Hello from flowsh!',
          title: 'Send Notification',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_send_message()');
      expect(result).toContain('log_step "📱 Sending Telegram message: Send Notification"');
      expect(result).toContain('local message="Hello from flowsh!"');
      expect(result).toContain('local parse_mode="HTML"'); // Default
      expect(result).toContain('local max_retries=3'); // Default
      expect(result).toContain('${TELEGRAM_CHAT_ID:-}');
      expect(result).toContain('${TELEGRAM_BOT_TOKEN:-}');
    });

    it('should generate message with node-specific configuration', () => {
      const node: WorkflowNode = {
        id: 'custom_message',
        type: 'telegram',
        data: {
          message: 'Custom notification',
          chat_id: '12345',
          bot_token: 'bot123:token',
          parse_mode: 'Markdown',
          max_retries: 5,
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_custom_message()');
      expect(result).toContain('local chat_id="12345"');
      expect(result).toContain('local bot_token="bot123:token"');
      expect(result).toContain('local parse_mode="Markdown"');
      expect(result).toContain('local max_retries=5');
    });

    it('should generate message with template variables', () => {
      const node: WorkflowNode = {
        id: 'template_message',
        type: 'telegram',
        data: {
          message: 'Status: {{STATUS}}, Time: {{TIME}}',
          chat_id: '{{CHAT_ID}}',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_template_message()');
      expect(result).toContain('$(get_var "STATUS" "template_message")');
      expect(result).toContain('$(get_var "TIME" "template_message")');
      expect(result).toContain('$(get_var "CHAT_ID" "template_message")');
    });

    it('should generate message with shell-style template variables', () => {
      const node: WorkflowNode = {
        id: 'shell_template_message',
        type: 'telegram',
        data: {
          message: 'Workflow: ${workflow_name}, User: ${user_name}',
          chat_id: '${test_chat_id}',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_shell_template_message()');
      expect(result).toContain('$(get_var "WORKFLOW_NAME" "shell_template_message")');
      expect(result).toContain('$(get_var "USER_NAME" "shell_template_message")');
      expect(result).toContain('$(get_var "TEST_CHAT_ID" "shell_template_message")');
    });

    it('should generate message with optional parameters', () => {
      const node: WorkflowNode = {
        id: 'full_config',
        type: 'telegram',
        data: {
          message: 'Full configuration test',
          disable_notification: true,
          reply_to_message_id: 123,
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_full_config()');
      expect(result).toContain('local disable_notification=true');
      expect(result).toContain('local reply_to_message_id=123');
      expect(result).toContain('"disable_notification": true');
      expect(result).toContain('"reply_to_message_id": 123');
    });

    it('should include character escaping functions', () => {
      const node: WorkflowNode = {
        id: 'escape_test',
        type: 'telegram',
        data: {
          message: 'Test message with <tags> & symbols',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      // Check that the new functions exist
      expect(result).toContain('escape_json() {');
      expect(result).toContain('escape_markdown() {');

      // Check that JSON escaping is used for HTML mode (not HTML escaping)
      expect(result).toContain('escaped_message=$(escape_json "$message")');

      // Check that HTML escaping is NOT used anymore
      expect(result).not.toContain('escape_html');
      expect(result).not.toContain('${text//&/&amp;}');
      expect(result).not.toContain('${text//</&lt;}');

      // Check some markdown escaping patterns still exist
      expect(result).toContain('${text//_/\\_}'); // Markdown escaping
      expect(result).toContain('${text//*/\\*}'); // Markdown escaping
    });

    it('should include retry logic with exponential backoff', () => {
      const node: WorkflowNode = {
        id: 'retry_test',
        type: 'telegram',
        data: {
          message: 'Retry test message',
          max_retries: 3,
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('while [[ $attempt -le $max_retries ]]');
      expect(result).toContain('delay=$((delay * 2))'); // Exponential backoff
      expect(result).toContain('attempt=$((attempt + 1))');
      expect(result).toContain('sleep $delay');
    });

    it('should include comprehensive error handling', () => {
      const node: WorkflowNode = {
        id: 'error_test',
        type: 'telegram',
        data: {
          message: 'Error handling test',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('set_workflow_var "telegram_success" "true"');
      expect(result).toContain('set_workflow_var "telegram_success" "false"');
      expect(result).toContain('set_workflow_var "telegram_http_code"');
      expect(result).toContain('set_workflow_var "telegram_response"');
      expect(result).toContain('set_workflow_var "telegram_message_sent"');
      expect(result).toContain('set_workflow_var "telegram_error"');
    });

    it('should handle missing title with node id fallback', () => {
      const node: WorkflowNode = {
        id: 'no_title',
        type: 'telegram',
        data: {
          message: 'Test message',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('log_step "📱 Sending Telegram message: no_title"');
    });

    it('should validate message content before sending', () => {
      const node: WorkflowNode = {
        id: 'validate_test',
        type: 'telegram',
        data: {
          message: 'Validation test',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('if [[ -z "$message" ]]');
      expect(result).toContain('log_error "Telegram message content is empty"');
      expect(result).toContain('return 1');
    });

    it('should generate message with error handling configuration', () => {
      const node: WorkflowNode = {
        id: 'resilient_message',
        type: 'telegram',
        data: {
          message: 'Resilient notification',
          error_handling: 'continue',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('send_telegram_resilient_message()');
      expect(result).toContain('local error_handling="continue"');
      expect(result).toContain('case "$error_handling" in');
      expect(result).toContain('"ignore")');
      expect(result).toContain('"continue")');
      expect(result).toContain('log_info "Ignoring Telegram');
      expect(result).toContain('log_warning "Continuing despite Telegram');
    });

    it('should include proper API request structure', () => {
      const node: WorkflowNode = {
        id: 'api_test',
        type: 'telegram',
        data: {
          message: 'API test message',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('api.telegram.org/bot');
      expect(result).toContain('/sendMessage');
      expect(result).toContain('curl -s -w "%{http_code}"');
      expect(result).toContain('-X POST');
      expect(result).toContain('-H "Content-Type: application/json"');
      expect(result).toContain('--connect-timeout 10');
      expect(result).toContain('--max-time 30');
    });
  });

  describe('validation', () => {
    it('should validate valid node', () => {
      const validNode: WorkflowNode = {
        id: 'valid',
        type: 'telegram',
        data: {
          message: 'Valid message',
        } as TelegramNodeData,
      };

      const result = generator.validate?.(validNode);
      expect(result?.valid).toBe(true);
      expect(result?.errors).toHaveLength(0);
    });

    it('should reject node without message', () => {
      const invalidNode: WorkflowNode = {
        id: 'invalid',
        type: 'telegram',
        data: {} as TelegramNodeData,
      };

      const result = generator.validate?.(invalidNode);
      expect(result?.valid).toBe(false);
      expect(result?.errors).toHaveLength(1);
      expect(result?.errors[0].code).toBe('MISSING_MESSAGE');
    });

    it('should reject invalid parse_mode', () => {
      const invalidNode: WorkflowNode = {
        id: 'invalid_parse',
        type: 'telegram',
        data: {
          message: 'Test message',
          parse_mode: 'INVALID' as any,
        } as TelegramNodeData,
      };

      const result = generator.validate?.(invalidNode);
      expect(result?.valid).toBe(false);
      expect(result?.errors[0].code).toBe('INVALID_PARSE_MODE');
    });

    it('should validate parse_mode options', () => {
      const validParseModes = ['HTML', 'Markdown', 'MarkdownV2'];

      validParseModes.forEach(parseMode => {
        const node: WorkflowNode = {
          id: 'parse_test',
          type: 'telegram',
          data: {
            message: 'Test message',
            parse_mode: parseMode as any,
          } as TelegramNodeData,
        };

        const result = generator.validate?.(node);
        expect(result?.valid).toBe(true);
      });
    });

    it('should reject negative max_retries', () => {
      const invalidNode: WorkflowNode = {
        id: 'negative_retries',
        type: 'telegram',
        data: {
          message: 'Test message',
          max_retries: -1,
        } as TelegramNodeData,
      };

      const result = generator.validate?.(invalidNode);
      expect(result?.valid).toBe(false);
      expect(result?.errors[0].code).toBe('INVALID_MAX_RETRIES');
    });

    it('should warn about high max_retries', () => {
      const highRetryNode: WorkflowNode = {
        id: 'high_retries',
        type: 'telegram',
        data: {
          message: 'Test message',
          max_retries: 15,
        } as TelegramNodeData,
      };

      const result = generator.validate?.(highRetryNode);
      expect(result?.valid).toBe(true);
      expect(result?.warnings).toHaveLength(3); // High retries + missing config warnings
      expect(result?.warnings.some(w => w.code === 'HIGH_MAX_RETRIES')).toBe(true);
    });

    it('should reject invalid reply_to_message_id', () => {
      const invalidNode: WorkflowNode = {
        id: 'invalid_reply',
        type: 'telegram',
        data: {
          message: 'Test message',
          reply_to_message_id: 0,
        } as TelegramNodeData,
      };

      const result = generator.validate?.(invalidNode);
      expect(result?.valid).toBe(false);
      expect(result?.errors[0].code).toBe('INVALID_REPLY_MESSAGE_ID');
    });

    it('should reject invalid error_handling', () => {
      const invalidNode: WorkflowNode = {
        id: 'invalid_error_handling',
        type: 'telegram',
        data: {
          message: 'Test message',
          error_handling: 'INVALID' as any,
        } as TelegramNodeData,
      };

      const result = generator.validate?.(invalidNode);
      expect(result?.valid).toBe(false);
      expect(result?.errors[0].code).toBe('INVALID_ERROR_HANDLING');
    });

    it('should validate error_handling options', () => {
      const validErrorHandling = ['fail', 'ignore', 'continue'];

      validErrorHandling.forEach(errorHandling => {
        const node: WorkflowNode = {
          id: 'error_handling_test',
          type: 'telegram',
          data: {
            message: 'Test message',
            error_handling: errorHandling as any,
          } as TelegramNodeData,
        };

        const result = generator.validate?.(node);
        expect(result?.valid).toBe(true);
      });
    });

    it('should warn about missing configuration', () => {
      const node: WorkflowNode = {
        id: 'missing_config',
        type: 'telegram',
        data: {
          message: 'Test message',
        } as TelegramNodeData,
      };

      const result = generator.validate?.(node);
      expect(result?.valid).toBe(true);
      expect(result?.warnings).toHaveLength(2);
      expect(result?.warnings.some(w => w.code === 'MISSING_CHAT_ID_CONFIG')).toBe(true);
      expect(result?.warnings.some(w => w.code === 'MISSING_BOT_TOKEN_CONFIG')).toBe(true);
    });
  });

  describe('getVariables', () => {
    it('should extract template variables from message', () => {
      const node: WorkflowNode = {
        id: 'var_test',
        type: 'telegram',
        data: {
          message: 'Status: {{STATUS}}, User: {{USER_NAME}}',
        } as TelegramNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('STATUS');
      expect(variables).toContain('USER_NAME');
    });

    it('should extract variables from chat_id and bot_token', () => {
      const node: WorkflowNode = {
        id: 'config_vars',
        type: 'telegram',
        data: {
          message: 'Test',
          chat_id: '{{DYNAMIC_CHAT_ID}}',
          bot_token: '{{BOT_TOKEN_VAR}}',
        } as TelegramNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('DYNAMIC_CHAT_ID');
      expect(variables).toContain('BOT_TOKEN_VAR');
    });

    it('should include output variables', () => {
      const node: WorkflowNode = {
        id: 'output_vars',
        type: 'telegram',
        data: {
          message: 'Test message',
        } as TelegramNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('TELEGRAM_SUCCESS');
      expect(variables).toContain('TELEGRAM_HTTP_CODE');
      expect(variables).toContain('TELEGRAM_RESPONSE');
      expect(variables).toContain('TELEGRAM_MESSAGE_SENT');
      expect(variables).toContain('TELEGRAM_ERROR');
    });

    it('should extract shell-style template variables', () => {
      const node: WorkflowNode = {
        id: 'shell_vars',
        type: 'telegram',
        data: {
          message: 'Status: ${status_code}, Time: ${timestamp}',
          chat_id: '${dynamic_chat_id}',
        } as TelegramNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('STATUS_CODE');
      expect(variables).toContain('TIMESTAMP');
      expect(variables).toContain('DYNAMIC_CHAT_ID');
    });

    it('should deduplicate variables', () => {
      const node: WorkflowNode = {
        id: 'duplicate_vars',
        type: 'telegram',
        data: {
          message: 'User {{USER}} says {{USER}} is ready',
          chat_id: '{{USER}}_chat',
        } as TelegramNodeData,
      };

      const variables = generator.getVariables(node);
      const userCount = variables.filter(v => v === 'USER').length;
      expect(userCount).toBe(1); // Should be deduplicated
    });
  });

  describe('shell structure', () => {
    it('should generate proper function structure', () => {
      const node: WorkflowNode = {
        id: 'structure_test',
        type: 'telegram',
        data: {
          message: 'Structure test',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toMatch(/send_telegram_structure_test\(\)\s*\{/);
      expect(result).toContain('}');
      expect(result).toContain('log_step');
      expect(result).toContain('set_workflow_var');
    });

    it('should handle different parse modes correctly', () => {
      const parseModes = ['HTML', 'Markdown', 'MarkdownV2'] as const;

      parseModes.forEach(parseMode => {
        const node: WorkflowNode = {
          id: `${parseMode.toLowerCase()}_test`,
          type: 'telegram',
          data: {
            message: 'Test message',
            parse_mode: parseMode,
          } as TelegramNodeData,
        };

        const result = generator.generate(node, mockContext);
        expect(result).toContain(`local parse_mode="${parseMode}"`);
        expect(result).toContain(`"parse_mode": "$parse_mode"`);
      });
    });

    it('should include node comment', () => {
      const node: WorkflowNode = {
        id: 'comment_test',
        type: 'telegram',
        data: {
          message: 'Test message',
          title: 'Test Telegram Node',
        } as TelegramNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('# Node: comment_test (Test Telegram Node)');
    });
  });
});
