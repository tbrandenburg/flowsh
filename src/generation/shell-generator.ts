/**
 * Shell Script Generator for flowsh Workflows
 *
 * Generates portable bash/zsh scripts from flowsh workflow definitions.
 * Uses modular generators for clean, maintainable code organization.
 */

import { generateNodeFunction, getGeneratorForNode } from './node-generators/index.js';
import { FlowshWorkflow, WorkflowNode, WorkflowEdge } from '../dsl/types.js';
import { ShellScriptingUtils } from './shell-scripting/index.js';
import { TemplateEngine } from './template-engine/index.js';
import { getLogger } from '../logging/logger.js';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Generation Configuration
// =============================================================================

export interface GenerationOptions {
  /** Include mock implementations for testing */
  includeMocks?: boolean;
  /** Shell type to target */
  shell?: 'bash' | 'zsh';
  /** Include verbose debugging output */
  verbose?: boolean;
  /** Default timeout for agent calls */
  defaultTimeout?: number;
  /** Template for shell script header */
  headerTemplate?: string;
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
  };
}

// =============================================================================
// Main Generation Function
// =============================================================================

/**
 * Generates a portable shell script from a flowsh workflow definition.
 *
 * Features:
 * - Converts workflow nodes to bash/zsh functions
 * - Handles variable assignments, conditionals, and loops
 * - Integrates LLM nodes with API calls
 * - Supports agent orchestration and command execution
 * - Includes comprehensive error handling and logging
 * - Generates self-contained, executable scripts
 *
 * @param workflow - The flowsh workflow definition to convert
 * @param options - Generation options including mock configuration
 * @returns GenerationResult containing the shell script and metadata
 *
 * @example
 * ```typescript
 * const workflow = { metadata: { name: 'test' }, spec: { graph: { nodes: [...], edges: [...] } } };
 * const result = generateShellScript(workflow, { includeMocks: true });
 * if (result.success) {
 *   console.log(result.script);
 * }
 * ```
 */
export function generateShellScript(
  workflow: FlowshWorkflow,
  options: GenerationOptions = {}
): GenerationResult {
  const operationId = uuidv4();
  const logger = getLogger();

  logger.info('Starting shell script generation', {
    operationId,
    workflowName: workflow.metadata?.name || 'unknown',
    options,
  });

  const { includeMocks = true } = options;
  const warnings: string[] = [];

  // Get workflow graph
  const graph = workflow.graph ?? workflow.spec?.graph;
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    logger.error('No workflow graph found or graph is empty', {
      operationId,
      hasGraph: !!graph,
      nodeCount: graph?.nodes?.length || 0,
    });

    return {
      script: '',
      success: false,
      warnings: ['No workflow graph found or graph is empty'],
      metadata: {
        nodeCount: 0,
        edgeCount: 0,
        hasAgentNodes: false,
        hasLLMNodes: false,
        estimatedComplexity: 'low',
      },
    };
  }

  logger.info('Workflow graph found, analyzing complexity', {
    operationId,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges?.length || 0,
  });

  // Analyze workflow complexity
  const metadata = analyzeWorkflow(graph.nodes, graph.edges || []);

  // Generate script components using modular utilities
  const scriptParts: string[] = [];

  // 1. Header and setup
  scriptParts.push(ShellScriptingUtils.generateScriptHeader(workflow, options));

  // 2. Utility functions
  scriptParts.push(ShellScriptingUtils.generateUtilityFunctions());

  // 3. Mock functions (if enabled)
  if (includeMocks) {
    scriptParts.push(ShellScriptingUtils.generateMockFunctions());
  }

  // 4. Template system
  const templateEngine = new TemplateEngine(workflow);
  scriptParts.push(templateEngine.generateTemplateSystem());

  // 5. Node execution functions (using modular generators)
  scriptParts.push(generateNodeFunctions(graph.nodes));

  // 6. Main execution flow
  scriptParts.push(ShellScriptingUtils.generateMainFlow(graph.nodes, graph.edges || []));

  // 7. Argument parsing and initialization
  scriptParts.push(ShellScriptingUtils.generateArgumentParsing(workflow));

  // 8. Script footer
  scriptParts.push(ShellScriptingUtils.generateScriptFooter());

  const script = scriptParts.join('\n\n');

  return {
    script,
    success: true,
    warnings,
    metadata,
  };
}

// =============================================================================
// Node Functions Generation
// =============================================================================

/**
 * Generates node execution functions using modular generators
 */
function generateNodeFunctions(nodes: WorkflowNode[]): string {
  const functions: string[] = [];

  functions.push('# =============================================================================');
  functions.push('# NODE EXECUTION FUNCTIONS');
  functions.push('# =============================================================================');

  for (const node of nodes) {
    const functionName = `execute_node_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Use modular generators for all supported node types
    const generator = getGeneratorForNode(node);
    if (generator) {
      functions.push(generateNodeFunction(node, functionName));
    } else {
      // Fallback for unsupported node types
      functions.push(generateGenericNodeFunction(node, functionName));
    }
  }

  return functions.join('\n\n');
}

/**
 * Generates a generic node function for unsupported node types
 */
function generateGenericNodeFunction(node: WorkflowNode, functionName: string): string {
  return `# Execute generic node: ${node.id}
${functionName}() {
    log_step "⚙️  Generic Node: ${(node.data as any)?.title || node.id}"
    
    log_warning "Node type '${node.type}' not fully supported yet"
    log_info "Node ID: ${node.id}"
    log_info "Node Type: ${node.type}"
    
    # Set current node state
    set_workflow_state "current_node" "${node.id}"
    
    log_success "Generic node processing completed"
}`;
}

// =============================================================================
// Workflow Analysis
// =============================================================================

/**
 * Analyzes workflow complexity and characteristics
 */
function analyzeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): {
  nodeCount: number;
  edgeCount: number;
  hasAgentNodes: boolean;
  hasLLMNodes: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
} {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const hasAgentNodes = nodes.some(n => n.type === 'agent');
  const hasLLMNodes = nodes.some(n => n.type === 'llm');
  const hasConditionals = nodes.some(n => n.type === 'if-else');
  const hasLoops = nodes.some(n => n.type === 'loop' || n.type === 'iteration');

  let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';

  if (nodeCount > 20 || hasLoops) {
    estimatedComplexity = 'high';
  } else if (nodeCount > 10 || hasConditionals || (hasAgentNodes && hasLLMNodes)) {
    estimatedComplexity = 'medium';
  }

  return {
    nodeCount,
    edgeCount,
    hasAgentNodes,
    hasLLMNodes,
    estimatedComplexity,
  };
}
