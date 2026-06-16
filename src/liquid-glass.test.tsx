import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the capability hook so tests control `canRefract` deterministically.
const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

import type { GlassCapabilities } from './types';

// Import AFTER the mock is registered.
import { LiquidGlass } from './liquid-glass';

function caps(canRefract: boolean): GlassCapabilities {
  return {
    supportsBackdropFilter: canRefract,
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

beforeEach(() => {
  mockCapabilities.mockReturnValue(caps(true));
  stubLayout();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Find the glass surface element (carries the backdrop-filter). */
function getSurface(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-lg-surface]');
  if (!el) throw new Error('surface element not found');
  return el;
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
    mockCapabilities.mockReturnValue(caps(false));
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
