import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '.git/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'scripts/',
        'src/types/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__tests__/**',
        'tests/**',
        'src/cli.ts',
        'src/index.ts',
        'src/bin/**',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 75,
        lines: 80
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})