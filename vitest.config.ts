import { configDefaults, defineConfig } from 'vitest/config';

// Test-runner config, intentionally separate from vite.config.ts so the
// library build (vite.config.ts) and Storybook (008) stay decoupled from the
// jsdom test environment.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // `*.native.*` files (plan 025) run under vitest.native.config.ts in a
    // non-jsdom env. Keep Vitest's default ignores and add the native glob so
    // the web jsdom suite never tries to load react-native / Expo modules.
    exclude: [...configDefaults.exclude, '**/*.native.*'],
  },
});
