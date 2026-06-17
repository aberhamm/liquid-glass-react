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

import { useEffect, useState } from 'react';

/** The media query string this hook owns. */
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

/**
 * Live reduced-transparency state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-reduced-transparency: reduce)` value, updating on OS-level changes.
 */
export function useReducedTransparency(): boolean {
  // Conservative no-reduction default keeps SSR and the first client render in
  // agreement; the mount effect upgrades to the real value.
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(REDUCED_TRANSPARENCY_QUERY);

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
