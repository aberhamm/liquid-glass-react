import { act, fireEvent, render } from '@testing-library/react';
import { createRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the capability hook so tests control `canRefract` deterministically
// (mirrors glass-button.test.tsx / liquid-glass.test.tsx).
const mockCapabilities = vi.fn();
vi.mock('./use-glass-capabilities', () => ({
  useGlassCapabilities: () => mockCapabilities(),
}));

// useReducedMotion is mockable so the reduced-motion (snap) test can force it.
const mockReducedMotion = vi.fn<() => boolean>(() => false);
vi.mock('./use-reduced-motion', () => ({
  useReducedMotion: () => mockReducedMotion(),
}));

import { getConservativeGlassCapabilities } from './capabilities';
import { GlassSegmentedControl, type GlassSegmentedOption } from './glass-segmented-control';
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

const OPTIONS: GlassSegmentedOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'dim', label: 'Dim' },
];

beforeEach(() => {
  mockCapabilities.mockReturnValue(caps(true));
  mockReducedMotion.mockReturnValue(false);
  installMatchMedia();
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockReducedMotion.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// Radiogroup semantics
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> radiogroup semantics', () => {
  it('renders a native group (fieldset) with N radios, one checked', () => {
    const { container, getAllByRole } = render(
      <GlassSegmentedControl options={OPTIONS} label="Theme" defaultValue="dark" />,
    );
    // Fieldset has the implicit role "group".
    const group = container.querySelector('fieldset');
    expect(group).not.toBeNull();
    const radios = getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(OPTIONS.length);
    const checked = radios.filter((r) => r.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0]?.value).toBe('dark');
  });

  it('exposes an accessible group label via the legend', () => {
    const { getByText } = render(
      <GlassSegmentedControl options={OPTIONS} label="Appearance" showLabel />,
    );
    const legend = getByText('Appearance');
    expect(legend.tagName).toBe('LEGEND');
  });

  it('shares one radio group name across all inputs', () => {
    const { getAllByRole } = render(<GlassSegmentedControl options={OPTIONS} label="Theme" />);
    const radios = getAllByRole('radio') as HTMLInputElement[];
    const names = new Set(radios.map((r) => r.name));
    expect(names.size).toBe(1);
  });

  it('forwards ref to the root fieldset', () => {
    const ref = createRef<HTMLFieldSetElement>();
    render(<GlassSegmentedControl ref={ref} options={OPTIONS} label="Theme" />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('FIELDSET');
  });
});

// ---------------------------------------------------------------------------
// Keyboard / selection
//
// NOTE: native Arrow/Home/End radio navigation is a USER-AGENT behavior that
// jsdom does NOT simulate (fireEvent.keyDown won't move the native selection).
// We therefore assert the a11y STRUCTURE that enables it (real <input
// type=radio> sharing one name inside a fieldset) plus click-driven selection.
// True arrow-key navigation is covered in the cross-engine E2E.
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> selection', () => {
  it('clicking a label checks its radio and fires onValueChange', () => {
    const onValueChange = vi.fn();
    const { getByLabelText } = render(
      <GlassSegmentedControl options={OPTIONS} label="Theme" onValueChange={onValueChange} />,
    );
    const dark = getByLabelText('Dark') as HTMLInputElement;
    fireEvent.click(dark);
    expect(dark.checked).toBe(true);
    expect(onValueChange).toHaveBeenCalledWith('dark');
  });

  it('the structure enabling native arrow nav is present (shared name + fieldset)', () => {
    const { container, getAllByRole } = render(
      <GlassSegmentedControl options={OPTIONS} label="Theme" />,
    );
    expect(container.querySelector('fieldset')).not.toBeNull();
    const radios = getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => r.type === 'radio')).toBe(true);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Controlled / uncontrolled
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> controlled / uncontrolled', () => {
  it('uncontrolled: defaultValue seeds, selecting updates internally + fires change', () => {
    const onValueChange = vi.fn();
    const { getByLabelText } = render(
      <GlassSegmentedControl
        options={OPTIONS}
        label="Theme"
        defaultValue="light"
        onValueChange={onValueChange}
      />,
    );
    expect((getByLabelText('Light') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(getByLabelText('Dim'));
    expect((getByLabelText('Dim') as HTMLInputElement).checked).toBe(true);
    expect(onValueChange).toHaveBeenCalledWith('dim');
  });

  it('controlled: value prop controls checked; selecting fires change but does NOT self-update', () => {
    const onValueChange = vi.fn();
    const { getByLabelText } = render(
      <GlassSegmentedControl
        options={OPTIONS}
        label="Theme"
        value="light"
        onValueChange={onValueChange}
      />,
    );
    expect((getByLabelText('Light') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(getByLabelText('Dark'));
    // Parent didn't update `value`, so the controlled checked state holds.
    expect(onValueChange).toHaveBeenCalledWith('dark');
    expect((getByLabelText('Light') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('Dark') as HTMLInputElement).checked).toBe(false);
  });

  it('controlled: updating value from the parent moves the checked radio', () => {
    function Controlled(): React.ReactElement {
      const [v, setV] = useState('light');
      return (
        <GlassSegmentedControl options={OPTIONS} label="Theme" value={v} onValueChange={setV} />
      );
    }
    const { getByLabelText } = render(<Controlled />);
    fireEvent.click(getByLabelText('Dim'));
    expect((getByLabelText('Dim') as HTMLInputElement).checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Indicator moves — the hard "it actually slid" assertion
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> indicator moves', () => {
  /**
   * jsdom returns all-zero rects. Stub getBoundingClientRect so each option
   * label + the container return distinct, deterministic rects (100px wide,
   * laid out left-to-right with an 8px container pad), so the measurement effect
   * produces a different `left` per active option.
   */
  function stubDistinctRects(): void {
    const W = 100;
    const PAD = 8;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      let left = 0;
      let width = W;
      if (this.classList.contains('lg-segmented-track')) {
        left = 0;
        width = PAD * 2 + W * OPTIONS.length;
      } else if (this.tagName === 'LABEL') {
        const labels = Array.from(
          this.closest('.lg-segmented-track')?.querySelectorAll('label.lg-segmented-option') ?? [],
        );
        const idx = labels.indexOf(this);
        left = PAD + idx * W;
        width = W;
      }
      return {
        left,
        right: left + width,
        width,
        height: 36,
        top: 0,
        bottom: 36,
        x: left,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  }

  function indicatorOf(container: HTMLElement): HTMLElement {
    return container.querySelector('.lg-segmented-indicator') as HTMLElement;
  }

  it('the deterministic DOM signal (transform + data-selected-index) DIFFERS between two selections', () => {
    stubDistinctRects();
    const { container, getByLabelText, rerender } = render(
      <GlassSegmentedControl options={OPTIONS} label="Theme" value="light" />,
    );

    const indicatorA = indicatorOf(container);
    const transformA = indicatorA.style.transform;
    const indexA = indicatorA.getAttribute('data-selected-index');
    // Post-measure: a px translateX from the measured rect of the active label.
    expect(transformA).toMatch(/translateX\(/);
    expect(indexA).toBe('0');

    // Move selection to the third option and re-measure.
    rerender(<GlassSegmentedControl options={OPTIONS} label="Theme" value="dim" />);
    const indicatorB = indicatorOf(container);
    const transformB = indicatorB.style.transform;
    const indexB = indicatorB.getAttribute('data-selected-index');

    expect(indexB).toBe('2');
    // The hard assertion: the indicator MOVED (transform changed).
    expect(transformB).not.toBe(transformA);
    // The fieldset's own signal also moved.
    expect(container.querySelector('fieldset')?.getAttribute('data-selected-index')).toBe('2');
    // sanity: getByLabelText resolves (avoids unused import lint)
    expect(getByLabelText('Dim')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Reduced motion — snap (no transition)
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> reduced motion', () => {
  it('snaps (transition: none) when reduced motion is on', () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<GlassSegmentedControl options={OPTIONS} label="Theme" />);
    const indicator = container.querySelector('.lg-segmented-indicator') as HTMLElement;
    expect(indicator.style.transition).toBe('none');
  });

  it('animates (has a transform transition) when reduced motion is off', () => {
    mockReducedMotion.mockReturnValue(false);
    const { container } = render(<GlassSegmentedControl options={OPTIONS} label="Theme" />);
    const indicator = container.querySelector('.lg-segmented-indicator') as HTMLElement;
    expect(indicator.style.transition).toContain('transform');
  });
});

// ---------------------------------------------------------------------------
// Console cleanliness across capabilities
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> console cleanliness', () => {
  it('renders with no console.error/warn under full and fallback caps', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const c of [caps(true), caps(false, true), caps(false, false)]) {
      mockCapabilities.mockReturnValue(c);
      const { unmount } = render(
        <GlassSegmentedControl options={OPTIONS} label="Theme" defaultValue="dark" />,
      );
      unmount();
    }
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Hydration — SSR-stable indicator default matches first client paint (mirror 006)
// ---------------------------------------------------------------------------

describe('<GlassSegmentedControl> SSR hydration', () => {
  it('hydrates server markup with no hydration-mismatch console.error', async () => {
    // Conservative caps = what both the server render and first client paint
    // produce (the real upgrade + measurement happen in mount effects).
    mockCapabilities.mockReturnValue(getConservativeGlassCapabilities());
    mockReducedMotion.mockReturnValue(false);

    const element = <GlassSegmentedControl options={OPTIONS} label="Theme" defaultValue="dark" />;

    const html = renderToString(element);
    expect(html).toContain('Dark');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, element);
      await Promise.resolve();
    });

    const mismatch = errorSpy.mock.calls.some((args) =>
      args.some(
        (a) =>
          typeof a === 'string' &&
          (/hydrat/i.test(a) ||
            /did not match/i.test(a) ||
            /Text content does not match/i.test(a) ||
            /server (HTML|rendered)/i.test(a)),
      ),
    );
    expect(mismatch).toBe(false);

    await act(async () => {
      root?.unmount();
    });
    document.body.removeChild(container);
  });
});
