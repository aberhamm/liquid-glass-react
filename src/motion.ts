'use client';

import {
  animateGlassValue,
  glassValue,
  useLensWobble as useUpstreamLensWobble,
} from '@samasante/liquid-glass';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useGlassAnimation() {
  const reduced = useReducedMotion();
  return useCallback(
    (...[value, to, options]: Parameters<typeof animateGlassValue>) =>
      animateGlassValue(value, to, reduced ? { ...options, duration: 0 } : options),
    [reduced],
  );
}

export function useLensWobble(
  ...[position, stretch, hold, kick]: Parameters<typeof useUpstreamLensWobble>
) {
  const reduced = useReducedMotion();
  const stationary = useMemo(() => glassValue(0), []);
  const noHold = useRef(0);
  const noKick = useRef<() => void>(() => {});
  useUpstreamLensWobble(
    reduced ? stationary : position,
    stretch,
    reduced ? noHold : hold,
    reduced ? noKick : kick,
  );
  useEffect(() => {
    if (reduced) {
      stretch.set(0);
      kick.current = () => {};
    }
  }, [reduced, stretch, kick]);
}
