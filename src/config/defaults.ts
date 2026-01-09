/**
 * Default configuration values for flowsh
 * Centralized location for all default configuration settings
 */
import type { FlowshConfig } from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: FlowshConfig = {
  generation: {
    defaultTimeout: 60,
    shellType: 'bash',
    mockMode: true,
    templateCacheSize: 100,
    outputDirectory: './output',
  },
  validation: {
    strictMode: false,
    allowUnknownNodes: false,
    maxWorkflowSize: 10 * 1024 * 1024, // 10MB
    maxWorkflowDepth: 20,
  },
  logging: {
    level: 'info',
    format: 'pretty',
    destination: 'console',
    enableCorrelationIds: true,
    enablePerformanceLogs: false,
    enableSecretsRedaction: true,
  },
  performance: {
    enableMetrics: false,
    metricsInterval: 60,
    enableMemoryTracking: false,
    enableTiming: false,
  },
  security: {
    enableSecretsRedaction: true,
    redactionPatterns: [
      '(password|secret|key|token)\\s*[:=]\\s*[\\S]+',
      'Bearer\\s+[\\S]+',
      'api[_-]?key\\s*[:=]\\s*[\\S]+',
    ],
    enableConfigValidation: true,
  },
};
