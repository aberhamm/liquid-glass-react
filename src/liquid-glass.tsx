/**
 * `<LiquidGlass>` — the headline refraction primitive (plan 004).
 *
 * Renders the Chromium "liquid glass" effect by layering an inline SVG
 * `feDisplacementMap` filter over a `backdrop-filter`. The component is
 * capability-gated: it only attaches the SVG filter when `canRefract` is true
 * AND it has measured its own rendered size. The visible cross-browser fallback
 * markup lands in plan 006; here, when refraction is unavailable, the surface
 * simply keeps its plain `blur()/saturate()` backdrop and omits the filter.
 *
 * ## Layer stack (content isolation is a hard requirement)
 *
 * 1. An outer wrapper (`position: relative`) carries `className`, merged
 *    `style`, `onClick`, `padding`, and `borderRadius`, and holds the measured
 *    ref.
 * 2. A GLASS SURFACE layer (`position: absolute; inset: 0`) sits BEHIND the
 *    content and carries the `backdrop-filter` (with the optional `url(#id)`
 *    refraction). This is the only element whose backdrop is warped.
 * 3. A CONTENT layer (`position: relative`, above the surface) holds
 *    `children`. It is a SIBLING of the surface, never a descendant — so the
 *    `feDisplacementMap` warps only the backdrop and children stay crisp.
 *
 * ## Application mechanism (committed default — plan 004 eng-review)
 *
 * The filter is applied via `backdrop-filter: url(#id) blur() saturate()` on the
 * surface (the MDN-documented backdrop path), NOT via a foreground
 * `filter: url(#id)` (which would establish a backdrop-root boundary). When
 * `canRefract` is false the `url(#id)` term is omitted.
 *
 * ## Measurement
 *
 * Size is measured via a `ResizeObserver` (rAF-throttled) in the browser, plus a
 * one-shot `getBoundingClientRect()` read on mount that also works under jsdom
 * (which implements neither layout nor `ResizeObserver` natively). Measured dims
 * are quantized to a 16px grid (consistent with plan 003) before feeding
 * `getDisplacementMap` and the filter region. Until measured, no filter is
 * attached, so there is never a guessed/stale/zero-dimension map.
 */

import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { type MapMode, getDisplacementMap } from './displacement';
import { getGlassEdgeShadow } from './glass-edge';
import { calculateDirectionalScale, calculateElasticTranslation } from './motion';
import type { DisplacementMode, LiquidGlassProps } from './types';
import { useGlassCapabilities } from './use-glass-capabilities';
import { useMousePosition } from './use-mouse-position';
import { usePrefersContrast } from './use-prefers-contrast';
import { useReducedMotion } from './use-reduced-motion';
import { useReducedTransparency } from './use-reduced-transparency';

// ---------------------------------------------------------------------------
// Defaults (parity spec — plan 004)
// ---------------------------------------------------------------------------

const DEFAULTS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  cornerRadius: 999 as number | string,
  mode: 'standard' as DisplacementMode,
  overLight: false,
  padding: '24px 32px' as number | string,
  elasticity: 0.15,
} as const;

/**
 * Quantization grid (px) for measured dims — mirrors plan 003's displacement
 * cache so a resize storm of near-identical sizes collapses to one render.
 */
const QUANT_GRID = 16;

/** `feTurbulence` base frequency for the procedural turbulence mode (tunable). */
const TURBULENCE_BASE_FREQUENCY = 0.015;

/**
 * Maps the small public `blurAmount` (default `0.0625`) onto a px backdrop blur.
 * The upstream convention treats `blurAmount` as a rem-ish factor; we scale by
 * 16 (1rem) so the default lands at ~1px and larger values scale linearly.
 */
const BLUR_PX_PER_UNIT = 16;

/**
 * Scheme-aware translucent fill layered ON TOP of the blurred backdrop when
 * `prefers-reduced-transparency: reduce` is active and the backdrop tiers (1/2)
 * still carry a `backdrop-filter`. It frosts the surface toward opaque so the
 * material reads as static frosted glass rather than live lensing. Higher alpha
 * than the tier-3 solid fill because here it composites over a blurred backdrop,
 * not bare content. (a11y plan 013.)
 */
const REDUCED_TRANSPARENCY_FILL = {
  light: 'rgba(255, 255, 255, 0.75)',
  dark: 'rgba(30, 30, 35, 0.75)',
} as const;

/**
 * Scheme-aware solid fill for the no-`backdrop-filter` tier (3) under reduced
 * transparency: a higher alpha than the default `0.55` solid fallback so the
 * surface is more opaque / less transparent as the setting requests.
 */
const REDUCED_TRANSPARENCY_SOLID_FILL = {
  light: 'rgba(255, 255, 255, 0.92)',
  dark: 'rgba(30, 30, 35, 0.92)',
} as const;

/**
 * Increased-contrast (a11y plan 014). When `(prefers-contrast: more)` is active
 * the glass adds a SOLID, visible border and raises content legibility while
 * toning down decorative refraction artifacts that hurt contrast. This axis is
 * ORTHOGONAL to the 3 capability tiers AND to reduced-transparency (013): both
 * may be active at once and must stay legible + shift-free.
 */

/**
 * Solid border color drawn as an INSET `box-shadow` ring on the surface so the
 * box geometry is unchanged (no layout shift) — a real `border` would grow the
 * box or eat into padding. Scheme-aware near-opaque ink/light for a clearly
 * delineated edge that the soft bevel alone cannot provide.
 */
const CONTRAST_BORDER_COLOR = {
  light: 'rgba(0, 0, 0, 0.92)',
  dark: 'rgba(255, 255, 255, 0.92)',
} as const;

/** Inset solid-border ring width (px), prepended to the surface box-shadow. */
const CONTRAST_BORDER_WIDTH = 2;

// ---------------------------------------------------------------------------
// Pointer-tracked specular hotspot + glow-on-press (plan 016)
// ---------------------------------------------------------------------------

/**
 * Resting specular-hotspot center as a percentage of the surface box. With no
 * pointer over the glass (or under reduced-motion) the highlight falls back to a
 * neutral, top-biased position so the material reads like overhead light on
 * glass rather than a flat sweep. Top-center, slightly above the box.
 */
const SPECULAR_REST_X = '50%';
const SPECULAR_REST_Y = '0%';

/**
 * Peak opacity of the specular hotspot's bright core (the inner stop). Hover
 * brightens it slightly (see {@link LiquidGlass}); these are the base values.
 */
const SPECULAR_CORE_OPACITY = { rest: 0.55, hover: 0.85 } as const;

/**
 * Radius of the specular hotspot gradient as a percentage of the surface's
 * larger dimension. Big enough to read as a soft glassy hotspot, small enough
 * that it tracks visibly rather than washing the whole surface.
 */
const SPECULAR_RADIUS = '70%';

/**
 * Peak opacity of the press-glow bloom's core when active. The glow originates
 * at the contact point and spreads, then fades via the layer's opacity
 * transition (gated on reduced-motion).
 */
const PRESS_GLOW_OPACITY = 0.5;

/** Radius of the press-glow bloom as a percentage of the surface box. */
const PRESS_GLOW_RADIUS = '60%';

/**
 * More-opaque scheme-aware surface fill under increased contrast: it reduces
 * the backdrop tint/show-through so foreground content reads at a higher
 * contrast ratio. Layered over any retained blur (tiers 1/2) or used as the
 * solid fill (tier 3). At 0.92 alpha it is at least as opaque as the
 * reduced-transparency fills, so when BOTH a11y axes are active the contrast
 * fill never undercuts reduced-transparency's opacity intent — contrast wants
 * MORE opacity, not less, on every tier.
 */
const CONTRAST_FILL = {
  light: 'rgba(255, 255, 255, 0.92)',
  dark: 'rgba(22, 22, 26, 0.92)',
} as const;

/**
 * Under increased contrast, saturation is pinned to 100% (no decorative
 * vibrancy boost) so the backdrop doesn't push color that competes with
 * foreground text. The default `saturation` (140) is decorative and harms
 * contrast, so it is overridden — never raised.
 */
const CONTRAST_SATURATION = 100;

function quantize(value: number): number {
  return Math.max(QUANT_GRID, Math.round(value / QUANT_GRID) * QUANT_GRID);
}

/**
 * SSR-safe live `(prefers-color-scheme: dark)` state, used to pick the glass-edge
 * bevel variant. Mirrors `useReducedMotion`'s pattern (mount sync + `'change'`
 * listener) but is local to the component — the rim bevel is the only consumer,
 * and color-scheme is not a motion concern routed through `useReducedMotion`.
 * Returns `false` (light) during SSR / before mount.
 */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mql.matches);
    const onChange = (event: MediaQueryListEvent): void => setDark(event.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return dark;
}

function toCssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

interface Dimensions {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Backdrop-filter composition
// ---------------------------------------------------------------------------

/**
 * Compose the `backdrop-filter` value. `filterUrl` (`url(#id)`) is prepended
 * only when refraction is active. `overLight` increases the blur somewhat for
 * legibility over bright backgrounds.
 */
function composeBackdropFilter(
  blurAmount: number,
  saturation: number,
  overLight: boolean,
  filterUrl: string | null,
): string {
  // blurAmount is a unit factor; map to px. overLight bumps blur for contrast.
  const blurPx = blurAmount * BLUR_PX_PER_UNIT * (overLight ? 1.5 : 1);
  const base = `blur(${blurPx}px) saturate(${saturation}%)`;
  return filterUrl ? `${filterUrl} ${base}` : base;
}

// ---------------------------------------------------------------------------
// GlassFilter — inline <svg><filter>
// ---------------------------------------------------------------------------

interface GlassFilterProps {
  filterId: string;
  mode: DisplacementMode;
  width: number;
  height: number;
  /** Effective displacement scale (already halved when `overLight`). */
  effectiveScale: number;
  aberrationIntensity: number;
}

/**
 * Renders the SVG `<filter>` graph. Hidden `<svg>` (0x0, absolutely positioned)
 * so it contributes only the referenced filter, no layout box.
 *
 * Coordinate space is `userSpaceOnUse` (pixel space): `effectiveScale` is the
 * literal `feDisplacementMap scale` in px, and the filter region / `feImage`
 * dims come from the measured size.
 */
function GlassFilter({
  filterId,
  mode,
  width,
  height,
  effectiveScale,
  aberrationIntensity,
}: GlassFilterProps): ReactNode {
  const isTurbulence = mode === 'turbulence';

  // Per-channel aberration scales: R splayed out, B pulled in, G centered. The
  // spread scales with aberrationIntensity (0 => all three equal => no split).
  const scaleR = effectiveScale + aberrationIntensity;
  const scaleG = effectiveScale;
  const scaleB = effectiveScale - aberrationIntensity;

  // The displacement source feeding feDisplacementMap.in2. For non-turbulence
  // modes this is an feImage of the generated map; for turbulence it is a
  // procedural feTurbulence -> feGaussianBlur chain. getDisplacementMap is only
  // called for non-turbulence (its type excludes 'turbulence').
  const displacementSource: ReactNode = isTurbulence ? (
    <>
      <feTurbulence
        type="fractalNoise"
        baseFrequency={TURBULENCE_BASE_FREQUENCY}
        numOctaves={2}
        seed={1}
        result="noise"
      />
      <feGaussianBlur in="noise" stdDeviation={1.5} result="dispSource" />
    </>
  ) : (
    <feImage
      href={getDisplacementMap(mode as MapMode, width, height)}
      x="0"
      y="0"
      width={width}
      height={height}
      preserveAspectRatio="none"
      result="dispSource"
    />
  );

  // One chromatic-aberration pass: displace SourceGraphic at `scale`, then keep
  // only the requested channel (zero the other two via feColorMatrix).
  const channelPass = (scale: number, keep: 'R' | 'G' | 'B', resultName: string): ReactNode => {
    // Row-major 4x5 color matrix; keep exactly one of R/G/B, drop the rest,
    // preserve alpha.
    const matrix =
      keep === 'R'
        ? '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'
        : keep === 'G'
          ? '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'
          : '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0';
    return (
      <>
        <feDisplacementMap
          in="SourceGraphic"
          in2="dispSource"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="B"
          result={`${resultName}_disp`}
        />
        <feColorMatrix
          in={`${resultName}_disp`}
          type="matrix"
          values={matrix}
          result={resultName}
        />
      </>
    );
  };

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter
          id={filterId}
          primitiveUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={width}
          height={height}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          {displacementSource}

          {/* Chromatic aberration: three single-channel displaced passes. */}
          {channelPass(scaleR, 'R', 'chanR')}
          {channelPass(scaleG, 'G', 'chanG')}
          {channelPass(scaleB, 'B', 'chanB')}

          {/* Recombine ADDITIVELY (not screen — that over-brightens). Each pass
              isolated a single channel, so arithmetic k2=k3=1 sums them back to
              a full-color image without blowing out to white. */}
          <feComposite
            in="chanR"
            in2="chanG"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="chanRG"
          />
          <feComposite
            in="chanRG"
            in2="chanB"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="aberrated"
          />

          {/* Small softening blur over the recombined result. */}
          <feGaussianBlur in="aberrated" stdDeviation={0.5} result="softened" />

          {/* Radial edge mask: confine the warp to the rim. A radial gradient
              (transparent center -> opaque edge) drives a feComponentTransfer
              alpha ramp, then composites so the center stays unwarped. */}
          <radialGradient id={`${filterId}-edge`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </radialGradient>
          <feImage
            href={`#${filterId}-edge`}
            x="0"
            y="0"
            width={width}
            height={height}
            preserveAspectRatio="none"
            result="edgeMask"
          />
          {/* Keep the warped result only where the edge mask is opaque (the
              rim); elsewhere fall through to the unwarped backdrop. */}
          <feComposite in="softened" in2="edgeMask" operator="in" result="edgeOnly" />
          <feComposite in="edgeOnly" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// <LiquidGlass>
// ---------------------------------------------------------------------------

/**
 * The liquid-glass refraction primitive. See the file header for the layer
 * stack, application mechanism, and measurement strategy.
 *
 * ## Motion + rim lighting (plan 005)
 *
 * The elastic stretch/translate (from {@link useMousePosition} + the pure
 * `motion.ts` math) and the rim/highlight layers are PURE CSS — they render in
 * every browser regardless of `canRefract`. The `transform` is applied to the
 * GLASS SURFACE and the rim/highlight layers (which are siblings of the content
 * layer), so the elastic distortion never warps the crisp `children`. The pure-
 * CSS bevel (`glass-edge.ts`) is an inset `box-shadow` on the surface, while the
 * outer drop-shadow/glow is a SEPARATE sibling element rendered BEHIND the
 * `overflow:hidden` surface so clipping can't eat it.
 *
 * ## Specular hotspot + glow-on-press (plan 016)
 *
 * The highlight layer is a POSITIONED `radial-gradient` specular hotspot whose
 * center tracks the pointer over the glass (driven by `--lg-spec-x/y` from
 * {@link useMousePosition}), with a neutral top-biased fallback at rest. A second
 * `[data-lg-press-glow]` layer blooms a radial glow from the contact point on
 * press and fades out. Both are pure CSS (gradient/opacity/transform), render in
 * EVERY engine regardless of `canRefract` (polish, not refraction), and are
 * GATED on {@link useReducedMotion}: when reduced-motion is set the hotspot is
 * static (neutral, no tracking) and the press glow snaps without animating. They
 * are decorative siblings (aria-hidden, pointer-events:none) and never touch
 * layout/geometry. They compose with {@link GlassButton}'s diagonal `shine`
 * sweep (a `::after` on the button element) — different nodes, different layers.
 */
export function LiquidGlass({
  children,
  displacementScale = DEFAULTS.displacementScale,
  blurAmount = DEFAULTS.blurAmount,
  saturation = DEFAULTS.saturation,
  aberrationIntensity = DEFAULTS.aberrationIntensity,
  elasticity = DEFAULTS.elasticity,
  cornerRadius = DEFAULTS.cornerRadius,
  padding = DEFAULTS.padding,
  overLight = DEFAULTS.overLight,
  mode = DEFAULTS.mode,
  className,
  style,
  onClick,
  globalMousePos,
  mouseOffset,
  mouseContainer,
}: LiquidGlassProps): ReactNode {
  const { canRefract, supportsBackdropFilter } = useGlassCapabilities();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedTransparency = useReducedTransparency();
  const prefersContrast = usePrefersContrast();
  const prefersDark = usePrefersDark();
  const [hovered, setHovered] = useState<boolean>(false);
  const [pressed, setPressed] = useState<boolean>(false);

  // Pointer tracking: respects mouseContainer / globalMousePos / mouseOffset,
  // consumes reduced-motion + touch internally, SSR-safe. The wrapper element is
  // the relative frame when no explicit container is supplied.
  const { offset, isActive } = useMousePosition({
    container: mouseContainer,
    globalMousePos,
    mouseOffset,
    elementRef: wrapperRef,
  });

  // Sanitize useId() — it returns colon-bearing ids like `:r0:` that are invalid
  // in CSS selectors and a classic SVG-filter footgun. Never reference the raw id.
  const filterId = `lg-${useId().replace(/:/g, '')}`;

  // Measurement: one-shot getBoundingClientRect on mount (works in jsdom + SSR
  // hydration) plus a rAF-throttled ResizeObserver for live resizes in the
  // browser. Both quantize to the 16px grid and only commit on real change.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    let frame = 0;

    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      // Bail on a zero/degenerate rect (SSR, pre-layout, or a real
      // not-yet-painted frame). quantize() floors to a 16px cell, so guarding
      // the RAW rect here is what actually prevents a guessed/zero-dimension
      // map from attaching — never quantize a 0 into a bogus 16.
      if (
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }
      const width = quantize(rect.width);
      const height = quantize(rect.height);
      setDimensions((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    };

    // Initial synchronous read so a filter can attach without waiting on RO.
    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      // rAF-throttle: coalesce a burst of resize callbacks into one measure.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    });
    observer.observe(node);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // overLight halves the effective displacement (parity spec) and the GlassFilter
  // / backdrop blur are adjusted for it.
  const effectiveScale = overLight ? displacementScale / 2 : displacementScale;

  // Increased contrast (plan 014) tones down decoration that competes with
  // foreground legibility: the backdrop saturation boost is pinned to 100% and
  // the chromatic aberration (which colors the refracted edges) is dropped to 0.
  // These are no-ops unless the live `(prefers-contrast: more)` hook is true, so
  // the default-off output is byte-for-byte unchanged.
  const effectiveSaturation = prefersContrast ? CONTRAST_SATURATION : saturation;
  const effectiveAberration = prefersContrast ? 0 : aberrationIntensity;

  const measured = dimensions !== null && dimensions.width > 0 && dimensions.height > 0;
  // Attach the filter only when refraction is supported AND we have real dims.
  // `prefers-reduced-transparency: reduce` is ORTHOGONAL to the 3-tier gate: it
  // force-drops live lensing on EVERY tier by reusing the existing no-filter path
  // (no 4th tier, no geometry change), exactly as Firefox/WebKit already do.
  const filterActive = canRefract && measured && !reducedTransparency;
  const filterUrl = filterActive ? `url(#${filterId})` : null;

  // Tiered render selector (plan 006). All tiers share IDENTICAL box geometry
  // (dimensions/padding/border-radius), so degrading between them never causes a
  // layout shift — only the surface fill/filter differs.
  //   - TIER 1 full: canRefract — backdrop blur+saturate WITH url(#id) refraction
  //     + the SVG <filter>.
  //   - TIER 2 frosted: supportsBackdropFilter && !canRefract (Firefox/Safari) —
  //     backdrop blur+saturate, rim/highlight, bevel + motion, but NO SVG filter.
  //   - TIER 3 solid: !supportsBackdropFilter — a translucent solid background so
  //     content stays legible (no transparent unreadable box); still rim + bevel
  //     + motion for polish.
  const backdropFilter = supportsBackdropFilter
    ? composeBackdropFilter(blurAmount, effectiveSaturation, overLight, filterUrl)
    : undefined;

  const radius = toCssLength(cornerRadius);

  // --- Elastic motion -------------------------------------------------------
  // The mouse offset is relative to the wrapper center. Compute scale + translate
  // from the pure motion math, treating center as the origin (the math takes
  // mouse/center pairs, so feeding offset against {0,0} is equivalent). Motion is
  // only live when the hook reports an active (non-reduced, non-touch) pointer.
  const motionLive = isActive && !reducedMotion;
  const scale = motionLive
    ? calculateDirectionalScale(offset.x, offset.y, 0, 0, elasticity)
    : { scaleX: 1, scaleY: 1 };
  const translate = motionLive
    ? calculateElasticTranslation(offset.x, offset.y, 0, 0, elasticity)
    : { x: 0, y: 0 };

  // A slight extra "press" inset when actively clicked (only meaningful when the
  // glass is interactive, i.e. an onClick is wired).
  const interactive = typeof onClick === 'function';
  const pressScale = interactive && pressed ? 0.96 : 1;

  const surfaceTransform = `translate(${translate.x.toFixed(2)}px, ${translate.y.toFixed(
    2,
  )}px) scale(${(scale.scaleX * pressScale).toFixed(4)}, ${(scale.scaleY * pressScale).toFixed(4)})`;

  // Gradient angle tracks the horizontal mouse offset so the rim/border catches
  // light from the cursor side. Baseline 135deg (top-left light) shifted by
  // offset.x. The border layer still uses this; the highlight is now a positioned
  // radial specular hotspot (below), not an angle-only linear sweep.
  const gradientAngle = 135 + (motionLive ? offset.x * 0.15 : 0);

  // --- Pointer-tracked specular hotspot (plan 016) -------------------------
  // Convert the pointer offset (relative to the wrapper center) into a center
  // position within the surface box, expressed as a percentage so the
  // radial-gradient `circle at <x> <y>` tracks the actual cursor. When the
  // pointer is absent or motion is suppressed (reduced-motion / touch), fall
  // back to a neutral, top-biased rest position so the resting appearance is
  // sensible and stable. The math treats the wrapper center as 50%/50% and maps
  // the offset by half the measured dimension; clamped to a small over-scan so
  // the hotspot can ride the very edge without snapping inside.
  let specX = SPECULAR_REST_X;
  let specY = SPECULAR_REST_Y;
  if (motionLive && measured) {
    const pctX = 50 + (offset.x / (dimensions.width / 2)) * 50;
    const pctY = 50 + (offset.y / (dimensions.height / 2)) * 50;
    const clamp = (v: number): number => Math.max(-20, Math.min(120, v));
    specX = `${clamp(pctX).toFixed(2)}%`;
    specY = `${clamp(pctY).toFixed(2)}%`;
  }

  // --- Glow-from-within on press (plan 016) --------------------------------
  // A second radial layer that blooms from the contact point on pointerdown and
  // fades out via an opacity transition. Origin reuses the same tracked specular
  // position (the contact point) when available, else the surface center.
  // Under reduced-motion the bloom is static (snaps on/off, no transition).
  const pressGlowActive = pressed;
  const pressGlowX = motionLive && measured ? specX : '50%';
  const pressGlowY = motionLive && measured ? specY : '50%';

  // Bevel rim variant keyed off prefers-color-scheme.
  const edgeShadow = getGlassEdgeShadow(prefersDark ? 'dark' : 'light');

  // Increased contrast (plan 014): a SOLID, visible border the soft bevel can't
  // provide. Drawn as an INSET box-shadow ring PREPENDED to the bevel so the box
  // geometry is unchanged (no border-box growth, no padding loss → no layout
  // shift). No-op unless the live hook is true, so default-off is unchanged.
  const surfaceBoxShadow = prefersContrast
    ? `inset 0 0 0 ${CONTRAST_BORDER_WIDTH}px ${
        CONTRAST_BORDER_COLOR[prefersDark ? 'dark' : 'light']
      }, ${edgeShadow}`
    : edgeShadow;

  // Hover brightens the highlight layers slightly.
  const specularCoreOpacity = hovered ? SPECULAR_CORE_OPACITY.hover : SPECULAR_CORE_OPACITY.rest;
  const borderOpacity = hovered ? 0.55 : 0.35;

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    padding: toCssLength(padding),
    borderRadius: radius,
    ...style,
  };

  // Decoupled outer drop-shadow/glow. SEPARATE sibling rendered BEHIND the
  // clipped surface — a same-node box-shadow would be clipped by the surface's
  // overflow:hidden + backdrop clip. It tracks the elastic translate so the glow
  // follows the glass, and intensifies on hover.
  const dropShadowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    transform: surfaceTransform,
    transition: 'box-shadow 200ms ease, transform 120ms ease-out',
    boxShadow: hovered
      ? '0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18)'
      : '0 8px 24px rgba(0, 0, 0, 0.22), 0 1px 4px rgba(0, 0, 0, 0.14)',
    zIndex: -1,
    pointerEvents: 'none',
  };

  const scheme = prefersDark ? 'dark' : 'light';

  // Surface fill selection. Independent cases, none of which change box
  // geometry:
  //   - Default tiers 1/2 (backdrop-filter supported): NO fill — the blurred
  //     backdrop carries the glass look. (Byte-for-byte unchanged.)
  //   - Default tier 3 (no backdrop-filter): the translucent ~0.55 solid fill so
  //     content stays legible instead of a transparent box. (Unchanged.)
  //   - Reduced transparency ON: a MORE-opaque scheme-aware fill on every tier —
  //     layered over the blurred backdrop on tiers 1/2, or a higher-alpha solid on
  //     tier 3 — so the material reads as static frosted glass with no live lensing.
  //   - Increased contrast ON: a more-opaque scheme-aware fill on EVERY tier so
  //     foreground content reads at a higher contrast ratio. This composes with
  //     reduced-transparency (both axes may be active) and is checked FIRST since
  //     legibility is the stronger requirement; it never changes box geometry.
  let surfaceBackground: string | undefined;
  if (prefersContrast) {
    surfaceBackground = CONTRAST_FILL[scheme];
  } else if (reducedTransparency) {
    surfaceBackground = supportsBackdropFilter
      ? REDUCED_TRANSPARENCY_FILL[scheme]
      : REDUCED_TRANSPARENCY_SOLID_FILL[scheme];
  } else if (!supportsBackdropFilter) {
    surfaceBackground = scheme === 'dark' ? 'rgba(30, 30, 35, 0.55)' : 'rgba(255, 255, 255, 0.55)';
  }

  const surfaceStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    overflow: 'hidden',
    // Tiers 1/2 carry the frosted backdrop (with -webkit- prefix); tier 3 omits
    // the filter entirely (no orphaned/unsupported declaration). The `background`
    // is unset by default on tiers 1/2 (the backdrop carries the look), the ~0.55
    // solid on tier 3, and a more-opaque frosting fill on EVERY tier when
    // reduced-transparency is active (layered over the retained blur on 1/2).
    ...(backdropFilter ? { backdropFilter, WebkitBackdropFilter: backdropFilter } : {}),
    ...(surfaceBackground ? { background: surfaceBackground } : {}),
    // Pure-CSS beveled rim — renders in every browser, independent of canRefract.
    // Under increased contrast a solid inset border ring is prepended (geometry
    // unchanged); otherwise this is exactly the bevel.
    boxShadow: surfaceBoxShadow,
    transform: surfaceTransform,
    transition: 'transform 120ms ease-out',
    // Keep the surface strictly behind the content layer.
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Specular hotspot layer (plan 016): a positioned radial highlight that tracks
  // the pointer over the glass (neutral top-biased fallback at rest / under
  // reduced-motion), using `screen` blend so it adds light without a hard edge.
  // This REPLACES the old angle-only linear sweep. The center is driven by CSS
  // custom props (`--lg-spec-x/y`) consumed by `radial-gradient(circle at ...)`,
  // so a pointer move repaints the hotspot under the cursor — pure CSS, every
  // engine, independent of `canRefract`. The `background` transition is omitted
  // under reduced-motion so the hotspot is static, not chasing.
  const highlightStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    transform: surfaceTransform,
    transition: reducedMotion
      ? 'transform 120ms ease-out'
      : 'transform 120ms ease-out, background-position 120ms ease-out',
    mixBlendMode: 'screen',
    // Custom props expose the tracked center; the gradient consumes them so a
    // re-render (pointer move) only changes the variables, not the layer markup.
    ['--lg-spec-x' as string]: specX,
    ['--lg-spec-y' as string]: specY,
    background: `radial-gradient(circle ${SPECULAR_RADIUS} at var(--lg-spec-x, ${SPECULAR_REST_X}) var(--lg-spec-y, ${SPECULAR_REST_Y}), rgba(255,255,255,${specularCoreOpacity}) 0%, rgba(255,255,255,${(specularCoreOpacity * 0.4).toFixed(3)}) 30%, rgba(255,255,255,0) 65%)`,
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Press-glow layer (plan 016): a radial bloom that "illuminates from within"
  // on press, originating at the contact point and fading via an opacity
  // transition once released. Composes ADDITIVELY (screen blend) with the
  // specular hotspot above and is independent of GlassButton's own diagonal
  // `shine` sweep (that is a `::after` on the button element inside the content
  // layer; this glow is a surface-side sibling behind the content) — the two
  // never share a node, so they layer rather than conflict. Under reduced-motion
  // the bloom snaps on/off (no transition).
  const pressGlowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    transform: surfaceTransform,
    mixBlendMode: 'screen',
    ['--lg-spec-x' as string]: pressGlowX,
    ['--lg-spec-y' as string]: pressGlowY,
    background: `radial-gradient(circle ${PRESS_GLOW_RADIUS} at var(--lg-spec-x, 50%) var(--lg-spec-y, 50%), rgba(255,255,255,${PRESS_GLOW_OPACITY}) 0%, rgba(255,255,255,${(PRESS_GLOW_OPACITY * 0.5).toFixed(3)}) 25%, rgba(255,255,255,0) 55%)`,
    opacity: pressGlowActive ? 1 : 0,
    transition: reducedMotion
      ? 'transform 120ms ease-out'
      : 'transform 120ms ease-out, opacity 360ms ease-out',
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Border layer: a thin rim-light ring using `overlay` blend so it deepens
  // contrast at the edges. Tracks the same gradient angle.
  const borderStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    transform: surfaceTransform,
    transition: 'transform 120ms ease-out',
    mixBlendMode: 'overlay',
    padding: '1px',
    background: `linear-gradient(${gradientAngle}deg, rgba(255,255,255,${borderOpacity}) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,${borderOpacity * 0.6}) 100%)`,
    zIndex: 0,
    pointerEvents: 'none',
  };

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
  };

  return (
    // onClick is a pass-through forwarded from the public API; the wrapper is a
    // non-semantic presentational container, and consumers supply their own
    // interactive (and keyboard-accessible) elements as children. Forcing
    // keyboard handlers here would invent semantics the consumer didn't request.
    // biome-ignore lint/a11y/useKeyWithClickEvents: presentational pass-through; children own interactivity
    <div
      ref={wrapperRef}
      className={className}
      style={wrapperStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {/* Decoupled outer drop-shadow / glow: SEPARATE sibling rendered BEHIND
          the clipped glass surface so its blur/offset are never clipped away. */}
      <div data-lg-shadow="" style={dropShadowStyle} aria-hidden="true" />

      {/* Glass surface: carries the backdrop-filter (+ optional url(#id)) and the
          pure-CSS inset bevel. The children are NEVER inside this element. */}
      <div data-lg-surface="" style={surfaceStyle}>
        {filterActive ? (
          <GlassFilter
            filterId={filterId}
            mode={mode}
            width={dimensions.width}
            height={dimensions.height}
            effectiveScale={effectiveScale}
            aberrationIntensity={effectiveAberration}
          />
        ) : null}
      </div>

      {/* Pointer-tracked specular hotspot + press-glow + rim-light border layers
          (pure CSS blend, every browser). Siblings of the content layer, so the
          blend never touches children. All are aria-hidden + pointer-events:none
          decoration that never affects layout/geometry. */}
      <span data-lg-highlight="" style={highlightStyle} aria-hidden="true" />
      <span data-lg-press-glow="" style={pressGlowStyle} aria-hidden="true" />
      <span data-lg-border="" style={borderStyle} aria-hidden="true" />

      {/* Content layer: sibling of the surface, above it, unfiltered. */}
      <div data-lg-content="" style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
