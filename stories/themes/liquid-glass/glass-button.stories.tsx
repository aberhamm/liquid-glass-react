import type { Meta, StoryObj } from '@storybook/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { GlassButton, type GlassButtonProps } from '../../../src';
import { GlassStage, glassDocs } from './glass-stage';
// The same decorative backdrop is supplied to the lens for Safari/Firefox.
// Keep its coordinates aligned to the visible panel, as in the notification recipe.
const pattern =
  'repeating-linear-gradient(115deg, #285b58 0 12px, #eecb89 12px 24px, #e89472 24px 36px)';
function ButtonDemo({
  liveBackdrop = false,
  ...args
}: GlassButtonProps & { liveBackdrop?: boolean }) {
  const [count, setCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!panel || !button) return;
    const measure = () => {
      const p = panel.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      setBox({ x: b.left - p.left, y: b.top - p.top, width: p.width, height: p.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(button);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <>
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          width: 'min(640px, calc(100vw - 80px))',
          height: 240,
          borderRadius: 28,
          background: pattern,
        }}
      >
        <GlassButton
          {...args}
          ref={buttonRef}
          glassProps={{
            ...args.glassProps,
            ...(!liveBackdrop && box.width > 0
              ? {
                  refract: (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: -box.x,
                        top: -box.y,
                        width: box.width,
                        height: box.height,
                        background: pattern,
                      }}
                    />
                  ),
                  behind: '#eecb89',
                }
              : {}),
          }}
          onClick={() => setCount((value) => value + 1)}
        />
      </div>
      <output className="matui-glass-output" aria-live="polite">
        {count ? `Saved ${count} ${count === 1 ? 'time' : 'times'}` : 'Try the button'}
      </output>
      <p style={{ flexBasis: '100%', textAlign: 'center', margin: 0, maxWidth: 640, fontSize: 13 }}>
        {liveBackdrop
          ? 'Live page backdrop: bending in Chromium; frosted fallback in Safari and Firefox.'
          : 'A matched decorative backdrop copy makes the bend visible across Chromium, Safari and Firefox.'}
      </p>
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
export const LiveBackdrop: Story = { render: (args) => <ButtonDemo {...args} liveBackdrop /> };
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
