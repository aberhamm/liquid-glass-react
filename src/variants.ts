/**
 * Tiny standalone variant resolver (plan 007).
 *
 * A ~15-line `cva`-shape factory: it maps `variant`/`size`-style keys to class
 * names from the components' own stylesheet (`components.css`). We deliberately
 * do NOT depend on `class-variance-authority`, `clsx`, or `tailwind-merge` — the
 * library stays zero-dependency and framework-agnostic.
 */

/** Join a list of class tokens, dropping falsy entries. The `clsx`-lite case. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** A map of variant-key → option-value → class name(s). */
type VariantMap = Record<string, Record<string, string>>;

/** The selected option for each variant axis (plus a passthrough `className`). */
type VariantProps<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K];
} & { className?: string };

interface VariantConfig<V extends VariantMap> {
  /** Always-applied base class(es). */
  base?: string;
  /** The variant axes and their per-option class names. */
  variants: V;
  /** Default option per axis, used when a prop is omitted. */
  defaultVariants?: { [K in keyof V]?: keyof V[K] };
}

/**
 * Build a class-name resolver from a `cva`-shape config. The returned function
 * takes the selected options (falling back to `defaultVariants`) plus an
 * optional `className` and returns the joined class string.
 */
export function variants<V extends VariantMap>(config: VariantConfig<V>) {
  const { base, variants: axes, defaultVariants } = config;
  return (props: VariantProps<V> = {}): string => {
    const tokens: Array<string | undefined> = [base];
    for (const axis in axes) {
      const selected = (props[axis] ?? defaultVariants?.[axis]) as string | undefined;
      if (selected !== undefined) tokens.push(axes[axis]?.[selected]);
    }
    tokens.push(props.className);
    return cx(...tokens);
  };
}
