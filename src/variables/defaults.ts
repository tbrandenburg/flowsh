/**
 * Default Value Processing and Validation for Variables
 *
 * This module handles type conversion and validation of default values
 * for workflow conversation variables.
 */

import { WorkflowConversationVariable } from '../dsl/types.js';
import { Result, ok, err } from 'neverthrow';

export interface ProcessedDefault {
  value: string;
  validated: boolean;
  converted_type: 'string' | 'number' | 'boolean';
}

export class DefaultProcessor {
  /**
   * Process and validate a default value from conversation variable definition
   */
  static processDefault(variable: WorkflowConversationVariable): Result<ProcessedDefault, string> {
    const { default: defaultValue, type, validation } = variable;

    if (defaultValue === undefined) {
      return err(`No default value provided for variable '${variable.variable}'`);
    }

    // Convert to string representation for shell scripts
    let stringValue: string;
    let convertedType: 'string' | 'number' | 'boolean';

    try {
      switch (type) {
        case 'text':
        case 'text-input':
        case 'select':
          stringValue = String(defaultValue);
          convertedType = 'string';
          break;
        case 'number':
          if (typeof defaultValue === 'number') {
            stringValue = String(defaultValue);
          } else {
            const parsed = Number(defaultValue);
            if (isNaN(parsed)) {
              return err(
                `Default value '${defaultValue}' is not a valid number for variable '${variable.variable}'`
              );
            }
            stringValue = String(parsed);
          }
          convertedType = 'number';
          break;
        case 'boolean':
          if (typeof defaultValue === 'boolean') {
            stringValue = defaultValue ? 'true' : 'false';
          } else {
            const lowerStr = String(defaultValue).toLowerCase();
            if (lowerStr === 'true' || lowerStr === 'false') {
              stringValue = lowerStr;
            } else {
              return err(
                `Default value '${defaultValue}' is not a valid boolean for variable '${variable.variable}'`
              );
            }
          }
          convertedType = 'boolean';
          break;
        default:
          stringValue = String(defaultValue);
          convertedType = 'string';
      }

      // Apply validation rules if present
      let validated = true;
      if (validation) {
        const validationResult = this.validateValue(stringValue, validation, type);
        if (validationResult.isErr()) {
          return err(
            `Default value validation failed for '${variable.variable}': ${validationResult.error}`
          );
        }
        validated = validationResult.value;
      }

      return ok({
        value: stringValue,
        validated,
        converted_type: convertedType,
      });
    } catch (error) {
      return err(`Error processing default value for '${variable.variable}': ${error}`);
    }
  }

  /**
   * Validate a value against validation rules
   */
  private static validateValue(
    value: string,
    validation: NonNullable<WorkflowConversationVariable['validation']>,
    type: WorkflowConversationVariable['type']
  ): Result<boolean, string> {
    try {
      // Numeric validation
      if (type === 'number' && (validation.min !== undefined || validation.max !== undefined)) {
        const numValue = Number(value);
        if (validation.min !== undefined && numValue < validation.min) {
          return err(`Value ${value} is below minimum ${validation.min}`);
        }
        if (validation.max !== undefined && numValue > validation.max) {
          return err(`Value ${value} is above maximum ${validation.max}`);
        }
      }

      // String length validation (treating min/max as string length for text types)
      if (
        (type === 'text' || type === 'text-input') &&
        (validation.min !== undefined || validation.max !== undefined)
      ) {
        if (validation.min !== undefined && value.length < validation.min) {
          return err(`Value length ${value.length} is below minimum ${validation.min}`);
        }
        if (validation.max !== undefined && value.length > validation.max) {
          return err(`Value length ${value.length} is above maximum ${validation.max}`);
        }
      }

      // Pattern validation
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return err(`Value '${value}' does not match pattern '${validation.pattern}'`);
        }
      }

      return ok(true);
    } catch (error) {
      return err(`Validation error: ${error}`);
    }
  }

  /**
   * Convert a template variable name to uppercase environment variable name
   * user_topic -> USER_TOPIC
   */
  static toEnvironmentVariableName(variableName: string): string {
    return variableName.toUpperCase();
  }
}
