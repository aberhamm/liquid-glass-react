---
id: 025
title: Implement native LiquidGlass, native barrel, and platform-split packaging
status: blocked
blocked-by: [022, 024]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

To make the package usable inside a consumer's Expo app, it needs a React Native
implementation of the glass primitive that Metro resolves automatically, sharing
the design tokens (plan 022) and the prop contract so the same `<LiquidGlass>`
API works on both web and native. This plan implements `liquid-glass.native.tsx`
(expo-blur + expo-linear-gradient), a `index.native.ts` barrel that omits the
DOM-only prebuilt components, and the `package.json` packaging that exposes the
native entry via the `react-native` export condition with expo/react-native as
OPTIONAL peer deps (so web consumers never install them and web bundlers never
resolve the native file).

**Acceptance criteria:**

- [ ] `src/liquid-glass.native.tsx` renders the frosted base on React Native:
      an `expo-blur` `BlurView` (real iOS `UIVisualEffectView` glass) + white
      tint overlay + `expo-linear-gradient` sheen/highlight + a soft RN shadow,
      all driven by values from `src/tokens.ts`. iOS is the quality bar; Android
      uses `expo-blur`'s `experimentalBlurMethod` and degrades gracefully —
      graceful = keep tint + sheen + shadow and raise fill opacity slightly for
      legibility, never a bare transparent box (eng-review decision documenting
      the Android boundary).
- [ ] Its props type is built on the platform-neutral `LiquidGlassCoreProps`
      (plan 022) plus native-appropriate `style?: ViewStyle` and an `onPress?`
      handler — NOT the web `LiquidGlassProps` (which carries DOM-only
      `CSSProperties`/`MouseEventHandler<HTMLDivElement>` that native cannot
      honor). `displacement` (and other web-only refraction props) are accepted
      and a documented NO-OP — native always renders frosted. Event handler is
      platform-idiomatic: native exposes `onPress` (web keeps `onClick`) —
      eng-review decision; each platform matches its own convention rather than
      forcing one name cross-platform.
- [ ] `src/index.native.ts` barrels the native `LiquidGlass`, the shared tokens,
      and the public types — and does NOT export the DOM-only
      `GlassButton`/`GlassCard`/`GlassSegmentedControl` or DOM-only hooks, so
      Metro never pulls web-only code.
- [ ] `package.json` declares `expo-blur`, `expo-linear-gradient`, and
      `react-native` as OPTIONAL peer deps (`peerDependenciesMeta` →
      `optional: true`) and adds a `react-native` condition to the `.` export
      that resolves to the delivered native entry.
- [ ] The native entry is delivered via a dedicated **`tsc` emit** to
      `dist/native/` (JS + `.d.ts`) using `tsconfig.native.json` (plan 024) — a
      `build:native` script wired into `pnpm build` AFTER the web `vite build`.
      The `react-native` condition points at `./dist/native/index.native.js`
      (types `./dist/native/index.native.d.ts`). The web `vite build` + single
      dts rollup are untouched. (Decision: dedicated tsc emit, NOT a second Vite
      entry — avoids the single-entry `build.lib` + `rollupTypes` conflict.)
- [ ] `attw` and `pack:check` pass with the native entrypoint INCLUDED in
      `attw`'s coverage (eng-review decision — we emit real `.d.ts`, so let attw
      validate the native types rather than excluding it like `styles.css`) and
      the web entry unchanged; `files` includes `dist/native`.
- [ ] A native render smoke test (mocking `expo-blur`,
      `expo-linear-gradient`, `react-native`) mounts the component and asserts it
      renders a BlurView-backed surface with children. It runs via the
      `vitest.native.config.ts` + `@testing-library/react-native` infrastructure
      PROVISIONED IN PLAN 024 (this plan writes the test, not the runner) and
      does not break the web jsdom suite.

## Design

`liquid-glass.native.tsx` mirrors the web component's PORTABLE layer stack in RN
primitives: a `BlurView` for the frosted backdrop, absolutely-positioned `View`s
for tint / sheen (LinearGradient) / highlight, and RN `shadow*`/`elevation` for
the drop shadow — geometry and token values shared with web via `tokens.ts`.
There is no displacement, no SVG, no `backdrop-filter`; web-only props are
accepted and ignored so the API is uniform.

Delivery (DECIDED — was an open question, resolved by plan-doctor): the web build
is a single-entry `vite build` with `vite-plugin-dts` `rollupTypes: true`, which
does NOT cleanly produce a second independent JS+dts output. So the native entry
is emitted by a DEDICATED `tsc` pass over `tsconfig.native.json` to `dist/native/`
(emit mode, not `--noEmit`) producing `dist/native/index.native.js` +
`dist/native/index.native.d.ts`. Add a `build:native` script and compose
`build` = `vite build && pnpm build:native`. This gives the `react-native`
condition a real, RN-typed target, keeps `attw` honest, and leaves the web entry
(`dist/index.mjs`/`.cjs` + the single rolled-up dts) byte-for-byte unchanged.
(Alternative considered and rejected: source-shipping `src/index.native.ts` via
`files` — simpler but ships untyped raw TSX and muddies `attw`; and a second Vite
lib entry — conflicts with the current single-entry `build.lib` + rollupTypes.)

`exports["."]` gains a `react-native` condition ordered before `import`/`require`
so Metro picks it; web bundlers ignore it. Optional peer deps + the
platform-split file mean a web app's bundler never touches `expo-blur`.

Type contract (DECIDED): the native component is typed against
`LiquidGlassCoreProps` (the platform-neutral base from plan 022) extended with
native `style?: ViewStyle` and `onPress?` — it never references the web
`LiquidGlassProps`'s DOM types. `src/types.ts`'s `CSSProperties` /
`MouseEventHandler<HTMLDivElement>` therefore never reach the native file.

Native test infra (`vitest.native.config.ts`, `@testing-library/react-native`,
`react-test-renderer`) is OWNED BY PLAN 024. This plan only writes the test that
runs on it.

**Files expected to change:**

- `src/liquid-glass.native.tsx`: NEW. RN frosted implementation, typed on
  `LiquidGlassCoreProps` + `ViewStyle`/`onPress`.
- `src/index.native.ts`: NEW. Native barrel (no DOM prebuilts).
- `package.json`: optional peerDeps + `peerDependenciesMeta`; `react-native`
  export condition → `dist/native/index.native.js`; `build:native` script and
  composed `build`; `files` includes `dist/native`; `attw` coverage for the
  native entrypoint.
- `dist/native/**` (build output, not committed): emitted by the `tsc` native
  pass.
- native smoke test (e.g. `src/liquid-glass.native.test.tsx`): render with
  mocked native modules, run via `vitest.native.config.ts` (from plan 024).

**Out of scope:** Native ports of the prebuilt `GlassButton`/`GlassCard`/
`GlassSegmentedControl` (deferred — primitive only this round). The native test
runner / `tsconfig.native.json` / dts-exclude toolchain (plan 024). The Expo
consumer resolution/integration harness (plan 026). Android blur parity tuning
beyond "best-effort, degrades gracefully."

Testing approach: E2E

## Tasks

1. Implement `liquid-glass.native.tsx`: BlurView + tint + LinearGradient sheen/
   highlight + RN shadow from `tokens.ts`; type on `LiquidGlassCoreProps` +
   `ViewStyle`/`onPress`; no-op the web-only props (`displacement`, etc.).
2. Create `index.native.ts` exporting native `LiquidGlass` + tokens + types;
   exclude DOM-only prebuilts/hooks.
3. Wire `package.json`: optional peerDeps (`expo-blur`, `expo-linear-gradient`,
   `react-native`) + `peerDependenciesMeta`; add the `react-native` export
   condition → `./dist/native/index.native.js`.
4. Add a `build:native` script (`tsc -p tsconfig.native.json --outDir dist/native`,
   emit JS + d.ts) and compose `build` = `vite build && pnpm build:native`; add
   `dist/native` to `files`; ensure `attw` covers (or consistently excludes) the
   native entrypoint.
5. Write the native render smoke test with mocked native modules; run it via
   `vitest.native.config.ts` (plan 024).
6. Run `typecheck:native`, `build`, `attw`, `pack:check`, and the native test;
   confirm the native entry resolves and the web package is unchanged.

## Verification

- [cmd] `pnpm typecheck:native`
- [cmd] `pnpm build`
- [cmd] `test -f dist/native/index.native.js && test -f dist/native/index.native.d.ts`
- [cmd] `pnpm attw`
- [cmd] `pnpm pack:check`
- [assert] `node -e "const p=require('./package.json'); const c=p.exports['.']; process.exit(JSON.stringify(c).includes('react-native')?0:1)"`
- [assert] `node -e "const p=require('./package.json'); process.exit(p.peerDependenciesMeta&&p.peerDependenciesMeta['expo-blur']&&p.peerDependenciesMeta['expo-blur'].optional?0:1)"`
- [assert] `node -e "const fs=require('fs'); process.exit(/CSSProperties|MouseEventHandler/.test(fs.readFileSync('src/liquid-glass.native.tsx','utf8'))?1:0)"`
- [cmd] `pnpm test:native` (the native render smoke test on the plan-024 runner)
