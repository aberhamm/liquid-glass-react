/**
 * `useReducedMotion()` — the SINGLE live source of reduced-motion state.
 *
 * This hook is authoritative for the whole library (plan 005 eng-review):
 *
 * - It subscribes to `matchMedia('(prefers-reduced-motion: reduce)')` AND its
 *   `'change'` event, so it reacts when the user toggles the OS "Reduce motion"
 *   setting mid-session — not just on mount.
 * - It is SSR-safe: it returns `false` (no-motion default) before mount and when
 *   `window` / `matchMedia` are unavailable, so server and first-client render
 *   agree and never crash.
 *
 * Every motion-aware consumer — {@link useMousePosition} (005), the
 * unsupported-browser fallback path (006), and the segmented control (012) —
 * reads reduced-motion state through THIS hook. No other code path may call
 * `matchMedia('(prefers-reduced-motion: reduce)')` reactively. (The point-in-time
 * `prefersReducedMotion` snapshot in `capabilities.ts` may stay for one-shot
 * detection, but it is not the live reactive source.)
 */

import { useMediaQuery } from './use-media-query';

/** The media query string this hook owns. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Live reduced-motion state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-reduced-motion: reduce)` value, updating on OS-level changes.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
