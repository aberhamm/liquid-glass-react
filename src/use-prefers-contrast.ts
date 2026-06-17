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

import { useEffect, useState } from 'react';

/** The media query string this hook owns. */
const PREFERS_CONTRAST_QUERY = '(prefers-contrast: more)';

/**
 * Live increased-contrast state.
 *
 * @returns `false` during SSR / before mount, then the real
 * `(prefers-contrast: more)` value, updating on OS-level changes.
 */
export function usePrefersContrast(): boolean {
  // Conservative no-increase default keeps SSR and the first client render in
  // agreement; the mount effect upgrades to the real value.
  const [contrast, setContrast] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(PREFERS_CONTRAST_QUERY);

    // Sync once on mount (the SSR default may now be stale).
    setContrast(mql.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setContrast(event.matches);
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

  return contrast;
}
