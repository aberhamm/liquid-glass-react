---
id: 024
title: Provision the React Native dev toolchain and split tsconfig for platform files
status: pending
blocked-by: []
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

The package will gain a `liquid-glass.native.tsx` (plan 025) that imports
`react-native`, `expo-blur`, and `expo-linear-gradient`. None of those are
installed, and the project has a SINGLE `tsconfig.json` with a DOM-only `lib`
that both `tsc --noEmit` and Vitest use. The moment a `.native.tsx` file lands
in `src/` and imports `react-native`, the web typecheck and the jsdom test run
would break against DOM types. This plan provisions the native toolchain FIRST,
so 025 can author and typecheck native code without any of those failures, and
the existing web gates (`typecheck`, `test`, `build`, `attw`, `pack:check`) stay
green.

**Acceptance criteria:**

- [ ] `react-native`, `expo-blur`, `expo-linear-gradient`,
      `@testing-library/react-native`, and `react-test-renderer` are added as
      `devDependencies`, pinned to the **latest stable Expo SDK line (RN 0.76+,
      React 19-capable)** (eng-review decision); react-native/expo ship their own
      types — do NOT add the deprecated `@types/react-native`. The package
      peerDep stays `react >=18` so BOTH React 18 and 19 consumers install
      cleanly.
- [ ] The web `tsconfig.json` EXCLUDES native files via a GLOB
      (`src/**/*.native.{ts,tsx}`, not a literal filename) so `pnpm typecheck`
      never compiles any native file against DOM `lib`.
- [ ] `vite.config.ts`'s `vite-plugin-dts` `exclude` list ALSO excludes
      `src/**/*.native.*`, so the web declaration rollup never pulls native
      (react-native-importing) types through the web build.
- [ ] A new `tsconfig.native.json` compiles native files with React Native
      types/JSX; it EXPLICITLY sets `moduleResolution` appropriate for RN (e.g.
      `node16`/`bundler` per RN guidance) rather than silently inheriting the
      web base's value; a `typecheck:native` script runs it and exits 0 (no
      native files yet ⇒ trivially passes; it must be wired and runnable).
- [ ] A `vitest.native.config.ts` exists for the native test path (non-jsdom
      environment, `include` scoped to native test files, setup that can mock
      `expo-blur`/`expo-linear-gradient`/`react-native`); the default
      `vitest.config.ts` EXCLUDES `**/*.native.*` so the web jsdom suite is
      unaffected. Both runners pass with no native tests yet.
- [ ] With the new devDeps installed, ALL existing gates remain green:
      `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm attw`, `pnpm pack:check`.

## Design

This is pure toolchain plumbing — no component code. The web and native worlds
are kept apart at the TypeScript and test-runner level so they can coexist in
one `src/`. The web `tsc` and Vitest stay DOM-only and simply don't see native
files; a separate native `tsc` config owns the `.native` files with RN libs.

`react-native`'s bundled types provide `View`, `StyleSheet`, etc.; `expo-blur`
and `expo-linear-gradient` ship their own. Installing them as devDeps gives 025
real types to compile against while they remain OPTIONAL peer deps for consumers
(wired in 025), so web consumers never install them.

Critical: the web declaration build (`vite-plugin-dts`, `rollupTypes: true`)
currently includes all of `src` except tests/stories. The moment a native file
lands in `src/`, the dts rollup would try to bundle `react-native` types through
the web build and break — so `vite.config.ts`'s dts `exclude` MUST gain
`src/**/*.native.*` HERE, before 025 adds the files. Likewise the native
`tsconfig` must override `moduleResolution` (the web base uses `"bundler"`, which
is wrong for RN type resolution). And the native render test in 025 needs a real
runner — `vitest.native.config.ts` + `@testing-library/react-native` +
`react-test-renderer` are provisioned here (this is the toolchain plan), not
assumed by 025.

**Files expected to change:**

- `package.json`: add the devDeps (`react-native`, `expo-blur`,
  `expo-linear-gradient`, `@testing-library/react-native`,
  `react-test-renderer`); add `typecheck:native` script.
- `tsconfig.json`: add the glob `src/**/*.native.{ts,tsx}` to `exclude`.
- `tsconfig.native.json`: NEW. Extends base, sets RN-appropriate `lib`/`jsx` and
  an explicit `moduleResolution`, includes only native files.
- `vite.config.ts`: add `src/**/*.native.*` to the `vite-plugin-dts` `exclude`.
- `vitest.config.ts`: exclude `**/*.native.*` from the default run.
- `vitest.native.config.ts`: NEW. Non-jsdom env, native test include glob, mock
  setup.

**Out of scope:** Writing `liquid-glass.native.tsx` or `index.native.ts` (025).
The `react-native` export condition + optional peerDeps + the native build/emit
in `package.json` `exports` (025, co-located with the file that makes them
resolvable). Any behavior change to the web component.

Testing approach: unit-only

## Tasks

1. Add `react-native`, `expo-blur`, `expo-linear-gradient`,
   `@testing-library/react-native`, `react-test-renderer` to `devDependencies`
   and install.
2. Add the glob `src/**/*.native.{ts,tsx}` to `tsconfig.json` `exclude`.
3. Add `src/**/*.native.*` to the `vite-plugin-dts` `exclude` in `vite.config.ts`.
4. Create `tsconfig.native.json` extending the base with RN `lib`/`jsx`, an
   explicit `moduleResolution` (override the base `"bundler"`), and an `include`
   scoped to native files; add a `typecheck:native` npm script.
5. Exclude `**/*.native.*` from `vitest.config.ts`; create
   `vitest.native.config.ts` (non-jsdom env, native test include, mock setup);
   add a `test:native` script.
6. Run every existing gate to confirm the new devDeps did not regress web
   typecheck/test/build/attw/pack.

## Verification

- [cmd] `pnpm install`
- [cmd] `pnpm typecheck`
- [cmd] `pnpm typecheck:native`
- [cmd] `pnpm test`
- [cmd] `pnpm build`
- [cmd] `pnpm attw`
- [assert] `node -e "const p=require('./package.json'); const d=p.devDependencies; process.exit(d['react-native']&&d['expo-blur']&&d['expo-linear-gradient']&&d['@testing-library/react-native']?0:1)"`
- [assert] `grep -qE '\.native\.' tsconfig.json && echo excluded` outputs `excluded`
- [assert] `grep -qE '\.native\.' vite.config.ts && echo dts-excluded` outputs `dts-excluded`
- [cmd] `test -f tsconfig.native.json && test -f vitest.native.config.ts`
