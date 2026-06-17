/**
 * `useBackdropLuminance(ref, options?)` (plan 017) — the throttled, SSR-safe
 * React wrapper around the framework-free sampler in `./backdrop-luminance`.
 *
 * It estimates the luminance of the page content BEHIND `ref`'s element and
 * returns a stable `{ luminance, scheme, sampled }` reading for the adaptive-tint
 * consumer (plan 018). Design notes:
 *
 * - **SSR-safe / no measurement during render.** It returns {@link UNSAMPLED}
 *   on the server AND on the first client paint, so server and first client
 *   render agree and hydration never mismatches. The first real sample runs in
 *   an effect after mount — never during render.
 * - **Throttled.** Re-sampling (on mount, and optionally on `scroll`/`resize`)
 *   coalesces through a single `requestAnimationFrame`, so a scroll/resize storm
 *   produces at most one sample per frame. The rAF + ResizeObserver guard
 *   patterns mirror those already used in `glass-segmented-control.tsx`.
 * - **Taint-safe.** Sampling goes through `safeSample`, so a cross-origin-tainted
 *   canvas (`getImageData` ⇒ `SecurityError`) — or any sampler failure — yields
 *   `{ sampled: false, luminance: null, scheme: null }`. The hook NEVER throws
 *   and NEVER logs.
 *
 * This module is independently importable and is NOT referenced by the default
 * `<LiquidGlass>` render path, so it tree-shakes away for consumers that don't
 * opt into adaptive tint.
 */

import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  type BackdropSample,
  type SamplingStrategy,
  UNSAMPLED,
  sampleBackdropLuminance,
} from './backdrop-luminance';

/** Options for {@link useBackdropLuminance}. */
export interface UseBackdropLuminanceOptions {
  /**
   * Custom sampling strategy (e.g. a canvas-snapshot strategy from
   * `createCanvasSnapshotStrategy`). Defaults to the canvas-free DOM-background
   * walk. Any throw from the strategy is caught and surfaced as an unsampled
   * result.
   */
  strategy?: SamplingStrategy;
  /**
   * Re-sample when the window scrolls. Default `true`. Scroll changes what is
   * behind the element, so the reading goes stale without this.
   */
  resampleOnScroll?: boolean;
  /**
   * Re-sample when the window resizes. Default `true`.
   */
  resampleOnResize?: boolean;
  /**
   * Skip sampling entirely (returns {@link UNSAMPLED}). Lets a consumer disable
   * the work without unmounting the hook — e.g. when adaptive tint is off.
   */
  disabled?: boolean;
}

/**
 * Estimate the luminance of the backdrop behind `ref`'s element.
 *
 * @param ref - Ref to the glass element whose backdrop should be sampled. Its
 * center point drives the sample, and the element itself is excluded from the
 * DOM walk so its own background is not mistaken for the backdrop.
 * @param options - {@link UseBackdropLuminanceOptions}.
 * @returns A {@link BackdropSample}: {@link UNSAMPLED} during SSR / before mount /
 * when disabled / on taint, otherwise the live reading.
 */
export function useBackdropLuminance(
  ref: RefObject<HTMLElement | null>,
  options: UseBackdropLuminanceOptions = {},
): BackdropSample {
  const { strategy, resampleOnScroll = true, resampleOnResize = true, disabled = false } = options;

  // UNSAMPLED before mount keeps SSR and the first client render in agreement;
  // the mount effect upgrades to the real reading. No measurement during render.
  const [sample, setSample] = useState<BackdropSample>(UNSAMPLED);

  // Hold the latest options in refs so the listener effect can run ONCE
  // (mount/unmount) and read the current values through the ref, instead of
  // tearing down + re-subscribing whenever a parent passes fresh identities.
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  useEffect(() => {
    if (disabled) {
      // When toggled off, reset to UNSAMPLED so consumers see a stable cleared
      // reading rather than a stale value.
      setSample((prev) => (prev.sampled ? UNSAMPLED : prev));
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let frame = 0;
    let cancelled = false;

    const run = (): void => {
      const el = ref.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const point = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const next = sampleBackdropLuminance(point, {
        strategy: strategyRef.current,
        ignore: el,
      });
      if (!cancelled) {
        // Only update when the verdict-relevant fields actually change, so
        // consumers don't re-render on identical readings.
        setSample((prev) =>
          prev.sampled === next.sampled &&
          prev.luminance === next.luminance &&
          prev.scheme === next.scheme
            ? prev
            : next,
        );
      }
    };

    // rAF-throttle: a scroll/resize storm coalesces to one sample per frame.
    const schedule = (): void => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        run();
      });
    };

    // Initial sample after mount.
    schedule();

    if (resampleOnScroll) {
      window.addEventListener('scroll', schedule, { passive: true, capture: true });
    }
    if (resampleOnResize) {
      window.addEventListener('resize', schedule, { passive: true });
    }

    return () => {
      cancelled = true;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      if (resampleOnScroll) {
        window.removeEventListener('scroll', schedule, { capture: true } as EventListenerOptions);
      }
      if (resampleOnResize) {
        window.removeEventListener('resize', schedule);
      }
    };
    // ref is a stable object; we depend on the toggles that change subscription
    // shape. The strategy is read through a ref so its identity is not a dep.
  }, [ref, disabled, resampleOnScroll, resampleOnResize]);

  return sample;
}
