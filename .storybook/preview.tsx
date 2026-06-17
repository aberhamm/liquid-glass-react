import type { Decorator, Preview } from '@storybook/react';
import type { ReactElement } from 'react';

// Load the prebuilt component stylesheet so GlassButton / GlassCard variant
// classes resolve in every story (the source modules import this too, but the
// global import guarantees styles are present regardless of which story loads).
import '../src/components.css';
import { PhotosAppBackdrop, SANS_FONT } from '../src/photos-app-backdrop';

/**
 * Backdrop decorator: the liquid-glass effect (refraction, frost, rim light) is
 * only visible against real, varied content. Stories that don't supply their own
 * full-bleed surface are wrapped in a calm, realistic Photos / gallery app
 * (header + responsive grid of scenic gradient thumbnails) so the glass floats
 * over normal app content — not a loud synthetic image.
 *
 * It also sets the clean system sans-serif globally, so every story that DOES
 * inherit from the decorator renders in sans (never the browser default serif).
 * Stories that opt out with `noBackdrop` carry the font explicitly themselves.
 *
 * Parameterizable via `parameters`:
 *   - `noBackdrop: true`  — opt out entirely (stories that supply their own
 *     full-bleed surface: Showcase, Modes, Draggable, ScrollUnderGlass, etc.).
 *   - `backdrop: false`   — opt out (alias).
 *   - `backdrop: 'plain'` — a calm neutral surface (no photos grid) for stories
 *     that just need a quiet, legible canvas (e.g. CrossBrowser, Playground).
 *   - default                — the Photos-app grid behind a centered story.
 *
 * The decorator adds NO animation, so it is inherently reduced-motion-safe.
 */
const withBackdrop: Decorator = (Story, context): ReactElement => {
  const { noBackdrop, backdrop } = context.parameters;
  if (noBackdrop || backdrop === false) {
    return <Story />;
  }

  if (backdrop === 'plain') {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem',
          boxSizing: 'border-box',
          fontFamily: SANS_FONT,
          background: 'linear-gradient(180deg, #fbfcfe 0%, #eef1f6 100%)',
        }}
      >
        <Story />
      </div>
    );
  }

  return (
    <PhotosAppBackdrop>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <Story />
        </div>
      </div>
    </PhotosAppBackdrop>
  );
};

const preview: Preview = {
  decorators: [withBackdrop],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Surface common breakpoints so reviewers can sanity-check the showcase at
    // mobile/tablet/desktop widths (addon-essentials bundles the viewport addon).
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' } },
        tablet: { name: 'Tablet', styles: { width: '834px', height: '1112px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
};

export default preview;
