/**
 * `<LiquidGlass>` — React Native surface (plan 025).
 *
 * The web `<LiquidGlass>` (`liquid-glass.tsx`) renders a tiered
 * `backdrop-filter` recipe with an OPT-IN, Chromium-only SVG refraction pass.
 * React Native has no DOM, no `backdrop-filter`, and no SVG-over-backdrop
 * compositing, so this surface renders ONLY the portable frosted recipe — the
 * same look the web file falls back to on every non-Chromium engine — built from
 * real native primitives:
 *
 *   1. an `expo-blur` `BlurView` for the frosted backdrop (a real iOS
 *      `UIVisualEffectView`; on Android `experimentalBlurMethod` approximates it
 *      and degrades gracefully);
 *   2. a white TINT overlay (`FROSTED_DEFAULT_FILL`) that gives the surface its
 *      milky body — alpha is raised slightly on Android where the blur is weaker
 *      so the surface never reads as a bare transparent box;
 *   3. an `expo-linear-gradient` SHEEN highlight (top-biased specular, from the
 *      `SPECULAR_*` tokens);
 *   4. a ~1px hairline ring (`FROSTED_HAIRLINE_RING`);
 *   5. a soft drop shadow (iOS `shadow*` / Android `elevation`) from
 *      `SHADOW_LAYERS`.
 *
 * Every geometry/color value comes from `src/tokens.ts`, the one source of truth
 * shared with the web file — this module only SERIALIZES those values into RN
 * style objects (the RN analogue of the web file owning the CSS strings).
 *
 * ## Prop contract
 *
 * Typed on the platform-neutral {@link LiquidGlassCoreProps} (plan 022) plus
 * native-appropriate `style?: ViewStyle` and `onPress?` — it NEVER references the
 * web `LiquidGlassProps`'s DOM-only style/event types. The event handler is
 * platform-idiomatic: native exposes `onPress` (web keeps `onClick`).
 *
 * The web-only refraction/motion props are accepted for a single cross-platform
 * API contract but are DOCUMENTED NO-OPs here — native always renders frosted:
 * `displacement`, `displacementScale`, `aberrationIntensity`, `elasticity`,
 * `saturation` (no native backdrop-saturation control), `overLight`,
 * `adaptiveTint`, `scrollAwareShadow`, `variant`, `mode`, `className`, and the
 * plan-030 cross-browser copy-refraction props `refract`, `size`, `center`,
 * `behind` (RN has no SVG element filters, so there is no copy-refraction path).
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  BLUR_PX_PER_UNIT,
  DEFAULTS,
  FROSTED_DEFAULT_FILL,
  FROSTED_HAIRLINE_RING,
  SHADOW_LAYERS,
  SPECULAR_CORE_OPACITY,
} from './tokens';
import type { LiquidGlassCoreProps } from './types';

/**
 * Props for the React Native `<LiquidGlass>` surface: the platform-neutral core
 * (plan 022) plus native `style` and an `onPress` handler. Distinct from the web
 * `LiquidGlassProps`, which carries DOM-only style/event types.
 */
export type LiquidGlassNativeProps = LiquidGlassCoreProps & {
  /** Style merged onto the outermost native `View`. */
  style?: ViewStyle;
  /** Press handler (native-idiomatic; the web surface uses `onClick`). */
  onPress?: () => void;
};

/**
 * Maps the small public `blurAmount` (a rem-ish factor, default `0.0625`) onto an
 * `expo-blur` `intensity` (0–100). The web file turns `blurAmount` into a px blur
 * via {@link BLUR_PX_PER_UNIT}; native has no px blur radius, so we reuse that
 * same px figure and scale it into the intensity scale. Default `blurAmount`
 * lands at ~`intensity: 25`, a legible frosted default; larger values ramp up and
 * saturate at 100.
 */
const NATIVE_BLUR_INTENSITY_SCALE = 25;

/**
 * Extra tint alpha added on Android, where `expo-blur` (even with
 * `experimentalBlurMethod`) blurs less convincingly than the iOS
 * `UIVisualEffectView`. Raising the fill keeps the surface legible instead of a
 * near-transparent box — the documented Android degradation boundary.
 */
const ANDROID_TINT_ALPHA_BOOST = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Coerce the public `cornerRadius` (number | CSS length string) to an RN radius. */
function toRadius(value: number | string): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number(DEFAULTS.cornerRadius) || 0;
}

/**
 * Coerce the public `padding` (number | CSS shorthand string like `'24px 32px'`)
 * to an RN padding style. Percentage/keyword tokens fall back to a numeric
 * default — RN paddings must be numbers.
 */
function toPadding(value: number | string): ViewStyle {
  if (typeof value === 'number') return { padding: value };
  const parts = value
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseFloat(token))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 1) return { padding: parts[0] ?? 0 };
  if (parts.length === 2) {
    return { paddingVertical: parts[0] ?? 0, paddingHorizontal: parts[1] ?? 0 };
  }
  if (parts.length === 3) {
    return {
      paddingTop: parts[0] ?? 0,
      paddingHorizontal: parts[1] ?? 0,
      paddingBottom: parts[2] ?? 0,
    };
  }
  if (parts.length >= 4) {
    return {
      paddingTop: parts[0] ?? 0,
      paddingRight: parts[1] ?? 0,
      paddingBottom: parts[2] ?? 0,
      paddingLeft: parts[3] ?? 0,
    };
  }
  return { padding: 24 };
}

/** Parse an `rgb()/rgba()` string into channels, or `null` if it isn't one. */
function parseRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match || !match[1]) return null;
  const parts = match[1].split(',').map((token) => Number.parseFloat(token.trim()));
  if (parts.length < 3) return null;
  return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
}

/**
 * The frosted tint fill. iOS uses the shared {@link FROSTED_DEFAULT_FILL}; Android
 * raises the alpha by {@link ANDROID_TINT_ALPHA_BOOST} for legibility under its
 * weaker blur. Falls back to the raw token if the color can't be parsed.
 */
function resolveTintFill(): string {
  if (Platform.OS !== 'android') return FROSTED_DEFAULT_FILL;
  const parsed = parseRgba(FROSTED_DEFAULT_FILL);
  if (!parsed) return FROSTED_DEFAULT_FILL;
  const alpha = clamp(parsed.a + ANDROID_TINT_ALPHA_BOOST, 0, 1);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

const styles = StyleSheet.create({
  // Inline-block-ish container: shrinks to content, carries padding + shadow. It
  // does NOT clip (no overflow:hidden) so the iOS shadow / Android elevation is
  // not cut off; the blur is clipped by the inner `clip` layer instead.
  container: {
    position: 'relative',
    alignSelf: 'flex-start',
    shadowColor: '#000',
  },
  // Absolutely-filled clip layer: rounds + clips the BlurView/tint/sheen to the
  // corner radius and carries the hairline ring. A sibling BEHIND the content.
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderWidth: FROSTED_HAIRLINE_RING.width,
    borderColor: FROSTED_HAIRLINE_RING.color,
  },
  fill: StyleSheet.absoluteFillObject,
  // Content sits above the surface layers, unaffected by the blur/tint/sheen.
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

/**
 * The React Native liquid-glass primitive. See the file header for the layer
 * stack, the token mapping, and the web-only prop no-ops.
 *
 * The web-only props (`displacement`, `saturation`, `variant`, `mode`, `refract`,
 * `size`, `center`, `behind`, etc.) are intentionally NOT read — they're accepted
 * so the cross-platform API is uniform, but native always renders the frosted
 * recipe.
 */
export function LiquidGlass({
  children,
  blurAmount = DEFAULTS.blurAmount,
  cornerRadius = DEFAULTS.cornerRadius,
  padding = DEFAULTS.padding,
  style,
  onPress,
}: LiquidGlassNativeProps): ReactNode {
  const radius = toRadius(cornerRadius);

  // Reuse the web px-blur mapping (blurAmount * BLUR_PX_PER_UNIT) then project it
  // onto expo-blur's 0–100 intensity scale.
  const blurPx = blurAmount * BLUR_PX_PER_UNIT;
  const intensity = clamp(Math.round(blurPx * NATIVE_BLUR_INTENSITY_SCALE), 0, 100);

  const tintFill = resolveTintFill();

  // Top-biased specular sheen mirroring the web highlight's rest stops
  // (SPECULAR_REST at top-center): bright core → mid → transparent.
  const core = SPECULAR_CORE_OPACITY.rest;
  const sheenColors = [
    `rgba(255, 255, 255, ${core})`,
    `rgba(255, 255, 255, ${(core * 0.4).toFixed(3)})`,
    'rgba(255, 255, 255, 0)',
  ] as const;

  // Primary drop-shadow layer (RN supports a single shadow; take the base layer).
  const {
    y: shadowY,
    blur: shadowBlur,
    alpha: shadowAlpha,
  } = SHADOW_LAYERS.rest[0] ?? { y: 8, blur: 24, alpha: 0.22 };

  const containerStyle: ViewStyle = {
    borderRadius: radius,
    // iOS shadow; Android elevation needs a backgroundColor to render — it is
    // fully covered by the absolutely-filled clip layer, so it is never visible.
    shadowOffset: { width: 0, height: shadowY },
    shadowOpacity: shadowAlpha,
    shadowRadius: shadowBlur,
    elevation: Math.round(shadowY),
    ...(Platform.OS === 'android' ? { backgroundColor: tintFill } : null),
    ...toPadding(padding),
  };

  const clipStyle: ViewStyle = { borderRadius: radius };

  const surface = (
    <>
      <View pointerEvents="none" style={[styles.clip, clipStyle]}>
        <BlurView
          intensity={intensity}
          tint="light"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
          style={styles.fill}
        />
        <View style={[styles.fill, { backgroundColor: tintFill }]} />
        <LinearGradient
          colors={sheenColors}
          locations={[0, 0.3, 0.65]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
      </View>
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.container, containerStyle, style]}>
        {surface}
      </Pressable>
    );
  }

  return <View style={[styles.container, containerStyle, style]}>{surface}</View>;
}
