/**
 * Pure elastic-motion math for `<LiquidGlass>` (plan 005).
 *
 * Two deterministic, side-effect-free functions translate a pointer position
 * (relative to an element's center) into a CSS `transform`:
 *
 * - {@link calculateDirectionalScale} — a directional stretch (the glass bulges
 *   toward the cursor, narrows across the perpendicular axis).
 * - {@link calculateElasticTranslation} — a subtle positional nudge toward the
 *   cursor.
 *
 * Both share the same activation model: a `fadeIn` ramp that grows as the cursor
 * nears the element, a `stretch` magnitude that scales with distance from center
 * and `elasticity`, and a hard `elasticity === 0 ⇒ no motion` guarantee. The
 * component and the unit tests both consume these exact signatures.
 */

/** Distance (px) over which the elastic effect fades in as the cursor nears. */
const ACTIVATION_DISTANCE = 200;

/** Distance (px) at which the directional stretch magnitude saturates. */
const STRETCH_SATURATION_DISTANCE = 300;

/** Per-axis stretch coefficient along the cursor direction (grow). */
const STRETCH_PRIMARY = 0.3;

/** Per-axis stretch coefficient across the cursor direction (shrink). */
const STRETCH_SECONDARY = 0.15;

/** Lower clamp for scale factors so the glass never collapses. */
const MIN_SCALE = 0.8;

/** Translation coefficient applied to the raw center offset. */
const TRANSLATION_FACTOR = 0.1;

/** Result of {@link calculateDirectionalScale}. */
export interface DirectionalScale {
  /** Horizontal scale factor (`1` = unscaled), clamped `>= 0.8`. */
  scaleX: number;
  /** Vertical scale factor (`1` = unscaled), clamped `>= 0.8`. */
  scaleY: number;
}

/** Result of {@link calculateElasticTranslation}. */
export interface ElasticTranslation {
  /** Horizontal nudge in CSS pixels. */
  x: number;
  /** Vertical nudge in CSS pixels. */
  y: number;
}

/** Clamp `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Activation ramp: `1` when the cursor is on the element center, decaying to `0`
 * once it is {@link ACTIVATION_DISTANCE} px away. Guards against NaN by treating
 * a non-finite distance as fully inactive.
 */
function fadeInFor(centerDist: number): number {
  if (!Number.isFinite(centerDist)) {
    return 0;
  }
  return clamp(1 - centerDist / ACTIVATION_DISTANCE, 0, 1);
}

/**
 * Directional scale (stretch) toward the cursor.
 *
 * The cursor offset `(mouse - center)` is normalized to a unit direction
 * `(nx, ny)`. The stretch magnitude is
 * `min(centerDist / 300, 1) * elasticity * fadeIn`. The element grows along the
 * dominant axis and narrows along the other:
 *
 * ```text
 * scaleX = 1 + |nx| * stretch * 0.3 - |ny| * stretch * 0.15
 * scaleY = 1 + |ny| * stretch * 0.3 - |nx| * stretch * 0.15
 * ```
 *
 * Both factors are clamped to `>= 0.8`. When `elasticity` is `0` (or the cursor
 * is exactly on center) the result is the identity `{ scaleX: 1, scaleY: 1 }`.
 *
 * @param mouseX - Cursor X in the same coordinate space as `centerX`.
 * @param mouseY - Cursor Y in the same coordinate space as `centerY`.
 * @param centerX - Element center X.
 * @param centerY - Element center Y.
 * @param elasticity - Elastic strength; `0` disables motion entirely.
 */
export function calculateDirectionalScale(
  mouseX: number,
  mouseY: number,
  centerX: number,
  centerY: number,
  elasticity: number,
): DirectionalScale {
  // Hard guarantee: zero (or negative/NaN) elasticity ⇒ no motion.
  if (!(elasticity > 0)) {
    return { scaleX: 1, scaleY: 1 };
  }

  const dx = mouseX - centerX;
  const dy = mouseY - centerY;
  const centerDist = Math.hypot(dx, dy);

  // At the exact center there is no direction to stretch toward.
  if (centerDist === 0 || !Number.isFinite(centerDist)) {
    return { scaleX: 1, scaleY: 1 };
  }

  const fadeIn = fadeInFor(centerDist);
  if (fadeIn === 0) {
    return { scaleX: 1, scaleY: 1 };
  }

  // Normalized direction components.
  const nx = dx / centerDist;
  const ny = dy / centerDist;
  const absNx = Math.abs(nx);
  const absNy = Math.abs(ny);

  const stretch = Math.min(centerDist / STRETCH_SATURATION_DISTANCE, 1) * elasticity * fadeIn;

  const scaleX = clamp(
    1 + absNx * stretch * STRETCH_PRIMARY - absNy * stretch * STRETCH_SECONDARY,
    MIN_SCALE,
    Number.POSITIVE_INFINITY,
  );
  const scaleY = clamp(
    1 + absNy * stretch * STRETCH_PRIMARY - absNx * stretch * STRETCH_SECONDARY,
    MIN_SCALE,
    Number.POSITIVE_INFINITY,
  );

  return { scaleX, scaleY };
}

/**
 * Elastic positional nudge toward the cursor.
 *
 * Translates by `(mouse - center) * elasticity * 0.1 * fadeIn`, where `fadeIn`
 * is the same activation ramp used by {@link calculateDirectionalScale}. When
 * `elasticity` is `0` (or the cursor is on center / out of range) the result is
 * `{ x: 0, y: 0 }`.
 *
 * @param mouseX - Cursor X in the same coordinate space as `centerX`.
 * @param mouseY - Cursor Y in the same coordinate space as `centerY`.
 * @param centerX - Element center X.
 * @param centerY - Element center Y.
 * @param elasticity - Elastic strength; `0` disables motion entirely.
 */
export function calculateElasticTranslation(
  mouseX: number,
  mouseY: number,
  centerX: number,
  centerY: number,
  elasticity: number,
): ElasticTranslation {
  // Hard guarantee: zero (or negative/NaN) elasticity ⇒ no motion.
  if (!(elasticity > 0)) {
    return { x: 0, y: 0 };
  }

  const dx = mouseX - centerX;
  const dy = mouseY - centerY;
  const centerDist = Math.hypot(dx, dy);

  if (centerDist === 0 || !Number.isFinite(centerDist)) {
    return { x: 0, y: 0 };
  }

  const fadeIn = fadeInFor(centerDist);
  if (fadeIn === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx * elasticity * TRANSLATION_FACTOR * fadeIn,
    y: dy * elasticity * TRANSLATION_FACTOR * fadeIn,
  };
}
