/**
 * Shell Variable Initialization Generation
 *
 * This module generates bash initialization code for resolved variables
 * using parameter expansion syntax: VAR="${VAR:-"default"}"
 */

import { ResolvedVariable } from '../../variables/types.js';
import { ShellEscaping } from './escaping.js';

export class VariableInitGenerator {
  /**
   * Generate bash variable initialization block
   */
  static generateInitialization(resolvedVars: ResolvedVariable[]): string {
    if (resolvedVars.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('# Auto-generated variable initialization');

    // Filter out variables that are missing and required
    const variablesToInit = resolvedVars.filter(variable => variable.source !== 'required-missing');

    for (const variable of variablesToInit) {
      const initLine = this.generateVariableInit(variable);
      lines.push(initLine);
    }

    lines.push(''); // Add empty line after initialization block

    return lines.join('\n');
  }

  /**
   * Generate initialization for a single variable
   */
  private static generateVariableInit(variable: ResolvedVariable): string {
    const { uppercase_name, value, source } = variable;

    switch (source) {
      case 'default': {
        // Use parameter expansion with default value
        const escapedDefault = ShellEscaping.forExpressionContext(value);
        return `${uppercase_name}="\${${uppercase_name}:-${escapedDefault}}"`;
      }

      case 'environment':
      case 'cli-arg': {
        // Variable already set, but ensure it's defined with fallback
        const escapedValue = ShellEscaping.forExpressionContext(value);
        return `${uppercase_name}="\${${uppercase_name}:-${escapedValue}}"`;
      }

      default: {
        // Fallback case
        const escapedValue = ShellEscaping.forExpressionContext(value);
        return `${uppercase_name}="\${${uppercase_name}:-${escapedValue}}"`;
      }
    }
  }

  /**
   * Generate variable validation checks for required variables
   */
  static generateValidation(resolvedVars: ResolvedVariable[]): string {
    const requiredVars = resolvedVars.filter(variable => variable.source === 'required-missing');

    if (requiredVars.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('# Validate required variables');

    for (const variable of requiredVars) {
      const { uppercase_name, name } = variable;
      lines.push(`if [[ -z "\${${uppercase_name}:-}" ]]; then`);
      lines.push(
        `    echo "Error: Required variable '${name}' (${uppercase_name}) is not set" >&2`
      );
      lines.push(`    exit 1`);
      lines.push('fi');
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate export statements for variables (if needed for sub-processes)
   */
  static generateExports(resolvedVars: ResolvedVariable[]): string {
    const variablesToExport = resolvedVars.filter(
      variable => variable.source !== 'required-missing'
    );

    if (variablesToExport.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('# Export variables for sub-processes');

    for (const variable of variablesToExport) {
      lines.push(`export ${variable.uppercase_name}`);
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate complete variable setup block (initialization + validation + exports)
   */
  static generateCompleteSetup(
    resolvedVars: ResolvedVariable[],
    options: {
      includeValidation?: boolean;
      includeExports?: boolean;
    } = {}
  ): string {
    const { includeValidation = true, includeExports = false } = options;

    const blocks: string[] = [];

    // Variable initialization
    const initialization = this.generateInitialization(resolvedVars);
    if (initialization) {
      blocks.push(initialization);
    }

    // Variable validation
    if (includeValidation) {
      const validation = this.generateValidation(resolvedVars);
      if (validation) {
        blocks.push(validation);
      }
    }

    // Variable exports
    if (includeExports) {
      const exports = this.generateExports(resolvedVars);
      if (exports) {
        blocks.push(exports);
      }
    }

    return blocks.join('\n');
  }
}
