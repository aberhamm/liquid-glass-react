import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
const meta: Meta<typeof GlassCard> = {
  title: 'Themes/Liquid Glass/Glass Card',
  component: GlassCard,
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
        code: `import { GlassCard } from "@aberhamm/liquid-glass-react"
import "@aberhamm/liquid-glass-react/styles.css"

export function Summary() {
  return (
    <GlassCard elevation="floating">
      <div><h2>A clearer view.</h2><p>A floating panel for your next idea.</p></div>
    </GlassCard>
  )
}`,
      },
    },
  },
  args: {
    elevation: 'floating',
    children: (
      <div className="matui-glass-card-content">
        <small>Space to focus</small>
        <h2>A clearer view.</h2>
        <p>A floating panel for a summary, a profile, or your next idea.</p>
      </div>
    ),
  },
  argTypes: { elevation: { control: 'select', options: ['flat', 'raised', 'floating'] } },
};
export default meta;
type Story = StoryObj<typeof GlassCard>;
export const Default: Story = {};
