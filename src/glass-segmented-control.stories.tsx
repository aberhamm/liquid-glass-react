import type { Meta, StoryObj } from '@storybook/react';
import { type ReactElement, useState } from 'react';
import { GlassSegmentedControl, type GlassSegmentedOption } from './glass-segmented-control';

/**
 * `<GlassSegmentedControl>` — the showcase liquid toggle. A native radiogroup
 * (`<fieldset>`/`<legend>` + visually-hidden radios) with a single
 * `<LiquidGlass>` indicator that slides behind the active option. Full
 * refraction in Chromium, graceful fallback elsewhere; the slide is a CSS
 * transform so it renders everywhere. Controlled/uncontrolled per the 007
 * convention; keyboard + screen-reader accessible for free via native radios.
 */
const THEME_OPTIONS: GlassSegmentedOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'dim', label: 'Dim' },
];

const meta = {
  title: 'Components/GlassSegmentedControl',
  component: GlassSegmentedControl,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A native radiogroup with a sliding liquid-glass indicator. The ' +
          'indicator measures the active option post-mount (handling unequal ' +
          'widths) and slides on selection, respecting prefers-reduced-motion. ' +
          "Import the stylesheet once: import '@aberhamm/liquid-glass-react/styles.css'.",
      },
    },
    // The demo stories below render fixed compositions, so their Controls panel
    // is inert. Disable it at the meta level and re-enable ONLY on Playground.
    controls: { disable: true },
  },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description: 'Sizing of the control.',
      table: { category: 'Appearance', defaultValue: { summary: "'md'" } },
    },
    value: { control: false, table: { category: 'State' } },
    defaultValue: { control: 'text', table: { category: 'State' } },
    showLabel: {
      control: 'boolean',
      description: 'Render the group label visibly instead of SR-only.',
      table: { category: 'Appearance', defaultValue: { summary: 'false' } },
    },
    label: { control: 'text', table: { category: 'Accessibility' } },
    options: { control: false, table: { category: 'Content' } },
    onValueChange: { control: false, action: 'valueChange', table: { category: 'Events' } },
    glassProps: { control: false, table: { category: 'Escape hatches' } },
  },
  args: {
    size: 'md',
    label: 'Theme',
    options: THEME_OPTIONS,
    defaultValue: 'light',
  },
} satisfies Meta<typeof GlassSegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Uncontrolled default driven by the controls panel. */
export const Playground: Story = {
  parameters: { controls: { disable: false } },
};

const columnStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'flex-start',
  gap: '1.75rem',
};

/** Every size, stacked. */
export const Sizes: Story = {
  render: () => (
    <div style={columnStyle}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <GlassSegmentedControl
          key={size}
          size={size}
          label={`Theme (${size})`}
          showLabel
          options={THEME_OPTIONS}
          defaultValue="dark"
        />
      ))}
    </div>
  ),
};

// Inline SVG glyphs (no icon dependency) for the theme-switcher example.
const SunIcon = (): ReactElement => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = (): ReactElement => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const DimIcon = (): ReactElement => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
  </svg>
);

const ICON_THEME_OPTIONS: GlassSegmentedOption[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'dim', label: 'Dim', icon: <DimIcon /> },
];

/**
 * A controlled theme switcher with per-option icons. Selecting an option slides
 * the glass indicator and reflects the choice below.
 */
export const ThemeSwitcher: Story = {
  render: () => {
    function Switcher(): ReactElement {
      const [theme, setTheme] = useState('dark');
      return (
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}
        >
          <GlassSegmentedControl
            size="lg"
            label="Appearance"
            options={ICON_THEME_OPTIONS}
            value={theme}
            onValueChange={setTheme}
          />
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
            Selected theme: {theme}
          </p>
        </div>
      );
    }
    return <Switcher />;
  },
};

/** Mixed widths: an icon-only option next to long labels exercises the
 * measured (not equal-segment) indicator positioning. */
export const UnequalWidths: Story = {
  render: () => (
    <GlassSegmentedControl
      label="View"
      defaultValue="grid"
      options={[
        { value: 'grid', label: 'Grid view' },
        { value: 'list', label: 'List' },
        { value: 'gallery', label: 'Gallery showcase' },
      ]}
    />
  ),
};
