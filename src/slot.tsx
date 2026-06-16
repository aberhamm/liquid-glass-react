/**
 * Internal `Slot` helper (plan 007) powering `asChild` polymorphism.
 *
 * Inspired by shadcn/Radix `asChild` ergonomics, but a tiny self-contained
 * implementation so the library does NOT depend on `@radix-ui/react-slot`.
 *
 * `Slot` takes EXACTLY ONE valid React element child and clones it, MERGING:
 *   - `className` (concatenated, own after child's),
 *   - `style` (shallow object merge, own wins),
 *   - event handlers (composed — the CHILD's runs first, then the SLOT's own;
 *     this lets the child cancel/preventDefault before the wrapper reacts),
 *   - `ref` (the forwarded slot ref is merged with the child's existing ref).
 *
 * Under React 18, `cloneElement` forwards `ref` normally, so we merge the
 * incoming forwarded ref with the child's existing ref via a small ref-merge
 * util. A defensive guard also handles `ref`-as-prop should a React 19 host
 * read this through the props object.
 *
 * Not part of the public API surface (exported only for the components and
 * tests in this package).
 */

import {
  Children,
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  forwardRef,
  isValidElement,
} from 'react';

/** A mutable or callback ref, or none. */
type AnyRef = Ref<unknown> | undefined;

/**
 * Compose any number of refs into one callback ref. Assigns the same node to
 * each (callbacks invoked, object refs' `.current` set). Used to merge the
 * slot's forwarded ref with the child's own ref so both stay live.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}

/** Compose two event handlers: run `theirs` first, then `ours` (unless prevented). */
function composeHandlers(
  theirs: ((...args: unknown[]) => void) | undefined,
  ours: ((...args: unknown[]) => void) | undefined,
): ((...args: unknown[]) => void) | undefined {
  if (!theirs) return ours;
  if (!ours) return theirs;
  return (...args: unknown[]) => {
    theirs(...args);
    // Honor a child that cancelled the event before the wrapper reacts.
    const event = args[0] as { defaultPrevented?: boolean } | undefined;
    if (!event || !event.defaultPrevented) ours(...args);
  };
}

/** Shallow-merge the slot's own props onto the child's, composing handlers/refs/class/style. */
function mergeProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...childProps };

  for (const key in slotProps) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];

    if (key === 'className') {
      merged.className = [childValue, slotValue].filter(Boolean).join(' ');
    } else if (key === 'style') {
      merged.style = { ...(childValue as object), ...(slotValue as object) };
    } else if (/^on[A-Z]/.test(key)) {
      merged[key] = composeHandlers(
        childValue as ((...args: unknown[]) => void) | undefined,
        slotValue as ((...args: unknown[]) => void) | undefined,
      );
    } else if (slotValue !== undefined) {
      merged[key] = slotValue;
    }
  }

  return merged;
}

export interface SlotProps {
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * Render the single child element with the slot's props/className/style/handlers
 * and a merged ref. Throws a dev-friendly error when not given exactly one valid
 * element child.
 */
export const Slot = forwardRef<unknown, SlotProps>(function Slot(props, forwardedRef) {
  const { children, ...slotProps } = props;

  if (!isValidElement(children) || Children.count(children) !== 1) {
    throw new Error(
      'Slot (asChild) expects exactly one valid React element child. ' +
        'Pass a single element, e.g. <GlassButton asChild><a href="…">Link</a></GlassButton>.',
    );
  }

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props as Record<string, unknown>;
  // Under React 18 the child's ref lives on the element; a React-19 host may
  // surface it through props. Read both defensively.
  const childRef = (child as { ref?: AnyRef }).ref ?? (childProps as { ref?: AnyRef }).ref;

  const merged = mergeProps(slotProps, childProps);
  merged.ref = mergeRefs(forwardedRef as AnyRef, childRef);

  return cloneElement(child, merged);
});
