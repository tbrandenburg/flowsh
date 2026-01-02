#!/usr/bin/env node

/**
 * flowsh CLI - Production-ready Workflow-to-Shell Generator with Fancy TUI
 *
 * Command-line interface for converting flowsh YAML workflows into executable shell scripts.
 * Features comprehensive configuration, structured logging, error handling, monitoring,
 * and a fancy geeky terminal user interface.
 */

import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';

import { generateReactFlowOutput } from '../visualization/generator.js';
import { generateShellScript } from '../generation/shell-generator.js';
import { initializeLogger, getLogger } from '../logging/logger.js';
import { FlowshCliError, FlowshError } from '../errors/types.js';
import { createHealthMonitor } from '../monitoring/health.js';
import { parseWorkflowFile } from '../parsing/parser.js';
import { loadConfig } from '../config/loader.js';
import FlowshTUI, { tui } from './tui.js';

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

interface VisualizeCommandOptions {
  output?: string;
  theme?: 'default' | 'dark' | 'light';
  format?: 'json' | 'pretty';
  verbose?: boolean;
  validate?: boolean;
  config?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// =============================================================================
// Global State Management
// =============================================================================

let initialized = false;
const correlationId = uuidv4();
let tuiInstance: FlowshTUI;

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
    // Initialize TUI first for better user experience
    tuiInstance = new FlowshTUI(options.verbose || false);

    // Show welcome only if not already shown (for help/version commands)
    if (
      !process.argv.includes('--help') &&
      !process.argv.includes('-h') &&
      !process.argv.includes('--version') &&
      !process.argv.includes('-V')
    ) {
      tuiInstance.showWelcome();
    }

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
    tui.output.error(
      `Failed to initialize application: ${error instanceof Error ? error.message : String(error)}`
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

    tui.output.error(`${operation} failed: ${error.message}`);

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

  tui.output.error(`Unexpected error during ${operation}: ${errorMessage}`);
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
  const startTime = Date.now();

  try {
    await initializeApp(options.config, options);
    const logger = getLogger();
    const operationLogger = logger.createOperationLogger('generate_workflow', {
      correlationId,
      operationId,
      workflowFile,
      options,
    });

    tui.output.header('🚀 Generating Workflow Shell Script');
    operationLogger.info('Starting workflow generation');

    // Parse and validate workflow with spinner
    const parseResult = await tuiInstance.withSpinner(
      'parsing',
      async () => {
        operationLogger.info('Parsing workflow file');
        return parseWorkflowFile(workflowFile, {
          validate: options.validate !== false,
          strict: options.strict || false,
        });
      },
      'Workflow parsed and validated successfully'
    );

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

    // Display workflow summary
    if (parseResult.workflow.graph) {
      const nodeTypes = parseResult.workflow.graph.nodes.reduce(
        (acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      tuiInstance.showWorkflow({
        name: parseResult.workflow.metadata?.name || 'Unnamed Workflow',
        nodeCount: parseResult.workflow.graph.nodes.length,
        edgeCount: parseResult.workflow.graph.edges?.length || 0,
        nodeTypes,
      });
    }

    // Generate shell script with spinner
    const generateResult = await tuiInstance.withSpinner(
      'generating',
      async () => {
        operationLogger.info('Generating shell script');
        return generateShellScript(parseResult.workflow!, {
          includeMocks: options.mock !== false,
          shell: options.shell || 'bash',
          verbose: options.verbose || false,
          defaultTimeout: options.timeout ? parseInt(options.timeout, 10) : 60,
        });
      },
      'Shell script generated successfully'
    );

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
    tui.output.subheader(`Writing output to ${outputFile}`);
    operationLogger.info('Writing output file', { outputFile });

    const fs = await import('fs/promises');
    await fs.writeFile(outputFile, generateResult.script, 'utf-8');

    operationLogger.complete('Workflow generation completed successfully');
    const totalTime = Date.now() - startTime;

    // Display performance metrics
    tuiInstance.showMetrics({
      generateTime: totalTime, // Use total time since metadata may not have duration
      totalTime,
      nodeCount: parseResult.workflow.graph?.nodes.length || 0,
    });

    // Display success information with fancy formatting
    tui.output.section('✨ Generation Complete!', () => {
      tui.output.success(`Shell script generated successfully`);
      tui.output.keyValue('Output File', outputFile);
      tui.output.keyValue('Generation Time', `${totalTime}ms`);
      tui.output.keyValue('Script Lines', generateResult.script.split('\n').length);
      tui.output.keyValue('Correlation ID', correlationId);
    });

    if (generateResult.warnings.length > 0) {
      tui.output.section('⚠️  Warnings', () => {
        generateResult.warnings.forEach(warning => {
          tui.output.warning(warning);
        });
      });
    }

    // Display usage instructions with colorful formatting
    tui.output.section('💡 Next Steps', () => {
      tui.output.info('Make the script executable:');
      tui.output.code(`chmod +x ${outputFile}`);
      tui.output.info('Run the script:');
      tui.output.code(`./${outputFile} --help`);
    });
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

    tui.output.header('🔍 Validating Workflow');
    operationLogger.info('Starting workflow validation');

    const parseResult = await tuiInstance.withSpinner(
      'validating',
      async () => {
        return parseWorkflowFile(workflowFile, {
          validate: true,
          strict: options.strict || false,
        });
      },
      'Workflow validation completed'
    );

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

    // Display validation results with fancy formatting
    tui.output.section('✅ Validation Results', () => {
      tui.output.success('Workflow validation passed!');
      tui.output.keyValue('Validation Time', `${duration}ms`);
      tui.output.keyValue('Correlation ID', correlationId);
    });

    if (parseResult.workflow?.graph) {
      const graph = parseResult.workflow.graph;
      const nodeTypes = graph.nodes.reduce(
        (acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      tuiInstance.showWorkflow({
        name: parseResult.workflow.metadata?.name || 'Unnamed Workflow',
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges?.length || 0,
        nodeTypes,
      });
    }

    if (parseResult.warnings && parseResult.warnings.length > 0) {
      tui.output.section('⚠️  Validation Warnings', () => {
        parseResult.warnings!.forEach(warning => {
          tui.output.warning(warning.message);
        });
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

    tui.output.header('🏥 System Health Check');

    const health = await tuiInstance.withSpinner(
      'validating',
      async () => healthMonitor.getSystemHealth(),
      'Health check completed'
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(health, null, 2));
    } else {
      // Display health status with fancy formatting
      const statusIcon =
        health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
      const statusColor =
        health.status === 'healthy'
          ? tui.colors.success
          : health.status === 'degraded'
            ? tui.colors.warning
            : tui.colors.error;

      tui.output.section('📊 System Status', () => {
        console.log(`   ${statusIcon} ${statusColor(`Status: ${health.status.toUpperCase()}`)}`);
        tui.output.keyValue('Version', health.version);
        tui.output.keyValue('Uptime', `${Math.round(health.uptime / 1000)}s`);
        tui.output.keyValue('Process ID', health.metrics.process.pid);
        tui.output.keyValue(
          'Memory Usage',
          `${Math.round(health.metrics.memory.percentage)}% (${Math.round(health.metrics.memory.used / 1024 / 1024)}MB)`
        );
      });

      if (health.checks.length > 0) {
        tui.output.section('🔍 Health Checks', () => {
          health.checks.forEach(check => {
            const status =
              check.status === 'healthy' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
            tui.output.info(
              `${status} ${check.name}: ${check.message || check.status} (${check.duration}ms)`
            );
          });
        });
      }
    }

    healthMonitor.shutdown();
  } catch (error) {
    handleError(error, 'health check');
  }
}

/**
 * Generate React Flow visualization from workflow YAML
 */
async function visualizeCommand(
  workflowFile: string,
  options: VisualizeCommandOptions
): Promise<void> {
  const operationId = uuidv4();

  try {
    await initializeApp(options.config, options);
    const logger = getLogger();
    const operationLogger = logger.createOperationLogger('visualize_workflow', {
      correlationId,
      operationId,
      workflowFile,
      options,
    });

    tui.output.header('🎨 Generating Workflow Visualization');
    operationLogger.info('Starting workflow visualization');

    // Parse and validate workflow
    const parseResult = await tuiInstance.withSpinner(
      'parsing',
      async () => {
        operationLogger.info('Parsing workflow file');
        return parseWorkflowFile(workflowFile, {
          validate: options.validate !== false,
          strict: false,
        });
      },
      'Workflow parsed successfully'
    );

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

    // Generate React Flow output
    const reactFlowOutput = await tuiInstance.withSpinner(
      'visualizing',
      async () => {
        operationLogger.info('Generating React Flow visualization');
        return generateReactFlowOutput(parseResult.workflow!, {
          theme: options.theme || 'default',
        });
      },
      'Visualization generated successfully'
    );

    operationLogger.info('Visualization generated successfully', {
      nodeCount: reactFlowOutput.nodes.length,
      edgeCount: reactFlowOutput.edges.length,
      theme: options.theme || 'default',
      isValid: reactFlowOutput.validation.isValid,
    });

    // Handle output
    const outputContent = JSON.stringify(reactFlowOutput, null, 2);

    if (options.output) {
      // Write to file
      tui.output.subheader(`Writing visualization to ${options.output}`);
      operationLogger.info('Writing output file', { outputFile: options.output });
      const fs = await import('fs/promises');
      await fs.writeFile(options.output, outputContent, 'utf-8');
    } else {
      // Output to console
      if (options.format === 'pretty') {
        tui.output.section('🎨 Visualization Summary', () => {
          tui.output.keyValue('Nodes', reactFlowOutput.nodes.length);
          tui.output.keyValue('Edges', reactFlowOutput.edges.length);
          tui.output.keyValue('Theme', options.theme || 'default');
          tui.output.keyValue(
            'Layout',
            `${reactFlowOutput.layout.algorithm} (${reactFlowOutput.layout.direction})`
          );
          tui.output.keyValue('Viewport', JSON.stringify(reactFlowOutput.viewport));
        });

        tui.output.section('✅ Validation', () => {
          const validIcon = reactFlowOutput.validation.isValid ? '✅' : '❌';
          tui.output.info(`${validIcon} Valid: ${reactFlowOutput.validation.isValid}`);
          if (reactFlowOutput.validation.errors.length > 0) {
            tui.output.keyValue('Errors', reactFlowOutput.validation.errors.length);
          }
          if (reactFlowOutput.validation.warnings.length > 0) {
            tui.output.keyValue('Warnings', reactFlowOutput.validation.warnings.length);
          }
        });

        if (reactFlowOutput.validation.warnings.length > 0) {
          tui.output.section('⚠️  Warnings', () => {
            reactFlowOutput.validation.warnings.forEach(warning => {
              tui.output.warning(`${warning.code}: ${warning.message}`);
            });
          });
        }

        if (reactFlowOutput.validation.suggestions.length > 0) {
          tui.output.section('💡 Suggestions', () => {
            reactFlowOutput.validation.suggestions.forEach(suggestion => {
              tui.output.info(`${suggestion.type}: ${suggestion.message}`);
            });
          });
        }

        tui.output.section('💡 Usage', () => {
          tui.output.info('Copy the JSON output below and use it with React Flow:');
          tui.output.code('const { nodes, edges, viewport } = reactFlowData;');
        });

        tui.output.header('📄 React Flow JSON');
      }
      console.log(outputContent);
    }

    const duration = operationLogger.complete('Visualization generation completed successfully');

    if (options.format === 'pretty' && options.output) {
      tui.output.section('✨ Visualization Complete!', () => {
        tui.output.success('React Flow visualization generated successfully');
        tui.output.keyValue('Output File', options.output!);
        tui.output.keyValue('Generation Time', `${duration}ms`);
        tui.output.keyValue('Correlation ID', correlationId);
      });
    }
  } catch (error) {
    handleError(error, 'visualize');
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

// Visualize command
program
  .command('visualize')
  .alias('viz')
  .description('Generate React Flow visualization from workflow YAML')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .option('-o, --output <file>', 'Output JSON file (default: stdout)')
  .option('--theme <theme>', 'Visualization theme (default|dark|light)', 'default')
  .option('--format <format>', 'Output format (json|pretty)', 'pretty')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-validate', 'Skip validation')
  .action(async (workflowFile: string, options: VisualizeCommandOptions) => {
    await visualizeCommand(workflowFile, options);
  });

// Info command - Enhanced with fancy TUI
program
  .command('info')
  .description('Display information about flowsh')
  .action(() => {
    // Initialize minimal TUI for info display
    const infoTui = new FlowshTUI(false);
    infoTui.showWelcome();

    tui.branding.displayBanner('Production-ready Workflow-to-Shell Generator');

    tui.output.section('✨ Production Features', () => {
      const features = [
        'Hierarchical configuration system',
        'Structured logging with correlation IDs',
        'Comprehensive error handling and recovery',
        'Health monitoring and metrics',
        'Type-safe Result patterns',
        'Performance tracking and optimization',
        'Fancy geeky terminal interface',
      ];
      tui.output.list(features);
    });

    tui.output.section('🔧 Workflow Features', () => {
      const workflowFeatures = [
        'Parse and validate flowsh YAML workflows',
        'Generate portable bash/zsh scripts',
        'Agent orchestration (opencode, custom CLI tools)',
        'Mock implementations for testing',
        'Template system integration',
        'React Flow visualization generation',
      ];
      tui.output.list(workflowFeatures);
    });

    tui.output.section('📋 Supported Node Types', () => {
      const nodeTypes = [
        'start/end - Workflow boundaries',
        'agent - CLI tool orchestration',
        'code - Shell command execution',
        'llm - AI model integration',
        'if-else - Conditional logic',
        'variable-assignment - State management',
        'answer - Workflow outputs',
      ];
      tui.output.list(nodeTypes);
    });
  });

// Error handling
program.configureOutput({
  writeErr: (str: string) => {
    if (initialized) {
      const logger = getLogger();
      logger.error('CLI error', { message: str.trim(), correlationId });
    }
    tui.output.error(str.trim());
  },
});

// Handle unknown commands
program.on('command:*', () => {
  tui.output.error(`Unknown command: ${program.args.join(' ')}`);
  tui.output.info('Run --help to see available commands');
  process.exit(1);
});

// Handle no arguments - show fancy help
if (process.argv.length <= 2) {
  const helpTui = new FlowshTUI(false);
  helpTui.showWelcome();
  program.outputHelp();
  process.exit(0);
}

// Global error handlers
process.on('uncaughtException', error => {
  tui.output.error(`💥 Uncaught Exception: ${error.message}`);
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
  tui.output.error(`💥 Unhandled Rejection: ${reason}`);
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
