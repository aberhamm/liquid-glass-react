---
id: 001
title: Scaffold package, Vite library build, test harness, and CI
status: pending
blocked-by: []
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

This is a greenfield, non-forked React component library. Before any component
logic can be written, the repository needs a working package skeleton: a
buildable library that emits ESM + CJS + type declarations, a unit-test harness
that runs in CI, and lint/format tooling. The "user" here is the next plan's
autonomous worker and, ultimately, a consumer who runs `pnpm add
@aberhamm/liquid-glass-react` and imports a typed component. Done means a placeholder
export builds, type-checks, lints, and is covered by one passing test — all
green in CI.

**Acceptance criteria:**

- [ ] `pnpm install` succeeds with `react` and `react-dom` (>=18) as
      `peerDependencies` only (no React in `dependencies`).
- [ ] `pnpm build` produces `dist/index.mjs` (ESM), `dist/index.cjs` (CJS), and
      `dist/index.d.ts` (types) via Vite library mode + a declaration step.
- [ ] `package.json` has a correct `exports` map (`import`/`require`/`types`
      conditions), `main`, `module`, `types`, and `files` restricted to `dist`.
      `sideEffects` is `["**/*.css"]` — NOT bare `false` (eng-review 2026-06-13):
      the components ship a real stylesheet (007) that consumers import for its
      side effect; bare `sideEffects: false` would let optimizing bundlers drop
      that CSS import and render components unstyled in production. The `["**/*.css"]`
      allowlist keeps JS tree-shakeable while preserving the stylesheet.
- [ ] `pnpm typecheck` (tsc --noEmit) passes.
- [ ] `pnpm lint` passes using Biome (or ESLint) with a committed config.
- [ ] `pnpm test` runs Vitest with jsdom + React Testing Library and one
      passing smoke test against a placeholder export.
- [ ] A GitHub Actions workflow runs `install → lint → typecheck → test →
      build` on push/PR and passes.

## Design

A modern Vite-library-mode setup with a separate type-declaration emit step.
Package name: **`@aberhamm/liquid-glass-react`** (the bare `liquid-glass-react`
is taken on npm by the MIT upstream we are reimplementing, not forking; this
scoped name keeps the descriptive name while making the "independent
reimplementation" relationship clear, and is the published identity used
consistently in 011's README install instructions). Set
`publishConfig.access: "public"` so the scoped package publishes publicly. Use
`pnpm`.

**Files expected to change:**

- `package.json`: name, version `0.0.0`, type `module`, scripts (`build`,
  `typecheck`, `lint`, `format`, `test`, `test:watch`), peerDeps, devDeps,
  `exports`/`main`/`module`/`types`/`files`/`sideEffects`.
- `tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`,
  `declaration` config (or a `tsconfig.build.json` for `tsc --emitDeclarationOnly`).
- `vite.config.ts`: `build.lib` (entry `src/index.ts`, formats `es`+`cjs`,
  fileName `index`), `rollupOptions.external` = `react`, `react-dom`,
  `react/jsx-runtime`. Keep this file structured so 008 can layer a separate
  Storybook/Vitest config without colliding (document the boundary in a comment).
- `vitest.config.ts` (or `test` block): jsdom environment, setup file with
  `@testing-library/jest-dom`, `globals: true`.
- `src/index.ts`: placeholder export (e.g. `export const VERSION = '0.0.0'`).
- `src/index.test.ts`: smoke test asserting the placeholder export.
- `.github/workflows/ci.yml`: pnpm + Node LTS, cache, run lint/typecheck/test/build.
- `biome.json` (or `.eslintrc`), `.gitignore`, `.npmrc` (if needed for pnpm).
- `README.md`: minimal stub (expanded in 011).

**Testing approach:** unit-only — this plan ships only build config and a
placeholder; verification is build/typecheck/lint/one smoke test.

**Out of scope:** any actual liquid-glass logic, component code, Storybook,
Playwright, the public prop API (that is 002+). Do not add runtime dependencies.

## Tasks

1. `pnpm init`; set name, version, type, peerDeps (react/react-dom >=18),
   devDeps (vite, vitest, jsdom, @testing-library/react, @testing-library/jest-dom,
   typescript, @types/react, @types/react-dom, biome or eslint).
2. Write `tsconfig.json` (strict, react-jsx, bundler resolution) and a build
   tsconfig for declaration emit.
3. Write `vite.config.ts` in library mode with React externalized; add a comment
   marking where 008 will reconcile Storybook/Vitest config.
4. Write `vitest.config.ts` + test setup; add `src/index.ts` placeholder and
   `src/index.test.ts` smoke test.
5. Configure Biome (or ESLint) + format; add scripts to `package.json`.
6. Write `.github/workflows/ci.yml` running install → lint → typecheck → test → build.
7. Run all scripts locally to confirm green; verify `dist/` contents and the
   `exports` map resolve correctly.

## Verification

Checks:
- [cmd] `pnpm install --frozen-lockfile` (or `pnpm install`) exits 0
- [cmd] `pnpm lint`
- [cmd] `pnpm typecheck`
- [cmd] `pnpm test`
- [cmd] `pnpm build`
- [assert] `node -e "const p=require('./package.json');process.stdout.write(p.exports['.'].import)"` outputs a path containing `dist/index.mjs`
- [cmd] `test -f dist/index.mjs && test -f dist/index.cjs && test -f dist/index.d.ts`
- [manual] Confirm `react`/`react-dom` appear only under `peerDependencies`, not `dependencies`.
