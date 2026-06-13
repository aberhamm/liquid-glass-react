---
id: 004
title: Core <LiquidGlass> refraction component
status: pending
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
      `aberration` controls still apply.
- [ ] The glass surface applies `backdrop-filter: blur(...) saturate(...)` derived
      from `blurAmount`/`saturation`/`overLight`, plus `filter: url(#id)` ONLY
      when `canRefract` is true.
- [ ] `overLight` halves `displacementScale` and adjusts blur, per parity spec.
- [ ] `className`, `style`, `padding`, `cornerRadius`, and `onClick` are honored.
- [ ] Unit tests assert prop→style/attribute mapping: filter present when
      `canRefract` mocked true and absent when false; correct channel selectors;
      aberration offsets scale with `aberrationIntensity`; backdrop-filter string
      reflects blur/saturation/overLight.

## Design

The SVG filter is the load-bearing trick. Encode R→X, B→Y to match the maps from
003. Chromatic aberration = run `feDisplacementMap` per RGB channel at slightly
different scales, isolate each channel via `feColorMatrix` (zero out the other
two channels per pass), then recombine. **Recombination must not blow out to
white:** because each pass is isolated to a single channel, sum them with
`feComposite operator="arithmetic" k2=1 k3=1` (additive, no clamping surprise)
rather than naive `feBlend mode="screen"` on full-color copies, which
over-brightens. The edge mask (radial gradient + `feComponentTransfer`) confines
the warp to the rim. Filter id must be unique per mounted instance (use
`useId()`) so multiple glasses on a page don't collide.

**Application mechanism — spike, then pick one:** two ways to apply the filter
exist. (a) Our default: a backdrop `<span>` with `backdrop-filter: blur()
saturate()` PLUS `filter: url(#id)`. (b) Reference the SVG filter directly in
`backdrop-filter: url(#id)` (no separate span). (b) is cleaner when it works but
has the same Chromium-only constraint and slightly different support edges.
Spike both early in Chromium; keep (a) as the safe default unless (b) renders
identically. Either way `canRefract` gates whether the filter is attached, so the
cross-browser story (006) is unchanged.

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
