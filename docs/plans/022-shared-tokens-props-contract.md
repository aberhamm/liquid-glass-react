---
id: 022
title: Extract shared platform-neutral design tokens + add displacement opt-in prop
status: pending
blocked-by: []
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

The library is being made cross-browser + Expo-friendly as a single package with
platform-split files (`liquid-glass.tsx` web, `liquid-glass.native.tsx` Expo).
Both targets must render the SAME base "frosted glass" look from ONE source of
truth, but today every design constant (blur mapping, tint/saturation defaults,
specular hotspot, drop-shadow layers, contrast/variant params) is embedded as a
web-local `const` inside the ~1250-line `src/liquid-glass.tsx`. A React Native
file cannot import those without dragging in DOM/CSS assumptions.

This plan creates the shared, platform-neutral foundation: a `src/tokens.ts`
holding plain-data design tokens (no `react`, no DOM, no `CSSProperties`), and
adds the `displacement` opt-in prop to the shared `LiquidGlassProps` contract so
later plans can gate the web-only SVG refraction on it. This is a pure
refactor + additive type change: the default web render must stay byte-for-byte
identical.

**Acceptance criteria:**

- [ ] `src/tokens.ts` exists and exports the shared design tokens currently
      embedded in `liquid-glass.tsx` as plain values/objects (frosted tint,
      blur-per-unit mapping, default saturation, hairline ring spec,
      drop-shadow layers + depth factors, specular/press-glow params, corner
      radius default, padding default). It imports NOTHING from `react`,
      `react-dom`, or any DOM type.
- [ ] `src/liquid-glass.tsx` imports those values from `src/tokens.ts` instead
      of redefining them locally; the produced styles are unchanged (the token
      VALUES are identical to today's constants).
- [ ] `LiquidGlassProps` in `src/types.ts` gains `displacement?: boolean`
      (optional), with TSDoc stating: web-only progressive enhancement, default
      OFF, and a documented no-op (frosted fallback) on React Native.
- [ ] The prop is OPTIONAL, so all existing consumers (stories, prebuilt
      `GlassButton`/`GlassCard`/`GlassSegmentedControl`, the `index.ts` barrel)
      still typecheck with no changes.
- [ ] `LiquidGlassProps` is split so platform-divergent props don't bind the
      shared contract to DOM types: a platform-neutral `LiquidGlassCoreProps`
      holds every platform-agnostic prop; the web `LiquidGlassProps` extends it
      with the DOM-only `style`/`onClick`/pointer props. The web type is
      byte-for-byte equivalent to today (no consumer change).
- [ ] `src/tokens.ts` defines `FROSTED_DEFAULT_FILL` and `FROSTED_HAIRLINE_RING`
      tokens for the new frosted DEFAULT look (consumed by plan 023).
- [ ] Default render is visually unchanged: all existing unit tests pass with no
      edits to their assertions, and `tsc --noEmit` is clean.

## Design

A small extraction, not a redesign. `tokens.ts` is a leaf module with zero
platform coupling so both `liquid-glass.tsx` and the future
`liquid-glass.native.tsx` can consume it. Anything that is inherently CSS (e.g.
`mixBlendMode`, `backdropFilter` strings, `box-shadow` serialization) STAYS in
the web file — only the underlying numbers/colors/structured values move to
tokens. The native file will serialize the same tokens into RN style objects.

`displacement` is added to the shared type now but NOT yet consumed by the
implementation (that is plan 023). Adding it here keeps the contract in one
place and lets 023 and 025 thread it without a second type edit. Because it is
optional and unread, behavior is unchanged.

**Files expected to change:**

- `src/tokens.ts`: NEW. Platform-neutral design-token module.
- `src/liquid-glass.tsx`: replace local design constants with imports from
  `./tokens`; no value changes.
- `src/types.ts`: add `displacement?: boolean` to `LiquidGlassProps` with TSDoc.
- `src/index.ts`: do NOT re-export the tokens (eng-review decision: keep tokens
  INTERNAL pre-1.0 until the native target validates the shape; exposing later
  is additive/non-breaking). The native barrel (025) may import tokens directly
  from `./tokens` without them being public package API.

**Platform-neutral prop contract (doctor):** `LiquidGlassProps` today types
`style?: CSSProperties` and `onClick?: MouseEventHandler<HTMLDivElement>` — DOM
types React Native cannot honor. Split the contract so ONE shared base feeds
both platforms without leaking DOM types: introduce `LiquidGlassCoreProps` with
every platform-agnostic prop (`children`, `displacement`, `displacementScale`,
`blurAmount`, `saturation`, `aberrationIntensity`, `elasticity`, `cornerRadius`,
`padding`, `overLight`, `adaptiveTint`, `scrollAwareShadow`, `variant`, `mode`,
`className`). Then `LiquidGlassProps = LiquidGlassCoreProps & { style?:
CSSProperties; onClick?: MouseEventHandler<HTMLDivElement>; globalMousePos?;
mouseOffset?; mouseContainer? }` — the web surface is unchanged. The native
barrel (025) defines its own `style?: ViewStyle` / `onPress?` over
`LiquidGlassCoreProps`, so native never sees DOM types. `displacement` lives on
the core (shared), documented web-only / native no-op.

**Frosted default tint tokens (doctor):** plan 023 needs a frosted DEFAULT fill
+ hairline ring that do NOT exist today (the only fills are the a11y
`REDUCED_TRANSPARENCY_FILL` / contrast fills — different intent). Define them
HERE as named tokens so 023 consumes a fixed value rather than inventing one
(which would break the committed pixel baseline): `FROSTED_DEFAULT_FILL` (white
tint ≈ `rgba(255, 255, 255, 0.10)`, the Video.js `oklch(1 0 0 / 0.1)`
equivalent) and `FROSTED_HAIRLINE_RING` (~1px inset ring color + width). The
values are the contract; 023 only wires them onto the surface.

**Out of scope:** Any behavior change to refraction/frosted rendering (that is
023 — 022 only DEFINES the frosted tokens, it does not apply them). Making
displacement opt-in (023). Creating the native file (025). Do NOT move
CSS-string-shaped helpers (`composeBackdropFilter`, `buildDropShadow`'s
serialization) — only the underlying data they consume.

Testing approach: unit-only

## Tasks

1. Create `src/tokens.ts` and move the plain-data design constants out of
   `liquid-glass.tsx` (DEFAULTS, BLUR_PX_PER_UNIT, SHADOW_LAYERS,
   SCROLL_SHADOW_DEPTH, specular/press-glow params, variant params, contrast
   fills/colors) as exported values. Keep names stable.
2. Re-import those values in `liquid-glass.tsx`; delete the now-duplicated local
   consts. Confirm produced style values are identical.
3. Split the prop contract: extract `LiquidGlassCoreProps` (platform-neutral)
   and redefine the web `LiquidGlassProps` as `LiquidGlassCoreProps & { DOM
   props }`. Add `displacement?: boolean` to the CORE with TSDoc (web-only,
   default OFF, no-op/frosted on native). Confirm web consumers still compile.
4. Add `FROSTED_DEFAULT_FILL` + `FROSTED_HAIRLINE_RING` to `tokens.ts` (values
   per Design; not yet applied to any surface).
5. Run typecheck + full unit suite; confirm zero behavior diff. (Do NOT export
   tokens from `index.ts` — eng-review decision, kept internal.)

## Verification

- [cmd] `pnpm typecheck`
- [cmd] `pnpm test`
- [assert] `grep -n "displacement?: boolean" src/types.ts` outputs a match
- [assert] `grep -nE "LiquidGlassCoreProps" src/types.ts` outputs a match
- [assert] `grep -nE "FROSTED_DEFAULT_FILL|FROSTED_HAIRLINE_RING" src/tokens.ts` outputs matches
- [assert] `grep -cE "from 'react'|from \"react\"|react-dom" src/tokens.ts` outputs `0`
- [cmd] `node -e "const t=require('node:fs').readFileSync('src/tokens.ts','utf8'); if(/CSSProperties|document|window\./.test(t)) process.exit(1)"`
