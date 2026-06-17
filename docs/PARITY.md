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
| `overLight`           | `boolean`                                       | `false`       | `overLight`         | Tunes tint for light backgrounds; manual override (wins over `adaptiveTint`). |
| `adaptiveTint`        | `boolean`                                       | `false`       | — (new, plan 018)   | Auto light/dark tint sampled from the backdrop (see Content-adaptive auto-tint). |
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

"Degraded" surfaces are realized by the fallback plan (006); the table above
fixes the gate that selects between full and degraded tiers, and the
"Degradation tiers" section below specifies exactly what each degraded surface
renders.

## Degradation tiers (plan 006)

When refraction can't render, `<LiquidGlass>` does NOT show an empty or broken
box — it falls back through three tiers that share **identical box geometry**
(same dimensions, `padding`, and `border-radius`), so degrading between tiers
causes **no layout shift**. Only the surface fill/filter differs.

| Tier | Selector | Surface fill | SVG `<filter>` | Rim + bevel + motion | Concretely renders on |
| ---- | -------- | ------------ | -------------- | -------------------- | --------------------- |
| **1 — full** | `canRefract` (`supportsBackdropFilter && isChromium`) | `backdrop-filter: url(#id) blur() saturate()` (+ `-webkit-` prefix) | rendered | yes | **Chromium** (Chrome, Edge, Brave, Opera) — full refraction |
| **2 — frosted (degraded)** | `supportsBackdropFilter && !canRefract` | `backdrop-filter: blur() saturate()` (+ `-webkit-` prefix), **no** `url(#id)` | NOT rendered (no orphaned `<filter>` to error or dangle) | yes | **Firefox** (frosted fallback: blur + saturate + rim + motion, no refraction); **Safari / WebKit** (frosted fallback; no SVG backdrop displacement) |
| **3 — solid (degraded)** | `!supportsBackdropFilter` | translucent **solid** background (scheme-aware `rgba(...)`, ~0.55 alpha) so content stays legible | NOT rendered | yes | **No-`backdrop-filter`** engines / very old browsers — solid translucent surface, never a transparent unreadable box |

Notes on the degraded tiers:

- The layered **inset-shadow glass bevel** (`glass-edge.ts`) is present in BOTH
  fallback tiers — it is what makes the degraded result read as glass rather than
  a plain blurred (or plain translucent) box.
- The `-webkit-backdrop-filter` prefix is emitted alongside `backdrop-filter` for
  tiers 1 and 2, so Safari/WebKit gets the frosted backdrop.
- Elastic motion and the rim/highlight blend layers are pure CSS and render in
  every tier; they are suppressed only by `prefers-reduced-motion: reduce`, in
  the full and both degraded tiers alike.
- **SSR / first paint** uses the conservative all-`false` capability snapshot, so
  the server and the first client render agree (the full effect upgrades in a
  mount effect). This is asserted by a `renderToString()` → `hydrateRoot()` test
  with a `console.error` spy that fails on any hydration-mismatch warning. No path
  emits `console.error`/`console.warn`.

## Accessibility: prefers-reduced-transparency (plan 013)

Apple's Liquid Glass honors the OS "Reduce Transparency" setting by making the
material frostier and more opaque and dropping the live lensing. We mirror that
via the `(prefers-reduced-transparency: reduce)` media query.

This is an axis **orthogonal** to the three capability tiers above — it applies
on Chromium (`canRefract`) AND on both fallback tiers, and it changes **no box
geometry** (no layout shift). The live, authoritative source is the
`useReducedTransparency()` hook (matchMedia + a `'change'` listener, SSR-safe
`false` default, reacts to a mid-session toggle); `detectGlassCapabilities()`
also surfaces a point-in-time `prefersReducedTransparency` snapshot for parity
with `prefersReducedMotion`, but it is not the reactive source.

| Setting | Live SVG refraction (`url(#id)`) | Surface fill | Blur / saturate | Rim / bevel / elastic motion | Box geometry |
| ------- | -------------------------------- | ------------ | --------------- | ---------------------------- | ------------ |
| **Reduce Transparency OFF** (default) | Tier-1 only (Chromium): attached. Byte-for-byte unchanged. | Per-tier default (none on 1/2; ~0.55 solid on tier 3). | per tier | render in every tier | unchanged |
| **Reduce Transparency ON** | **Dropped on every tier** — reuses the existing no-filter path (no SVG `url(#id)`, no `<filter>` element). | **More opaque**: ~0.75 scheme-aware fill layered over the retained blur on tiers 1/2; ~0.92 solid on tier 3. | retained (static frosted glass) | still render (they are polish, not transparency) | identical (no layout shift) |

When active, `<LiquidGlass>` forces `filterActive = false` (so the SVG `url(#id)`
is omitted exactly as on Firefox/WebKit) and raises the surface fill opacity. No
fourth capability tier is introduced. Content stays legible in all combinations,
and no path emits `console.error` / `console.warn`.

## Accessibility: prefers-contrast (plan 014)

Apple's Liquid Glass honors the OS "Increase Contrast" setting by adding a
visible border and raising fill/content contrast (macOS Tahoe even couples it to
Reduce Transparency). We mirror that via the `(prefers-contrast: more)` media
query. Contrast is the cardinal failure mode of glass UIs, so this is a hard
legibility requirement, not decoration.

This is an axis **orthogonal** to the three capability tiers AND to
reduced-transparency (013) — it applies on Chromium (`canRefract`) and on both
fallback tiers, composes with reduced-transparency (both may be active at once),
and changes **no box geometry** (no layout shift). The live, authoritative source
is the `usePrefersContrast()` hook (matchMedia + a `'change'` listener, SSR-safe
`false` default, reacts to a mid-session toggle); `detectGlassCapabilities()` also
surfaces a point-in-time `prefersContrastMore` snapshot for parity with
`prefersReducedMotion` / `prefersReducedTransparency`, but it is not the reactive
source.

| Setting | Solid border | Surface fill | Backdrop saturation | Chromatic aberration | Box geometry |
| ------- | ------------ | ------------ | ------------------- | -------------------- | ------------ |
| **Increase Contrast OFF** (default) | none (soft bevel only) | per-tier default (none on 1/2; ~0.55 solid on tier 3). Byte-for-byte unchanged. | per `saturation` prop (default 140%) | per `aberrationIntensity` prop | unchanged |
| **Increase Contrast ON** | **Solid, visible border** — a scheme-aware ~0.92-opacity ring drawn as an **inset** `box-shadow` (prepended to the bevel) so it delineates the edge without growing the box. | **More opaque**: ~0.85 scheme-aware fill on **every tier** so foreground content reads at a higher contrast ratio (less backdrop tint/show-through). | **pinned to 100%** (decorative vibrancy boost removed) | **dropped to 0** (the colored refracted edges hurt contrast) | identical (no layout shift) |

The treatment is applied entirely by the `<LiquidGlass>` primitive, so prebuilt
components (`GlassButton`, `GlassCard`, `GlassSegmentedControl`) inherit it for
free. `components.css` additionally pins the prebuilt-component foreground ink
and focus rings to fully opaque under `@media (prefers-contrast: more)` so the
focus ring stays clearly delineated on the higher-contrast surface. Content stays
legible in all combinations (including with reduced-transparency also active), and
no path emits `console.error` / `console.warn`.

## Content-adaptive auto-tint (plan 018)

Apple's Liquid Glass adapts its tint and content treatment to the brightness of
what's behind it — the core behavior absent from every other React port. The
opt-in `adaptiveTint` prop brings it to `<LiquidGlass>`: when `true` it consumes
the plan-017 luminance sampler (`useBackdropLuminance`), reads the coarse
`scheme` (`'light' | 'dark'`) of the backdrop, and maps it to an effective
`overLight`-equivalent that feeds the **existing** tint / displacement / blur
plumbing. It is **not a second tint system** — it reuses the `overLight` path so
behavior is consistent and DRY. The content foreground (e.g. button labels) flips
light↔dark with the verdict so small content stays discernible.

It is **additive and opt-in**: `adaptiveTint` defaults to `false`, so default
rendering is byte-for-byte unchanged and the sampler is never imported on the
default path (the hook lives inside an internal `<AdaptiveTintLayer>` mounted only
when `adaptiveTint` is on, so the default path runs no sampling and the rules of
hooks are respected — the hook is never called conditionally).

| Aspect | Behavior |
| ------ | -------- |
| **Precedence** | An explicit `overLight` ALWAYS wins. `adaptiveTint` only drives light/dark when `overLight` is unset: `overLight ?? (adaptiveTint && scheme ? scheme === 'light' : false)`. The manual override and the auto path never fight. |
| **SSR / hydration** | Server + first client paint render the default (unsampled) treatment; the sampled treatment is applied in a post-mount effect, so hydration never mismatches (covered by a `renderToString` → `hydrateRoot` test). |
| **Graceful degradation** | When the backdrop can't be sampled (cross-origin taint, no canvas, SSR) the reading is `sampled: false` and auto-tint falls back to `overLight ?? false` — no error, no flicker loop, no `console.error`. |
| **prefers-contrast (014)** | Increased contrast WINS on legibility: auto-tint never undercuts the high-contrast surface/border/ink treatment. |
| **Limitation** | Best-effort legibility. Critical text over unknown / cross-origin backdrops (unsampleable) should be verified manually. |

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
- **`prefersReducedTransparency`** —
  `matchMedia('(prefers-reduced-transparency: reduce)')`.
- **`prefersContrastMore`** — `matchMedia('(prefers-contrast: more)')`.
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
