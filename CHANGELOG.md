# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] - 2026-06-18

Apple-tier enhancement round. Every new behavior is **additive and opt-in** —
the default render is unchanged, so upgrading is non-breaking.

### Added

- **Content-adaptive auto-tint.** Pass `adaptiveTint` and the glass samples the
  brightness behind it and automatically shifts toward a light or dark treatment
  so your content stays legible — no more hand-setting `overLight`. An explicit
  `overLight` still always wins. Defaults off.
- **Regular vs Clear variants.** A new `variant="clear"` prop renders a
  permanently more transparent surface (with a subtle dimming scrim so labels
  stay readable) for media-rich contexts; `variant="regular"` (default) is the
  fully adaptive control surface. Clear is intentionally non-adaptive.
- **Reduced-transparency support.** The glass now honors the OS "Reduce
  Transparency" setting, rendering as static frosted glass (no live refraction)
  for vision- and vestibular-sensitive visitors.
- **Increased-contrast support.** The glass now honors "Increase Contrast" with a
  solid border and a higher-contrast, less-tinted surface so edges and text stay
  clearly delineated.
- **Scroll-aware shadow.** Opt in with `scrollAwareShadow` and the drop shadow
  deepens over dense/dark content and eases over plain areas, reinforcing the
  "floating above content" look. Defaults off.
- **Backdrop-luminance API.** New `useBackdropLuminance(ref)` hook and luminance
  helpers are exported for advanced consumers who want to read the brightness
  behind an element themselves. The module is tree-shakeable and adds nothing to
  the default bundle.

### Changed

- **Specular highlight now tracks your pointer.** The rim highlight upgraded from
  a flat gradient sweep to a positioned radial hotspot that follows the cursor
  over the glass, plus a glow that blooms from the contact point on press. Pure
  CSS, works in every browser, and respects reduced-motion.
- **Storybook showcase overhaul.** The demo now floats glass over a realistic
  Photos/gallery app surface (with Draggable, ScrollUnderGlass, and CheapVsReal
  stories) in a clean system sans-serif, so the refraction effect is immediately
  convincing — and looks like real app content — when evaluating the package.

### Internal

- Cross-engine E2E now proves the elastic cursor-follow motion in WebKit/Safari,
  not just Chromium and Firefox.
- Consolidated the three media-query accessibility hooks onto a shared private
  `useMediaQuery` primitive (no public API change).

<!-- commits: 5cb44b0, c45e6ee, ce48ecc, 140dd05, 3e11128, a3e8641, 9431735, bcc0301, 38edbbb, 1117c13, e51c50f -->

## [0.1.0] - 2026-06-16

Initial release of `@aberhamm/liquid-glass-react`.

### Added

- **`<LiquidGlass>` refraction primitive.** SVG-displacement glass that bends
  light around its edges, with a rounded-rect SDF displacement-map generator
  backed by a bounded LRU cache.
- **Five refraction modes** (`standard`, `polar`, `prominent`, `shader`,
  `turbulence`) plus chromatic aberration for color-fringed edges.
- **Tiered graceful degradation.** Full refraction on Chromium, a frosted
  `backdrop-filter` fallback on Firefox/WebKit, and a solid fallback elsewhere —
  all SSR/hydration-safe.
- **Elastic cursor motion, rim lighting, and a pure-CSS bevel** for a tactile,
  cross-browser polish layer.
- **Prebuilt components:** `GlassButton`, `GlassCard`, and a `GlassSegmentedControl`
  liquid toggle, each with a `glassProps` escape hatch.
- **Public TypeScript types, SSR-safe capability detection, and a PARITY spec**
  documenting cross-browser behavior.

<!-- commits: f67b85b, 7d647dc, 8025067, 61372d2, 644a1d6, ec05fea, 3a406e5 -->
