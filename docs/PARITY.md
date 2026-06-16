# Parity & behavior spec

`@aberhamm/liquid-glass-react` is an **independent reimplementation** — not a
fork — of the liquid-glass effect popularized by
[`rdev/liquid-glass-react`](https://github.com/rdev/liquid-glass-react). This
document is the contract for what we match, how the effect degrades per browser,
and what we explicitly do not attempt.

## Supported props (mapped to upstream)

These props on the `<LiquidGlass>` primitive mirror upstream semantics. Defaults
are the contract documented in `src/types.ts`.

| Prop                  | Type                                            | Default       | Upstream equivalent | Notes |
| --------------------- | ----------------------------------------------- | ------------- | ------------------- | ----- |
| `children`            | `ReactNode`                                     | —             | `children`          | Content rendered inside the glass. |
| `displacementScale`   | `number`                                        | `70`          | `displacementScale` | Strength of refraction distortion. |
| `blurAmount`          | `number`                                        | `0.0625`      | `blurAmount`        | Backdrop blur radius. |
| `saturation`          | `number`                                        | `140`         | `saturation`        | Backdrop saturation multiplier. |
| `aberrationIntensity` | `number`                                        | `2`           | `aberrationIntensity` | Chromatic aberration at edges. |
| `elasticity`          | `number`                                        | `0.15`        | `elasticity`        | Pointer-follow softness. |
| `cornerRadius`        | `number \| string`                              | `999`         | `cornerRadius`      | Number = px; string = CSS length. |
| `padding`             | `number \| string`                              | `'24px'`      | `padding`           | Number = px; string = CSS shorthand. |
| `overLight`           | `boolean`                                       | `false`       | `overLight`         | Tunes tint for light backgrounds. |
| `mode`                | `DisplacementMode`                              | `'standard'`  | `mode`              | `standard \| polar \| prominent \| shader \| turbulence`. |
| `className`           | `string`                                        | —             | `className`         | Applied to the outer element. |
| `style`               | `CSSProperties`                                 | —             | `style`             | Merged onto the outer element. |
| `onClick`             | `MouseEventHandler<HTMLDivElement>`             | —             | `onClick`           | Forwarded to the surface. |
| `globalMousePos`      | `MousePos`                                       | uncontrolled  | `globalMousePos`    | Controlled global pointer position. |
| `mouseOffset`         | `MousePos`                                       | uncontrolled  | `mouseOffset`       | Controlled offset from center. |
| `mouseContainer`      | `RefObject<HTMLElement \| null> \| HTMLElement \| null` | `null` (viewport) | `mouseContainer` | Coordinate-space container for tracking. |

The prebuilt components (`GlassButton`/`GlassCard` in plan 007,
`GlassSegmentedControl` in plan 012) extend these shared types; their own full
prop surfaces are frozen in their respective plans, not here.

## Expected behavior per browser

The single runtime gate is `GlassCapabilities.canRefract`, derived as
`supportsBackdropFilter && supportsSvgBackdropDisplacement`, where
`supportsSvgBackdropDisplacement` comes from **positive Blink-family detection**
(`isChromium`). See "Capability detection" below.

| Engine            | `isChromium` | `canRefract` | Rendered behavior |
| ----------------- | ------------ | ------------ | ----------------- |
| Chromium (Chrome, Edge, Brave, Opera) | `true`  | `true`  | **Full effect** — SVG `feDisplacementMap` refraction composited over `backdrop-filter`, blur, saturation, chromatic aberration, elastic motion. |
| Safari / WebKit   | `false`      | `false`      | **Degraded** — supports `-webkit-backdrop-filter` (blur/saturation render), but does NOT composite the SVG displacement filter over the backdrop, so no refraction. Falls back to a non-refractive frosted surface. |
| Firefox / Gecko   | `false`      | `false`      | **Degraded** — no SVG-backdrop-displacement compositing; falls back to a non-refractive frosted surface. |
| SSR / pre-mount   | `false`      | `false`      | **Degraded (conservative)** — all capabilities `false` until the client mount effect re-evaluates, avoiding hydration mismatch. |

"Degraded" surfaces are defined by the fallback plan (006); this plan only fixes
the gate that selects between full and degraded tiers.

## Capability detection

`detectGlassCapabilities()` (in `src/capabilities.ts`) probes:

- **`supportsBackdropFilter`** — `CSS.supports('backdrop-filter','blur(1px)')`
  OR the `-webkit-` prefixed variant.
- **`isFirefox`** — `Firefox` token in the user agent.
- **`isChromium`** — positive match on `Chrome|Chromium|Edg|OPR`, AND not
  Firefox. Safari has no `Chrome` token, so it never matches. Brave is covered
  by the `Chrome` token (it ships a vanilla-Chrome UA), so no literal `Brave`
  alternative is needed.
- **`supportsSvgBackdropDisplacement`** — derived as `isChromium` (see below).
- **`prefersReducedMotion`** — `matchMedia('(prefers-reduced-motion: reduce)')`.
- **`canRefract`** — `supportsBackdropFilter && supportsSvgBackdropDisplacement`.

### Why `supportsSvgBackdropDisplacement = isChromium` (positive gate)

There is **no standardized `CSS.supports` probe** for "an SVG `feDisplacementMap`
applied via `filter:` composites correctly over `backdrop-filter`" — it is a
Chromium rendering-pipeline quirk, not a CSS feature. A naive negative inference
(`supportsBackdropFilter && !isFirefox`) is **wrong**: Safari/WebKit supports
`-webkit-backdrop-filter` and is not Firefox, so it would be wrongly admitted to
the full-effect tier even though it cannot composite the displacement filter.
Using positive Blink detection keeps Safari and Firefox in the degraded tier by
construction.

This relies on **user-agent sniffing**, which is inherently fragile (UA strings
change; reduced/frozen UAs and embedded webviews can misreport). It is a known,
**revisitable assumption** — if/when a reliable feature probe exists, replace the
UA heuristic with it.

## Non-goals

This library deliberately does **not** attempt:

- **No WebGL / canvas pixel pipeline.** The effect is pure CSS + SVG filters.
  There is no GPU shader runtime, no offscreen canvas displacement.
- **No pixel-perfect match to upstream.** We match the *prop surface and intent*
  of `rdev/liquid-glass-react`, not exact pixel output. Displacement maps,
  easing curves, and default tuning may differ.
- **No effort to force refraction in non-Chromium engines.** Safari and Firefox
  intentionally receive a degraded, non-refractive surface rather than a
  best-effort approximation.
- **No polyfilling of `backdrop-filter`.** Browsers without it get the degraded
  surface.
- **No promise of UA-sniffing robustness.** The Chromium gate is a pragmatic
  heuristic, explicitly flagged above as revisitable, not a guarantee.
