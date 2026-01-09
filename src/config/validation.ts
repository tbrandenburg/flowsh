/**
 * Configuration validation functions using Joi
 * Provides comprehensive validation for all configuration options
 */
import type { FlowshConfig } from './types.js';
import { configSchema } from './schema.js';
import Joi from 'joi';

/**
 * Validates configuration object against schema
 */
export function validateConfig(config: unknown): {
  value: FlowshConfig;
  error?: Joi.ValidationError;
} {
  const result = configSchema.validate(config, {
    allowUnknown: false,
    abortEarly: false,
    stripUnknown: true,
  });

  if (result.error) {
    return {
      value: result.value,
      error: result.error,
    };
  }

  return {
    value: result.value,
  };
}

/**
 * Validates and formats configuration with detailed error messages
 */
export function validateConfigWithDetails(config: unknown): {
  isValid: boolean;
  config?: FlowshConfig;
  errors: Array<{
    path: string;
    message: string;
    value: unknown;
  }>;
} {
  const result = validateConfig(config);

  if (!result.error) {
    return {
      isValid: true,
      config: result.value,
      errors: [],
    };
  }

  const errors = result.error.details.map(detail => ({
    path: detail.path.join('.'),
    message: detail.message,
    value: detail.context?.value,
  }));

  return {
    isValid: false,
    errors,
  };
}

/**
 * Get configuration schema description for documentation
 */
export function getConfigSchemaDescription(): Record<string, unknown> {
  return configSchema.describe();
}
