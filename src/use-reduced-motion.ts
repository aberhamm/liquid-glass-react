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

import { useEffect, useState } from 'react';

/** The media query string this hook owns. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Live reduced-motion state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-reduced-motion: reduce)` value, updating on OS-level changes.
 */
export function useReducedMotion(): boolean {
  // Conservative no-motion default keeps SSR and the first client render in
  // agreement; the mount effect upgrades to the real value.
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(REDUCED_MOTION_QUERY);

    // Sync once on mount (the SSR default may now be stale).
    setReduced(mql.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };

    // addEventListener is the modern API; addListener is the deprecated
    // fallback for older Safari/WebKit that predate it.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}
