/**
 * `useMousePosition()` — pointer tracking relative to an element's center
 * (plan 005).
 *
 * Produces the data the elastic-motion math needs: the absolute pointer position
 * and its offset from the tracked element's center. The hook is the single place
 * that owns the pointer subscription for `<LiquidGlass>`, and it folds in every
 * way that subscription can be overridden or suppressed:
 *
 * - **Controlled mode.** When `globalMousePos` is supplied the hook does NOT
 *   attach its own listener — it derives everything from the caller-provided
 *   position (and the optional `mouseOffset`), so many glass surfaces can be
 *   coordinated from one shared tracker.
 * - **Reduced motion.** It consumes {@link useReducedMotion} (the single live
 *   source) and returns neutral, no-motion values whenever reduced-motion is on.
 * - **Touch.** On touch devices (no hover to chase) cursor-follow is disabled
 *   and neutral values are returned.
 * - **SSR.** Neutral defaults before mount and when `window` is unavailable; it
 *   never touches browser globals during render.
 *
 * The relative-coordinate frame is the tracked `container`'s bounding box when
 * one is provided, otherwise the element's own measured center (the component
 * passes its wrapper element).
 */

import { type RefObject, useEffect, useRef, useState } from 'react';
import type { MousePos } from './types';
import { useReducedMotion } from './use-reduced-motion';

/** A container reference accepted by {@link useMousePosition}. */
export type MouseContainer = RefObject<HTMLElement | null> | HTMLElement | null | undefined;

/** Inputs accepted by {@link useMousePosition}. */
export interface UseMousePositionOptions {
  /**
   * Element (or ref) whose bounds define the tracking frame. When provided, the
   * pointer offset is measured against this container's center; otherwise the
   * tracked element's own center is used.
   */
  container?: MouseContainer;
  /**
   * Externally controlled absolute pointer position. When set, the hook uses it
   * verbatim instead of subscribing to pointer events.
   */
  globalMousePos?: MousePos;
  /**
   * Externally controlled offset from the element center. Paired with
   * {@link UseMousePositionOptions.globalMousePos} for fully controlled motion;
   * when present it is used directly as the offset.
   */
  mouseOffset?: MousePos;
  /**
   * The element whose center the offset is measured from when no `container` is
   * supplied — typically the glass wrapper itself.
   */
  elementRef?: RefObject<HTMLElement | null>;
}

/** Return shape of {@link useMousePosition}. */
export interface MousePositionState {
  /** Absolute pointer position in CSS pixels (`{0,0}` when inactive). */
  mousePos: MousePos;
  /** Pointer offset from the tracked element center, in CSS pixels. */
  offset: MousePos;
  /**
   * Whether motion is live: `false` under SSR, reduced-motion, or touch — in
   * which case `mousePos`/`offset` are neutral and the component must not
   * animate.
   */
  isActive: boolean;
}

const NEUTRAL_POS: MousePos = { x: 0, y: 0 };

const NEUTRAL_STATE: MousePositionState = {
  mousePos: NEUTRAL_POS,
  offset: NEUTRAL_POS,
  isActive: false,
};

/** Resolve a container option to a concrete element (or `null`). */
function resolveElement(container: MouseContainer): HTMLElement | null {
  if (!container) {
    return null;
  }
  if (container instanceof HTMLElement) {
    return container;
  }
  // RefObject
  return container.current ?? null;
}

/** Touch-device detection (SSR-safe). */
function detectTouch(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0;
}

/**
 * Track the pointer relative to an element center.
 *
 * @returns A {@link MousePositionState}: neutral (and `isActive: false`) under
 * SSR, reduced-motion, touch, or controlled-with-no-data; live otherwise.
 */
export function useMousePosition(options: UseMousePositionOptions = {}): MousePositionState {
  const { container, globalMousePos, mouseOffset, elementRef } = options;
  const reducedMotion = useReducedMotion();

  // Touch detection is resolved in an effect so the first (SSR-consistent)
  // render assumes no touch; a touch device then disables follow post-mount.
  const [isTouch, setIsTouch] = useState<boolean>(false);

  const [tracked, setTracked] = useState<MousePositionState>(NEUTRAL_STATE);

  // Keep the latest options in a ref so the listener effect doesn't re-subscribe
  // on every render when a parent passes fresh object identities.
  const optsRef = useRef({ container, elementRef });
  optsRef.current = { container, elementRef };

  useEffect(() => {
    setIsTouch(detectTouch());
  }, []);

  // Motion is suppressed entirely under reduced-motion or touch, and the hook
  // never subscribes when externally controlled.
  const motionDisabled = reducedMotion || isTouch;
  const controlled = globalMousePos !== undefined;

  useEffect(() => {
    // No internal listener when controlled, disabled, or in a non-DOM env.
    if (controlled || motionDisabled) {
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handle = (event: MouseEvent): void => {
      const { container: c, elementRef: er } = optsRef.current;
      const frameEl = resolveElement(c) ?? er?.current ?? null;
      if (!frameEl) {
        return;
      }
      const rect = frameEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setTracked({
        mousePos: { x: event.clientX, y: event.clientY },
        offset: { x: event.clientX - centerX, y: event.clientY - centerY },
        isActive: true,
      });
    };

    document.addEventListener('mousemove', handle);
    return () => document.removeEventListener('mousemove', handle);
  }, [controlled, motionDisabled]);

  // --- Derive the returned state -------------------------------------------

  // Reduced-motion / touch always win: neutral, inactive.
  if (motionDisabled) {
    return NEUTRAL_STATE;
  }

  // Controlled mode: derive from the supplied position/offset.
  if (controlled) {
    const pos = globalMousePos as MousePos;
    let offset = mouseOffset;
    if (offset === undefined) {
      // Compute offset from the element center if we can measure it.
      const frameEl = resolveElement(container) ?? elementRef?.current ?? null;
      if (frameEl) {
        const rect = frameEl.getBoundingClientRect();
        offset = {
          x: pos.x - (rect.left + rect.width / 2),
          y: pos.y - (rect.top + rect.height / 2),
        };
      } else {
        offset = NEUTRAL_POS;
      }
    }
    return { mousePos: pos, offset, isActive: true };
  }

  return tracked;
}
