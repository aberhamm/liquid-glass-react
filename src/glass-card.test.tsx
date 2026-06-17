import { render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

import { GlassCard } from './glass-card';
import type { GlassCapabilities } from './types';

function caps(canRefract: boolean, supportsBackdropFilter = canRefract): GlassCapabilities {
  return {
    supportsBackdropFilter,
    isChromium: canRefract,
    supportsSvgBackdropDisplacement: canRefract,
    isFirefox: false,
    prefersReducedMotion: false,
    prefersReducedTransparency: false,
    prefersContrastMore: false,
    canRefract,
  };
}

function stubLayout(width = 320, height = 200): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function installMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  mockCapabilities.mockReturnValue(caps(true));
  stubLayout();
  installMatchMedia();
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  if ('ontouchstart' in window) {
    // biome-ignore lint/performance/noDelete: test cleanup must truly remove the key
    delete (window as unknown as Record<string, unknown>).ontouchstart;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('<GlassCard>', () => {
  it('renders a <div> by default holding the children', () => {
    const { getByText } = render(<GlassCard>Card body</GlassCard>);
    const body = getByText('Card body');
    expect(body.tagName).toBe('DIV');
    expect(body).toHaveClass('lg-content');
    // The shell wrapping the content is also a div with the card class.
    const shell = body.closest('.lg-card');
    expect(shell).not.toBeNull();
    expect(shell?.tagName).toBe('DIV');
  });

  it('renders the child element via asChild', () => {
    const { getByRole } = render(
      <GlassCard asChild>
        <section aria-label="panel">Panel</section>
      </GlassCard>,
    );
    const section = getByRole('region', { name: 'panel' });
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveClass('lg-card');
  });

  it('applies className, style, and elevation', () => {
    const { container } = render(
      <GlassCard className="custom" style={{ color: 'tomato' }} elevation="floating">
        Body
      </GlassCard>,
    );
    const shell = container.querySelector('.lg-card') as HTMLElement;
    expect(shell).toHaveClass('custom');
    expect(shell).toHaveClass('lg-card--floating');
    expect(shell.getAttribute('data-elevation')).toBe('floating');
    expect(shell.style.color).toBe('tomato');
  });

  it('defaults to elevation=raised', () => {
    const { container } = render(<GlassCard>Body</GlassCard>);
    const shell = container.querySelector('.lg-card') as HTMLElement;
    expect(shell).toHaveClass('lg-card--raised');
  });

  it('forwards ref to the underlying div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<GlassCard ref={ref}>Body</GlassCard>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current).toHaveClass('lg-card');
  });

  it('renders with no console.error under full and fallback caps', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      const { unmount } = render(<GlassCard elevation="raised">Body</GlassCard>);
      unmount();
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
