---
id: 012
title: GlassSegmentedControl (liquid toggle)
status: pending
blocked-by: [007, 008]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

The third prebuilt component, and the one where "liquid glass" shows off best: a
segmented control / toggle where the selected indicator is a `<LiquidGlass>`
surface that slides and morphs between options as the selection changes. Think a
theme switcher (light/dark/dim) or a view toggle — a row of options with a single
gliding glass highlight. It builds on the primitive (full refraction in Chromium,
graceful fallback elsewhere; the slide is a CSS transform so it works in every
browser), follows the controlled/uncontrolled contract from 007, and is keyboard-
and screen-reader-accessible as a radio group. The "user" writes
`<GlassSegmentedControl options={[...]} value={v} onValueChange={setV} />` and
gets an accessible toggle with a liquid glass indicator.

**Acceptance criteria:**

- [ ] `<GlassSegmentedControl>` renders a `radiogroup` using NATIVE
      `<fieldset><legend>` + visually-hidden radio `<input type="radio">`s (CSS
      `position:absolute; opacity:0; width:1px; height:1px`) with styled
      `<label>`s — this gives Arrow/Home/End/Space keyboard nav and screen-reader
      behavior for FREE, zero roving-tabindex code. (Only fall back to a custom
      `role="radiogroup"` + manual roving tabindex if a future layout genuinely
      can't use native radios — not needed for this plan.) Accessible group label
      via `<legend>`; focus-visible ring on the active label.
- [ ] Controlled + uncontrolled: accepts `value`/`defaultValue` and
      `onValueChange(value)`, falling back to internal state when uncontrolled
      (the convention locked in 007).
- [ ] The selected indicator is a `<LiquidGlass>` surface positioned behind the
      active option. Its width and x-offset MATCH the active option element's
      measured `getBoundingClientRect` relative to the container (so unequal-width
      options — e.g. icon-only vs long label — are handled, not just equal
      segments), recomputed via a `ResizeObserver` on the container. On selection
      change it animates via `transform: translateX(...)` (+ width) from the
      previous to the new option — the liquid slide — and respects
      `prefers-reduced-motion` (snap, no transition). The component exposes a
      deterministic DOM signal of the active index (e.g. a `data-selected-index`
      attribute or the indicator's inline `transform`/`width`) so tests can assert
      the indicator moved.
- [ ] Works cross-browser: the slide + glass edge render everywhere; the
      refraction is present in Chromium and gracefully absent (fallback) elsewhere
      via the same capability gate as the primitive — no layout break, no console
      errors, in any engine.
- [ ] Reuses the shared infrastructure: the variant resolver, internal `Slot`
      (where polymorphism applies), inset-shadow edge, and component stylesheet
      from 005/007 (DRY — no parallel re-implementation).
- [ ] `size` variants (`sm|md|lg`) and an `icon`-friendly option layout (label
      and/or icon per option). Exported from `src/index.ts` with its prop types.
- [ ] A Storybook story (incl. a theme-switcher example) and unit tests cover:
      radiogroup semantics, keyboard nav, controlled vs uncontrolled, reduced-motion
      snap, and no console errors under both full and fallback capabilities. The
      "indicator moves" test asserts the deterministic DOM signal (e.g.
      `data-selected-index` or the indicator's inline `transform`) DIFFERS between
      two selection states — not just that the suite renders.

## Design

A row of styled `<label>`s wrapping visually-hidden native radios, with one
absolutely-positioned glass indicator behind the active option. The indicator's
width + x-offset are derived from the active option element's measured
`getBoundingClientRect` relative to the container (handles unequal-width options),
recomputed on a container `ResizeObserver`; a `transform` transition produces the
slide. Selection state follows the controlled/uncontrolled pattern. Accessibility
is native: real radios in a `<fieldset>` give the full keyboard model and
screen-reader semantics for free — no custom ARIA/roving-tabindex needed.

**Files expected to change:**

- `src/glass-segmented-control.tsx`: the component + `GlassSegmentedControlProps`,
  `forwardRef`, controlled/uncontrolled state, indicator positioning + transition.
- `src/glass-segmented-control.test.tsx`: RTL tests (semantics, keyboard nav,
  controlled/uncontrolled, indicator target, reduced-motion, console-error spy
  under full + fallback capabilities).
- `src/glass-segmented-control.stories.tsx`: variants + a theme-switcher example.
- `src/components.css` (extend): segmented-control + indicator styles, reusing the
  inset-shadow edge tokens.
- `src/index.ts`: export the component + its types.

**Testing approach:** browser-based — interactive control; semantics/state via
Vitest + RTL now, real slide + keyboard + cross-browser via the story (here) and
Playwright (010, which depends on this plan).

**Out of scope:** the Playwright E2E for this control (owned by 010, which is
blocked-by this plan), release docs (011), additional components beyond the
segmented control, a generic Tabs/Menu system. No new runtime dependencies; do
NOT pull in Radix or a headless-UI library — reuse the internal Slot + native
radios.

## Tasks

1. Build the radiogroup structure (native `<fieldset>/<legend>/<input radio>` or
   `role="radiogroup"` + roving tabindex) with accessible labels and full keyboard
   nav.
2. Implement controlled/uncontrolled state (`value`/`defaultValue`/`onValueChange`)
   with previous-selection tracking.
3. Position the `<LiquidGlass>` indicator behind the active option; animate its
   `transform` on change; respect `prefers-reduced-motion`.
4. Wire `size` variants + per-option label/icon layout using the shared variant
   resolver + stylesheet; reuse the inset-shadow edge.
5. Export the component + types; write `src/glass-segmented-control.test.tsx`.
6. Add `src/glass-segmented-control.stories.tsx` (variants + theme-switcher
   example); run typecheck/lint/test + `build-storybook`.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- glass-segmented-control`
- [assert] `pnpm test -- glass-segmented-control 2>&1 | tail -6` contains `pass`
- [cmd] `pnpm build-storybook`
- [browse] start `pnpm storybook` and verify the GlassSegmentedControl story: clicking/arrow-keying between options slides the glass indicator to the selected option, keyboard selection works, and there are no console errors; then stop the dev server
- [manual] In Firefox/Safari, confirm the slide + glass edge render cleanly (refraction gracefully absent) with no layout break.
