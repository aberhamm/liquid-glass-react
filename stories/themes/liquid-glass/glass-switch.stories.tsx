import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GlassSwitch, type GlassSwitchProps } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
function SwitchDemo(args: GlassSwitchProps) {
  const [checked, setChecked] = useState(true);
  return (
    <>
      <GlassSwitch {...args} checked={checked} onCheckedChange={setChecked} />
      <output className="matui-glass-output">Notifications {checked ? 'on' : 'off'}</output>
    </>
  );
}
const meta = {
  title: 'Themes/Liquid Glass/Glass Switch',
  component: GlassSwitch,
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
        component: `${glassDocs} Hold or drag the thumb to reveal the refracting lens. Supports checked/onCheckedChange or defaultChecked, plus native name/value form submission.`,
      },
      source: {
        code: `import { GlassSwitch } from "@aberhamm/liquid-glass-react"
import "@aberhamm/liquid-glass-react/styles.css"

<GlassSwitch ariaLabel="Notifications" defaultChecked />`,
      },
    },
  },
  args: { ariaLabel: 'Notifications', disabled: false, forceExpanded: false, scheme: 'light' },
  argTypes: {
    scheme: { control: 'select', options: ['light', 'dark'] },
    checked: { table: { disable: true } },
  },
} satisfies Meta<typeof GlassSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: (args) => <SwitchDemo {...args} /> };
export const Expanded: Story = { ...Default, args: { forceExpanded: true } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
