/**
 * Displacement-map generator for the liquid-glass refraction effect.
 *
 * The SVG `feDisplacementMap` filter (plan 004) reads an image whose **R channel
 * encodes X displacement** and **B channel encodes Y displacement** (with
 * `xChannelSelector="R" yChannelSelector="B"`). A byte value of `128` is
 * neutral (no shift); `<128` shifts one way, `>128` the other. This module
 * produces those maps from first-principles SDF math and encodes them as real
 * PNG `data:` URLs.
 *
 * ## Why a pure-JS PNG encoder instead of `canvas.toDataURL()`
 *
 * The plan's Design section describes an offscreen-canvas renderer. We
 * intentionally deviate: the test environment is jsdom, whose `<canvas>` is not
 * implemented (`getContext` returns `null`), which would force the hard
 * "four-modes-are-distinct" acceptance test to be skipped in CI — defeating its
 * purpose. Instead we compute an RGBA buffer from the SDF math and encode it to
 * a PNG with a small, dependency-free, deterministic encoder (uncompressed/
 * "stored" zlib blocks + adler32 + CRC32). The observable contract is identical
 * to the canvas path (R=X, B=Y, 128 neutral, a `data:image/png;base64,…` URL),
 * but it runs identically in browser, Node, and jsdom with **zero** dependencies
 * and no canvas. No upstream base64 blobs are copied — every map is generated.
 *
 * This module is intentionally free of React and of the DOM `<canvas>` API.
 */

import type { DisplacementMode } from './types';

/** Modes that resolve to a `data:` URL map. `'turbulence'` is procedural (plan 004). */
export type MapMode = Exclude<DisplacementMode, 'turbulence'>;

// ---------------------------------------------------------------------------
// Pure math
// ---------------------------------------------------------------------------

/**
 * Signed distance from point `(x, y)` to a rounded rectangle of size `w × h`
 * **centered at the origin**, with corner radius `r`.
 *
 * Convention: **negative inside**, **zero on the border**, **positive outside**
 * (the standard SDF sign convention). The radius is clamped to half the smaller
 * side so it can never exceed the rectangle.
 *
 * @param x - X coordinate relative to the rectangle center.
 * @param y - Y coordinate relative to the rectangle center.
 * @param w - Full width of the rectangle.
 * @param h - Full height of the rectangle.
 * @param r - Corner radius.
 * @returns Signed distance in the same units as the inputs.
 */
export function roundedRectSDF(x: number, y: number, w: number, h: number, r: number): number {
  const halfW = w / 2;
  const halfH = h / 2;
  const radius = Math.max(0, Math.min(r, Math.min(halfW, halfH)));
  // Distance from center to the corner-circle centers, in the first quadrant.
  const qx = Math.abs(x) - (halfW - radius);
  const qy = Math.abs(y) - (halfH - radius);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  const outside = Math.sqrt(dx * dx + dy * dy);
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

/**
 * Standard GLSL-style smoothstep. Returns `0` for `t <= a`, `1` for `t >= b`,
 * and a smooth Hermite interpolation (`3u² − 2u³`) in between. Clamps outside
 * the `[a, b]` range. If `a === b` it degenerates to a step at `a`.
 *
 * @param a - Lower edge.
 * @param b - Upper edge.
 * @param t - Value to interpolate.
 * @returns A value in `[0, 1]`.
 */
export function smoothStep(a: number, b: number, t: number): number {
  if (a === b) return t < a ? 0 : 1;
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** Clamp a float displacement (range roughly `[-1, 1]`) to a `0–255` byte, 128 = neutral. */
function encodeByte(value: number): number {
  const v = Math.round(128 + value * 127);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// ---------------------------------------------------------------------------
// Per-mode field rendering -> RGBA buffer
// ---------------------------------------------------------------------------

/**
 * Render the raw RGBA buffer (length `width*height*4`) for a given mode.
 *
 * Encoding: `R` = X displacement, `B` = Y displacement, `A` = 255, `G` = 0.
 * `128` is neutral. Each mode uses genuinely different math so the resulting
 * buffers (and therefore the PNG data-URLs) differ.
 *
 * Exported for unit testing the field directly without PNG round-tripping.
 *
 * @internal
 */
export function renderMapBuffer(mode: MapMode, width: number, height: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  // A corner radius proportional to the smaller side gives aspect-correct corners.
  const radius = Math.min(width, height) * 0.35;
  // Edge band widths (in px) and amplitudes differ per mode.

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Sample at pixel centers, relative to the rect center.
      const x = px + 0.5 - cx;
      const y = py + 0.5 - cy;

      let dispX = 0;
      let dispY = 0;

      if (mode === 'polar') {
        // Radial displacement: push outward from center, ramping up near the edge.
        const dist = Math.sqrt(x * x + y * y);
        const sdf = roundedRectSDF(x, y, width, height, radius);
        // Band over the inner region: stronger toward the perimeter.
        const band = smoothStep(-Math.min(width, height) * 0.5, 0, sdf);
        const nx = dist === 0 ? 0 : x / dist;
        const ny = dist === 0 ? 0 : y / dist;
        dispX = nx * band * 0.9;
        dispY = ny * band * 0.9;
      } else {
        // SDF-gradient modes: standard / prominent / shader.
        // Band parameters tuned per mode for distinct character.
        let inner: number;
        let outer: number;
        let amplitude: number;
        if (mode === 'standard') {
          inner = -Math.min(width, height) * 0.18;
          outer = 0;
          amplitude = 0.7;
        } else if (mode === 'prominent') {
          // Wider band + higher amplitude => stronger, thicker-glass refraction.
          inner = -Math.min(width, height) * 0.4;
          outer = 0;
          amplitude = 1.0;
        } else {
          // 'shader' — sharper, narrower SDF + smoothstep field with mild
          // overshoot past the edge for a crisper highlight character.
          inner = -Math.min(width, height) * 0.1;
          outer = Math.min(width, height) * 0.04;
          amplitude = 0.85;
        }

        // Numeric gradient of the smoothstep(SDF) band -> displacement vector
        // pointing along the steepest edge falloff.
        const sdfL = roundedRectSDF(x - 1, y, width, height, radius);
        const sdfR = roundedRectSDF(x + 1, y, width, height, radius);
        const sdfU = roundedRectSDF(x, y - 1, width, height, radius);
        const sdfD = roundedRectSDF(x, y + 1, width, height, radius);
        const bandL = smoothStep(inner, outer, sdfL);
        const bandR = smoothStep(inner, outer, sdfR);
        const bandU = smoothStep(inner, outer, sdfU);
        const bandD = smoothStep(inner, outer, sdfD);
        dispX = (bandR - bandL) * 0.5 * amplitude;
        dispY = (bandD - bandU) * 0.5 * amplitude;
      }

      const i = (py * width + px) * 4;
      buf[i] = encodeByte(dispX); // R = X displacement
      buf[i + 1] = 0; // G unused
      buf[i + 2] = encodeByte(dispY); // B = Y displacement
      buf[i + 3] = 255; // A
    }
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Pure PNG encoder (no canvas, no deps)
// ---------------------------------------------------------------------------

/** Precomputed CRC32 lookup table (IEEE polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32 over a byte range, per the PNG spec. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ (bytes[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Adler-32 checksum for the zlib stream trailer. */
function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] as number)) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Wrap raw bytes in a zlib stream using only "stored" (uncompressed) DEFLATE
 * blocks. Deterministic and dependency-free; the resulting stream is a valid
 * zlib payload that any PNG decoder (including the browser) accepts.
 */
function zlibStore(data: Uint8Array): Uint8Array {
  const MAX = 0xffff; // max stored-block length
  // Each block adds a 5-byte header (BFINAL/BTYPE + LEN + NLEN). At least one
  // block is always emitted (even for empty input). 2-byte zlib header + 4-byte
  // adler32 trailer bracket the stream.
  const blockCount = Math.max(1, Math.ceil(data.length / MAX));
  const out = new Uint8Array(2 + blockCount * 5 + data.length + 4);
  let w = 0;
  // zlib header: CMF=0x78 (deflate, 32K window), FLG=0x01 (no dict, check ok).
  out[w++] = 0x78;
  out[w++] = 0x01;
  let offset = 0;
  do {
    const len = Math.min(data.length - offset, MAX);
    const isFinal = offset + len >= data.length;
    out[w++] = isFinal ? 1 : 0; // BFINAL bit, BTYPE=00 (stored)
    out[w++] = len & 0xff; // LEN (little-endian)
    out[w++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    out[w++] = nlen & 0xff; // NLEN (one's complement)
    out[w++] = (nlen >>> 8) & 0xff;
    out.set(data.subarray(offset, offset + len), w);
    w += len;
    offset += len;
  } while (offset < data.length);
  const checksum = adler32(data);
  out[w++] = (checksum >>> 24) & 0xff; // adler32 big-endian
  out[w++] = (checksum >>> 16) & 0xff;
  out[w++] = (checksum >>> 8) & 0xff;
  out[w++] = checksum & 0xff;
  return out;
}

/**
 * Build a PNG chunk (4-byte length + 4-byte type + data + 4-byte CRC) as a
 * standalone byte array. The CRC is computed over `type + data`.
 */
function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(12 + len);
  chunk[0] = (len >>> 24) & 0xff;
  chunk[1] = (len >>> 16) & 0xff;
  chunk[2] = (len >>> 8) & 0xff;
  chunk[3] = len & 0xff;
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  // CRC covers type (bytes 4..7) + data.
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk[8 + len] = (crc >>> 24) & 0xff;
  chunk[9 + len] = (crc >>> 16) & 0xff;
  chunk[10 + len] = (crc >>> 8) & 0xff;
  chunk[11 + len] = crc & 0xff;
  return chunk;
}

/**
 * Encode an RGBA buffer to PNG bytes (8-bit, color type 6 = truecolor+alpha).
 * Each scanline is prefixed with filter byte 0 (None), as the PNG format
 * requires, then the whole thing is run through the stored-block zlib wrapper.
 */
function encodePng(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  // Build raw image data: one filter byte (0) per scanline + RGBA row.
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let row = 0; row < height; row++) {
    const rawRow = row * (stride + 1);
    raw[rawRow] = 0; // filter type: None
    raw.set(rgba.subarray(row * stride, row * stride + stride), rawRow + 1);
  }
  const idatData = zlibStore(raw);

  // IHDR: width, height, bit depth 8, color type 6, compression 0, filter 0, interlace 0.
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const total = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const out = new Uint8Array(total);
  let w = 0;
  for (const part of [signature, ihdrChunk, idatChunk, iendChunk]) {
    out.set(part, w);
    w += part.length;
  }
  return out;
}

/** Base64 lookup alphabet. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64-encode a byte array without relying on `btoa` (browser) or `Buffer`
 * (Node) — a pure implementation that works identically in every environment.
 */
function base64Encode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n =
      ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    result +=
      B64.charAt((n >>> 18) & 63) +
      B64.charAt((n >>> 12) & 63) +
      B64.charAt((n >>> 6) & 63) +
      B64.charAt(n & 63);
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = (bytes[i] as number) << 16;
    result += `${B64.charAt((n >>> 18) & 63)}${B64.charAt((n >>> 12) & 63)}==`;
  } else if (rem === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    result += `${B64.charAt((n >>> 18) & 63)}${B64.charAt((n >>> 12) & 63)}${B64.charAt((n >>> 6) & 63)}=`;
  }
  return result;
}

/** A 1×1 fully-transparent PNG, used as the degenerate/SSR-safe fallback. */
function transparentPixelDataUrl(): string {
  const rgba = new Uint8ClampedArray([0, 0, 0, 0]);
  return `data:image/png;base64,${base64Encode(encodePng(rgba, 1, 1))}`;
}

// ---------------------------------------------------------------------------
// Bounded LRU cache + dimension quantization
// ---------------------------------------------------------------------------

/** Hard cap on cached maps; least-recently-used entries are evicted past this. */
const CACHE_CAP = 32;
/** Grid step (px) that width/height are quantized to before keying + generating. */
const QUANT_GRID = 16;

/** A real LRU: a `Map` preserves insertion order; re-inserting on access marks recency. */
const cache = new Map<string, string>();

/** Quantize a dimension to the nearest grid step, with a minimum of one grid cell. */
function quantize(value: number): number {
  return Math.max(QUANT_GRID, Math.round(value / QUANT_GRID) * QUANT_GRID);
}

/**
 * Test-only hook: clears the cache and exposes its current size. Not part of the
 * public package API (re-exported only for unit tests).
 *
 * @internal
 */
export const __cache = {
  clear(): void {
    cache.clear();
  },
  get size(): number {
    return cache.size;
  },
  has(key: string): boolean {
    return cache.has(key);
  },
  keyFor(mode: MapMode, width: number, height: number): string {
    return `${mode}:${quantize(width)}x${quantize(height)}`;
  },
};

/**
 * Generate (or return a cached) displacement map for the given mode and size.
 *
 * Width/height are quantized to a 16px grid before both keying and rendering, so
 * a resize storm of near-identical sizes collapses to a single render while
 * keeping aspect-correct corners. Results are memoized in a bounded LRU
 * (cap {@link CACHE_CAP}).
 *
 * Degenerate input (`width <= 0` or `height <= 0`, or non-finite) returns a 1×1
 * transparent PNG instead of throwing, making the function SSR- and
 * no-dimension-safe.
 *
 * @param mode - Which generator to use. Excludes `'turbulence'` (procedural, 004).
 * @param width - Target map width in px.
 * @param height - Target map height in px.
 * @returns A `data:image/png;base64,…` URL.
 */
export function getDisplacementMap(mode: MapMode, width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return transparentPixelDataUrl();
  }

  const qw = quantize(width);
  const qh = quantize(height);
  const key = `${mode}:${qw}x${qh}`;

  const cached = cache.get(key);
  if (cached !== undefined) {
    // Mark as most-recently-used.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const rgba = renderMapBuffer(mode, qw, qh);
  const url = `data:image/png;base64,${base64Encode(encodePng(rgba, qw, qh))}`;

  cache.set(key, url);
  if (cache.size > CACHE_CAP) {
    // Evict the least-recently-used (oldest insertion-order) entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return url;
}
