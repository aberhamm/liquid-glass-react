/**
 * Public entry point for @aberhamm/liquid-glass-react.
 *
 * Plan 002 establishes the load-bearing contracts: public types, runtime
 * capability detection, and the React hook. Rendering, the SVG filter, and the
 * `<LiquidGlass>` component itself land in later plans.
 */

export const VERSION = '0.0.0';

export type {
  DisplacementMode,
  GlassCapabilities,
  LiquidGlassProps,
  MousePos,
} from './types';

export {
  detectGlassCapabilities,
  getConservativeGlassCapabilities,
} from './capabilities';

export { useGlassCapabilities } from './use-glass-capabilities';

export { getDisplacementMap, roundedRectSDF, smoothStep } from './displacement';
