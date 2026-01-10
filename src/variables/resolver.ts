/**
 * Variable Resolution Logic for flowsh
 *
 * This module resolves conversation variables from multiple sources
 * with priority order: environment > cli-args > defaults > fail if required
 */

import { WorkflowConversationVariable } from '../dsl/types.js';
import {
  ResolvedVariable,
  VariableResolutionConfig,
  VariableResolutionError,
  VariableSource,
} from './types.js';
import { DefaultProcessor } from './defaults.js';
import { Result, ok, err } from 'neverthrow';

export class VariableResolver {
  /**
   * Resolve conversation variables from multiple sources
   */
  static resolve(
    conversationVars: WorkflowConversationVariable[],
    config: VariableResolutionConfig
  ): Result<ResolvedVariable[], VariableResolutionError[]> {
    const resolved: ResolvedVariable[] = [];
    const errors: VariableResolutionError[] = [];

    for (const variable of conversationVars) {
      const resolutionResult = this.resolveVariable(variable, config);

      if (resolutionResult.isOk()) {
        resolved.push(resolutionResult.value);
      } else {
        errors.push(resolutionResult.error);
      }
    }

    if (errors.length > 0 && config.fail_on_missing_required) {
      return err(errors);
    }

    return ok(resolved);
  }

  /**
   * Resolve a single variable from sources
   */
  private static resolveVariable(
    variable: WorkflowConversationVariable,
    config: VariableResolutionConfig
  ): Result<ResolvedVariable, VariableResolutionError> {
    const uppercaseName = DefaultProcessor.toEnvironmentVariableName(variable.variable);

    // Priority order: environment > cli-args > defaults
    for (const source of config.variable_sources) {
      const sourceResult = this.resolveFromSource(variable, source, uppercaseName);
      if (sourceResult.isOk()) {
        return ok(sourceResult.value);
      }
    }

    // No value found from any source
    if (variable.required && config.fail_on_missing_required) {
      return err({
        variable: variable.variable,
        error: 'missing-required',
        message: `Required variable '${variable.variable}' not provided and no default available`,
      });
    }

    // Return a placeholder for missing optional variables
    return ok({
      name: variable.variable,
      value: '',
      source: 'required-missing',
      uppercase_name: uppercaseName,
    });
  }

  /**
   * Attempt to resolve variable from a specific source
   */
  private static resolveFromSource(
    variable: WorkflowConversationVariable,
    source: VariableSource,
    uppercaseName: string
  ): Result<ResolvedVariable, string> {
    switch (source.type) {
      case 'environment': {
        const envValue = process.env[uppercaseName];
        if (envValue !== undefined) {
          return ok({
            name: variable.variable,
            value: envValue,
            source: 'environment',
            uppercase_name: uppercaseName,
          });
        }
        break;
      }

      case 'cli-args': {
        const cliValue = source.args[variable.variable] || source.args[uppercaseName];
        if (cliValue !== undefined) {
          return ok({
            name: variable.variable,
            value: cliValue,
            source: 'cli-arg',
            uppercase_name: uppercaseName,
          });
        }
        break;
      }

      case 'defaults': {
        if (variable.default !== undefined) {
          const defaultResult = DefaultProcessor.processDefault(variable);
          if (defaultResult.isOk()) {
            return ok({
              name: variable.variable,
              value: defaultResult.value.value,
              source: 'default',
              uppercase_name: uppercaseName,
            });
          }
          return err(
            `Failed to process default for '${variable.variable}': ${defaultResult.error}`
          );
        }
        break;
      }
    }

    return err(`No value found from source ${source.type}`);
  }

  /**
   * Create a standard resolution configuration
   */
  static createDefaultConfig(): VariableResolutionConfig {
    return {
      use_defaults: true,
      fail_on_missing_required: true,
      variable_sources: [{ type: 'environment' }, { type: 'defaults' }],
    };
  }

  /**
   * Create a resolution configuration with CLI arguments
   */
  static createConfigWithCliArgs(cliArgs: Record<string, string>): VariableResolutionConfig {
    return {
      use_defaults: true,
      fail_on_missing_required: true,
      variable_sources: [
        { type: 'environment' },
        { type: 'cli-args', args: cliArgs },
        { type: 'defaults' },
      ],
    };
  }

  /**
   * Filter resolved variables to only those that have actual values
   */
  static filterResolved(variables: ResolvedVariable[]): ResolvedVariable[] {
    return variables.filter(
      variable => variable.source !== 'required-missing' && variable.value !== ''
    );
  }

  /**
   * Get missing required variables for error reporting
   */
  static getMissingRequired(variables: ResolvedVariable[]): string[] {
    return variables
      .filter(variable => variable.source === 'required-missing')
      .map(variable => variable.name);
  }
}
