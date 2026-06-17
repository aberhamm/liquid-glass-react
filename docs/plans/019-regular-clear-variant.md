---
id: 019
title: Regular vs Clear glass variant
status: done
blocked-by: [018]
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

Apple distinguishes two Liquid Glass variants: "Regular" (fully adaptive, legible
over anything) and "Clear" (permanently more transparent for media-rich
contexts, with NO adaptive behavior and a dimming layer for legibility) — "they
should never be mixed." Encoding this gives consumers a clear, intentional choice
instead of hand-tuning opacity. The "user" wants a maximally-transparent glass
over a photo (Clear) vs a dependable, content-adaptive control surface (Regular)
and selects it with one prop. Builds on adaptive tint (018), since "Clear" is
defined by the ABSENCE of the adaptive behavior.

ADDITIVE and non-breaking: `variant` defaults to `'regular'` = today's behavior.

**Acceptance criteria:**

- [ ] `<LiquidGlass>` accepts `variant?: 'regular' | 'clear'` (default `'regular'`)
      added to `LiquidGlassProps` with TSDoc. `'regular'` is exactly current
      behavior (incl. adaptive tint when `adaptiveTint` is enabled).
- [ ] `'clear'`: a permanently more transparent surface (lower fill opacity /
      reduced tint), with adaptive tint DISABLED even if `adaptiveTint` is set
      (Clear has no adaptive behavior — documented), and an optional dimming
      layer to preserve legibility (a subtle scrim behind content so labels stay
      readable over busy media). Geometry unchanged.
- [ ] Interaction rules (written + tested): in `'clear'`, `adaptiveTint` is a
      no-op (Clear is non-adaptive by definition); `overLight` may still nudge the
      dimming/legibility but does not re-enable adaptivity; `prefers-contrast`
      (014) still forces its high-contrast treatment (a11y wins over the Clear
      aesthetic).
- [ ] Default (`'regular'`) rendering is unchanged: the committed Showcase pixel
      baseline still passes WITHOUT regeneration (the Showcase uses the default
      variant; the Clear demo is a separate story).
- [ ] Prebuilt components can pass `variant` through their `glassProps` escape
      hatch (no new prop surface required on each; verify pass-through works).
- [ ] Unit tests: `'clear'` lowers transparency + disables adaptivity + adds the
      dimming layer; `'regular'` identical to today; the documented interaction
      rules (clear+adaptiveTint no-op; clear+prefers-contrast still high-contrast).
      `console.error` spy silent under both.
- [ ] This plan OWNS a `Variants` story showing Regular vs Clear side by side over
      the same-origin photo (015).
- [ ] `docs/PARITY.md` + `README.md` document the two variants and the
      "don't mix / Clear is non-adaptive" guidance.

## Design

`variant` selects a small set of surface parameters: `'clear'` lowers the fill
opacity and reduces tint, forces the adaptive path off, and renders an optional
dimming scrim behind the content layer (NOT on the clipped glass node — follow
the existing content/shadow layering rules). `'regular'` leaves all current
behavior intact. Implement as a parameter lookup feeding the existing surface/
content styles; reuse the variant resolver pattern if helpful. Keep the dimming
layer a sibling of the content (legibility), consistent with the established
layer-isolation rules.

**Files expected to change:**

- `src/types.ts`: add `variant?: 'regular' | 'clear'` (TSDoc + interaction notes).
- `src/liquid-glass.tsx`: branch surface params on `variant`; force-disable
  adaptive tint in `'clear'`; add the optional dimming scrim layer.
- `src/liquid-glass.test.tsx`: clear vs regular, interaction rules, console-error.
- `src/liquid-glass.stories.tsx`: a `Variants` story (owned here).
- `docs/PARITY.md`, `README.md`: document the variants + guidance.

**Out of scope:** adaptive-tint internals (018), scroll-aware shadow (021),
new prebuilt components, a theming system. Do not change default (`'regular'`)
rendering.

**Testing approach:** browser-based — a rendering variant; unit/RTL/jsdom with
the luminance hook mocked.

## Tasks

1. Add `variant` to `LiquidGlassProps` with TSDoc + interaction notes.
2. Implement the `'clear'` surface params (lower opacity/tint), force adaptive
   off, add the optional dimming scrim sibling layer.
3. Enforce the interaction rules (clear+adaptiveTint no-op; contrast still wins).
4. Verify prebuilt components pass `variant` via `glassProps`.
5. Add unit tests + the `Variants` story.
6. Update `docs/PARITY.md` + `README.md`; confirm the default baseline still passes.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test -- liquid-glass 2>&1 | tail -8` contains `pass`
- [cmd] `pnpm build-storybook`
- [cmd] `pnpm e2e -- refraction` (default variant ⇒ baseline still passes)
- [assert] `grep -qiE "clear|regular" README.md && echo found` outputs `found`
- [browse] start `pnpm storybook`, open the Variants story, confirm Clear is visibly more transparent than Regular over the photo while content stays legible; no console errors; stop the server
- [manual] Clear ignores adaptiveTint; prefers-contrast still forces high contrast in both variants.

## Implementation Notes

Added `variant?: 'regular' | 'clear'` (default `'regular'`) to LiquidGlassProps
as a 2-key parameter lookup (`VARIANT_PARAMS`) — not a theming system.
`'regular'` is byte-for-byte unchanged (saturationFactor=1, no scrim,
adaptiveTint intact per 018); `'clear'` lowers backdrop saturation/tint
(factor 0.7 ⇒ more transparent) and force-disables adaptivity via a single
`adaptiveActive = adaptiveTint && !forceNonAdaptive` gate feeding both the
AdaptiveTintLayer mount and the `effectiveOverLight` precedence, so adaptiveTint
is a no-op in Clear while `overLight` still nudges legibility. prefers-contrast
(014) still wins in BOTH variants (contrast branch checked first for saturation
and content ink). The dimming scrim is a proper content sibling
(`<span data-lg-scrim>`, zIndex 0 below content's zIndex 1, sibling of the
overflow:hidden surface — never on the clipped node), rendered only for Clear.
`variant` passes through unchanged via the existing `glassProps` escape hatch on
GlassButton/GlassCard/GlassSegmentedControl. The default 'regular' Showcase pixel
baseline passed unchanged. `[browse]` ran: Variants story showed Clear at
saturate(98%) + 1 scrim vs Regular at saturate(140%) + no scrim — visibly more
transparent, content legible, zero console errors. No deviations.

**Files changed:**

- `src/types.ts` (modified)
- `src/liquid-glass.tsx` (modified)
- `src/liquid-glass.test.tsx` (modified)
- `src/liquid-glass.stories.tsx` (modified — `Variants` story)
- `src/index.ts` (modified)
- `README.md` (modified)
- `docs/PARITY.md` (modified)

**Commit:** `2ffe1b4` — `feat(liquid-glass): regular vs clear variant`
