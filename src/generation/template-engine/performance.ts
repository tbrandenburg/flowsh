/**
 * Performance Optimizations for flowsh Template Engine and Workflow Processing
 *
 * This module provides optimized versions of core functionality with:
 * - Memory-efficient caching strategies
 * - Lazy loading and prefetching
 * - Parallel processing capabilities
 * - Performance monitoring and metrics
 */

import { TemplateEngine } from './index.js';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  templateResolutionTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  parallelTaskCount: number;
  lastOptimized: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  peakMemoryUsage: number;
}

/**
 * Cache optimization configuration
 */
interface CacheOptimizationConfig {
  enablePreloading: boolean;
  maxPreloadSize: number;
  compressionEnabled: boolean;
  evictionStrategy: 'lru' | 'lfu' | 'ttl';
  backgroundCleanup: boolean;
  maxCacheSize: number;
  cacheTtl: number;
  preloadThreshold: number;
}

/**
 * Template reference with metadata for optimization
 */
interface OptimizedTemplateReference {
  id: string;
  size: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  compressed?: boolean;
  preloaded?: boolean;
  compressionRatio?: number;
  averageAccessTime?: number;
}

/**
 * Real-time performance monitoring
 */
class PerformanceMonitor {
  private metricsHistory: PerformanceMetrics[] = [];
  private alertThresholds = {
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxResponseTime: 5000, // 5s
    minCacheHitRate: 0.7, // 70%
  };

  recordMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push({ ...metrics, timestamp: Date.now() } as any);

    // Keep only last 100 measurements
    if (this.metricsHistory.length > 100) {
      this.metricsHistory = this.metricsHistory.slice(-100);
    }

    this.checkAlerts(metrics);
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    if (metrics.memoryUsage > this.alertThresholds.maxMemoryUsage) {
      console.warn(
        `Memory usage alert: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB exceeds threshold`
      );
    }

    if (metrics.averageResponseTime > this.alertThresholds.maxResponseTime) {
      console.warn(
        `Response time alert: ${metrics.averageResponseTime.toFixed(2)}ms exceeds threshold`
      );
    }

    if (metrics.cacheHitRate < this.alertThresholds.minCacheHitRate) {
      console.warn(
        `Cache hit rate alert: ${(metrics.cacheHitRate * 100).toFixed(2)}% below threshold`
      );
    }
  }

  getTrends(): { memory: number; responseTime: number; cacheHitRate: number } {
    if (this.metricsHistory.length < 2) {
      return { memory: 0, responseTime: 0, cacheHitRate: 0 };
    }

    const recent = this.metricsHistory.slice(-10);
    const older = this.metricsHistory.slice(-20, -10);

    const avgRecent = recent.reduce(
      (sum, m) => ({
        memory: sum.memory + m.memoryUsage,
        responseTime: sum.responseTime + m.averageResponseTime,
        cacheHitRate: sum.cacheHitRate + m.cacheHitRate,
      }),
      { memory: 0, responseTime: 0, cacheHitRate: 0 }
    );

    const avgOlder = older.reduce(
      (sum, m) => ({
        memory: sum.memory + m.memoryUsage,
        responseTime: sum.responseTime + m.averageResponseTime,
        cacheHitRate: sum.cacheHitRate + m.cacheHitRate,
      }),
      { memory: 0, responseTime: 0, cacheHitRate: 0 }
    );

    return {
      memory: avgRecent.memory / recent.length - avgOlder.memory / older.length,
      responseTime: avgRecent.responseTime / recent.length - avgOlder.responseTime / older.length,
      cacheHitRate: avgRecent.cacheHitRate / recent.length - avgOlder.cacheHitRate / older.length,
    };
  }

  getHealthScore(): number {
    if (this.metricsHistory.length === 0) return 100;

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    if (!latest) return 100;

    let score = 100;

    // Memory usage penalty (0-30 points)
    const memoryRatio = latest.memoryUsage / this.alertThresholds.maxMemoryUsage;
    score -= Math.min(30, memoryRatio * 30);

    // Response time penalty (0-25 points)
    const responseRatio = latest.averageResponseTime / this.alertThresholds.maxResponseTime;
    score -= Math.min(25, responseRatio * 25);

    // Cache hit rate bonus/penalty (0-20 points)
    const cacheRatio = latest.cacheHitRate / this.alertThresholds.minCacheHitRate;
    if (cacheRatio < 1) {
      score -= (1 - cacheRatio) * 20;
    } else {
      score += Math.min(5, (cacheRatio - 1) * 10); // Bonus for high hit rate
    }

    // Error rate penalty (0-25 points)
    const errorRate = latest.failedRequests / Math.max(1, latest.totalRequests);
    score -= errorRate * 25;

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Optimized Template Engine with performance enhancements
 */
export class OptimizedTemplateEngine extends TemplateEngine {
  private performanceMetrics: PerformanceMetrics;
  private optimizationConfig: CacheOptimizationConfig;
  private templateReferences = new Map<string, OptimizedTemplateReference>();
  private preloadQueue = new Set<string>();
  private compressionCache = new Map<string, string>();
  private performanceMonitor = new PerformanceMonitor();
  private requestStartTimes = new Map<string, number>();

  constructor(workflow: any) {
    super(workflow);

    this.performanceMetrics = {
      templateResolutionTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      parallelTaskCount: 0,
      lastOptimized: Date.now(),
      totalRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
    };

    this.optimizationConfig = {
      enablePreloading: process.env['FLOWSH_ENABLE_PRELOADING'] !== 'false',
      maxPreloadSize: parseInt(process.env['FLOWSH_MAX_PRELOAD_SIZE'] || '5242880'), // 5MB
      compressionEnabled: process.env['FLOWSH_COMPRESSION'] !== 'false',
      evictionStrategy: (process.env['FLOWSH_EVICTION_STRATEGY'] as 'lru' | 'lfu' | 'ttl') || 'lru',
      backgroundCleanup: process.env['FLOWSH_BACKGROUND_CLEANUP'] !== 'false',
      maxCacheSize: parseInt(process.env['FLOWSH_MAX_CACHE_SIZE'] || '104857600'), // 100MB
      cacheTtl: parseInt(process.env['FLOWSH_CACHE_TTL'] || '3600000'), // 1 hour
      preloadThreshold: parseInt(process.env['FLOWSH_PRELOAD_THRESHOLD'] || '3'), // Access count threshold
    };

    // Start background optimization if enabled
    if (this.optimizationConfig.backgroundCleanup) {
      this.startBackgroundOptimization();
    }
  }

  /**
   * Optimized template resolution with performance tracking
   */
  async resolveTemplateOptimized(templateId: string, version?: string): Promise<string> {
    const startTime = performance.now();
    const requestId = `${templateId}:${version || 'latest'}:${Date.now()}`;
    this.requestStartTimes.set(requestId, startTime);

    // Always update access patterns for tracking, even before attempting resolution
    this.updateAccessPattern(templateId);

    try {
      // Check if template should be preloaded
      await this.handlePreloading(templateId, version);

      // Get template with optimization
      const template = await this.getOptimizedTemplate(requestId, templateId, version);

      // Update performance metrics for success
      this.updatePerformanceMetrics(requestId, true);

      return template;
    } catch (error) {
      // Update performance metrics for failure
      this.updatePerformanceMetrics(requestId, false);
      throw error;
    } finally {
      this.requestStartTimes.delete(requestId);
    }
  }

  /**
   * Batch resolve multiple templates in parallel
   */
  async batchResolveTemplates(
    templates: Array<{ id: string; version?: string }>
  ): Promise<Map<string, string>> {
    const startTime = performance.now();
    const results = new Map<string, string>();

    // Process templates in parallel with concurrency limit
    const concurrency = Math.min(templates.length, 5);
    const batches = this.chunkArray(templates, concurrency);

    for (const batch of batches) {
      const promises = batch.map(async ({ id, version }) => {
        try {
          const template = await this.resolveTemplateOptimized(id, version);
          return { id: `${id}:${version || 'latest'}`, template };
        } catch (error) {
          console.warn(`Failed to resolve template ${id}: ${error}`);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(result => {
        if (result) {
          results.set(result.id, result.template);
        }
      });
    }

    this.performanceMetrics.parallelTaskCount = templates.length;
    this.performanceMetrics.templateResolutionTime = performance.now() - startTime;

    return results;
  }

  /**
   * Preload commonly used templates
   */
  async preloadCommonTemplates(): Promise<void> {
    if (!this.optimizationConfig.enablePreloading) {
      return;
    }

    const commonTemplates = [
      'task-planner',
      'code-reviewer',
      'data-processor',
      'error-handler',
      'security-checker',
    ];

    const preloadSize = this.calculatePreloadSize(commonTemplates);
    if (preloadSize > this.optimizationConfig.maxPreloadSize) {
      console.warn('Preload size exceeds limit, skipping some templates');
      return;
    }

    console.log(`Preloading ${commonTemplates.length} common templates...`);

    // Preload in background
    setTimeout(async () => {
      for (const templateId of commonTemplates) {
        try {
          await this.resolveTemplateOptimized(templateId);
          this.markAsPreloaded(templateId);
        } catch (error) {
          console.warn(`Failed to preload template ${templateId}: ${error}`);
        }
      }
    }, 100);
  }

  /**
   * Optimize cache based on usage patterns
   */
  optimizeCache(): void {
    const now = Date.now();
    const cacheStats = this.getCacheStats();

    console.log(
      `Cache optimization started. Current size: ${cacheStats.size} bytes, entries: ${cacheStats.entries}`
    );

    // Apply eviction strategy
    this.applyCacheEviction();

    // Compress frequently accessed templates
    if (this.optimizationConfig.compressionEnabled) {
      this.compressFrequentTemplates();
    }

    // Update metrics
    this.performanceMetrics.lastOptimized = now;
    this.performanceMetrics.memoryUsage = this.getCacheStats().size;
    this.performanceMetrics.cacheHitRate = this.calculateCacheHitRate();

    console.log(`Cache optimization completed. New size: ${this.getCacheStats().size} bytes`);
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics & {
    cacheStats: ReturnType<TemplateEngine['getCacheStats']>;
    templateReferences: number;
    compressionRatio: number;
  } {
    const cacheStats = this.getCacheStats();
    const compressionRatio = this.calculateCompressionRatio();

    return {
      ...this.performanceMetrics,
      cacheStats,
      templateReferences: this.templateReferences.size,
      compressionRatio,
    };
  }

  /**
   * Configure optimization settings
   */
  configureOptimizations(config: Partial<CacheOptimizationConfig>): void {
    this.optimizationConfig = { ...this.optimizationConfig, ...config };

    if (config.backgroundCleanup && !this.optimizationConfig.backgroundCleanup) {
      this.startBackgroundOptimization();
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const metrics = this.getPerformanceMetrics();
    const uptime = Date.now() - this.performanceMetrics.lastOptimized;

    return `
# flowsh Template Engine Performance Report

## Cache Performance
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%
- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB
- Cache Entries: ${metrics.cacheStats.entries}
- Compression Ratio: ${(metrics.compressionRatio * 100).toFixed(2)}%

## Template Metrics  
- Template References: ${metrics.templateReferences}
- Parallel Tasks: ${metrics.parallelTaskCount}
- Average Resolution Time: ${metrics.templateResolutionTime.toFixed(2)}ms

## Optimization Settings
- Preloading Enabled: ${this.optimizationConfig.enablePreloading}
- Compression Enabled: ${this.optimizationConfig.compressionEnabled}
- Eviction Strategy: ${this.optimizationConfig.evictionStrategy}
- Background Cleanup: ${this.optimizationConfig.backgroundCleanup}

## Uptime
- Last Optimized: ${new Date(this.performanceMetrics.lastOptimized).toISOString()}
- Uptime: ${(uptime / 1000 / 60).toFixed(2)} minutes

Generated at: ${new Date().toISOString()}
`;
  }

  // Private optimization methods

  private async getOptimizedTemplate(
    requestId: string,
    templateId: string,
    version?: string
  ): Promise<string> {
    const cacheKey = `${templateId}:${version || 'latest'}`;

    // Log cache access for debugging (only in development)
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(`Template request ${requestId}: checking cache for ${cacheKey}`);
    }

    // Check compression cache first
    if (this.compressionCache.has(cacheKey)) {
      return this.decompressTemplate(this.compressionCache.get(cacheKey)!);
    }

    // Fallback to standard resolution
    return this.resolveTemplate(templateId, version);
  }

  private async handlePreloading(templateId: string, version?: string): Promise<void> {
    if (!this.optimizationConfig.enablePreloading) {
      return;
    }

    const cacheKey = `${templateId}:${version || 'latest'}`;

    if (this.preloadQueue.has(cacheKey)) {
      // Already queued for preloading
      return;
    }

    // Check if this template should be preloaded based on access patterns
    const reference = this.templateReferences.get(templateId);
    if (reference && reference.accessCount > 3 && !reference.preloaded) {
      this.preloadQueue.add(cacheKey);

      // Preload in background
      setTimeout(async () => {
        try {
          await this.resolveTemplate(templateId, version);
          this.markAsPreloaded(templateId);
          this.preloadQueue.delete(cacheKey);
        } catch (error) {
          console.warn(`Background preload failed for ${templateId}: ${error}`);
          this.preloadQueue.delete(cacheKey);
        }
      }, 50);
    }
  }

  private updateAccessPattern(templateId: string): void {
    const now = Date.now();
    const existing = this.templateReferences.get(templateId);

    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = now;
      // Update rolling average access time
      const newTime = this.performanceMetrics.templateResolutionTime;
      existing.averageAccessTime = existing.averageAccessTime
        ? existing.averageAccessTime * 0.8 + newTime * 0.2
        : newTime;
    } else {
      this.templateReferences.set(templateId, {
        id: templateId,
        size: 0, // Will be updated when template is cached
        accessCount: 1,
        lastAccessed: now,
        createdAt: now,
        averageAccessTime: this.performanceMetrics.templateResolutionTime,
      });
    }

    // Update global metrics
    this.performanceMetrics.totalRequests++;
  }

  private updatePerformanceMetrics(requestId: string, success: boolean): void {
    const startTime = this.requestStartTimes.get(requestId);
    if (!startTime) return;

    const duration = performance.now() - startTime;

    // Update rolling averages
    this.performanceMetrics.templateResolutionTime =
      this.performanceMetrics.templateResolutionTime * 0.9 + duration * 0.1;

    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.averageResponseTime * 0.9 + duration * 0.1;

    // Update failure count
    if (!success) {
      this.performanceMetrics.failedRequests++;
    }

    // Update peak memory if current is higher
    const currentMemory = process.memoryUsage().heapUsed;
    this.performanceMetrics.memoryUsage = currentMemory;
    this.performanceMetrics.peakMemoryUsage = Math.max(
      this.performanceMetrics.peakMemoryUsage,
      currentMemory
    );

    // Record metrics to performance monitor for alerting
    this.performanceMonitor.recordMetrics(this.performanceMetrics);
  }

  private applyCacheEviction(): void {
    const cacheStats = this.getCacheStats();

    if (cacheStats.size > cacheStats.maxSize * 0.8) {
      console.log('Applying cache eviction strategy:', this.optimizationConfig.evictionStrategy);

      switch (this.optimizationConfig.evictionStrategy) {
        case 'lru':
          this.evictLeastRecentlyUsed();
          break;
        case 'lfu':
          this.evictLeastFrequentlyUsed();
          break;
        case 'ttl':
          // Default TTL eviction is handled by the base class
          break;
      }
    }
  }

  private evictLeastRecentlyUsed(): void {
    const sortedReferences = Array.from(this.templateReferences.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    let evictedSize = 0;
    const targetSize = this.getCacheStats().maxSize * 0.2; // Evict 20%

    for (const [templateId, reference] of sortedReferences) {
      if (evictedSize >= targetSize) break;

      // Don't evict preloaded templates
      if (reference.preloaded) continue;

      this.templateReferences.delete(templateId);
      this.compressionCache.delete(templateId);
      evictedSize += reference.size;
    }

    console.log(`LRU eviction freed ${evictedSize} bytes`);
  }

  private evictLeastFrequentlyUsed(): void {
    const sortedReferences = Array.from(this.templateReferences.entries()).sort(
      ([, a], [, b]) => a.accessCount - b.accessCount
    );

    let evictedSize = 0;
    const targetSize = this.getCacheStats().maxSize * 0.2;

    for (const [templateId, reference] of sortedReferences) {
      if (evictedSize >= targetSize) break;

      if (reference.preloaded) continue;

      this.templateReferences.delete(templateId);
      this.compressionCache.delete(templateId);
      evictedSize += reference.size;
    }

    console.log(`LFU eviction freed ${evictedSize} bytes`);
  }

  private compressFrequentTemplates(): void {
    if (!this.optimizationConfig.compressionEnabled) {
      return;
    }

    const frequentTemplates = Array.from(this.templateReferences.entries())
      .filter(([, ref]) => ref.accessCount > 5 && !ref.compressed)
      .slice(0, 10); // Compress top 10 frequent templates

    for (const [templateId, reference] of frequentTemplates) {
      try {
        // Simulate compression (in real implementation, use actual compression)
        const compressed = this.compressTemplate(templateId);
        if (compressed) {
          this.compressionCache.set(templateId, compressed);
          reference.compressed = true;
        }
      } catch (error) {
        console.warn(`Failed to compress template ${templateId}: ${error}`);
      }
    }
  }

  private compressTemplate(templateId: string): string | null {
    // Placeholder for actual compression implementation
    // In real implementation, use gzip or similar
    return `compressed:${templateId}:${Date.now()}`;
  }

  private decompressTemplate(compressed: string): string {
    // Placeholder for actual decompression
    return `decompressed:${compressed}`;
  }

  private calculatePreloadSize(templates: string[]): number {
    return templates.reduce((total, templateId) => {
      const reference = this.templateReferences.get(templateId);
      return total + (reference?.size || 1024); // Assume 1KB if unknown
    }, 0);
  }

  private markAsPreloaded(templateId: string): void {
    const reference = this.templateReferences.get(templateId);
    if (reference) {
      reference.preloaded = true;
    }
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    const totalRequests = Array.from(this.templateReferences.values()).reduce(
      (sum, ref) => sum + ref.accessCount,
      0
    );

    const cacheHits = Array.from(this.templateReferences.values()).reduce(
      (sum, ref) => sum + Math.max(0, ref.accessCount - 1),
      0
    );

    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  private calculateCompressionRatio(): number {
    const totalSize = Array.from(this.templateReferences.values()).reduce(
      (sum, ref) => sum + ref.size,
      0
    );

    const compressedSize = this.compressionCache.size * 512; // Estimated compressed size

    return totalSize > 0 ? compressedSize / totalSize : 0;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private startBackgroundOptimization(): void {
    // Run optimization every 5 minutes
    setInterval(
      () => {
        try {
          this.optimizeCache();
        } catch (error) {
          console.warn('Background optimization failed:', error);
        }
      },
      5 * 60 * 1000
    );

    // Preload common templates on startup
    setTimeout(() => {
      this.preloadCommonTemplates().catch(error => {
        console.warn('Initial preload failed:', error);
      });
    }, 1000);
  }
}

/**
 * Workflow processing optimizations
 */
export class WorkflowPerformanceOptimizer {
  private processingMetrics = {
    nodesProcessed: 0,
    averageProcessingTime: 0,
    parallelizationRatio: 0,
    memoryEfficiency: 0,
  };

  /**
   * Optimize workflow execution order for parallel processing
   */
  optimizeExecutionOrder(workflow: any): any {
    const optimized = { ...workflow };

    // Analyze dependency graph
    const dependencyMap = this.buildDependencyMap(workflow);

    // Find parallelizable node groups
    const parallelGroups = this.findParallelizableGroups(dependencyMap);

    // Optimize node placement for better performance
    const optimizedNodes = this.optimizeNodePlacement(workflow.nodes, parallelGroups);

    optimized.nodes = optimizedNodes;

    // Add performance hints
    optimized.performance_hints = {
      parallel_groups: parallelGroups.length,
      max_parallelization: Math.max(...parallelGroups.map(g => g.length)),
      optimization_applied: true,
      timestamp: Date.now(),
    };

    return optimized;
  }

  /**
   * Generate performance-optimized shell script
   */
  generateOptimizedShellScript(workflow: any): string {
    const parallelGroups = this.findParallelizableGroups(this.buildDependencyMap(workflow));

    let script = `#!/bin/bash
# Performance-optimized flowsh workflow
# Generated: ${new Date().toISOString()}
# Parallelization groups: ${parallelGroups.length}

set -euo pipefail

# Performance configuration
export FLOWSH_PARALLEL_JOBS=\${FLOWSH_PARALLEL_JOBS:-4}
export FLOWSH_MEMORY_LIMIT=\${FLOWSH_MEMORY_LIMIT:-1024M}
export FLOWSH_TIMEOUT=\${FLOWSH_TIMEOUT:-300}

# Parallel execution helper
execute_parallel_group() {
    local group_id="\$1"
    shift
    local commands=("\$@")
    
    log_info "Executing parallel group \$group_id with \${#commands[@]} commands"
    
    local pids=()
    for cmd in "\${commands[@]}"; do
        eval "\$cmd" &
        pids+=(\$!)
        
        # Limit concurrent jobs
        if [ \${#pids[@]} -ge \$FLOWSH_PARALLEL_JOBS ]; then
            wait \${pids[0]}
            pids=("\${pids[@]:1}")
        fi
    done
    
    # Wait for remaining jobs
    for pid in "\${pids[@]}"; do
        wait "\$pid"
    done
    
    log_info "Parallel group \$group_id completed"
}

# Memory monitoring
monitor_memory() {
    local current_usage=\$(ps -o pid,vsz,comm -p \$$ | tail -1 | awk '{print \$2}')
    if [ \$current_usage -gt \$(echo "\$FLOWSH_MEMORY_LIMIT" | sed 's/M/000/') ]; then
        log_warning "Memory usage (\${current_usage}KB) approaching limit (\$FLOWSH_MEMORY_LIMIT)"
    fi
}
`;

    // Generate optimized execution logic
    for (let i = 0; i < parallelGroups.length; i++) {
      const group = parallelGroups[i];

      if (!group || group.length === 0) {
        continue;
      }

      script += `
# Parallel Group ${i + 1} (${group.length} nodes)
execute_parallel_group ${i + 1} \\`;

      for (const nodeId of group) {
        if (nodeId) {
          script += `
    "node_${nodeId.replace(/-/g, '_')}" \\`;
        }
      }

      script += `

monitor_memory
`;
    }

    return script;
  }

  private buildDependencyMap(workflow: any): Map<string, string[]> {
    const dependencyMap = new Map<string, string[]>();

    // Initialize all nodes
    for (const node of workflow.nodes || []) {
      dependencyMap.set(node.id, []);
    }

    // Build dependencies from edges
    for (const edge of workflow.edges || []) {
      const dependencies = dependencyMap.get(edge.target) || [];
      dependencies.push(edge.source);
      dependencyMap.set(edge.target, dependencies);
    }

    return dependencyMap;
  }

  private findParallelizableGroups(dependencyMap: Map<string, string[]>): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    const nodes = Array.from(dependencyMap.keys());

    while (processed.size < nodes.length) {
      const currentGroup: string[] = [];

      for (const nodeId of nodes) {
        if (processed.has(nodeId)) continue;

        const dependencies = dependencyMap.get(nodeId) || [];
        const canExecute = dependencies.every(dep => processed.has(dep));

        if (canExecute) {
          currentGroup.push(nodeId);
        }
      }

      if (currentGroup.length === 0) {
        // Circular dependency detected
        const remaining = nodes.filter(n => !processed.has(n));
        if (remaining.length > 0 && remaining[0] !== undefined) {
          currentGroup.push(remaining[0]);
        }
      }

      currentGroup.forEach(nodeId => processed.add(nodeId));
      groups.push(currentGroup);
    }

    return groups;
  }

  private optimizeNodePlacement(nodes: any[], parallelGroups: string[][]): any[] {
    // Sort nodes to group parallelizable ones together
    const optimized: any[] = [];

    for (const group of parallelGroups) {
      const groupNodes = nodes.filter(node => group.includes(node.id));
      optimized.push(...groupNodes);
    }

    // Add any remaining nodes
    const processedIds = new Set(optimized.map(n => n.id));
    const remaining = nodes.filter(node => !processedIds.has(node.id));
    optimized.push(...remaining);

    return optimized;
  }

  getPerformanceMetrics() {
    return { ...this.processingMetrics };
  }
}
