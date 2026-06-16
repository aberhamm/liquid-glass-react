import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __cache,
  getDisplacementMap,
  renderMapBuffer,
  roundedRectSDF,
  smoothStep,
} from './displacement';

beforeEach(() => {
  __cache.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('roundedRectSDF', () => {
  // 100x60 rect centered at origin, radius 10.
  const W = 100;
  const H = 60;
  const R = 10;

  it('is deeply negative at the center', () => {
    const d = roundedRectSDF(0, 0, W, H, R);
    expect(d).toBeLessThan(0);
    // Nearest edge is the top/bottom (halfH = 30). SDF magnitude equals that
    // distance: inside = min(max(-40, -20), 0) = -20; result = -20 - 10 = -30.
    expect(d).toBeCloseTo(-30, 5);
  });

  it('is ~zero on a straight edge', () => {
    // Right edge midpoint sits exactly on the border.
    const d = roundedRectSDF(W / 2, 0, W, H, R);
    expect(Math.abs(d)).toBeLessThan(1e-9);
  });

  it('is positive outside the rectangle', () => {
    const d = roundedRectSDF(W / 2 + 5, 0, W, H, R);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeCloseTo(5, 5);
  });

  it('measures distance to the corner arc, not the bounding box corner', () => {
    // The exact bounding-box corner is sqrt(2)*r outside the arc... it is positive.
    const d = roundedRectSDF(W / 2, H / 2, W, H, R);
    expect(d).toBeGreaterThan(0);
    // Corner circle center is at (50-10, 30-10) = (40, 20); distance to (50,30)
    // is sqrt(200) ~ 14.142, minus radius 10 => ~4.142.
    expect(d).toBeCloseTo(Math.sqrt(200) - 10, 5);
  });

  it('clamps radius to half the smaller side', () => {
    // Radius far larger than the rect => behaves like a capsule/stadium, never throws.
    const d = roundedRectSDF(0, 0, 20, 20, 1000);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(-10, 5); // full circle of radius 10 inscribed.
  });
});

describe('smoothStep', () => {
  it('is 0 at the lower edge', () => {
    expect(smoothStep(0, 1, 0)).toBe(0);
  });

  it('is 1 at the upper edge', () => {
    expect(smoothStep(0, 1, 1)).toBe(1);
  });

  it('is 0.5 at the midpoint', () => {
    expect(smoothStep(0, 1, 0.5)).toBe(0.5);
  });

  it('clamps below the lower edge', () => {
    expect(smoothStep(0, 1, -5)).toBe(0);
  });

  it('clamps above the upper edge', () => {
    expect(smoothStep(0, 1, 5)).toBe(1);
  });

  it('degenerates to a step when a === b', () => {
    expect(smoothStep(2, 2, 1)).toBe(0);
    expect(smoothStep(2, 2, 3)).toBe(1);
  });
});

describe('renderMapBuffer encoding', () => {
  it('produces only 0–255 byte values', () => {
    const buf = renderMapBuffer('standard', 32, 32);
    expect(buf.length).toBe(32 * 32 * 4);
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] as number;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('has alpha=255 and G=0 everywhere', () => {
    const buf = renderMapBuffer('shader', 16, 16);
    for (let i = 0; i < buf.length; i += 4) {
      expect(buf[i + 1]).toBe(0); // G unused
      expect(buf[i + 3]).toBe(255); // A
    }
  });

  it('has a ~neutral (128) center for standard and shader modes', () => {
    for (const mode of ['standard', 'shader'] as const) {
      const w = 32;
      const h = 32;
      const buf = renderMapBuffer(mode, w, h);
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      const i = (cy * w + cx) * 4;
      expect(buf[i]).toBeGreaterThanOrEqual(128 - 4); // R
      expect(buf[i]).toBeLessThanOrEqual(128 + 4);
      expect(buf[i + 2]).toBeGreaterThanOrEqual(128 - 4); // B
      expect(buf[i + 2]).toBeLessThanOrEqual(128 + 4);
    }
  });
});

describe('getDisplacementMap', () => {
  it('returns a PNG data-URL', () => {
    const url = getDisplacementMap('standard', 32, 32);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('emits a valid PNG signature', () => {
    const url = getDisplacementMap('standard', 16, 16);
    const b64 = url.slice('data:image/png;base64,'.length);
    // Decode the leading bytes manually via atob-equivalent: build from base64.
    const bytes = decodeBase64(b64).slice(0, 8);
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('returns a 1x1 transparent PNG for degenerate dimensions', () => {
    expect(getDisplacementMap('standard', 0, 32).startsWith('data:image/png;base64,')).toBe(true);
    expect(getDisplacementMap('standard', -5, 32).startsWith('data:image/png;base64,')).toBe(true);
    expect(
      getDisplacementMap('standard', 32, Number.NaN).startsWith('data:image/png;base64,'),
    ).toBe(true);
    // All degenerate inputs collapse to the same fallback.
    expect(getDisplacementMap('standard', 0, 0)).toBe(getDisplacementMap('polar', -1, -1));
  });

  it('produces four DISTINCT maps for standard/polar/prominent/shader', () => {
    const w = 64;
    const h = 48;
    const standard = getDisplacementMap('standard', w, h);
    const polar = getDisplacementMap('polar', w, h);
    const prominent = getDisplacementMap('prominent', w, h);
    const shader = getDisplacementMap('shader', w, h);
    const all = [standard, polar, prominent, shader];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(all[i]).not.toBe(all[j]);
      }
    }
  });
});

describe('cache behavior', () => {
  it('quantizes near-identical sizes to one render (string equality)', () => {
    // 96 and 100 both round to nearest 16 => 96. 104 rounds to 112.
    const a = getDisplacementMap('standard', 96, 96);
    const b = getDisplacementMap('standard', 100, 100);
    expect(b).toBe(a); // same cache bucket, identical URL
    expect(__cache.size).toBe(1);
    // A size in a different bucket renders separately.
    getDisplacementMap('standard', 112, 112);
    expect(__cache.size).toBe(2);
  });

  it('serves repeated calls from cache without re-rendering', () => {
    const spy = vi.spyOn(Math, 'sqrt');
    getDisplacementMap('polar', 64, 64);
    const callsAfterFirst = spy.mock.calls.length;
    getDisplacementMap('polar', 64, 64); // cache hit
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('evicts the least-recently-used entry past the cap of 32', () => {
    // Fill cache with 32 distinct quantized sizes (multiples of 16).
    const firstKey = __cache.keyFor('standard', 16, 16);
    getDisplacementMap('standard', 16, 16);
    for (let n = 2; n <= 32; n++) {
      const size = n * 16;
      getDisplacementMap('standard', size, size);
    }
    expect(__cache.size).toBe(32);
    expect(__cache.has(firstKey)).toBe(true);

    // One more distinct entry forces eviction of the LRU (the first one).
    getDisplacementMap('standard', 33 * 16, 33 * 16);
    expect(__cache.size).toBe(32);
    expect(__cache.has(firstKey)).toBe(false);
  });

  it('refreshes recency on access so the touched entry survives eviction', () => {
    const firstKey = __cache.keyFor('standard', 16, 16);
    getDisplacementMap('standard', 16, 16);
    for (let n = 2; n <= 32; n++) {
      getDisplacementMap('standard', n * 16, n * 16);
    }
    // Touch the first entry -> becomes most-recently-used.
    getDisplacementMap('standard', 16, 16);
    // Add a new entry -> evicts the now-oldest (the n=2 entry), not the first.
    getDisplacementMap('standard', 33 * 16, 33 * 16);
    expect(__cache.has(firstKey)).toBe(true);
    expect(__cache.has(__cache.keyFor('standard', 32, 32))).toBe(false);
  });
});

/** Minimal base64 decoder for the PNG-signature assertion (test-only helper). */
function decodeBase64(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
