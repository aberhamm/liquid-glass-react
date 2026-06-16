import type { Decorator, Preview } from '@storybook/react';
import type { ReactElement } from 'react';

// Load the prebuilt component stylesheet so GlassButton / GlassCard variant
// classes resolve in every story (the source modules import this too, but the
// global import guarantees styles are present regardless of which story loads).
import '../src/components.css';

/**
 * Backdrop decorator: the liquid-glass effect (refraction, frost, rim light) is
 * only visible against a busy, colorful background. Every story is wrapped in a
 * full-viewport gradient so the glass has something to refract.
 *
 * Stories that supply their OWN full-bleed backdrop (the Showcase and
 * CrossBrowser stories) set `parameters.noBackdrop: true` to opt out and avoid a
 * doubled background.
 */
const withBackdrop: Decorator = (Story, context): ReactElement => {
  if (context.parameters.noBackdrop) {
    return <Story />;
  }
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
        background: 'linear-gradient(135deg, #ff6b6b 0%, #f7b733 25%, #4ecdc4 55%, #556270 100%)',
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
