import type { Meta, StoryObj } from '@storybook/react';
import { LiquidGlass } from './liquid-glass';

const meta = {
  title: 'Components/LiquidGlass',
  component: LiquidGlass,
} satisfies Meta<typeof LiquidGlass>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    cornerRadius: 24,
    padding: '24px 32px',
    children: (
      <span style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>Liquid Glass</span>
    ),
  },
};
