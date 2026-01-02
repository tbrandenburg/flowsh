## FEATURE: Week 6 Visualization Support and Enhanced Validation

Transform flowsh into a complete workflow orchestration platform with React Flow visualization capabilities, advanced graph validation, and comprehensive testing infrastructure. This week adds the visualization layer that enables flowsh workflows to be rendered in modern workflow designers.

## Core Requirements:

### 1. React Flow Output Generation

- Convert workflow graphs to React Flow compatible JSON format
- Generate proper node positioning with automatic layout algorithms
- Add styling metadata for different node types and connection states
- Support for custom node renderers and edge animations

### 2. Advanced Graph Validation

- Implement cycle detection and unreachable node analysis
- Add workflow complexity analysis and optimization suggestions
- Validate edge connections, types, and data flow consistency
- Create graph topology analysis for performance optimization

### 3. Comprehensive Test Infrastructure

- Build integration test suite covering all example workflows
- Add performance benchmarking and regression testing
- Implement visual regression testing for React Flow output
- Create test data generators for complex workflow scenarios

### 4. Enhanced Workflow Analysis

- Add workflow execution path analysis and visualization
- Implement dependency tracking and critical path identification
- Create workflow metrics and complexity scoring
- Generate workflow documentation and diagrams automatically

## EXAMPLES:

### React Flow Output Generation:

```typescript
interface ReactFlowOutput {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  viewport: Viewport;
  metadata: WorkflowMetadata;
}

interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  style?: React.CSSProperties;
  className?: string;
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  label?: string;
  labelStyle?: React.CSSProperties;
}

class ReactFlowGenerator {
  generateReactFlowOutput(workflow: FlowshWorkflow): ReactFlowOutput {
    const graph = workflow.spec?.graph;
    if (!graph) {
      throw new Error('Workflow must contain a valid graph specification');
    }

    // Generate nodes with automatic positioning
    const nodes = this.generateNodes(graph.nodes);

    // Generate edges with proper styling
    const edges = this.generateEdges(graph.edges, nodes);

    // Calculate optimal viewport
    const viewport = this.calculateViewport(nodes);

    return {
      nodes,
      edges,
      viewport,
      metadata: this.extractMetadata(workflow),
    };
  }

  private generateNodes(workflowNodes: WorkflowNode[]): ReactFlowNode[] {
    // Use automatic layout algorithm (Dagre, ELK, or custom)
    const positions = this.calculateNodePositions(workflowNodes);

    return workflowNodes.map((node, index) => ({
      id: node.id,
      type: this.getReactFlowNodeType(node.type),
      position: positions[node.id] || { x: 100, y: 100 + index * 150 },
      data: {
        ...node.data,
        label: node.data.title || node.id,
        nodeType: node.type,
        validationStatus: this.validateNode(node),
        executionStatus: 'pending', // Will be updated during execution
      },
      style: this.getNodeStyle(node.type),
      className: `flowsh-node flowsh-node-${node.type}`,
    }));
  }

  private generateEdges(workflowEdges: WorkflowEdge[], nodes: ReactFlowNode[]): ReactFlowEdge[] {
    return workflowEdges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source,
      target: edge.target,
      type: this.getEdgeType(edge),
      animated: this.shouldAnimateEdge(edge),
      style: this.getEdgeStyle(edge),
      label: this.getEdgeLabel(edge),
      labelStyle: { fontSize: 12, fill: '#666' },
    }));
  }

  private calculateNodePositions(nodes: WorkflowNode[]): Record<string, { x: number; y: number }> {
    // Implement Dagre layout algorithm
    const dagre = require('dagre');
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: 'TB', // Top to Bottom
      nodesep: 100, // Horizontal separation
      ranksep: 150, // Vertical separation
      marginx: 50,
      marginy: 50,
    });

    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph
    nodes.forEach(node => {
      g.setNode(node.id, {
        width: this.getNodeWidth(node.type),
        height: this.getNodeHeight(node.type),
      });
    });

    // Add edges to graph (from workflow edges)
    // Note: We need to access workflow edges here

    dagre.layout(g);

    const positions: Record<string, { x: number; y: number }> = {};
    g.nodes().forEach((nodeId: string) => {
      const node = g.node(nodeId);
      positions[nodeId] = {
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
      };
    });

    return positions;
  }

  private getNodeStyle(nodeType: string): React.CSSProperties {
    const baseStyle: React.CSSProperties = {
      borderRadius: '8px',
      border: '2px solid',
      padding: '10px',
      fontSize: '14px',
      fontWeight: 'bold',
      minWidth: '120px',
      textAlign: 'center',
    };

    switch (nodeType) {
      case 'start':
        return { ...baseStyle, backgroundColor: '#e8f5e8', borderColor: '#4caf50' };
      case 'end':
        return { ...baseStyle, backgroundColor: '#fce4ec', borderColor: '#e91e63' };
      case 'if-else':
        return { ...baseStyle, backgroundColor: '#fff3e0', borderColor: '#ff9800' };
      case 'llm':
        return { ...baseStyle, backgroundColor: '#e3f2fd', borderColor: '#2196f3' };
      case 'agent':
        return { ...baseStyle, backgroundColor: '#f3e5f5', borderColor: '#9c27b0' };
      case 'code':
        return { ...baseStyle, backgroundColor: '#e0f2f1', borderColor: '#009688' };
      default:
        return { ...baseStyle, backgroundColor: '#f5f5f5', borderColor: '#757575' };
    }
  }
}
```

### Advanced Graph Validation:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: OptimizationSuggestion[];
  metrics: WorkflowMetrics;
}

interface WorkflowMetrics {
  nodeCount: number;
  edgeCount: number;
  complexity: number;
  estimatedExecutionTime: number;
  criticalPath: string[];
  unreachableNodes: string[];
  cycles: string[][];
}

class AdvancedGraphValidator {
  validateWorkflowGraph(graph: WorkflowGraph): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: OptimizationSuggestion[] = [];

    // Structural validation
    const structuralIssues = this.validateGraphStructure(graph);
    errors.push(...structuralIssues.errors);
    warnings.push(...structuralIssues.warnings);

    // Cycle detection
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      errors.push({
        code: 'GRAPH_HAS_CYCLES',
        message: `Graph contains ${cycles.length} cycle(s)`,
        details: { cycles },
        severity: 'error',
      });
    }

    // Unreachable node detection
    const unreachableNodes = this.findUnreachableNodes(graph);
    if (unreachableNodes.length > 0) {
      warnings.push({
        code: 'UNREACHABLE_NODES',
        message: `Found ${unreachableNodes.length} unreachable node(s)`,
        details: { nodes: unreachableNodes },
      });
    }

    // Performance analysis
    const metrics = this.calculateWorkflowMetrics(graph);
    if (metrics.complexity > 100) {
      suggestions.push({
        type: 'performance',
        message: 'Consider breaking down complex workflow into sub-workflows',
        impact: 'high',
        effort: 'medium',
      });
    }

    // Critical path analysis
    const criticalPath = this.findCriticalPath(graph);
    if (criticalPath.length > 20) {
      suggestions.push({
        type: 'optimization',
        message: 'Long critical path detected - consider parallelization',
        impact: 'medium',
        effort: 'high',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      metrics: {
        ...metrics,
        unreachableNodes,
        cycles,
        criticalPath,
      },
    };
  }

  private detectCycles(graph: WorkflowGraph): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = graph.edges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        const targetId = edge.target;

        if (!visited.has(targetId)) {
          dfs(targetId, [...path, nodeId]);
        } else if (recursionStack.has(targetId)) {
          // Found a cycle
          const cycleStart = path.indexOf(targetId);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), nodeId, targetId]);
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    // Start DFS from all nodes (to catch disconnected cycles)
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  private findUnreachableNodes(graph: WorkflowGraph): string[] {
    const startNodes = graph.nodes.filter(node => node.type === 'start');
    if (startNodes.length === 0) {
      return []; // No start nodes, can't determine reachability
    }

    const reachable = new Set<string>();
    const queue = startNodes.map(node => node.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;

      reachable.add(nodeId);

      // Add all target nodes to queue
      const outgoingEdges = graph.edges.filter(edge => edge.source === nodeId);
      queue.push(...outgoingEdges.map(edge => edge.target));
    }

    return graph.nodes.map(node => node.id).filter(nodeId => !reachable.has(nodeId));
  }

  private calculateWorkflowMetrics(graph: WorkflowGraph): WorkflowMetrics {
    const nodeCount = graph.nodes.length;
    const edgeCount = graph.edges.length;

    // Calculate complexity based on node types and connections
    const complexity = this.calculateComplexityScore(graph);

    // Estimate execution time based on node types
    const estimatedExecutionTime = this.estimateExecutionTime(graph);

    // Find critical path (longest path through the graph)
    const criticalPath = this.findCriticalPath(graph);

    return {
      nodeCount,
      edgeCount,
      complexity,
      estimatedExecutionTime,
      criticalPath,
      unreachableNodes: [], // Will be filled by caller
      cycles: [], // Will be filled by caller
    };
  }

  private calculateComplexityScore(graph: WorkflowGraph): number {
    let score = 0;

    // Base complexity from node count
    score += graph.nodes.length * 2;

    // Additional complexity for specific node types
    for (const node of graph.nodes) {
      switch (node.type) {
        case 'if-else':
          score += 5; // Branching adds complexity
          break;
        case 'loop':
          score += 10; // Loops add significant complexity
          break;
        case 'llm':
          score += 3; // LLM calls are moderately complex
          break;
        default:
          score += 1;
      }
    }

    // Edge complexity (connectivity)
    score += graph.edges.length;

    return score;
  }
}
```

### Comprehensive Test Infrastructure:

```typescript
describe('Comprehensive Workflow Integration Tests', () => {
  let processor: WorkflowProcessor;
  let validator: AdvancedGraphValidator;
  let reactFlowGenerator: ReactFlowGenerator;

  beforeEach(() => {
    processor = new WorkflowProcessor();
    validator = new AdvancedGraphValidator();
    reactFlowGenerator = new ReactFlowGenerator();
  });

  describe('Example Workflow Processing', () => {
    const exampleWorkflows = [
      'simple-workflow.yaml',
      'conditional-workflow.yaml',
      'multi-step-workflow.yaml',
      'llm-workflow.yaml',
      'agent-workflow.yaml',
    ];

    exampleWorkflows.forEach(workflowFile => {
      it(`should process ${workflowFile} successfully`, async () => {
        // Load and parse workflow
        const workflowYaml = await fs.readFile(`examples/${workflowFile}`, 'utf8');
        const workflow = await processor.parseWorkflow(workflowYaml);

        // Validate workflow
        const validation = validator.validateWorkflowGraph(workflow.spec.graph);
        expect(validation.isValid).toBe(true);

        // Generate shell script
        const shellResult = await processor.generateShellScript(workflow);
        expect(shellResult.success).toBe(true);
        expect(shellResult.script).toBeDefined();

        // Generate React Flow output
        const reactFlowOutput = reactFlowGenerator.generateReactFlowOutput(workflow);
        expect(reactFlowOutput.nodes.length).toBeGreaterThan(0);
        expect(reactFlowOutput.edges.length).toBeGreaterThan(0);

        // Validate React Flow output structure
        validateReactFlowStructure(reactFlowOutput);
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process workflows within performance thresholds', async () => {
      const startTime = performance.now();

      // Process a complex workflow
      const complexWorkflow = generateComplexWorkflow(50); // 50 nodes
      const result = await processor.processWorkflow(complexWorkflow);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large workflows efficiently', async () => {
      const largeWorkflow = generateComplexWorkflow(200); // 200 nodes

      // Memory usage before
      const memBefore = process.memoryUsage().heapUsed;

      const result = await processor.processWorkflow(largeWorkflow);

      // Memory usage after
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      expect(result.success).toBe(true);
      expect(memIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Visual Regression Testing', () => {
    it('should generate consistent React Flow layouts', async () => {
      const workflow = await loadExampleWorkflow('simple-workflow.yaml');

      // Generate React Flow output multiple times
      const outputs = await Promise.all([
        reactFlowGenerator.generateReactFlowOutput(workflow),
        reactFlowGenerator.generateReactFlowOutput(workflow),
        reactFlowGenerator.generateReactFlowOutput(workflow),
      ]);

      // Positions should be consistent
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i].nodes).toEqual(outputs[0].nodes);
        expect(outputs[i].edges).toEqual(outputs[0].edges);
      }
    });

    it('should maintain visual consistency across node types', () => {
      const nodeTypes = ['start', 'end', 'if-else', 'llm', 'agent', 'code'];

      nodeTypes.forEach(nodeType => {
        const workflow = generateWorkflowWithNodeType(nodeType);
        const output = reactFlowGenerator.generateReactFlowOutput(workflow);

        const node = output.nodes.find(n => n.type === nodeType);
        expect(node).toBeDefined();
        expect(node!.style).toBeDefined();
        expect(node!.className).toContain(`flowsh-node-${nodeType}`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid workflow structures gracefully', async () => {
      const invalidWorkflows = [
        createWorkflowWithCycles(),
        createWorkflowWithUnreachableNodes(),
        createWorkflowWithInvalidEdges(),
        createWorkflowWithMissingNodes(),
      ];

      for (const workflow of invalidWorkflows) {
        const validation = validator.validateWorkflowGraph(workflow.spec.graph);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    it('should provide helpful error messages', async () => {
      const workflowWithCycle = createWorkflowWithCycles();
      const validation = validator.validateWorkflowGraph(workflowWithCycle.spec.graph);

      const cycleError = validation.errors.find(e => e.code === 'GRAPH_HAS_CYCLES');
      expect(cycleError).toBeDefined();
      expect(cycleError!.message).toContain('cycle');
      expect(cycleError!.details.cycles).toBeDefined();
    });
  });
});

// Helper functions for test data generation
function generateComplexWorkflow(nodeCount: number): FlowshWorkflow {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      type: i === 0 ? 'start' : i === nodeCount - 1 ? 'end' : 'code',
      data: { title: `Node ${i}` },
    });
  }

  // Generate edges (linear chain with some branching)
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({
      source: `node-${i}`,
      target: `node-${i + 1}`,
    });

    // Add some branching for complexity
    if (i % 10 === 0 && i + 5 < nodeCount) {
      edges.push({
        source: `node-${i}`,
        target: `node-${i + 5}`,
      });
    }
  }

  return {
    metadata: { name: `complex-workflow-${nodeCount}` },
    spec: { graph: { nodes, edges } },
  };
}

function validateReactFlowStructure(output: ReactFlowOutput): void {
  // Validate nodes
  expect(Array.isArray(output.nodes)).toBe(true);
  output.nodes.forEach(node => {
    expect(node.id).toBeDefined();
    expect(node.position).toBeDefined();
    expect(node.position.x).toBeGreaterThanOrEqual(0);
    expect(node.position.y).toBeGreaterThanOrEqual(0);
  });

  // Validate edges
  expect(Array.isArray(output.edges)).toBe(true);
  output.edges.forEach(edge => {
    expect(edge.source).toBeDefined();
    expect(edge.target).toBeDefined();
    expect(output.nodes.find(n => n.id === edge.source)).toBeDefined();
    expect(output.nodes.find(n => n.id === edge.target)).toBeDefined();
  });

  // Validate viewport
  expect(output.viewport).toBeDefined();
}
```

## DOCUMENTATION:

### React Flow Integration:

- **React Flow Documentation**: https://reactflow.dev/docs/introduction/ - Complete React Flow guide
- **Dagre Layout Algorithm**: https://github.com/dagrejs/dagre - Automatic graph layout
- **ELK Layout Engine**: https://www.eclipse.org/elk/ - Advanced layout algorithms
- **Graph Visualization Best Practices**: https://graphviz.org/documentation/ - Graph rendering principles

### Graph Theory & Validation:

- **Cycle Detection Algorithms**: https://en.wikipedia.org/wiki/Cycle_(graph_theory) - Graph cycle detection
- **Topological Sorting**: https://en.wikipedia.org/wiki/Topological_sorting - Graph ordering algorithms
- **Critical Path Method**: https://en.wikipedia.org/wiki/Critical_path_method - Project scheduling
- **Graph Complexity Metrics**: https://en.wikipedia.org/wiki/Graph_complexity - Measuring graph complexity

### Testing Infrastructure:

- **Visual Regression Testing**: https://github.com/garris/BackstopJS - Visual diff testing
- **Performance Testing**: https://nodejs.org/api/perf_hooks.html - Node.js performance measurement
- **Integration Testing Patterns**: https://martinfowler.com/articles/practical-test-pyramid.html - Testing strategy
- **Benchmark Testing**: https://github.com/bestiejs/benchmark.js - JavaScript benchmarking

## OTHER CONSIDERATIONS:

### Performance Optimizations:

- Implement lazy loading for large workflow visualizations
- Add viewport culling for workflows with hundreds of nodes
- Optimize layout calculations with web workers
- Cache React Flow outputs to avoid recalculation

### Advanced Visualization Features:

- Add workflow execution animation and real-time status updates
- Implement node grouping and collapsible sub-workflows
- Create minimap navigation for large workflows
- Add zoom-to-fit and focus-on-node functionality

### Enhanced Validation:

- Implement data flow validation across node connections
- Add type checking for node input/output compatibility
- Create workflow simulation for execution path validation
- Add resource usage estimation and optimization suggestions

### Testing Strategy:

- Create automated visual regression testing pipeline
- Add load testing for large workflow processing
- Implement property-based testing for graph algorithms
- Create mutation testing for validation logic

### Accessibility & Usability:

- Ensure React Flow output is screen reader accessible
- Add keyboard navigation support for workflow elements
- Implement high contrast mode for better visibility
- Create workflow description generation for documentation

### Integration Capabilities:

- Support for embedding React Flow output in external applications
- Add export capabilities (SVG, PNG, PDF) for workflow diagrams
- Create webhook integration for workflow status updates
- Implement real-time collaboration features for workflow editing

### Success Criteria:

1. **Visualization**: All workflow types render correctly in React Flow with proper styling and positioning
2. **Validation**: Advanced validation catches complex graph issues with actionable error messages
3. **Performance**: Large workflows (200+ nodes) process and render within acceptable time limits
4. **Quality**: Comprehensive test suite provides >95% confidence in system reliability
5. **Integration**: React Flow output integrates seamlessly with external workflow designers
6. **Usability**: Generated visualizations are intuitive and provide clear workflow understanding
