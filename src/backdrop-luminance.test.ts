import { act, renderHook } from '@testing-library/react';
import { type RefObject, createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BackdropSample,
  LIGHT_DARK_THRESHOLD,
  UNSAMPLED,
  averageColorToSample,
  createCanvasSnapshotStrategy,
  domBackgroundStrategy,
  luminanceToScheme,
  parseCssColor,
  relativeLuminance,
  safeSample,
  sampleBackdropLuminance,
} from './backdrop-luminance';
import { useBackdropLuminance } from './use-backdrop-luminance';

// ---------------------------------------------------------------------------
// Pure luminance / verdict math
// ---------------------------------------------------------------------------

describe('relativeLuminance', () => {
  it('returns 0 for black and 1 for white', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 10);
  });

  it('weights green most and blue least (Rec. 709)', () => {
    const green = relativeLuminance(0, 255, 0);
    const red = relativeLuminance(255, 0, 0);
    const blue = relativeLuminance(0, 0, 255);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });

  it('matches the known WCAG value for mid-gray (#808080)', () => {
    // sRGB 128 -> linear ~0.21586 -> luminance equals that (gray => all equal).
    expect(relativeLuminance(128, 128, 128)).toBeCloseTo(0.2159, 3);
  });
});

describe('luminanceToScheme', () => {
  it('classifies at the documented 0.5 threshold (inclusive => light)', () => {
    expect(LIGHT_DARK_THRESHOLD).toBe(0.5);
    expect(luminanceToScheme(0.5)).toBe('light');
    expect(luminanceToScheme(0.49999)).toBe('dark');
    expect(luminanceToScheme(1)).toBe('light');
    expect(luminanceToScheme(0)).toBe('dark');
  });
});

describe('averageColorToSample', () => {
  it('builds a sampled result with luminance + scheme', () => {
    expect(averageColorToSample({ r: 255, g: 255, b: 255 })).toEqual({
      luminance: expect.closeTo(1, 5),
      scheme: 'light',
      sampled: true,
    });
    expect(averageColorToSample({ r: 0, g: 0, b: 0 })).toEqual({
      luminance: 0,
      scheme: 'dark',
      sampled: true,
    });
  });
});

describe('parseCssColor', () => {
  it('parses rgb() and rgba() comma syntax', () => {
    expect(parseCssColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseCssColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it('parses space/slash syntax and percent alpha', () => {
    expect(parseCssColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it('treats transparent / empty / unknown as alpha 0', () => {
    expect(parseCssColor('transparent').a).toBe(0);
    expect(parseCssColor('').a).toBe(0);
    expect(parseCssColor(null).a).toBe(0);
    expect(parseCssColor('color(display-p3 1 0 0)').a).toBe(0);
  });

  it('clamps channels to byte range', () => {
    expect(parseCssColor('rgb(300, -5, 12)')).toEqual({ r: 255, g: 0, b: 12, a: 1 });
  });
});

// ---------------------------------------------------------------------------
// safeSample — total taint/error guard
// ---------------------------------------------------------------------------

describe('safeSample', () => {
  it('returns the strategy result when it succeeds', () => {
    const ok = averageColorToSample({ r: 255, g: 255, b: 255 });
    expect(safeSample(() => ok, { x: 0, y: 0 })).toBe(ok);
  });

  it('returns UNSAMPLED when the strategy throws SecurityError, without rethrowing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = (): never => {
      throw new DOMException('Tainted canvases may not be read', 'SecurityError');
    };
    expect(safeSample(throwing, { x: 0, y: 0 })).toEqual(UNSAMPLED);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// domBackgroundStrategy — the canvas-free default
// ---------------------------------------------------------------------------

// jsdom does NOT implement `document.elementsFromPoint`, so we install a fresh
// stub function on every relevant test and remove it afterward — this is the
// canvas/sampling boundary the learning [8] tells us to mock.
function setElementsFromPoint(els: Element[]): void {
  (document as unknown as Record<string, unknown>).elementsFromPoint = () => els;
}

function removeElementsFromPoint(): void {
  // biome-ignore lint/performance/noDelete: test cleanup must remove the stubbed method
  delete (document as unknown as Record<string, unknown>).elementsFromPoint;
}

function stubElementsFromPoint(
  layers: Array<{ backgroundColor: string; backgroundImage?: string }>,
): Element[] {
  const els = layers.map((l) => {
    const el = document.createElement('div');
    // Attach the computed style our strategy reads via a per-element stub below.
    (el as unknown as Record<string, unknown>).__style = {
      backgroundColor: l.backgroundColor,
      backgroundImage: l.backgroundImage ?? 'none',
    };
    return el;
  });
  setElementsFromPoint(els);
  vi.stubGlobal('getComputedStyle', (el: Element) => {
    return (el as unknown as Record<string, unknown>).__style as CSSStyleDeclaration;
  });
  return els;
}

describe('domBackgroundStrategy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    removeElementsFromPoint();
  });

  it('returns UNSAMPLED when no element is under the point', () => {
    setElementsFromPoint([]);
    expect(domBackgroundStrategy({ x: 0, y: 0 })).toEqual(UNSAMPLED);
  });

  it('reads a fully-opaque solid background and stops there', () => {
    stubElementsFromPoint([
      { backgroundColor: 'rgb(0, 0, 0)' },
      { backgroundColor: 'rgb(255, 255, 255)' }, // behind: must be ignored
    ]);
    const s = domBackgroundStrategy({ x: 1, y: 1 });
    expect(s.sampled).toBe(true);
    expect(s.scheme).toBe('dark');
    expect(s.luminance).toBe(0);
  });

  it('composites a translucent layer over the layer behind it', () => {
    // 50% white over opaque black => mid gray.
    stubElementsFromPoint([
      { backgroundColor: 'rgba(255, 255, 255, 0.5)' },
      { backgroundColor: 'rgb(0, 0, 0)' },
    ]);
    const s = domBackgroundStrategy({ x: 1, y: 1 });
    expect(s.sampled).toBe(true);
    // ~127 gray => luminance ~0.21 => dark.
    expect(s.scheme).toBe('dark');
    expect(s.luminance).toBeCloseTo(relativeLuminance(127.5, 127.5, 127.5), 5);
  });

  it('treats an opaque background-image as a neutral mid-gray occluder', () => {
    stubElementsFromPoint([
      { backgroundColor: 'transparent', backgroundImage: 'url(photo.jpg)' },
      { backgroundColor: 'rgb(255, 255, 255)' },
    ]);
    const s = domBackgroundStrategy({ x: 1, y: 1 });
    expect(s.sampled).toBe(true);
    // mid-gray 128 => same luminance as #808080.
    expect(s.luminance).toBeCloseTo(relativeLuminance(128, 128, 128), 5);
  });

  it('skips the ignored element (the glass surface itself)', () => {
    const els = stubElementsFromPoint([
      { backgroundColor: 'rgb(0, 0, 0)' }, // glass surface
      { backgroundColor: 'rgb(255, 255, 255)' }, // real backdrop
    ]);
    const s = domBackgroundStrategy({ x: 1, y: 1 }, els[0]);
    expect(s.scheme).toBe('light');
    expect(s.luminance).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// createCanvasSnapshotStrategy — taint path
// ---------------------------------------------------------------------------

describe('createCanvasSnapshotStrategy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('averages painted pixels into a sample (mocked canvas)', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
    const ctx = {
      getImageData: vi.fn(() => ({ data })),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement);

    const strategy = createCanvasSnapshotStrategy(() => {}, 1);
    const s = strategy({ x: 0, y: 0 });
    expect(s.sampled).toBe(true);
    expect(s.scheme).toBe('light');
  });

  it('throws SecurityError from getImageData when tainted (caught by safeSample)', () => {
    const ctx = {
      getImageData: vi.fn(() => {
        throw new DOMException('Tainted', 'SecurityError');
      }),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement);

    const strategy = createCanvasSnapshotStrategy(() => {}, 1);
    // Raw strategy throws...
    expect(() => strategy({ x: 0, y: 0 })).toThrow(/Tainted/);
    // ...but the public entry point catches it.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(sampleBackdropLuminance({ x: 0, y: 0 }, { strategy })).toEqual(UNSAMPLED);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useBackdropLuminance — hook behavior
// ---------------------------------------------------------------------------

function rectFor(el: HTMLElement): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('useBackdropLuminance — SSR / first paint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns UNSAMPLED on the first render (no measurement during render)', () => {
    const efp = vi.fn(() => [] as Element[]);
    (document as unknown as Record<string, unknown>).elementsFromPoint = efp;
    const ref = createRef<HTMLElement>() as RefObject<HTMLElement | null>;
    let firstRender: BackdropSample | undefined;
    renderHook(() => {
      const s = useBackdropLuminance(ref);
      firstRender ??= s;
      return s;
    });
    expect(firstRender).toEqual(UNSAMPLED);
    // elementsFromPoint is never called during render — only the mount effect
    // (ref.current is null here, so even the effect samples nothing).
    expect(efp).not.toHaveBeenCalled();
    // biome-ignore lint/performance/noDelete: test cleanup must remove the stubbed method
    delete (document as unknown as Record<string, unknown>).elementsFromPoint;
  });

  it('returns UNSAMPLED when disabled', () => {
    const el = document.createElement('div');
    rectFor(el);
    const ref = { current: el } as RefObject<HTMLElement | null>;
    const strategy = vi.fn(() => averageColorToSample({ r: 0, g: 0, b: 0 }));
    const { result } = renderHook(() => useBackdropLuminance(ref, { disabled: true, strategy }));
    expect(result.current).toEqual(UNSAMPLED);
    expect(strategy).not.toHaveBeenCalled();
  });
});

describe('useBackdropLuminance — sampling after mount', () => {
  let rafCbs: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCbs = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushRaf(): void {
    const cbs = rafCbs;
    rafCbs = [];
    for (const cb of cbs) {
      cb(0);
    }
  }

  it('samples the backdrop in an effect after mount via the custom strategy', () => {
    const el = document.createElement('div');
    rectFor(el);
    const ref = { current: el } as RefObject<HTMLElement | null>;
    const strategy = vi.fn(() => averageColorToSample({ r: 255, g: 255, b: 255 }));

    const { result } = renderHook(() => useBackdropLuminance(ref, { strategy }));
    expect(result.current).toEqual(UNSAMPLED);

    act(() => {
      flushRaf();
    });

    expect(strategy).toHaveBeenCalledTimes(1);
    expect(strategy).toHaveBeenCalledWith({ x: 50, y: 50 });
    expect(result.current.sampled).toBe(true);
    expect(result.current.scheme).toBe('light');
  });

  it('coalesces rapid scroll triggers to one sample per frame (throttle)', () => {
    const el = document.createElement('div');
    rectFor(el);
    const ref = { current: el } as RefObject<HTMLElement | null>;
    const strategy = vi.fn(() => averageColorToSample({ r: 0, g: 0, b: 0 }));

    renderHook(() => useBackdropLuminance(ref, { strategy }));

    // Flush the initial mount sample.
    act(() => {
      flushRaf();
    });
    expect(strategy).toHaveBeenCalledTimes(1);

    // Fire many scroll events before the next frame — they must coalesce.
    act(() => {
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new Event('scroll'));
      }
    });
    // Only ONE rAF was scheduled for all 20 events.
    expect(rafCbs.length).toBe(1);

    act(() => {
      flushRaf();
    });
    // => exactly one additional sample, not 20.
    expect(strategy).toHaveBeenCalledTimes(2);
  });

  it('taint path: a strategy that throws SecurityError => sampled:false, no throw, no console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = document.createElement('div');
    rectFor(el);
    const ref = { current: el } as RefObject<HTMLElement | null>;
    const strategy = vi.fn(() => {
      throw new DOMException('Tainted canvases may not be read', 'SecurityError');
    });

    const { result } = renderHook(() => useBackdropLuminance(ref, { strategy }));
    act(() => {
      flushRaf();
    });

    expect(strategy).toHaveBeenCalled();
    expect(result.current).toEqual(UNSAMPLED);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('removes scroll/resize listeners on unmount', () => {
    const el = document.createElement('div');
    rectFor(el);
    const ref = { current: el } as RefObject<HTMLElement | null>;
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBackdropLuminance(ref, { strategy: () => UNSAMPLED }));
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('scroll');
    expect(removed).toContain('resize');
  });
});
