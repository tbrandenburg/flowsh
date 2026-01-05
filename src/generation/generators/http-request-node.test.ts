/**
 * Tests for HTTP Request Node Generator
 */

import type { WorkflowNode, HttpRequestNodeData } from '../../dsl/types.js';
import { HttpRequestNodeGenerator } from './http-request-node.js';
import type { GenerationContext } from '../registry/types.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HttpRequestNodeGenerator', () => {
  let generator: HttpRequestNodeGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new HttpRequestNodeGenerator();
    mockContext = {
      options: { verbose: false, shell: 'bash' },
      variables: new Map(),
      nodeCount: 5,
      currentNodeIndex: 1,
      workflowName: 'test-workflow',
    };
  });

  describe('nodeType', () => {
    it('should have correct node type', () => {
      expect(generator.nodeType).toBe('http-request');
    });
  });

  describe('generate', () => {
    it('should generate basic GET request', () => {
      const node: WorkflowNode = {
        id: 'get_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/data',
          method: 'GET',
          title: 'Fetch Data',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_get_test()');
      expect(result).toContain('log_step "🌐 HTTP Request: Fetch Data"');
      expect(result).toContain('local url="https://api.example.com/data"');
      expect(result).toContain('local method="GET"');
      expect(result).toContain('curl');
    });

    it('should generate POST request with body', () => {
      const node: WorkflowNode = {
        id: 'post_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/create',
          method: 'POST',
          body: '{"data": "test"}',
          body_type: 'json',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_post_test()');
      expect(result).toContain('local method="POST"');
      expect(result).toContain('local body_content="{\\\"data\\\": \\\"test\\\"}"');
      expect(result).toContain('-d');
    });

    it('should generate request with Bearer authentication', () => {
      const node: WorkflowNode = {
        id: 'auth_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/protected',
          method: 'GET',
          auth_type: 'bearer',
          auth_token: 'secret123',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_auth_test()');
      expect(result).toContain('Bearer token authentication');
      expect(result).toContain('Authorization: Bearer');
    });

    it('should generate request with Basic authentication', () => {
      const node: WorkflowNode = {
        id: 'basic_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/basic',
          method: 'GET',
          auth_type: 'basic',
          auth_credentials: 'user:pass',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_basic_test()');
      expect(result).toContain('Basic authentication');
      expect(result).toContain('-u');
    });

    it('should generate request with timeout', () => {
      const node: WorkflowNode = {
        id: 'timeout_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/slow',
          method: 'GET',
          timeout: 60,
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_timeout_test()');
      expect(result).toContain('local timeout=60');
      expect(result).toContain('--max-time');
    });

    it('should generate request with retries', () => {
      const node: WorkflowNode = {
        id: 'retry_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/unstable',
          method: 'GET',
          retries: 5,
          retry_delay: 3,
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toContain('execute_http_retry_test()');
      expect(result).toContain('local max_retries=5');
      expect(result).toContain('local retry_delay=3');
      expect(result).toContain('--retry');
    });

    it('should handle missing title with node id fallback', () => {
      const node: WorkflowNode = {
        id: 'no_title',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/test',
          method: 'GET',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);
      expect(result).toContain('log_step "🌐 HTTP Request: no_title"');
    });
  });

  describe('validation', () => {
    it('should validate valid node', () => {
      const validNode: WorkflowNode = {
        id: 'valid',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/valid',
          method: 'GET',
        } as HttpRequestNodeData,
      };

      const result = generator.validate?.(validNode);
      expect(result?.valid).toBe(true);
    });
  });

  describe('shell structure', () => {
    it('should generate proper function structure', () => {
      const node: WorkflowNode = {
        id: 'structure_test',
        type: 'http-request',
        data: {
          url: 'https://api.example.com/test',
          method: 'GET',
        } as HttpRequestNodeData,
      };

      const result = generator.generate(node, mockContext);

      expect(result).toMatch(/execute_http_structure_test\(\)\s*\{/);
      expect(result).toContain('}');
      expect(result).toContain('log_step');
      expect(result).toContain('set_workflow_var');
    });

    it('should handle all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

      methods.forEach(method => {
        const node: WorkflowNode = {
          id: `${method.toLowerCase()}_method`,
          type: 'http-request',
          data: {
            url: 'https://api.example.com/test',
            method: method,
          } as HttpRequestNodeData,
        };

        const result = generator.generate(node, mockContext);
        expect(result).toContain(`local method="${method}"`);
      });
    });
  });
});
