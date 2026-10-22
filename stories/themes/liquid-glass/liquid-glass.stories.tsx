import type { Meta, StoryObj } from '@storybook/react';
import { LiquidGlass } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
const meta: Meta<typeof LiquidGlass> = {
  title: 'Themes/Liquid Glass/Liquid Glass',
  component: LiquidGlass,
  decorators: [
    (Story) => (
      <GlassStage>
        <Story />
      </GlassStage>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: glassDocs },
      source: {
        code: `import { LiquidGlass } from "@aberhamm/liquid-glass-react"

export function GlassSurface() {
  return (
    <LiquidGlass style={{ borderRadius: 28, padding: "28px 36px" }}>
      A surface with a little depth.
    </LiquidGlass>
  )
}`,
      },
    },
  },
  args: {
    style: { borderRadius: 28, padding: '28px 36px', background: '#ffffff33' },
    children: 'A surface with a little depth.',
    optics: { frost: 3 },
  },
  argTypes: { children: { control: 'text' }, optics: { control: 'object' } },
};
export default meta;
type Story = StoryObj<typeof LiquidGlass>;
export const Default: Story = {};
export const Refraction: Story = {
  args: { optics: { frost: 0, strength: 0.2, dispersion: 0.6 } },
  parameters: {
    docs: {
      description: {
        story: 'Live backdrop refraction in Chromium; frosted glass fallback elsewhere.',
      },
    },
  },
};
