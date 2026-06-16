/**
 * `<GlassSegmentedControl>` — the showcase liquid toggle (plan 012).
 *
 * A row of options with a single liquid-glass indicator that SLIDES and morphs
 * behind the active option. The headline demo of the primitive: full refraction
 * in Chromium, graceful fallback elsewhere, and a CSS-`transform` slide that
 * renders in every engine.
 *
 * ## Accessibility — native radios, zero custom ARIA
 *
 * The control is a NATIVE radiogroup: a `<fieldset>` (implicit role `group`)
 * with a `<legend>` (the accessible group label) wrapping one visually-hidden
 * `<input type="radio">` per option, each associated with a styled `<label>`.
 * Sharing one `name` (a stable {@link useId}) gives Arrow/Home/End/Space
 * keyboard navigation and screen-reader semantics for FREE — no roving-tabindex,
 * no `role="radiogroup"`, no key handlers. (Only a layout that genuinely can't
 * use native radios would need the manual path; this one doesn't.)
 *
 * ## Controlled / uncontrolled (the 007 convention)
 *
 * Controlled when `value !== undefined`; otherwise internal `useState` seeded
 * from `defaultValue` (or the first option). `onValueChange(value)` fires on
 * every user selection regardless.
 *
 * ## Indicator positioning — measure in an effect, never in render
 *
 * Server + first client paint render the indicator at an SSR-STABLE, CSS-only
 * equal-segment default (`left: activeIndex * (100/n)%`, `width: (100/n)%`), so
 * hydration matches deterministically. AFTER mount, a `useLayoutEffect` measures
 * the active option's real `getBoundingClientRect` relative to the container and
 * sets a precise inline `transform: translateX()` + `width` (overriding the CSS
 * default) — this is what handles UNEQUAL-width options (icon-only vs long
 * label). A container `ResizeObserver` (rAF-throttled so a resize storm
 * coalesces to one recompute/frame) keeps it in sync. The slide is a `transform`
 * transition, suppressed under `prefers-reduced-motion` (snap) via the shared
 * {@link useReducedMotion}.
 *
 * ## Deterministic DOM signal
 *
 * The root carries `data-selected-index` and the indicator carries its inline
 * `transform`/`width` — both move when the selection changes, so unit + E2E
 * tests can assert the indicator actually slid.
 */

import {
  type CSSProperties,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './components.css';
import { getGlassEdgeShadow } from './glass-edge';
import { LiquidGlass } from './liquid-glass';
import type { LiquidGlassProps } from './types';
import { useReducedMotion } from './use-reduced-motion';
import { variants } from './variants';

/**
 * `useLayoutEffect` on the client, `useEffect` on the server. The measurement
 * pass is client-only (it reads `getBoundingClientRect`), so on the server we
 * fall back to `useEffect` — which `renderToString` never runs — to silence
 * React's "useLayoutEffect does nothing on the server" warning without
 * sacrificing the no-flash measurement in the browser.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type GlassSegmentedControlSize = 'sm' | 'md' | 'lg';

/** A single selectable segment. `label` and/or `icon` may be supplied. */
export interface GlassSegmentedOption {
  /** Stable value emitted via `onValueChange` and used to mark selection. */
  value: string;
  /** Visible text/content (optional when an `icon` carries the meaning). */
  label?: ReactNode;
  /** Leading icon (optional). Icon-only options are supported. */
  icon?: ReactNode;
  /** Disable this single option. */
  disabled?: boolean;
}

/** Per-size tuning of the underlying `<LiquidGlass>` indicator. */
type GlassTuning = Pick<LiquidGlassProps, 'displacementScale' | 'blurAmount' | 'saturation'>;

const SIZE_GLASS: Record<GlassSegmentedControlSize, GlassTuning> = {
  sm: { displacementScale: 40, blurAmount: 0.05, saturation: 130 },
  md: { displacementScale: 56, blurAmount: 0.0625, saturation: 140 },
  lg: { displacementScale: 72, blurAmount: 0.0625, saturation: 150 },
};

/** Resolve `lg-segmented*` class names from the size key. */
const segmentedVariants = variants({
  base: 'lg-segmented',
  variants: {
    size: {
      sm: 'lg-segmented--sm',
      md: 'lg-segmented--md',
      lg: 'lg-segmented--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface GlassSegmentedControlProps {
  /** The selectable segments. */
  options: GlassSegmentedOption[];
  /** Controlled selected value. When set, the component is controlled. */
  value?: string;
  /** Initial selected value when uncontrolled. Defaults to the first option. */
  defaultValue?: string;
  /** Fires on every user selection with the newly-selected value. */
  onValueChange?: (value: string) => void;
  /** Size variant. @defaultValue `'md'` */
  size?: GlassSegmentedControlSize;
  /**
   * Accessible group label. Rendered into the `<legend>` (visually hidden unless
   * `showLabel`) so screen-reader users hear the group's purpose.
   */
  label?: ReactNode;
  /** Accessible group label as a plain string (alternative to `label`). */
  'aria-label'?: string;
  /** Show the `label` visually above the control instead of hiding it. */
  showLabel?: boolean;
  /** Class applied to the root `<fieldset>`. */
  className?: string;
  /** Inline styles merged onto the root `<fieldset>`. */
  style?: CSSProperties;
  /** Stable `name` for the radio group. Defaults to a generated id. */
  name?: string;
  /** Escape hatch: pass-through overrides to the indicator's `<LiquidGlass>`. */
  glassProps?: Partial<Omit<LiquidGlassProps, 'children'>>;
}

interface IndicatorRect {
  left: number;
  width: number;
}

export const GlassSegmentedControl = forwardRef<HTMLFieldSetElement, GlassSegmentedControlProps>(
  function GlassSegmentedControl(
    {
      options,
      value,
      defaultValue,
      onValueChange,
      size = 'md',
      label,
      'aria-label': ariaLabel,
      showLabel = false,
      className,
      style,
      name,
      glassProps,
    },
    ref,
  ) {
    const reactId = useId();
    const groupName = name ?? `lg-seg-${reactId.replace(/:/g, '')}`;

    const firstValue = options[0]?.value;

    // Controlled when `value` is provided; otherwise internal state seeded from
    // defaultValue (falling back to the first option) — the 007 convention.
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string | undefined>(
      defaultValue ?? firstValue,
    );
    const selectedValue = isControlled ? value : internalValue;

    const activeIndex = useMemo(() => {
      const i = options.findIndex((o) => o.value === selectedValue);
      return i < 0 ? 0 : i;
    }, [options, selectedValue]);

    const optionCount = options.length || 1;

    const reducedMotion = useReducedMotion();

    // Container + per-option label refs for post-mount measurement.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const labelRefs = useRef<Array<HTMLLabelElement | null>>([]);

    // The MEASURED indicator rect (null until the effect runs). While null we
    // fall back to the SSR-stable CSS equal-segment default so hydration matches.
    const [indicatorRect, setIndicatorRect] = useState<IndicatorRect | null>(null);

    const measure = useCallback((): void => {
      const container = containerRef.current;
      const activeLabel = labelRefs.current[activeIndex];
      if (!container || !activeLabel) return;
      const containerRect = container.getBoundingClientRect();
      const labelRect = activeLabel.getBoundingClientRect();
      // Bail on a degenerate (pre-layout / jsdom-zero) container box; the CSS
      // equal-segment default stays in place rather than collapsing to 0.
      if (!Number.isFinite(containerRect.width) || containerRect.width <= 0) return;
      const left = labelRect.left - containerRect.left;
      const width = labelRect.width;
      if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return;
      setIndicatorRect((prev) =>
        prev && prev.left === left && prev.width === width ? prev : { left, width },
      );
    }, [activeIndex]);

    // Hold the latest `measure` in a ref so the ResizeObserver effect can run
    // ONCE (mount/unmount) instead of tearing down + re-subscribing the observer
    // on every selection change (which recreates `measure` via its activeIndex
    // dep). The RO callback always reads the current closure through the ref.
    const measureRef = useRef(measure);
    measureRef.current = measure;

    // Measurement runs in a layout effect AFTER mount — never during render — so
    // the server + first client paint use the CSS default and hydration matches.
    // useLayoutEffect avoids a visible flash between the default and the measured
    // position; it is a no-op on the server (this component is client-measured).
    // Re-runs when `measure` changes (i.e. when the active index changes) to slide
    // the indicator to the newly-measured option.
    useIsomorphicLayoutEffect(() => {
      measure();
    }, [measure]);

    // Container ResizeObserver, rAF-throttled so a resize storm coalesces to one
    // recompute per frame. Guarded for environments without ResizeObserver. The
    // empty dep array keeps a single stable subscription for the component's life.
    useEffect(() => {
      const container = containerRef.current;
      if (!container || typeof ResizeObserver === 'undefined') return;
      let frame = 0;
      const observer = new ResizeObserver(() => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          measureRef.current();
        });
      });
      observer.observe(container);
      return () => {
        if (frame) cancelAnimationFrame(frame);
        observer.disconnect();
      };
    }, []);

    const handleSelect = useCallback(
      (next: string): void => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const glassTuning = SIZE_GLASS[size];
    const edgeShadow = getGlassEdgeShadow('light');

    // Indicator geometry. Measured rect (post-mount) wins; otherwise the
    // SSR-stable equal-segment default keyed off the active index. Both are pure
    // CSS values so server + first paint agree.
    const measured = indicatorRect !== null;
    const indicatorStyle: CSSProperties = measured
      ? {
          width: `${indicatorRect.width}px`,
          transform: `translateX(${indicatorRect.left}px)`,
        }
      : {
          width: `${100 / optionCount}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        };

    // Slide transition, snapped under reduced motion.
    indicatorStyle.transition = reducedMotion
      ? 'none'
      : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1), width 320ms cubic-bezier(0.32, 0.72, 0, 1)';

    const rootStyle: CSSProperties = {
      ['--lg-edge-shadow' as string]: edgeShadow,
      ...style,
    };

    const legend = (
      <legend
        className={
          showLabel ? 'lg-segmented-legend lg-segmented-legend--visible' : 'lg-segmented-legend'
        }
      >
        {label ?? ariaLabel ?? 'Options'}
      </legend>
    );

    return (
      <fieldset
        ref={ref}
        className={segmentedVariants({ size, className })}
        style={rootStyle}
        aria-label={ariaLabel}
        data-selected-index={activeIndex}
        data-measured={measured ? 'true' : 'false'}
      >
        {legend}

        <div className="lg-segmented-track" ref={containerRef}>
          {/* Sliding glass indicator behind the active option. aria-hidden: it is
              purely decorative; the radios carry all selection semantics. The
              equal-segment default keeps it stable through hydration. */}
          <div
            className="lg-segmented-indicator"
            style={indicatorStyle}
            data-selected-index={activeIndex}
            aria-hidden="true"
          >
            <LiquidGlass
              cornerRadius="inherit"
              padding={0}
              displacementScale={glassTuning.displacementScale}
              blurAmount={glassTuning.blurAmount}
              saturation={glassTuning.saturation}
              {...glassProps}
              className="lg-segmented-glass"
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              {/* The glass needs a child; an empty, sized span keeps the surface
                  measurable without contributing visible content. */}
              <span aria-hidden="true" className="lg-segmented-glass-fill" />
            </LiquidGlass>
          </div>

          {options.map((option, index) => {
            const checked = option.value === selectedValue;
            const inputId = `${groupName}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className="lg-segmented-option"
                data-active={checked ? 'true' : 'false'}
                data-icon-only={option.icon != null && option.label == null ? 'true' : 'false'}
                ref={(node) => {
                  labelRefs.current[index] = node;
                }}
              >
                <input
                  id={inputId}
                  className="lg-segmented-input"
                  type="radio"
                  name={groupName}
                  value={option.value}
                  checked={checked}
                  disabled={option.disabled}
                  onChange={() => handleSelect(option.value)}
                />
                {option.icon != null ? (
                  <span className="lg-segmented-icon" aria-hidden="true">
                    {option.icon}
                  </span>
                ) : null}
                {option.label != null ? (
                  <span className="lg-segmented-label">{option.label}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  },
);
