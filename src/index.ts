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

export { LiquidGlass } from './liquid-glass';

// Prebuilt batteries-included components (plan 007). They import
// './components.css', so the build emits the stylesheet. Consumers must import
// it once: `import '@aberhamm/liquid-glass-react/styles.css';`
export {
  GlassButton,
  type GlassButtonProps,
  type GlassButtonVariant,
  type GlassButtonSize,
} from './glass-button';
export {
  GlassCard,
  type GlassCardProps,
  type GlassCardElevation,
} from './glass-card';
export {
  GlassSegmentedControl,
  type GlassSegmentedControlProps,
  type GlassSegmentedControlSize,
  type GlassSegmentedOption,
} from './glass-segmented-control';

// Motion + rim-lighting surface (plan 005). Exported for advanced consumers who
// coordinate motion externally or reuse the bevel.
export { useReducedMotion } from './use-reduced-motion';
export { useReducedTransparency } from './use-reduced-transparency';
export {
  useMousePosition,
  type MouseContainer,
  type MousePositionState,
  type UseMousePositionOptions,
} from './use-mouse-position';
export {
  calculateDirectionalScale,
  calculateElasticTranslation,
  type DirectionalScale,
  type ElasticTranslation,
} from './motion';
export {
  GLASS_EDGE_LIGHT,
  GLASS_EDGE_DARK,
  getGlassEdgeShadow,
  type GlassEdgeScheme,
} from './glass-edge';
