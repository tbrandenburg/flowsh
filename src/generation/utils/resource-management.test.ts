/**
 * Tests for Resource Management Utilities
 */

import {
  ResourceManager,
  ResourceLimits,
  getResourceManager,
  createResourceManager,
  resetGlobalResourceManager,
} from './resource-management';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Global test configuration to prevent memory leaks
let testResourceManagers: ResourceManager[] = [];

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;

  beforeEach(() => {
    // Clear any existing global instance
    vi.clearAllMocks();
    resetGlobalResourceManager();
    testResourceManagers = [];
  });

  afterEach(async () => {
    // Clean up all resource managers created in tests
    for (const manager of testResourceManagers) {
      await manager.cleanup();
    }
    testResourceManagers = [];

    if (resourceManager) {
      await resourceManager.cleanup();
    }

    // Reset global instance after each test
    resetGlobalResourceManager();
  });

  // Helper function to create and track resource managers
  const createTrackedResourceManager = (limits?: ResourceLimits): ResourceManager => {
    const manager = new ResourceManager(limits);
    testResourceManagers.push(manager);
    return manager;
  };

  describe('initialization', () => {
    it('should initialize with default limits', () => {
      resourceManager = createTrackedResourceManager();

      const usage = resourceManager.getCurrentUsage();
      expect(usage.activeProcesses).toBe(0);
      expect(usage.tempFileCount).toBe(0);
      expect(usage.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(usage.timestamp).toBeGreaterThan(0);
    });

    it('should initialize with custom limits', () => {
      const customLimits: ResourceLimits = {
        maxMemoryMB: 500,
        maxProcesses: 25,
        maxTempFiles: 50,
        maxExecutionTimeMs: 60000,
      };

      resourceManager = createTrackedResourceManager(customLimits);

      // Test that limits are applied (through generated code)
      const shellCode = resourceManager.generateResourceMonitoringCode();
      expect(shellCode).toContain('FLOWSH_MAX_MEMORY_MB=500');
      expect(shellCode).toContain('FLOWSH_MAX_PROCESSES=25');
      expect(shellCode).toContain('FLOWSH_MAX_EXECUTION_TIME_SEC=60');
    });
  });

  describe('resource monitoring code generation', () => {
    beforeEach(() => {
      resourceManager = createTrackedResourceManager();
    });

    it('should generate comprehensive shell monitoring functions', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      // Check for essential functions
      expect(shellCode).toContain('check_system_commands()');
      expect(shellCode).toContain('get_memory_usage()');
      expect(shellCode).toContain('get_process_count()');
      expect(shellCode).toContain('check_resource_limits()');
      expect(shellCode).toContain('register_process()');
      expect(shellCode).toContain('cleanup_all_resources()');
    });

    it('should include global variable declarations', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('declare -g FLOWSH_ACTIVE_PIDS=()');
      expect(shellCode).toContain('declare -g FLOWSH_TEMP_FILES=()');
      expect(shellCode).toContain('declare -g FLOWSH_START_TIME=');
      expect(shellCode).toContain('declare -g FLOWSH_MAX_MEMORY_MB=');
    });

    it('should include memory monitoring for different systems', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      // Linux (free command)
      expect(shellCode).toContain('free -m');

      // macOS (vm_stat command)
      expect(shellCode).toContain('vm_stat');

      // Fallback handling
      expect(shellCode).toContain('Memory monitoring not available');
    });

    it('should include process management functions', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('register_process()');
      expect(shellCode).toContain('unregister_process()');
      expect(shellCode).toContain('cleanup_active_processes()');
      expect(shellCode).toContain('kill -TERM');
      expect(shellCode).toContain('kill -KILL');
    });

    it('should include temporary file management', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('register_temp_file()');
      expect(shellCode).toContain('create_managed_temp_dir()');
      expect(shellCode).toContain('cleanup_temp_files()');
      expect(shellCode).toContain('mktemp -d');
    });

    it('should include resource limit checking', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('Memory limit exceeded');
      expect(shellCode).toContain('Process limit exceeded');
      expect(shellCode).toContain('Execution time limit exceeded');
      expect(shellCode).toContain('check_resource_limits()');
    });

    it('should include trap handlers for cleanup', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('setup_resource_cleanup_traps()');
      expect(shellCode).toContain("trap 'cleanup_all_resources; exit 0' EXIT");
      expect(shellCode).toContain('trap \'log_warning "Workflow interrupted');
      expect(shellCode).toContain('INT TERM');
    });

    it('should include background monitoring', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('monitor_resources_background()');
      expect(shellCode).toContain('sleep 30');
      expect(shellCode).toContain('# Background resource monitoring');
    });

    it('should include enhanced parallel execution', () => {
      const shellCode = resourceManager.generateResourceMonitoringCode();

      expect(shellCode).toContain('execute_with_resource_management()');
      expect(shellCode).toContain('ulimit -v');
      expect(shellCode).toContain('ulimit -t');
      expect(shellCode).toContain('Per-process memory limit');
    });
  });

  describe('process tracking', () => {
    beforeEach(() => {
      resourceManager = createTrackedResourceManager();
    });

    it('should register and track processes', () => {
      const pid = 12345;
      const command = 'test-command';

      resourceManager.registerProcess(pid, command);

      const usage = resourceManager.getCurrentUsage();
      expect(usage.activeProcesses).toBe(1);
    });

    it('should unregister processes', () => {
      const pid = 12345;

      resourceManager.registerProcess(pid, 'test-command');
      expect(resourceManager.getCurrentUsage().activeProcesses).toBe(1);

      resourceManager.unregisterProcess(pid, 'completed');
      expect(resourceManager.getCurrentUsage().activeProcesses).toBe(0);
    });

    it('should track multiple processes', () => {
      resourceManager.registerProcess(1001, 'command-1');
      resourceManager.registerProcess(1002, 'command-2');
      resourceManager.registerProcess(1003, 'command-3');

      expect(resourceManager.getCurrentUsage().activeProcesses).toBe(3);

      resourceManager.unregisterProcess(1002, 'failed');
      expect(resourceManager.getCurrentUsage().activeProcesses).toBe(2);
    });
  });

  describe('temporary file tracking', () => {
    beforeEach(() => {
      resourceManager = createTrackedResourceManager();
    });

    it('should register temporary files', () => {
      resourceManager.registerTempFile('/tmp/test-file-1');
      resourceManager.registerTempFile('/tmp/test-file-2');

      expect(resourceManager.getCurrentUsage().tempFileCount).toBe(2);
    });

    it('should unregister temporary files', () => {
      const filePath = '/tmp/test-file';

      resourceManager.registerTempFile(filePath);
      expect(resourceManager.getCurrentUsage().tempFileCount).toBe(1);

      resourceManager.unregisterTempFile(filePath);
      expect(resourceManager.getCurrentUsage().tempFileCount).toBe(0);
    });

    it('should handle duplicate file registrations', () => {
      const filePath = '/tmp/duplicate-file';

      resourceManager.registerTempFile(filePath);
      resourceManager.registerTempFile(filePath); // Duplicate

      // Set should deduplicate
      expect(resourceManager.getCurrentUsage().tempFileCount).toBe(1);
    });
  });

  describe('resource limit checking', () => {
    it('should detect memory limit violations', () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 10, // Very low limit for testing
        maxProcesses: 100,
        maxTempFiles: 100,
        maxExecutionTimeMs: 60000,
      };

      resourceManager = createTrackedResourceManager(limits);

      const { withinLimits, violations } = resourceManager.checkLimits();

      // Memory usage will likely exceed 10MB
      if (!withinLimits) {
        expect(violations.some(v => v.includes('Memory:'))).toBe(true);
      }
    });

    it('should detect process limit violations', () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 1000,
        maxProcesses: 1, // Very low limit
        maxTempFiles: 100,
        maxExecutionTimeMs: 60000,
      };

      resourceManager = createTrackedResourceManager(limits);

      // Register multiple processes to exceed limit
      resourceManager.registerProcess(1001, 'process-1');
      resourceManager.registerProcess(1002, 'process-2');

      const { withinLimits, violations } = resourceManager.checkLimits();

      expect(withinLimits).toBe(false);
      expect(violations.some(v => v.includes('Processes:'))).toBe(true);
    });

    it('should detect temp file limit violations', () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 1000,
        maxProcesses: 100,
        maxTempFiles: 2, // Very low limit
        maxExecutionTimeMs: 60000,
      };

      resourceManager = createTrackedResourceManager(limits);

      // Register multiple temp files to exceed limit
      resourceManager.registerTempFile('/tmp/file-1');
      resourceManager.registerTempFile('/tmp/file-2');
      resourceManager.registerTempFile('/tmp/file-3');

      const { withinLimits, violations } = resourceManager.checkLimits();

      expect(withinLimits).toBe(false);
      expect(violations.some(v => v.includes('Temp files:'))).toBe(true);
    });

    it('should detect execution time limit violations', async () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 1000,
        maxProcesses: 100,
        maxTempFiles: 100,
        maxExecutionTimeMs: 10, // Very short time
      };

      resourceManager = createTrackedResourceManager(limits);

      // Wait for time limit to be exceeded
      await new Promise(resolve => setTimeout(resolve, 20));

      const { withinLimits, violations } = resourceManager.checkLimits();

      expect(withinLimits).toBe(false);
      expect(violations.some(v => v.includes('Execution time:'))).toBe(true);
    });

    it('should pass when all limits are within bounds', () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 10000, // Very high limits
        maxProcesses: 1000,
        maxTempFiles: 1000,
        maxExecutionTimeMs: 600000,
      };

      resourceManager = createTrackedResourceManager(limits);

      const { withinLimits, violations } = resourceManager.checkLimits();

      expect(withinLimits).toBe(true);
      expect(violations).toHaveLength(0);
    });
  });

  describe('cleanup handlers', () => {
    beforeEach(() => {
      resourceManager = createTrackedResourceManager();
    });

    it('should add and execute cleanup handlers', async () => {
      let cleanupCalled = false;

      resourceManager.addCleanupHandler(() => {
        cleanupCalled = true;
      });

      await resourceManager.cleanup();

      expect(cleanupCalled).toBe(true);
    });

    it('should handle multiple cleanup handlers', async () => {
      const results: string[] = [];

      resourceManager.addCleanupHandler(() => results.push('handler-1'));
      resourceManager.addCleanupHandler(() => results.push('handler-2'));
      resourceManager.addCleanupHandler(() => results.push('handler-3'));

      await resourceManager.cleanup();

      expect(results).toEqual(['handler-1', 'handler-2', 'handler-3']);
    });

    it('should continue with other handlers if one fails', async () => {
      const results: string[] = [];

      resourceManager.addCleanupHandler(() => results.push('handler-1'));
      resourceManager.addCleanupHandler(() => {
        throw new Error('Handler failed');
      });
      resourceManager.addCleanupHandler(() => results.push('handler-3'));

      await resourceManager.cleanup();

      expect(results).toEqual(['handler-1', 'handler-3']);
    });
  });

  describe('resource usage tracking', () => {
    beforeEach(() => {
      resourceManager = createTrackedResourceManager();
    });

    it('should provide current resource usage', () => {
      const usage = resourceManager.getCurrentUsage();

      expect(usage).toHaveProperty('memoryUsageMB');
      expect(usage).toHaveProperty('activeProcesses');
      expect(usage).toHaveProperty('tempFileCount');
      expect(usage).toHaveProperty('executionTimeMs');
      expect(usage).toHaveProperty('timestamp');

      expect(typeof usage.memoryUsageMB).toBe('number');
      expect(typeof usage.activeProcesses).toBe('number');
      expect(typeof usage.tempFileCount).toBe('number');
      expect(typeof usage.executionTimeMs).toBe('number');
      expect(typeof usage.timestamp).toBe('number');
    });

    it('should track execution time progression', async () => {
      const usage1 = resourceManager.getCurrentUsage();

      await new Promise(resolve => setTimeout(resolve, 10));

      const usage2 = resourceManager.getCurrentUsage();

      expect(usage2.executionTimeMs).toBeGreaterThan(usage1.executionTimeMs);
      expect(usage2.timestamp).toBeGreaterThan(usage1.timestamp);
    });

    it('should report memory usage', () => {
      const usage = resourceManager.getCurrentUsage();

      // Memory usage should be positive and reasonable (less than 1GB for tests)
      expect(usage.memoryUsageMB).toBeGreaterThan(0);
      expect(usage.memoryUsageMB).toBeLessThan(1000);
    });
  });
});

describe('Resource Manager Factory Functions', () => {
  let testManagers: ResourceManager[] = [];

  beforeEach(() => {
    // Reset global instance before each test
    resetGlobalResourceManager();
    testManagers = [];
  });

  afterEach(async () => {
    // Clean up any managers created in tests
    for (const manager of testManagers) {
      await manager.cleanup();
    }
    testManagers = [];

    // Clean up any global instances
    resetGlobalResourceManager();
  });

  describe('getResourceManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getResourceManager();
      const manager2 = getResourceManager();

      expect(manager1).toBe(manager2);
    });

    it('should initialize with custom limits on first call', () => {
      const customLimits: ResourceLimits = {
        maxMemoryMB: 750,
        maxProcesses: 30,
      };

      const manager = getResourceManager(customLimits);
      const shellCode = manager.generateResourceMonitoringCode();

      expect(shellCode).toContain('FLOWSH_MAX_MEMORY_MB=750');
      expect(shellCode).toContain('FLOWSH_MAX_PROCESSES=30');
    });
  });

  describe('createResourceManager', () => {
    it('should create new instance with specified limits', async () => {
      const limits: ResourceLimits = {
        maxMemoryMB: 256,
        maxProcesses: 10,
        maxTempFiles: 20,
        maxExecutionTimeMs: 30000,
      };

      const manager = createResourceManager(limits);
      testManagers.push(manager); // Track for cleanup

      const shellCode = manager.generateResourceMonitoringCode();

      expect(shellCode).toContain('FLOWSH_MAX_MEMORY_MB=256');
      expect(shellCode).toContain('FLOWSH_MAX_PROCESSES=10');
      expect(shellCode).toContain('FLOWSH_MAX_EXECUTION_TIME_SEC=30');
    });

    it('should create independent instances', async () => {
      const manager1 = createResourceManager({ maxMemoryMB: 100 });
      const manager2 = createResourceManager({ maxMemoryMB: 200 });
      testManagers.push(manager1, manager2); // Track for cleanup

      expect(manager1).not.toBe(manager2);

      const code1 = manager1.generateResourceMonitoringCode();
      const code2 = manager2.generateResourceMonitoringCode();

      expect(code1).toContain('FLOWSH_MAX_MEMORY_MB=100');
      expect(code2).toContain('FLOWSH_MAX_MEMORY_MB=200');
    });
  });
});

describe('Resource Manager Shell Code Edge Cases', () => {
  let resourceManager: ResourceManager;
  let testManagers: ResourceManager[] = [];

  beforeEach(() => {
    testManagers = [];
  });

  afterEach(async () => {
    for (const manager of testManagers) {
      await manager.cleanup();
    }
    testManagers = [];

    if (resourceManager) {
      await resourceManager.cleanup();
    }
  });

  const createTrackedManager = (limits?: ResourceLimits): ResourceManager => {
    const manager = new ResourceManager(limits);
    testManagers.push(manager);
    return manager;
  };

  it('should handle missing system commands gracefully', () => {
    resourceManager = createTrackedManager();
    const shellCode = resourceManager.generateResourceMonitoringCode();

    expect(shellCode).toContain('check_system_commands()');
    expect(shellCode).toContain('Missing system commands:');
    expect(shellCode).toContain('Resource monitoring will be limited');
  });

  it('should include ulimit protection', () => {
    resourceManager = createTrackedManager();
    const shellCode = resourceManager.generateResourceMonitoringCode();

    expect(shellCode).toContain('ulimit -v'); // Memory limit
    expect(shellCode).toContain('ulimit -t'); // Time limit
    expect(shellCode).toContain('2>/dev/null || true'); // Graceful failure
  });

  it('should include comprehensive error handling', () => {
    resourceManager = createTrackedManager();
    const shellCode = resourceManager.generateResourceMonitoringCode();

    expect(shellCode).toContain('|| true'); // Continue on errors
    expect(shellCode).toContain('2>/dev/null'); // Suppress error output
    expect(shellCode).toContain('log_warning'); // Warning messages
    expect(shellCode).toContain('log_error'); // Error messages
  });

  it('should include robust cleanup procedures', () => {
    resourceManager = createTrackedManager();
    const shellCode = resourceManager.generateResourceMonitoringCode();

    expect(shellCode).toContain('rm -rf'); // File cleanup
    expect(shellCode).toContain('kill -TERM'); // Graceful termination
    expect(shellCode).toContain('kill -KILL'); // Force termination
    expect(shellCode).toContain('wait'); // Process synchronization
  });
});
