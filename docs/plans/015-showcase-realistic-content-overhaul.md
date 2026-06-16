---
id: 015
title: Showcase overhaul — realistic content, draggable, scroll-under
status: pending
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

The showcase currently floats glass over a flat CSS gradient, which hides the
library's headline feature: refraction is only convincing over rich, real
content that MOVES. Every persuasive liquid-glass demo online (shuding, jh3y,
Apple) puts the glass over real photos and lets the viewer drag the glass or
scroll content under it. This plan reworks the DEMO surface only — no library
API change — so a developer evaluating the package immediately sees a
convincing effect. The "user" is that evaluator opening Storybook.

DEMO-ONLY. No `src/*.tsx` component/runtime changes. Uses only the existing
public API (`globalMousePos`/`mouseContainer` for drag wiring, existing props
for the toggle). Respects `prefers-reduced-motion` in any demo animation.

**Acceptance criteria:**

- [ ] The `LiquidGlass` `Showcase` story (and the global backdrop decorator)
      uses a RICH, REAL backdrop — a high-resolution photo (and/or a colorful
      photo collage), not the flat CSS gradient — so refraction edge-bending is
      obvious. Images are SAME-ORIGIN (bundled in the repo or served from the
      Storybook static assets), NOT remote, so a later plan (018) can sample
      them via canvas without cross-origin taint. Document the image source +
      license.
- [ ] A `Draggable` story: a glass panel the user drags across a busy photo /
      desktop-mock backdrop, wired through the existing
      `globalMousePos`/`mouseContainer` props (no new component). Dragging shows
      different content refracting through the glass. Pointer + touch friendly.
- [ ] A `ScrollUnderGlass` story: a pinned glass bar/panel fixed over a column
      of scrolling cards/photos/text, so the viewer sees content move under the
      glass (the "lifts above scrolling content" effect).
- [ ] A `CheapVsReal` story: a side-by-side of blur-only (no displacement, e.g.
      a plain `backdrop-filter: blur`) vs the full `<LiquidGlass>` displacement,
      over the same photo, so the refraction difference is legible to viewers.
- [ ] The `Modes` matrix renders over a real photo (not the gradient) so
      `polar`/`prominent`/`shader`/`turbulence` differences are actually visible.
- [ ] Any demo animation (drift, auto-scroll) is gated behind
      `@media (prefers-reduced-motion: reduce)` → static fallback (the demo
      practices the a11y the library preaches).
- [ ] `pnpm build-storybook` succeeds with all new stories present in the static
      build; no console errors in the stories.
- [ ] Because the Showcase backdrop changes, the refraction shows new content:
      REGENERATE the committed Chromium pixel baseline
      (`e2e/refraction.spec.ts-snapshots/showcase-glass-chromium-chromium-darwin.png`)
      against the new Showcase and COMMIT it, so `pnpm e2e` stays green on darwin.
      (Keep the pixel-diff's release-blocking intent — only the baseline image
      changes, not the assertion.)

## Design

Pure Storybook work: rework `.storybook/preview.tsx`'s backdrop decorator to
offer a real-photo backdrop (parameterizable) and add the four new stories.
Drag is implemented in the story by tracking pointer/drag position in story
state and feeding it to `globalMousePos`/`mouseContainer` — exercising the
public API exactly as a consumer would. Bundle demo photos under a
Storybook-served, same-origin path (e.g. `.storybook/assets/` or `public/`),
small/optimized (WEBP) to keep the static build reasonable.

**Files expected to change:**

- `.storybook/preview.tsx`: real-photo backdrop decorator (parameterized).
- `src/liquid-glass.stories.tsx`: real-photo Showcase, `Draggable`,
  `ScrollUnderGlass`, `CheapVsReal`, Modes-over-photo.
- `.storybook/assets/` or `public/` (new): same-origin demo photo(s), license noted.
- `e2e/refraction.spec.ts-snapshots/showcase-glass-chromium-chromium-darwin.png`:
  regenerated baseline.

**Out of scope:** any library/component API change (no new props, no
`src/liquid-glass.tsx` edits); the feature stories owned by later plans
(specular story → 016, adaptive-tint story → 018, clear-variant story → 019);
building a real draggable COMPONENT (this is a story-level recipe only).

**Testing approach:** browser-based — Storybook demo surface; verified by
`build-storybook` success + the regenerated cross-engine pixel baseline.

## Tasks

1. Add same-origin, optimized demo photo asset(s); note source/license.
2. Rework the preview backdrop decorator to use a real photo (parameterized,
   reduced-motion-safe).
3. Rewrite the `Showcase` + `Modes` stories over the real photo.
4. Add `Draggable` (pointer/touch via globalMousePos/mouseContainer),
   `ScrollUnderGlass`, and `CheapVsReal` stories.
5. Run `pnpm build-storybook`; confirm all stories render with no console errors.
6. Regenerate + commit the Chromium Showcase pixel baseline; run `pnpm e2e` green.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm build-storybook`
- [cmd] `test -d storybook-static && test -f storybook-static/index.html`
- [cmd] `pnpm e2e -- refraction` (must pass with the regenerated baseline)
- [assert] `pnpm e2e -- refraction 2>&1 | tail -15` contains `passed`
- [browse] start `pnpm storybook` and verify the Draggable story lets you drag the glass over a photo with visible refraction, ScrollUnderGlass shows content moving under the glass, and CheapVsReal makes the displacement difference obvious — no console errors; then stop the dev server
- [manual] The Showcase clearly sells the refraction over real content vs the old gradient.
