/**
 * Configuration schema validation using Joi
 * Provides comprehensive validation for all configuration options
 */
import { FlowshConfig } from './types.js';
import Joi from 'joi';

/**
 * Joi schema for generation configuration
 */
const generationSchema = Joi.object({
  defaultTimeout: Joi.number()
    .integer()
    .min(1)
    .max(3600)
    .default(60)
    .description('Default timeout for workflow operations in seconds'),
  shellType: Joi.string()
    .valid('bash', 'zsh')
    .default('bash')
    .description('Shell type for script generation'),
  mockMode: Joi.boolean()
    .default(true)
    .description('Mock mode for testing without actual execution'),
  templateCacheSize: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .description('Template cache size for performance optimization'),
  outputDirectory: Joi.string()
    .default('./output')
    .description('Output directory for generated scripts'),
}).required();

/**
 * Joi schema for validation configuration
 */
const validationSchema = Joi.object({
  strictMode: Joi.boolean().default(false).description('Strict mode for enhanced validation'),
  allowUnknownNodes: Joi.boolean()
    .default(false)
    .description('Allow unknown node types in workflows'),
  maxWorkflowSize: Joi.number()
    .integer()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024)
    .description('Maximum workflow file size in bytes'),
  maxWorkflowDepth: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .description('Maximum workflow depth for nested structures'),
}).required();

/**
 * Joi schema for logging configuration
 */
const loggingSchema = Joi.object({
  level: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Logging level'),
  format: Joi.string().valid('json', 'pretty').default('pretty').description('Log format type'),
  destination: Joi.string()
    .valid('console', 'file', 'both')
    .default('console')
    .description('Log output destination'),
  filePath: Joi.string()
    .when('destination', {
      is: Joi.string().valid('file', 'both'),
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('Log file path when using file destination'),
  enableCorrelationIds: Joi.boolean()
    .default(true)
    .description('Enable correlation IDs for request tracing'),
  enablePerformanceLogs: Joi.boolean().default(false).description('Enable performance timing logs'),
  enableSecretsRedaction: Joi.boolean()
    .default(true)
    .description('Enable secrets redaction in logs'),
}).required();

/**
 * Joi schema for performance configuration
 */
const performanceSchema = Joi.object({
  enableMetrics: Joi.boolean().default(false).description('Enable performance metrics collection'),
  metricsInterval: Joi.number()
    .integer()
    .min(1)
    .max(3600)
    .default(60)
    .description('Metrics collection interval in seconds'),
  enableMemoryTracking: Joi.boolean().default(false).description('Enable memory usage tracking'),
  enableTiming: Joi.boolean().default(false).description('Enable timing information'),
}).required();

/**
 * Joi schema for security configuration
 */
const securitySchema = Joi.object({
  enableSecretsRedaction: Joi.boolean()
    .default(true)
    .description('Enable secrets redaction in logs'),
  redactionPatterns: Joi.array()
    .items(Joi.string())
    .default([
      '(password|secret|key|token)\\s*[:=]\\s*[\\S]+',
      'Bearer\\s+[\\S]+',
      'api[_-]?key\\s*[:=]\\s*[\\S]+',
    ])
    .description('Patterns to redact from logs'),
  enableConfigValidation: Joi.boolean()
    .default(true)
    .description('Enable configuration validation against injection'),
}).required();

/**
 * Complete configuration schema
 */
export const configSchema = Joi.object({
  generation: generationSchema,
  validation: validationSchema,
  logging: loggingSchema,
  performance: performanceSchema,
  security: securitySchema,
}).required();

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
