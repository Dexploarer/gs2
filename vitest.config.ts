/**
 * Vitest Configuration
 *
 * 2026 Best Practices:
 * - Explicit include/exclude patterns to prevent test framework conflicts
 * - Separate configs for unit vs integration tests
 * - Proper environment variable handling
 */
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env vars from .env.local
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      'process.env': env,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      env: env,

      // Explicit include - only Vitest tests
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],

      // Explicit exclude - prevent framework conflicts
      exclude: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        'tests/e2e/**', // Playwright E2E tests
        'contracts/**', // Jest contract tests
        '**/*.spec.ts', // Playwright convention
      ],

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'tests/',
          '**/*.config.*',
          '**/*/index.ts',
          'convex/_generated/**',
          'contracts/**',
        ],
      },

      // Test timeouts
      testTimeout: 30000,
      hookTimeout: 30000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }
})
