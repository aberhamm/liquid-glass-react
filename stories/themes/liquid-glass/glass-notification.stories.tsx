import type { Meta, StoryObj } from '@storybook/react';
import { GlassNotification } from '../../../src';
import { glassDocs } from './glass-stage';
const meta = {
  title: 'Themes/Liquid Glass/Glass Notification',
  component: GlassNotification,
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: 400 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `${glassDocs} A presentational notification preview, not a notification delivery system. It fills its container: give the parent an explicit height. Wallpaper is a CSS background, copied and aligned behind the lens.`,
      },
      source: {
        code: `import { GlassNotification } from "@aberhamm/liquid-glass-react"

<div style={{ height: 400 }}>
  <GlassNotification title="Matthew" body="The glass collection is ready." avatar="MA" />
</div>`,
      },
    },
  },
  args: { title: 'Matthew', time: 'now', body: 'The glass collection is ready.', avatar: 'MA' },
} satisfies Meta<typeof GlassNotification>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
