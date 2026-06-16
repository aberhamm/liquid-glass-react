/**
 * `<GlassButton>` — a batteries-included button on top of `<LiquidGlass>` (plan 007).
 *
 * Renders a real semantic `<button>` by default (forwarding `onClick`,
 * `disabled`, `type`, `aria-*`, `ref`, and all other native button attrs), or —
 * via `asChild` — clones a single child element (e.g. an `<a>`) and merges the
 * button's props/className/ref onto it. With `asChild`, the child OWNS its own
 * semantics and accessibility.
 *
 * Variant/size resolve to (a) tuned `LiquidGlass` props and (b) class names from
 * `components.css` (via the standalone `variants()` resolver). The glass
 * decorative layers come from `<LiquidGlass>` and are already `aria-hidden`.
 *
 * Consumers must import the stylesheet once:
 *   import '@aberhamm/liquid-glass-react/styles.css';
 */

import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode, forwardRef } from 'react';
import './components.css';
import { getGlassEdgeShadow } from './glass-edge';
import { LiquidGlass } from './liquid-glass';
import { Slot } from './slot';
import type { LiquidGlassProps } from './types';
import { variants } from './variants';

export type GlassButtonVariant = 'primary' | 'secondary' | 'subtle';
export type GlassButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Per-variant / per-size tuning of the underlying `<LiquidGlass>` primitive.
 * Kept as plain lookup tables (NOT class-variance-authority) so the glass shape
 * stays in sync with the visual `variants()` class mapping below.
 */
type GlassTuning = Pick<
  LiquidGlassProps,
  'displacementScale' | 'blurAmount' | 'saturation' | 'cornerRadius' | 'padding'
>;

const VARIANT_GLASS: Record<GlassButtonVariant, GlassTuning> = {
  primary: { displacementScale: 80, blurAmount: 0.0625, saturation: 160 },
  secondary: { displacementScale: 60, blurAmount: 0.0625, saturation: 140 },
  subtle: { displacementScale: 40, blurAmount: 0.05, saturation: 120 },
};

const SIZE_GLASS: Record<GlassButtonSize, GlassTuning> = {
  sm: { cornerRadius: 999, padding: '6px 14px' },
  md: { cornerRadius: 999, padding: '10px 20px' },
  lg: { cornerRadius: 999, padding: '14px 28px' },
  icon: { cornerRadius: 999, padding: '10px' },
};

/** Resolve the `lg-button*` class names from the variant/size keys. */
const buttonVariants = variants({
  base: 'lg-button',
  variants: {
    variant: {
      primary: 'lg-button--primary',
      secondary: 'lg-button--secondary',
      subtle: 'lg-button--subtle',
    },
    size: {
      sm: 'lg-button--sm',
      md: 'lg-button--md',
      lg: 'lg-button--lg',
      icon: 'lg-button--icon',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. @defaultValue `'primary'` */
  variant?: GlassButtonVariant;
  /** Sizing; `icon` is square and centers a single icon child. @defaultValue `'md'` */
  size?: GlassButtonSize;
  /**
   * Render the single child element instead of a `<button>`, merging this
   * component's props/className/ref onto it. The child then owns its own
   * semantics and a11y (e.g. an `<a href>` for a link-styled button).
   * @defaultValue `false`
   */
  asChild?: boolean;
  /** Brief highlight sweep on press. @defaultValue `true` */
  shine?: boolean;
  /** Class applied to the isolated content layer (the span holding children). */
  contentClassName?: string;
  /** Escape hatch: pass-through overrides to the underlying `<LiquidGlass>`. */
  glassProps?: Partial<Omit<LiquidGlassProps, 'children'>>;
}

/**
 * Controlled/uncontrolled convention (locked here for the whole library — plan
 * 007 / 012): any future stateful surface MUST accept a `value`/`defaultValue`
 * pair plus an `onValueChange` callback and fall back to internal state when
 * uncontrolled. `GlassButton` itself is stateless, so it exposes none.
 */

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  {
    variant = 'primary',
    size = 'md',
    asChild = false,
    shine = true,
    contentClassName,
    glassProps,
    className,
    children,
    style,
    type,
    disabled,
    ...rest
  },
  ref,
) {
  const shellClassName = buttonVariants({ variant, size, className });

  // Set the bevel via a CSS custom property from the single source of truth in
  // glass-edge.ts (the stylesheet references var(--lg-edge-shadow)). The
  // primitive already draws the inset bevel; this exposes it to ::after etc.
  const shellStyle: CSSProperties = {
    ['--lg-edge-shadow' as string]: getGlassEdgeShadow('light'),
    ...style,
  };

  const content: ReactNode = (
    <span className={['lg-content', contentClassName].filter(Boolean).join(' ')}>{children}</span>
  );

  // The interactive shell: a real <button>, or the cloned child via Slot.
  const shell = asChild ? (
    <Slot
      ref={ref}
      className={shellClassName}
      style={shellStyle}
      data-shine={shine ? 'true' : 'false'}
      {...rest}
    >
      {/* The child element receives the content; Slot merges everything else. */}
      {children}
    </Slot>
  ) : (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled}
      className={shellClassName}
      style={shellStyle}
      data-shine={shine ? 'true' : 'false'}
      {...rest}
    >
      {content}
    </button>
  );

  const glassTuning: GlassTuning = {
    ...VARIANT_GLASS[variant],
    ...SIZE_GLASS[size],
  };

  return (
    <LiquidGlass {...glassTuning} {...glassProps}>
      {shell}
    </LiquidGlass>
  );
});
