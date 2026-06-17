# @aberhamm/liquid-glass-react

Liquid-glass UI primitives and batteries-included components for React — a
frosted, refractive "glass" surface driven by `backdrop-filter` and SVG
displacement filters, with graceful per-engine degradation and zero runtime
dependencies.

> **Independent reimplementation, not a fork.** This library reimplements the
> liquid-glass technique popularized by
> [`rdev/liquid-glass-react`](https://github.com/rdev/liquid-glass-react) and
> [`shuding/liquid-glass`](https://github.com/shuding/liquid-glass). It shares
> the *prop surface and intent* — not the code. No source was copied; see
> [`LICENSE`](./LICENSE) and [`docs/PARITY.md`](./docs/PARITY.md).

- **Full refraction in Chromium** — SVG `feDisplacementMap` composited over a
  blurred, saturated backdrop, plus chromatic aberration and elastic motion.
- **Graceful fallback in Firefox & Safari/WebKit** — a frosted surface (blur +
  saturate + inset-shadow glass edge + rim + elastic motion) with *identical box
  geometry*, so degrading never shifts layout.
- **Solid translucent fallback** where `backdrop-filter` is unavailable — never
  a transparent, unreadable box.
- **SSR-safe** — conservative capabilities until mount, no hydration mismatch.
- **Zero runtime dependencies.** React 18+ is a peer dependency.

---

## Install

```bash
pnpm add @aberhamm/liquid-glass-react
# or
npm install @aberhamm/liquid-glass-react
# or
yarn add @aberhamm/liquid-glass-react
```

`react` and `react-dom` `>=18` are **peer dependencies** — install them in your
app if you haven't already:

```bash
pnpm add react react-dom
```

### CSS import

The **prebuilt components** (`GlassButton`, `GlassCard`,
`GlassSegmentedControl`) require their stylesheet, imported **once** anywhere in
your app (e.g. your root layout or entry):

```ts
import '@aberhamm/liquid-glass-react/styles.css';
```

The low-level `<LiquidGlass>` **primitive does not need the stylesheet** — it is
fully self-contained and works without it.

---

## Quick start

### `LiquidGlass` (the primitive)

```tsx
import { LiquidGlass } from '@aberhamm/liquid-glass-react';

export function Badge() {
  return (
    <LiquidGlass cornerRadius={24} padding="16px 24px">
      <span style={{ color: 'white', fontWeight: 600 }}>Liquid glass</span>
    </LiquidGlass>
  );
}
```

### `GlassButton`

```tsx
import { GlassButton } from '@aberhamm/liquid-glass-react';
import '@aberhamm/liquid-glass-react/styles.css';

export function Actions() {
  return (
    <GlassButton variant="primary" size="md" onClick={() => alert('clicked')}>
      Get started
    </GlassButton>
  );
}
```

### `GlassCard`

```tsx
import { GlassCard } from '@aberhamm/liquid-glass-react';
import '@aberhamm/liquid-glass-react/styles.css';

export function Panel() {
  return (
    <GlassCard elevation="floating">
      <h3>Frosted panel</h3>
      <p>Content stays legible over busy backgrounds.</p>
    </GlassCard>
  );
}
```

### `GlassSegmentedControl`

```tsx
import { useState } from 'react';
import { GlassSegmentedControl } from '@aberhamm/liquid-glass-react';
import '@aberhamm/liquid-glass-react/styles.css';

export function ViewToggle() {
  const [value, setValue] = useState('grid');
  return (
    <GlassSegmentedControl
      label="View mode"
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'grid', label: 'Grid' },
        { value: 'list', label: 'List' },
        { value: 'map', label: 'Map' },
      ]}
    />
  );
}
```

The control is a **native radiogroup** (`<fieldset>` + visually-hidden
`<input type="radio">`), so Arrow/Home/End/Space keyboard navigation and
screen-reader semantics work for free. Pass `label` (or `aria-label`) for the
accessible group name; set `showLabel` to render it visually.

---

## The `asChild` polymorphism pattern

`GlassButton` and `GlassCard` accept `asChild`. When set, the component renders
**your** single child element instead of its default tag (`<button>` / `<div>`),
merging its props, `className`, and `ref` onto it. The child then owns its own
semantics and accessibility — ideal for link-styled buttons:

```tsx
import { GlassButton } from '@aberhamm/liquid-glass-react';

<GlassButton asChild variant="secondary">
  <a href="/docs">Read the docs</a>
</GlassButton>;
```

---

## Capability detection

Use the hook (or the underlying detector) to branch on what the current engine
can actually render. The single gate is `canRefract` — `true` only when the full
SVG-displacement refraction will composite (Chromium with `backdrop-filter`):

```tsx
import { useGlassCapabilities } from '@aberhamm/liquid-glass-react';

function Hint() {
  const caps = useGlassCapabilities();
  return caps.canRefract
    ? <p>Full refraction is active.</p>
    : <p>Showing the frosted fallback for this browser.</p>;
}
```

During SSR and before the mount effect runs, every capability is conservatively
`false` (so the server and first client render agree). For one-shot,
non-reactive checks there is also `detectGlassCapabilities()`:

```ts
import { detectGlassCapabilities } from '@aberhamm/liquid-glass-react';

const caps = detectGlassCapabilities(); // GlassCapabilities
if (caps.canRefract) {
  /* ... */
}
```

`GlassCapabilities` fields: `supportsBackdropFilter`, `isChromium`,
`supportsSvgBackdropDisplacement`, `isFirefox`, `prefersReducedMotion`, and the
derived `canRefract`.

---

## Browser support

Behavior is selected at runtime by the `canRefract` gate
(`supportsBackdropFilter && supportsSvgBackdropDisplacement`, where the latter is
positive Blink-family detection). All tiers share **identical box geometry**, so
moving between them causes **no layout shift**. See
[`docs/PARITY.md`](./docs/PARITY.md) for the full contract.

| Engine | `canRefract` | Rendered behavior |
| --- | --- | --- |
| **Chromium** (Chrome, Edge, Brave, Opera) | `true` | **Full effect** — SVG `feDisplacementMap` refraction composited over `backdrop-filter`, blur, saturation, chromatic aberration, and elastic motion. |
| **Firefox** (Gecko) | `false` | **Frosted fallback** — `backdrop-filter: blur() saturate()` + inset-shadow glass edge + rim + elastic motion. No refraction. |
| **Safari / WebKit** | `false` | **Frosted fallback** — same as Firefox; `-webkit-backdrop-filter` renders the blur/saturate, but WebKit does not composite the SVG displacement over the backdrop. |
| No `backdrop-filter` (very old engines) | `false` | **Solid translucent fallback** — scheme-aware `rgba(...)` fill so content stays legible; never a transparent box. |
| **SSR / pre-mount** | `false` | **Conservative (degraded)** — all capabilities `false` until the client mount effect re-evaluates, avoiding hydration mismatch. |

Why not feature-detect refraction directly? There is no standardized
`CSS.supports` probe for "an SVG `feDisplacementMap` composites correctly over
`backdrop-filter`" — it's a Chromium rendering-pipeline quirk. The library uses
positive Blink detection (a pragmatic, revisitable heuristic) to keep Safari and
Firefox in the frosted tier by construction. Details and caveats live in
[`docs/PARITY.md`](./docs/PARITY.md).

---

## Displacement `mode`

The primitive's `mode` prop selects the displacement algorithm used to generate
the SVG filter (full effect renders in Chromium; other engines show the frosted
fallback regardless of `mode`):

| Mode | Look |
| --- | --- |
| `standard` *(default)* | Balanced, edge-weighted displacement — the default glass look. |
| `polar` | Radial/polar displacement, stronger toward the perimeter. |
| `prominent` | Exaggerated displacement for a heavier "thick glass" feel. |
| `shader` | Shader-style profile for sharper highlights. The displacement map is **generated at runtime** (canvas → `data:` URL feeding an `feImage`). |
| `turbulence` | Adds fractal `feTurbulence` for an organic, watery, **procedural frosted-ripple** distortion. |

```tsx
<LiquidGlass mode="turbulence">…</LiquidGlass>
```

---

## Content-adaptive auto-tint (`adaptiveTint`)

Apple's Liquid Glass adapts its tint and content treatment to the brightness of
whatever is behind it. `adaptiveTint` brings that to `<LiquidGlass>`: when `true`
the glass samples the luminance of its backdrop and automatically shifts toward a
**light** or **dark** treatment — the SAME tint / displacement / blur plumbing
`overLight` already drives — so foreground content (labels, captions) stays
legible without hand-tuning. A bright backdrop yields the light treatment with
dark ink; a dark backdrop yields the default treatment with light ink.

```tsx
// No overLight needed — the glass figures out light vs dark for you.
<LiquidGlass adaptiveTint>
  <span>Adapts to its backdrop</span>
</LiquidGlass>
```

It is **additive and opt-in**: `adaptiveTint` defaults to `false`, so the default
render is byte-for-byte unchanged and the luminance sampler is never loaded on the
default path.

**Precedence — `overLight` always wins.** `overLight` is the manual override;
`adaptiveTint` is the auto path. They never fight. When `overLight` is set
explicitly it short-circuits the auto path:

```ts
effectiveOverLight = overLight ?? (adaptiveTint && scheme ? scheme === 'light' : false)
```

**SSR / hydration-safe.** The server and the first client paint render the
default (unsampled) treatment, so hydration never mismatches; the sampled
treatment is applied in an effect after mount.

**Graceful degradation.** When the backdrop can't be sampled — a **cross-origin**
backdrop taints the canvas, there's no canvas, or it's SSR — the reading is
`sampled: false` and auto-tint silently falls back to `overLight ?? false`. No
error, no flicker loop, no `console.error`.

**Accessibility.** Under `(prefers-contrast: more)` the increased-contrast
treatment **wins**: auto-tint never undercuts the high-contrast surface or
legibility treatment.

> ⚠️ **Limitation.** Auto-tint is **best-effort legibility**. Critical text over
> unknown or cross-origin backdrops (which cannot be sampled) should be verified
> manually — the auto path falls back rather than guessing.

---

## Material variants: Regular vs Clear (`variant`)

Apple distinguishes two Liquid Glass materials, and `variant` lets you pick one
intentionally instead of hand-tuning opacity:

- **`regular`** (default) — the dependable, fully adaptive control surface. This
  is **exactly** today's behavior, including content-adaptive auto-tint when
  [`adaptiveTint`](#content-adaptive-auto-tint-adaptivetint) is on.
- **`clear`** — a permanently **more transparent** material for media-rich
  contexts (floating over a photo or video). It is **non-adaptive by
  definition**, with a subtle dimming scrim behind the content so labels stay
  legible over busy media.

```tsx
// Dependable control surface (default).
<LiquidGlass variant="regular">
  <span>Toolbar</span>
</LiquidGlass>

// Maximally transparent over media — clearer, with a legibility scrim.
<LiquidGlass variant="clear">
  <span>Over a photo</span>
</LiquidGlass>
```

It is **additive and non-breaking**: `variant` defaults to `'regular'`, so
omitting it keeps today's render byte-for-byte unchanged. It is a small parameter
lookup feeding the existing surface/content styles — not a theming system.

**Don't mix — Clear is non-adaptive.** Per Apple's guidance the two should never
be mixed in the same context. In `'clear'`:

- **`adaptiveTint` is a no-op** — Clear never samples the backdrop or flips its
  tint/ink. (Use `'regular'` + `adaptiveTint` for the adaptive material.)
- **`overLight` still nudges legibility**, but does NOT re-enable adaptivity.

**Accessibility wins in both variants.** Under `(prefers-contrast: more)` the
increased-contrast treatment (solid border, opaque fill, pinned saturation)
applies to Clear too — a11y beats the Clear aesthetic.

The prebuilt components (`GlassButton`, `GlassCard`, `GlassSegmentedControl`)
take `variant` through their `glassProps` escape hatch — no new per-component
prop:

```tsx
<GlassButton glassProps={{ variant: 'clear' }}>Over media</GlassButton>
```

---

## API reference

### `<LiquidGlass>` (primitive)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | Content rendered inside the glass surface. |
| `displacementScale` | `number` | `70` | Strength of the refraction distortion; higher bends the backdrop more. |
| `blurAmount` | `number` | `0.0625` | Backdrop blur radius (px) applied behind the glass. |
| `saturation` | `number` | `140` | Backdrop saturation multiplier (`1` = unchanged). |
| `aberrationIntensity` | `number` | `2` | Chromatic aberration (RGB separation) at refracted edges; `0` disables. |
| `elasticity` | `number` | `0.15` | Pointer-follow softness; `0` is rigid, higher is rubbery. |
| `cornerRadius` | `number \| string` | `999` | Corner radius. Number = px; string = CSS length (e.g. `'1rem'`, `'50%'`). |
| `padding` | `number \| string` | `'24px 32px'` | Inner padding. Number = px; string = CSS shorthand. |
| `overLight` | `boolean` | `false` | Hint that the glass sits over a light background; tunes tint/contrast. The manual override — always wins over `adaptiveTint`. |
| `adaptiveTint` | `boolean` | `false` | Opt into content-adaptive auto-tint: samples the backdrop and auto-shifts light/dark for legibility (see [Content-adaptive auto-tint](#content-adaptive-auto-tint-adaptivetint)). |
| `variant` | `'regular' \| 'clear'` | `'regular'` | Material variant. `regular` = today's fully adaptive surface; `clear` is permanently more transparent and non-adaptive (`adaptiveTint` is a no-op) with a dimming scrim (see [Material variants](#material-variants-regular-vs-clear-variant)). |
| `mode` | `DisplacementMode` | `'standard'` | Displacement algorithm (see [Displacement `mode`](#displacement-mode)). |
| `className` | `string` | — | Class name(s) on the outermost glass element. |
| `style` | `CSSProperties` | — | Inline styles merged onto the outermost element. |
| `onClick` | `MouseEventHandler<HTMLDivElement>` | — | Click handler forwarded to the surface. |
| `globalMousePos` | `MousePos` | uncontrolled | Externally controlled global pointer position (for coordinating many surfaces). |
| `mouseOffset` | `MousePos` | uncontrolled | Externally controlled pointer offset from the element center. |
| `mouseContainer` | `RefObject<HTMLElement \| null> \| HTMLElement \| null` | `null` (viewport) | Element whose bounds define the pointer-tracking coordinate space. |

### `<GlassButton>`

Extends native `<button>` attributes (`onClick`, `disabled`, `type`, `aria-*`,
`ref`, …) — all are forwarded.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'subtle'` | `'primary'` | Visual emphasis. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'icon'` | `'md'` | Sizing; `icon` is square for a single-icon child. |
| `asChild` | `boolean` | `false` | Render the single child element instead of a `<button>` (see [`asChild`](#the-aschild-polymorphism-pattern)). |
| `shine` | `boolean` | `true` | Brief highlight sweep on press. |
| `contentClassName` | `string` | — | Class on the isolated content layer (the span holding children). |
| `glassProps` | `Partial<Omit<LiquidGlassProps, 'children'>>` | — | Escape hatch: pass-through overrides to the underlying `<LiquidGlass>`. |

### `<GlassCard>`

Extends native `<div>` attributes (`ref`, `className`, `style`, `children`, …).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `elevation` | `'flat' \| 'raised' \| 'floating'` | `'raised'` | Ambient lift under the card. |
| `asChild` | `boolean` | `false` | Render the single child element instead of a `<div>`. |
| `contentClassName` | `string` | — | Class on the isolated content layer. |
| `glassProps` | `Partial<Omit<LiquidGlassProps, 'children'>>` | — | Pass-through overrides to the underlying `<LiquidGlass>`. |

### `<GlassSegmentedControl>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `options` | `GlassSegmentedOption[]` | — | Segments: `{ value, label?, icon?, disabled? }`. Icon-only options are supported. |
| `value` | `string` | — | Controlled selected value. When set, the control is controlled. |
| `defaultValue` | `string` | first option | Initial selected value when uncontrolled. |
| `onValueChange` | `(value: string) => void` | — | Fires on every user selection with the newly-selected value. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant. |
| `label` | `ReactNode` | — | Accessible group label (rendered into the `<legend>`). |
| `aria-label` | `string` | — | Accessible group label as a plain string (alternative to `label`). |
| `showLabel` | `boolean` | `false` | Render the `label` visually above the control instead of hiding it. |
| `name` | `string` | generated id | Stable `name` for the radio group. |
| `className` | `string` | — | Class on the root `<fieldset>`. |
| `style` | `CSSProperties` | — | Inline styles on the root `<fieldset>`. |
| `glassProps` | `Partial<Omit<LiquidGlassProps, 'children'>>` | — | Pass-through overrides to the indicator's `<LiquidGlass>`. |

### Also exported

- **Hooks** — `useGlassCapabilities`, `useReducedMotion`, `useMousePosition`.
- **Utilities** — `detectGlassCapabilities`, `getConservativeGlassCapabilities`,
  `getDisplacementMap`, `roundedRectSDF`, `smoothStep`,
  `calculateDirectionalScale`, `calculateElasticTranslation`,
  `getGlassEdgeShadow`, and the `GLASS_EDGE_LIGHT` / `GLASS_EDGE_DARK` constants.
- **Types** — `LiquidGlassProps`, `DisplacementMode`, `MousePos`,
  `GlassCapabilities`, `GlassButtonProps`, `GlassCardProps`,
  `GlassSegmentedControlProps`, `GlassSegmentedOption`, and the variant/size/
  elevation unions.
- **`VERSION`** — the package version string.

---

## Storybook

A live showcase (refraction, all five modes, the prebuilt components, and the
fallback tiers) runs in Storybook:

```bash
pnpm storybook          # dev server at http://localhost:6006
pnpm build-storybook    # static build into storybook-static/
```

The **Showcase** story is the headline demo: full refraction in Chromium, the
frosted fallback in Firefox/Safari.

---

## License

MIT — see [`LICENSE`](./LICENSE). The license includes an attribution note
acknowledging the technique's lineage while affirming this is an independent
reimplementation.
