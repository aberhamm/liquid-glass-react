import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Plugin, defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Emit a CommonJS-flavored declaration file (`index.d.cts`) alongside the
 * ESM `index.d.ts` that vite-plugin-dts produces.
 *
 * Because `package.json` is `"type": "module"`, a lone `index.d.ts` is
 * interpreted as ESM. CJS consumers that `require()` the package would then
 * resolve ESM-flavored types over a CommonJS runtime — the "masquerading as
 * ESM" problem flagged by @arethetypeswrong/cli. Duplicating the bundled
 * declarations to a `.d.cts` (referenced by the `require` condition in the
 * exports map) gives `require` consumers correctly CJS-interpreted types.
 *
 * The content is identical; only the extension (and thus the module-format
 * interpretation) differs. vite-plugin-dts has already finished by the time
 * `closeBundle` runs, so the source file exists.
 */
function emitCjsDeclaration(): Plugin {
  return {
    name: 'emit-cjs-declaration',
    closeBundle() {
      const esmDts = resolve(__dirname, 'dist/index.d.ts');
      const cjsDts = resolve(__dirname, 'dist/index.d.cts');
      copyFileSync(esmDts, cjsDts);
    },
  };
}

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
    emitCjsDeclaration(),
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
