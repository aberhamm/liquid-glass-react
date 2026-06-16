import type { Meta, StoryObj } from '@storybook/react';
import { GlassButton } from './glass-button';

const meta = {
  title: 'Components/GlassButton',
  component: GlassButton,
} satisfies Meta<typeof GlassButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Click me',
  },
};
