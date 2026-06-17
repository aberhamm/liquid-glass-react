/**
 * `usePrefersContrast()` — the SINGLE live source of increased-contrast state.
 *
 * This hook is authoritative for the whole library (plan 014), mirroring
 * `useReducedTransparency` (013) and `useReducedMotion` (005) exactly:
 *
 * - It subscribes to `matchMedia('(prefers-contrast: more)')` AND its `'change'`
 *   event, so it reacts when the user toggles the OS "Increase contrast" setting
 *   mid-session — not just on mount.
 * - It is SSR-safe: it returns `false` (no-increase default) before mount and
 *   when `window` / `matchMedia` are unavailable, so server and first-client
 *   render agree and never crash. Browsers that don't understand the query report
 *   `matches: false`, so the conservative default holds there too.
 *
 * When this returns `true`, `<LiquidGlass>` adds a SOLID, visible inset border,
 * raises content legibility (a more-opaque scheme-aware surface fill), and tones
 * down decorative saturation/aberration that harms contrast. It is an axis
 * ORTHOGONAL to the 3 capability tiers AND to reduced-transparency (013) — both
 * a11y axes may be active at once and must stay legible and shift-free. No other
 * code path may call `matchMedia('(prefers-contrast: more)')` reactively. (The
 * point-in-time `prefersContrastMore` snapshot in `capabilities.ts` may stay for
 * one-shot detection, but it is not the live reactive source.)
 */

import { useMediaQuery } from './use-media-query';

/** The media query string this hook owns. */
const PREFERS_CONTRAST_QUERY = '(prefers-contrast: more)';

/**
 * Live increased-contrast state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-contrast: more)` value, updating on OS-level changes.
 */
export function usePrefersContrast(): boolean {
  return useMediaQuery(PREFERS_CONTRAST_QUERY);
}
