import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GlassButton, type GlassButtonProps } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
function ButtonDemo(args: GlassButtonProps) {
  const [count, setCount] = useState(0);
  return (
    <>
      <GlassButton {...args} onClick={() => setCount((value) => value + 1)} />
      <output className="matui-glass-output" aria-live="polite">
        {count ? `Saved ${count} ${count === 1 ? 'time' : 'times'}` : 'Try the button'}
      </output>
    </>
  );
}
const meta: Meta<typeof GlassButton> = {
  title: 'Themes/Liquid Glass/Glass Button',
  component: GlassButton,
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
        code: `import { GlassButton } from "@aberhamm/liquid-glass-react"
import "@aberhamm/liquid-glass-react/styles.css"

export function SaveButton() {
  return <GlassButton variant="primary" size="md">Save changes</GlassButton>
}`,
      },
    },
  },
  args: { children: 'Save changes', variant: 'primary', size: 'md', disabled: false },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'subtle'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<typeof GlassButton>;
export const Default: Story = { render: (args) => <ButtonDemo {...args} /> };
export const Variants: Story = {
  render: () => (
    <>
      {(['primary', 'secondary', 'subtle'] as const).map((variant) => (
        <GlassButton key={variant} variant={variant}>
          {variant}
        </GlassButton>
      ))}
    </>
  ),
};
