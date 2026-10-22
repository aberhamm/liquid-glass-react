import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GlassSegmentedControl, type GlassSegmentedControlProps } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
function SegmentedDemo(args: GlassSegmentedControlProps) {
  const [value, setValue] = useState('week');
  return (
    <>
      <GlassSegmentedControl {...args} value={value} onValueChange={setValue} />
      <output className="matui-glass-output" aria-live="polite">
        Showing this {value}
      </output>
    </>
  );
}
const meta: Meta<typeof GlassSegmentedControl> = {
  title: 'Themes/Liquid Glass/Glass Segmented Control',
  component: GlassSegmentedControl,
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
        code: `import { useState } from "react"
import { GlassSegmentedControl } from "@aberhamm/liquid-glass-react"
import "@aberhamm/liquid-glass-react/styles.css"

export function TimeRange() {
  const [value, setValue] = useState("week")
  return (
    <GlassSegmentedControl
      label="Time range"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ]}
    />
  )
}`,
      },
    },
  },
  args: {
    label: 'Time range',
    options: [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof GlassSegmentedControl>;
export const Default: Story = { render: (args) => <SegmentedDemo {...args} /> };
