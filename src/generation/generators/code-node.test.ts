/**
 * Tests for Code Node Generator
 */

import type { WorkflowNode, CodeNodeData } from '../../dsl/types.js';
import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeNodeGenerator } from './code-node.js';

describe('CodeNodeGenerator', () => {
  let generator: CodeNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new CodeNodeGenerator();
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
      expect(generator.nodeType).toBe('code');
    });
  });

  describe('generate', () => {
    it('should generate basic code execution', () => {
      const node: WorkflowNode = {
        id: 'simple_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['hello', 'world'],
          title: 'Simple Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toBe('echo hello world');
    });

    it('should generate code with template variables using subshell', () => {
      const node: WorkflowNode = {
        id: 'template_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['{{USER_NAME}}', 'has', '{{COUNT}}', 'items'],
          title: 'Template Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('(\n');
      expect(result).toContain('USER_NAME="$(get_var "USER_NAME" "template_code")"');
      expect(result).toContain('COUNT="$(get_var "COUNT" "template_code")"');
      expect(result).toContain('echo "$USER_NAME" has "$COUNT" items');
      expect(result).toContain('\n)');
    });

    it('should handle new syntax {{#variable.path#}}', () => {
      const node: WorkflowNode = {
        id: 'path_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['{{#config.database#}}', '{{#env.api_key#}}'],
          title: 'Path Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('CONFIG="$(get_var "CONFIG" "path_code")"');
      expect(result).toContain('ENV="$(get_var "ENV" "path_code")"');
      expect(result).toContain('echo "{{#config.database#}}" "{{#env.api_key#}}"');
    });

    it('should preserve bash parameter expansion syntax', () => {
      const node: WorkflowNode = {
        id: 'bash_syntax_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['${HOME:-/tmp}', '${PWD##*/}', '${#USER}'],
          title: 'Bash Syntax Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      // Should not treat ${HOME:-/tmp} as template variables
      expect(result).toBe('echo "\\${HOME:-/tmp}" "\\${PWD##*/}" "\\${#USER}"');
    });

    it('should handle mixed template and bash syntax', () => {
      const node: WorkflowNode = {
        id: 'mixed_code',
        type: 'code',
        data: {
          command: 'cp',
          args: ['{{SOURCE_FILE}}', '${HOME}/{{TARGET_DIR}}'],
          title: 'Mixed Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('(\n');
      expect(result).toContain('SOURCE_FILE="$(get_var "SOURCE_FILE" "mixed_code")"');
      expect(result).toContain('TARGET_DIR="$(get_var "TARGET_DIR" "mixed_code")"');
      expect(result).toContain('cp "$SOURCE_FILE" "\\${HOME}/$TARGET_DIR"');
      expect(result).toContain('\n)');
    });

    it('should quote arguments with spaces when needed', () => {
      const node: WorkflowNode = {
        id: 'space_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['hello world', 'simple'],
          title: 'Space Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toBe('echo "hello world" simple');
    });

    it('should handle command with template variables', () => {
      const node: WorkflowNode = {
        id: 'command_template_code',
        type: 'code',
        data: {
          command: '{{TOOL_NAME}}',
          args: ['--input', '{{INPUT_FILE}}'],
          title: 'Command Template Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('(\n');
      expect(result).toContain('TOOL_NAME="$(get_var "TOOL_NAME" "command_template_code")"');
      expect(result).toContain('INPUT_FILE="$(get_var "INPUT_FILE" "command_template_code")"');
      expect(result).toContain('$TOOL_NAME --input "$INPUT_FILE"');
      expect(result).toContain('\n)');
    });

    it('should return default command when no command specified', () => {
      const node: WorkflowNode = {
        id: 'default_code',
        type: 'code',
        data: {
          title: 'Default Code',
        } as CodeNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toBe('echo "No command specified"');
    });
  });

  describe('validate', () => {
    it('should validate valid code node', () => {
      const node: WorkflowNode = {
        id: 'valid_code',
        type: 'code',
        data: {
          command: 'ls',
          args: ['-la'],
        } as CodeNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code node without command', () => {
      const node: WorkflowNode = {
        id: 'invalid_code',
        type: 'code',
        data: {} as CodeNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_CODE_COMMAND');
    });

    it('should reject code node with empty command', () => {
      const node: WorkflowNode = {
        id: 'empty_command_code',
        type: 'code',
        data: {
          command: '',
        } as CodeNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_CODE_COMMAND');
    });

    it('should reject code node with whitespace-only command', () => {
      const node: WorkflowNode = {
        id: 'whitespace_command_code',
        type: 'code',
        data: {
          command: '   ',
        } as CodeNodeData,
      };

      const result = generator.validate(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_CODE_COMMAND');
    });
  });

  describe('getVariables', () => {
    it('should extract template variables from command and args', () => {
      const node: WorkflowNode = {
        id: 'var_code',
        type: 'code',
        data: {
          command: '{{TOOL}}',
          args: ['{{INPUT}}', '--output', '{{OUTPUT}}'],
        } as CodeNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('TOOL');
      expect(variables).toContain('INPUT');
      expect(variables).toContain('OUTPUT');
    });

    it('should extract variables from new {{#path#}} syntax', () => {
      const node: WorkflowNode = {
        id: 'path_var_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['{{#config.database#}}', '{{#env.api_key#}}'],
        } as CodeNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('CONFIG');
      expect(variables).toContain('ENV');
    });

    it('should not extract bash parameter expansion as template variables', () => {
      const node: WorkflowNode = {
        id: 'bash_var_code',
        type: 'code',
        data: {
          command: 'echo',
          args: ['${HOME}', '${USER:-default}', '{{TEMPLATE_VAR}}'],
        } as CodeNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('TEMPLATE_VAR');
      expect(variables).not.toContain('HOME');
      expect(variables).not.toContain('USER');
    });

    it('should deduplicate variables', () => {
      const node: WorkflowNode = {
        id: 'duplicate_var_code',
        type: 'code',
        data: {
          command: '{{TOOL}}',
          args: ['{{TOOL}}', '--config', '{{CONFIG}}', '{{CONFIG}}'],
        } as CodeNodeData,
      };

      const variables = generator.getVariables(node);
      expect(variables).toContain('TOOL');
      expect(variables).toContain('CONFIG');
      expect(variables.filter(v => v === 'TOOL')).toHaveLength(1);
      expect(variables.filter(v => v === 'CONFIG')).toHaveLength(1);
    });
  });
});
