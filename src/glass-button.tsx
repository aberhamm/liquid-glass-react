'use client';

import { Glass, type GlassProps } from '@samasante/liquid-glass';
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  glassProps?: Omit<GlassProps, 'children'>;
  contentClassName?: string;
  children?: ReactNode;
}

/** A native button over an upstream glass material; decoration never receives input. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  {
    variant = 'primary',
    size = 'md',
    glassProps,
    contentClassName,
    className = '',
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  return (
    <span className={`matui-glass-button-shell matui-glass-button--${variant}`}>
      <Glass
        {...glassProps}
        aria-hidden
        style={{
          ...glassProps?.style,
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: 'inherit',
          pointerEvents: 'none',
        }}
      >
        <span />
      </Glass>
      <button
        {...props}
        ref={ref}
        type={type}
        className={`matui-glass-button matui-glass-button--${size} ${className}`}
      >
        <span className={contentClassName}>{children}</span>
      </button>
    </span>
  );
});
