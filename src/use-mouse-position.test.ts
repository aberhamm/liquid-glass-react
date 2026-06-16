import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMousePosition } from './use-mouse-position';

// matchMedia is mutable per-test so we can toggle reduced-motion.
function installMatchMedia(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  installMatchMedia(false);
  // Default: not a touch device.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  // Remove any ontouchstart left from a prior test so non-touch is the default.
  if ('ontouchstart' in window) {
    // biome-ignore lint/performance/noDelete: test cleanup must truly remove the key
    delete (window as unknown as Record<string, unknown>).ontouchstart;
  }
  // Stub layout for center calculations.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height: 100,
    top: 100,
    left: 100,
    right: 200,
    bottom: 200,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useMousePosition — controlled (globalMousePos / mouseOffset)', () => {
  it('uses globalMousePos verbatim and the supplied mouseOffset', () => {
    const { result } = renderHook(() =>
      useMousePosition({
        globalMousePos: { x: 300, y: 200 },
        mouseOffset: { x: 42, y: -7 },
      }),
    );
    expect(result.current.isActive).toBe(true);
    expect(result.current.mousePos).toEqual({ x: 300, y: 200 });
    expect(result.current.offset).toEqual({ x: 42, y: -7 });
  });

  it('derives offset from element center when mouseOffset is omitted', () => {
    const el = document.createElement('div');
    const { result } = renderHook(() =>
      useMousePosition({ globalMousePos: { x: 200, y: 200 }, container: el }),
    );
    // Center of the stubbed rect is (150,150); pos (200,200) => offset (50,50).
    expect(result.current.offset).toEqual({ x: 50, y: 50 });
    expect(result.current.isActive).toBe(true);
  });

  it('does NOT attach an internal mousemove listener when controlled', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useMousePosition({ globalMousePos: { x: 1, y: 1 } }));
    const mouseMoveCalls = addSpy.mock.calls.filter((c) => c[0] === 'mousemove');
    expect(mouseMoveCalls.length).toBe(0);
  });
});

describe('useMousePosition — internal tracking', () => {
  it('updates offset from a synthetic mousemove relative to element center', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const { result } = renderHook(() => useMousePosition({ container: el }));

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 180, clientY: 170 }));
    });

    // Center (150,150); offset = (180-150, 170-150) = (30, 20).
    expect(result.current.isActive).toBe(true);
    expect(result.current.mousePos).toEqual({ x: 180, y: 170 });
    expect(result.current.offset).toEqual({ x: 30, y: 20 });
    el.remove();
  });
});

describe('useMousePosition — reduced motion', () => {
  it('returns neutral, inactive values when reduced-motion is set', () => {
    installMatchMedia(true);
    const { result } = renderHook(() =>
      useMousePosition({ globalMousePos: { x: 300, y: 300 }, mouseOffset: { x: 50, y: 50 } }),
    );
    expect(result.current.isActive).toBe(false);
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
    expect(result.current.mousePos).toEqual({ x: 0, y: 0 });
  });
});

describe('useMousePosition — touch devices', () => {
  it('disables cursor-follow on a touch device', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    const { result } = renderHook(() =>
      useMousePosition({ globalMousePos: { x: 300, y: 300 }, mouseOffset: { x: 50, y: 50 } }),
    );
    // After the mount effect sets isTouch, motion is suppressed.
    expect(result.current.isActive).toBe(false);
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
  });
});

describe('useMousePosition — SSR safety', () => {
  it('returns neutral defaults without crashing (no window-dependent throw)', () => {
    // We cannot truly delete window under jsdom, but the hook must at minimum
    // return neutral defaults on first render before any pointer event.
    const { result } = renderHook(() => useMousePosition());
    expect(result.current).toEqual({
      mousePos: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      isActive: false,
    });
  });
});
