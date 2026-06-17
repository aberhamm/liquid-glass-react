import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook configuration for the liquid-glass-react component library.
 *
 * THE RECONCILIATION (plan 008): `@storybook/react-vite` inherits the project's
 * root `vite.config.ts`, which is configured for a LIBRARY build (`build.lib`,
 * `vite-plugin-dts`, and `rollupOptions.external` for React). Those settings are
 * actively harmful to a Storybook build:
 *
 *   - `build.lib` tells Vite to emit a single library bundle with a fixed entry,
 *     which mangles Storybook's multi-entry app build.
 *   - `rollupOptions.external: [react, ...]` would leave React UNBUNDLED, but
 *     Storybook ships a real app and MUST bundle React — externalizing it breaks
 *     the preview at runtime.
 *   - `vite-plugin-dts` exists only to emit `.d.ts` for the published package and
 *     has no place in (and can error during) a Storybook build.
 *
 * `viteFinal` below strips all three so Storybook builds as a normal app, while
 * `vite.config.ts` stays untouched for `pnpm build`. Vitest reads its own
 * `vitest.config.ts` and is unaffected by either. This keeps the three-way
 * boundary (library build / Vitest / Storybook) clean with zero config bleed.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  // Serve the bundled demo backdrop SAME-ORIGIN (e.g. /demo/showcase-backdrop.webp).
  // Same-origin is required so a later plan can sample the photo via <canvas>
  // without cross-origin taint. Asset source/license: public/demo/LICENSE.md.
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal(config) {
    // Defensive: every field below may be undefined depending on how Vite
    // resolved the inherited config, so guard with optional chaining throughout.

    // 1. Drop library-mode build so Storybook builds a standard app bundle.
    if (config.build) {
      config.build.lib = undefined;
      // 2. Drop rollupOptions entirely — its `external` would un-bundle React,
      //    which Storybook needs bundled. There is nothing here Storybook wants.
      config.build.rollupOptions = undefined;
    }

    // 3. Remove vite-plugin-dts from the plugin list. The dts plugin registers
    //    under the name 'vite:dts'; filter any plugin whose name starts with
    //    'vite:dts' so type emission never runs inside the Storybook build.
    if (Array.isArray(config.plugins)) {
      config.plugins = config.plugins.filter((plugin) => {
        const name =
          plugin && typeof plugin === 'object' && 'name' in plugin
            ? (plugin as { name?: string }).name
            : undefined;
        return !(typeof name === 'string' && name.startsWith('vite:dts'));
      });
    }

    return config;
  },
};

export default config;
