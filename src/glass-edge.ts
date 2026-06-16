/**
 * Pure-CSS beveled glass edge (plan 005).
 *
 * A layered `box-shadow` stack of `inset` highlights + a soft inset shadow that
 * fakes a refractive bevel rim with NO SVG and NO blend-mode dependency — it
 * renders identically in every browser. This is the DRY single source of truth
 * for the bevel: the unsupported-browser fallback (006), the prebuilt-component
 * stylesheet (007), and the segmented control (012) all import these exact
 * strings rather than hardcoding their own. Pure strings, no React.
 *
 * Two variants are provided. The light variant lights the top-left rim (the
 * convention for an overhead light source) with bright translucent white insets;
 * the dark variant flips the highlight toward a cooler, dimmer treatment and
 * leans on a darker inset for the lower-right shadow so the bevel reads on dark
 * backgrounds.
 *
 * NOTE: this is the RIM bevel only. The outer drop-shadow / glow is a separate
 * decoupled sibling layer (it must not live on the clipped glass node), so it is
 * intentionally not part of these strings.
 */

/**
 * Light-mode bevel: bright top-left inset highlight, softer bottom-right inset
 * shade, plus a thin hairline ring for crispness. Tuned for glass over light or
 * mid-tone backgrounds.
 */
export const GLASS_EDGE_LIGHT = [
  'inset 0 1px 1px 0 rgba(255, 255, 255, 0.75)',
  'inset 1px 0 1px 0 rgba(255, 255, 255, 0.4)',
  'inset 0 -1px 2px 0 rgba(0, 0, 0, 0.18)',
  'inset -1px 0 2px 0 rgba(0, 0, 0, 0.12)',
  'inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
].join(', ');

/**
 * Dark-mode bevel: the highlight direction is flipped to a cooler, dimmer
 * top-left sheen and the lower-right inset shade is deepened so the rim still
 * reads against dark backdrops without blowing out.
 */
export const GLASS_EDGE_DARK = [
  'inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)',
  'inset 1px 0 1px 0 rgba(255, 255, 255, 0.18)',
  'inset 0 -1px 2px 0 rgba(0, 0, 0, 0.55)',
  'inset -1px 0 2px 0 rgba(0, 0, 0, 0.45)',
  'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
].join(', ');

/** Colour scheme selector for {@link getGlassEdgeShadow}. */
export type GlassEdgeScheme = 'light' | 'dark';

/**
 * Return the layered inset `box-shadow` string for the requested colour scheme.
 *
 * @param scheme - `'light'` or `'dark'`.
 * @returns The comma-joined `box-shadow` value (see {@link GLASS_EDGE_LIGHT} /
 * {@link GLASS_EDGE_DARK}).
 */
export function getGlassEdgeShadow(scheme: GlassEdgeScheme): string {
  return scheme === 'dark' ? GLASS_EDGE_DARK : GLASS_EDGE_LIGHT;
}
