---
id: 030
title: Cross-browser refraction via filter-on-copy (in-place + refract node)
status: blocked
blocked-by: [022, 023]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-30
---

## Requirements

The opt-in displacement shipped in plan 023 bends the LIVE backdrop via
`backdrop-filter: url(#…)`, which is Blink-only (Chrome/Edge) — Firefox and
Safari silently get the frosted base. That means our headline refraction does
not render consistently across the three web browsers the project targets.

There is a web-platform path we missed: a plain `filter: url(#displacement)` on
a REGULAR element (not `backdrop-filter`) DOES run the SVG displacement filter in
Chrome, Safari, AND Firefox. The catch is it refracts the element's own pixels —
so to get cross-browser refraction you bend a COPY of the content rather than the
live page behind the glass. The interactive `children` render crisp on top of the
refracted copy, so text stays selectable and links stay clickable.

This plan adds that cross-browser refraction as the displacement path that works
everywhere on web, in two modes:

- **In-place** — the glass refracts its OWN `children` (a hero, a card, a
  control bar's own surface) via an element `filter`, driven by `size` + `center`
  geometry. No copy to manage.
- **`refract={node}`** — float a lens over content it doesn't own: clone the
  referenced node, apply the element `filter` to the clone, fill the bleed with
  `behind`, and render crisp `children` on top.

Native (Expo) is unaffected — it has no SVG filters and stays frosted (the
`displacement`/`refract`/`size`/`center` props remain documented no-ops there).

**Acceptance criteria:**

- [ ] With the cross-browser refraction opted in, the refracted layer carries
      `filter: url(#…)` (element filter), NOT `backdrop-filter: url(…)`, and the
      displacement renders in Chromium, Firefox, AND WebKit (verified via e2e on
      all three).
- [ ] In-place mode: a `<LiquidGlass>` given geometry (`size` + `center`)
      refracts its own children through the element filter; the crisp content
      layer (selectable text, clickable controls) stays a non-filtered sibling on
      top — the existing content-isolation invariant holds.
- [ ] `refract={node}` mode: the glass clones the referenced node, filters the
      clone, fills bleed with `behind`, and renders crisp `children` on top. The
      clone stays visually in sync with its source on layout/resize.
- [ ] New props (`refract`, `size`, `center`, `behind`) are added to the shared
      prop contract as OPTIONAL and additive; omitting them leaves 023's behavior
      (frosted default; Chrome-only backdrop bend if `displacement` set)
      byte-for-byte unchanged.
- [ ] The displacement MAP is the existing `src/displacement.ts` generator,
      reused as-is (fed into `feImage`/`feDisplacementMap`); only the filter
      APPLICATION moves from `backdrop-filter` to element `filter`.
- [ ] Native render is unchanged: the new props are no-ops on
      `liquid-glass.native.tsx` (frosted).

## Design

The mechanism difference from 023 is ONE thing: where the SVG filter is applied.
023 puts `url(#id)` in `backdrop-filter` (Chrome-only, bends the live page).
This plan puts `url(#id)` in the element's own `filter` on a layer that holds a
COPY of the content (cross-browser, bends the copy). Both use the same generated
displacement map and the same `<filter>` primitive chain.

```
  023 (Chrome-only, live page):     030 (cross-browser, a copy):
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ surface                 │       │ refracted COPY layer     │
  │  backdrop-filter:       │       │  filter: url(#disp)      │  ← works in
  │    url(#disp) ← Blink   │       │  (children OR cloned     │     FF/Safari/
  │    only                 │       │   node, filtered)        │     Chrome
  ├─────────────────────────┤       ├─────────────────────────┤
  │ crisp children (sibling)│       │ crisp children (sibling, │
  └─────────────────────────┘       │   on top, unfiltered)    │
                                     └─────────────────────────┘
```

Layer isolation is the hard invariant (same as the existing component): the
filtered copy is a SIBLING behind the crisp content layer, never an ancestor of
`children`, so the warp never touches the real interactive content.

The relationship between 023's backdrop bend and this copy refraction is settled
(eng-review decision): KEEP BOTH. They bend different things — the backdrop path
bends the actual live page behind the glass (Chrome-only, zero copy); copy
refraction bends a copy of content (cross-browser). They compose; neither
replaces the other. The implementation risk to watch is the `refract={node}`
clone staying in sync with its source (layout/resize/content mutation) — that is
the one genuinely hard part of this plan; in-place mode (own children) is lower
risk and is the must-have, `refract={node}` is the richer mode on top.

This is an independent reimplementation of a known technique (element `filter`
over a copied/own node), informed by `SamaSante/Liquid-Glass`. Do NOT copy their
source; check that repo's LICENSE before borrowing any code verbatim.

**Files expected to change:**

- `src/liquid-glass.tsx`: add the element-`filter` copy-refraction render path
  (in-place + `refract` clone); keep the 023 backdrop path.
- `src/types.ts`: add `refract`, `size`, `center`, `behind` as optional props on
  the relevant contract (web; native no-ops).
- `src/liquid-glass.test.tsx`: assert element `filter` (not `backdrop-filter`) on
  the refracted layer; assert content-isolation holds.
- `e2e/`: a cross-browser refraction spec proving `filter: url(` renders on
  chromium + firefox + webkit.
- `src/liquid-glass.stories.tsx`: a story demoing in-place + `refract` modes.

**Out of scope:** The WebGL-over-`<video>`/`<canvas>` path (Safari refuses SVG
filters on those surfaces — SamaSante uses a GPU shader; defer to a future plan).
Displacement-map generator upgrades (chromatic aberration tuning, specular-in-B,
lens masking — optional polish, separate plan). Any native/RN refraction (stays
frosted). Replacing the 023 backdrop path (kept unless eng review consolidates).

Testing approach: browser-based

## Tasks

1. Add the element-`filter` refracted-copy layer to `liquid-glass.tsx`
   (in-place: filter own children-copy via `size`/`center`), keeping the crisp
   content layer a non-filtered sibling on top.
2. Add `refract={node}` mode: clone the referenced node, filter the clone, fill
   bleed with `behind`, keep it in sync on layout/resize.
3. Add `refract`/`size`/`center`/`behind` optional props to `types.ts`; wire
   native no-ops.
4. Unit tests: refracted layer uses `filter: url(`, not `backdrop-filter`;
   content isolation holds; props default to today's behavior.
5. Cross-browser e2e: refraction renders on chromium + firefox + webkit; add a
   Storybook story for both modes.
6. Run `pnpm test` + `pnpm e2e`; confirm green on all three engines.

## Verification

- [cmd] `pnpm typecheck`
- [cmd] `pnpm test`
- [cmd] `pnpm e2e`
- [assert] `grep -nE "refract|filter:.*url\\(|element.?filter" src/liquid-glass.tsx` outputs a match
- [browse] `/?path=/story/components-liquidglass--refract` verify the glass visibly refracts its content on the current browser (run in Firefox/Safari to confirm cross-browser)
