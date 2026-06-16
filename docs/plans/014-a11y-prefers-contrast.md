---
id: 014
title: Honor prefers-contrast (solid border, raised contrast, less tint)
status: pending
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

Apple's Liquid Glass honors "Increase Contrast" by adding visible borders and
raising fill/content contrast (macOS Tahoe even couples it to Reduce
Transparency). We honor neither. Contrast is the cardinal failure mode of glass
UIs — shipping Liquid Glass measured ~1.5:1 against the 4.5:1 WCAG floor. The
"user" is a low-vision visitor with Increase Contrast enabled: `<LiquidGlass>`
must respond with a solid, visible border and a higher-contrast content
treatment (and reduced decorative tint) so text and edges are clearly
delineated — without layout shift or console errors — while default visitors
see today's behavior unchanged.

ADDITIVE and non-breaking: a new capability flag + live hook + a contrast render
branch. Distinct axis from `prefers-reduced-transparency` (plan 013).

**Acceptance criteria:**

- [ ] `src/capabilities.ts` adds `prefersContrastMore: boolean` (or a small
      `prefersContrast` enum) to `GlassCapabilities`, derived SSR-safely from
      `matchMedia('(prefers-contrast: more)')` (conservative `false` when
      unsupported/SSR).
- [ ] `src/use-prefers-contrast.ts` exports a live `usePrefersContrast()` hook
      mirroring `useReducedMotion` (matchMedia + `'change'` listener, SSR-safe).
      Single authoritative live source.
- [ ] When `prefers-contrast: more` is active, `<LiquidGlass>` adds a SOLID,
      visible border (a real `border`/outline, not just the soft inset bevel),
      raises content legibility (e.g. a stronger content foreground treatment /
      reduced backdrop tint), and tones down purely decorative
      saturation/aberration that harms contrast. Box geometry is unchanged (the
      border must not shift layout — use an inset border or box-shadow-style
      outline that doesn't change the box size).
- [ ] The contrast treatment is ORTHOGONAL to the 3 capability tiers and to
      reduced-transparency (013): it applies in full, frosted, and solid tiers.
- [ ] Default behavior (setting OFF) is unchanged: the committed Showcase pixel
      baseline still passes WITHOUT regeneration (this plan changes rendering
      only when the media query is ON).
- [ ] Prebuilt components inherit the treatment through the primitive (no
      per-component contrast code needed); spot-check `GlassButton`'s focus-ring
      contrast remains adequate.
- [ ] Unit tests cover the hook (mocked matchMedia, change reactivity, SSR) and
      the render branch (contrast mocked true ⇒ solid border + raised-contrast
      treatment present; false ⇒ identical to today), with a silent
      `console.error` spy.
- [ ] A Playwright test using `page.emulateMedia({ contrast: 'more' })` asserts
      the Chromium Showcase glass gains the solid border under the emulated
      setting (jsdom can't evaluate the query, so this is the real check).
- [ ] `docs/PARITY.md` documents the prefers-contrast behavior row.

## Design

`prefers-contrast` drives a different surface from reduced-transparency: borders
+ content contrast + reduced decorative tint, NOT opacity/displacement. Add the
border as an inset (so geometry is preserved) keyed off the live hook. Reuse the
established hook pattern. The two a11y axes (013, 014) are independent and may
both be active; ensure the combination stays legible and shift-free.

**Files expected to change:**

- `src/capabilities.ts`: add the `prefers-contrast` probe + field.
- `src/use-prefers-contrast.ts` (new): live hook.
- `src/liquid-glass.tsx`: consume the hook; add solid inset border + raised
  content contrast + reduced tint when active; keep geometry unchanged.
- `src/components.css`: a contrast-mode class/treatment if helpful (kept DRY).
- `src/index.ts`: export `usePrefersContrast`.
- `src/liquid-glass.test.tsx` (+ maybe `src/use-prefers-contrast.test.ts`).
- `e2e/a11y.spec.ts` (created by 013, or here if 013 ran first): add the
  `emulateMedia({ contrast: 'more' })` assertion.
- `docs/PARITY.md`: add the prefers-contrast row.

**Testing approach:** browser-based — a rendering/a11y branch; unit via
Vitest/RTL/jsdom, cross-engine truth via Playwright `emulateMedia`.

**Out of scope:** reduced-transparency (013), adaptive tint (018), showcase
content (015), changing default rendering. Do NOT add a new tier.

## Tasks

1. Add the `prefers-contrast: more` probe + field to `detectGlassCapabilities`.
2. Write `src/use-prefers-contrast.ts` mirroring the reduced-motion hook.
3. In `src/liquid-glass.tsx`, add the solid inset border + raised-contrast
   content treatment + reduced tint when active; preserve geometry.
4. Export the hook; add a contrast-mode style if needed (DRY in components.css).
5. Add unit tests (hook + render branch + console-error spy) + the Playwright
   `emulateMedia({ contrast })` assertion.
6. Update `docs/PARITY.md`; confirm the Showcase pixel baseline still passes.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [cmd] `pnpm test -- prefers-contrast`
- [assert] `pnpm test 2>&1 | tail -6` contains `pass`
- [cmd] `pnpm exec playwright test a11y --project=chromium`
- [assert] `grep -qi "prefers-contrast\|increase contrast\|contrast" docs/PARITY.md && echo found` outputs `found`
- [manual] With Increase Contrast on, the glass shows a solid border and clearly legible content; default rendering is unchanged with the setting off.
