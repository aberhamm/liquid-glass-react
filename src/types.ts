/**
 * Public type contracts for `@aberhamm/liquid-glass-react`.
 *
 * These types are the load-bearing surface that every later plan (refraction,
 * motion, fallback, prebuilt components) builds against. They are defined ONCE
 * here so the API cannot drift between plans. No runtime code lives in this
 * file — it is types only.
 */

import type { CSSProperties, MouseEventHandler, ReactNode, RefObject } from 'react';

/**
 * The displacement/refraction algorithm used to generate the SVG
 * `feDisplacementMap` and tune the glass distortion.
 *
 * - `standard` — balanced edge-weighted displacement (the default look).
 * - `polar` — radial/polar displacement, stronger toward the perimeter.
 * - `prominent` — exaggerated displacement for a heavier "thick glass" feel.
 * - `shader` — shader-style displacement profile for sharper highlights.
 * - `turbulence` — adds fractal turbulence for an organic, watery distortion.
 *
 * @defaultValue `'standard'`
 */
export type DisplacementMode = 'standard' | 'polar' | 'prominent' | 'shader' | 'turbulence';

/**
 * A 2D pointer position in CSS pixels, used for mouse-driven motion/elasticity.
 *
 * Coordinates are interpreted relative to whatever container the consumer wires
 * up via {@link LiquidGlassProps.mouseContainer} (viewport by default).
 */
export type MousePos = {
  /** Horizontal position in CSS pixels. */
  x: number;
  /** Vertical position in CSS pixels. */
  y: number;
};

/**
 * Result of runtime capability detection. Every field is a plain boolean so the
 * object is trivially serializable and cheap to compare across renders.
 *
 * Produced by `detectGlassCapabilities()` and surfaced to components via the
 * `useGlassCapabilities()` hook. During SSR (and before mount) all fields are
 * conservatively `false`.
 */
export type GlassCapabilities = {
  /**
   * Whether the browser supports `backdrop-filter` (or the `-webkit-` prefixed
   * variant). Required for any frosted-glass blur at all.
   */
  supportsBackdropFilter: boolean;
  /**
   * Positive Blink-family detection (Chrome, Edge, Brave, Opera). Explicitly
   * NOT Firefox and NOT Safari/WebKit.
   */
  isChromium: boolean;
  /**
   * Whether an SVG `feDisplacementMap` filter composites correctly over
   * `backdrop-filter`. This is a Chromium-only rendering-pipeline quirk with no
   * standardized `CSS.supports` probe, so it is derived from {@link isChromium}.
   */
  supportsSvgBackdropDisplacement: boolean;
  /** Whether the user agent is Firefox (Gecko). */
  isFirefox: boolean;
  /**
   * Whether the user has requested reduced motion via
   * `(prefers-reduced-motion: reduce)`.
   */
  prefersReducedMotion: boolean;
  /**
   * The single gate later plans consult: `true` only when the full refraction
   * effect can actually render
   * (`supportsBackdropFilter && supportsSvgBackdropDisplacement`). When `false`,
   * components must fall back to a degraded (non-refractive) presentation.
   */
  canRefract: boolean;
};

/**
 * Props for the `<LiquidGlass>` PRIMITIVE.
 *
 * Every prop except {@link children} is optional — the primitive ships sensible
 * defaults. Defaults documented here are the contract; the implementation plan
 * (004+) must honor them.
 */
export interface LiquidGlassProps {
  /** Content rendered inside the glass surface. */
  children: ReactNode;

  /**
   * Strength of the displacement/refraction distortion. Higher values bend the
   * backdrop more aggressively.
   *
   * @defaultValue `70`
   */
  displacementScale?: number;

  /**
   * Backdrop blur radius in pixels applied behind the glass.
   *
   * @defaultValue `0.0625`
   */
  blurAmount?: number;

  /**
   * Backdrop saturation multiplier (`1` = unchanged). Boosts color vibrancy of
   * the content seen through the glass.
   *
   * @defaultValue `140`
   */
  saturation?: number;

  /**
   * Intensity of the chromatic aberration (RGB channel separation) at the
   * refracted edges. `0` disables it.
   *
   * @defaultValue `2`
   */
  aberrationIntensity?: number;

  /**
   * How elastically the glass reacts to pointer movement. `0` is rigid; higher
   * values produce a softer, more rubbery follow.
   *
   * @defaultValue `0.15`
   */
  elasticity?: number;

  /**
   * Corner radius of the glass surface. A number is treated as pixels; a string
   * is passed through as a CSS length (e.g. `'1rem'`, `'50%'`).
   *
   * @defaultValue `999`
   */
  cornerRadius?: number | string;

  /**
   * Inner padding of the glass surface. A number is treated as pixels; a string
   * is passed through as a CSS shorthand (e.g. `'8px 16px'`).
   *
   * @defaultValue `'24px'`
   */
  padding?: number | string;

  /**
   * Hint that the glass sits over a light background, so it tunes its tint and
   * contrast for legibility.
   *
   * @defaultValue `false`
   */
  overLight?: boolean;

  /**
   * Which displacement algorithm to use. See {@link DisplacementMode}.
   *
   * @defaultValue `'standard'`
   */
  mode?: DisplacementMode;

  /** Additional class name(s) applied to the outermost glass element. */
  className?: string;

  /** Inline styles merged onto the outermost glass element. */
  style?: CSSProperties;

  /** Click handler forwarded to the glass surface. */
  onClick?: MouseEventHandler<HTMLDivElement>;

  /**
   * Externally controlled global pointer position. When provided, the primitive
   * uses this instead of subscribing to its own pointer events — useful for
   * coordinating many glass surfaces from one shared tracker.
   *
   * Leave undefined for the uncontrolled default (the primitive tracks the
   * pointer itself).
   */
  globalMousePos?: MousePos;

  /**
   * Externally controlled pointer offset relative to the glass element's
   * center, in CSS pixels. Paired with {@link globalMousePos} for fully
   * controlled motion.
   */
  mouseOffset?: MousePos;

  /**
   * Element (or ref to one) whose bounds define the coordinate space for
   * pointer tracking. Defaults to the viewport when omitted or `null`.
   *
   * @defaultValue `null` (viewport)
   */
  mouseContainer?: RefObject<HTMLElement | null> | HTMLElement | null;
}
