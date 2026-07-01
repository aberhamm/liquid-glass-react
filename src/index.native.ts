/**
 * React Native entry point for @aberhamm/liquid-glass-react (plan 025).
 *
 * Metro resolves this via the `react-native` export condition (see
 * `package.json`). It barrels ONLY the platform-neutral surface: the native
 * `<LiquidGlass>` primitive, the shared design tokens (plan 022), and the
 * platform-neutral public types.
 *
 * It deliberately does NOT re-export the DOM-only prebuilt components
 * (`GlassButton` / `GlassCard` / `GlassSegmentedControl`) or the DOM-only hooks
 * (capability detection, backdrop-luminance sampling, mouse tracking), so Metro
 * never pulls web-only code (`document`, `window`, `backdrop-filter`, SVG) into a
 * native bundle. Native ports of the prebuilt components are out of scope for
 * this round (primitive only).
 */

export const VERSION = '0.0.0';

export { LiquidGlass, type LiquidGlassNativeProps } from './liquid-glass.native';

// Platform-neutral public types (the web `LiquidGlassProps` — with its DOM
// `CSSProperties` / `MouseEventHandler` — is intentionally NOT exported here).
export type {
  DisplacementMode,
  GlassVariant,
  LiquidGlassCoreProps,
  MousePos,
} from './types';

// Shared design tokens (plan 022) — the same source of truth the web build uses.
export * from './tokens';
