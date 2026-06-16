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
 */
const withBackdrop: Decorator = (Story): ReactElement => (
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
  },
};

export default preview;
