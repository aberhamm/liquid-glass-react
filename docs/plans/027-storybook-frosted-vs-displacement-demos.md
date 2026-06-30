---
id: 027
title: Storybook demos for frosted-default vs opt-in displacement + portable highlights
status: blocked
blocked-by: [023]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

Now that frosted glass is the cross-browser default and SVG displacement is an
opt-in enhancement (plan 023), Storybook must SHOW that distinction so a
developer evaluating the library understands what they get by default, what the
`displacement` opt-in adds (and where), and that the portable "liquid" character
(specular highlight, sheen, rim-light, bevel) is always present. The Playground
must let them toggle `displacement` and see the effect respond.

**Acceptance criteria:**

- [ ] The `LiquidGlass` Playground exposes a `displacement` control (boolean) and
      the glass visibly responds when toggled on a Chromium browser.
- [ ] A side-by-side comparison story contrasts FROSTED DEFAULT vs DISPLACEMENT
      ON over the SAME backdrop (design-review decision: fair A/B — the calm
      realistic Photos-app backdrop already in the repo, NOT a dense mosaic that
      would exaggerate displacement), each panel clearly labelled (e.g. "Frosted
      — default, all browsers" vs "Displacement — Chrome opt-in").
- [ ] The displacement demo is BROWSER-AWARE (design-review decision): when
      `canRefract` is false (Firefox/Safari), it annotates that displacement
      falls back to frosted on this browser, so a viewer on those engines does
      not see two identical panels and assume the demo is broken.
- [ ] The Playground DEFAULTS to frosted (the `displacement` control OFF) with a
      prominent toggle, so the first impression is what most users get
      (design-review decision).
- [ ] A story showcases the portable highlights (specular hotspot, sheen/rim,
      bevel) that render identically across engines.
- [ ] Existing curated demo stories reflect the NEW default (frosted), not the
      old refraction-by-default look; no story still implies refraction is the
      default.
- [ ] `pnpm build-storybook` succeeds and the stories render without console
      errors.

## Design

Extend `src/liquid-glass.stories.tsx` (and sibling stories if they reference the
old default). The Playground already drives args; add `displacement` to its
argTypes/controls. Add an explicit "Frosted vs Displacement" comparison story and
a "Portable Highlights" story over the calm Photos-app backdrop already used in
the showcase. Keep the demo stories' inert control panels hidden (the existing
convention) except on the control-driven Playground.

This is a demo/showcase plan — design review owns whether the contrast reads
clearly and the default sells the effect.

**Files expected to change:**

- `src/liquid-glass.stories.tsx`: add `displacement` control; add Frosted-vs-
  Displacement and Portable-Highlights stories; update any default-implying copy.
- Sibling stories (`glass-button`/`glass-card`/`glass-segmented-control`
  `.stories.tsx`) only if they assert/imply refraction-by-default.

**Out of scope:** The cross-browser e2e parity assertions (plan 028). Library
component changes (023 already shipped the behavior). Native/Storybook-native
(native has no Storybook target this round).

Testing approach: browser-based

## Tasks

1. Add `displacement` to the Playground argTypes/controls.
2. Add a "Frosted vs Displacement" comparison story with clear labels.
3. Add a "Portable Highlights" story demonstrating specular/sheen/rim/bevel.
4. Audit the other stories for stale "refraction is default" framing and update.
5. Build Storybook and confirm clean render.

## Verification

- [cmd] `pnpm build-storybook`
- [assert] `grep -n "displacement" src/liquid-glass.stories.tsx` outputs a match
- [browse] `/?path=/story/components-liquidglass--playground` verify toggling the displacement control changes the glass on Chromium and the default (off) shows the frosted look
- [manual] Design review: the frosted-vs-displacement contrast reads clearly and the default sells the effect.
