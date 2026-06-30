---
id: 028
title: Cross-browser e2e for frosted parity and displacement-only-where-supported
status: blocked
blocked-by: [023, 027]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

The primary web success criterion is that the frosted DEFAULT looks consistent
across Chrome, Safari (WebKit), and Firefox, and that SVG displacement appears
ONLY where supported (Chromium) when opted in, silently absent elsewhere. The
existing e2e specs (after plan 023) only check displacement presence/absence on a
single state; they do not assert cross-browser frosted parity. This plan adds the
parity coverage so a frosted implementation that renders materially differently
across engines is caught.

**Acceptance criteria:**

- [ ] An e2e spec renders the frosted DEFAULT and asserts the structural frosted
      recipe is present on all three browsers: a `backdrop-filter` with
      `blur(`/`saturate(` (no `url(`), the tint fill, and the hairline ring +
      drop shadow — verified via computed styles, engine-appropriately.
- [ ] Per-browser visual baselines for the frosted default are committed for
      chromium, firefox, and webkit, within the project's existing screenshot
      tolerance.
- [ ] An e2e assertion confirms `displacement` opt-in yields `url(` ONLY on
      Chromium and NEVER on firefox/webkit (frosted fallback), reusing the
      displacement-enabled story from plan 023.
- [ ] No regression: the full `pnpm e2e` suite passes on all three browsers.

## Design

Add a `frosted-parity` e2e spec (or extend `refraction.spec.ts`) that drives the
default Showcase/Playground story across the three Playwright projects, reads the
computed `backdrop-filter` and surface styles, and asserts the frosted recipe is
structurally present everywhere while `url(` is present only on the
displacement-enabled story on Chromium. Commit per-browser screenshot baselines
for the frosted default (Playwright names them per project, e.g.
`*-firefox-*.png`, `*-webkit-*.png`).

Computed-style assertions are the reliable cross-engine signal (serialization
differs); screenshots are the visual backstop within tolerance.

**Files expected to change:**

- `e2e/frosted-parity.spec.ts`: NEW (or extend `e2e/refraction.spec.ts`).
- `e2e/*-snapshots/*.png`: NEW per-browser frosted baselines.

**Out of scope:** Changing component behavior (023 owns it) or Storybook stories
(027). Native — RN is verified in plan 026, not via Playwright. CROSS-BROWSER
REFRACTION (the `filter`-on-copy path) and its 3-engine e2e are owned by plan
030 — this plan covers only frosted parity + the Chrome-only `backdrop-filter`
displacement. "Displacement only where supported" here means the BACKDROP bend
(023); the copy-refraction (030) intentionally renders on all three engines.

Testing approach: E2E

## Tasks

1. Add a spec that loads the frosted-default story across all three Playwright
   projects and asserts the frosted recipe via computed styles (blur/saturate
   present, `url(` absent, tint + ring present).
2. Add the displacement-only-where-supported assertion (url( on chromium only).
3. Generate and commit per-browser frosted baselines (`--update-snapshots`).
4. Run the full e2e suite on chromium/firefox/webkit; confirm green.

## Verification

- [cmd] `pnpm e2e`
- [assert] `ls e2e/*-snapshots/ | grep -E "firefox|webkit"` outputs frosted baseline filenames for both engines
- [manual] Spot-check the committed firefox/webkit frosted baselines look consistent with chromium.
