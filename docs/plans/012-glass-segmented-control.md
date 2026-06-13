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

- [ ] `<GlassSegmentedControl>` renders a `radiogroup` (native
      `<fieldset><legend>` + radio `<input>`s, or `role="radiogroup"` with
      `role="radio"` items) with an accessible group label, one selectable option
      per item, and full keyboard support (Arrow keys move/select, Home/End,
      Space/Enter), focus-visible ring per item.
- [ ] Controlled + uncontrolled: accepts `value`/`defaultValue` and
      `onValueChange(value)`, falling back to internal state when uncontrolled
      (the convention locked in 007).
- [ ] The selected indicator is a `<LiquidGlass>` surface positioned behind the
      active option; on selection change it animates (CSS `transform`) from the
      previous option to the new one — the liquid slide. It tracks the previous
      selection to drive the transition (e.g. a `data-previous` hook or measured
      offsets), and respects `prefers-reduced-motion` (snap, no slide).
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
      radiogroup semantics, keyboard nav, controlled vs uncontrolled, indicator
      moves to the selected option, reduced-motion snap, and no console errors
      under both full and fallback capabilities.

## Design

A row of options with one absolutely-positioned glass indicator behind the active
one. The indicator's position/size is derived from the active option's offset
(measure via refs/`ResizeObserver`, or a CSS grid track), and a `transform`
transition produces the slide. Selection state follows the controlled/uncontrolled
pattern. Accessibility leans on native radios where possible (free keyboard +
screen-reader behavior); if a custom `role="radiogroup"` is used, implement the
full roving-tabindex keyboard model.

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
