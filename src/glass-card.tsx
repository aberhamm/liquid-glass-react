/**
 * `<GlassCard>` — a batteries-included container on top of `<LiquidGlass>` (plan 007).
 *
 * Renders a `<div>` by default (forwarding `ref`, `className`, `style`,
 * `children`), or — via `asChild` — clones a single child element and merges the
 * card's props/className/ref onto it. Ships sensible padding/cornerRadius
 * defaults and an optional `elevation` knob, plus the content-legibility
 * foreground treatment from `components.css`.
 *
 * Consumers must import the stylesheet once:
 *   import '@aberhamm/liquid-glass-react/styles.css';
 */

import { type CSSProperties, type HTMLAttributes, forwardRef } from 'react';
import './components.css';
import { getGlassEdgeShadow } from './glass-edge';
import { LiquidGlass } from './liquid-glass';
import { Slot } from './slot';
import type { LiquidGlassProps } from './types';
import { variants } from './variants';

export type GlassCardElevation = 'flat' | 'raised' | 'floating';

/** Resolve the `lg-card*` class names from the elevation key. */
const cardVariants = variants({
  base: 'lg-card',
  variants: {
    elevation: {
      flat: 'lg-card--flat',
      raised: 'lg-card--raised',
      floating: 'lg-card--floating',
    },
  },
  defaultVariants: { elevation: 'raised' },
});

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ambient lift under the card. @defaultValue `'raised'` */
  elevation?: GlassCardElevation;
  /**
   * Render the single child element instead of a `<div>`, merging this
   * component's props/className/ref onto it. The child then owns its semantics.
   * @defaultValue `false`
   */
  asChild?: boolean;
  /** Class applied to the isolated content layer (the wrapper holding children). */
  contentClassName?: string;
  /** Escape hatch: pass-through overrides to the underlying `<LiquidGlass>`. */
  glassProps?: Partial<Omit<LiquidGlassProps, 'children'>>;
}

const CARD_GLASS: Pick<LiquidGlassProps, 'cornerRadius' | 'padding' | 'displacementScale'> = {
  cornerRadius: 28,
  padding: '24px 28px',
  displacementScale: 50,
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    elevation = 'raised',
    asChild = false,
    contentClassName,
    glassProps,
    className,
    children,
    style,
    ...rest
  },
  ref,
) {
  const shellClassName = cardVariants({ elevation, className });

  const shellStyle: CSSProperties = {
    ['--lg-edge-shadow' as string]: getGlassEdgeShadow('light'),
    ...style,
  };

  const content = (
    <div className={['lg-content', contentClassName].filter(Boolean).join(' ')}>{children}</div>
  );

  const shell = asChild ? (
    <Slot
      ref={ref}
      className={shellClassName}
      style={shellStyle}
      data-elevation={elevation}
      {...rest}
    >
      {children}
    </Slot>
  ) : (
    <div
      ref={ref}
      className={shellClassName}
      style={shellStyle}
      data-elevation={elevation}
      {...rest}
    >
      {content}
    </div>
  );

  return (
    <LiquidGlass {...CARD_GLASS} {...glassProps}>
      {shell}
    </LiquidGlass>
  );
});
