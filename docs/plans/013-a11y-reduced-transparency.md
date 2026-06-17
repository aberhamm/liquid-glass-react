---
id: 013
title: Honor prefers-reduced-transparency (frostier, no displacement)
status: done
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
completed: 2026-06-17
reviewed: false
qa: automated
---

## Requirements

Apple's Liquid Glass honors the OS "Reduce Transparency" setting by making the
material frostier and more opaque and dropping the live lensing. We honor
`prefers-reduced-motion` but NOT `prefers-reduced-transparency`, which is our
clearest accessibility omission (and a WebKit-shipping setting today). The
"user" is a vision- or vestibular-sensitive visitor who has turned on Reduce
Transparency: `<LiquidGlass>` must respond by suppressing the SVG displacement
refraction and rendering a more opaque, lower-transparency surface — with NO
layout shift, NO console errors, and the content staying legible — while every
visitor WITHOUT the setting sees today's behavior unchanged.

This is an ADDITIVE, non-breaking change: a new capability flag + live hook +
an orthogonal render branch. It must not regress any of the existing 119 unit
tests or the cross-engine Playwright suite.

**Acceptance criteria:**

- [ ] `src/capabilities.ts` adds a `prefersReducedTransparency: boolean` field to
      `GlassCapabilities`, derived SSR-safely from
      `matchMedia('(prefers-reduced-transparency: reduce)')` (conservative
      `false` when `window`/`matchMedia` is undefined or the query is unsupported).
- [ ] `src/use-reduced-transparency.ts` exports a live `useReducedTransparency()`
      hook mirroring `useReducedMotion` EXACTLY (the single authoritative live
      source: `matchMedia` + a `'change'` listener so it reacts to a mid-session
      toggle; conservative `false`/SSR default before mount). No other module
      queries `prefers-reduced-transparency` independently.
- [ ] When reduced-transparency is active, `<LiquidGlass>` renders a "reduced"
      treatment that REUSES the existing no-filter path (the same branch taken
      when `canRefract`/`filterActive` is false — do NOT invent a 4th tier):
      the SVG displacement `url(#id)` is omitted, and the surface becomes
      frostier/more opaque (raise the background fill opacity and/or keep blur
      but drop refraction) so the result reads as static frosted glass.
- [ ] The reduced treatment is ORTHOGONAL to the existing 3-tier capability gate:
      it applies on Chromium (canRefract true) AND on the frosted/solid fallback
      tiers. Crossing the axis must NOT change box geometry (no layout shift) and
      must keep content legible in all combinations.
- [ ] Rim/bevel/elastic-motion layers still render (they are not transparency —
      they are the cross-browser polish), but the live lensing/refraction does not.
- [ ] Default behavior (setting OFF) is byte-for-byte unchanged: the committed
      Playwright pixel baseline for the Showcase story still passes WITHOUT
      regeneration (this plan only changes rendering when the media query is ON).
- [ ] Unit tests cover the hook (mocked `matchMedia`, change-event reactivity,
      SSR no-window default) and the render branch (reduced-transparency mocked
      true ⇒ no `url(#` in the surface `backdrop-filter`, more-opaque fill;
      mocked false ⇒ identical to today). A `console.error` spy stays silent.
- [ ] Because jsdom's `matchMedia` stub returns `matches:false` for unknown
      queries (so a unit-only test passes vacuously), add a Playwright test using
      `page.emulateMedia({ reducedTransparency: 'reduce' })` asserting the
      Chromium Showcase glass drops `url(#` from its `backdrop-filter` under the
      emulated setting — mirroring how 010 emulates reduced-motion.
- [ ] `docs/PARITY.md` documents the reduced-transparency behavior row.

## Design

`prefers-reduced-transparency` is a separate axis from the `canRefract`/
`supportsBackdropFilter` tier selection. The cheapest correct implementation
reuses the path that already produces a no-refraction surface: when the hook
returns true, force `filterActive = false` (so the existing code omits the SVG
`url(#id)` exactly as it does on Firefox/WebKit) and bump the surface fill
opacity for the "more opaque" effect. This avoids a new tier and preserves the
no-layout-shift invariant. The live hook follows the established
`useReducedMotion` pattern verbatim; `detectGlassCapabilities()` surfaces a
point-in-time snapshot but the live hook is authoritative for the component.

**Files expected to change:**

- `src/capabilities.ts`: add `prefersReducedTransparency` probe + field.
- `src/use-reduced-transparency.ts` (new): live hook (matchMedia + change listener).
- `src/liquid-glass.tsx`: consume the hook; when active, force the no-filter
  branch + more-opaque fill; keep geometry + rim/motion identical.
- `src/index.ts`: export `useReducedTransparency`.
- `src/liquid-glass.test.tsx` (+ maybe `src/use-reduced-transparency.test.ts`):
  hook + render-branch + console-error tests.
- `e2e/refraction.spec.ts` (or a new `e2e/a11y.spec.ts`): the `emulateMedia`
  reduced-transparency assertion (chromium).
- `docs/PARITY.md`: add the reduced-transparency row.

**Testing approach:** browser-based — a rendering/a11y branch; unit via
Vitest/RTL/jsdom (mock matchMedia), cross-engine truth via Playwright
`emulateMedia` (jsdom can't really evaluate the query).

**Out of scope:** `prefers-contrast` (plan 014), adaptive tint (018), any
showcase content changes (015), changing the default (setting-off) rendering.
Do NOT add a 4th capability tier — reuse the existing no-filter path.

## Tasks

1. Add the `prefersReducedTransparency` probe + field to `detectGlassCapabilities`
   (SSR-safe, unsupported-query-safe).
2. Write `src/use-reduced-transparency.ts` mirroring `use-reduced-motion.ts`.
3. In `src/liquid-glass.tsx`, consume the hook and force the existing no-filter
   branch + raise fill opacity when active; keep geometry/rim/motion unchanged.
4. Export the hook from `src/index.ts`.
5. Add unit tests (hook + render branch + console-error spy) and the Playwright
   `emulateMedia({ reducedTransparency })` assertion.
6. Update `docs/PARITY.md`. Run typecheck/lint/test and confirm the existing
   Showcase pixel baseline still passes unchanged.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [cmd] `pnpm test -- reduced-transparency`
- [assert] `pnpm test 2>&1 | tail -6` contains `pass`
- [cmd] `pnpm exec playwright test a11y --project=chromium` (or the refraction spec containing the emulateMedia case)
- [assert] `grep -qi "reduced-transparency\|reduce transparency" docs/PARITY.md && echo found` outputs `found`
- [manual] With Reduce Transparency on (macOS System Settings), the Showcase glass renders as static frosted glass (no live refraction), still legible, no console errors.

## Implementation Notes

Added prefers-reduced-transparency support as an additive, orthogonal axis.
`capabilities.ts` gained an SSR-safe `prefersReducedTransparency` probe + a
`GlassCapabilities` field; a new `useReducedTransparency()` hook mirrors
`useReducedMotion` verbatim (matchMedia + `'change'` listener, conservative
`false` default) and is the authoritative live source. `<LiquidGlass>` consumes
it: when active it forces `filterActive=false` (reusing the existing no-filter
path so the SVG `url(#id)` is omitted on every tier with no geometry change) and
raises the surface fill opacity (~0.75 frosting over retained blur on tiers 1/2,
~0.92 solid on tier 3). Rim/bevel/elastic-motion layers still render. Unit tests
cover the hook (mocked matchMedia, change reactivity, SSR default) and the render
branch (mocked true drops `url(` and adds opaque fill; mocked false byte-for-byte
unchanged) with a silent `console.error` spy. The committed Showcase pixel
baseline passes without regeneration.

**Deviation:** Playwright 1.61's `page.emulateMedia()` has no
`reducedTransparency` option, so `e2e/a11y.spec.ts` drives the media feature over
CDP (`Emulation.setEmulatedMedia` with `prefers-reduced-transparency`) instead —
achieving the plan's intent with a working API.

**Files changed:**

- `src/capabilities.ts` (modified)
- `src/capabilities.test.ts` (modified)
- `src/types.ts` (modified)
- `src/liquid-glass.tsx` (modified)
- `src/liquid-glass.test.tsx` (modified)
- `src/index.ts` (modified)
- `src/index.test.ts` (modified)
- `src/glass-button.test.tsx` (modified)
- `src/glass-card.test.tsx` (modified)
- `src/glass-segmented-control.test.tsx` (modified)
- `docs/PARITY.md` (modified)
- `src/use-reduced-transparency.ts` (created)
- `src/use-reduced-transparency.test.ts` (created)
- `e2e/a11y.spec.ts` (created)

**Commit:** `2eea7b2` — `feat(liquid-glass): honor prefers-reduced-transparency`
