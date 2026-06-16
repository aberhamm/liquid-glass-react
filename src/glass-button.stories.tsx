import type { Meta, StoryObj } from '@storybook/react';
import type { ReactElement } from 'react';
import { GlassButton } from './glass-button';

/**
 * `<GlassButton>` — a batteries-included button on top of `<LiquidGlass>`. It
 * renders a real semantic `<button>` by default, or clones a child element via
 * `asChild` (e.g. an `<a>` for a link). The stories cover the variant × size
 * matrix, the shine-on-press, the `glassProps` escape hatch and `asChild`.
 */
const meta = {
  title: 'Components/GlassButton',
  component: GlassButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Variant/size resolve to tuned LiquidGlass props plus class names from ' +
          'components.css. Import the stylesheet once in your app: ' +
          "import '@aberhamm/liquid-glass-react/styles.css'.",
      },
    },
  },
  argTypes: {
    children: { control: 'text', table: { category: 'Content' } },
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'subtle'],
      description: 'Visual emphasis.',
      table: { category: 'Appearance', defaultValue: { summary: "'primary'" } },
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg', 'icon'],
      description: 'Sizing; `icon` is square and centers a single icon child.',
      table: { category: 'Appearance', defaultValue: { summary: "'md'" } },
    },
    shine: {
      control: 'boolean',
      description: 'Brief highlight sweep on press.',
      table: { category: 'Appearance', defaultValue: { summary: 'true' } },
    },
    asChild: {
      control: 'boolean',
      description:
        'Render the single child element instead of a <button>, merging props/' +
        'className/ref onto it. The child then owns its semantics and a11y.',
      table: { category: 'Behavior', defaultValue: { summary: 'false' } },
    },
    disabled: { control: 'boolean', table: { category: 'Behavior' } },
    contentClassName: { control: false, table: { category: 'Escape hatches' } },
    glassProps: { control: false, table: { category: 'Escape hatches' } },
    onClick: { control: false, action: 'click', table: { category: 'Events' } },
  },
  args: {
    variant: 'primary',
    size: 'md',
    shine: true,
    children: 'Get started',
  },
} satisfies Meta<typeof GlassButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Single button driven by the controls panel. */
export const Playground: Story = {};

const VARIANTS = ['primary', 'secondary', 'subtle'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1.25rem',
  flexWrap: 'wrap' as const,
};

/** Every variant across every (non-icon) size. */
export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {VARIANTS.map((variant) => (
        <div key={variant} style={rowStyle}>
          {SIZES.map((size) => (
            <GlassButton key={size} variant={variant} size={size}>
              {`${variant} / ${size}`}
            </GlassButton>
          ))}
        </div>
      ))}
    </div>
  ),
};

// A single inline glyph stands in for an icon component (keeps the story free of
// an icon dependency while still exercising `size="icon"` centering).
const PlusGlyph = (): ReactElement => (
  <span aria-hidden="true" style={{ fontSize: '1.25rem', lineHeight: 1, display: 'block' }}>
    +
  </span>
);

/** `size="icon"` is square and centers a single icon glyph. */
export const IconButtons: Story = {
  render: () => (
    <div style={rowStyle}>
      {VARIANTS.map((variant) => (
        <GlassButton key={variant} variant={variant} size="icon" aria-label={`${variant} action`}>
          <PlusGlyph />
        </GlassButton>
      ))}
    </div>
  ),
};

/** Press and hold to see the shine sweep; the second button disables it. */
export const ShineOnPress: Story = {
  render: () => (
    <div style={rowStyle}>
      <GlassButton shine>Press me (shine on)</GlassButton>
      <GlassButton shine={false}>Press me (shine off)</GlassButton>
    </div>
  ),
};

/**
 * `asChild` clones the child instead of rendering a `<button>`. Here a real
 * `<a href>` receives the glass styling and owns its own link semantics.
 */
export const AsChildLink: Story = {
  render: () => (
    <GlassButton asChild variant="secondary">
      <a href="#showcase" style={{ textDecoration: 'none' }}>
        Read the docs
      </a>
    </GlassButton>
  ),
};

/**
 * The `glassProps` escape hatch passes overrides straight through to the
 * underlying `<LiquidGlass>` — here a much higher displacement and saturation
 * than the variant default.
 */
export const GlassPropsEscapeHatch: Story = {
  render: () => (
    <div style={rowStyle}>
      <GlassButton>Default tuning</GlassButton>
      <GlassButton glassProps={{ displacementScale: 140, saturation: 220, mode: 'turbulence' }}>
        Custom glass
      </GlassButton>
    </div>
  ),
};
