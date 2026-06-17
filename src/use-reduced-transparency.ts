/**
 * `useReducedTransparency()` — the SINGLE live source of reduced-transparency state.
 *
 * This hook is authoritative for the whole library (plan 013), mirroring
 * `useReducedMotion` (005) exactly:
 *
 * - It subscribes to `matchMedia('(prefers-reduced-transparency: reduce)')` AND
 *   its `'change'` event, so it reacts when the user toggles the OS "Reduce
 *   transparency" setting mid-session — not just on mount.
 * - It is SSR-safe: it returns `false` (no-reduction default) before mount and
 *   when `window` / `matchMedia` are unavailable, so server and first-client
 *   render agree and never crash. Browsers that don't understand the query
 *   report `matches: false`, so the conservative default holds there too.
 *
 * When this returns `true`, `<LiquidGlass>` forces the existing no-filter path
 * (omitting the SVG `url(#id)` refraction) and raises the surface fill opacity
 * for a frostier, more-opaque result. No other code path may call
 * `matchMedia('(prefers-reduced-transparency: reduce)')` reactively. (The
 * point-in-time `prefersReducedTransparency` snapshot in `capabilities.ts` may
 * stay for one-shot detection, but it is not the live reactive source.)
 */

import { useMediaQuery } from './use-media-query';

/** The media query string this hook owns. */
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

/**
 * Live reduced-transparency state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-reduced-transparency: reduce)` value, updating on OS-level changes.
 */
export function useReducedTransparency(): boolean {
  return useMediaQuery(REDUCED_TRANSPARENCY_QUERY);
}
