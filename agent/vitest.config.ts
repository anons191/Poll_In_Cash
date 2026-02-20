import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use vitest globals (describe, it, expect, etc.)
    globals: true,

    // Use Node.js environment for testing
    environment: 'node',

    // Include test files
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.ts'],

    // Exclude node_modules and dist
    exclude: ['node_modules', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/types.ts',
      ],
      // Coverage thresholds
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },

    // Timeout for tests
    testTimeout: 10000,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks after each test
    restoreMocks: true,

    // Mock reset
    mockReset: true,
  },
});
