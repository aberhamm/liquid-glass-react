/**
 * Platform-neutral design tokens (plan 022).
 *
 * The single source of truth for the library's plain-data design constants —
 * tint/saturation defaults, the blur-per-unit mapping, the drop-shadow layers
 * and scroll-aware depth factors, the specular/press-glow geometry, the
 * material-variant parameters, and the accessibility (reduced-transparency /
 * increased-contrast) fills. These were previously embedded as web-local
 * `const`s inside `liquid-glass.tsx`; they live here so BOTH the web file
 * (`liquid-glass.tsx`) and the future React Native file
 * (`liquid-glass.native.tsx`, plan 025) can consume ONE source of truth.
 *
 * ## Hard constraints (what may live here)
 *
 * This module is a leaf with ZERO platform coupling:
 *
 * - It imports nothing from the React renderer packages.
 * - It contains NO DOM style types and NO browser-global references.
 * - It holds only the underlying NUMBERS / COLORS / structured data. Anything
 *   inherently CSS — `mixBlendMode`, `backdrop-filter` strings, the
 *   `box-shadow` serialization (`buildDropShadow`), the `radial-gradient`
 *   templates — STAYS in the web file. The native file will serialize these
 *   same values into RN style objects.
 *
 * The only import is the platform-neutral {@link DisplacementMode} string-union
 * type (no runtime, no DOM), so {@link DEFAULTS.mode} keeps its exact type.
 *
 * @internal Not part of the public package API pre-1.0 (eng-review decision):
 * not re-exported from `index.ts`. The native barrel (plan 025) may import from
 * `./tokens` directly. Exposing publicly later is additive / non-breaking.
 */

import type { DisplacementMode } from './types';

// ---------------------------------------------------------------------------
// Defaults (parity spec — plan 004)
// ---------------------------------------------------------------------------

/** Default prop values for `<LiquidGlass>` (the parity spec). */
export const DEFAULTS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  cornerRadius: 999 as number | string,
  mode: 'standard' as DisplacementMode,
  padding: '24px 32px' as number | string,
  elasticity: 0.15,
} as const;

/**
 * Maps the small public `blurAmount` (default `0.0625`) onto a px backdrop blur.
 * The upstream convention treats `blurAmount` as a rem-ish factor; we scale by
 * 16 (1rem) so the default lands at ~1px and larger values scale linearly.
 */
export const BLUR_PX_PER_UNIT = 16;

// ---------------------------------------------------------------------------
// Accessibility fills (reduced transparency — plan 013)
// ---------------------------------------------------------------------------

/**
 * Scheme-aware translucent fill layered ON TOP of the blurred backdrop when
 * `prefers-reduced-transparency: reduce` is active and the backdrop tiers (1/2)
 * still carry a `backdrop-filter`. It frosts the surface toward opaque so the
 * material reads as static frosted glass rather than live lensing. Higher alpha
 * than the tier-3 solid fill because here it composites over a blurred backdrop,
 * not bare content. (a11y plan 013.)
 */
export const REDUCED_TRANSPARENCY_FILL = {
  light: 'rgba(255, 255, 255, 0.75)',
  dark: 'rgba(30, 30, 35, 0.75)',
} as const;

/**
 * Scheme-aware solid fill for the no-`backdrop-filter` tier (3) under reduced
 * transparency: a higher alpha than the default `0.55` solid fallback so the
 * surface is more opaque / less transparent as the setting requests.
 */
export const REDUCED_TRANSPARENCY_SOLID_FILL = {
  light: 'rgba(255, 255, 255, 0.92)',
  dark: 'rgba(30, 30, 35, 0.92)',
} as const;

// ---------------------------------------------------------------------------
// Increased-contrast tokens (a11y plan 014)
// ---------------------------------------------------------------------------

/**
 * Solid border color drawn as an INSET `box-shadow` ring on the surface so the
 * box geometry is unchanged (no layout shift) — a real `border` would grow the
 * box or eat into padding. Scheme-aware near-opaque ink/light for a clearly
 * delineated edge that the soft bevel alone cannot provide.
 */
export const CONTRAST_BORDER_COLOR = {
  light: 'rgba(0, 0, 0, 0.92)',
  dark: 'rgba(255, 255, 255, 0.92)',
} as const;

/** Inset solid-border ring width (px), prepended to the surface box-shadow. */
export const CONTRAST_BORDER_WIDTH = 2;

/**
 * More-opaque scheme-aware surface fill under increased contrast: it reduces
 * the backdrop tint/show-through so foreground content reads at a higher
 * contrast ratio. Layered over any retained blur (tiers 1/2) or used as the
 * solid fill (tier 3). At 0.92 alpha it is at least as opaque as the
 * reduced-transparency fills, so when BOTH a11y axes are active the contrast
 * fill never undercuts reduced-transparency's opacity intent — contrast wants
 * MORE opacity, not less, on every tier.
 */
export const CONTRAST_FILL = {
  light: 'rgba(255, 255, 255, 0.92)',
  dark: 'rgba(22, 22, 26, 0.92)',
} as const;

/**
 * Under increased contrast, saturation is pinned to 100% (no decorative
 * vibrancy boost) so the backdrop doesn't push color that competes with
 * foreground text. The default `saturation` (140) is decorative and harms
 * contrast, so it is overridden — never raised.
 */
export const CONTRAST_SATURATION = 100;

/**
 * Content-adaptive foreground ink (plan 018). When `adaptiveTint` is on, the
 * content layer's `color` flips with the verdict so small content (button
 * labels, captions) stays legible: DARK ink over a bright/light backdrop, LIGHT
 * ink over a dark backdrop. `color` is inheritable, so children that don't set
 * their own color pick it up; children with an explicit color keep it. Best-
 * effort legibility — see the `adaptiveTint` TSDoc limitation note.
 */
export const CONTENT_INK = {
  light: 'rgba(255, 255, 255, 0.96)',
  dark: 'rgba(17, 17, 20, 0.96)',
} as const;

// ---------------------------------------------------------------------------
// Pointer-tracked specular hotspot + glow-on-press (plan 016)
// ---------------------------------------------------------------------------

/**
 * Resting specular-hotspot center as a percentage of the surface box. With no
 * pointer over the glass (or under reduced-motion) the highlight falls back to a
 * neutral, top-biased position so the material reads like overhead light on
 * glass rather than a flat sweep. Top-center, slightly above the box.
 */
export const SPECULAR_REST_X = '50%';
export const SPECULAR_REST_Y = '0%';

/**
 * Peak opacity of the specular hotspot's bright core (the inner stop). Hover
 * brightens it slightly (see `LiquidGlass`); these are the base values.
 */
export const SPECULAR_CORE_OPACITY = { rest: 0.55, hover: 0.85 } as const;

/**
 * Radius of the specular hotspot gradient as a percentage of the surface's
 * larger dimension. Big enough to read as a soft glassy hotspot, small enough
 * that it tracks visibly rather than washing the whole surface.
 */
export const SPECULAR_RADIUS = '70%';

/**
 * Peak opacity of the press-glow bloom's core when active. The glow originates
 * at the contact point and spreads, then fades via the layer's opacity
 * transition (gated on reduced-motion).
 */
export const PRESS_GLOW_OPACITY = 0.5;

/** Radius of the press-glow bloom as a percentage of the surface box. */
export const PRESS_GLOW_RADIUS = '60%';

// ---------------------------------------------------------------------------
// Scroll-aware shadow modulation (plan 021)
// ---------------------------------------------------------------------------

/**
 * The static drop-shadow (the `static` factor of 1 reproduces today's exact
 * values) is scaled by a single multiplier per backdrop scheme. The shadow
 * DEEPENS/DARKENS over a dark backdrop (factor > 1 → larger offset/blur + darker
 * alpha, lifting the glass above dense scrolling content) and EASES/LIGHTENS over
 * a light/solid one (factor < 1). Factors are deliberately subtle so the polish
 * reads as a gentle depth shift, not a jump.
 *
 * Keys map directly to `BackdropScheme`; `static` is the SSR / first-paint /
 * unsampled fallback and equals the committed baseline shadow exactly.
 */
export const SCROLL_SHADOW_DEPTH = {
  /** Conservative fallback: byte-for-byte the existing static shadow. */
  static: 1,
  /** Dark/dense backdrop ⇒ deeper, darker shadow. */
  dark: 1.35,
  /** Light/solid backdrop ⇒ shallower, lighter shadow. */
  light: 0.7,
} as const;

/** Base outer drop-shadow layers (offsetY, blur, alpha) at rest and on hover. */
export const SHADOW_LAYERS = {
  rest: [
    { y: 8, blur: 24, alpha: 0.22 },
    { y: 1, blur: 4, alpha: 0.14 },
  ],
  hover: [
    { y: 12, blur: 32, alpha: 0.28 },
    { y: 2, blur: 8, alpha: 0.18 },
  ],
} as const;

// ---------------------------------------------------------------------------
// Material variant parameters (plan 019)
// ---------------------------------------------------------------------------

/**
 * Per-variant surface parameters (plan 019). A small parameter LOOKUP — NOT a
 * theming system — that feeds the existing surface/content styles.
 *
 * - `'regular'` is a pure pass-through: `saturationFactor = 1`, no scrim, and
 *   `forceNonAdaptive = false`, so the default render is byte-for-byte unchanged
 *   and `adaptiveTint` keeps working exactly as in plan 018.
 * - `'clear'` is permanently MORE transparent: the decorative backdrop saturation
 *   is pulled back (`saturationFactor < 1` reduces the tint/vibrancy show-through)
 *   and `forceNonAdaptive` hard-disables the adaptive sampling path. A subtle
 *   dimming scrim is rendered as a CONTENT SIBLING (see the layer stack) so labels
 *   stay legible over busy media without re-introducing adaptivity.
 */
export const VARIANT_PARAMS = {
  regular: {
    /** Multiplier on the requested `saturation` (1 = unchanged). */
    saturationFactor: 1,
    /** Force the adaptive-tint path off regardless of `adaptiveTint`. */
    forceNonAdaptive: false,
    /** Scheme-aware dimming-scrim color behind the content, or `null` for none. */
    scrim: null as { light: string; dark: string } | null,
  },
  clear: {
    // Reduce the tint/vibrancy so the material reads as clearer (more of the
    // backdrop shows through), per the Clear aesthetic.
    saturationFactor: 0.7,
    // Clear has NO adaptive behavior by definition — it never samples.
    forceNonAdaptive: true,
    // A subtle scheme-aware scrim so foreground labels stay readable over busy
    // media even though the surface itself is more transparent.
    scrim: {
      light: 'rgba(0, 0, 0, 0.18)',
      dark: 'rgba(0, 0, 0, 0.28)',
    } as { light: string; dark: string } | null,
  },
} as const;

// ---------------------------------------------------------------------------
// Frosted DEFAULT-look tokens (the contract for plan 023)
// ---------------------------------------------------------------------------

/**
 * The frosted-glass DEFAULT fill: a faint white tint that gives the surface a
 * subtle milky body even before any blur. ≈ `rgba(255, 255, 255, 0.10)`, the
 * `oklch(1 0 0 / 0.1)` equivalent used by the Video.js liquid-glass reference.
 *
 * Defined HERE as the CONTRACT only — plan 022 does NOT apply it to any surface
 * (that would change the committed pixel baseline). Plan 023 wires it onto the
 * frosted DEFAULT look. Distinct in intent from the a11y
 * {@link REDUCED_TRANSPARENCY_FILL} / {@link CONTRAST_FILL} fills, which exist
 * to force opacity under specific OS settings.
 */
export const FROSTED_DEFAULT_FILL = 'rgba(255, 255, 255, 0.1)';

/**
 * The frosted-glass DEFAULT hairline ring: a crisp ~1px inset edge that defines
 * the frosted surface's perimeter. `color` is a translucent white drawn as an
 * inset ring; `width` is in px.
 *
 * Defined HERE as the CONTRACT only — plan 022 does NOT apply it (no surface
 * change). Plan 023 serializes it onto the frosted DEFAULT surface (e.g. as an
 * inset `box-shadow` ring, geometry-neutral like the existing bevel).
 */
export const FROSTED_HAIRLINE_RING = {
  /** Inset ring color (translucent white). */
  color: 'rgba(255, 255, 255, 0.5)',
  /** Ring width in px (hairline). */
  width: 1,
} as const;
