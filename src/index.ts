'use client';

import '../styles/glass.css';
export const VERSION = '0.3.1';
// The engine is maintained upstream; matui owns the composed controls.
export { Glass, Glass as LiquidGlass } from '@samasante/liquid-glass';
export type {
  GlassProps,
  GlassProps as LiquidGlassProps,
  GlassOptics,
  GlassSurfaceLens,
} from '@samasante/liquid-glass';
export { GlassButton } from './glass-button';
export type { GlassButtonProps } from './glass-button';
export { GlassCard } from './glass-card';
export type { GlassCardProps } from './glass-card';
export { GlassSegmentedControl } from './glass-segmented-control';
export type { GlassSegmentedControlProps } from './glass-segmented-control';
export { GlassSwitch } from './glass-switch';
export type { GlassSwitchProps } from './glass-switch';
export { GlassSlider } from './glass-slider';
export type { GlassSliderProps } from './glass-slider';
export { GlassNotification } from './glass-notification';
export type { GlassNotificationProps } from './glass-notification';
