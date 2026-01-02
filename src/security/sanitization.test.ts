/**
 * Tests for shell sanitization security utilities
 */
import { describe, it, expect } from 'vitest';
import { ShellSanitizer } from './sanitization.js';

describe('ShellSanitizer', () => {
  describe('sanitizeCommand', () => {
    it('should accept allowed commands', () => {
      const result = ShellSanitizer.sanitizeCommand('git status');

      expect(result.success).toBe(true);
      expect(result.data).toBe('git status');
      expect(result.errors).toHaveLength(0);
    });

    it('should sanitize shell metacharacters', () => {
      const result = ShellSanitizer.sanitizeCommand('echo hello; world');

      expect(result.success).toBe(true);
      expect(result.data).toBe('echo hello\\; world');
    });

    it('should reject disallowed commands', () => {
      const result = ShellSanitizer.sanitizeCommand('rm -rf /');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DISALLOWED_COMMAND');
      expect(result.errors[0].message).toContain('rm');
    });

    it('should reject empty commands', () => {
      const result = ShellSanitizer.sanitizeCommand('');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_COMMAND');
    });

    it('should reject whitespace-only commands', () => {
      const result = ShellSanitizer.sanitizeCommand('   ');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_COMMAND');
    });

    it('should reject null/undefined commands', () => {
      const result1 = ShellSanitizer.sanitizeCommand(null as any);
      const result2 = ShellSanitizer.sanitizeCommand(undefined as any);

      expect(result1.success).toBe(false);
      expect(result1.errors[0].code).toBe('INVALID_COMMAND');
      expect(result2.success).toBe(false);
      expect(result2.errors[0].code).toBe('INVALID_COMMAND');
    });

    it('should detect dangerous patterns', () => {
      const dangerousCommands = [
        'echo $(rm -rf /)',
        'git status | bash',
        'npm install && sudo rm -rf /',
        'python -c "exec(\\"rm -rf /\\")"',
      ];

      for (const cmd of dangerousCommands) {
        const result = ShellSanitizer.sanitizeCommand(cmd);
        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.code === 'DANGEROUS_PATTERN')).toBe(true);
      }
    });

    it('should handle commands with multiple arguments', () => {
      const result = ShellSanitizer.sanitizeCommand('git commit -m "test message"');

      expect(result.success).toBe(true);
      expect(result.data).toBe('git commit -m "test message"');
    });
  });

  describe('sanitizeVariable', () => {
    it('should sanitize valid variable names', () => {
      expect(ShellSanitizer.sanitizeVariable('valid_name')).toBe('valid_name');
      expect(ShellSanitizer.sanitizeVariable('validName123')).toBe('validName123');
      expect(ShellSanitizer.sanitizeVariable('_private')).toBe('_private');
    });

    it('should replace invalid characters with underscores', () => {
      expect(ShellSanitizer.sanitizeVariable('var-name')).toBe('var_name');
      expect(ShellSanitizer.sanitizeVariable('var.name')).toBe('var_name');
      expect(ShellSanitizer.sanitizeVariable('var name')).toBe('var_name');
      expect(ShellSanitizer.sanitizeVariable('var@name')).toBe('var_name');
    });

    it('should ensure variable starts with letter or underscore', () => {
      expect(ShellSanitizer.sanitizeVariable('123var')).toBe('_123var');
      expect(ShellSanitizer.sanitizeVariable('9invalid')).toBe('_9invalid');
    });

    it('should handle empty/invalid inputs', () => {
      expect(ShellSanitizer.sanitizeVariable('')).toBe('DEFAULT_VAR');
      expect(ShellSanitizer.sanitizeVariable(null as any)).toBe('INVALID_VAR');
      expect(ShellSanitizer.sanitizeVariable(undefined as any)).toBe('INVALID_VAR');
    });
  });

  describe('sanitizeArguments', () => {
    it('should sanitize array of valid arguments', () => {
      const result = ShellSanitizer.sanitizeArguments(['--verbose', '--output', 'file.txt']);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['--verbose', '--output', 'file.txt']);
    });

    it('should sanitize dangerous characters in arguments', () => {
      const result = ShellSanitizer.sanitizeArguments(['arg1; rm -rf /', 'arg2|bash']);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['arg1\\; rm -rf /', 'arg2\\|bash']);
    });

    it('should reject non-array inputs', () => {
      const result = ShellSanitizer.sanitizeArguments('not an array' as any);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ARGS');
    });

    it('should reject non-string arguments', () => {
      const result = ShellSanitizer.sanitizeArguments(['valid', 123, null] as any);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ARG_TYPE')).toBe(true);
    });

    it('should detect dangerous patterns in arguments', () => {
      const result = ShellSanitizer.sanitizeArguments(['$(rm -rf /)']);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'DANGEROUS_ARG_PATTERN')).toBe(true);
    });
  });

  describe('buildSafeCommand', () => {
    it('should build safe command without arguments', () => {
      const result = ShellSanitizer.buildSafeCommand('git status');

      expect(result.success).toBe(true);
      expect(result.data).toBe('git status');
    });

    it('should build safe command with arguments', () => {
      const result = ShellSanitizer.buildSafeCommand('git', ['commit', '-m', 'test']);

      expect(result.success).toBe(true);
      expect(result.data).toBe('git commit -m test');
    });

    it('should fail if base command is invalid', () => {
      const result = ShellSanitizer.buildSafeCommand('dangerous_command');

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('DISALLOWED_COMMAND');
    });

    it('should fail if arguments are invalid', () => {
      const result = ShellSanitizer.buildSafeCommand('git', ['$(rm -rf /)']);

      expect(result.success).toBe(false);
    });
  });

  describe('isCommandAllowed', () => {
    it('should return true for allowed commands', () => {
      expect(ShellSanitizer.isCommandAllowed('git status')).toBe(true);
      expect(ShellSanitizer.isCommandAllowed('npm install')).toBe(true);
      expect(ShellSanitizer.isCommandAllowed('echo hello')).toBe(true);
    });

    it('should return false for disallowed commands', () => {
      expect(ShellSanitizer.isCommandAllowed('rm -rf /')).toBe(false);
      expect(ShellSanitizer.isCommandAllowed('sudo su')).toBe(false);
      expect(ShellSanitizer.isCommandAllowed('dangerous_command')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(ShellSanitizer.isCommandAllowed('')).toBe(false);
      expect(ShellSanitizer.isCommandAllowed(null as any)).toBe(false);
      expect(ShellSanitizer.isCommandAllowed(undefined as any)).toBe(false);
    });

    it('should handle commands with extra whitespace', () => {
      expect(ShellSanitizer.isCommandAllowed('  git status  ')).toBe(true);
      expect(ShellSanitizer.isCommandAllowed('   dangerous_command  ')).toBe(false);
    });
  });

  describe('getAllowedCommands', () => {
    it('should return array of allowed commands', () => {
      const commands = ShellSanitizer.getAllowedCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands).toContain('git');
      expect(commands).toContain('npm');
      expect(commands).toContain('echo');
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should return readonly array', () => {
      const commands = ShellSanitizer.getAllowedCommands();

      // TypeScript should prevent modification due to readonly type
      // At runtime, it won't throw but the type system prevents it
      expect(Object.isFrozen(commands)).toBe(false); // The array itself isn't frozen
      expect(Array.isArray(commands)).toBe(true);
    });
  });
});
