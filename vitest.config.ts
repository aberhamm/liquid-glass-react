import { defineConfig } from 'vitest/config';

// Test-runner config, intentionally separate from vite.config.ts so the
// library build (vite.config.ts) and Storybook (008) stay decoupled from the
// jsdom test environment.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
