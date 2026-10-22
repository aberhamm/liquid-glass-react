import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlassButton, GlassSegmentedControl, GlassSlider, GlassSwitch } from './index';

// Exercise control semantics without asking jsdom to rasterize SVG/canvas filters.
vi.mock('@samasante/liquid-glass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@samasante/liquid-glass')>();
  return {
    ...actual,
    Glass: ({ children }: { children?: import('react').ReactNode }) => <div>{children}</div>,
  };
});
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('glass control contracts', () => {
  it('keeps the button native and avoids accidental form submission', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const click = vi.fn();
    render(
      <form onSubmit={submit}>
        <GlassButton onClick={click}>Save</GlassButton>
        <GlassButton disabled onClick={click}>
          Unavailable
        </GlassButton>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('supports an uncontrolled switch, keyboard toggling and native form values in StrictMode', async () => {
    render(
      <StrictMode>
        <form aria-label="Preferences">
          <GlassSwitch ariaLabel="Notifications" name="notifications" value="yes" defaultChecked />
        </form>
      </StrictMode>,
    );
    const control = screen.getByRole('switch', { name: 'Notifications' });
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('notifications')).toBe(
      'yes',
    );
    control.focus();
    await userEvent.keyboard(' ');
    expect(control).not.toBeChecked();
    await userEvent.keyboard(' ');
    expect(control).toBeChecked();
  });

  it('keeps switch state controlled by its caller', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <GlassSwitch ariaLabel="Notifications" checked={false} onCheckedChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch')).not.toBeChecked();
    rerender(<GlassSwitch ariaLabel="Notifications" checked onCheckedChange={onChange} />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('submits the slider value and accepts controlled updates', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <form aria-label="Preferences">
        <GlassSlider ariaLabel="Volume" name="volume" value={40} onValueChange={onChange} />
      </form>,
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledWith(65);
    expect(screen.getByRole('slider')).toHaveValue('40');
    rerender(
      <form aria-label="Preferences">
        <GlassSlider ariaLabel="Volume" name="volume" value={65} onValueChange={onChange} />
      </form>,
    );
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('volume')).toBe('65');
  });

  it('uses named native radio groups with defaults, form values and disabled options', async () => {
    render(
      <form aria-label="Range">
        <GlassSegmentedControl
          label="Time range"
          name="range"
          defaultValue="week"
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month', disabled: true },
          ]}
        />
      </form>,
    );
    expect(screen.getByRole('group', { name: 'Time range' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('range')).toBe('day');
  });
});
