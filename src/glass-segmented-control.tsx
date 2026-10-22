'use client';

import { Glass } from '@samasante/liquid-glass';
import { type ReactNode, useId, useState } from 'react';

export interface GlassSegmentedControlProps {
  label: string;
  options: { value: string; label: ReactNode; disabled?: boolean }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
}

/** Native radio semantics provide arrow-key navigation, focus and form values. */
export function GlassSegmentedControl({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  disabled,
  className = '',
}: GlassSegmentedControlProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.value ?? '',
  );
  const current = value ?? internalValue;
  return (
    <fieldset disabled={disabled} className={`matui-glass-segmented ${className}`}>
      <legend className="matui-glass-sr-only">{label}</legend>
      {options.map((option) => (
        <div key={option.value} className="matui-glass-segment">
          {current === option.value && (
            <Glass
              aria-hidden
              className="matui-glass-segment-lens"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 18,
                width: '100%',
                height: '100%',
                background: '#ffffff44',
                pointerEvents: 'none',
              }}
            >
              <span />
            </Glass>
          )}
          <label>
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={current === option.value}
              disabled={option.disabled}
              onChange={() => {
                if (value === undefined) setInternalValue(option.value);
                onValueChange?.(option.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );
}
