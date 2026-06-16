import type { Meta, StoryObj } from '@storybook/react';
import type { ReactElement, ReactNode } from 'react';
import { GlassButton } from './glass-button';
import { GlassCard } from './glass-card';

/**
 * `<GlassCard>` — a batteries-included container on top of `<LiquidGlass>`. It
 * renders a `<div>` by default (or clones a child via `asChild`) with sensible
 * padding/cornerRadius and an `elevation` knob. The stories below cover the
 * elevation variants, realistic content, the `glassProps` escape hatch and
 * `asChild`.
 */
const meta = {
  title: 'Components/GlassCard',
  component: GlassCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A frosted container surface. Import the stylesheet once in your app: ' +
          "import '@aberhamm/liquid-glass-react/styles.css'.",
      },
    },
  },
  argTypes: {
    children: { control: false, table: { category: 'Content' } },
    elevation: {
      control: 'inline-radio',
      options: ['flat', 'raised', 'floating'],
      description: 'Ambient lift (drop shadow) under the card.',
      table: { category: 'Appearance', defaultValue: { summary: "'raised'" } },
    },
    asChild: {
      control: 'boolean',
      description:
        'Render the single child element instead of a <div>, merging props/' +
        'className/ref onto it. The child then owns its semantics.',
      table: { category: 'Behavior', defaultValue: { summary: 'false' } },
    },
    contentClassName: { control: false, table: { category: 'Escape hatches' } },
    glassProps: { control: false, table: { category: 'Escape hatches' } },
  },
  args: {
    elevation: 'raised',
  },
} satisfies Meta<typeof GlassCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const cardBody = (title: string, body: string): ReactNode => (
  <div style={{ color: '#fff', maxWidth: '20rem' }}>
    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>{title}</h3>
    <p style={{ margin: 0, opacity: 0.88, lineHeight: 1.5 }}>{body}</p>
  </div>
);

/** Single card driven by the controls panel. */
export const Playground: Story = {
  args: {
    children: cardBody(
      'Glass Card',
      'A frosted surface that refracts the backdrop behind it. Change the elevation control to lift it off the page.',
    ),
  },
};

/** The three elevation levels side by side. */
export const Elevations: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {(['flat', 'raised', 'floating'] as const).map((elevation) => (
        <GlassCard key={elevation} elevation={elevation}>
          {cardBody(
            `${elevation.charAt(0).toUpperCase()}${elevation.slice(1)}`,
            elevation === 'flat'
              ? 'No drop shadow — sits flush with the surface.'
              : elevation === 'raised'
                ? 'A soft ambient shadow lifts the card off the page.'
                : 'A deep shadow floats the card well above the backdrop.',
          )}
        </GlassCard>
      ))}
    </div>
  ),
};

/** A richer card combining heading, copy and an action — a realistic panel. */
export const WithContent: Story = {
  render: () => (
    <GlassCard elevation="floating">
      <div style={{ color: '#fff', maxWidth: '22rem', display: 'grid', gap: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.75,
          }}
        >
          Pro plan
        </span>
        <h3 style={{ margin: 0, fontSize: '1.375rem' }}>Everything, unlocked</h3>
        <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.55 }}>
          Unlimited surfaces, priority rendering and the full refraction pipeline on supported
          browsers.
        </p>
        <div style={{ marginTop: '0.5rem' }}>
          <GlassButton size="sm">Upgrade</GlassButton>
        </div>
      </div>
    </GlassCard>
  ),
};

/**
 * `asChild` clones the child instead of rendering a `<div>`. Here a real
 * `<a href>` becomes a fully clickable glass card with its own link semantics.
 */
export const AsChildLink: Story = {
  render: () => (
    <GlassCard asChild>
      <a href="#showcase" style={{ textDecoration: 'none', display: 'block' }}>
        {cardBody(
          'Clickable card',
          'The whole surface is a single anchor — keyboard-focusable and announced as a link.',
        )}
      </a>
    </GlassCard>
  ),
};

/**
 * The `glassProps` escape hatch passes overrides straight through to the
 * underlying `<LiquidGlass>` (sharper corners, heavier displacement here).
 */
export const GlassPropsEscapeHatch: Story = {
  render: (): ReactElement => (
    <GlassCard glassProps={{ cornerRadius: 8, displacementScale: 110, mode: 'prominent' }}>
      {cardBody('Custom glass', 'Square-ish corners and a heavier "thick glass" displacement.')}
    </GlassCard>
  ),
};
