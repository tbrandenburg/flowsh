/**
 * Tests for YAML security validation utilities
 */
import { YamlSecurityValidator } from './yaml-validator.js';
import { describe, it, expect } from 'vitest';

describe('YamlSecurityValidator', () => {
  describe('validateYamlSecurity', () => {
    it('should accept safe YAML content', () => {
      const safeYaml = `
        workflow:
          name: "test workflow"
          description: "A safe test workflow"
        nodes:
          - id: "start"
            type: "start"
            data:
              title: "Start Node"
      `;

      const result = YamlSecurityValidator.validateYamlSecurity(safeYaml);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject YAML that is too large', () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const result = YamlSecurityValidator.validateYamlSecurity(largeContent);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
    });

    it('should warn about large but acceptable files', () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const result = YamlSecurityValidator.validateYamlSecurity(largeContent);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.code === 'LARGE_FILE_SIZE')).toBe(true);
    });

    it('should reject content with suspicious patterns', () => {
      const suspiciousPatterns = [
        'eval("dangerous code")',
        'exec("rm -rf /")',
        'require("fs")',
        '__proto__.polluted = true',
        'javascript:alert("xss")',
      ];

      for (const pattern of suspiciousPatterns) {
        const yamlWithPattern = `
          workflow:
            name: "test"
          nodes:
            - data: "${pattern}"
        `;

        const result = YamlSecurityValidator.validateYamlSecurity(yamlWithPattern);
        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.code === 'SUSPICIOUS_CONTENT')).toBe(true);
      }
    });

    it('should detect dangerous keys', () => {
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

      for (const key of dangerousKeys) {
        const yamlWithDangerousKey = `
          workflow:
            name: "test"
          ${key}:
            malicious: "content"
        `;

        const result = YamlSecurityValidator.validateYamlSecurity(yamlWithDangerousKey);
        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.code === 'DANGEROUS_KEY')).toBe(true);
      }
    });

    it('should estimate and limit node count', () => {
      // Create YAML with many nodes
      let manyNodesYaml = 'workflow:\n  name: "test"\nnodes:\n';
      for (let i = 0; i < 15000; i++) {
        manyNodesYaml += `  - id: "node${i}"\n    type: "test"\n`;
      }

      const result = YamlSecurityValidator.validateYamlSecurity(manyNodesYaml);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'TOO_MANY_NODES')).toBe(true);
    });

    it('should estimate and limit nesting depth', () => {
      // Create deeply nested YAML
      let deepYaml = 'workflow:\n';
      for (let i = 0; i < 20; i++) {
        deepYaml += '  '.repeat(i + 1) + `level${i}:\n`;
      }
      deepYaml += '  '.repeat(21) + 'deep: "value"\n';

      const result = YamlSecurityValidator.validateYamlSecurity(deepYaml);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'TOO_DEEP_NESTING')).toBe(true);
    });

    it('should accept custom limits', () => {
      const content = 'x'.repeat(1024); // 1KB
      const result = YamlSecurityValidator.validateYamlSecurity(content, {
        maxFileSize: 500, // 500 bytes
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
    });

    it('should use strict mode for warnings', () => {
      const yamlWithWarning = `
        workflow:
          name: "test"
        nodes:
          - data: "function test() { return true; }"
      `;

      const normalResult = YamlSecurityValidator.validateYamlSecurity(yamlWithWarning);
      expect(normalResult.success).toBe(true);
      expect(normalResult.warnings.length).toBeGreaterThan(0);

      const strictResult = YamlSecurityValidator.validateYamlSecurity(yamlWithWarning, {
        strictMode: true,
      });
      expect(strictResult.success).toBe(false);
    });

    it('should handle empty or invalid content', () => {
      const emptyResult = YamlSecurityValidator.validateYamlSecurity('');
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.errors[0].code).toBe('INVALID_CONTENT');

      const nullResult = YamlSecurityValidator.validateYamlSecurity(null as any);
      expect(nullResult.success).toBe(false);
      expect(nullResult.errors[0].code).toBe('INVALID_CONTENT');
    });

    it('should provide line numbers for detected issues', () => {
      const yamlWithIssue = `line1: value
line2: value  
line3: eval("dangerous")
line4: value`;

      const result = YamlSecurityValidator.validateYamlSecurity(yamlWithIssue);
      expect(result.success).toBe(false);
      expect(result.errors[0].line).toBe(3);
    });
  });

  describe('validateYamlObject', () => {
    it('should accept safe objects', () => {
      const safeObject = {
        workflow: {
          name: 'test',
          nodes: [{ id: 'test', type: 'start' }],
        },
      };

      const result = YamlSecurityValidator.validateYamlObject(safeObject);
      expect(result.success).toBe(true);
    });

    it('should detect dangerous keys in objects', () => {
      const dangerousObject = {
        workflow: {
          name: 'test',
          constructor: { malicious: true },
        },
      };

      const result = YamlSecurityValidator.validateYamlObject(dangerousObject);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGEROUS_OBJECT_KEY')).toBe(true);
    });

    it('should check nested objects recursively', () => {
      const nestedDangerousObject = {
        workflow: {
          nodes: [
            {
              id: 'test',
              data: {
                constructor: 'malicious',
              },
            },
          ],
        },
      };

      const result = YamlSecurityValidator.validateYamlObject(nestedDangerousObject);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGEROUS_OBJECT_KEY')).toBe(true);
    });

    it('should handle arrays correctly', () => {
      const objectWithArray = {
        items: [{ safe: 'value' }] as any[],
      };

      // Add dangerous key after creation to avoid TypeScript issues
      objectWithArray.items.push({ constructor: 'dangerous' });

      const result = YamlSecurityValidator.validateYamlObject(objectWithArray);
      expect(result.success).toBe(false);
      expect(result.errors[0].path).toContain('[1]');
    });

    it('should handle non-objects gracefully', () => {
      const stringResult = YamlSecurityValidator.validateYamlObject('string');
      expect(stringResult.success).toBe(true);

      const numberResult = YamlSecurityValidator.validateYamlObject(42);
      expect(numberResult.success).toBe(true);

      const nullResult = YamlSecurityValidator.validateYamlObject(null);
      expect(nullResult.success).toBe(true);
    });

    it('should provide detailed paths for nested errors', () => {
      const nestedObject = {
        workflow: {
          nodes: [
            {
              data: {
                settings: {} as any,
              },
            },
          ],
        },
      };

      // Add dangerous key to avoid TypeScript/JavaScript issues with __proto__
      nestedObject.workflow.nodes[0].data.settings.constructor = 'dangerous';

      const result = YamlSecurityValidator.validateYamlObject(nestedObject);
      expect(result.success).toBe(false);
      expect(result.errors[0].path).toBe('workflow.nodes[0].data.settings.constructor');
    });
  });

  describe('getDefaultSecurityConfig', () => {
    it('should return valid default configuration', () => {
      const config = YamlSecurityValidator.getDefaultSecurityConfig();

      expect(config).toHaveProperty('enableShellSanitization', true);
      expect(config).toHaveProperty('enableYamlValidation', true);
      expect(config).toHaveProperty('maxFileSize');
      expect(config).toHaveProperty('timeoutMs');
      expect(Array.isArray(config.allowedCommands)).toBe(true);
      expect(config.allowedCommands.length).toBeGreaterThan(0);
    });

    it('should include common safe commands', () => {
      const config = YamlSecurityValidator.getDefaultSecurityConfig();

      expect(config.allowedCommands).toContain('git');
      expect(config.allowedCommands).toContain('npm');
      expect(config.allowedCommands).toContain('node');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed regex patterns gracefully', () => {
      // This tests internal robustness
      const contentWithSpecialChars = 'workflow: "test[unclosed"';
      const result = YamlSecurityValidator.validateYamlSecurity(contentWithSpecialChars);

      // Should not throw an error
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(100000);
      const yamlWithLongLine = `workflow:\n  name: "${longLine}"`;

      const result = YamlSecurityValidator.validateYamlSecurity(yamlWithLongLine);
      // Should not crash
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle Unicode content', () => {
      const unicodeYaml = `
        workflow:
          name: "测试工作流"
          emoji: "🚀"
        nodes:
          - title: "Начало"
      `;

      const result = YamlSecurityValidator.validateYamlSecurity(unicodeYaml);
      expect(result.success).toBe(true);
    });
  });
});
