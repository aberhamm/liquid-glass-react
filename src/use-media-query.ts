/**
 * `useMediaQuery(query)` — internal shared primitive for the library's live,
 * SSR-safe media-query hooks.
 *
 * This is NOT a public export. It exists only to remove the triplicated
 * `matchMedia` + `'change'`-listener + SSR-default boilerplate behind the three
 * authoritative a11y hooks ({@link useReducedMotion} 005,
 * {@link useReducedTransparency} 013, {@link usePrefersContrast} 014). Each of
 * those keeps its own public name, its own owned query constant, and its own
 * `boolean` return contract; they merely delegate the mechanics here.
 *
 * Behavior (identical to the hand-rolled hooks it replaces):
 *
 * - Returns `false` during SSR / before mount and when `window` / `matchMedia`
 *   are unavailable, so server and first-client render agree and never crash.
 *   Browsers that don't understand the query report `matches: false`, so the
 *   conservative default holds there too.
 * - Subscribes to the query's `'change'` event, so it reacts when the user
 *   toggles the OS setting mid-session — not just on mount.
 * - Prefers the modern `addEventListener('change', …)` API and falls back to the
 *   deprecated `addListener`/`removeListener` for older Safari/WebKit.
 */

import { useEffect, useState } from 'react';

/**
 * Live boolean state for a CSS media query string.
 *
 * @param query A media query (e.g. `'(prefers-reduced-motion: reduce)'`).
 * @returns `false` during SSR / before mount, then the real `matches` value,
 * updating on OS-level changes.
 */
export function useMediaQuery(query: string): boolean {
  // Conservative `false` default keeps SSR and the first client render in
  // agreement; the mount effect upgrades to the real value.
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(query);

    // Sync once on mount (the SSR default may now be stale).
    setMatches(mql.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // addEventListener is the modern API; addListener is the deprecated
    // fallback for older Safari/WebKit that predate it.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
