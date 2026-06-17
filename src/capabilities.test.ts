import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectGlassCapabilities } from './capabilities';

/**
 * Realistic user-agent strings for the engines we gate on.
 *
 * Note the token overlaps that the detection logic must handle:
 * - Chrome UA contains both `Chrome` and `Safari`.
 * - Edge UA contains `Chrome`, `Safari`, AND `Edg`.
 * - Safari UA contains `Safari` and `Version` but NO `Chrome` token.
 * - Firefox UA contains `Firefox`/`Gecko` and none of the Blink tokens.
 */
const UA = {
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.51',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
} as const;

/**
 * Install browser-global stubs for one detection run. Returns nothing; call
 * {@link restoreGlobals} (wired to `afterEach`) to undo.
 */
function stubBrowser(options: {
  userAgent: string;
  backdropFilter: boolean;
  reducedMotion?: boolean;
  reducedTransparency?: boolean;
  contrastMore?: boolean;
}) {
  const {
    userAgent,
    backdropFilter,
    reducedMotion = false,
    reducedTransparency = false,
    contrastMore = false,
  } = options;

  vi.stubGlobal('navigator', { userAgent });

  vi.stubGlobal('CSS', {
    supports: vi.fn((property: string) => {
      if (property === 'backdrop-filter' || property === '-webkit-backdrop-filter') {
        return backdropFilter;
      }
      return false;
    }),
  });

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('detectGlassCapabilities — Chromium full-effect tier', () => {
  it('marks Chrome as Chromium and refraction-capable when backdrop-filter is supported', () => {
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true });

    const caps = detectGlassCapabilities();

    expect(caps.isChromium).toBe(true);
    expect(caps.isFirefox).toBe(false);
    expect(caps.supportsBackdropFilter).toBe(true);
    expect(caps.supportsSvgBackdropDisplacement).toBe(true);
    expect(caps.canRefract).toBe(true);
  });

  it('marks Edge as Chromium and refraction-capable (UA carries both Chrome and Edg)', () => {
    stubBrowser({ userAgent: UA.edge, backdropFilter: true });

    const caps = detectGlassCapabilities();

    expect(caps.isChromium).toBe(true);
    expect(caps.isFirefox).toBe(false);
    expect(caps.canRefract).toBe(true);
  });

  it('does NOT mark Chromium as refraction-capable when backdrop-filter is unsupported', () => {
    stubBrowser({ userAgent: UA.chrome, backdropFilter: false });

    const caps = detectGlassCapabilities();

    expect(caps.isChromium).toBe(true);
    expect(caps.supportsBackdropFilter).toBe(false);
    expect(caps.canRefract).toBe(false);
  });
});

describe('detectGlassCapabilities — degraded engines', () => {
  it('marks Safari/WebKit as NOT Chromium and NOT refraction-capable', () => {
    // Safari supports -webkit-backdrop-filter, so backdrop-filter is true here —
    // the positive Blink gate is what keeps it out of the full-effect tier.
    stubBrowser({ userAgent: UA.safari, backdropFilter: true });

    const caps = detectGlassCapabilities();

    expect(caps.isChromium).toBe(false);
    expect(caps.isFirefox).toBe(false);
    expect(caps.supportsBackdropFilter).toBe(true);
    expect(caps.supportsSvgBackdropDisplacement).toBe(false);
    expect(caps.canRefract).toBe(false);
  });

  it('marks Firefox as NOT Chromium and NOT refraction-capable', () => {
    stubBrowser({ userAgent: UA.firefox, backdropFilter: true });

    const caps = detectGlassCapabilities();

    expect(caps.isFirefox).toBe(true);
    expect(caps.isChromium).toBe(false);
    expect(caps.supportsSvgBackdropDisplacement).toBe(false);
    expect(caps.canRefract).toBe(false);
  });

  it('detects isFirefox true only for the Firefox UA', () => {
    stubBrowser({ userAgent: UA.firefox, backdropFilter: true });
    expect(detectGlassCapabilities().isFirefox).toBe(true);

    vi.unstubAllGlobals();
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true });
    expect(detectGlassCapabilities().isFirefox).toBe(false);

    vi.unstubAllGlobals();
    stubBrowser({ userAgent: UA.safari, backdropFilter: true });
    expect(detectGlassCapabilities().isFirefox).toBe(false);
  });
});

describe('detectGlassCapabilities — prefers-reduced-motion', () => {
  it('reflects the reduced-motion media query', () => {
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, reducedMotion: true });
    expect(detectGlassCapabilities().prefersReducedMotion).toBe(true);

    vi.unstubAllGlobals();
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, reducedMotion: false });
    expect(detectGlassCapabilities().prefersReducedMotion).toBe(false);
  });
});

describe('detectGlassCapabilities — prefers-reduced-transparency', () => {
  it('reflects the reduced-transparency media query', () => {
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, reducedTransparency: true });
    expect(detectGlassCapabilities().prefersReducedTransparency).toBe(true);

    vi.unstubAllGlobals();
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, reducedTransparency: false });
    expect(detectGlassCapabilities().prefersReducedTransparency).toBe(false);
  });

  it('is independent of prefers-reduced-motion (orthogonal axes)', () => {
    stubBrowser({
      userAgent: UA.chrome,
      backdropFilter: true,
      reducedMotion: true,
      reducedTransparency: false,
    });
    const caps = detectGlassCapabilities();
    expect(caps.prefersReducedMotion).toBe(true);
    expect(caps.prefersReducedTransparency).toBe(false);
    // Reduced transparency does not gate refraction at the capability layer.
    expect(caps.canRefract).toBe(true);
  });
});

describe('detectGlassCapabilities — prefers-contrast', () => {
  it('reflects the prefers-contrast: more media query', () => {
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, contrastMore: true });
    expect(detectGlassCapabilities().prefersContrastMore).toBe(true);

    vi.unstubAllGlobals();
    stubBrowser({ userAgent: UA.chrome, backdropFilter: true, contrastMore: false });
    expect(detectGlassCapabilities().prefersContrastMore).toBe(false);
  });

  it('is independent of the other a11y axes (orthogonal)', () => {
    stubBrowser({
      userAgent: UA.chrome,
      backdropFilter: true,
      reducedMotion: true,
      reducedTransparency: true,
      contrastMore: false,
    });
    const caps = detectGlassCapabilities();
    expect(caps.prefersReducedMotion).toBe(true);
    expect(caps.prefersReducedTransparency).toBe(true);
    expect(caps.prefersContrastMore).toBe(false);
    // Increased contrast does not gate refraction at the capability layer.
    expect(caps.canRefract).toBe(true);
  });
});

describe('detectGlassCapabilities — SSR / partial environment', () => {
  const ALL_FALSE = {
    supportsBackdropFilter: false,
    isChromium: false,
    supportsSvgBackdropDisplacement: false,
    isFirefox: false,
    prefersReducedMotion: false,
    prefersReducedTransparency: false,
    prefersContrastMore: false,
    canRefract: false,
  };

  it('returns conservative all-false defaults without throwing when window is undefined', () => {
    vi.stubGlobal('window', undefined);

    let caps: ReturnType<typeof detectGlassCapabilities> | undefined;
    expect(() => {
      caps = detectGlassCapabilities();
    }).not.toThrow();

    expect(caps).toEqual(ALL_FALSE);
  });

  it('returns all-false without throwing when document is undefined (window present)', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', { userAgent: UA.chrome });

    let caps: ReturnType<typeof detectGlassCapabilities> | undefined;
    expect(() => {
      caps = detectGlassCapabilities();
    }).not.toThrow();

    expect(caps).toEqual(ALL_FALSE);
  });

  it('does not throw when CSS and window.matchMedia are unavailable in a browser env', () => {
    // window/document/navigator present, but the feature APIs are missing.
    vi.stubGlobal('navigator', { userAgent: UA.chrome });
    vi.stubGlobal('CSS', undefined);
    // Couple to the same access path the source uses (window.matchMedia).
    vi.stubGlobal('window', { ...globalThis.window, matchMedia: undefined });

    let caps: ReturnType<typeof detectGlassCapabilities> | undefined;
    expect(() => {
      caps = detectGlassCapabilities();
    }).not.toThrow();

    // UA still classifies Chromium, but no backdrop-filter probe and no
    // reduced-motion probe means refraction is gated off.
    expect(caps?.supportsBackdropFilter).toBe(false);
    expect(caps?.prefersReducedMotion).toBe(false);
    expect(caps?.prefersReducedTransparency).toBe(false);
    expect(caps?.prefersContrastMore).toBe(false);
    expect(caps?.canRefract).toBe(false);
  });
});
