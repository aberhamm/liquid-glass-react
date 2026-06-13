---
id: 006
title: Graceful degradation fallback and SSR safety
status: pending
blocked-by: [004, 005]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

This plan delivers the headline cross-browser requirement: when the Chromium-only
refraction can't render (Firefox, Safari/WebKit, or any engine failing the
capability probes), `<LiquidGlass>` must degrade gracefully to a polished
fallback — backdrop blur + saturation + the rim-lighting and elastic motion from
005 — without console errors, layout shifts, or a broken/empty box. It must also
be SSR-safe: server render produces stable, conservative markup, and the client
upgrades to the full effect only after capabilities resolve, with no hydration
mismatch. The "user" is a Firefox/Safari visitor who still sees an attractive
frosted-glass card that behaves correctly, and a Next.js developer who can render
the component server-side without warnings.

**Acceptance criteria:**

- [ ] When `canRefract` is false, `<LiquidGlass>` renders the fallback path:
      `backdrop-filter` blur+saturate (with `-webkit-` prefix), rim/highlight
      layers, the layered inset-shadow glass edge from 005, and elastic motion —
      but NO SVG filter and no orphaned `<filter>` that could error. The
      inset-shadow edge is what makes the degraded result look like real glass
      rather than a plain blurred box — it must be present in the fallback, not
      just the full-effect path.
- [ ] When `backdrop-filter` itself is unsupported, a final solid/translucent
      background fallback keeps content legible (no transparent unreadable box).
- [ ] SSR: the first (server) render and first client render agree
      (capabilities default conservative on the server; the effect is applied in
      an effect after mount) — no React hydration warning. Verified concretely
      by a Node/jsdom test that calls `renderToString()` (react-dom/server) then
      `hydrateRoot()` on that markup with a `console.error` spy and asserts the
      spy is never called with a hydration-mismatch message (NOT by eyeballing —
      this is an executable check).
- [ ] No `console.error`/`console.warn` in any path; no layout shift between
      fallback and full effect (same box dimensions).
- [ ] `prefersReducedMotion` disables motion in both full and fallback paths.
- [ ] Unit tests render the component under mocked capability matrices
      (full / no-svg / no-backdrop-filter / SSR) and assert the correct path,
      absence of the filter, and no console errors.

## Design

The component already gates the SVG filter on `canRefract` (004). This plan makes
the *fallback* deliberate and tested: a clean visual when refraction is off,
tiered by capability (`canRefract` → full; `supportsBackdropFilter` → frosted
fallback; neither → solid translucent fallback). Hydration safety: render the
conservative (no-filter) markup on the server and on the very first client paint,
then enable the filter in a `useEffect` once `useGlassCapabilities` resolves.

**Files expected to change:**

- `src/liquid-glass.tsx`: tiered fallback rendering, hydration-safe capability
  application, final no-backdrop-filter fallback styles.
- `src/capabilities.ts`: `supportsBackdropFilter` is already exported from 002;
  consume it directly (no change expected — touch only if a finer tier flag is
  genuinely missing).
- `src/liquid-glass.test.tsx`: add capability-matrix render tests + console-error
  spy assertions + dimension/layout-stability checks + the renderToString →
  hydrateRoot hydration test described above.
- `docs/PARITY.md`: created in 002 — fill in the per-browser degraded-behavior
  rows now that the fallback is concrete (extend, do not recreate).

**Testing approach:** browser-based — degradation is a rendering concern; verified
via Vitest capability-matrix tests now, and asserted as the *success* state in
Firefox/WebKit by Playwright (010).

**Out of scope:** prebuilt components (007), Storybook (008/009), the Playwright
suite itself (010). Do not attempt an actual SVG refraction fallback for
Safari/Firefox — graceful degradation (blur + rim + motion) is the chosen
strategy, not a refraction polyfill.

## Tasks

1. Define the tiered render: full (canRefract) → frosted (backdrop-filter) →
   solid translucent (neither), sharing identical box geometry.
2. Make capability application hydration-safe (conservative SSR/first-paint, then
   effect-driven upgrade); create-or-extend `src/liquid-glass.test.tsx` with the
   `renderToString` (`react-dom/server`) → `hydrateRoot` (`react-dom/client`) test
   + `console.error` spy to prove no hydration mismatch. `react`/`react-dom` are
   already dev-installed via 001; no new dep needed.
3. Add `-webkit-backdrop-filter` and the solid-background final fallback.
4. Ensure motion + rim layers render in fallback and honor reduced-motion.
5. Extend `src/liquid-glass.test.tsx` with the capability matrix, a
   `console.error` spy, and layout-stability assertions; update `docs/PARITY.md`.
6. Run typecheck/lint/test.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test -- liquid-glass 2>&1 | tail -8` contains `pass`
- [assert] `grep -qi "degraded" docs/PARITY.md && echo found` outputs `found`
- [manual] Render in Firefox + Safari: a clean frosted-glass card with rim + motion, no empty box, no console errors.
