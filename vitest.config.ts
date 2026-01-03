import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 10000, // 10 second timeout for individual tests
    hookTimeout: 5000, // 5 second timeout for hooks
    teardownTimeout: 3000, // 3 second timeout for teardown
    isolate: true, // Run tests in isolation
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/cli/index.ts', // CLI entry point - hard to test
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
