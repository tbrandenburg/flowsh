/**
 * Configuration loader for flowsh
 * Implements hierarchical configuration loading from multiple sources
 */
import { cosmiconfigSync } from 'cosmiconfig';
import { merge } from 'lodash-es';
import { FlowshConfig, DEFAULT_CONFIG, ConfigSource, ConfigLoadResult } from './types.js';
import { validateConfigWithDetails } from './schema.js';

/**
 * Deep clone utility to avoid mutation
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private moduleName = 'flowsh';

  /**
   * Loads configuration from multiple sources with proper precedence
   */
  async loadConfig(source: ConfigSource): Promise<ConfigLoadResult> {
    const sources: string[] = [];
    const warnings: string[] = [];
    let config = deepClone(DEFAULT_CONFIG);

    try {
      // 1. Load from configuration file (if specified or auto-discovered)
      const fileConfig = await this.loadFromFile(source.configFile);
      if (fileConfig.config) {
        config = merge(config, fileConfig.config);
        sources.push(...fileConfig.sources);
      }

      // 2. Load from environment variables
      const envConfig = this.loadFromEnvironment(source.env);
      if (envConfig.config) {
        config = merge(config, envConfig.config);
        sources.push(...envConfig.sources);
      }

      // 3. Load from CLI arguments (highest precedence)
      const cliConfig = this.loadFromCliArgs(source.cliArgs);
      if (cliConfig.config) {
        config = merge(config, cliConfig.config);
        sources.push(...cliConfig.sources);
      }

      // 4. Apply any manual overrides
      if (source.overrides) {
        config = merge(config, source.overrides);
        sources.push('manual overrides');
      }

      // Validate final configuration
      const validation = validateConfigWithDetails(config);
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(
          err =>
            `${err.path}: ${err.message}${err.value !== undefined ? ` (got: ${JSON.stringify(err.value)})` : ''}`
        );
        throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
      }

      return {
        config: validation.config!,
        sources: sources.length > 0 ? sources : ['defaults'],
        warnings,
      };
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load configuration from file (auto-discovery or specified path)
   */
  private async loadFromFile(configFile?: string): Promise<{
    config?: Partial<FlowshConfig>;
    sources: string[];
  }> {
    try {
      const explorer = cosmiconfigSync(this.moduleName);

      let result;
      if (configFile) {
        // Load specific configuration file
        result = explorer.load(configFile);
      } else {
        // Auto-discover configuration file
        result = explorer.search();
      }

      if (result && result.config) {
        return {
          config: result.config as Partial<FlowshConfig>,
          sources: [result.filepath],
        };
      }

      return { sources: [] };
    } catch (error) {
      if (configFile) {
        // Specified config file should exist
        throw new Error(
          `Failed to load config file "${configFile}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Auto-discovery failure is not an error
      return { sources: [] };
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(env: Record<string, string | undefined>): {
    config?: Partial<FlowshConfig>;
    sources: string[];
  } {
    const config: any = {};
    const sources: string[] = [];

    // Generation configuration
    if (env['FLOWSH_DEFAULT_TIMEOUT']) {
      const timeout = parseInt(env['FLOWSH_DEFAULT_TIMEOUT'], 10);
      if (!isNaN(timeout)) {
        if (!config.generation) config.generation = {};
        config.generation.defaultTimeout = timeout;
        sources.push('FLOWSH_DEFAULT_TIMEOUT');
      }
    }

    if (
      env['FLOWSH_SHELL_TYPE'] &&
      (env['FLOWSH_SHELL_TYPE'] === 'bash' || env['FLOWSH_SHELL_TYPE'] === 'zsh')
    ) {
      if (!config.generation) config.generation = {};
      config.generation.shellType = env['FLOWSH_SHELL_TYPE'];
      sources.push('FLOWSH_SHELL_TYPE');
    }

    if (env['FLOWSH_MOCK_MODE']) {
      if (!config.generation) config.generation = {};
      config.generation.mockMode = env['FLOWSH_MOCK_MODE'] === 'true';
      sources.push('FLOWSH_MOCK_MODE');
    }

    if (env['FLOWSH_OUTPUT_DIRECTORY']) {
      if (!config.generation) config.generation = {};
      config.generation.outputDirectory = env['FLOWSH_OUTPUT_DIRECTORY'];
      sources.push('FLOWSH_OUTPUT_DIRECTORY');
    }

    // Validation configuration
    if (env['FLOWSH_STRICT_MODE']) {
      if (!config.validation) config.validation = {};
      config.validation.strictMode = env['FLOWSH_STRICT_MODE'] === 'true';
      sources.push('FLOWSH_STRICT_MODE');
    }

    if (env['FLOWSH_ALLOW_UNKNOWN_NODES']) {
      if (!config.validation) config.validation = {};
      config.validation.allowUnknownNodes = env['FLOWSH_ALLOW_UNKNOWN_NODES'] === 'true';
      sources.push('FLOWSH_ALLOW_UNKNOWN_NODES');
    }

    // Logging configuration
    if (
      env['FLOWSH_LOG_LEVEL'] &&
      ['error', 'warn', 'info', 'debug'].includes(env['FLOWSH_LOG_LEVEL'])
    ) {
      if (!config.logging) config.logging = {};
      config.logging.level = env['FLOWSH_LOG_LEVEL'];
      sources.push('FLOWSH_LOG_LEVEL');
    }

    if (env['FLOWSH_LOG_FORMAT'] && ['json', 'pretty'].includes(env['FLOWSH_LOG_FORMAT'])) {
      if (!config.logging) config.logging = {};
      config.logging.format = env['FLOWSH_LOG_FORMAT'];
      sources.push('FLOWSH_LOG_FORMAT');
    }

    if (
      env['FLOWSH_LOG_DESTINATION'] &&
      ['console', 'file', 'both'].includes(env['FLOWSH_LOG_DESTINATION'])
    ) {
      if (!config.logging) config.logging = {};
      config.logging.destination = env['FLOWSH_LOG_DESTINATION'];
      sources.push('FLOWSH_LOG_DESTINATION');
    }

    if (env['FLOWSH_LOG_FILE_PATH']) {
      if (!config.logging) config.logging = {};
      config.logging.filePath = env['FLOWSH_LOG_FILE_PATH'];
      sources.push('FLOWSH_LOG_FILE_PATH');
    }

    return sources.length > 0 ? { config, sources } : { sources: [] };
  }

  /**
   * Load configuration from CLI arguments
   */
  private loadFromCliArgs(cliArgs: Record<string, unknown>): {
    config?: Partial<FlowshConfig>;
    sources: string[];
  } {
    const config: any = {};
    const sources: string[] = [];

    // Map CLI arguments to configuration
    if (typeof cliArgs['timeout'] === 'number') {
      if (!config.generation) config.generation = {};
      config.generation.defaultTimeout = cliArgs['timeout'];
      sources.push('--timeout');
    }

    if (
      typeof cliArgs['shell'] === 'string' &&
      (cliArgs['shell'] === 'bash' || cliArgs['shell'] === 'zsh')
    ) {
      if (!config.generation) config.generation = {};
      config.generation.shellType = cliArgs['shell'];
      sources.push('--shell');
    }

    if (typeof cliArgs['mock'] === 'boolean') {
      if (!config.generation) config.generation = {};
      config.generation.mockMode = cliArgs['mock'];
      sources.push('--mock');
    }

    if (typeof cliArgs['output'] === 'string') {
      if (!config.generation) config.generation = {};
      config.generation.outputDirectory = cliArgs['output'];
      sources.push('--output');
    }

    if (typeof cliArgs['strict'] === 'boolean') {
      if (!config.validation) config.validation = {};
      config.validation.strictMode = cliArgs['strict'];
      sources.push('--strict');
    }

    if (
      typeof cliArgs['logLevel'] === 'string' &&
      ['error', 'warn', 'info', 'debug'].includes(cliArgs['logLevel'])
    ) {
      if (!config.logging) config.logging = {};
      config.logging.level = cliArgs['logLevel'];
      sources.push('--log-level');
    }

    if (
      typeof cliArgs['logFormat'] === 'string' &&
      ['json', 'pretty'].includes(cliArgs['logFormat'])
    ) {
      if (!config.logging) config.logging = {};
      config.logging.format = cliArgs['logFormat'];
      sources.push('--log-format');
    }

    return sources.length > 0 ? { config, sources } : { sources: [] };
  }

  /**
   * Get configuration file search paths
   */
  getConfigSearchPaths(): string[] {
    return [
      'package.json',
      `.${this.moduleName}rc`,
      `.${this.moduleName}rc.json`,
      `.${this.moduleName}rc.yaml`,
      `.${this.moduleName}rc.yml`,
      `.${this.moduleName}rc.js`,
      `.${this.moduleName}rc.cjs`,
      `.${this.moduleName}rc.mjs`,
      `${this.moduleName}.config.js`,
      `${this.moduleName}.config.cjs`,
      `${this.moduleName}.config.mjs`,
    ];
  }
}

/**
 * Default configuration loader instance
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load configuration
 */
export async function loadConfig(source: ConfigSource): Promise<ConfigLoadResult> {
  return configLoader.loadConfig(source);
}
