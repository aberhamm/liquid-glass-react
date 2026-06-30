import { defineConfig } from 'vitest/config';

// React Native test-runner config (plan 024 toolchain split).
//
// The default vitest.config.ts runs the web suite under jsdom and EXCLUDES
// `*.native.*`. This config is its native counterpart: it runs only the
// `*.native.test.*` files in a non-DOM ("node") environment, where
// react-native / expo-blur / expo-linear-gradient are mocked (see the setup
// file). Plan 025 adds the first native test; until then `passWithNoTests`
// keeps `pnpm test:native` green.
export default defineConfig({
  test: {
    // Non-jsdom: React Native code has no DOM. The setup file mocks the native
    // modules so component logic can be exercised without a device/simulator.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.native.setup.ts'],
    include: ['src/**/*.native.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
