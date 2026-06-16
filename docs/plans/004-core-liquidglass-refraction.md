---
id: 004
title: Core <LiquidGlass> refraction component
status: in-progress
blocked-by: [002, 003]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

This is the headline component: a `<LiquidGlass>` wrapper that renders the
Chromium "liquid glass" refraction by layering an SVG `feDisplacementMap` filter
over a `backdrop-filter`. It consumes the prop API from 002 and displacement maps
from 003. It must be gate-aware from the start — it reads `canRefract` from the
capability module and only attaches the SVG filter when refraction is supported
(the actual fallback markup is built in 006; here, when unsupported, it simply
omits the filter so nothing breaks). The "user" is a developer wrapping content:
`<LiquidGlass mode="standard"><button>Buy</button></LiquidGlass>` and seeing the
backdrop refract at the glass edges in Chrome.

**Acceptance criteria:**

- [ ] `src/liquid-glass.tsx` exports `<LiquidGlass>` implementing every prop in
      `LiquidGlassProps` (002), with documented defaults matching the parity spec
      (`displacementScale: 70`, `blurAmount: 0.0625`, `saturation: 140`,
      `aberrationIntensity: 2`, `cornerRadius: 999`, `mode: 'standard'`,
      `overLight: false`, `padding: '24px 32px'`, `elasticity: 0.15`).
- [ ] A `GlassFilter` renders an inline `<svg><filter>` with a unique id per
      instance, using `feImage` (the displacement map), `feDisplacementMap` with
      `xChannelSelector="R" yChannelSelector="B"`, three channel passes for
      chromatic aberration (R/G/B at offset scales driven by `aberrationIntensity`),
      a radial edge mask so refraction appears only at the rim, and a small
      `feGaussianBlur`.
- [ ] `mode="turbulence"` takes a procedural path: the filter source is
      `feTurbulence` (`type="fractalNoise"`, low `baseFrequency`) → `feGaussianBlur`
      → `feDisplacementMap`, instead of `feImage`. No data-URL / canvas involved.
      This yields a frosted/rippled warp (a distinct aesthetic from the lens-edge
      SDF modes) and is the lightest-weight mode. The `displacementScale` and
      `aberration` controls still apply; `feTurbulence` `baseFrequency` defaults to
      ~`0.015` (tunable) and is independent of `displacementScale`.
- [ ] Element measurement is REQUIRED, not optional (eng-review 2026-06-13,
      Codex outside-voice): the component measures its own rendered size via a ref +
      `ResizeObserver` (rAF-throttled, dimensions quantized per 003's grid), and those
      measured dims feed BOTH `getDisplacementMap(mode, w, h)` AND the SVG filter
      region. Until measured (SSR + first client paint) it uses a safe default and
      attaches no filter — so there is never a guessed/stale/zero-dimension map. This
      is the committed source of truth for size; the `objectBoundingBox` discussion
      below remains a separate, optional coordinate-space refinement.
- [ ] The glass surface applies `backdrop-filter: blur(...) saturate(...)` derived
      from `blurAmount`/`saturation`/`overLight`, plus `filter: url(#id)` ONLY
      when `canRefract` is true.
- [ ] `overLight` halves `displacementScale` and adjusts blur, per parity spec.
- [ ] `className`, `style`, `padding`, `cornerRadius`, and `onClick` are honored.
- [ ] Content isolation: `children` render in a dedicated content layer that sits
      ABOVE the glass surface and is NEVER inside the filtered/displaced node — the
      `feDisplacementMap` warps only the backdrop, so labels/content stay crisp
      over the rippled glass. A render test asserts the children node is not a
      descendant of the element carrying `filter: url(#id)`.
- [ ] Unit tests assert prop→style/attribute mapping: filter present when
      `canRefract` mocked true and absent when false; correct channel selectors;
      aberration offsets scale with `aberrationIntensity`; backdrop-filter string
      reflects blur/saturation/overLight; and (eng-review 2026-06-13) `overLight`
      true HALVES the effective `displacementScale` versus `overLight` false — assert
      the halving explicitly, not just the blur change.

## Design

The SVG filter is the load-bearing trick. Encode R→X, B→Y to match the maps from
003. **Filter coordinate space — committed default + optional size-independence:**
the committed default is `primitiveUnits="userSpaceOnUse"` (pixel space), where the
public `displacementScale` (default `70`) is the literal `feDisplacementMap scale`
in px — this is upstream-proven and unambiguous. Size-independence via
`primitiveUnits="objectBoundingBox"` is an OPTIONAL refinement, NOT the default,
because objectBoundingBox `scale` is a 0–1 fraction of the box: adopting it
requires mapping `objectBoundingBoxScale = displacementScale / Math.min(measuredWidth,
measuredHeight)` (measured via a ref/ResizeObserver), which re-introduces a
measurement. Implement the pixel default first; only pursue objectBoundingBox if a
spike shows it renders identically AND the measurement cost is acceptable. Do not
ship a bare `scale="70"` under objectBoundingBox — that is the bug this note prevents. Chromatic aberration = run `feDisplacementMap` per RGB channel at slightly
different scales, isolate each channel via `feColorMatrix` (zero out the other
two channels per pass), then recombine. **Recombination must not blow out to
white:** because each pass is isolated to a single channel, sum them with
`feComposite operator="arithmetic" k2=1 k3=1` (additive, no clamping surprise)
rather than naive `feBlend mode="screen"` on full-color copies, which
over-brightens. The edge mask (radial gradient + `feComponentTransfer`) confines
the warp to the rim. Filter id must be unique per mounted instance (use
`useId()`) so multiple glasses on a page don't collide. **Sanitize the id**
(eng-review 2026-06-13): `useId()` returns colon-wrapped strings like `:r0:`;
colons are invalid in CSS selectors and a long-standing SVG-filter footgun. Derive
the filter id as `` `lg-${useId().replace(/:/g, '')}` `` so it is safe for
`filter: url(#id)`, `getElementById`, AND `querySelector('#id')` — never reference
the raw colon-bearing id, and tests may query by `#id` safely.

**Application mechanism — committed default flipped (eng-review 2026-06-13, Codex
outside-voice):** two ways to apply the filter exist. (b) **The committed default:**
reference the SVG filter directly via `backdrop-filter: url(#id) blur() saturate()`
(no separate foreground-filtered span). This is the MDN-documented path for applying
an SVG filter to the backdrop and is what the shuding reference implementation uses.
(a) **Fallback:** a backdrop `<span>` with `backdrop-filter: blur() saturate()` PLUS a
foreground `filter: url(#id)`. (a) is now the FALLBACK, not the default, because a
foreground `filter:` establishes a backdrop-root compositing boundary that can make
the backdrop effect render incorrectly. Spike (b) early in Chromium; only fall back to
(a) if (b) demonstrably cannot carry the full `feImage`+`feDisplacementMap`+aberration
graph as a backdrop-filter value. Either way `canRefract` gates whether the filter is
attached, so the cross-browser story (006) is unchanged.

**Files expected to change:**

- `src/liquid-glass.tsx`: `<LiquidGlass>` + internal `GlassFilter`, consuming
  `useGlassCapabilities`, `getDisplacementMap`, and `LiquidGlassProps`.
- `src/liquid-glass.test.tsx`: RTL render tests with capabilities mocked both ways,
  asserting filter presence/absence, channel selectors, aberration scaling, and
  backdrop-filter composition.
- `src/index.ts`: export `LiquidGlass`.

**Testing approach:** browser-based — React component; verified via Vitest +
RTL/jsdom now (DOM/attribute assertions), and exercised in a real browser via
Storybook (009) and Playwright (010). jsdom won't paint the filter, so assertions
target the rendered DOM/attributes, not pixels.

The component is a small layer stack: a clipped glass surface (backdrop-filter +
optional `filter: url(#id)`) UNDERNEATH a separate, unfiltered content layer that
holds `children`. Never put children inside the filtered node.

**Out of scope:** elastic mouse motion, rim-lighting highlight layers, mouse
tracking (005); the visible fallback rendering for unsupported browsers (006);
prebuilt GlassButton/GlassCard (007). Keep motion props accepted-but-inert here.

## Tasks

1. Scaffold `<LiquidGlass>` with defaults and the surface element (padding,
   cornerRadius, position, style merge).
2. Build `GlassFilter` with `useId()`-based ids, `feImage` from
   `getDisplacementMap(mode,...)`, `feDisplacementMap` (R/B selectors), 3-channel
   aberration passes, radial edge mask, and `feGaussianBlur`.
3. Compose `backdrop-filter` from `blurAmount`/`saturation`/`overLight`; attach
   `filter: url(#id)` only when `canRefract`.
4. Apply `overLight` adjustments (halved displacement, blur tweak).
5. Wire `className`/`style`/`onClick`; ensure SSR render is safe (no filter until
   client capabilities resolve).
6. Write `src/liquid-glass.test.tsx`; export from `src/index.ts`; run
   typecheck/lint/test.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test -- liquid-glass 2>&1 | tail -5` contains `pass`
- [manual] In a Chromium DevTools render, confirm the backdrop visibly refracts at the glass edge (full visual check happens in 009/010).
