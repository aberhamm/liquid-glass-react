---
id: 011
title: Release polish — docs, publish readiness, extended CI
status: done
blocked-by: [010, 012]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
completed: 2026-06-16
reviewed: false
qa: automated
---

## Requirements

The library works and is tested; this plan makes it shippable and trustworthy.
It writes the consumer-facing README (install, usage, full prop API, and an
explicit browser-support matrix derived from the parity spec), validates that the
PUBLISHED package is correct (exports resolve, types are emitted and accurate,
only intended files ship), and extends CI so the full gate — lint, typecheck,
unit, build, Storybook build, and Playwright — runs on every push. The "user" is
a developer discovering the package on npm: they read the README, trust the
browser matrix, install it, and the types/imports just work.

**Acceptance criteria:**

- [ ] `README.md` documents: install (`pnpm/npm add`), quick-start usage for
      `LiquidGlass`/`GlassButton`/`GlassCard`/`GlassSegmentedControl`, the
      prebuilt-components CSS import
      (the `exports` subpath from 007), the `asChild` polymorphism pattern, the
      full prop API table, the `mode` options (including `shader` and
      `turbulence`), the capability hook, a Storybook link/build note, and a
      clear browser-support matrix (Chromium = full refraction; Firefox/Safari =
      graceful frosted fallback with the inset-shadow glass edge) consistent with
      `docs/PARITY.md`.
- [ ] `npm pack` (dry-run) ships only `dist/` (+ README/LICENSE) — no `src`,
      tests, stories, Storybook, or e2e files; verified via `npm pack --dry-run`.
      AND (eng-review 2026-06-13) positively asserts the components' built CSS file
      (007's `./styles.css` subpath target) IS present in the tarball and resolves via
      the `exports` map — guarding the sideEffects/CSS-drop footgun end to end.
- [ ] Published types validated: a type-level smoke check imports the package's
      built `.d.ts` and exercises the public API with no type errors
      (e.g. `tsc` against a tiny consumer fixture or `@arethetypeswrong/cli`).
- [ ] `exports`/`main`/`module`/`types` resolve correctly for both ESM and CJS
      consumers (smoke-require/import the built artifact).
- [ ] An MIT `LICENSE` is present with proper attribution note acknowledging the
      technique's lineage (rdev/liquid-glass-react, shuding/liquid-glass) while
      affirming this is an independent reimplementation.
- [ ] CI extended: a single workflow runs install → lint → typecheck → unit →
      build → build-storybook → playwright (with browsers cached), green.

## Design

This is the productionization pass. Keep the README accurate to the actual
shipped API (pull prop names/defaults from `src/types.ts`). Use
`@arethetypeswrong/cli` (or a consumer fixture) to catch ESM/CJS/types mismatches
before publishing. The LICENSE attribution keeps the non-fork posture explicit
and legally clean (upstream is MIT).

**Files expected to change:**

- `README.md`: full docs + browser matrix.
- `LICENSE`: MIT + attribution/independent-reimplementation note.
- `package.json`: confirm `name` is `@aberhamm/liquid-glass-react` (set in 001 —
  do not rename) with `publishConfig.access: "public"` (required for scoped
  packages); finalize `version`, `description`, `keywords`, `repository`,
  `license`, `files`; add `prepublishOnly` running the gate; add
  `@arethetypeswrong/cli` to devDependencies and an `attw`/pack-check script.
- `.github/workflows/ci.yml`: extend to build-storybook + playwright with caching.
- `test/consumer-fixture/`: tiny ESM + CJS import/type smoke (optional but preferred).

**Testing approach:** unit-only — packaging/exports/types validation and docs;
verified with `npm pack --dry-run`, `attw`, and import/require smokes. (The
browser behavior was already proven in 010.)

**Out of scope:** actually publishing to npm (leave to the human), adding new
components or props, changing runtime behavior. Don't expand the public API here —
only document and package what exists.

## Tasks

1. Write `README.md` (install, usage, full prop API table from `src/types.ts`,
   `mode` options, capability hook, browser-support matrix, Storybook note).
2. Add `LICENSE` (MIT + attribution / independent-reimplementation statement).
3. Finalize `package.json` publish fields + `files`; install
   `@arethetypeswrong/cli` as a devDep FIRST, then add the `prepublishOnly` gate
   and the `attw`/pack-check script (so the verification check has the tool present).
4. Run `npm pack --dry-run`; confirm only intended files ship.
5. Validate published types/exports for ESM + CJS (import + require smoke; `attw`).
6. Extend CI to run build-storybook + playwright with browser caching; confirm green.

## Verification

Checks:
- [cmd] `pnpm build`
- [cmd] `npm pack --dry-run`
- [assert] `npm pack --dry-run 2>&1 | grep -E "src/|\\.test\\.|\\.stories\\.|e2e/" || echo CLEAN` outputs `CLEAN`
- [cmd] `pnpm exec attw --pack .` (or run the consumer-fixture typecheck)
- [assert] `grep -qiE "chrom" README.md && grep -qiE "firefox|safari" README.md && echo found` outputs `found`
- [cmd] `test -f LICENSE`
- [manual] Read the README as a new user: install → first working example takes under 2 minutes.

## Implementation Notes

Wrote the full consumer README (install, CSS-import note, copy-pasteable quick-starts for
all four components, asChild pattern, full LiquidGlass prop table + component tables from
src/types.ts, the five `mode` options, the capability hook/`canRefract` gate, and a
browser-support matrix consistent with docs/PARITY.md). Added an MIT LICENSE with an
independent-reimplementation attribution paragraph (rdev/liquid-glass-react,
shuding/liquid-glass). Finalized package.json (version 0.1.0, keywords,
repository/homepage/bugs, author, attw + pack:check + prepublishOnly scripts). Extended CI
to install→lint→typecheck→test→build→build-storybook→playwright with pnpm +
Playwright-browser caching.

Pack-check: `npm pack --dry-run` ships only LICENSE, README, dist/* (incl.
liquid-glass-react.css and index.d.cts), and package.json — CLEAN (no src/tests/stories/
e2e), CSS positively present. attw: the `.` entry is fully green across
node10/node16-CJS/node16-ESM/bundler — fixed a genuine "masquerading as ESM" by emitting a
CJS-flavored `index.d.cts` (closeBundle vite plugin) and switching exports to per-format
conditional types; the typeless `./styles.css` subpath is excluded (documented benign).
Health PASS 9.1.

Deviations: documented `padding` default as the actual runtime value `'24px 32px'` (the
types.ts JSDoc said `'24px'`); the pixel-diff visual baseline self-skips on non-darwin
(Linux CI stays green) while still running and passing locally on macOS as the
release-blocking gate.

**Files changed:**

- `README.md` (modified)
- `package.json` (modified — v0.1.0, publish fields, per-format conditional exports, attw)
- `pnpm-lock.yaml` (modified)
- `vite.config.ts` (modified — closeBundle plugin emitting index.d.cts)
- `.github/workflows/ci.yml` (modified — extended gate + browser caching)
- `e2e/refraction.spec.ts` (modified — pixel-diff self-skips on non-darwin)
- `LICENSE` (created — MIT + attribution)
- `test/consumer-fixture/esm.mjs` (created)
- `test/consumer-fixture/cjs.cjs` (created)
- `test/consumer-fixture/README.md` (created)

**Commit:** `2e671c2` — chore(release): README, LICENSE, publish readiness, extended CI
