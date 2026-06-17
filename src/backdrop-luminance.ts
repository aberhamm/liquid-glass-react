/**
 * Backdrop-luminance sampling (plan 017) — the React-free core.
 *
 * Apple's Liquid Glass is content-adaptive: the material reads the brightness of
 * what sits behind it and adjusts its tint for legibility. There is no reliable,
 * cheap, universal way to read "the pixels behind an arbitrary element" in a
 * browser — `backdrop-filter` happens in the compositor, never exposed to JS. So
 * this module ships a PLUGGABLE, degrading sampling strategy plus the pure
 * luminance math, all framework-free. The React hook
 * (`useBackdropLuminance`) wraps this with effects, throttling, and SSR guards.
 *
 * Two strategies, ONE contract ({@link BackdropSample}):
 *
 * 1. **DOM-background (default).** Walk the stacking order behind the element's
 *    center via `document.elementsFromPoint`, read each layer's computed
 *    `background-color` (and detect opaque `background-image`s), and composite
 *    them front-to-back into one estimated backdrop color. Cheap, synchronous,
 *    no canvas, and NEVER taints — it only reads CSSOM, not pixels. It cannot see
 *    *image content* luminance (only that an opaque image exists), which is an
 *    accepted trade-off for the zero-cost default.
 * 2. **Canvas snapshot (opt-in).** A caller-supplied function that paints the
 *    backdrop into a canvas and returns its average color. This CAN read real
 *    image luminance but can TAINT: a cross-origin image drawn without CORS makes
 *    `getImageData` throw `SecurityError`. This module treats any throw from the
 *    sampler as "could not sample" and returns an unsampled result — it never
 *    rethrows and never logs. (The hook layer enforces the same contract.)
 *
 * This module is intentionally independent of `liquid-glass.tsx`: it is imported
 * only by consumers opting into adaptive tint, so it tree-shakes out of the
 * default `<LiquidGlass>` path and adds zero bytes there.
 */

/** A linear-RGB / sRGB color triple, each channel in `[0, 255]`. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A coarse light/dark classification of a backdrop. */
export type BackdropScheme = 'light' | 'dark';

/**
 * The single result contract shared by every sampling strategy and surfaced by
 * `useBackdropLuminance`.
 */
export interface BackdropSample {
  /**
   * Estimated relative luminance of the backdrop, normalized to `[0, 1]`, or
   * `null` when sampling did not run or could not produce a value (SSR, no
   * window, a tainted canvas, no element under the point).
   */
  luminance: number | null;
  /**
   * Coarse verdict derived from {@link BackdropSample.luminance} at
   * {@link LIGHT_DARK_THRESHOLD}, or `null` when unsampled.
   */
  scheme: BackdropScheme | null;
  /** `true` only when a real luminance reading was produced this call. */
  sampled: boolean;
}

/** The canonical "we could not sample" result. */
export const UNSAMPLED: BackdropSample = {
  luminance: null,
  scheme: null,
  sampled: false,
};

/**
 * Luminance at or above this value is classified `'light'`; below it, `'dark'`.
 *
 * `0.5` is the midpoint of the normalized `[0, 1]` luminance range. It is a
 * coarse, deliberately simple split: relative luminance is already perceptually
 * weighted (see {@link relativeLuminance}), so a midpoint cut maps cleanly to
 * "should dark text or light text sit on this?" for the adaptive-tint consumer
 * (plan 018). Exposed as a constant so consumers and tests share one threshold.
 */
export const LIGHT_DARK_THRESHOLD = 0.5;

/**
 * Convert one sRGB 8-bit channel (`0..255`) to its linear-light value (`0..1`).
 *
 * Applies the sRGB electro-optical transfer function (the WCAG 2.x / sRGB
 * companding curve): a linear segment for very dark values and a gamma curve
 * above it. Required before luminance weighting — averaging raw sRGB bytes
 * over-weights mid-tones.
 *
 * @param channel - An sRGB channel value in `[0, 255]`.
 * @returns The linearized channel in `[0, 1]`.
 */
function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance of an sRGB color, per the WCAG 2.x definition.
 *
 * Linearizes each channel (see {@link srgbChannelToLinear}) then applies the
 * Rec. 709 luma weights (`0.2126 R + 0.7152 G + 0.0722 B`). The result is in
 * `[0, 1]`: `0` for black, `1` for white, with green contributing most and blue
 * least — matching human brightness perception.
 *
 * @param r - Red channel, `[0, 255]`.
 * @param g - Green channel, `[0, 255]`.
 * @param b - Blue channel, `[0, 255]`.
 * @returns Relative luminance in `[0, 1]`.
 *
 * @example
 * relativeLuminance(0, 0, 0); // 0   (black)
 * relativeLuminance(255, 255, 255); // 1   (white)
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * Classify a normalized luminance as `'light'` or `'dark'`.
 *
 * @param luminance - Relative luminance in `[0, 1]`.
 * @returns `'light'` when `luminance >= ` {@link LIGHT_DARK_THRESHOLD}, else
 * `'dark'`.
 */
export function luminanceToScheme(luminance: number): BackdropScheme {
  return luminance >= LIGHT_DARK_THRESHOLD ? 'light' : 'dark';
}

/**
 * Build a complete {@link BackdropSample} from an RGB backdrop estimate.
 *
 * @param color - The estimated backdrop color.
 * @returns A `sampled: true` result with luminance + scheme filled in.
 */
export function averageColorToSample(color: Rgb): BackdropSample {
  const luminance = relativeLuminance(color.r, color.g, color.b);
  return {
    luminance,
    scheme: luminanceToScheme(luminance),
    sampled: true,
  };
}

/**
 * Parse a CSS color string into RGB + alpha.
 *
 * Handles the forms `getComputedStyle` actually returns for
 * `background-color`: `rgb(r, g, b)`, `rgba(r, g, b, a)`, and the special
 * `transparent` / empty values (alpha 0). Modern engines may also emit
 * `rgb(r g b / a)` (space-separated, slash alpha); both are accepted. Anything
 * unrecognized (e.g. exotic `color()` functions) is treated as fully
 * transparent so it is skipped rather than mis-composited.
 *
 * @param value - A computed CSS color string.
 * @returns `{ r, g, b, a }` with channels in `[0, 255]` and `a` in `[0, 1]`.
 */
export function parseCssColor(value: string | null | undefined): Rgb & { a: number } {
  if (!value) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const v = value.trim().toLowerCase();
  if (v === 'transparent' || v === 'none') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  // Pull every numeric token; supports both comma- and space/slash-separated
  // syntaxes. Percent alphas are normalized.
  const match = v.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const r = clampByte(Number.parseFloat(parts[0] as string));
  const g = clampByte(Number.parseFloat(parts[1] as string));
  const b = clampByte(Number.parseFloat(parts[2] as string));
  let a = 1;
  const raw = parts[3];
  if (raw !== undefined) {
    a = raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
    if (!Number.isFinite(a)) {
      a = 1;
    }
  }
  return { r, g, b, a: clamp01(a) };
}

function clampByte(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Source-over composite a foreground color over an opaque background.
 *
 * @param fg - Foreground color with alpha (`a` in `[0, 1]`).
 * @param bg - Opaque background color.
 * @returns The composited opaque color.
 */
function compositeOver(fg: Rgb & { a: number }, bg: Rgb): Rgb {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

/**
 * A sampling strategy: given a viewport point, return a backdrop sample (or
 * {@link UNSAMPLED}). Pluggable so consumers can swap the default DOM walk for a
 * canvas-snapshot path.
 *
 * Implementations MUST NOT throw — a strategy that cannot read (e.g. a tainted
 * canvas) returns {@link UNSAMPLED}. See {@link safeSample}, which enforces this
 * even for a misbehaving strategy.
 */
export type SamplingStrategy = (point: { x: number; y: number }) => BackdropSample;

/**
 * Options for {@link sampleBackdropLuminance}.
 */
export interface SampleBackdropOptions {
  /**
   * Override the sampling strategy. Defaults to {@link domBackgroundStrategy}.
   * Pass a canvas-based strategy here to opt into pixel-accurate sampling
   * (taint-safe: any throw becomes {@link UNSAMPLED}).
   */
  strategy?: SamplingStrategy;
  /**
   * The element to exclude from the DOM walk (the glass surface itself) so its
   * own background is not mistaken for the backdrop. Only used by the default
   * DOM strategy.
   */
  ignore?: Element | null;
}

/**
 * Run a sampling strategy with a total taint/error guard.
 *
 * If the strategy throws for ANY reason — most importantly a `SecurityError`
 * from `getImageData` on a cross-origin-tainted canvas — this returns
 * {@link UNSAMPLED} instead of propagating. It deliberately does NOT log: a
 * tainted backdrop is an expected, recoverable condition, not an application
 * error, and console noise on every animation frame would be hostile.
 *
 * @param strategy - The strategy to invoke.
 * @param point - The viewport point to sample.
 * @returns The strategy's result, or {@link UNSAMPLED} on any throw.
 */
export function safeSample(
  strategy: SamplingStrategy,
  point: { x: number; y: number },
): BackdropSample {
  try {
    return strategy(point);
  } catch {
    // SecurityError (tainted canvas), or any other failure: degrade silently.
    return UNSAMPLED;
  }
}

/**
 * The default, canvas-free sampling strategy.
 *
 * Walks the elements stacked under `point` (front-to-back via
 * `document.elementsFromPoint`), reads each one's computed `background-color`,
 * and composites them over an assumed-white page base. If an element carries an
 * opaque `background-image` (e.g. a photo or gradient), its real pixel color is
 * unknown to CSSOM, so the walk stops at that layer and treats it as a neutral
 * mid-gray occluder — better than ignoring it (which would let a bright page
 * base bleed through a dark photo). This is a heuristic: it captures solid
 * colors and translucency precisely and image presence coarsely, with zero
 * canvas and zero taint risk.
 *
 * @param point - Viewport coordinates to sample under.
 * @param ignore - An element to skip (the glass surface itself).
 * @returns A sampled {@link BackdropSample}, or {@link UNSAMPLED} when there is
 * no DOM / no element under the point.
 */
export function domBackgroundStrategy(
  point: { x: number; y: number },
  ignore?: Element | null,
): BackdropSample {
  if (
    typeof document === 'undefined' ||
    typeof document.elementsFromPoint !== 'function' ||
    typeof getComputedStyle !== 'function'
  ) {
    return UNSAMPLED;
  }

  const stack = document.elementsFromPoint(point.x, point.y);
  if (!stack || stack.length === 0) {
    return UNSAMPLED;
  }

  // Composite front-to-back over an assumed-white page base. Most pages have a
  // white (or near-white) canvas; the <html>/<body> background, if set, is the
  // last opaque layer and overrides it.
  let base: Rgb = { r: 255, g: 255, b: 255 };
  // We must composite back-to-front, so collect the relevant layers first.
  const layers: (Rgb & { a: number })[] = [];

  for (const el of stack) {
    if (ignore && (el === ignore || ignore.contains(el))) {
      continue;
    }
    const style = getComputedStyle(el);
    const hasImage = style.backgroundImage && style.backgroundImage !== 'none';
    const color = parseCssColor(style.backgroundColor);

    if (hasImage) {
      // Opaque-ish image: CSSOM can't tell us its pixels. Use a neutral mid-gray
      // as a conservative occluder and stop — nothing behind it shows through.
      layers.push({ r: 128, g: 128, b: 128, a: 1 });
      break;
    }
    if (color.a > 0) {
      layers.push(color);
      if (color.a >= 1) {
        // Fully opaque solid color occludes everything behind it.
        break;
      }
    }
  }

  // Composite from the furthest-back collected layer toward the front, over base.
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer) {
      base = compositeOver(layer, base);
    }
  }

  return averageColorToSample(base);
}

/**
 * Sample the estimated backdrop luminance under a viewport point.
 *
 * Thin orchestrator: resolves the strategy (default {@link domBackgroundStrategy})
 * and runs it through {@link safeSample} so a tainted canvas or any failure
 * yields {@link UNSAMPLED} rather than throwing.
 *
 * @param point - Viewport coordinates (typically the glass element's center).
 * @param options - {@link SampleBackdropOptions}.
 * @returns A {@link BackdropSample}.
 */
export function sampleBackdropLuminance(
  point: { x: number; y: number },
  options: SampleBackdropOptions = {},
): BackdropSample {
  const { strategy, ignore } = options;
  const resolved: SamplingStrategy = strategy ?? ((p) => domBackgroundStrategy(p, ignore));
  return safeSample(resolved, point);
}

/**
 * Build a canvas-snapshot strategy from a caller-supplied painter.
 *
 * The library does NOT bundle an HTML-to-canvas renderer (zero new deps). A
 * consumer that wants pixel-accurate sampling passes a `draw` callback that
 * paints the backdrop region into the provided `CanvasRenderingContext2D`; this
 * helper then averages the pixels and returns a {@link BackdropSample}. If the
 * canvas is tainted by cross-origin content, `getImageData` throws
 * `SecurityError` — which {@link safeSample} (or the hook) converts to
 * {@link UNSAMPLED}. This helper does NOT swallow the error itself, so the
 * single taint-handling boundary stays in {@link safeSample}.
 *
 * @param draw - Paints the backdrop into the 2D context for the given size.
 * @returns A {@link SamplingStrategy} that averages the painted pixels.
 */
export function createCanvasSnapshotStrategy(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  size = 8,
): SamplingStrategy {
  return () => {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return UNSAMPLED;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return UNSAMPLED;
    }
    draw(ctx, size, size);
    // May throw SecurityError if the canvas is tainted — intentionally not
    // caught here; the single taint boundary is safeSample/the hook.
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      count++;
    }
    if (count === 0) {
      return UNSAMPLED;
    }
    return averageColorToSample({ r: r / count, g: g / count, b: b / count });
  };
}
