/**
 * Health check and monitoring system for flowsh
 * Provides comprehensive system health monitoring and metrics collection
 */
import { StructuredLogger } from '../logging/logger.js';
import * as os from 'os';

/**
 * Health check result status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Overall system health summary
 */
export interface SystemHealth {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: Date;
  checks: HealthCheckResult[];
  metrics: SystemMetrics;
}

/**
 * System performance metrics
 */
export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    loadAverage: number[];
    usage?: number;
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
  };
  custom: Record<string, unknown>;
}

/**
 * Health check function interface
 */
export type HealthChecker = () => Promise<HealthCheckResult>;

/**
 * Health monitoring configuration
 */
export interface HealthConfig {
  enabled: boolean;
  checkInterval: number;
  timeout: number;
  enableMetrics: boolean;
  enableDetailedMemory: boolean;
}

/**
 * Health monitor class
 */
export class HealthMonitor {
  private checks = new Map<string, HealthChecker>();
  private lastResults = new Map<string, HealthCheckResult>();
  private startTime = Date.now();
  private version = '1.0.0';
  private metrics: SystemMetrics;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private config: HealthConfig,
    private logger: StructuredLogger
  ) {
    this.metrics = this.initializeMetrics();
    this.registerDefaultChecks();

    if (config.enabled && config.checkInterval > 0) {
      this.startPeriodicChecks();
    }
  }

  /**
   * Initialize system metrics
   */
  private initializeMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        used: memoryUsage.rss,
        total: memoryUsage.rss + memoryUsage.external,
        percentage: 0,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
      },
      cpu: {
        loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0],
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
      },
      custom: {},
    };
  }

  /**
   * Register default system health checks
   */
  private registerDefaultChecks(): void {
    // Memory usage check
    this.registerCheck('memory', async () => {
      const start = Date.now();
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.rss + memoryUsage.external;
      const percentage = (memoryUsage.rss / totalMemory) * 100;

      let status: HealthStatus = 'healthy';
      let message = `Memory usage: ${Math.round(percentage)}%`;

      if (percentage > 90) {
        status = 'unhealthy';
        message = `Critical memory usage: ${Math.round(percentage)}%`;
      } else if (percentage > 75) {
        status = 'degraded';
        message = `High memory usage: ${Math.round(percentage)}%`;
      }

      return {
        name: 'memory',
        status,
        message,
        duration: Date.now() - start,
        timestamp: new Date(),
        metadata: {
          percentage,
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
        },
      };
    });
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    this.intervalId = setInterval(() => {
      this.runAllChecks().catch(error => {
        this.logger.error('Periodic health check failed', { error });
      });
    }, this.config.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  public stopPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Register a custom health check
   */
  public registerCheck(name: string, checker: HealthChecker): void {
    this.checks.set(name, checker);
    this.logger.debug(`Registered health check: ${name}`);
  }

  /**
   * Run all registered health checks
   */
  public async runAllChecks(): Promise<HealthCheckResult[]> {
    const checkPromises = Array.from(this.checks.keys()).map(name => this.runCheck(name));
    const results = await Promise.all(checkPromises);

    return results.filter((result): result is HealthCheckResult => result !== undefined);
  }

  /**
   * Run a specific health check
   */
  public async runCheck(name: string): Promise<HealthCheckResult | undefined> {
    const checker = this.checks.get(name);
    if (!checker) {
      return undefined;
    }

    try {
      const result = await checker();
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: this.config.timeout,
        timestamp: new Date(),
      };

      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }

  /**
   * Get current system health summary
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const checks = await this.runAllChecks();
    const overallStatus: HealthStatus = checks.some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : checks.some(c => c.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      version: this.version,
      uptime: Date.now() - this.startTime,
      timestamp: new Date(),
      checks,
      metrics: this.metrics,
    };
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): void {
    this.stopPeriodicChecks();
    this.logger.info('Health monitor shutdown completed');
  }
}

/**
 * Create a health monitor with default configuration
 */
export function createHealthMonitor(
  config: Partial<HealthConfig> = {},
  logger: StructuredLogger
): HealthMonitor {
  const defaultConfig: HealthConfig = {
    enabled: true,
    checkInterval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    enableMetrics: true,
    enableDetailedMemory: true,
  };

  return new HealthMonitor({ ...defaultConfig, ...config }, logger);
}
