#!/usr/bin/env node

/**
 * flowsh CLI - Workflow-to-Shell Generator
 * 
 * Command-line interface for converting flowsh YAML workflows into executable shell scripts
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { parseWorkflowFile } from '../parsing/parser.js';
import { generateShellScript } from '../generation/shell-generator.js';

// =============================================================================
// CLI Configuration
// =============================================================================

const program = new Command();

interface GenerateCommandOptions {
  output?: string;
  mock?: boolean;
  shell?: 'bash' | 'zsh';
  verbose?: boolean;
  timeout?: string;
  validate?: boolean;
  strict?: boolean;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Colorful logging utilities
 */
const logger = {
  info: (message: string): void => console.log(chalk.cyan(`ℹ️  ${message}`)),
  success: (message: string): void => console.log(chalk.green(`✅ ${message}`)),
  error: (message: string): void => console.error(chalk.red(`❌ ${message}`)),
  warning: (message: string): void => console.warn(chalk.yellow(`⚠️  ${message}`)),
  debug: (message: string): void => console.log(chalk.blue(`🔍 DEBUG: ${message}`)),
  step: (message: string): void => console.log(chalk.cyan(`🚀 ${message}`)),
};

/**
 * Display validation errors in a user-friendly format
 */
function displayValidationErrors(errors: Array<{ type: string; code: string; message: string; path?: string; nodeId?: string }>): void {
  console.log(chalk.red('\n📋 Validation Issues Found:\n'));
  
  errors.forEach((error, index) => {
    const prefix = error.type === 'error' ? chalk.red('❌ ERROR') : chalk.yellow('⚠️  WARNING');
    console.log(`${index + 1}. ${prefix}: ${error.message}`);
    
    if (error.path) {
      console.log(`   ${chalk.gray('Path:')} ${error.path}`);
    }
    
    if (error.nodeId) {
      console.log(`   ${chalk.gray('Node:')} ${error.nodeId}`);
    }
    
    if (error.code) {
      console.log(`   ${chalk.gray('Code:')} ${error.code}`);
    }
    
    console.log('');
  });
}

/**
 * Generate output filename from input filename
 */
function generateOutputFilename(inputFile: string, outputDir?: string): string {
  const baseName = basename(inputFile, extname(inputFile));
  const outputName = `${baseName}.sh`;
  
  if (outputDir) {
    return join(outputDir, outputName);
  }
  
  return outputName;
}

// =============================================================================
// Command Implementations
// =============================================================================

/**
 * Generate shell script from workflow YAML
 */
async function generateCommand(workflowFile: string, options: GenerateCommandOptions): Promise<void> {
  const spinner = ora('Parsing workflow file...').start();
  
  try {
    // Parse workflow file
    spinner.text = 'Parsing and validating workflow...';
    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: options.validate !== false,
      strict: options.strict || false,
    });

    if (!parseResult.success || !parseResult.workflow) {
      spinner.fail('Failed to parse workflow file');
      
      if (parseResult.errors.length > 0) {
        displayValidationErrors(parseResult.errors);
      }
      
      process.exit(1);
    }

    // Display validation warnings if any
    if (parseResult.validation?.warnings && parseResult.validation.warnings.length > 0) {
      spinner.warn('Validation completed with warnings');
      displayValidationErrors(parseResult.validation.warnings);
    } else {
      spinner.succeed('Workflow parsed and validated successfully');
    }

    // Generate shell script
    const generateSpinner = ora('Generating shell script...').start();
    
    const generateResult = generateShellScript(parseResult.workflow, {
      includeMocks: options.mock !== false,
      shell: options.shell || 'bash',
      verbose: options.verbose || false,
      defaultTimeout: options.timeout ? parseInt(options.timeout, 10) : 60,
    });

    if (!generateResult.success) {
      generateSpinner.fail('Failed to generate shell script');
      
      if (generateResult.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings during generation:'));
        generateResult.warnings.forEach(warning => {
          logger.warning(warning);
        });
      }
      
      process.exit(1);
    }

    generateSpinner.succeed('Shell script generated successfully');

    // Display generation metadata
    const { metadata } = generateResult;
    logger.info(`Generated script with ${metadata.nodeCount} nodes and ${metadata.edgeCount} edges`);
    logger.info(`Estimated complexity: ${metadata.estimatedComplexity}`);
    
    if (metadata.hasAgentNodes) {
      logger.info('Script includes agent orchestration');
    }
    
    if (metadata.hasLLMNodes) {
      logger.info('Script includes LLM interactions');
    }

    // Write output file
    const outputFile = options.output || generateOutputFilename(workflowFile);
    const writeSpinner = ora(`Writing script to ${outputFile}...`).start();
    
    try {
      await writeFile(outputFile, generateResult.script, 'utf-8');
      writeSpinner.succeed(`Shell script saved to ${chalk.green(outputFile)}`);
    } catch (writeError) {
      writeSpinner.fail(`Failed to write output file: ${writeError}`);
      process.exit(1);
    }

    // Display usage instructions
    console.log(chalk.cyan('\n🎉 Generation complete! Usage instructions:\n'));
    console.log(`${chalk.green('Make executable:')} chmod +x ${outputFile}`);
    console.log(`${chalk.green('Run with mocks:')} ./${outputFile} --help`);
    console.log(`${chalk.green('Run with real tools:')} ./${outputFile} --no-mock [args...]`);
    
    if (generateResult.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Generation Warnings:'));
      generateResult.warnings.forEach(warning => {
        logger.warning(warning);
      });
    }

  } catch (error) {
    spinner.fail(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (options.verbose) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Validate workflow without generating script
 */
async function validateCommand(workflowFile: string, options: { strict?: boolean; verbose?: boolean }): Promise<void> {
  const spinner = ora('Validating workflow...').start();
  
  try {
    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: true,
      strict: options.strict || false,
    });

    if (!parseResult.success) {
      spinner.fail('Validation failed');
      
      if (parseResult.errors.length > 0) {
        displayValidationErrors(parseResult.errors);
      }
      
      process.exit(1);
    }

    spinner.succeed('Workflow validation passed');
    
    if (parseResult.validation?.warnings && parseResult.validation.warnings.length > 0) {
      console.log(chalk.yellow('\\nValidation warnings:'));
      displayValidationErrors(parseResult.validation.warnings);
    }

    // Display workflow info
    const workflow = parseResult.workflow!;
    const graph = workflow.graph ?? workflow.spec?.graph;
    
    if (graph) {
      logger.info(`Workflow contains ${graph.nodes.length} nodes and ${graph.edges?.length || 0} edges`);
      
      const nodeTypes = graph.nodes.reduce((acc: Record<string, number>, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {});
      
      console.log(chalk.cyan('\\nNode type distribution:'));
      Object.entries(nodeTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

  } catch (error) {
    spinner.fail(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (options.verbose) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

// =============================================================================
// CLI Setup
// =============================================================================

program
  .name('flowsh')
  .description('Workflow-to-Shell Generator for AI Agent Orchestration')
  .version('1.0.0')
  .configureOutput({
    writeErr: (str: string) => process.stderr.write(chalk.red(str)),
    writeOut: (str: string) => process.stdout.write(str),
  });

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
  .action(generateCommand);

// Validate command
program
  .command('validate')
  .description('Validate workflow YAML without generating script')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .option('--strict', 'Fail on validation warnings')
  .option('-v, --verbose', 'Enable verbose output')
  .action(validateCommand);

// Info command
program
  .command('info')
  .description('Display information about flowsh')
  .action(() => {
    console.log(chalk.cyan('\\n🌊 flowsh - Workflow-to-Shell Generator\\n'));
    console.log('Convert AI workflow YAML files into portable, executable shell scripts.');
    console.log('Perfect for agent orchestration and automation pipelines.\\n');
    
    console.log(chalk.green('Features:'));
    console.log('  • Parse and validate flowsh YAML workflows');
    console.log('  • Generate portable bash/zsh scripts');
    console.log('  • Agent orchestration (opencode, custom CLI tools)');
    console.log('  • Mock implementations for testing');
    console.log('  • Template system integration');
    console.log('  • Comprehensive error handling\\n');
    
    console.log(chalk.blue('Supported Node Types:'));
    console.log('  • start/end - Workflow boundaries');
    console.log('  • agent - CLI tool orchestration');
    console.log('  • code - Shell command execution');
    console.log('  • llm - AI model integration');
    console.log('  • if-else - Conditional logic');
    console.log('  • variable-assignment - State management');
    console.log('  • answer - Workflow outputs\\n');
  });

// Example command
program
  .command('example')
  .description('Show example workflow YAML')
  .action(() => {
    console.log(chalk.cyan('\\n📋 Example Workflow YAML:\\n'));
    
    const exampleYaml = `workflow:
  name: "Simple Agent Workflow"
  description: "Basic example of agent orchestration"
  
environment_variables:
  - variable: "task_description"
    name: "Task Description"
    type: "text"
    description: "What you want the agent to do"

graph:
  nodes:
    - id: "start"
      type: "start"
      data:
        title: "Start"
        variables:
          - variable: "project_path"
            type: "text"
            label: "Project Path"
            required: true
    
    - id: "agent_task"
      type: "agent"
      data:
        title: "Execute Task"
        command: "opencode"
        args: ["run"]
        prompt_template:
          type: "prompt"
          source: "inline"
          content: "Please help with: {{task_description}}"
    
    - id: "result"
      type: "answer"
      data:
        title: "Result"
        answer: "Task completed successfully"

  edges:
    - source: "start"
      target: "agent_task"
    - source: "agent_task" 
      target: "result"`;

    console.log(chalk.gray(exampleYaml));
    console.log(chalk.green('\\n💡 Save this to workflow.yaml and run: flowsh generate workflow.yaml\\n'));
  });

// Error handling for unknown commands
program.on('command:*', () => {
  logger.error(`Unknown command: ${program.args.join(' ')}`);
  logger.info('Run --help to see available commands');
  process.exit(1);
});

// Handle no arguments
if (process.argv.length <= 2) {
  program.outputHelp();
}

// Parse command line arguments
program.parse();

export default program;