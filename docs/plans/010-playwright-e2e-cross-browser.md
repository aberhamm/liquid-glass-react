---
id: 010
title: Playwright cross-browser E2E suite
status: pending
blocked-by: [009]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

The cross-browser promise must be proven, not asserted. This plan sets up
Playwright across Chromium, Firefox, and WebKit, serves the static Storybook
build from 008/009, and verifies that: in Chromium the full refraction renders
(the SVG `<filter>` is attached and active), and in Firefox/WebKit the component
degrades gracefully — the fallback frosted glass + rim + motion render with NO
console errors, NO unhandled exceptions, and NO layout break. Graceful
degradation is defined as the PASS criterion for non-Chromium engines, not mere
absence-of-crash. The suite also exercises interaction (elastic motion on pointer
move) and captures screenshots for evidence. The "user" is the maintainer/CI:
green Playwright = the library genuinely works everywhere.

**Acceptance criteria:**

- [ ] Playwright installed and configured with three projects: chromium, firefox,
      webkit; a webServer/fixture that serves `storybook-static` (owns the serve
      step — does not assume a server is already running).
- [ ] Chromium test: on the Showcase story, the LiquidGlass instance has the SVG
      `filter: url(...)` applied (refraction active) and a baseline screenshot.
- [ ] Firefox + WebKit tests: the component renders the fallback (no SVG filter
      applied), the glass box has non-zero dimensions (no broken/empty box), and
      the page logs zero `console.error`/pageerror — and this passing state IS the
      degradation assertion (not skipped, not xfail).
- [ ] Interaction test: moving the pointer near the glass changes its `transform`
      (elastic motion) in at least Chromium and Firefox.
- [ ] Mode smoke (Chromium): on the `Modes` story (009), guard the two fragile
      modes. `mode="shader"` produces a non-empty displacement-map `data:` URL via
      `feImage` (the runtime canvas generation ran). `mode="turbulence"` builds the
      filter from `feTurbulence` (an `feTurbulence` node is present and no `feImage`
      data-URL is used). Both attach the filter — guarding against silent breakage
      of either generation path.
- [ ] `GlassButton` test: keyboard focus + activation works (a11y-level check) in
      all three engines.
- [ ] `pnpm e2e` runs the suite headless and is wired into CI (extended in 011);
      screenshots are written to a reports dir.

## Design

Playwright targets the static Storybook build (deterministic, no dev-server
flakiness). The `e2e` script runs `build-storybook` FIRST, then `playwright
test`; Playwright's `webServer` only SERVES the pre-built `storybook-static`
(e.g. `npx http-server storybook-static -p 6006` or `vite preview`) — it does
not build inside the webServer command (which would race readiness). Distinguish
"refraction active" via the presence/value of the inline `filter: url(#…)` on the
glass surface element (stable signal across engines: Chromium has it,
Firefox/WebKit fallback omits it). Console/pageerror listeners enforce the
no-errors degradation criterion. `playwright install` (no `--with-deps`) is used
locally/macOS; `--with-deps` is reserved for Linux CI (where it needs apt), wired
in 011's CI, not asserted as a local gate here.

**Files expected to change:**

- `playwright.config.ts`: three browser projects, `webServer` serving
  `storybook-static` (build first), reporters, screenshot/output dirs.
- `e2e/refraction.spec.ts`: Chromium full-effect + per-engine degradation
  assertions with console/pageerror guards.
- `e2e/interaction.spec.ts`: pointer-move elastic transform change.
- `e2e/glass-button.spec.ts`: keyboard focus/activation across engines.
- `package.json`: `e2e` / `e2e:ui` scripts + `@playwright/test` devDep.
- `.gitignore`: playwright report/output dirs.

**Testing approach:** browser-based (E2E) — real multi-engine browser testing via
Playwright; this plan IS the E2E gate.

**Out of scope:** changing component behavior to make tests pass (if a real bug
surfaces, fix it minimally and note it), Storybook content (009), release/CI
polish beyond wiring the `e2e` script (011). Don't add visual-regression
infra beyond simple screenshots.

## Tasks

1. Install Playwright + browsers; write `playwright.config.ts` with chromium/
   firefox/webkit projects and a `webServer` that builds+serves `storybook-static`.
2. Write `e2e/refraction.spec.ts`: assert SVG filter active in Chromium; assert
   fallback render + non-zero box + zero console errors in Firefox/WebKit (these
   passing = degradation verified).
3. Write `e2e/interaction.spec.ts`: pointer move changes the glass `transform`.
4. Write `e2e/glass-button.spec.ts`: keyboard focus + Enter/Space activation per engine.
5. Add `e2e` scripts; ensure the suite builds Storybook first and runs headless.
6. Run the full suite green across all three engines.

## Verification

Checks:
- [cmd] `pnpm build-storybook`
- [cmd] `pnpm exec playwright install` (browsers only; `--with-deps` is for Linux CI, added in 011)
- [cmd] `pnpm e2e` (builds Storybook, serves the static artifact, runs all three engines)
- [assert] `pnpm e2e 2>&1 | tail -15` contains `passed`
- [manual] Inspect screenshots: Chromium shows refraction at the glass edge; Firefox/WebKit show a clean frosted fallback.
