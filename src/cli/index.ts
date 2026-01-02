#!/usr/bin/env node

/**
 * flowsh CLI - Production-ready Workflow-to-Shell Generator
 *
 * Command-line interface for converting flowsh YAML workflows into executable shell scripts.
 * Features comprehensive configuration, structured logging, error handling, and monitoring.
 */

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';

import { generateShellScript } from '../generation/shell-generator.js';
import { initializeLogger, getLogger } from '../logging/logger.js';
import { FlowshCliError, FlowshError } from '../errors/types.js';
import { createHealthMonitor } from '../monitoring/health.js';
import { parseWorkflowFile } from '../parsing/parser.js';
import { loadConfig } from '../config/loader.js';

// =============================================================================
// Types and Interfaces
// =============================================================================

interface GenerateCommandOptions {
  output?: string;
  mock?: boolean;
  shell?: 'bash' | 'zsh';
  verbose?: boolean;
  timeout?: string;
  validate?: boolean;
  strict?: boolean;
  config?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  logFormat?: 'json' | 'pretty';
}

interface ValidateCommandOptions {
  strict?: boolean;
  verbose?: boolean;
  config?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

interface HealthCommandOptions {
  config?: string;
  format?: 'json' | 'pretty';
}

// =============================================================================
// Global State Management
// =============================================================================

let initialized = false;
const correlationId = uuidv4();

/**
 * Initialize the application with configuration and services
 */
async function initializeApp(
  configFile?: string,
  options: Partial<GenerateCommandOptions> = {}
): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    // Load configuration
    const configSource: any = {
      env: process.env,
      cliArgs: {
        logLevel: options.logLevel,
        logFormat: options.logFormat,
        shell: options.shell,
        mock: options.mock,
        timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
        strict: options.strict,
        output: options.output,
      },
    };

    // Only add configFile if it's defined to avoid exactOptionalPropertyTypes issues
    if (configFile) {
      configSource.configFile = configFile;
    }

    const configResult = await loadConfig(configSource);

    // Initialize structured logging
    const logger = initializeLogger(configResult.config.logging);

    // Initialize health monitoring
    const healthMonitor = createHealthMonitor(
      {
        enabled: configResult.config.performance.enableMetrics,
        checkInterval: configResult.config.performance.metricsInterval * 1000,
        timeout: 5000,
        enableMetrics: true,
        enableDetailedMemory: configResult.config.performance.enableMemoryTracking,
      },
      logger
    );

    // Log successful initialization
    logger.info('Application initialized successfully', {
      correlationId,
      configSources: configResult.sources,
      version: '1.0.0',
      pid: process.pid,
    });

    // Log any configuration warnings
    if (configResult.warnings.length > 0) {
      configResult.warnings.forEach(warning => {
        logger.warn(`Configuration warning: ${warning}`, { correlationId });
      });
    }

    initialized = true;

    // Set up graceful shutdown
    const shutdown = (): void => {
      logger.info('Shutting down application', { correlationId });
      healthMonitor.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(
      'Failed to initialize application:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if error is a FlowshError
 */
function isFlowshError(error: unknown): error is FlowshError {
  return error instanceof FlowshError;
}

/**
 * Handle and log errors with appropriate exit codes
 */
function handleError(error: unknown, operation: string): never {
  const logger = getLogger();

  if (isFlowshError(error)) {
    logger.error(`${operation} failed`, {
      correlationId,
      error: error.toJSON(),
      operation,
    });

    if (error instanceof FlowshCliError) {
      process.exit(error.exitCode);
    }
    process.exit(1);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Unexpected error during ${operation}`, {
    correlationId,
    error: errorMessage,
    operation,
    stack: error instanceof Error ? error.stack : undefined,
  });

  process.exit(1);
}

/**
 * Generate output filename from input filename
 */
async function generateOutputFilename(inputFile: string, outputDir?: string): Promise<string> {
  const path = await import('path');
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const outputName = `${baseName}.sh`;

  if (outputDir) {
    return path.join(outputDir, outputName);
  }

  return outputName;
}

// =============================================================================
// Command Implementations
// =============================================================================

/**
 * Generate shell script from workflow YAML with full production features
 */
async function generateCommand(
  workflowFile: string,
  options: GenerateCommandOptions
): Promise<void> {
  const operationId = uuidv4();

  try {
    await initializeApp(options.config, options);
    const logger = getLogger();
    const operationLogger = logger.createOperationLogger('generate_workflow', {
      correlationId,
      operationId,
      workflowFile,
      options,
    });

    operationLogger.info('Starting workflow generation');

    // Parse and validate workflow
    operationLogger.info('Parsing workflow file');
    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: options.validate !== false,
      strict: options.strict || false,
    });

    if (!parseResult.success || !parseResult.workflow) {
      const error = new FlowshCliError(
        `Failed to parse workflow file: ${parseResult.errors.map(e => e.message).join(', ')}`,
        1,
        { parseResult, workflowFile },
        correlationId
      );
      operationLogger.fail(error);
      throw error;
    }

    operationLogger.info('Workflow parsed successfully', {
      nodeCount: parseResult.workflow.graph?.nodes.length || 0,
      warningCount: parseResult.warnings?.length || 0,
    });

    // Generate shell script
    operationLogger.info('Generating shell script');
    const generateResult = generateShellScript(parseResult.workflow, {
      includeMocks: options.mock !== false,
      shell: options.shell || 'bash',
      verbose: options.verbose || false,
      defaultTimeout: options.timeout ? parseInt(options.timeout, 10) : 60,
    });

    if (!generateResult.success) {
      const error = new FlowshCliError(
        `Failed to generate shell script: ${generateResult.warnings.join(', ')}`,
        1,
        { generateResult, workflowFile },
        correlationId
      );
      operationLogger.fail(error);
      throw error;
    }

    operationLogger.info('Shell script generated successfully', {
      scriptLength: generateResult.script.length,
      metadata: generateResult.metadata,
    });

    // Write output file
    const outputFile = options.output || (await generateOutputFilename(workflowFile));
    operationLogger.info('Writing output file', { outputFile });

    const fs = await import('fs/promises');
    await fs.writeFile(outputFile, generateResult.script, 'utf-8');

    const duration = operationLogger.complete('Workflow generation completed successfully');

    // Display success information
    console.log('✅ Generation completed successfully!');
    console.log(`📄 Output: ${outputFile}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔗 ID: ${correlationId}`);

    if (generateResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      generateResult.warnings.forEach(warning => {
        console.log(`   ${warning}`);
      });
    }

    // Display usage instructions
    console.log('\n💡 Usage:');
    console.log(`   chmod +x ${outputFile}`);
    console.log(`   ./${outputFile} --help`);
  } catch (error) {
    handleError(error, 'generate');
  }
}

/**
 * Validate workflow without generating script
 */
async function validateCommand(
  workflowFile: string,
  options: ValidateCommandOptions
): Promise<void> {
  const operationId = uuidv4();

  try {
    await initializeApp(options.config, options);
    const logger = getLogger();
    const operationLogger = logger.createOperationLogger('validate_workflow', {
      correlationId,
      operationId,
      workflowFile,
      options,
    });

    operationLogger.info('Starting workflow validation');

    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: true,
      strict: options.strict || false,
    });

    if (!parseResult.success) {
      const error = new FlowshCliError(
        `Workflow validation failed: ${parseResult.errors.map(e => e.message).join(', ')}`,
        1,
        { parseResult, workflowFile },
        correlationId
      );
      operationLogger.fail(error);
      throw error;
    }

    const duration = operationLogger.complete('Workflow validation completed successfully');

    // Display success information
    console.log('✅ Validation passed!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔗 ID: ${correlationId}`);

    if (parseResult.workflow?.graph) {
      const graph = parseResult.workflow.graph;
      console.log(`📊 Nodes: ${graph.nodes.length}, Edges: ${graph.edges?.length || 0}`);
    }

    if (parseResult.warnings && parseResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      parseResult.warnings.forEach(warning => {
        console.log(`   ${warning.message}`);
      });
    }
  } catch (error) {
    handleError(error, 'validate');
  }
}

/**
 * Display system health information
 */
async function healthCommand(options: HealthCommandOptions): Promise<void> {
  try {
    await initializeApp(options.config);
    const logger = getLogger();
    const healthMonitor = createHealthMonitor({}, logger);

    const health = await healthMonitor.getSystemHealth();

    if (options.format === 'json') {
      console.log(JSON.stringify(health, null, 2));
    } else {
      // Pretty format
      console.log(
        `🏥 System Health: ${
          health.status === 'healthy'
            ? '✅ Healthy'
            : health.status === 'degraded'
              ? '⚠️  Degraded'
              : '❌ Unhealthy'
        }`
      );
      console.log(`📦 Version: ${health.version}`);
      console.log(`⏱️  Uptime: ${Math.round(health.uptime / 1000)}s`);
      console.log(`🆔 PID: ${health.metrics.process.pid}`);
      console.log(
        `💾 Memory: ${Math.round(health.metrics.memory.percentage)}% (${Math.round(health.metrics.memory.used / 1024 / 1024)}MB)`
      );

      if (health.checks.length > 0) {
        console.log('\n🔍 Health Checks:');
        health.checks.forEach(check => {
          const status =
            check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️ ' : '❌';
          console.log(
            `   ${status} ${check.name}: ${check.message || check.status} (${check.duration}ms)`
          );
        });
      }
    }

    healthMonitor.shutdown();
  } catch (error) {
    handleError(error, 'health check');
  }
}

// =============================================================================
// CLI Setup
// =============================================================================

const program = new Command();

program
  .name('flowsh')
  .description('Production-ready Workflow-to-Shell Generator for AI Agent Orchestration')
  .version('1.0.0')
  .option('-c, --config <file>', 'Configuration file path')
  .option('--log-level <level>', 'Logging level (error|warn|info|debug)', 'info')
  .option('--log-format <format>', 'Log format (json|pretty)', 'pretty');

// Generate command
program
  .command('generate')
  .alias('gen')
  .description('Generate shell script from workflow YAML')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .option('-o, --output <file>', 'Output shell script file')
  .option('--no-mock', 'Generate script without mock implementations')
  .option('--shell <type>', 'Target shell type (bash|zsh)', 'bash')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--timeout <seconds>', 'Default timeout for agent calls', '60')
  .option('--no-validate', 'Skip validation')
  .option('--strict', 'Fail on validation warnings')
  .action(async (workflowFile: string, options: GenerateCommandOptions) => {
    await generateCommand(workflowFile, options);
  });

// Validate command
program
  .command('validate')
  .description('Validate workflow YAML without generating script')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .option('--strict', 'Fail on validation warnings')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (workflowFile: string, options: ValidateCommandOptions) => {
    await validateCommand(workflowFile, options);
  });

// Health command
program
  .command('health')
  .description('Check system health and metrics')
  .option('--format <format>', 'Output format (json|pretty)', 'pretty')
  .action(async (options: HealthCommandOptions) => {
    await healthCommand(options);
  });

// Info command
program
  .command('info')
  .description('Display information about flowsh')
  .action(() => {
    console.log('\n🌊 flowsh - Production-ready Workflow-to-Shell Generator\n');
    console.log('Convert AI workflow YAML files into portable, executable shell scripts.');
    console.log(
      'Built for production with comprehensive logging, monitoring, and error handling.\n'
    );

    console.log('✨ Production Features:');
    console.log('  • Hierarchical configuration system');
    console.log('  • Structured logging with correlation IDs');
    console.log('  • Comprehensive error handling and recovery');
    console.log('  • Health monitoring and metrics');
    console.log('  • Type-safe Result patterns');
    console.log('  • Performance tracking and optimization\n');

    console.log('🔧 Workflow Features:');
    console.log('  • Parse and validate flowsh YAML workflows');
    console.log('  • Generate portable bash/zsh scripts');
    console.log('  • Agent orchestration (opencode, custom CLI tools)');
    console.log('  • Mock implementations for testing');
    console.log('  • Template system integration\n');

    console.log('📋 Supported Node Types:');
    console.log('  • start/end - Workflow boundaries');
    console.log('  • agent - CLI tool orchestration');
    console.log('  • code - Shell command execution');
    console.log('  • llm - AI model integration');
    console.log('  • if-else - Conditional logic');
    console.log('  • variable-assignment - State management');
    console.log('  • answer - Workflow outputs\n');
  });

// Error handling
program.configureOutput({
  writeErr: (str: string) => {
    if (initialized) {
      const logger = getLogger();
      logger.error('CLI error', { message: str.trim(), correlationId });
    }
    process.stderr.write(str);
  },
});

// Handle unknown commands
program.on('command:*', () => {
  console.error(`❌ Unknown command: ${program.args.join(' ')}`);
  console.error('💡 Run --help to see available commands');
  process.exit(1);
});

// Handle no arguments
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

// Global error handlers
process.on('uncaughtException', error => {
  console.error('💥 Uncaught Exception:', error.message);
  if (initialized) {
    const logger = getLogger();
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
      correlationId,
    });
  }
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('💥 Unhandled Rejection:', reason);
  if (initialized) {
    const logger = getLogger();
    logger.error('Unhandled rejection', {
      reason: String(reason),
      correlationId,
    });
  }
  process.exit(1);
});

// Parse command line arguments
program.parse();

export default program;
