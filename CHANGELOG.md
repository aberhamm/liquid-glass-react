# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.2.1] - 2026-07-06

Polish fixes to the prebuilt components. No API or default-look changes.

### Version bump

`0.2.0` → **`0.2.1`** — a **patch** bump. Bug fixes only.

### Fixed

- **`GlassSegmentedControl` indicator alignment.** The sliding glass indicator
  double-counted the track's left padding, so its left gap was larger than the
  top/bottom gap and the last option's indicator overflowed the track's right
  edge. The indicator now measures its offset from the track's content box, so it
  aligns evenly on every option.
- **`GlassButton` press-shine.** The on-press highlight rendered as a sharp
  rectangle confined to the text — its `border-radius: inherit` resolved to `0`
  because the glass content wrapper carried no radius. The content wrapper now
  carries the glass corners, and the button shell fills the pill (padding moved
  off the glass wrapper), so the shine clips to the rounded shape and sweeps the
  whole surface. As a side effect the entire pill is now the click target
  (previously only the label was).

<!-- commits: 7c57ec5, a9e8513 -->

## [0.2.0] - 2026-07-01

Cross-browser + Expo round. **This changes the default web look** (see Breaking),
and adds a React Native / Expo render target from the same install.

### Version bump

`0.1.0` → **`0.2.0`** — a **minor** bump. The default render changed
(Chromium refraction → portable frosted), which is a breaking *default-look*
change; but the package is pre-1.0 (`0.x`), so per SemVer a breaking change is
expressed as a **minor** bump rather than a major.

### Breaking

- **Frosted is now the default web look (was Chromium refraction).** The default
  `<LiquidGlass>` render is the portable frosted `backdrop-filter` surface in every
  engine — Chrome, Safari/WebKit, and Firefox — instead of live-backdrop
  refraction in Chromium. **To restore the old look, add the `displacement` prop.**
  Box geometry is unchanged, so layout never shifts.

### Added

- **Opt-in `displacement` (Chromium live-backdrop refraction).** Pass
  `displacement` to bend the **live page** behind the glass via
  `backdrop-filter: url()`. Chromium-only; Firefox and Safari/WebKit silently fall
  back to the frosted surface.
- **Cross-browser refraction (`refract` / `size` / `center` / `behind`).** A new
  path applies the SVG displacement as an element `filter: url()` on a **copy** of
  content, so a real refractive lens renders in Chrome, Safari **and** Firefox. Use
  `size`/`center` to refract a copy of the glass's own children in place, or
  `refract={node}` to float a lens over foreign content (`behind` fills the bleed).
  Distinct from `displacement`, and the two compose.
- **Expo / React Native support.** The same `<LiquidGlass>` import resolves to a
  native (`expo-blur`) frosted build under Metro via the `react-native` export
  condition. New **optional** peer deps `expo-blur` and `expo-linear-gradient`
  (plus `react-native`), all marked `optional` in `peerDependenciesMeta`, so
  web-only consumers never install them. `displacement`/`refract`/`size`/`center`/
  `behind` and the other web-only props are documented no-ops on native; the native
  primitive uses `onPress` and `style?: ViewStyle`. iOS is the quality bar; Android
  is best-effort.

### Notes

- The prebuilt `GlassButton`, `GlassCard`, and `GlassSegmentedControl` are
  **web-only this round** — they are not part of the native barrel
  (`src/index.native.ts`).
- README gains Web usage, Expo / React Native, and a "What works where" support
  matrix, plus API-reference entries for `displacement`/`refract`/`size`/`center`/
  `behind`.

<!-- commits: e0deb1a, 6c0bf86, 49259d0, 2048d70, 9bc5793, 2b946ce, 92ace23, 8ba10b9, 9402117, 330872f, 4da39a3 -->

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
