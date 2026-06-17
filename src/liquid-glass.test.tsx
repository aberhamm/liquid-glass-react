import { act, fireEvent, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the capability hook so tests control `canRefract` deterministically.
const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

// Mock the backdrop-luminance hook (plan 017) so the adaptive-tint tests (plan
// 018) control the sampled verdict deterministically in jsdom — no canvas / DOM
// walk runs. Defaults to UNSAMPLED so tests that don't opt into a verdict
// exercise the graceful-degradation fallback path; the hydration/SSR test
// confirms the first paint uses the conservative default regardless.
const mockLuminance = vi.fn();
vi.mock('./use-backdrop-luminance', () => ({
  useBackdropLuminance: () => mockLuminance(),
}));

/** Set the mocked backdrop-luminance reading. `null` scheme ⇒ unsampled. */
function setLuminance(scheme: 'light' | 'dark' | null): void {
  if (scheme === null) {
    mockLuminance.mockReturnValue({ luminance: null, scheme: null, sampled: false });
  } else {
    mockLuminance.mockReturnValue({
      luminance: scheme === 'light' ? 0.85 : 0.12,
      scheme,
      sampled: true,
    });
  }
}

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
    prefersReducedTransparency: false,
    prefersContrastMore: false,
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
 * Install a controllable `matchMedia` so media-aware hooks (`useReducedMotion`,
 * `useReducedTransparency`, `usePrefersDark`) resolve deterministically. Each
 * query is matched by its OWN substring so reduced-motion and
 * reduced-transparency are independent axes (a single `'reduce'` check would
 * conflate them — both query strings contain `reduce`).
 */
function installMatchMedia(
  opts: { reducedMotion?: boolean; reducedTransparency?: boolean; contrastMore?: boolean } = {},
): void {
  const { reducedMotion = false, reducedTransparency = false, contrastMore = false } = opts;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce')
        ? reducedMotion
        : query.includes('prefers-reduced-transparency: reduce')
          ? reducedTransparency
          : query.includes('prefers-contrast: more')
            ? contrastMore
            : false,
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
  setLuminance(null);
  stubLayout();
  installMatchMedia();
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
    installMatchMedia({ reducedMotion: true });
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
    installMatchMedia({ reducedMotion: true });
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

// ---------------------------------------------------------------------------
// Plan 013 — prefers-reduced-transparency: frostier, no live refraction.
// ---------------------------------------------------------------------------

describe('prefers-reduced-transparency (plan 013)', () => {
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

  it('drops the url(#id) refraction on the FULL tier when reduced-transparency is on', () => {
    // canRefract true (Chromium), but reduced transparency forces the no-filter path.
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bf = styleOf(surface, 'backdropFilter');
    // No live lensing: the SVG url(#id) is gone and no <filter> is rendered.
    expect(bf).not.toMatch(/url\(#/);
    expect(container.querySelector('filter')).toBeNull();
    expect(container.innerHTML).not.toMatch(/url\(#lg-/);
    // The frosted blur is retained for the static glass look.
    expect(bf).toMatch(/blur\(/);
    expect(bf).toMatch(/saturate\(/);
  });

  it('applies a more-opaque surface fill on the FULL tier under reduced-transparency', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // A frosting fill is layered over the retained blur (no fill in the default).
    const bg = styleOf(surface, 'background');
    expect(bg).toMatch(/rgba\(/);
    expect(bg).not.toBe('');
  });

  it('raises the solid fill alpha on the no-backdrop-filter tier under reduced-transparency', () => {
    mockCapabilities.mockReturnValue(caps(false, false));
    installMatchMedia({ reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bg = styleOf(surface, 'background');
    // More opaque than the default 0.55 solid fallback.
    const alpha = Number(bg.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1]);
    expect(alpha).toBeGreaterThan(0.55);
  });

  it('drops live refraction on the frosted (Firefox/Safari) tier under reduced-transparency', () => {
    // Even on a tier that already has no refraction, the path stays consistent.
    mockCapabilities.mockReturnValue(caps(false, true));
    installMatchMedia({ reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    expect(styleOf(surface, 'backdropFilter')).not.toMatch(/url\(#/);
    expect(container.querySelector('filter')).toBeNull();
    // Still frosted + more opaque.
    expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
  });

  it('renders byte-for-byte identical to today when reduced-transparency is OFF', () => {
    // Default install (both axes off) must reproduce the existing full-tier output.
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia();
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bf = styleOf(surface, 'backdropFilter');
    // Refraction present, no extra fill — exactly the TIER 1 invariant.
    expect(bf).toMatch(/url\(#lg-[^)]+\)/);
    expect(styleOf(surface, 'background')).toBe('');
    expect(container.querySelector('filter')).not.toBeNull();
  });

  it('keeps IDENTICAL box geometry whether reduced-transparency is on or off (no layout shift)', () => {
    const renderWith = (reducedTransparency: boolean): ReturnType<typeof geometry> => {
      mockCapabilities.mockReturnValue(caps(true));
      installMatchMedia({ reducedTransparency });
      const { container, unmount } = render(
        <LiquidGlass padding="12px 20px" cornerRadius={28}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const geo = geometry(container);
      unmount();
      return geo;
    };

    const off = renderWith(false);
    const on = renderWith(true);
    expect(off.padding).toBe('12px 20px');
    expect(off.borderRadius).toBe('28px');
    expect(on).toEqual(off);
  });

  it('still renders the inset bevel and rim layers under reduced-transparency', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // Bevel/rim are cross-browser polish, not transparency — they remain.
    expect(surface.style.boxShadow).toMatch(/inset/);
    expect(container.querySelector('[data-lg-highlight]')).not.toBeNull();
    expect(container.querySelector('[data-lg-border]')).not.toBeNull();
  });

  it('renders without console.error / console.warn under reduced-transparency', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      installMatchMedia({ reducedTransparency: true });
      const { unmount } = render(
        <LiquidGlass mode="standard">
          <button type="button">Buy</button>
        </LiquidGlass>,
      );
      act(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
      });
      unmount();
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Plan 014 — prefers-contrast: solid border, raised contrast, less tint.
// ---------------------------------------------------------------------------

describe('prefers-contrast: more (plan 014)', () => {
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

  it('adds a SOLID inset border ring (not just the soft bevel) when contrast is on', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const shadow = surface.style.boxShadow;
    // A solid inset ring: `inset 0 0 0 <n>px <color>` is prepended to the bevel.
    expect(shadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
    // The bevel is still present (the contrast ring is additive, not a replace).
    expect(shadow).toMatch(/inset/);
  });

  it('does NOT add the solid border ring when contrast is off (bevel only)', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia();
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // No `inset 0 0 0 Npx` solid-border ring in the default output.
    expect(surface.style.boxShadow).not.toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
  });

  it('applies a more-opaque surface fill (raised contrast / reduced tint) when on', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bg = styleOf(surface, 'background');
    expect(bg).toMatch(/rgba\(/);
    expect(bg).not.toBe('');
    // The blur is retained — this is a fill layered over it, not a tier change.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(/);
  });

  it('pins backdrop saturation to 100% (no decorative vibrancy boost) when on', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass saturation={200}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const bf = styleOf(getSurface(container), 'backdropFilter');
    expect(bf).toMatch(/saturate\(100%\)/);
    expect(bf).not.toMatch(/saturate\(200%\)/);
  });

  it('drops chromatic aberration (spread collapses) when contrast is on', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass aberrationIntensity={10}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const scales = [...container.querySelectorAll('feDisplacementMap')].map((m) =>
      Number(m.getAttribute('scale')),
    );
    // With aberration forced to 0, R=G=B → zero spread.
    const spread = Math.max(...scales) - Math.min(...scales);
    expect(spread).toBe(0);
  });

  it('applies the contrast treatment on the FROSTED (Safari/Firefox) tier too', () => {
    mockCapabilities.mockReturnValue(caps(false, true));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    expect(surface.style.boxShadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
    expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
  });

  it('applies the contrast treatment on the SOLID (no-backdrop-filter) tier too', () => {
    mockCapabilities.mockReturnValue(caps(false, false));
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    expect(surface.style.boxShadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
    expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
  });

  it('composes with reduced-transparency: both axes active stay legible + shift-free', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia({ contrastMore: true, reducedTransparency: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // Solid border ring present (contrast) AND no live refraction (transparency).
    expect(surface.style.boxShadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
    expect(styleOf(surface, 'backdropFilter')).not.toMatch(/url\(#/);
    expect(container.querySelector('filter')).toBeNull();
    // An opaque fill is present for legibility.
    expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
  });

  it('renders byte-for-byte identical to today when contrast is OFF', () => {
    mockCapabilities.mockReturnValue(caps(true));
    installMatchMedia();
    const { container } = render(
      <LiquidGlass saturation={200} aberrationIntensity={10}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    const bf = styleOf(surface, 'backdropFilter');
    // Refraction present, decorative saturation honored, no extra fill, no ring.
    expect(bf).toMatch(/url\(#lg-[^)]+\)/);
    expect(bf).toMatch(/saturate\(200%\)/);
    expect(styleOf(surface, 'background')).toBe('');
    expect(surface.style.boxShadow).not.toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
  });

  it('keeps IDENTICAL box geometry whether contrast is on or off (no layout shift)', () => {
    const renderWith = (contrastMore: boolean): ReturnType<typeof geometry> => {
      mockCapabilities.mockReturnValue(caps(true));
      installMatchMedia({ contrastMore });
      const { container, unmount } = render(
        <LiquidGlass padding="12px 20px" cornerRadius={28}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const geo = geometry(container);
      unmount();
      return geo;
    };

    const off = renderWith(false);
    const on = renderWith(true);
    expect(off.padding).toBe('12px 20px');
    expect(off.borderRadius).toBe('28px');
    expect(on).toEqual(off);
  });

  it('renders without console.error / console.warn under increased contrast', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      installMatchMedia({ contrastMore: true });
      const { unmount } = render(
        <LiquidGlass mode="standard">
          <button type="button">Buy</button>
        </LiquidGlass>,
      );
      act(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
      });
      unmount();
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Plan 016 — pointer-tracked specular hotspot + glow-on-press.
// ---------------------------------------------------------------------------

describe('pointer-tracked specular hotspot + glow-on-press (plan 016)', () => {
  /** Find the specular hotspot layer. */
  function getHighlight(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-lg-highlight]');
    if (!el) throw new Error('specular highlight element not found');
    return el;
  }

  /** Find the press-glow layer. */
  function getPressGlow(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-lg-press-glow]');
    if (!el) throw new Error('press-glow element not found');
    return el;
  }

  it('renders a positioned radial specular hotspot (not an angle-only linear sweep)', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const highlight = getHighlight(container);
    // The hotspot is a radial-gradient driven by the --lg-spec-x/y custom props.
    expect(highlight.style.background).toMatch(/radial-gradient/);
    expect(highlight.style.background).not.toMatch(/linear-gradient/);
    expect(highlight.style.background).toMatch(/var\(--lg-spec-x/);
    expect(highlight.style.mixBlendMode).toBe('screen');
    // It is decorative: aria-hidden + never intercepts pointer events.
    expect(highlight.getAttribute('aria-hidden')).toBe('true');
    expect(highlight.style.pointerEvents).toBe('none');
  });

  it('UPDATES the specular position custom props after a synthetic pointer move', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const highlight = getHighlight(container);

    // At rest: neutral top-biased fallback (50% / 0%).
    const restX = highlight.style.getPropertyValue('--lg-spec-x');
    const restY = highlight.style.getPropertyValue('--lg-spec-y');
    expect(restX).toBe('50%');
    expect(restY).toBe('0%');

    act(() => {
      // Wrapper center is (160,48) given the 320x96 stubbed rect; move off-center
      // so the tracked hotspot position differs from the rest fallback.
      fireEvent.mouseMove(document, { clientX: 240, clientY: 72 });
    });

    const movedX = highlight.style.getPropertyValue('--lg-spec-x');
    const movedY = highlight.style.getPropertyValue('--lg-spec-y');
    // The written position changed (the hotspot now tracks the cursor).
    expect(movedX).not.toBe(restX);
    expect(movedY).not.toBe(restY);
    // And it reads as a percentage center, not the rest fallback.
    expect(movedX).toMatch(/%$/);
    expect(movedY).toMatch(/%$/);
  });

  it('blooms the press-glow on pointerdown and fades it on release', () => {
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const glow = getPressGlow(container);

    // At rest the glow is invisible.
    expect(glow.style.opacity).toBe('0');
    expect(glow.style.background).toMatch(/radial-gradient/);
    expect(glow.getAttribute('aria-hidden')).toBe('true');
    expect(glow.style.pointerEvents).toBe('none');

    act(() => {
      fireEvent.mouseDown(wrapper);
    });
    // Pressed: the glow blooms to full opacity.
    expect(glow.style.opacity).toBe('1');

    act(() => {
      fireEvent.mouseUp(wrapper);
    });
    // Released: back to invisible (the opacity transition fades it out in the UI).
    expect(glow.style.opacity).toBe('0');
  });

  it('keeps the hotspot static (neutral, no tracking) under reduced motion', () => {
    installMatchMedia({ reducedMotion: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const highlight = getHighlight(container);

    act(() => {
      fireEvent.mouseMove(document, { clientX: 240, clientY: 72 });
    });

    // Reduced motion suppresses tracking: the hotspot stays at the neutral rest
    // position regardless of pointer movement.
    expect(highlight.style.getPropertyValue('--lg-spec-x')).toBe('50%');
    expect(highlight.style.getPropertyValue('--lg-spec-y')).toBe('0%');
    // And the background-position transition is omitted (no chasing animation).
    expect(highlight.style.transition).not.toMatch(/background-position/);
  });

  it('does not animate the press-glow under reduced motion (no opacity transition)', () => {
    installMatchMedia({ reducedMotion: true });
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const glow = getPressGlow(container);
    expect(glow.style.transition).not.toMatch(/opacity/);
  });

  it('renders the specular + press-glow layers regardless of canRefract', () => {
    mockCapabilities.mockReturnValue(caps(false, false));
    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    // Pure-CSS polish: present even on the most degraded tier.
    expect(container.querySelector('[data-lg-highlight]')).not.toBeNull();
    expect(container.querySelector('[data-lg-press-glow]')).not.toBeNull();
  });

  it('renders without console.error / console.warn through the specular + press path', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = render(
      <LiquidGlass>
        <span>hi</span>
      </LiquidGlass>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    act(() => {
      fireEvent.mouseMove(document, { clientX: 240, clientY: 72 });
      fireEvent.mouseDown(wrapper);
      fireEvent.mouseUp(wrapper);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// Plan 018 — content-adaptive auto-tint (adaptiveTint).
// ---------------------------------------------------------------------------

describe('adaptiveTint: content-adaptive auto light/dark (plan 018)', () => {
  /** Read the content layer (carries the adaptive foreground color). */
  function getContent(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-lg-content]');
    if (!el) throw new Error('content element not found');
    return el;
  }

  it('is OFF by default: never samples and renders byte-for-byte unchanged', () => {
    setLuminance('light'); // even with a reading available, default-off ignores it
    const { container } = render(
      <LiquidGlass saturation={200}>
        <span>hi</span>
      </LiquidGlass>,
    );
    // The hook is never invoked on the default path (AdaptiveTintLayer unmounted).
    expect(mockLuminance).not.toHaveBeenCalled();
    const surface = getSurface(container);
    // Default (overLight-off) treatment: blur not bumped, full saturation honored.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(1px\)/);
    expect(styleOf(surface, 'backdropFilter')).toMatch(/saturate\(200%\)/);
    // No adaptive foreground color set on the content layer.
    expect(getContent(container).style.color).toBe('');
  });

  it('maps a LIGHT backdrop to the light treatment (overLight-equivalent)', () => {
    setLuminance('light');
    const { container } = render(
      <LiquidGlass adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // overLight-equivalent bumps the backdrop blur 1px → 1.5px.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(1\.5px\)/);
    // Content ink flips DARK over a light backdrop for legibility.
    expect(getContent(container).style.color).toMatch(/17, 17, 20/);
  });

  it('maps a DARK backdrop to the default (non-overLight) treatment', () => {
    setLuminance('dark');
    const { container } = render(
      <LiquidGlass adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // Dark backdrop ⇒ effectiveOverLight false ⇒ blur stays at the 1px default.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(1px\)/);
    // Content ink flips LIGHT over a dark backdrop.
    expect(getContent(container).style.color).toMatch(/255, 255, 255/);
  });

  it('PRECEDENCE: an explicit overLight ALWAYS wins over adaptiveTint', () => {
    // Backdrop samples DARK, but the author explicitly set overLight — manual wins.
    setLuminance('dark');
    const { container } = render(
      <LiquidGlass adaptiveTint overLight>
        <span>hi</span>
      </LiquidGlass>,
    );
    // overLight=true ⇒ light treatment despite the dark sample.
    expect(styleOf(getSurface(container), 'backdropFilter')).toMatch(/blur\(1\.5px\)/);
  });

  it('PRECEDENCE: explicit overLight={false} also wins (auto cannot flip it on)', () => {
    setLuminance('light');
    const { container } = render(
      <LiquidGlass adaptiveTint overLight={false}>
        <span>hi</span>
      </LiquidGlass>,
    );
    // overLight=false short-circuits ⇒ default treatment despite the light sample.
    expect(styleOf(getSurface(container), 'backdropFilter')).toMatch(/blur\(1px\)/);
  });

  it('GRACEFUL DEGRADATION: sampled:false falls back to the default treatment', () => {
    setLuminance(null); // unsampled (taint / no-canvas / SSR)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <LiquidGlass adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // Falls back to overLight ?? false ⇒ default blur, no adaptive ink.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(1px\)/);
    expect(getContent(container).style.color).toBe('');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('PREFERS-CONTRAST wins: auto-tint never undercuts the high-contrast treatment', () => {
    // Light backdrop would normally pick dark ink; but contrast forces the
    // treatment derived from the OS scheme (light here ⇒ dark ink against the
    // light contrast fill) AND keeps the solid contrast border + opaque fill.
    setLuminance('light');
    installMatchMedia({ contrastMore: true });
    const { container } = render(
      <LiquidGlass adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    const surface = getSurface(container);
    // The increased-contrast treatment is intact (solid border + opaque fill).
    expect(surface.style.boxShadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
    expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
    // Saturation still pinned to 100 (contrast), not the decorative boost.
    expect(styleOf(surface, 'backdropFilter')).toMatch(/saturate\(100%\)/);
  });

  it('renders without console.error / console.warn under adaptiveTint (light + dark)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const verdict of ['light', 'dark', null] as const) {
      setLuminance(verdict);
      const { unmount } = render(
        <LiquidGlass adaptiveTint>
          <span>hi</span>
        </LiquidGlass>,
      );
      unmount();
    }
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('SSR safety — renderToString → hydrateRoot with adaptiveTint, no mismatch', async () => {
    // Conservative caps model the server + first-paint markup React diffs.
    mockCapabilities.mockReturnValue(getConservativeGlassCapabilities());
    // Even if the mocked hook reports a verdict, sampling is deferred to a
    // post-mount effect, so server + first client paint use the conservative
    // default treatment and hydration must NOT mismatch.
    setLuminance('light');

    const element = (
      <LiquidGlass adaptiveTint>
        <button type="button">Buy</button>
      </LiquidGlass>
    );

    const html = renderToString(element);
    expect(html).toContain('Buy');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, element);
      await Promise.resolve();
    });

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

// ---------------------------------------------------------------------------
// Plan 019 — Regular vs Clear material variant.
// ---------------------------------------------------------------------------

describe('variant: regular vs clear (plan 019)', () => {
  /** Read the content layer. */
  function getContent(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-lg-content]');
    if (!el) throw new Error('content element not found');
    return el;
  }

  /** Read the dimming-scrim layer (Clear only), or null when absent. */
  function getScrim(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>('[data-lg-scrim]');
  }

  /** Pull the `saturate(N%)` value out of a backdrop-filter string. */
  function saturationOf(surface: HTMLElement): number {
    const m = styleOf(surface, 'backdropFilter').match(/saturate\(([\d.]+)%\)/);
    return Number(m?.[1]);
  }

  it("defaults to 'regular' and renders byte-for-byte identical to today", () => {
    const explicit = render(
      <LiquidGlass variant="regular" saturation={140}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const explicitSurface = getSurface(explicit.container);
    const explicitBf = styleOf(explicitSurface, 'backdropFilter');
    explicit.unmount();

    const implicit = render(
      <LiquidGlass saturation={140}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const implicitSurface = getSurface(implicit.container);
    // The default (omitted variant) and explicit 'regular' produce identical
    // surface output, and there is NO dimming scrim on the regular path. The SVG
    // filter id is per-render (useId), so normalize it out before comparing.
    const normalizeId = (s: string): string => s.replace(/url\(#lg-[^)]+\)/, 'url(#lg-X)');
    expect(normalizeId(styleOf(implicitSurface, 'backdropFilter'))).toBe(normalizeId(explicitBf));
    expect(styleOf(implicitSurface, 'backdropFilter')).toMatch(/saturate\(140%\)/);
    expect(getScrim(implicit.container)).toBeNull();
    expect(getScrim(explicit.container)).toBeNull();
  });

  it("'clear' is MORE transparent: it lowers the backdrop saturation/tint", () => {
    const regular = render(
      <LiquidGlass variant="regular" saturation={140}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const regularSat = saturationOf(getSurface(regular.container));
    regular.unmount();

    const clear = render(
      <LiquidGlass variant="clear" saturation={140}>
        <span>hi</span>
      </LiquidGlass>,
    );
    const clearSat = saturationOf(getSurface(clear.container));

    // Clear pulls the decorative saturation back vs regular (reduced tint).
    expect(clearSat).toBeLessThan(regularSat);
  });

  it("'clear' adds a dimming scrim BEHIND the content (a content sibling, not on the surface)", () => {
    const { container } = render(
      <LiquidGlass variant="clear">
        <span>hi</span>
      </LiquidGlass>,
    );
    const scrim = getScrim(container);
    const content = getContent(container);
    const surface = getSurface(container);

    expect(scrim).not.toBeNull();
    // It actually carries a fill and is decorative.
    expect(scrim?.style.background).toMatch(/rgba\(/);
    expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    expect(scrim?.style.pointerEvents).toBe('none');
    // Layer isolation: the scrim is a SIBLING of both the content and the clipped
    // glass surface — never inside the overflow:hidden surface, never wrapping
    // the content.
    expect(surface.contains(scrim as HTMLElement)).toBe(false);
    expect((scrim as HTMLElement).contains(content)).toBe(false);
    expect(scrim?.parentElement).toBe(content.parentElement);
    // It sits behind the content (content is zIndex 1, scrim 0).
    expect(content.style.zIndex).toBe('1');
    expect(scrim?.style.zIndex).toBe('0');
  });

  it("'clear' force-disables adaptivity: adaptiveTint is a NO-OP (never samples, no ink flip)", () => {
    setLuminance('light'); // a verdict is available, but Clear must ignore it
    const { container } = render(
      <LiquidGlass variant="clear" adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    // The sampler hook is never invoked (AdaptiveTintLayer not mounted in Clear).
    expect(mockLuminance).not.toHaveBeenCalled();
    const surface = getSurface(container);
    // No overLight-equivalent: blur stays at the 1px default (not bumped to 1.5).
    expect(styleOf(surface, 'backdropFilter')).toMatch(/blur\(1px\)/);
    // No adaptive ink flip on the content layer.
    expect(getContent(container).style.color).toBe('');
  });

  it("'clear' + explicit overLight still nudges legibility but does NOT re-enable adaptivity", () => {
    setLuminance('dark'); // would matter only if the adaptive path were active
    const { container } = render(
      <LiquidGlass variant="clear" adaptiveTint overLight>
        <span>hi</span>
      </LiquidGlass>,
    );
    // overLight still tunes the surface (blur bumped) — a legibility nudge.
    expect(styleOf(getSurface(container), 'backdropFilter')).toMatch(/blur\(1\.5px\)/);
    // But adaptivity stays OFF: the sampler is never mounted/invoked.
    expect(mockLuminance).not.toHaveBeenCalled();
  });

  it("'regular' + adaptiveTint keeps the plan-018 adaptive behavior (it samples and flips ink)", () => {
    setLuminance('light');
    const { container } = render(
      <LiquidGlass variant="regular" adaptiveTint>
        <span>hi</span>
      </LiquidGlass>,
    );
    // Regular leaves adaptiveTint intact: it samples and applies the light
    // treatment (blur bumped, dark ink) exactly as plan 018.
    expect(mockLuminance).toHaveBeenCalled();
    expect(styleOf(getSurface(container), 'backdropFilter')).toMatch(/blur\(1\.5px\)/);
    expect(getContent(container).style.color).toMatch(/17, 17, 20/);
  });

  it('prefers-contrast STILL forces high-contrast in BOTH variants (a11y wins over Clear)', () => {
    installMatchMedia({ contrastMore: true });
    for (const variant of ['regular', 'clear'] as const) {
      mockCapabilities.mockReturnValue(caps(true));
      const { container, unmount } = render(
        <LiquidGlass variant={variant} saturation={200}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const surface = getSurface(container);
      // Solid contrast border ring + opaque fill present regardless of variant.
      expect(surface.style.boxShadow).toMatch(/^inset 0(px)? 0(px)? 0(px)? 2px/);
      expect(styleOf(surface, 'background')).toMatch(/rgba\(/);
      // Saturation pinned to 100 (contrast wins over both the decorative boost
      // AND the Clear saturation reduction).
      expect(styleOf(surface, 'backdropFilter')).toMatch(/saturate\(100%\)/);
      expect(styleOf(surface, 'backdropFilter')).not.toMatch(/saturate\(200%\)/);
      unmount();
    }
  });

  it('keeps IDENTICAL box geometry between regular and clear (geometry unchanged)', () => {
    const geometryFor = (variant: 'regular' | 'clear'): Record<string, string> => {
      const { container, unmount } = render(
        <LiquidGlass variant={variant} padding="12px 20px" cornerRadius={28}>
          <span>hi</span>
        </LiquidGlass>,
      );
      const wrapper = container.firstElementChild as HTMLElement;
      const geo = {
        padding: wrapper.style.padding,
        borderRadius: wrapper.style.borderRadius,
        display: wrapper.style.display,
      };
      unmount();
      return geo;
    };
    const regular = geometryFor('regular');
    const clear = geometryFor('clear');
    expect(regular.padding).toBe('12px 20px');
    expect(regular.borderRadius).toBe('28px');
    expect(clear).toEqual(regular);
  });

  it('renders without console.error / console.warn under both variants', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const variant of ['regular', 'clear'] as const) {
      for (const c of [caps(true), caps(false, true), caps(false, false)]) {
        mockCapabilities.mockReturnValue(c);
        const { unmount } = render(
          <LiquidGlass variant={variant} adaptiveTint mode="standard">
            <button type="button">Buy</button>
          </LiquidGlass>,
        );
        act(() => {
          fireEvent.mouseMove(document, { clientX: 200, clientY: 60 });
        });
        unmount();
      }
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
