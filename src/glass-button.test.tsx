import { fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the capability hook so tests control `canRefract` deterministically,
// mirroring liquid-glass.test.tsx (plans 004/006).
const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

import { GlassButton } from './glass-button';
import type { GlassCapabilities } from './types';

function caps(canRefract: boolean, supportsBackdropFilter = canRefract): GlassCapabilities {
  return {
    supportsBackdropFilter,
    isChromium: canRefract,
    supportsSvgBackdropDisplacement: canRefract,
    isFirefox: false,
    prefersReducedMotion: false,
    canRefract,
  };
}

function stubLayout(width = 160, height = 44): void {
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

describe('<GlassButton> semantics', () => {
  it('renders a real <button> by default', () => {
    const { getByRole } = render(<GlassButton>Subscribe</GlassButton>);
    const btn = getByRole('button', { name: 'Subscribe' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<GlassButton onClick={onClick}>Go</GlassButton>);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks click when disabled (onClick NOT called)', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <GlassButton disabled onClick={onClick}>
        Nope
      </GlassButton>,
    );
    const btn = getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards type and aria-* attributes', () => {
    const { getByRole } = render(
      <GlassButton type="submit" aria-label="Submit form" aria-pressed="true">
        S
      </GlassButton>,
    );
    const btn = getByRole('button');
    expect(btn.getAttribute('type')).toBe('submit');
    expect(btn.getAttribute('aria-label')).toBe('Submit form');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('forwards ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<GlassButton ref={ref}>Ref</GlassButton>);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});

describe('<GlassButton> variant/size mapping', () => {
  it('maps variant and size props to class names', () => {
    const { getByRole } = render(
      <GlassButton variant="subtle" size="lg">
        X
      </GlassButton>,
    );
    const btn = getByRole('button');
    expect(btn).toHaveClass('lg-button');
    expect(btn).toHaveClass('lg-button--subtle');
    expect(btn).toHaveClass('lg-button--lg');
  });

  it('applies default variant=primary size=md classes', () => {
    const { getByRole } = render(<GlassButton>X</GlassButton>);
    const btn = getByRole('button');
    expect(btn).toHaveClass('lg-button--primary');
    expect(btn).toHaveClass('lg-button--md');
  });

  it('preserves a user-supplied className alongside variant classes', () => {
    const { getByRole } = render(<GlassButton className="custom">X</GlassButton>);
    const btn = getByRole('button');
    expect(btn).toHaveClass('lg-button');
    expect(btn).toHaveClass('custom');
  });

  it('lands contentClassName on the content span', () => {
    const { getByText } = render(<GlassButton contentClassName="my-content">Label</GlassButton>);
    const span = getByText('Label');
    expect(span).toHaveClass('lg-content');
    expect(span).toHaveClass('my-content');
  });
});

describe('<GlassButton> asChild polymorphism', () => {
  it('renders an <a> with merged className and fires both handlers', () => {
    const ownClick = vi.fn();
    const childClick = vi.fn();
    const { getByRole } = render(
      <GlassButton asChild variant="secondary" onClick={ownClick}>
        {/* biome-ignore lint/a11y/useValidAnchor: intentional link-styled-button asChild test */}
        <a href="#dest" className="link-class" onClick={childClick}>
          Link
        </a>
      </GlassButton>,
    );
    const link = getByRole('link', { name: 'Link' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#dest');
    // Merged classes: child's own + the resolved button variant classes.
    expect(link).toHaveClass('link-class');
    expect(link).toHaveClass('lg-button');
    expect(link).toHaveClass('lg-button--secondary');

    fireEvent.click(link);
    // Composed handlers: child first, then own.
    expect(childClick).toHaveBeenCalledTimes(1);
    expect(ownClick).toHaveBeenCalledTimes(1);
  });

  it('merges the forwarded ref with the child element ref', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <GlassButton asChild ref={ref as never}>
        <a href="#x">Link</a>
      </GlassButton>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('A');
  });
});

describe('<GlassButton> console cleanliness across capabilities', () => {
  it('renders with no console.error under full and fallback caps', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      const { unmount } = render(
        <GlassButton variant="primary" size="md">
          Buy
        </GlassButton>,
      );
      unmount();
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
