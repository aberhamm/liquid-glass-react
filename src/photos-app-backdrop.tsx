/**
 * Story-only Photos / gallery app backdrop.
 *
 * This module is NOT part of the published library (it is not re-exported from
 * `src/index.ts`). It exists purely so every Storybook story can float the glass
 * over a calm, realistic surface — an Apple-Photos-style header plus a responsive
 * grid of photo thumbnails — instead of a loud synthetic neon image.
 *
 * The thumbnails are pure-CSS scenic gradients (no downloaded photos), which:
 *   - are same-origin by definition (zero license/CORS risk),
 *   - are lightweight (no asset bytes), and
 *   - give sharp tile EDGES + real luminance variation so `<LiquidGlass>`
 *     refraction reads clearly and the DOM-background luminance sampler has
 *     light vs dark regions to react to.
 */
import type { CSSProperties, ReactElement } from 'react';

/**
 * Clean system sans-serif stack. Applied globally via the Storybook decorator
 * and explicitly on every story that builds its own full-bleed surface (those
 * opt out of the decorator with `noBackdrop`, so they don't inherit it). After
 * this, no story falls back to the browser default serif.
 */
export const SANS_FONT =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * A scenic "photo" tile: a tasteful multi-stop CSS gradient evoking a real scene.
 * Varied but harmonious — calm dawn/ocean/forest/sunset/dune/fog palettes, not
 * neon. Sharp tile edges + luminance range keep the refraction demonstrative.
 */
type PhotoTile = { label: string; background: string };

export const PHOTO_TILES: readonly PhotoTile[] = [
  {
    label: 'Dawn ridge',
    background: 'linear-gradient(160deg, #f6d9b0 0%, #e8a06a 45%, #9c5a6b 100%)',
  },
  {
    label: 'Coastline',
    background: 'linear-gradient(180deg, #bfe3ec 0%, #6db5c9 50%, #2f6f86 100%)',
  },
  {
    label: 'Pine valley',
    background: 'linear-gradient(165deg, #cfe3b0 0%, #6f9d5f 50%, #2f5d3f 100%)',
  },
  {
    label: 'Dune dusk',
    background: 'linear-gradient(155deg, #f4c98f 0%, #d98a5b 55%, #7a4a52 100%)',
  },
  {
    label: 'Harbor fog',
    background: 'linear-gradient(180deg, #e6ebf0 0%, #b7c3cf 55%, #7d8b9c 100%)',
  },
  {
    label: 'Lavender field',
    background: 'linear-gradient(150deg, #d8cde8 0%, #9d86c2 50%, #5d4b86 100%)',
  },
  {
    label: 'Citrus grove',
    background: 'linear-gradient(160deg, #f7e7a3 0%, #e3b15a 50%, #b06d3a 100%)',
  },
  {
    label: 'Tide pool',
    background: 'linear-gradient(170deg, #bdeadb 0%, #5fb6a6 50%, #2c6f74 100%)',
  },
  {
    label: 'Night terrace',
    background: 'linear-gradient(165deg, #5a6b97 0%, #34406b 55%, #1b2140 100%)',
  },
  {
    label: 'Clay canyon',
    background: 'linear-gradient(155deg, #ecc39c 0%, #cf8a63 50%, #8c4a44 100%)',
  },
  {
    label: 'Meadow haze',
    background: 'linear-gradient(175deg, #e8efc7 0%, #aac989 55%, #6c9163 100%)',
  },
  {
    label: 'Slate shore',
    background: 'linear-gradient(180deg, #c3ccd6 0%, #8492a3 55%, #49566a 100%)',
  },
];

/**
 * Cycle the scenic palette by index, returning a CSS `background` value. Safe
 * under `noUncheckedIndexedAccess` (always returns a string), so stories can map
 * over a list and assign a varied scenic fill per item without index guards.
 */
export function photoTileBackground(index: number): string {
  const tile =
    PHOTO_TILES[((index % PHOTO_TILES.length) + PHOTO_TILES.length) % PHOTO_TILES.length];
  return tile ? tile.background : 'linear-gradient(160deg, #cfe3b0 0%, #6f9d5f 100%)';
}

/**
 * Pinterest-ish staggered tile heights, cycled per index so the grid reads like
 * a real photo library rather than a uniform checkerboard.
 */
const TILE_HEIGHTS = [180, 240, 200, 280, 220, 260] as const;

function PhotoThumb({ tile, height }: { tile: PhotoTile; height: number }): ReactElement {
  return (
    <div
      aria-label={tile.label}
      style={{
        height,
        borderRadius: 18,
        background: tile.background,
        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    />
  );
}

const ACTION_STYLE: CSSProperties = {
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.06)',
  color: '#334155',
  fontSize: '1.05rem',
  lineHeight: 1,
  fontWeight: 600,
};

export type PhotosAppBackdropProps = {
  /** Extra content layered above the grid (e.g. the floating glass card). */
  children?: React.ReactNode;
  /** Number of tiles to render from the scenic set (defaults to all). */
  tileCount?: number;
  /** Override the root style (merged after defaults). */
  style?: CSSProperties;
};

/**
 * A calm Apple-Photos-style surface: a sticky-feeling header row ("Photos" title
 * + search / add / more affordances) above a responsive masonry-ish grid of
 * scenic gradient thumbnails. Static by design (no animation) so it stays
 * reduced-motion-safe and visually quiet behind the glass.
 */
export function PhotosAppBackdrop({
  children,
  tileCount,
  style,
}: PhotosAppBackdropProps): ReactElement {
  const tiles = PHOTO_TILES.slice(0, tileCount ?? PHOTO_TILES.length);
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        // A soft, neutral app chrome — light, harmonious, not neon.
        background: 'linear-gradient(180deg, #fbfcfe 0%, #eef1f6 100%)',
        color: '#0f172a',
        fontFamily: SANS_FONT,
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.5rem clamp(1.25rem, 4vw, 3rem) 1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Photos
          </h1>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>1,248 items</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.06)',
              color: '#64748b',
              fontSize: '0.85rem',
              minWidth: 0,
            }}
          >
            <span aria-hidden>⌕</span>
            <span style={{ whiteSpace: 'nowrap' }}>Search</span>
          </div>
          <div style={ACTION_STYLE} aria-label="Add">
            +
          </div>
          <div style={ACTION_STYLE} aria-label="More">
            ⋯
          </div>
        </div>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '0 clamp(1.25rem, 4vw, 3rem)',
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#94a3b8',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <span
          style={{
            color: '#0f172a',
            paddingBottom: '0.75rem',
            boxShadow: 'inset 0 -2px 0 #0f172a',
          }}
        >
          Library
        </span>
        <span style={{ paddingBottom: '0.75rem' }}>Albums</span>
        <span style={{ paddingBottom: '0.75rem' }}>Shared</span>
      </nav>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1rem',
          padding: 'clamp(1.25rem, 4vw, 3rem)',
        }}
      >
        {tiles.map((tile, i) => (
          <PhotoThumb
            key={tile.label}
            tile={tile}
            height={TILE_HEIGHTS[i % TILE_HEIGHTS.length] ?? 220}
          />
        ))}
      </div>

      {children}
    </div>
  );
}
