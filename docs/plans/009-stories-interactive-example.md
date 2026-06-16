---
id: 009
title: Component stories and polished interactive example
status: in-progress
blocked-by: [008]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

With Storybook configured (008), this plan delivers the actual documentation
surface and the showcase the user explicitly asked for: full stories with
interactive controls for every prop on `LiquidGlass`, `GlassButton`, and
`GlassCard`, plus one polished, deliberately designed example — a glass panel
floating over a rich, moving/scrolling background that makes the refraction and
elastic motion obvious. The "user" is a developer evaluating the library who
opens Storybook, plays with the controls, and sees a convincing demo; and a
designer reviewing the showcase for visual quality.

**Acceptance criteria:**

- [ ] `LiquidGlass` story exposes ALL props as Storybook controls (ranges for
      numeric props, a select for `mode`, booleans for `overLight`, etc.) with
      argTypes + docs descriptions sourced from the prop TSDoc.
- [ ] `GlassButton` and `GlassCard` stories show each variant/size, the
      escape-hatch usage, the shine-on-press, and an `asChild` example (e.g.
      `<GlassButton asChild><a href="#">Link</a></GlassButton>`) rendering a real
      anchor with glass styling.
- [ ] A `Modes` story (or a parameterized matrix) renders all five
      `DisplacementMode` values (`standard`, `polar`, `prominent`, `shader`,
      `turbulence`) so every mode — especially the runtime-generated `shader` and
      the procedural `turbulence` (frosted-ripple) — is visibly exercised, not just
      reachable via a control.
- [ ] A dedicated `Example`/`Showcase` story renders a glass card/button over an
      animated or image-rich background (e.g. moving gradient or scrolling photo)
      so the refraction edge-bending and cursor elasticity are clearly visible in
      Chromium and the graceful fallback is visibly clean in other engines.
- [ ] A story (or MDX doc) demonstrates the cross-browser story: what Chromium vs
      Firefox/Safari users see, referencing the parity spec.
- [ ] Autodocs pages generate for each component; `pnpm build-storybook` still
      succeeds and the example story is present in the static build.

## Design

Stories are the design deliverable. Drive controls from `argTypes` so the docs
match the real prop API (002). The showcase decorator supplies an animated
backdrop; keep it performant (CSS animation, not heavy JS) and gate the animation
behind `@media (prefers-reduced-motion: reduce)` (fall back to a static backdrop)
so the demo practices the accessibility the library preaches. Ensure the example
reads well on a range of viewport sizes.

**Files expected to change:**

- `src/liquid-glass.stories.tsx`: full controls + variants + the `Showcase`/
  `Example` story with animated backdrop.
- `src/glass-button.stories.tsx`, `src/glass-card.stories.tsx`: variant/size
  matrices + escape-hatch demo.
- `src/cross-browser.mdx` (or a story): the degradation explainer.
- `.storybook/preview.tsx`: refine the backdrop decorator / viewport addon if needed.

**Testing approach:** browser-based — visual/interactive stories; verified via a
`[browse]` check on the running Storybook and re-confirmed by Playwright (010).

**Out of scope:** Storybook framework/config changes (owned by 008 — only refine
the decorator here), Playwright tests (010), release docs (011). Don't change
component APIs to suit stories; if a control is awkward, note it for 011.

## Tasks

1. Add full `argTypes` + controls to the `LiquidGlass` story (numeric ranges,
   `mode` select, booleans), with descriptions from prop TSDoc.
2. Build variant/size matrix stories for `GlassButton` and `GlassCard` + an
   escape-hatch example.
3. Create the `Showcase`/`Example` story with an animated/photo backdrop that
   showcases refraction + elastic motion.
4. Add the cross-browser degradation explainer (MDX or story) referencing PARITY.md.
5. Enable autodocs; confirm `pnpm build-storybook` includes everything.
6. Run the build + a manual browser pass.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm build-storybook`
- [cmd] `test -d storybook-static && test -f storybook-static/index.html`
- [browse] start `pnpm storybook` and verify the Showcase/Example story renders a glass element over an animated backdrop, the LiquidGlass story controls change the effect live, and there are no console errors
- [manual] Designer review: the showcase looks polished in Chromium and degrades cleanly in Firefox/Safari.
