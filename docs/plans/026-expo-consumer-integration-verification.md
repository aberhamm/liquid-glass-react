---
id: 026
title: Verify the package resolves and renders inside an Expo/Metro consumer
status: blocked
blocked-by: [025]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

The stated goal is that a consumer's Expo app can import this single package and
get the native glass, while a web app gets the web build — with neither pulling
in the other's platform code. Plan 025 wires the `react-native` export condition
and the native barrel, but nothing yet PROVES that Metro-style resolution
actually lands on the native entry, that the optional peer deps don't leak into a
web build, and that the native component renders in a consumer-like context. This
plan adds a lightweight, automated integration check (no standalone example app).

**Acceptance criteria:**

- [ ] An automated check resolves the package's `.` export under the
      `react-native` condition and asserts it lands on the native entry
      (`index.native`/`dist/index.native.*`), NOT the web entry.
- [ ] An automated check resolves the same export under default web conditions
      (`import`/`browser`) and asserts it lands on the WEB entry and does NOT
      reference `expo-blur`/`react-native`.
- [ ] A render smoke test mounts the native `LiquidGlass` (via
      `react-test-renderer` with mocked `expo-blur`/`expo-linear-gradient`/
      `react-native`) as a consumer would and asserts a non-empty tree with the
      blur surface and children.
- [ ] The checks run from the PACKED tarball or via Node's `exports` resolver
      (so they exercise the real published `exports` map, not just `src`).
- [ ] All checks are wired into a script and pass in CI-equivalent local runs.

## Design

Two cheap, deterministic checks instead of a full Expo app:

1. **Resolution check** — use Node's conditional `exports` resolution (e.g.
   `import.meta.resolve` / `require.resolve` with `conditions`, or a tiny script
   reading `package.json` `exports` and applying the `react-native` vs `import`
   condition) against the packed tarball (`npm pack` → install into a temp dir)
   or the in-repo package root. Assert the native condition → native entry and
   the web condition → web entry, and that the web entry's transitive imports
   contain no `expo-`/`react-native` specifier.
2. **Render smoke** — `react-test-renderer` mounting the native component with
   the native modules mocked, asserting the tree renders (BlurView + children).

Keep it self-contained: a temp consumer dir + mocks, torn down after. This is
verification only; it changes no library code.

**Files expected to change:**

- `test/expo-resolution.test.ts` (or `scripts/verify-native-resolution.mjs`):
  NEW. The resolution assertions against the packed/resolved package.
- `test/native-render-smoke.test.tsx` (or under the native test path): NEW.
  Consumer-style render with mocked native modules.
- `package.json`: a `verify:expo` script wiring both checks (optional).

**Out of scope:** Building/running a real Expo app or simulator. Android device
testing. Any change to the component or packaging (that is 025 — if a real defect
is found here, it is fixed by amending 025's surface, but this plan's deliverable
is the verification harness).

Testing approach: E2E

## Tasks

1. Add an `npm pack` step (or Node `exports`-resolver script) that installs/reads
   the package and resolves `.` under the `react-native` condition; assert it
   hits the native entry.
2. Add the inverse assertion for web conditions → web entry, and grep the web
   entry's imports for `expo-`/`react-native` (must be absent).
3. Add a `react-test-renderer` smoke test mounting native `LiquidGlass` with
   mocked native modules; assert a non-empty rendered tree with children.
4. Wire both into a `verify:expo` script and run it.

## Verification

- [cmd] `pnpm pack:check`
- [cmd] native resolution check (e.g. `pnpm verify:expo` or `node scripts/verify-native-resolution.mjs`)
- [assert] resolution script prints the native entry filename for the `react-native` condition (e.g. output contains `index.native`)
- [cmd] native render smoke test command
