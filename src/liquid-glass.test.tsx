import { act, fireEvent, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the capability hook so tests control `canRefract` deterministically.
const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

// The real conservative snapshot used for the SSR/first-paint render — imported
// (not mocked) so the hydration test diffs the EXACT markup the server produces.
import { getConservativeGlassCapabilities } from './capabilities';
import type { GlassCapabilities } from './types';

// Import AFTER the mock is registered.
import { LiquidGlass } from './liquid-glass';

/**
 * Build a {@link GlassCapabilities} for the three render tiers (plan 006):
 *   - `canRefract: true`  → Tier 1 full (backdrop-filter implied true).
 *   - `canRefract: false, supportsBackdropFilter: true`  → Tier 2 frosted.
 *   - `canRefract: false, supportsBackdropFilter: false` → Tier 3 solid.
 * `supportsBackdropFilter` defaults to `canRefract` so a single-arg `caps(true)`
 * yields the full tier and `caps(false)` the most degraded one unless overridden.
 */
function caps(canRefract: boolean, supportsBackdropFilter = canRefract): GlassCapabilities {
  return {
    supportsBackdropFilter,
    isChromium: canRefract,
    supportsSvgBackdropDisplacement: canRefract,
    isFirefox: false,
    prefersReducedMotion: false,
    canRefract,
  };
}

/**
 * jsdom does no layout, so `getBoundingClientRect()` returns zeros. Stub it on
 * the prototype to return non-zero dims so the component's mount measurement
 * resolves and a filter can attach.
 */
function stubLayout(width = 320, height = 96): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/**
 * Install a controllable `matchMedia` so motion-aware hooks (`useReducedMotion`,
 * `usePrefersDark`) resolve deterministically. `reduced` toggles
 * `(prefers-reduced-motion: reduce)`.
 */
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
  mockCapabilities.mockReturnValue(caps(true));
  stubLayout();
  installMatchMedia(false);
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  // jsdom always defines `ontouchstart` on window (an IDL handler attribute),
  // which would make the touch heuristic ('ontouchstart' in window) falsely true.
  // Remove it so the default test environment reads as a non-touch desktop.
  if ('ontouchstart' in window) {
    // biome-ignore lint/performance/noDelete: test cleanup must truly remove the key
    delete (window as unknown as Record<string, unknown>).ontouchstart;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Find the glass surface element (carries the backdrop-filter). */
function getSurface(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-lg-surface]');
  if (!el) throw new Error('surface element not found');
  return el;
}

/**
 * Read an inline style property as a string. jsdom's `CSSStyleDeclaration`
 * returns `undefined` for camelCase keys that were never set (and React writes
 * styles via the camelCase accessor, so `getPropertyValue` doesn't see them).
 * This coalesces unset values to `''` so tier-presence/absence assertions are
 * robust regardless of which quirk jsdom exhibits.
 */
function styleOf(el: HTMLElement, key: string): string {
  const v = (el.style as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

describe('<LiquidGlass> rendering', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <LiquidGlass>
        <button type="button">Buy</button>
      </LiquidGlass>,
    );
    expect(getByText('Buy')).toBeInTheDocument();
  });

  it('honors className, style, padding, cornerRadius, and onClick', () => {
    const onClick = vi.fn();
    const { container } = render(
      <LiquidGlass
        className="my-glass"
        style={{ color: 'rebeccapurple' }}
        padding="8px 16px"
        cornerRadius={24}
        onClick={onClick}
      >
        <span>hi</span>
      </LiquidGlass>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass('my-glass');
    expect(wrapper.style.color).toBe('rebeccapurple');
    expect(wrapper.style.padding).toBe('8px 16px');
    expect(wrapper.style.borderRadius).toBe('24px');
    wrapper.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('accepts a numeric cornerRadius as px and the default 999 radius', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.borderRadius).toBe('999px');
  });
});

describe('capability gating (filter presence)', () => {
  it('attaches filter: url(#id) in backdrop-filter when canRefract is true and dims measured', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const value = surface.style.backdropFilter;
    expect(value).toMatch(/url\(#lg-[^)]+\)/);
    // The <filter> element with that id must exist.
    const match = value.match(/url\(#(lg-[^)]+)\)/);
    expect(match).not.toBeNull();
    const id = match?.[1] as string;
    expect(container.querySelector(`#${id}`)).not.toBeNull();
  });

  it('omits url(#id) when canRefract is false but keeps blur/saturate', () => {
    // Tier 2 frosted: backdrop-filter supported, refraction not.
    mockCapabilities.mockReturnValue(caps(false, true));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const value = surface.style.backdropFilter;
    expect(value).not.toMatch(/url\(#/);
    expect(value).toMatch(/blur\(/);
    expect(value).toMatch(/saturate\(/);
    // No SVG filter rendered at all.
    expect(container.querySelector('filter')).toBeNull();
  });

  it('uses the sanitized (colon-free) filter id', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const filter = container.querySelector('filter');
    expect(filter).not.toBeNull();
    const id = filter?.getAttribute('id') ?? '';
    expect(id).toMatch(/^lg-/);
    expect(id).not.toContain(':');
  });

  it('does not attach a filter when layout reports zero dimensions', () => {
    // canRefract is true (default), but the element measures as 0x0 — quantize()
    // would otherwise floor that to a bogus 16x16 cell. No filter should attach.
    stubLayout(0, 0);
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    expect(container.querySelector('filter')).toBeNull();
    expect(getSurface(container).style.backdropFilter).not.toMatch(/url\(#/);
  });
});

describe('feDisplacementMap configuration', () => {
  it('uses xChannelSelector="R" and yChannelSelector="B"', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const maps = container.querySelectorAll('feDisplacementMap');
    expect(maps.length).toBeGreaterThan(0);
    for (const map of maps) {
      expect(map.getAttribute('xChannelSelector')).toBe('R');
      expect(map.getAttribute('yChannelSelector')).toBe('B');
    }
  });

  it('uses primitiveUnits="userSpaceOnUse" (pixel space, not objectBoundingBox)', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const filter = container.querySelector('filter');
    expect(filter?.getAttribute('primitiveUnits')).toBe('userSpaceOnUse');
  });
});

describe('chromatic aberration scaling', () => {
  function scalesFor(container: HTMLElement): number[] {
    return [...container.querySelectorAll('feDisplacementMap')].map((m) =>
      Number(m.getAttribute('scale')),
    );
  }

  it('scales per-channel offsets with aberrationIntensity', () => {
    const low = render(
      <LiquidGlass aberrationIntensity={1}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const lowScales = scalesFor(low.container);
    low.unmount();

    const high = render(
      <LiquidGlass aberrationIntensity={10}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const highScales = scalesFor(high.container);

    // displacementScale defaults to 70. With intensity i: R=70+i, G=70, B=70-i.
    // Low (i=1): [71, 70, 69]; High (i=10): [80, 70, 60].
    const lowSpread = Math.max(...lowScales) - Math.min(...lowScales);
    const highSpread = Math.max(...highScales) - Math.min(...highScales);
    expect(highSpread).toBeGreaterThan(lowSpread);
    expect(lowSpread).toBeCloseTo(2, 5); // (71 - 69)
    expect(highSpread).toBeCloseTo(20, 5); // (80 - 60)
  });

  it('recombines additively via feComposite arithmetic (no screen blend)', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const composites = [...container.querySelectorAll('feComposite')];
    const arithmetic = composites.filter((c) => c.getAttribute('operator') === 'arithmetic');
    expect(arithmetic.length).toBeGreaterThanOrEqual(2);
    for (const c of arithmetic) {
      expect(c.getAttribute('k2')).toBe('1');
      expect(c.getAttribute('k3')).toBe('1');
    }
    // No feBlend screen recombination.
    const blends = [...container.querySelectorAll('feBlend')];
    expect(blends.some((b) => b.getAttribute('mode') === 'screen')).toBe(false);
  });
});

describe('backdrop-filter composition', () => {
  it('reflects saturation and blur in the backdrop-filter string', () => {
    const { container } = render(
      <LiquidGlass saturation={200} blurAmount={0.5}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const value = getSurface(container).style.backdropFilter;
    expect(value).toMatch(/saturate\(200%\)/);
    // 0.5 * 16 = 8px (overLight false => no extra multiplier).
    expect(value).toMatch(/blur\(8px\)/);
  });

  it('increases blur when overLight is true', () => {
    const base = render(
      <LiquidGlass blurAmount={0.5} overLight={false}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const baseBlur = base.container
      .querySelector<HTMLElement>('[data-lg-surface]')
      ?.style.backdropFilter.match(/blur\(([\d.]+)px\)/)?.[1];
    base.unmount();

    const lit = render(
      <LiquidGlass blurAmount={0.5} overLight>
        <span>hi</span>
      </LiquidGlass>,
    );
    const litBlur = lit.container
      .querySelector<HTMLElement>('[data-lg-surface]')
      ?.style.backdropFilter.match(/blur\(([\d.]+)px\)/)?.[1];

    expect(Number(litBlur)).toBeGreaterThan(Number(baseBlur));
  });
});

describe('overLight halves the effective displacement scale', () => {
  function gScaleFor(container: HTMLElement): number {
    // The G channel pass uses the un-offset effective scale (no aberration term).
    // It is the middle of the three feDisplacementMap scales.
    const scales = [...container.querySelectorAll('feDisplacementMap')]
      .map((m) => Number(m.getAttribute('scale')))
      .sort((a, b) => a - b);
    return scales[1] as number;
  }

  it('halves the G (center) channel scale when overLight is true vs false', () => {
    const off = render(
      <LiquidGlass displacementScale={80} overLight={false}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const offScale = gScaleFor(off.container);
    off.unmount();

    const on = render(
      <LiquidGlass displacementScale={80} overLight>
        <span>hi</span>
      </LiquidGlass>,
    );
    const onScale = gScaleFor(on.container);

    expect(offScale).toBe(80);
    expect(onScale).toBe(40);
    expect(onScale).toBe(offScale / 2);
  });
});

describe('turbulence mode', () => {
  it('renders feTurbulence and no feImage / no data: URL', () => {
    const { container } = render(
      <LiquidGlass mode="turbulence">
        <span>hi</span>
      </LiquidGlass>,
    );
    expect(container.querySelector('feTurbulence')).not.toBeNull();
    // No feImage-based displacement map and no embedded PNG data URL.
    const feImages = [...container.querySelectorAll('feImage')];
    const hasDataUrl = feImages.some((img) => (img.getAttribute('href') ?? '').startsWith('data:'));
    expect(hasDataUrl).toBe(false);
    expect(container.innerHTML).not.toContain('data:image/png');
  });

  it('still applies displacement and aberration in turbulence mode', () => {
    const { container } = render(
      <LiquidGlass mode="turbulence" displacementScale={50} aberrationIntensity={5}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const scales = [...container.querySelectorAll('feDisplacementMap')]
      .map((m) => Number(m.getAttribute('scale')))
      .sort((a, b) => a - b);
    // R=55, G=50, B=45.
    expect(scales).toEqual([45, 50, 55]);
  });
});

describe('non-turbulence modes use feImage with a generated map', () => {
  it('renders an feImage whose href is a PNG data URL', () => {
    const { container } = render(
      <LiquidGlass mode="standard">
        <span>hi</span>
      </LiquidGlass>,
    );
    const feImages = [...container.querySelectorAll('feImage')];
    const dataMap = feImages.find((img) =>
      (img.getAttribute('href') ?? '').startsWith('data:image/png'),
    );
    expect(dataMap).toBeDefined();
  });
});

describe('content isolation', () => {
  it('does not render children inside the element carrying the filter', () => {
    const { container, getByTestId } = render(
      <LiquidGlass>
        <span data-testid="child">crisp label</span>
      </LiquidGlass>,
    );
    const child = getByTestId('child');
    const surface = getSurface(container);
    // The surface carries the url(#id) filter; the child must NOT be inside it.
    expect(surface.style.backdropFilter).toMatch(/url\(#/);
    expect(surface.contains(child)).toBe(false);

    // Also assert the child lives in the dedicated content layer.
    const content = container.querySelector('[data-lg-content]');
    expect(content?.contains(child)).toBe(true);
  });
});

describe('elastic motion + rim lighting (plan 005)', () => {
  function getShadow(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-lg-shadow]');
    if (!el) throw new Error('drop-shadow element not found');
    return el;
  }

  it('renders the decoupled drop-shadow as a SIBLING of (not inside) the clipped surface', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const shadow = getShadow(container);

    // Structural guarantee: a same-node box-shadow would be clipped by the
    // surface's overflow:hidden + backdrop clip, so the outer glow must live on
    // a separate sibling. Assert they are siblings and neither contains the other.
    expect(surface.contains(shadow)).toBe(false);
    expect(shadow.contains(surface)).toBe(false);
    expect(shadow.parentElement).toBe(surface.parentElement);
    // The decoupled element actually carries the outer (non-inset) drop shadow.
    expect(shadow.style.boxShadow).toMatch(/rgba/);
    expect(shadow.style.boxShadow).not.toMatch(/inset/);
  });

  it('renders the pure-CSS bevel as an inset box-shadow on the surface, even without refraction', () => {
    mockCapabilities.mockReturnValue(caps(false));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // Bevel is inset — renders cross-browser regardless of canRefract.
    expect(surface.style.boxShadow).toMatch(/inset/);
  });

  it('writes a transform on the surface after a synthetic pointer move', () => {
    const { container } = render(
      <LiquidGlass elasticity={1}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);

    act(() => {
      // Wrapper center is (160,48) given the 320x96 stubbed rect; move well off
      // center but inside the activation radius so motion is non-trivial.
      fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
    });

    const transform = surface.style.transform;
    expect(transform).toMatch(/scale\(/);
    expect(transform).toMatch(/translate\(/);
    // A real (non-identity) scale: at least one axis differs from 1.
    expect(transform).not.toMatch(/scale\(1\.0000, 1\.0000\)/);
  });

  it('yields a neutral (identity) transform under reduced motion', () => {
    installMatchMedia(true);
    const { container } = render(
      <LiquidGlass elasticity={1}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);

    act(() => {
      fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
    });

    // Reduced motion suppresses tracking entirely: identity scale, zero translate.
    expect(surface.style.transform).toContain('translate(0.00px, 0.00px)');
    expect(surface.style.transform).toContain('scale(1.0000, 1.0000)');
  });

  it('renders the two rim highlight/border blend layers regardless of canRefract', () => {
    mockCapabilities.mockReturnValue(caps(false));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const highlight = container.querySelector<HTMLElement>('[data-lg-highlight]');
    const border = container.querySelector<HTMLElement>('[data-lg-border]');
    expect(highlight).not.toBeNull();
    expect(border).not.toBeNull();
    expect(highlight?.style.mixBlendMode).toBe('screen');
    expect(border?.style.mixBlendMode).toBe('overlay');
  });
});

// ---------------------------------------------------------------------------
// Plan 006 — tiered graceful degradation, console-cleanliness, layout stability,
// and SSR/hydration safety.
// ---------------------------------------------------------------------------

describe('graceful degradation — capability matrix (plan 006)', () => {
  /** Read the wrapper element's geometry-defining inline styles. */
  function geometry(container: HTMLElement): {
    padding: string;
    borderRadius: string;
    display: string;
  } {
    const wrapper = container.firstElementChild as HTMLElement;
    return {
      padding: wrapper.style.padding,
      borderRadius: wrapper.style.borderRadius,
      display: wrapper.style.display,
    };
  }

  it('TIER 1 (full): canRefract+backdrop-filter → url(#id) refraction + SVG <filter>', () => {
    mockCapabilities.mockReturnValue(caps(true));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bf = styleOf(surface, 'backdropFilter');
    expect(bf).toMatch(/url\(#lg-[^)]+\)/);
    expect(bf).toMatch(/blur\(/);
    expect(bf).toMatch(/saturate\(/);
    expect(container.querySelector('filter')).not.toBeNull();
    // Solid fallback fill is NOT used when the backdrop carries the look.
    expect(styleOf(surface, 'background')).toBe('');
  });

  it('TIER 2 (frosted): !canRefract, backdrop-filter supported → blur/saturate, bevel, NO filter', () => {
    mockCapabilities.mockReturnValue(caps(false, true));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bf = styleOf(surface, 'backdropFilter');
    // Frosted backdrop present but no refraction url and no <filter>.
    expect(bf).toMatch(/blur\(/);
    expect(bf).toMatch(/saturate\(/);
    expect(bf).not.toMatch(/url\(#/);
    expect(container.querySelector('filter')).toBeNull();
    expect(container.innerHTML).not.toMatch(/url\(#lg-/);
    // The inset-shadow glass bevel MUST be present in the fallback.
    expect(surface.style.boxShadow).toMatch(/inset/);
    // No solid fill — the blurred backdrop carries the frosted look.
    expect(styleOf(surface, 'background')).toBe('');
  });

  it('emits the -webkit-backdrop-filter prefix alongside backdrop-filter (frosted tier)', () => {
    // jsdom's CSSOM drops vendor-prefixed properties on read-back, so assert the
    // prefix on the SERVER-serialized markup (react-dom keeps both keys), proving
    // the component sets `WebkitBackdropFilter` for Safari/WebKit.
    mockCapabilities.mockReturnValue(caps(false, true));
    const html = renderToString(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    expect(html).toMatch(/backdrop-filter:blur\([^;]*saturate\([^;]*\)/);
    expect(html).toMatch(/-webkit-backdrop-filter:blur\([^;]*saturate\([^;]*\)/);
  });

  it('TIER 3 (solid): no backdrop-filter → translucent solid bg, NO backdrop-filter, NO filter', () => {
    mockCapabilities.mockReturnValue(caps(false, false));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // No backdrop-filter declaration at all (neither prefix).
    expect(styleOf(surface, 'backdropFilter')).toBe('');
    expect(styleOf(surface, 'webkitBackdropFilter')).toBe('');
    // A translucent solid background keeps content legible.
    const bg = styleOf(surface, 'background');
    expect(bg).toMatch(/rgba\(/);
    expect(bg).not.toBe('');
    // No SVG filter / no url(#id) anywhere.
    expect(container.querySelector('filter')).toBeNull();
    expect(container.innerHTML).not.toMatch(/url\(#lg-/);
    // Bevel still renders for polish.
    expect(surface.style.boxShadow).toMatch(/inset/);
  });

  it('keeps IDENTICAL box geometry (padding / border-radius / display) across all three tiers', () => {
    const render006 = (c: GlassCapabilities): ReturnType<typeof geometry> => {
      mockCapabilities.mockReturnValue(c);
      const { container, unmount } = render(
        <LiquidGlass padding="12px 20px" cornerRadius={28}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const geo = geometry(container);
      unmount();
      return geo;
    };

    const full = render006(caps(true));
    const frosted = render006(caps(false, true));
    const solid = render006(caps(false, false));

    expect(full.padding).toBe('12px 20px');
    expect(full.borderRadius).toBe('28px');
    // No layout shift: every tier writes the same geometry.
    expect(frosted).toEqual(full);
    expect(solid).toEqual(full);
  });

  it('reduced motion yields an identity transform in the fallback tiers too', () => {
    installMatchMedia(true);
    for (const c of [caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      const { container, unmount } = render(
        <LiquidGlass elasticity={1}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const surface = getSurface(container);
      act(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
      });
      expect(surface.style.transform).toContain('translate(0.00px, 0.00px)');
      expect(surface.style.transform).toContain('scale(1.0000, 1.0000)');
      unmount();
    }
  });
});

describe('console cleanliness across tiers (plan 006)', () => {
  it('renders every tier without console.error or console.warn', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      const { unmount } = render(
        <LiquidGlass mode="standard">
          <button type="button">Buy</button>
        </LiquidGlass>,
      );
      // Exercise a pointer move so the motion path runs in each tier too.
      act(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
      });
      unmount();
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('SSR safety — renderToString → hydrateRoot (plan 006)', () => {
  it('hydrates server markup with no hydration-mismatch console.error', async () => {
    // Use the CONSERVATIVE capabilities for this test: that is exactly what both
    // the server render and the very first client paint produce (the real upgrade
    // happens in a mount effect). Holding the mock at conservative caps faithfully
    // models the server↔first-paint markup that React diffs during hydration.
    mockCapabilities.mockReturnValue(getConservativeGlassCapabilities());

    const element = (
      <LiquidGlass>
        <button type="button">Buy</button>
      </LiquidGlass>
    );

    // 1. Server render (no window touched by the markup path; capabilities + the
    //    measurement effect are both deferred, so SSR is pure + deterministic).
    const html = renderToString(element);
    expect(html).toContain('Buy');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 2. Hydrate the SAME element onto the server markup and flush effects.
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, element);
      // let mount effects (capability upgrade + measurement) flush
      await Promise.resolve();
    });

    // 3. Assert React never logged a hydration mismatch. Inspect every call's
    //    args for the known mismatch signatures rather than just call count, so a
    //    benign unrelated error wouldn't mask a real mismatch (and vice versa).
    const mismatch = errorSpy.mock.calls.some((args) =>
      args.some(
        (a) =>
          typeof a === 'string' &&
          (/hydrat/i.test(a) ||
            /did not match/i.test(a) ||
            /Text content does not match/i.test(a) ||
            /Warning: Text content/i.test(a) ||
            /server (HTML|rendered)/i.test(a)),
      ),
    );
    expect(mismatch).toBe(false);

    await act(async () => {
      root?.unmount();
    });
    document.body.removeChild(container);
  });
});
