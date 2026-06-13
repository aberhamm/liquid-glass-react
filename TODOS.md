# TODOS

Deferred work and coverage gaps for `@aberhamm/liquid-glass-react`. These were identified
during planning (`/mstack-plan-multi`) and validation (`/mstack-plan-doctor`) but
deliberately left out of the 11-plan backlog under a "Hold" review posture — they
expand scope rather than complete the core feature. Pull any of these into a future
`/mstack-plan-multi` run when you want them.

Status legend: 🔵 not started · 🟡 in progress · ✅ done

---

## Coverage gaps (non-blocking)

### 🔵 T1 — SSR / Next.js App-Router integration example
- **What:** A real consumer example that server-renders `<LiquidGlass>` in a Next.js
  App-Router (RSC) page, plus CI verification that it hydrates cleanly.
- **Why:** The implementation is SSR-safe (capability detection defaults conservative
  on the server; the effect is applied in an effect after mount; plan 006 adds a
  `renderToString → hydrateRoot` unit test). But no plan exercises a real RSC boundary
  — `'use client'` placement, hydration in an actual Next app, and streaming. This is
  the gap that most often surprises library adopters.
- **Context:** Capability contract lives in `src/capabilities.ts` + `useGlassCapabilities`
  (plan 002). Hydration safety is unit-tested in plan 006 but only in jsdom. A real
  example would be an `examples/next-app/` workspace or a documented snippet + a smoke
  test that boots the Next app and asserts no hydration warning.
- **Depends on:** 006 (graceful degradation + SSR safety), 007 (components to show).
- **Effort:** human ~half day / CC ~30 min.

### 🔵 T2 — Bundle-size / tree-shaking budget
- **What:** A per-export size check (e.g. `size-limit` or `bundlesize`) asserting that
  importing only `GlassButton` does not pull in the full `<LiquidGlass>` + displacement
  generator, with a CI budget that fails on regression.
- **Why:** Plan 001 sets `sideEffects: false` and plan 011 runs `attw` + `npm pack
  --dry-run`, but nothing guards selective-import weight. The SDF/canvas displacement
  generator (plan 003) is non-trivial and could bloat a `GlassButton`-only import.
- **Context:** Add `size-limit` config keyed per public entry point. Natural home is an
  extension of plan 011's release/CI work. Confirm the build (plan 001 Vite lib mode)
  emits tree-shakeable ESM first. Plan 003 already commits to runtime-generated
  displacement maps (no inline base64 blobs) to keep this budget honest — the
  remaining risk is the displacement generator / SVG-filter code weight leaking
  into a `GlassButton`-only import. If prebaked maps are ever reintroduced, they
  must be build-time assets (WEBP), not bundle-inlined.
- **Depends on:** 001 (build), 011 (release/CI).
- **Effort:** human ~2h / CC ~15 min.

### 🔵 T3 — Visual-regression baseline
- **What:** Pixel-diff baselines for the rendered effect (Playwright `toHaveScreenshot`
  or Storybook + Chromatic), so changes to the SVG filter math or CSS can't silently
  regress the look.
- **Why:** Plan 010 captures screenshots "for evidence" but explicitly scopes out a
  diff baseline. Without it, a tweak to the aberration/edge-mask math (plan 004) or the
  displacement encoding (plan 003) could visually regress with all assertion-based tests
  still green.
- **Context:** Cheapest path is Playwright's built-in `toHaveScreenshot` against the
  Chromium Showcase story (plan 009), pinned to one engine to avoid cross-engine
  flakiness. Storybook + Chromatic is the heavier, hosted alternative. Extends plan 010.
- **Depends on:** 009 (showcase story), 010 (Playwright harness).
- **Effort:** human ~3h / CC ~20 min.

### 🔵 T4 — GlassCard interactive-a11y E2E (conditional)
- **What:** A Playwright a11y test for `<GlassCard as="a">` / `as="button"` (focus ring,
  keyboard activation) mirroring the existing `GlassButton` E2E.
- **Why:** Plan 010 covers `GlassButton` keyboard a11y across engines, but `GlassCard`'s
  `as` prop allows interactive elements (plan 007). If `GlassCard` stays purely
  presentational this is unnecessary; if interactive usage is supported/encouraged, it
  needs the same focus + keyboard coverage.
- **Context:** Decide first whether `GlassCard` is meant to be interactive. Plan 007
  currently scopes it presentational (`as` defaults to `'div'`, consumer owns a11y for
  interactive elements). Promote this TODO only if that stance changes.
- **Depends on:** 007 (GlassCard `as` behavior), 010 (Playwright harness).
- **Effort:** human ~1h / CC ~10 min.

---

## Notes
- All four are additive. The 11-plan backlog ships a complete, tested, cross-browser
  library without them.
- Lineage / non-fork posture is already handled inside the backlog (plan 002 PARITY.md,
  plan 003 first-principles SDF, plan 011 LICENSE attribution) — not a TODO.
