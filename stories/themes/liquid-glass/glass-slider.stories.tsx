import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GlassSlider, type GlassSliderProps } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
function SliderDemo(args: GlassSliderProps) {
  const [value, setValue] = useState(50);
  return (
    <>
      <GlassSlider {...args} value={value} onValueChange={setValue} />
      <output className="matui-glass-output">Volume {value}%</output>
    </>
  );
}
const meta = {
  title: 'Themes/Liquid Glass/Glass Slider',
  component: GlassSlider,
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
      description: {
        component: `${glassDocs} Native range input with arrow keys, Home and End. Drag the handle to reveal its lens. Supports value/onValueChange or defaultValue and native form submission.`,
      },
      source: {
        code: `import { GlassSlider } from "@aberhamm/liquid-glass-react"
import "@aberhamm/liquid-glass-react/styles.css"

<GlassSlider ariaLabel="Volume" defaultValue={50} />`,
      },
    },
  },
  args: {
    ariaLabel: 'Volume',
    width: 220,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    forceExpanded: false,
    scheme: 'light',
  },
  argTypes: {
    scheme: { control: 'select', options: ['light', 'dark'] },
    value: { table: { disable: true } },
  },
} satisfies Meta<typeof GlassSlider>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: (args) => <SliderDemo {...args} /> };
export const Expanded: Story = { ...Default, args: { forceExpanded: true } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
