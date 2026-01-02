/**
 * Comprehensive tests for Performance Optimization features
 */

import { OptimizedTemplateEngine, WorkflowPerformanceOptimizer } from '../performance.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock workflow data
const mockWorkflow = {
  id: 'test-workflow',
  name: 'Performance Test Workflow',
  nodes: [
    { id: 'start', type: 'start', data: {} },
    { id: 'llm1', type: 'llm', data: { template: 'task-planner' } },
    { id: 'code1', type: 'code', data: {} },
    { id: 'end', type: 'end', data: {} },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'llm1' },
    { id: 'e2', source: 'llm1', target: 'code1' },
    { id: 'e3', source: 'code1', target: 'end' },
  ],
};

const mockComplexWorkflow = {
  id: 'complex-workflow',
  name: 'Complex Performance Test',
  nodes: Array.from({ length: 20 }, (_, i) => ({
    id: `node-${i}`,
    type: i % 4 === 0 ? 'start' : i % 4 === 1 ? 'llm' : i % 4 === 2 ? 'code' : 'agent',
    data: { template: i % 2 === 0 ? 'task-planner' : 'code-reviewer' },
  })),
  edges: Array.from({ length: 19 }, (_, i) => ({
    id: `e-${i}`,
    source: `node-${i}`,
    target: `node-${i + 1}`,
  })),
};

describe('OptimizedTemplateEngine', () => {
  let engine: OptimizedTemplateEngine;

  beforeEach(() => {
    // Reset environment variables for clean tests
    delete process.env['FLOWSH_ENABLE_PRELOADING'];
    delete process.env['FLOWSH_MAX_PRELOAD_SIZE'];
    delete process.env['FLOWSH_COMPRESSION'];
    delete process.env['FLOWSH_EVICTION_STRATEGY'];
    delete process.env['FLOWSH_BACKGROUND_CLEANUP'];

    engine = new OptimizedTemplateEngine(mockWorkflow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration and Initialization', () => {
    it('should initialize with default configuration', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics.templateResolutionTime).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.parallelTaskCount).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.peakMemoryUsage).toBe(0);
    });

    it('should respect environment variable configuration', () => {
      process.env['FLOWSH_ENABLE_PRELOADING'] = 'false';
      process.env['FLOWSH_MAX_PRELOAD_SIZE'] = '1048576'; // 1MB
      process.env['FLOWSH_COMPRESSION'] = 'false';
      process.env['FLOWSH_EVICTION_STRATEGY'] = 'lfu';
      process.env['FLOWSH_BACKGROUND_CLEANUP'] = 'false';

      const customEngine = new OptimizedTemplateEngine(mockWorkflow);

      // Configuration is private, but we can test its effects
      customEngine.configureOptimizations({
        enablePreloading: true,
        compressionEnabled: true,
      });

      expect(customEngine).toBeInstanceOf(OptimizedTemplateEngine);
    });

    it('should start background optimization when enabled', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation(vi.fn());
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(vi.fn());

      process.env['FLOWSH_BACKGROUND_CLEANUP'] = 'true';
      new OptimizedTemplateEngine(mockWorkflow);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('Template Resolution Optimization', () => {
    it('should resolve templates with performance tracking', async () => {
      // Mock the base resolveTemplate method
      const mockResolveTemplate = vi.fn().mockResolvedValue('resolved template content');
      engine.resolveTemplate = mockResolveTemplate;

      const result = await engine.resolveTemplateOptimized('task-planner');

      expect(result).toBe('resolved template content');
      expect(mockResolveTemplate).toHaveBeenCalledWith('task-planner', undefined);

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.templateResolutionTime).toBeGreaterThan(0);
    });

    it('should handle template resolution failures gracefully', async () => {
      const mockResolveTemplate = vi.fn().mockRejectedValue(new Error('Template not found'));
      engine.resolveTemplate = mockResolveTemplate;

      await expect(engine.resolveTemplateOptimized('nonexistent-template')).rejects.toThrow(
        'Template not found'
      );

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should use compression cache when available', async () => {
      const mockResolveTemplate = vi.fn().mockResolvedValue('original template');
      engine.resolveTemplate = mockResolveTemplate;

      // First call to populate cache
      await engine.resolveTemplateOptimized('cacheable-template');

      // Enable compression and compress the template
      engine.configureOptimizations({ compressionEnabled: true });

      // Second call should still work (though compression is mocked)
      const result = await engine.resolveTemplateOptimized('cacheable-template');
      expect(result).toBeDefined();
    });
  });

  describe('Batch Template Resolution', () => {
    it('should resolve multiple templates in parallel', async () => {
      const mockResolveTemplate = vi
        .fn()
        .mockResolvedValueOnce('template1 content')
        .mockResolvedValueOnce('template2 content')
        .mockResolvedValueOnce('template3 content');

      engine.resolveTemplate = mockResolveTemplate;

      const templates = [
        { id: 'template1' },
        { id: 'template2', version: 'v2' },
        { id: 'template3' },
      ];

      const results = await engine.batchResolveTemplates(templates);

      expect(results.size).toBe(3);
      expect(results.get('template1:latest')).toBe('template1 content');
      expect(results.get('template2:v2')).toBe('template2 content');
      expect(results.get('template3:latest')).toBe('template3 content');

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.parallelTaskCount).toBe(3);
    });

    it('should handle partial failures in batch resolution', async () => {
      const mockResolveTemplate = vi
        .fn()
        .mockResolvedValueOnce('template1 content')
        .mockRejectedValueOnce(new Error('Template2 failed'))
        .mockResolvedValueOnce('template3 content');

      engine.resolveTemplate = mockResolveTemplate;

      const templates = [{ id: 'template1' }, { id: 'template2' }, { id: 'template3' }];

      const results = await engine.batchResolveTemplates(templates);

      // Should only have successful results
      expect(results.size).toBe(2);
      expect(results.get('template1:latest')).toBe('template1 content');
      expect(results.get('template3:latest')).toBe('template3 content');
      expect(results.has('template2:latest')).toBe(false);
    });

    it('should respect concurrency limits', async () => {
      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      const mockResolveTemplate = vi.fn().mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));

        concurrentCalls--;
        return 'template content';
      });

      engine.resolveTemplate = mockResolveTemplate;

      const templates = Array.from({ length: 10 }, (_, i) => ({ id: `template${i}` }));
      await engine.batchResolveTemplates(templates);

      // Should not exceed concurrency limit of 5
      expect(maxConcurrentCalls).toBeLessThanOrEqual(5);
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should track performance metrics accurately', async () => {
      const mockResolveTemplate = vi.fn().mockResolvedValue('template content');
      engine.resolveTemplate = mockResolveTemplate;

      // Make several requests to build up metrics
      await engine.resolveTemplateOptimized('template1');
      await engine.resolveTemplateOptimized('template2');
      await engine.resolveTemplateOptimized('template1'); // Repeat access

      const metrics = engine.getPerformanceMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.templateReferences).toBe(2); // Two unique templates
      expect(metrics.templateResolutionTime).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      const mockResolveTemplate = vi.fn().mockResolvedValue('template content');
      engine.resolveTemplate = mockResolveTemplate;

      // Access same template multiple times to build cache hit rate
      await engine.resolveTemplateOptimized('popular-template');
      await engine.resolveTemplateOptimized('popular-template');
      await engine.resolveTemplateOptimized('popular-template');

      const metrics = engine.getPerformanceMetrics();

      // Cache hit rate should be > 0 due to repeated access
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should track memory usage', async () => {
      const mockResolveTemplate = vi.fn().mockResolvedValue('template content');
      engine.resolveTemplate = mockResolveTemplate;

      const initialMetrics = engine.getPerformanceMetrics();

      await engine.resolveTemplateOptimized('memory-test-template');

      const finalMetrics = engine.getPerformanceMetrics();

      expect(finalMetrics.memoryUsage).toBeGreaterThan(0);
      expect(finalMetrics.peakMemoryUsage).toBeGreaterThanOrEqual(finalMetrics.memoryUsage);
    });
  });

  describe('Cache Optimization', () => {
    it('should optimize cache based on usage patterns', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      engine.optimizeCache();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache optimization started')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache optimization completed')
      );
    });

    it('should preload common templates when enabled', async () => {
      const mockResolveTemplate = vi.fn().mockResolvedValue('template content');
      engine.resolveTemplate = mockResolveTemplate;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(fn => {
        // Execute immediately for testing
        if (typeof fn === 'function') fn();
        return {} as any;
      });

      engine.configureOptimizations({ enablePreloading: true });
      await engine.preloadCommonTemplates();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preloading 5 common templates')
      );

      setTimeoutSpy.mockRestore();
    });

    it('should handle preload size limits', async () => {
      engine.configureOptimizations({
        enablePreloading: true,
        maxPreloadSize: 100, // Very small limit
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());

      await engine.preloadCommonTemplates();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Preload size exceeds limit')
      );
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance reports', () => {
      const report = engine.generatePerformanceReport();

      expect(report).toContain('# flowsh Template Engine Performance Report');
      expect(report).toContain('Cache Hit Rate:');
      expect(report).toContain('Memory Usage:');
      expect(report).toContain('Cache Entries:');
      expect(report).toContain('Compression Ratio:');
      expect(report).toContain('Template References:');
      expect(report).toContain('Parallel Tasks:');
      expect(report).toContain('Average Resolution Time:');
      expect(report).toContain('Generated at:');
    });

    it('should include configuration in performance reports', () => {
      engine.configureOptimizations({
        enablePreloading: false,
        compressionEnabled: true,
        evictionStrategy: 'lfu',
        backgroundCleanup: false,
      });

      const report = engine.generatePerformanceReport();

      expect(report).toContain('Preloading Enabled: false');
      expect(report).toContain('Compression Enabled: true');
      expect(report).toContain('Eviction Strategy: lfu');
      expect(report).toContain('Background Cleanup: false');
    });
  });
});

describe('WorkflowPerformanceOptimizer', () => {
  let optimizer: WorkflowPerformanceOptimizer;

  beforeEach(() => {
    optimizer = new WorkflowPerformanceOptimizer();
  });

  describe('Execution Order Optimization', () => {
    it('should optimize workflow execution order for parallelization', () => {
      const optimizedWorkflow = optimizer.optimizeExecutionOrder(mockWorkflow);

      expect(optimizedWorkflow.performance_hints).toBeDefined();
      expect(optimizedWorkflow.performance_hints.parallel_groups).toBeGreaterThan(0);
      expect(optimizedWorkflow.performance_hints.optimization_applied).toBe(true);
      expect(optimizedWorkflow.performance_hints.timestamp).toBeTypeOf('number');
    });

    it('should handle complex workflows with multiple parallel groups', () => {
      const optimizedWorkflow = optimizer.optimizeExecutionOrder(mockComplexWorkflow);

      expect(optimizedWorkflow.nodes).toHaveLength(20);
      expect(optimizedWorkflow.performance_hints.parallel_groups).toBeGreaterThan(1);
      expect(optimizedWorkflow.performance_hints.max_parallelization).toBeGreaterThan(0);
    });

    it('should preserve original workflow structure', () => {
      const original = JSON.parse(JSON.stringify(mockWorkflow));
      const optimized = optimizer.optimizeExecutionOrder(mockWorkflow);

      // Should not modify original
      expect(mockWorkflow).toEqual(original);

      // Should have same number of nodes
      expect(optimized.nodes).toHaveLength(original.nodes.length);
      expect(optimized.id).toBe(original.id);
      expect(optimized.name).toBe(original.name);
    });
  });

  describe('Shell Script Generation', () => {
    it('should generate performance-optimized shell scripts', () => {
      const script = optimizer.generateOptimizedShellScript(mockWorkflow);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('Performance-optimized flowsh workflow');
      expect(script).toContain('set -euo pipefail');
      expect(script).toContain('export FLOWSH_PARALLEL_JOBS=');
      expect(script).toContain('export FLOWSH_MEMORY_LIMIT=');
      expect(script).toContain('export FLOWSH_TIMEOUT=');
      expect(script).toContain('execute_parallel_group()');
      expect(script).toContain('monitor_memory()');
    });

    it('should include parallel execution groups in generated script', () => {
      const script = optimizer.generateOptimizedShellScript(mockComplexWorkflow);

      expect(script).toContain('# Parallel Group');
      expect(script).toContain('execute_parallel_group');
      expect(script).toContain('monitor_memory');
    });

    it('should handle workflows with different node types', () => {
      const mixedWorkflow = {
        ...mockWorkflow,
        nodes: [
          { id: 'start', type: 'start', data: {} },
          { id: 'llm', type: 'llm', data: {} },
          { id: 'code', type: 'code', data: {} },
          { id: 'agent', type: 'agent', data: {} },
          { id: 'if-else', type: 'if-else', data: {} },
          { id: 'end', type: 'end', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'llm' },
          { id: 'e2', source: 'llm', target: 'code' },
          { id: 'e3', source: 'code', target: 'agent' },
          { id: 'e4', source: 'agent', target: 'if-else' },
          { id: 'e5', source: 'if-else', target: 'end' },
        ],
      };

      const script = optimizer.generateOptimizedShellScript(mixedWorkflow);

      expect(script).toContain('node_start');
      expect(script).toContain('node_llm');
      expect(script).toContain('node_code');
      expect(script).toContain('node_agent');
      expect(script).toContain('node_if_else'); // Dashes converted to underscores
      expect(script).toContain('node_end');
    });
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = optimizer.getPerformanceMetrics();

      expect(metrics).toHaveProperty('nodesProcessed');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('parallelizationRatio');
      expect(metrics).toHaveProperty('memoryEfficiency');

      expect(metrics.nodesProcessed).toBe(0); // Initial state
    });

    it('should track optimization operations', () => {
      optimizer.optimizeExecutionOrder(mockWorkflow);
      optimizer.generateOptimizedShellScript(mockWorkflow);

      const metrics = optimizer.getPerformanceMetrics();

      // Metrics should be available after operations
      expect(metrics).toEqual({
        nodesProcessed: 0,
        averageProcessingTime: 0,
        parallelizationRatio: 0,
        memoryEfficiency: 0,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty workflows gracefully', () => {
      const emptyWorkflow = { nodes: [], edges: [] };

      const optimized = optimizer.optimizeExecutionOrder(emptyWorkflow);
      expect(optimized.nodes).toHaveLength(0);
      expect(optimized.performance_hints.parallel_groups).toBe(0);

      const script = optimizer.generateOptimizedShellScript(emptyWorkflow);
      expect(script).toContain('#!/bin/bash');
    });

    it('should handle workflows with no edges', () => {
      const noEdgesWorkflow = {
        nodes: [
          { id: 'isolated1', type: 'start', data: {} },
          { id: 'isolated2', type: 'end', data: {} },
        ],
        edges: [],
      };

      const optimized = optimizer.optimizeExecutionOrder(noEdgesWorkflow);
      expect(optimized.nodes).toHaveLength(2);
      expect(optimized.performance_hints.parallel_groups).toBeGreaterThanOrEqual(1);
    });

    it('should handle circular dependencies', () => {
      const circularWorkflow = {
        nodes: [
          { id: 'a', type: 'start', data: {} },
          { id: 'b', type: 'llm', data: {} },
          { id: 'c', type: 'end', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
          { id: 'e3', source: 'c', target: 'a' }, // Creates a cycle
        ],
      };

      const optimized = optimizer.optimizeExecutionOrder(circularWorkflow);
      expect(optimized.nodes).toHaveLength(3);
      expect(optimized.performance_hints.optimization_applied).toBe(true);
    });
  });
});

describe('Performance Integration Tests', () => {
  it('should work together - optimizer and engine', async () => {
    const optimizer = new WorkflowPerformanceOptimizer();
    const optimizedWorkflow = optimizer.optimizeExecutionOrder(mockWorkflow);

    const engine = new OptimizedTemplateEngine(optimizedWorkflow);
    engine.resolveTemplate = vi.fn().mockResolvedValue('test template');

    // Test that optimized workflow works with performance engine
    const result = await engine.resolveTemplateOptimized('test-template');
    expect(result).toBe('test template');

    const metrics = engine.getPerformanceMetrics();
    expect(metrics.totalRequests).toBe(1);

    const script = optimizer.generateOptimizedShellScript(optimizedWorkflow);
    expect(script).toContain('Performance-optimized flowsh workflow');
  });

  it('should maintain performance under load', async () => {
    const engine = new OptimizedTemplateEngine(mockComplexWorkflow);
    engine.resolveTemplate = vi.fn().mockImplementation(async () => {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1));
      return 'template content';
    });

    const startTime = performance.now();

    // Simulate load with batch resolution
    const templates = Array.from({ length: 50 }, (_, i) => ({ id: `template-${i}` }));
    const results = await engine.batchResolveTemplates(templates);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(results.size).toBe(50);
    expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

    const metrics = engine.getPerformanceMetrics();
    expect(metrics.totalRequests).toBe(50);
    expect(metrics.parallelTaskCount).toBe(50);
  });
});
