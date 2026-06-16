---
id: 011
title: Release polish — docs, publish readiness, extended CI
status: in-progress
blocked-by: [010, 012]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
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
