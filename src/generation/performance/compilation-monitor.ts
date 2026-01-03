/**
 * Compilation Performance Monitor
 *
 * Provides timeout enforcement and resource monitoring for workflow compilation
 */

export interface CompilationLimits {
  /** Maximum compilation time in milliseconds */
  timeoutMs: number;
  /** Maximum number of nodes allowed */
  maxNodes: number;
  /** Maximum workflow file size in bytes */
  maxFileSizeBytes: number;
  /** Maximum memory usage in MB (0 = no limit) */
  maxMemoryMB: number;
}

export interface CompilationMetrics {
  /** Start time of compilation */
  startTime: number;
  /** End time of compilation (0 if not finished) */
  endTime: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Peak memory usage in MB */
  peakMemoryMB: number;
  /** Number of nodes processed */
  nodesProcessed: number;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export class CompilationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Compilation timed out after ${timeoutMs}ms`);
    this.name = 'CompilationTimeoutError';
  }
}

export class ResourceLimitError extends Error {
  constructor(resource: string, limit: number, actual: number) {
    super(`Resource limit exceeded: ${resource} limit=${limit}, actual=${actual}`);
    this.name = 'ResourceLimitError';
  }
}

/**
 * Monitor and enforce compilation performance limits
 */
export class CompilationMonitor {
  private startTime: number = 0;
  private timeoutHandle?: NodeJS.Timeout | undefined;
  private limits: CompilationLimits;
  private metrics: CompilationMetrics;

  constructor(limits: Partial<CompilationLimits> = {}) {
    this.limits = {
      timeoutMs: limits.timeoutMs || 30000, // 30 seconds default
      maxNodes: limits.maxNodes || 100,
      maxFileSizeBytes: limits.maxFileSizeBytes || 10 * 1024 * 1024, // 10MB default
      maxMemoryMB: limits.maxMemoryMB || 0, // No memory limit by default
    };

    this.metrics = {
      startTime: 0,
      endTime: 0,
      durationMs: 0,
      peakMemoryMB: 0,
      nodesProcessed: 0,
      success: false,
    };
  }

  /**
   * Start monitoring compilation
   * @throws {ResourceLimitError} If initial resource checks fail
   */
  start(): void {
    this.startTime = Date.now();
    this.metrics.startTime = this.startTime;

    // Set timeout handler
    this.timeoutHandle = setTimeout(() => {
      this.finish(false, `Compilation timed out after ${this.limits.timeoutMs}ms`);
      throw new CompilationTimeoutError(this.limits.timeoutMs);
    }, this.limits.timeoutMs);
  }

  /**
   * Check if node count is within limits
   * @param nodeCount - Number of nodes to validate
   * @throws {ResourceLimitError} If node count exceeds limit
   */
  checkNodeCount(nodeCount: number): void {
    if (nodeCount > this.limits.maxNodes) {
      throw new ResourceLimitError('nodeCount', this.limits.maxNodes, nodeCount);
    }
  }

  /**
   * Check if file size is within limits
   * @param fileSizeBytes - File size in bytes
   * @throws {ResourceLimitError} If file size exceeds limit
   */
  checkFileSize(fileSizeBytes: number): void {
    if (fileSizeBytes > this.limits.maxFileSizeBytes) {
      throw new ResourceLimitError('fileSizeBytes', this.limits.maxFileSizeBytes, fileSizeBytes);
    }
  }

  /**
   * Update progress tracking
   * @param nodesProcessed - Number of nodes processed so far
   */
  updateProgress(nodesProcessed: number): void {
    this.metrics.nodesProcessed = nodesProcessed;

    // Update memory usage if monitoring is enabled
    if (this.limits.maxMemoryMB > 0) {
      const memoryUsage = this.getMemoryUsageMB();
      this.metrics.peakMemoryMB = Math.max(this.metrics.peakMemoryMB, memoryUsage);

      if (memoryUsage > this.limits.maxMemoryMB) {
        throw new ResourceLimitError('memoryMB', this.limits.maxMemoryMB, memoryUsage);
      }
    }
  }

  /**
   * Finish monitoring and record final metrics
   * @param success - Whether compilation succeeded
   * @param error - Error message if failed
   */
  finish(success: boolean, error?: string): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }

    this.metrics.endTime = Date.now();
    this.metrics.durationMs = this.metrics.endTime - this.metrics.startTime;
    this.metrics.success = success;
    if (error) {
      this.metrics.error = error;
    }

    // Final memory check
    if (this.limits.maxMemoryMB > 0) {
      const memoryUsage = this.getMemoryUsageMB();
      this.metrics.peakMemoryMB = Math.max(this.metrics.peakMemoryMB, memoryUsage);
    }
  }

  /**
   * Get current compilation metrics
   */
  getMetrics(): CompilationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsageMB(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / (1024 * 1024);
  }

  /**
   * Get elapsed time since compilation started
   */
  getElapsedMs(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Check if compilation should continue (not timed out)
   */
  shouldContinue(): boolean {
    return this.getElapsedMs() < this.limits.timeoutMs;
  }
}
