'use client';

import { Glass, type GlassProps } from '@samasante/liquid-glass';
import { type HTMLAttributes, forwardRef } from 'react';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'raised' | 'floating';
  glassProps?: Omit<GlassProps, 'children'>;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { elevation = 'raised', glassProps, className = '', children, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={`matui-glass-card matui-glass-card--${elevation} ${className}`}
    >
      <Glass
        {...glassProps}
        style={{ width: '100%', padding: 28, borderRadius: 'inherit', ...glassProps?.style }}
      >
        {children}
      </Glass>
    </div>
  );
});
