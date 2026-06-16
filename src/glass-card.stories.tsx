import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard } from './glass-card';

const meta = {
  title: 'Components/GlassCard',
  component: GlassCard,
} satisfies Meta<typeof GlassCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div style={{ color: '#fff', maxWidth: '20rem' }}>
        <h3 style={{ margin: '0 0 0.5rem' }}>Glass Card</h3>
        <p style={{ margin: 0, opacity: 0.85 }}>
          A frosted surface that refracts the backdrop behind it.
        </p>
      </div>
    ),
  },
};
