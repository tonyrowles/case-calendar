import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    passWithNoTests: true,
    // Create test DB schema before any test file loads (CR-01: test DB isolation)
    setupFiles: ['src/server/test-setup.ts'],
    // WR-04: remove accumulated per-worker test DB files after the suite completes
    globalSetup: ['src/server/test-global-teardown.ts'],
  },
  resolve: {
    alias: {
      '@/client': path.resolve(__dirname, './src/client'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/server': path.resolve(__dirname, './src/server'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
