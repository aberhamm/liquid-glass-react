---
id: 008
title: Storybook 8 setup and Vite config reconciliation
status: pending
blocked-by: [007]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

Storybook is both the documentation surface and the target the Playwright suite
(010) runs against, so it must be set up correctly and — critically — its Vite
config must coexist with the library-mode build and Vitest without breaking
either. `@storybook/react-vite` inherits the project `vite.config.ts`, but
`build.lib` produces mangled Storybook output if it leaks in; this three-way
config conflict (lib mode vs Vitest vs Storybook) is the known failure point and
this plan owns reconciling it. This plan also owns producing the static
`storybook-static` build artifact that 010 serves. The "user" is the next two
plans' workers: 009 writes stories into a working Storybook, and 010 runs E2E
against the static build.

**Acceptance criteria:**

- [ ] Storybook 8 (`@storybook/react-vite`) installed and configured in
      `.storybook/` with React + TS support and `@storybook/addon-essentials`
      (controls/docs/actions).
- [ ] `pnpm storybook` (dev) starts and renders at least one smoke story for
      `<LiquidGlass>` without errors.
- [ ] `pnpm build-storybook` produces a static `storybook-static/` directory that
      serves correctly (the artifact 010 depends on).
- [ ] The Vite library build (`pnpm build`), Vitest (`pnpm test`), and Storybook
      all work simultaneously with NO config bleed: `build.lib` does not affect
      Storybook, and Storybook's config does not affect the library bundle.
      Document the boundary explicitly.
- [ ] One smoke story per component (`LiquidGlass`, `GlassButton`, `GlassCard`)
      exists so the build artifact is non-trivial (full controls/example come in 009).

## Design

Cleanest reconciliation: keep `vite.config.ts` focused on the library build and
give Storybook its own resolved config that does NOT include `build.lib` (e.g. a
`.storybook/main.ts` `viteFinal` that strips/avoids the lib block, or split shared
options into a base config imported conditionally). Vitest reads its own
`vitest.config.ts` (or `test` block) and is unaffected. Add a decorator providing
a backdrop so the glass effect is visible in stories.

**Files expected to change:**

- `.storybook/main.ts`: framework `@storybook/react-vite`, stories glob, addons,
  `viteFinal` that ensures no `build.lib` leaks into Storybook.
- `.storybook/preview.ts(x)`: global decorators (backdrop), parameters.
- `vite.config.ts`: refactor so library options are isolated and not inherited by
  Storybook (resolve the comment boundary left in 001).
- `package.json`: add `storybook`, `build-storybook` scripts + Storybook devDeps.
- `src/*.stories.tsx`: one smoke story per component.
- `.gitignore`: ignore `storybook-static`.

**Testing approach:** browser-based — Storybook is a browser surface; verified by
building it and a `[browse]` smoke check, with full interaction coverage in 010.

**Out of scope:** comprehensive stories, prop-controls matrices, and the polished
interactive example (all 009); Playwright (010). Keep stories minimal here — this
plan is about config correctness and the build artifact.

## Tasks

1. Install Storybook 8 + `@storybook/react-vite` + essentials; init `.storybook/`.
2. Refactor `vite.config.ts` so `build.lib` is isolated; add `viteFinal` in
   `.storybook/main.ts` to prevent lib-config bleed.
3. Verify `pnpm build`, `pnpm test`, and `pnpm storybook` all work independently.
4. Add a backdrop decorator in `.storybook/preview` so the effect is visible.
5. Add one smoke story per component; add `build-storybook` script; gitignore the
   static dir.
6. Run `pnpm build-storybook` and confirm `storybook-static/` serves.

## Verification

Checks:
- [cmd] `pnpm build`
- [cmd] `pnpm test`
- [cmd] `pnpm build-storybook`
- [cmd] `test -d storybook-static && test -f storybook-static/index.html`
- [browse] start `pnpm storybook` and verify the LiquidGlass smoke story renders a glass element over a backdrop with no console errors, then stop the dev server (do not leave it running — plan 010's Playwright webServer must own the port)
- [manual] Confirm library bundle (`dist/`) and Storybook output are both correct — no mangling from shared config.
