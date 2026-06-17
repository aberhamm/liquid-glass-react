import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersContrast } from './use-prefers-contrast';

/**
 * Build a controllable `MediaQueryList` whose `change` listeners can be fired
 * by the test. Only responds `matches: true` to the prefers-contrast query;
 * everything else is `false` (query-specific so the a11y axes — reduced-motion,
 * reduced-transparency, contrast — stay independent). Captures `change`
 * listeners so a mid-session OS toggle can be simulated.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-contrast: more)',
    onchange: null,
    addEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      // Only the prefers-contrast query is wired; others report false.
      if (query.includes('prefers-contrast: more')) {
        return mql;
      }
      return { ...mql, matches: false, media: query };
    }),
  );

  return {
    /** Simulate an OS-level toggle of the increase-contrast setting. */
    fire(next: boolean) {
      matches = next;
      for (const cb of listeners) {
        cb({ matches: next } as MediaQueryListEvent);
      }
    },
    mql,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePrefersContrast', () => {
  it('returns false when the setting is off', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => usePrefersContrast());
    expect(result.current).toBe(false);
  });

  it('syncs to true on mount when the setting is on', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrefersContrast());
    expect(result.current).toBe(true);
  });

  it('reacts to a mid-session OS toggle via the change event', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => usePrefersContrast());
    expect(result.current).toBe(false);

    act(() => mm.fire(true));
    expect(result.current).toBe(true);

    act(() => mm.fire(false));
    expect(result.current).toBe(false);
  });

  it('removes its change listener on unmount', () => {
    const mm = installMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersContrast());
    expect(mm.mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(mm.mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('defaults to false (SSR-safe) when matchMedia is unavailable', () => {
    // No matchMedia on window: the hook must not throw and must stay false.
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => usePrefersContrast());
    expect(result.current).toBe(false);
  });
});
