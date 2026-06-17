import type { Decorator, Preview } from '@storybook/react';
import type { ReactElement } from 'react';

// Load the prebuilt component stylesheet so GlassButton / GlassCard variant
// classes resolve in every story (the source modules import this too, but the
// global import guarantees styles are present regardless of which story loads).
import '../src/components.css';

/**
 * Same-origin demo backdrop served by Storybook from `public/demo/` (wired via
 * `staticDirs` in `.storybook/main.ts`). It is a rich, self-authored synthetic
 * image (CC0 — see `public/demo/LICENSE.md`) with high-frequency color, sharp
 * edges and varied regions so `<LiquidGlass>` refraction edge-bending is
 * obvious. Same-origin means a later plan can sample it via canvas without
 * cross-origin taint.
 */
export const DEMO_BACKDROP_URL = './demo/showcase-backdrop.webp';

/**
 * Backdrop decorator: the liquid-glass effect (refraction, frost, rim light) is
 * only visible against a busy, colorful background. Every story is wrapped in a
 * full-viewport REAL PHOTO so the glass has rich content to refract — the flat
 * CSS gradient hid the headline feature.
 *
 * Parameterizable via `parameters.backdrop`:
 *   - `noBackdrop: true`  — opt out entirely (stories that supply their own
 *     full-bleed surface: Showcase, CrossBrowser, ScrollUnderGlass, CheapVsReal).
 *   - `backdrop: false`   — opt out (alias).
 *   - `backdrop: 'gradient'` — keep the legacy flat gradient instead of the photo.
 *   - default                — the same-origin demo photo.
 *
 * The decorator adds NO animation, so it is inherently reduced-motion-safe; any
 * motion lives in individual stories behind `prefers-reduced-motion`.
 */
const withBackdrop: Decorator = (Story, context): ReactElement => {
  const { noBackdrop, backdrop } = context.parameters;
  if (noBackdrop || backdrop === false) {
    return <Story />;
  }

  const usePhoto = backdrop !== 'gradient';
  const background = usePhoto
    ? `center / cover no-repeat url("${DEMO_BACKDROP_URL}")`
    : 'linear-gradient(135deg, #ff6b6b 0%, #f7b733 25%, #4ecdc4 55%, #556270 100%)';

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
        background,
      }}
    >
      <Story />
    </div>
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
