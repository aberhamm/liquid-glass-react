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
export { usePrefersContrast } from './use-prefers-contrast';
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

// Backdrop-luminance sampling (plan 017). Infrastructure for content-adaptive
// tint (plan 018): exported for advanced consumers who opt into adaptive tint.
// This module is NOT referenced by the default `<LiquidGlass>` render path, so a
// `LiquidGlass` import that doesn't use it tree-shakes it out.
export {
  averageColorToSample,
  createCanvasSnapshotStrategy,
  domBackgroundStrategy,
  luminanceToScheme,
  parseCssColor,
  relativeLuminance,
  safeSample,
  sampleBackdropLuminance,
  LIGHT_DARK_THRESHOLD,
  UNSAMPLED,
  type BackdropSample,
  type BackdropScheme,
  type Rgb,
  type SamplingStrategy,
  type SampleBackdropOptions,
} from './backdrop-luminance';
export {
  useBackdropLuminance,
  type UseBackdropLuminanceOptions,
} from './use-backdrop-luminance';
