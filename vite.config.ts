import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// NOTE (plan 008 boundary): This config covers ONLY the library build.
// Storybook (008) and the Vitest test runner config live in separate files
// (.storybook/* and vitest.config.ts respectively) so they can be layered in
// without colliding with the production `build.lib` settings below. Keep
// build-only concerns here; keep test/story concerns out of this file.
//
// Storybook inherits this file via @storybook/react-vite, so the reconciliation
// strip now lives in `.storybook/main.ts` `viteFinal`: it removes `build.lib`,
// `build.rollupOptions` (the React `external`), and the vite-plugin-dts plugin
// for the Storybook build only. This file remains the single source of truth for
// `pnpm build`; nothing Storybook-specific belongs here.
export default defineConfig({
  plugins: [
    dts({
      // Emit a single bundled index.d.ts alongside the JS outputs.
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      // Force explicit extensions so the ESM build is `index.mjs` (not the
      // ambient `.js` Vite would emit because package.json is `type: module`),
      // matching the exports map's import/require conditions.
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      // React is a peer dependency and must never be bundled.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
  },
});
