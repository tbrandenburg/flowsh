#!/usr/bin/env node

/**
 * flowsh - The jq of Workflows
 *
 * Simple YAML workflow to shell script compiler.
 * Does one thing well: converts workflow YAML files into clean, executable shell scripts.
 */

import { scanMissingEnvironmentVariables } from '../templates/env-scanner.js';
import { createDefaultRegistry } from '../generation/generators/index.js';
import { generateShellScript } from '../generation/shell-generator.js';
import { initCommand } from '../templates/init-command.js';
import { DSLIntrospector } from '../dsl/introspection.js';
import { parseWorkflowFile } from '../parsing/parser.js';
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

// Simple error handling - no fancy logging or correlation IDs
function handleError(error: unknown, operation: string): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${operation} failed: ${message}`);
  process.exit(1);
}

/**
 * Write shell script to file with comprehensive error handling
 */
async function writeScriptToFile(script: string, outputFile: string): Promise<void> {
  try {
    const resolvedPath = path.resolve(outputFile);
    const outputDir = path.dirname(resolvedPath);

    // Create directory structure if it doesn't exist
    if (outputDir !== '.' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(resolvedPath, script, 'utf8');
    console.log(`✅ Generated script saved to: ${resolvedPath}`);
  } catch (error: any) {
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied writing to: ${outputFile}`);
    } else if (error.code === 'ENOSPC') {
      throw new Error(`No space left on device for: ${outputFile}`);
    } else if (error.code === 'ENOENT') {
      throw new Error(`Invalid path: ${outputFile}`);
    } else {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }
}

/**
 * Compile command: Convert YAML workflow to shell script
 */
async function compileCommand(
  workflowFile: string,
  options: { verbose?: boolean; debug?: boolean; dryRun?: boolean; output?: string } = {}
): Promise<void> {
  try {
    if (options.verbose) {
      console.error('🔨 Parsing workflow...');
    }

    // Parse workflow
    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: true,
      strict: false,
    });

    if (!parseResult.success || !parseResult.workflow) {
      console.error(`❌ Error in ${workflowFile}:`);
      parseResult.errors.forEach(error => {
        console.error(`   → ${error.message}`);
      });
      process.exit(1);
    }

    if (options.verbose) {
      const nodeCount = parseResult.workflow.graph?.nodes?.length || 0;
      console.error(`🔨 Generating shell script for ${nodeCount} nodes...`);
    }

    // Generate shell script
    const generateResult = generateShellScript(parseResult.workflow, {
      includeMocks: false,
      shell: 'bash',
      verbose: options.verbose || false,
      debug: options.debug || false,
      defaultTimeout: 60,
    });

    if (!generateResult.success) {
      console.error(`❌ Shell generation failed:`);
      generateResult.warnings.forEach(warning => {
        console.error(`   → ${warning}`);
      });
      process.exit(1);
    }

    if (options.verbose) {
      console.error(
        `✅ Generated ${generateResult.script.split('\n').length} lines of shell script`
      );
      console.error(`📊 Complexity: ${generateResult.metadata.estimatedComplexity}`);
      console.error('');
    }

    // Check for missing environment variables and warn user
    const missingEnvVars = scanMissingEnvironmentVariables(parseResult.workflow);
    if (missingEnvVars.length > 0) {
      console.error('⚠️  Missing environment variables:');
      missingEnvVars.forEach(varName => {
        console.error(`   → ${varName} (consider setting this before running the script)`);
      });
      console.error('');
    }

    // Dry-run mode: validate and compile but don't output
    if (options.dryRun) {
      const nodeCount = parseResult.workflow?.graph?.nodes?.length || 0;
      const edgeCount = parseResult.workflow?.graph?.edges?.length || 0;
      const scriptLines = generateResult.script.split('\n').length;

      console.log(`✅ Dry-run successful for ${workflowFile}`);
      console.log(`   Nodes: ${nodeCount}, Edges: ${edgeCount}`);
      console.log(`   Generated script: ${scriptLines} lines`);
      console.log(`   Estimated complexity: ${generateResult.metadata.estimatedComplexity}`);

      if (generateResult.warnings && generateResult.warnings.length > 0) {
        console.log(`   Warnings: ${generateResult.warnings.length}`);
        if (options.verbose) {
          generateResult.warnings.forEach(warning => {
            console.log(`     → ${warning}`);
          });
        }
      }
      return; // Exit without outputting script
    }

    // Output to file or stdout
    if (options.output) {
      await writeScriptToFile(generateResult.script, options.output);
    } else {
      // Output to stdout (jq-like behavior)
      console.log(generateResult.script);
    }
  } catch (error) {
    handleError(error, 'Compilation');
  }
}

/**
 * DSL command: Show flowsh DSL structure and node types
 */
async function dslCommand(
  nodeType?: string,
  options: { format: 'text' | 'json' } = { format: 'text' }
): Promise<void> {
  try {
    const registry = createDefaultRegistry();
    const introspector = new DSLIntrospector(registry);

    if (nodeType) {
      // Node detail mode
      if (!registry.has(nodeType)) {
        console.error(`❌ Unknown node type: ${nodeType}`);
        console.error(`💡 Run 'flowsh dsl' to see available node types`);
        process.exit(1);
      }

      const detail = introspector.getNodeDetail(nodeType);

      if (options.format === 'json') {
        console.log(introspector.formatNodeAsJSON(detail));
      } else {
        console.log(introspector.formatNodeAsText(detail));
      }
    } else {
      // Overview mode (Phase 1 functionality)
      const overview = introspector.getOverview();

      if (options.format === 'json') {
        console.log(introspector.formatAsJSON(overview));
      } else {
        console.log(introspector.formatAsText(overview));
      }
    }
  } catch (error) {
    handleError(error, 'DSL exploration');
  }
}
async function validateCommand(workflowFile: string): Promise<void> {
  try {
    const parseResult = await parseWorkflowFile(workflowFile, {
      validate: true,
      strict: false,
    });

    if (!parseResult.success) {
      console.error(`❌ Validation failed for ${workflowFile}:`);
      parseResult.errors.forEach(error => {
        console.error(`   → ${error.message}`);
      });
      process.exit(1);
    }

    // Show simple success message
    const nodeCount = parseResult.workflow?.graph?.nodes.length || 0;
    const edgeCount = parseResult.workflow?.graph?.edges?.length || 0;

    console.log(`✅ ${workflowFile} is valid (${nodeCount} nodes, ${edgeCount} edges)`);

    // Show warnings if any
    if (parseResult.warnings && parseResult.warnings.length > 0) {
      console.error('\n⚠️  Warnings:');
      parseResult.warnings.forEach(warning => {
        console.error(`   → ${warning.message}`);
      });
    }
  } catch (error) {
    handleError(error, 'Validation');
  }
}

// Ultra-simple CLI setup
const program = new Command();

program
  .name('flowsh')
  .description('The jq of Workflows - Simple YAML workflow to shell script compiler')
  .version('2.0.0-simple');

// Compile command - main functionality
program
  .command('compile')
  .description('Convert YAML workflow to shell script (outputs to stdout)')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .option('-v, --verbose', 'Show detailed progress and performance information')
  .option('-d, --debug', 'Enable debug mode with enhanced tracing and variable inspection')
  .option('--dry-run', 'Validate and compile without outputting script or writing files')
  .option('-o, --output <file>', 'output generated script to file')
  .action(
    async (
      workflowFile: string,
      options: { verbose?: boolean; debug?: boolean; dryRun?: boolean; output?: string }
    ) => {
      await compileCommand(workflowFile, options);
    }
  );

// Validate command - check for errors only
program
  .command('validate')
  .description('Validate workflow YAML file')
  .argument('<workflow-file>', 'Path to workflow YAML file')
  .action(async (workflowFile: string) => {
    await validateCommand(workflowFile);
  });

// DSL command - explore flowsh DSL types and properties
program
  .command('dsl')
  .description('Explore flowsh DSL node types and properties')
  .argument('[node-type]', 'Specific node type to explore in detail')
  .option('--format <format>', 'Output format: text | json', 'text')
  .action(async (nodeType?: string, options: { format: 'text' | 'json' } = { format: 'text' }) => {
    await dslCommand(nodeType, options);
  });

// Init command - initialize workflow from template
program
  .command('init')
  .description('Initialize workflow from template')
  .argument('[template]', 'Template name to use')
  .argument('[target]', 'Target workflow file path')
  .option('--help', 'Display available templates and usage')
  .option('-p, --preview', 'Display template content without creating files')
  .option('-l, --list-templates', 'List all available templates')
  .option('-s, --search <query>', 'Search templates by keyword')
  .action(
    async (
      template?: string,
      target?: string,
      options?: {
        help?: boolean;
        preview?: boolean;
        listTemplates?: boolean;
        search?: string;
      }
    ) => {
      await initCommand(template, target, options);
    }
  );

// Show simple help when no arguments
if (process.argv.length <= 2) {
  console.log('flowsh - The jq of Workflows');
  console.log('');
  console.log('Usage:');
  console.log('  flowsh compile workflow.yaml > script.sh');
  console.log('  flowsh compile workflow.yaml -o script.sh');
  console.log('  flowsh validate workflow.yaml');
  console.log('  flowsh init [template] [target.yaml]');
  console.log('  flowsh dsl [--format json]');
  console.log('');
  console.log('Run --help for more options');
  process.exit(0);
}

// Handle unknown commands simply
program.on('command:*', () => {
  console.error(`❌ Unknown command. Available commands: compile, validate, init, dsl`);
  console.error('💡 Run --help to see usage');
  process.exit(1);
});

// Simple global error handling
process.on('uncaughtException', error => {
  console.error(`💥 Unexpected error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error(`💥 Unhandled error: ${reason}`);
  process.exit(1);
});

// Parse arguments
program.parse();

export default program;
