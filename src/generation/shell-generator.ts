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
import { VariableResolver } from '../variables/resolver.js';
import { VariableInitGenerator } from './shell-scripting/variable-init.js';

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

    // Helper function to sanitize variable names
    const sanitizeVariableName = (varName: string): string => {
      return varName.replace(/[^a-zA-Z0-9_]/g, '_');
    };

    const allVariables = new Map<string, string>();

    // First pass: collect defaults from start nodes
    const startDefaults = new Map<string, string>();
    for (const node of nodes) {
      if (node.type === 'start' && node.data && 'variables' in node.data) {
        const startVariables = (node.data as any).variables;
        if (Array.isArray(startVariables)) {
          for (const varDef of startVariables) {
            if (varDef.variable && varDef.default !== undefined) {
              const sanitizedName = sanitizeVariableName(varDef.variable).toUpperCase();
              startDefaults.set(sanitizedName, String(varDef.default));
            }
          }
        }
      }
    }

    // Second pass: collect all variables and apply defaults
    for (const node of nodes) {
      const nodeVars = registry.getNodeVariables(node);
      for (const varName of nodeVars) {
        const defaultValue = startDefaults.get(varName) || '';
        allVariables.set(varName, defaultValue);
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
    scriptParts.push(generateVariableSetup(workflow, allVariables));
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
 * Generate variable management functions with debug logging
 */
function generateVariableFunctions(): string {
  return `# =============================================================================
# VARIABLE MANAGEMENT FUNCTIONS
# =============================================================================

# Set variable with debug logging
# Usage: set_var "variable_name" "value" "node_id"
set_var() {
    local var_name="$1"
    local value="$2" 
    local node_id="\${3:-root}"
    
    # Set the variable globally and export it for subshells
    declare -g "$var_name"="$value"
    export "$var_name"
    
    # Debug logging when FLOWSH_DEBUG=true
    if [[ "\${FLOWSH_DEBUG:-false}" == "true" ]]; then
        echo "[DEBUG] $node_id: SET $var_name = '$value' (exported)" >&2
    fi
}

# Get variable value with debug logging  
# Usage: get_var "variable_name" "node_id"
get_var() {
    local var_name="$1"
    local node_id="\${2:-root}"
    
    # Get the variable value using indirect expansion
    local value="\${!var_name:-}"
    
    # Debug logging when FLOWSH_DEBUG=true
    if [[ "\${FLOWSH_DEBUG:-false}" == "true" ]]; then
        echo "[DEBUG] $node_id: GET $var_name = '$value'" >&2
    fi
    
    # Return the value
    echo "$value"
}`;
}

/**
 * Generate clean script header
 */
function generateHeader(workflow: FlowshWorkflow, options: GenerationOptions): string {
  const name = workflow.metadata?.name || workflow.workflow?.name || 'workflow';
  const shell = options.shell === 'zsh' ? 'zsh' : 'bash';

  return `#!/bin/${shell}
# Ensure we're running with bash (handle CI environments that might default to sh)
if [ -z "$BASH_VERSION" ]; then
  exec bash "$0" "$@"
fi

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
AGENT_TIMEOUT=\${AGENT_TIMEOUT:-60}

${generateVariableFunctions()}`;
}

/**
 * Generate variable setup section
 */
function generateVariableSetup(workflow: FlowshWorkflow, variables: Map<string, string>): string {
  // Get environment_variables from either top level or spec
  const envVars = workflow.environment_variables || workflow.spec?.environment_variables || [];

  // Get conversation_variables from either top level or spec
  const conversationVars =
    workflow.conversation_variables || workflow.spec?.conversation_variables || [];

  // Collect all variables that need initialization
  const allVarLines: string[] = [];

  // First, add environment variables from templates (the main fix!)
  if (envVars && envVars.length > 0) {
    for (const envVar of envVars) {
      const varName = envVar.variable;
      if (varName) {
        // Add environment variable with default value and export for subshells
        const defaultValue = (envVar as any).default || '';
        const escapedDefault =
          typeof defaultValue === 'string'
            ? defaultValue.replace(/"/g, '\\"')
            : String(defaultValue);
        allVarLines.push(`${varName}=\${${varName}:-"${escapedDefault}"}`);
        // Export the variable to make it available in bash -c subshells
        allVarLines.push(`export ${varName}`);
      }
    }
  }

  // Check if workflow has conversation_variables (modern approach)
  if (conversationVars && conversationVars.length > 0) {
    // Use modern variable resolution system
    const resolutionResult = VariableResolver.resolve(conversationVars, {
      use_defaults: true,
      fail_on_missing_required: false, // Don't fail during compilation
      variable_sources: [{ type: 'environment' }, { type: 'defaults' }],
    });

    if (resolutionResult.isOk()) {
      const setupResult = VariableInitGenerator.generateCompleteSetup(resolutionResult.value, {
        includeValidation: false, // Skip validation in generated scripts for flexibility
        includeExports: false, // Keep scripts simple
      });

      // If we have modern resolution, combine it with environment variables
      if (setupResult && setupResult.trim()) {
        const envSection =
          allVarLines.length > 0 ? `# Environment Variables\n${allVarLines.join('\n')}\n\n` : '';
        return `${envSection}# Variable setup using modern resolution (${conversationVars.length} vars, resolved: ${resolutionResult.value.length})\n${setupResult}`;
      }
    }
  }

  // Legacy approach for backward compatibility - add workflow variables
  for (const [varName, defaultValue] of variables) {
    if (defaultValue && defaultValue !== '') {
      allVarLines.push(`${varName}=\${${varName}:-"${defaultValue.replace(/"/g, '\\"')}"}`);
    } else {
      allVarLines.push(`${varName}=\${${varName}:-""}`);
    }
  }

  // Return all variables if we have any
  if (allVarLines.length > 0) {
    return `# Environment Variables\n${allVarLines.join('\n')}`;
  }

  return '';
}

/**
 * Container group types for execution organization
 */
interface ContainerGroup {
  type: 'linear' | 'iteration' | 'loop';
  containerNode?: WorkflowNode; // The iteration/loop node that owns the children
  nodes: WorkflowNode[];
}

/**
 * Group nodes by their container membership for proper execution orchestration
 */
function groupNodesByContainer(nodes: WorkflowNode[], _edges: WorkflowEdge[]): ContainerGroup[] {
  const groups: ContainerGroup[] = [];
  const processedNodes = new Set<string>();

  // First, find all container nodes (iteration, loop, etc.)
  const containerNodes = nodes.filter(n => n.type === 'iteration' || n.type === 'loop');

  // Process each container and its children
  for (const containerNode of containerNodes) {
    if (processedNodes.has(containerNode.id)) continue;

    const childNodes: WorkflowNode[] = [];

    // Find nodes that belong to this container
    for (const node of nodes) {
      if (processedNodes.has(node.id)) continue;

      // Check if this node has container membership for this container
      const nodeData = node.data as any;
      const belongsToIteration =
        nodeData.isInIteration && nodeData.iteration_id === containerNode.id;
      const belongsToLoop = nodeData.isInLoop && nodeData.loop_id === containerNode.id;

      if (belongsToIteration || belongsToLoop) {
        childNodes.push(node);
        processedNodes.add(node.id);
      }
    }

    // Create container group
    groups.push({
      type: containerNode.type as 'iteration' | 'loop',
      containerNode,
      nodes: [containerNode, ...childNodes],
    });

    processedNodes.add(containerNode.id);
  }

  // Add remaining nodes as linear groups
  const remainingNodes = nodes.filter(n => !processedNodes.has(n.id));
  if (remainingNodes.length > 0) {
    groups.push({
      type: 'linear',
      nodes: remainingNodes,
    });
  }

  return groups;
}

/**
 * Generate an iteration container with its child nodes embedded in the loop
 */
function generateIterationContainer(
  group: ContainerGroup,
  registry: NodeGeneratorRegistry,
  options: GenerationOptions,
  variables: Map<string, string>,
  nodeIndex: number
): string {
  if (!group.containerNode || group.containerNode.type !== 'iteration') {
    return '# Error: Invalid iteration container';
  }

  // Get the child nodes (everything except the container node itself)
  const childNodes = group.nodes.filter(n => n.id !== group.containerNode!.id);

  // Generate the iteration node with child nodes context
  const context: GenerationContext = {
    options,
    variables,
    nodeCount: group.nodes.length,
    currentNodeIndex: nodeIndex,
    workflowName: options.registry?.toString() || 'workflow',
    childNodes, // Pass child nodes to the iteration generator
  };

  try {
    const nodeCode = registry.generateNodeCode(group.containerNode, context);
    if (nodeCode && nodeCode.trim() !== '') {
      // The iteration generator will handle embedding child nodes
      return nodeCode + '\n' + generateFunctionCall(group.containerNode, nodeCode);
    }
  } catch (error) {
    return `# Error generating iteration container ${group.containerNode.id}: ${error instanceof Error ? error.message : String(error)}`;
  }

  return '# Empty iteration container';
}

/**
 * Generate a loop container with its child nodes embedded in the loop
 */
function generateLoopContainer(
  group: ContainerGroup,
  _registry: NodeGeneratorRegistry,
  _options: GenerationOptions,
  _variables: Map<string, string>,
  _nodeIndex: number
): string {
  if (!group.containerNode || group.containerNode.type !== 'loop') {
    return '# Error: Invalid loop container';
  }

  // Loop containers are not yet implemented - placeholder for future
  return `# Loop containers not yet implemented for node: ${group.containerNode.id}`;
}

/**
 * Generate a single node (for linear execution)
 */
function generateSingleNode(
  node: WorkflowNode,
  registry: NodeGeneratorRegistry,
  options: GenerationOptions,
  variables: Map<string, string>,
  nodeIndex: number,
  monitor?: CompilationMonitor,
  progressTracker?: ProgressTracker
): string | null {
  // Create generation context
  const context: GenerationContext = {
    options,
    variables,
    nodeCount: 1,
    currentNodeIndex: nodeIndex,
    workflowName: options.registry?.toString() || 'workflow',
  };

  try {
    const nodeCode = registry.generateNodeCode(node, context);
    if (nodeCode && nodeCode.trim() !== '') {
      // For function-based nodes, also generate the function call
      if (nodeCode.includes('() {')) {
        const functionCall = generateFunctionCall(node, nodeCode);
        return nodeCode + (functionCall ? '\n' + functionCall : '');
      }
      return nodeCode;
    }

    // Update progress after processing each node
    if (monitor) {
      monitor.updateProgress(nodeIndex + 2);
    }
    if (progressTracker) {
      progressTracker.increment(`Processing node: ${node.id}`);
    }
  } catch (error) {
    // Still update progress even on error
    if (monitor) {
      monitor.updateProgress(nodeIndex + 2);
    }
    if (progressTracker) {
      progressTracker.increment(`Error processing node: ${node.id}`);
    }

    return `echo "Error generating node ${node.id}: ${error instanceof Error ? error.message : String(error)}"`;
  }

  return null;
}

/**
 * Generate main execution logic using registry with container-aware compilation
 */
function generateMainExecution(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  registry: NodeGeneratorRegistry,
  options: GenerationOptions,
  variables: Map<string, string>,
  monitor?: CompilationMonitor,
  progressTracker?: ProgressTracker
): string {
  const executionSteps: string[] = [];

  // Filter out start/end nodes
  const executableNodes = nodes.filter(n => n.type !== 'start' && n.type !== 'end');

  // Group nodes by container membership
  const containerGroups = groupNodesByContainer(executableNodes, edges);

  executionSteps.push('# Workflow Execution');

  let nodeIndex = 0;
  for (const group of containerGroups) {
    // Check if we should continue (timeout check)
    if (monitor && !monitor.shouldContinue()) {
      executionSteps.push('');
      executionSteps.push('# Compilation timeout - stopping execution');
      break;
    }

    if (group.type === 'iteration') {
      // Generate iteration container with child nodes
      const result = generateIterationContainer(group, registry, options, variables, nodeIndex);
      executionSteps.push('');
      executionSteps.push(result);
      nodeIndex += group.nodes.length;
    } else if (group.type === 'loop') {
      // Generate loop container with child nodes (future implementation)
      const result = generateLoopContainer(group, registry, options, variables, nodeIndex);
      executionSteps.push('');
      executionSteps.push(result);
      nodeIndex += group.nodes.length;
    } else {
      // Regular linear execution for non-container nodes
      for (const node of group.nodes) {
        const result = generateSingleNode(
          node,
          registry,
          options,
          variables,
          nodeIndex,
          monitor,
          progressTracker
        );
        if (result) {
          executionSteps.push('');
          executionSteps.push(`# Node: ${node.id}`);
          executionSteps.push(result);
        }
        nodeIndex++;
      }
    }

    // Update progress after processing each group
    if (monitor) {
      monitor.updateProgress(nodeIndex + 2); // +2 because we already did header and variables
    }
    if (progressTracker) {
      progressTracker.increment(`Processing node group: ${group.type}`);
    }
  }

  return executionSteps.join('\n');
}

/**
 * Generate a function call for nodes that define functions
 */
function generateFunctionCall(_node: WorkflowNode, nodeCode: string): string | null {
  // Extract function name from the generated code
  // Only generate calls for functions that follow the execute_ pattern
  const functionMatch = nodeCode.match(/^(execute_[a-zA-Z_][a-zA-Z0-9_]*)\(\)\s*\{/m);
  if (functionMatch) {
    const functionName = functionMatch[1];
    return `${functionName}`;
  }
  return null;
}

/**
 * Generate script footer
 */
function generateFooter(): string {
  return `echo "Workflow completed successfully"
exit 0`;
}
