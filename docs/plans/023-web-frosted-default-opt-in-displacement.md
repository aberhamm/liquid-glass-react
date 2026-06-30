---
id: 023
title: Make frosted glass the web default and SVG displacement opt-in
status: blocked
blocked-by: [022]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

Today `<LiquidGlass>` defaults to the headline SVG `feDisplacementMap`
refraction on Chromium (TIER 1). That effect does not port: Firefox never
applies it to `backdrop-filter`, and React Native has no SVG/backdrop pipeline
at all. To get a look that is identical across Chrome/Safari/Firefox (and that
maps cleanly to the native target), the DEFAULT must become the portable
frosted-glass recipe — white tint + backdrop blur + saturate + 1px hairline ring
+ soft drop shadow (the Video.js v10 control-bar recipe) — with the portable
liquid character (specular hotspot, rim-light, bevel) that already renders in
every engine. SVG displacement becomes an OPT-IN, web-only enhancement gated on
the new `displacement` prop (plan 022), still using the existing Chrome
blur+saturate-in-SVG fix when enabled.

This plan also OWNS the breaking-change fallout: the unit tests and the two e2e
specs that assert refraction-by-default, plus the committed Chromium pixel
baseline, all currently encode "default == refracting" and will go red the
moment the default flips. They must be updated in lockstep so the suite stays
green.

**Acceptance criteria:**

- [ ] With DEFAULT props on Chromium, the surface's `backdrop-filter` does NOT
      contain `url(` (no SVG refraction) and renders the frosted recipe: a white
      tint fill, `blur()` + `saturate()`, a ~1px hairline ring, and the soft
      drop shadow — values sourced from `src/tokens.ts`.
- [ ] With `displacement` set to `true` on Chromium, the surface attaches
      `url(#…)` and the inline `<filter>` exactly as today, and the existing
      Chrome fix (blur+saturate folded INTO the SVG filter) is preserved when it
      is active.
- [ ] On Firefox/WebKit the default and `displacement`-on renders are both the
      frosted base (never `url(`), i.e. `displacement` is a silent no-op where
      unsupported — graceful fallback.
- [ ] The portable highlights (specular hotspot, rim-light border, bevel, drop
      shadow) still render on every tier, unchanged.
- [ ] `src/liquid-glass.test.tsx` is updated so its refraction assertions are
      gated behind `displacement` and the default-frosted behavior is asserted;
      full unit suite passes.
- [ ] A NAMED displacement-enabled story exists (e.g. `DisplacementShowcase`,
      or the Playground accepting `displacement` via URL args) that the e2e
      specs target for the "url( present" assertions.
- [ ] `e2e/refraction.spec.ts` is updated in FULL: (a) the Chromium `url(`
      assertion and (b) the pixel-diff baseline test point at the
      displacement-enabled story; AND (c) the **Modes smoke tests** (the
      `waitForFilterAttached()` cases driving Playground with
      `args=mode:shader` / `args=mode:turbulence`, ~lines 149–248) are updated
      to ALSO enable displacement (e.g. append `&args=displacement:true`), since
      a mode arg alone no longer attaches the filter. Do NOT "fix" them by
      turning displacement on in the Playground default — that would revert this
      plan's intent.
- [ ] `e2e/a11y.spec.ts` is updated in FULL: the control test ("WITHOUT
      reduce-transparency the url( refraction is present", ~line 95) enables
      displacement; AND the "reduce-transparency drops url(" test (~lines 46–90)
      targets the displacement-enabled story so it still meaningfully asserts
      "url( present → dropped under reduce" rather than passing vacuously
      (Showcase is frosted/no-url by default now).
- [ ] Pixel baselines pin BOTH looks (eng-review decision): the committed
      Chromium baseline
      `e2e/refraction.spec.ts-snapshots/showcase-glass-chromium-chromium-darwin.png`
      is regenerated for the new frosted default (the common case), AND a
      separate displacement-on Chromium pixel baseline is added so refraction
      visual regressions stay covered. (028 owns the cross-browser frosted
      parity baselines; 023 owns these two Chromium pins.)
- [ ] The frosted tint + hairline come from the `FROSTED_DEFAULT_FILL` /
      `FROSTED_HAIRLINE_RING` tokens (plan 022) — no invented values.
- [ ] `pnpm e2e` is green across chromium, firefox, and webkit.

## Design

The 3-tier model stays; only the DEFAULT path through it changes. The frosted
recipe becomes the always-on base on tiers 1–2 (add the white tint fill +
hairline ring that the current code omits on tiers 1/2). `displacement` becomes
the gate that, when true AND `canRefract` AND measured AND not
reduced-transparency, attaches the SVG `<filter>` and emits `url(#id)` (folding
blur+saturate into the filter, as today). When `displacement` is false/unset,
`filterActive` is false and the CSS `blur()/saturate()` path runs — exactly the
existing TIER-2 frosted code, now also used on Chromium by default.

The hairline ring is an inset `box-shadow` PREPENDED to the existing bevel
(geometry unchanged, same pattern as the contrast border), and the tint is the
frosted token fill applied on tiers 1/2 (today they have no fill). Source both
from `tokens.ts`.

e2e specs that assume default refraction on Chromium and must be retargeted to
the displacement-enabled story (the worker MUST update every one of these or the
suite goes red / vacuous — they were enumerated by plan-doctor against the real
spec files):
- `refraction.spec.ts`: the Chromium `url(` test (~line 50), the pixel-diff
  baseline test (~lines 78–112), AND the Modes smoke tests (~lines 149–248,
  `waitForFilterAttached()` on `args=mode:shader`/`mode:turbulence` — these now
  also need `displacement` enabled).
- `a11y.spec.ts`: the control test (~line 95) AND the "reduce-transparency drops
  url(" test (~lines 46–90), which becomes a vacuous pass unless it targets the
  displacement-enabled story.

Unit-test retarget (also enumerated by plan-doctor): several `liquid-glass.test.tsx`
cases assert `url(#` / `<filter>` under default props with `canRefract` true
(e.g. the content-isolation test asserting `surface.style.backdropFilter` matches
`/url\(#/`). Each must either render with `displacement` enabled or assert the
new frosted default — gate them on `displacement`, do not delete the coverage.

**Files expected to change:**

- `src/liquid-glass.tsx`: gate SVG filter on `displacement`; add frosted tint +
  hairline ring to the default base from tokens.
- `src/liquid-glass.test.tsx`: gate refraction assertions behind `displacement`;
  assert default-frosted.
- `src/liquid-glass.stories.tsx`: ensure a story renders with `displacement`
  enabled for the e2e specs to target (and the default story stays frosted).
- `e2e/refraction.spec.ts`, `e2e/a11y.spec.ts`: retarget url( assertions.
- `e2e/refraction.spec.ts-snapshots/showcase-glass-chromium-chromium-darwin.png`:
  regenerate.

**Out of scope:** Cross-browser frosted PARITY baselines for firefox/webkit
(plan 028). Storybook demo polish for the new default (plan 027). The native
file (025). Do NOT delete the displacement code — it is now opt-in, not removed.
CROSS-BROWSER refraction (Firefox/Safari) via `filter: url()` on a copy is plan
030 — this plan's displacement opt-in stays the EXISTING Chrome-only
`backdrop-filter: url()` live-backdrop bend; 030 adds the cross-browser path on
top.

Testing approach: browser-based

## Tasks

1. In `liquid-glass.tsx`, add `displacement = false` to the destructured props
   and change `filterActive` to also require `displacement`.
2. Add the frosted tint fill + hairline-ring inset box-shadow (from the
   `FROSTED_DEFAULT_FILL` / `FROSTED_HAIRLINE_RING` tokens, plan 022) to the
   default base on tiers 1/2 so the default look matches the Video.js recipe;
   confirm geometry is unchanged.
3. Verify the opt-in path: when `displacement` is true and `canRefract`, the
   SVG `<filter>` + `url(#id)` attach and the blur+saturate-in-filter fix is
   intact.
4. Update `liquid-glass.test.tsx`: assert default has no `url(`/no `<filter>`
   and carries the frosted fill+ring; gate every existing refraction assertion
   (the `url(#`/`<filter>` cases) behind a `displacement` render.
5. Add a named `displacement`-enabled story (e.g. `DisplacementShowcase`) and
   retarget ALL the specs enumerated in Design: `refraction.spec.ts` (url(
   test + pixel-diff test + Modes smoke tests) and `a11y.spec.ts` (control test
   + reduce-transparency test).
6. Regenerate the Chromium showcase baseline (`playwright test --update-snapshots`
   for that spec) and commit the new PNG.
7. Run `pnpm test` and `pnpm e2e`; confirm green on all three browsers.

## Verification

- [cmd] `pnpm typecheck`
- [cmd] `pnpm test`
- [cmd] `pnpm e2e`
- [assert] `grep -nE "displacement" src/liquid-glass.tsx` outputs a match (prop is consumed)
- [manual] Visually confirm the default frosted look (tint + hairline + blur) and that `displacement` toggles the refraction on Chromium only.
