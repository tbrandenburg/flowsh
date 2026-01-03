/**
 * Registry-Based Shell Script Generator for flowsh
 *
 * Uses extensible registry architecture to generate clean, readable shell scripts.
 * Focus: Extensibility, security, and production-readiness.
 */

import {
  createDefaultRegistry,
  NodeGeneratorRegistry,
  type GenerationOptions as RegistryGenerationOptions,
  type GenerationContext,
} from './generators/index.js';
import {
  CompilationMonitor,
  type CompilationMetrics,
  type CompilationLimits,
} from './performance/compilation-monitor.js';
import { ProgressTracker, type ProgressCallback } from './performance/progress-tracker.js';
import { FlowshWorkflow, WorkflowNode, WorkflowEdge } from '../dsl/types.js';
import { ShellScriptingUtils } from './shell-scripting/index.js';

// Re-export types but extend with backwards compatibility
export interface GenerationOptions extends RegistryGenerationOptions {
  /** Custom registry to use (optional) */
  registry?: NodeGeneratorRegistry;
  /** Performance limits and timeout configuration */
  performanceLimits?: Partial<CompilationLimits>;
  /** Progress tracking callback for large workflows */
  progressCallback?: ProgressCallback;
}

export interface GenerationResult {
  /** Generated shell script content */
  script: string;
  /** Generation success status */
  success: boolean;
  /** Any warnings during generation */
  warnings: string[];
  /** Metadata about the generated script */
  metadata: {
    nodeCount: number;
    edgeCount: number;
    hasAgentNodes: boolean;
    hasLLMNodes: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
    supportedNodeTypes: string[];
    unsupportedNodeTypes: string[];
  };
  /** Performance metrics from compilation */
  performance?: CompilationMetrics;
}

/**
 * Generate a clean shell script from workflow using registry architecture
 */
export function generateShellScript(
  workflow: FlowshWorkflow,
  options: GenerationOptions = {}
): GenerationResult {
  const warnings: string[] = [];

  // Initialize performance monitoring only for complex workflows
  const shouldMonitor = (workflow.graph?.nodes?.length ?? 0) > 10;
  let monitor: CompilationMonitor | undefined;
  let progressTracker: ProgressTracker | undefined;

  if (shouldMonitor) {
    monitor = new CompilationMonitor(options.performanceLimits || {});
    progressTracker = new ProgressTracker(options.progressCallback);
  }

  try {
    // Start performance monitoring if enabled
    if (monitor) {
      monitor.start();
    }

    // Use provided registry or create default one
    const registry = options.registry || createDefaultRegistry();

    // Get workflow graph
    const graph = workflow.graph ?? workflow.spec?.graph;
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      if (monitor) {
        monitor.finish(false, 'No workflow graph found or graph is empty');
      }

      const result: GenerationResult = {
        script: '',
        success: false,
        warnings: ['No workflow graph found or graph is empty'],
        metadata: {
          nodeCount: 0,
          edgeCount: 0,
          hasAgentNodes: false,
          hasLLMNodes: false,
          estimatedComplexity: 'low',
          supportedNodeTypes: [],
          unsupportedNodeTypes: [],
        },
      };

      if (monitor) {
        result.performance = monitor.getMetrics();
      }

      return result;
    }

    const nodes = graph.nodes;
    const edges = graph.edges || [];

    // Start progress tracking if enabled
    if (progressTracker) {
      progressTracker.start(nodes.length + 4);
    }

    // Check resource limits if monitoring enabled
    if (monitor) {
      monitor.checkNodeCount(nodes.length);
      if (progressTracker) {
        progressTracker.setPhase('validation', 2);
        progressTracker.increment('Checking resource limits');
      }
    }

    // Analyze node type support using registry
    const supportedTypes: string[] = [];
    const unsupportedTypes: string[] = [];

    for (const node of nodes) {
      if (registry.has(node.type)) {
        if (!supportedTypes.includes(node.type)) {
          supportedTypes.push(node.type);
        }
      } else {
        if (!unsupportedTypes.includes(node.type)) {
          unsupportedTypes.push(node.type);
          warnings.push(`No generator found for node type '${node.type}' (node: ${node.id})`);
        }
      }
    }

    if (progressTracker) {
      progressTracker.increment('Analyzing node types');
    }

    // Stop if we have unsupported node types
    if (unsupportedTypes.length > 0) {
      if (monitor) {
        monitor.finish(false, `Unsupported node types: ${unsupportedTypes.join(', ')}`);
      }

      const result: GenerationResult = {
        script: '',
        success: false,
        warnings,
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          hasAgentNodes: nodes.some(n => n.type === 'agent'),
          hasLLMNodes: nodes.some(n => n.type === 'llm'),
          estimatedComplexity: nodes.length > 10 ? 'high' : nodes.length > 5 ? 'medium' : 'low',
          supportedNodeTypes: supportedTypes,
          unsupportedNodeTypes: unsupportedTypes,
        },
      };

      if (monitor) {
        result.performance = monitor.getMetrics();
      }

      return result;
    }

    // Collect all variables from nodes using registry
    if (progressTracker) {
      progressTracker.setPhase('generation', nodes.length + 2);
    }

    const allVariables = new Map<string, string>();
    for (const node of nodes) {
      const nodeVars = registry.getNodeVariables(node);
      for (const varName of nodeVars) {
        allVariables.set(varName, ''); // Default empty value
      }
    }

    // Generate script parts
    const scriptParts: string[] = [];

    // Header
    scriptParts.push(generateHeader(workflow, options));
    if (monitor) {
      monitor.updateProgress(0);
    }
    if (progressTracker) {
      progressTracker.increment('Generating header');
    }

    // Variable setup
    scriptParts.push(generateVariableSetup(allVariables));
    if (monitor) {
      monitor.updateProgress(1);
    }
    if (progressTracker) {
      progressTracker.increment('Setting up variables');
    }

    // Utility functions (required for loop and iteration nodes)
    scriptParts.push(ShellScriptingUtils.generateUtilityFunctions());
    if (progressTracker) {
      progressTracker.increment('Adding utility functions');
    }

    // Main execution using registry
    scriptParts.push(
      generateMainExecution(nodes, edges, registry, options, allVariables, monitor, progressTracker)
    );

    // Footer
    scriptParts.push(generateFooter());
    if (monitor) {
      monitor.updateProgress(nodes.length);
    }
    if (progressTracker) {
      progressTracker.complete();
    }

    const script = scriptParts.filter(part => part.trim() !== '').join('\n\n');

    if (monitor) {
      monitor.finish(true);
    }

    const result: GenerationResult = {
      script,
      success: true,
      warnings,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        hasAgentNodes: nodes.some(n => n.type === 'agent'),
        hasLLMNodes: nodes.some(n => n.type === 'llm'),
        estimatedComplexity: nodes.length > 10 ? 'high' : nodes.length > 5 ? 'medium' : 'low',
        supportedNodeTypes: supportedTypes,
        unsupportedNodeTypes: unsupportedTypes,
      },
    };

    if (monitor) {
      result.performance = monitor.getMetrics();
    }

    return result;
  } catch (error) {
    // Handle performance-related errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (monitor) {
      monitor.finish(false, errorMessage);
    }

    const result: GenerationResult = {
      script: '',
      success: false,
      warnings: [`Compilation failed: ${errorMessage}`],
      metadata: {
        nodeCount: 0,
        edgeCount: 0,
        hasAgentNodes: false,
        hasLLMNodes: false,
        estimatedComplexity: 'low',
        supportedNodeTypes: [],
        unsupportedNodeTypes: [],
      },
    };

    if (monitor) {
      result.performance = monitor.getMetrics();
    }

    return result;
  }
}

/**
 * Generate clean script header
 */
function generateHeader(workflow: FlowshWorkflow, options: GenerationOptions): string {
  const name = workflow.metadata?.name || workflow.workflow?.name || 'workflow';
  const shell = options.shell === 'zsh' ? 'zsh' : 'bash';

  return `#!/bin/${shell}
set -euo pipefail

# ${name} - Generated by flowsh
# Registry-based workflow execution script

echo "Starting workflow: ${name}"

# Workflow variables and state management
declare -A workflow_vars
declare -A workflow_state

# Color codes for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m'

# Configuration
VERBOSE=\${VERBOSE:-false}
AGENT_TIMEOUT=\${AGENT_TIMEOUT:-60}`;
}

/**
 * Generate variable setup section
 */
function generateVariableSetup(variables: Map<string, string>): string {
  if (variables.size === 0) {
    return '';
  }

  const varLines: string[] = [];
  for (const [varName] of variables) {
    varLines.push(`${varName}=\${${varName}:-""}`);
  }

  return `# Environment Variables\n${varLines.join('\n')}`;
}

/**
 * Generate main execution logic using registry
 */
function generateMainExecution(
  nodes: WorkflowNode[],
  _edges: WorkflowEdge[],
  registry: NodeGeneratorRegistry,
  options: GenerationOptions,
  variables: Map<string, string>,
  monitor?: CompilationMonitor,
  progressTracker?: ProgressTracker
): string {
  const executionSteps: string[] = [];

  // Simple linear execution for now (ignore complex control flow)
  const executableNodes = nodes.filter(n => n.type !== 'start' && n.type !== 'end');

  executionSteps.push('# Workflow Execution');

  for (let i = 0; i < executableNodes.length; i++) {
    const node = executableNodes[i]!; // We know this exists because we're iterating over the array

    // Check if we should continue (timeout check)
    if (monitor && !monitor.shouldContinue()) {
      executionSteps.push('');
      executionSteps.push('# Compilation timeout - stopping execution');
      break;
    }

    // Create generation context
    const context: GenerationContext = {
      options,
      variables,
      nodeCount: nodes.length,
      currentNodeIndex: i,
      workflowName: options.registry?.toString() || 'workflow',
    };

    try {
      const nodeCode = registry.generateNodeCode(node, context);
      if (nodeCode && nodeCode.trim() !== '') {
        executionSteps.push('');
        executionSteps.push(`# Node: ${node.id}`);
        executionSteps.push(nodeCode);
      }

      // Update progress after processing each node
      if (monitor) {
        monitor.updateProgress(i + 2); // +2 because we already did header and variables
      }
      if (progressTracker) {
        progressTracker.increment(`Processing node: ${node.id}`);
      }
    } catch (error) {
      executionSteps.push('');
      executionSteps.push(`# Node: ${node.id} (ERROR)`);
      executionSteps.push(
        `echo "Error generating node ${node.id}: ${error instanceof Error ? error.message : String(error)}"`
      );

      // Still update progress even on error
      if (monitor) {
        monitor.updateProgress(i + 2);
      }
      if (progressTracker) {
        progressTracker.increment(`Error processing node: ${node.id}`);
      }
    }
  }

  return executionSteps.join('\n');
}

/**
 * Generate script footer
 */
function generateFooter(): string {
  return `echo "Workflow completed successfully"
exit 0`;
}
