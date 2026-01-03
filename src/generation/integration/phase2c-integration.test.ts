/**
 * Phase 2C Integration Tests
 *
 * Basic integration tests to verify Phase 2C generators are properly registered and functional
 */

import { createDefaultRegistry } from '../generators/index.js';
import { describe, it, expect } from 'vitest';

describe('Phase 2C Integration Tests', () => {
  describe('Generator Registry Integration', () => {
    it('should have all Phase 2C generators registered in default registry', () => {
      const registry = createDefaultRegistry();

      // Verify all Phase 2C generators are registered
      expect(registry.get('parallel-iteration')).toBeDefined();
      expect(registry.get('retry')).toBeDefined();
      expect(registry.get('fallback')).toBeDefined();
      expect(registry.get('circuit-breaker')).toBeDefined();
    });

    it('should have correct node types for Phase 2C generators', () => {
      const registry = createDefaultRegistry();

      const parallelGen = registry.get('parallel-iteration');
      const retryGen = registry.get('retry');
      const fallbackGen = registry.get('fallback');
      const cbGen = registry.get('circuit-breaker');

      expect(parallelGen?.nodeType).toBe('parallel-iteration');
      expect(retryGen?.nodeType).toBe('retry');
      expect(fallbackGen?.nodeType).toBe('fallback');
      expect(cbGen?.nodeType).toBe('circuit-breaker');
    });

    it('should include all Phase 1, Phase 2A, Phase 2B, and Phase 2C generators', () => {
      const registry = createDefaultRegistry();

      // Phase 1 generators
      expect(registry.get('start')).toBeDefined();
      expect(registry.get('answer')).toBeDefined();
      expect(registry.get('code')).toBeDefined();
      expect(registry.get('llm')).toBeDefined();

      // Phase 2A generators
      expect(registry.get('variable-assignment')).toBeDefined();
      expect(registry.get('if-else')).toBeDefined();
      expect(registry.get('loop')).toBeDefined();

      // Phase 2B generators
      expect(registry.get('iteration')).toBeDefined();
      expect(registry.get('variable-aggregation')).toBeDefined();
      expect(registry.get('http-request')).toBeDefined();

      // Phase 2C generators (Advanced Features)
      expect(registry.get('parallel-iteration')).toBeDefined();
      expect(registry.get('retry')).toBeDefined();
      expect(registry.get('fallback')).toBeDefined();
      expect(registry.get('circuit-breaker')).toBeDefined();
    });

    it('should handle generator registration without errors', () => {
      expect(() => createDefaultRegistry()).not.toThrow();
    });

    it('should provide unique generators for each node type', () => {
      const registry = createDefaultRegistry();

      const parallelGen = registry.get('parallel-iteration');
      const retryGen = registry.get('retry');
      const fallbackGen = registry.get('fallback');
      const cbGen = registry.get('circuit-breaker');

      // All generators should be unique instances
      expect(parallelGen).not.toBe(retryGen);
      expect(retryGen).not.toBe(fallbackGen);
      expect(fallbackGen).not.toBe(cbGen);
      expect(cbGen).not.toBe(parallelGen);
    });
  });

  describe('Phase 2C Feature Completeness', () => {
    it('should provide comprehensive error handling capabilities', () => {
      const registry = createDefaultRegistry();

      // Error handling progression: Retry → Fallback → Circuit Breaker
      const retryGen = registry.get('retry');
      const fallbackGen = registry.get('fallback');
      const cbGen = registry.get('circuit-breaker');

      expect(retryGen).toBeDefined();
      expect(fallbackGen).toBeDefined();
      expect(cbGen).toBeDefined();

      // All should be different generators providing layered error handling
      expect(retryGen?.nodeType).toBe('retry');
      expect(fallbackGen?.nodeType).toBe('fallback');
      expect(cbGen?.nodeType).toBe('circuit-breaker');
    });

    it('should provide advanced parallel processing capabilities', () => {
      const registry = createDefaultRegistry();

      const parallelGen = registry.get('parallel-iteration');
      const basicIterationGen = registry.get('iteration');

      // Should have both basic and advanced iteration capabilities
      expect(parallelGen).toBeDefined();
      expect(basicIterationGen).toBeDefined();

      expect(parallelGen?.nodeType).toBe('parallel-iteration');
      expect(basicIterationGen?.nodeType).toBe('iteration');

      // Should be different generators
      expect(parallelGen).not.toBe(basicIterationGen);
    });

    it('should complete Phase 2C feature set as defined in PRP', () => {
      const registry = createDefaultRegistry();

      // Phase 2C requirements from PRP:
      // Week 1: Parallel Processing + Resource Management ✅
      expect(registry.get('parallel-iteration')).toBeDefined();

      // Week 2: Enhanced Error Handling (Retry + Fallback) ✅
      expect(registry.get('retry')).toBeDefined();
      expect(registry.get('fallback')).toBeDefined();

      // Week 3: Production Hardening (Circuit Breaker) ✅
      expect(registry.get('circuit-breaker')).toBeDefined();

      // All Phase 2C features are implemented and registered
      const phase2cFeatures = ['parallel-iteration', 'retry', 'fallback', 'circuit-breaker'];
      for (const feature of phase2cFeatures) {
        const generator = registry.get(feature);
        expect(generator, `${feature} generator should be registered`).toBeDefined();
        expect(generator!.nodeType, `${feature} should have correct nodeType`).toBe(feature);
      }
    });
  });

  describe('Integration Verification', () => {
    it('should support complete workflow generation pipeline', () => {
      const registry = createDefaultRegistry();

      // Verify we have generators for a complete advanced workflow
      const requiredGenerators = [
        'start', // Workflow entry
        'variable-assignment', // Setup
        'parallel-iteration', // Phase 2C: Parallel processing
        'retry', // Phase 2C: Retry mechanism
        'fallback', // Phase 2C: Fallback system
        'circuit-breaker', // Phase 2C: Circuit breaker
        'variable-aggregation', // Results collection
        'answer', // Workflow exit
      ];

      for (const genType of requiredGenerators) {
        const generator = registry.get(genType);
        expect(generator, `Required generator ${genType} should be available`).toBeDefined();
      }
    });

    it('should maintain backward compatibility with Phase 1, 2A, and 2B features', () => {
      const registry = createDefaultRegistry();

      // All previous phase features should still be available
      const legacyGenerators = [
        // Phase 1
        'start',
        'answer',
        'code',
        'llm',
        'agent',
        // Phase 2A
        'variable-assignment',
        'if-else',
        'loop',
        // Phase 2B
        'iteration',
        'variable-aggregation',
        'template-transform',
        'http-request',
        'sub-workflow',
      ];

      for (const genType of legacyGenerators) {
        const generator = registry.get(genType);
        expect(generator, `Legacy generator ${genType} should still be available`).toBeDefined();
      }
    });
  });

  describe('Performance Integration', () => {
    it('should register all generators efficiently', () => {
      const startTime = Date.now();

      // Create registry multiple times to test performance
      for (let i = 0; i < 100; i++) {
        const registry = createDefaultRegistry();
        expect(registry.get('circuit-breaker')).toBeDefined();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Registry creation should be fast (under 1 second for 100 registrations)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large numbers of generator lookups efficiently', () => {
      const registry = createDefaultRegistry();
      const startTime = Date.now();

      // Perform many lookups
      for (let i = 0; i < 1000; i++) {
        registry.get('parallel-iteration');
        registry.get('retry');
        registry.get('fallback');
        registry.get('circuit-breaker');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Lookups should be very fast (under 100ms for 4000 lookups)
      expect(duration).toBeLessThan(100);
    });
  });
});
