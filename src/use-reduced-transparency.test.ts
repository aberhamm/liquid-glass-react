import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducedTransparency } from './use-reduced-transparency';

/**
 * Build a controllable `MediaQueryList` whose `change` listeners can be fired
 * by the test. Only responds `matches: true` to the reduced-transparency query;
 * everything else is `false`. Captures `change` listeners so a mid-session OS
 * toggle can be simulated.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-transparency: reduce)',
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
      // Only the reduced-transparency query is wired; others report false.
      if (query.includes('prefers-reduced-transparency: reduce')) {
        return mql;
      }
      return { ...mql, matches: false, media: query };
    }),
  );

  return {
    /** Simulate an OS-level toggle of the reduce-transparency setting. */
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

describe('useReducedTransparency', () => {
  it('returns false when the setting is off', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedTransparency());
    expect(result.current).toBe(false);
  });

  it('syncs to true on mount when the setting is on', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedTransparency());
    expect(result.current).toBe(true);
  });

  it('reacts to a mid-session OS toggle via the change event', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useReducedTransparency());
    expect(result.current).toBe(false);

    act(() => mm.fire(true));
    expect(result.current).toBe(true);

    act(() => mm.fire(false));
    expect(result.current).toBe(false);
  });

  it('removes its change listener on unmount', () => {
    const mm = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedTransparency());
    expect(mm.mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(mm.mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('defaults to false (SSR-safe) when matchMedia is unavailable', () => {
    // No matchMedia on window: the hook must not throw and must stay false.
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedTransparency());
    expect(result.current).toBe(false);
  });
});
