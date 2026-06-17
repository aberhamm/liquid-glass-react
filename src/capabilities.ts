/**
 * Runtime capability detection for the liquid-glass refraction effect.
 *
 * The single decision this module makes is `canRefract`: whether the full
 * Chromium-only SVG-displacement-over-`backdrop-filter` effect can render. All
 * probes are SSR-safe — when `window`/`document`/`navigator`/`CSS` are
 * unavailable, detection returns conservative all-`false` defaults instead of
 * throwing.
 */

import type { GlassCapabilities } from './types';

/** Conservative defaults used during SSR / before client detection runs. */
const SSR_DEFAULTS: GlassCapabilities = {
  supportsBackdropFilter: false,
  isChromium: false,
  supportsSvgBackdropDisplacement: false,
  isFirefox: false,
  prefersReducedMotion: false,
  prefersReducedTransparency: false,
  prefersContrastMore: false,
  canRefract: false,
};

/**
 * Conservative, all-`false` capability snapshot. Exported so the hook and any
 * consumer can render a stable degraded state during SSR / first paint without
 * re-deriving the shape.
 */
export function getConservativeGlassCapabilities(): GlassCapabilities {
  return { ...SSR_DEFAULTS };
}

/** True when running in a browser-like environment with the globals we probe. */
function hasBrowserEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined'
  );
}

function probeBackdropFilter(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }
  return (
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
  );
}

function probeIsFirefox(userAgent: string): boolean {
  return /Firefox/i.test(userAgent);
}

/**
 * Positive Blink-family detection: Chrome, Chromium, Edge (`Edg`), Opera
 * (`OPR`). Explicitly excludes Firefox. Safari is excluded implicitly — its UA
 * carries `Safari` but never a `Chrome`/`Chromium`/`Edg`/`OPR` token, so it
 * never matches. Brave is covered by the `Chrome` token: it deliberately ships
 * a vanilla-Chrome UA (no `Brave` substring) for fingerprint resistance, so a
 * literal `Brave` alternative would be dead code.
 */
function probeIsChromium(userAgent: string, isFirefox: boolean): boolean {
  if (isFirefox) {
    return false;
  }
  return /Chrome|Chromium|Edg|OPR/i.test(userAgent);
}

function probePrefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Point-in-time `(prefers-reduced-transparency: reduce)` snapshot. Conservative
 * `false` when `matchMedia` is unavailable. Browsers that don't understand the
 * query return an `MediaQueryList` whose `matches` is `false`, so an unsupported
 * query degrades to "not reduced" — never throws and never wrongly opts in. The
 * authoritative live source is `useReducedTransparency()`; this snapshot exists
 * for one-shot detection parity with `prefersReducedMotion`.
 */
function probePrefersReducedTransparency(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
}

/**
 * Point-in-time `(prefers-contrast: more)` snapshot. Conservative `false` when
 * `matchMedia` is unavailable. Browsers that don't understand the query return
 * an `MediaQueryList` whose `matches` is `false`, so an unsupported query
 * degrades to "no increase" — never throws and never wrongly opts in. The
 * authoritative live source is `usePrefersContrast()`; this snapshot exists for
 * one-shot detection parity with `prefersReducedMotion` /
 * `prefersReducedTransparency`.
 */
function probePrefersContrastMore(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Detect the current browser's liquid-glass capabilities.
 *
 * Safe to call during SSR: returns conservative all-`false` defaults when
 * browser globals are unavailable, and never throws.
 */
export function detectGlassCapabilities(): GlassCapabilities {
  if (!hasBrowserEnvironment()) {
    return getConservativeGlassCapabilities();
  }

  const userAgent = navigator.userAgent ?? '';

  const supportsBackdropFilter = probeBackdropFilter();
  const isFirefox = probeIsFirefox(userAgent);
  const isChromium = probeIsChromium(userAgent, isFirefox);
  // No standardized CSS.supports probe exists for compositing an SVG
  // feDisplacementMap over backdrop-filter; it is a Chromium-only quirk, so we
  // derive it from positive Blink detection. See docs/PARITY.md.
  const supportsSvgBackdropDisplacement = isChromium;
  const prefersReducedMotion = probePrefersReducedMotion();
  const prefersReducedTransparency = probePrefersReducedTransparency();
  const prefersContrastMore = probePrefersContrastMore();

  // POSITIVE gate, not `!isFirefox`: Safari/WebKit supports backdrop-filter and
  // is not Firefox, but does NOT composite the displacement filter and must
  // degrade. canRefract is true only for the Chromium full-effect tier.
  const canRefract = supportsBackdropFilter && supportsSvgBackdropDisplacement;

  return {
    supportsBackdropFilter,
    isChromium,
    supportsSvgBackdropDisplacement,
    isFirefox,
    prefersReducedMotion,
    prefersReducedTransparency,
    prefersContrastMore,
    canRefract,
  };
}
