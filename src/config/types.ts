/**
 * Configuration system types for flowsh
 * Defines the structure and validation for all configuration options
 */

export interface FlowshConfig {
  generation: GenerationConfig;
  validation: ValidationConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
}

export interface GenerationConfig {
  /** Default timeout for workflow operations in seconds */
  defaultTimeout: number;
  /** Shell type for script generation */
  shellType: 'bash' | 'zsh';
  /** Mock mode for testing without actual execution */
  mockMode: boolean;
  /** Template cache size for performance optimization */
  templateCacheSize: number;
  /** Output directory for generated scripts */
  outputDirectory: string;
}

export interface ValidationConfig {
  /** Strict mode for enhanced validation */
  strictMode: boolean;
  /** Allow unknown node types in workflows */
  allowUnknownNodes: boolean;
  /** Maximum workflow file size in bytes */
  maxWorkflowSize: number;
  /** Maximum workflow depth for nested structures */
  maxWorkflowDepth: number;
}

export interface LoggingConfig {
  /** Logging level */
  level: 'error' | 'warn' | 'info' | 'debug';
  /** Log format type */
  format: 'json' | 'pretty';
  /** Log output destination */
  destination: 'console' | 'file' | 'both';
  /** Log file path when using file destination */
  filePath?: string;
  /** Enable correlation IDs for request tracing */
  enableCorrelationIds: boolean;
  /** Enable performance timing logs */
  enablePerformanceLogs: boolean;
  /** Enable secrets redaction in logs */
  enableSecretsRedaction: boolean;
}

export interface PerformanceConfig {
  /** Enable performance metrics collection */
  enableMetrics: boolean;
  /** Metrics collection interval in seconds */
  metricsInterval: number;
  /** Enable memory usage tracking */
  enableMemoryTracking: boolean;
  /** Enable timing information */
  enableTiming: boolean;
}

export interface SecurityConfig {
  /** Enable secrets redaction in logs */
  enableSecretsRedaction: boolean;
  /** Patterns to redact from logs */
  redactionPatterns: string[];
  /** Enable configuration validation against injection */
  enableConfigValidation: boolean;
}

export interface ConfigSource {
  /** Configuration file path */
  configFile?: string;
  /** Environment variables */
  env: Record<string, string | undefined>;
  /** CLI arguments */
  cliArgs: Record<string, unknown>;
  /** Override values */
  overrides?: Partial<FlowshConfig>;
}

export interface ConfigLoadResult {
  config: FlowshConfig;
  sources: string[];
  warnings: string[];
}

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
