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

- **Frosted glass by default, everywhere** — a portable `backdrop-filter` surface
  (blur + saturate + inset-shadow glass edge + rim + elastic motion) that renders
  the same in Chrome, Safari/WebKit, and Firefox. This is the default look.
- **Opt-in live-backdrop refraction (`displacement`)** — Chromium-only SVG
  `feDisplacementMap` composited over the live backdrop via `backdrop-filter:
  url()`, plus chromatic aberration. Silently falls back to frosted on
  Firefox/Safari.
- **Opt-in cross-browser refraction (`refract` / `size` / `center`)** — applies
  the same SVG displacement as an element `filter: url()` on a *copy* of content,
  so a real refractive lens renders in Chrome, Safari **and** Firefox.
- **Web + Expo/React Native from one install** — the same `<LiquidGlass>` import
  resolves to a native (`expo-blur`) frosted build under Metro. iOS is the quality
  bar; Android is best-effort.
- **Identical box geometry across every tier** — degrading never shifts layout.
- **SSR-safe** — conservative capabilities until mount, no hydration mismatch.
- **Zero runtime dependencies.** React 18+ is a peer dependency; the Expo peer
  deps are optional and web consumers never install them.

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

## Web usage: frosted default, opt-in refraction

On the web the glass renders a **portable frosted surface by default** — the same
`backdrop-filter` blur/saturate look in Chrome, Safari/WebKit, and Firefox. No
props are required:

```tsx
import { LiquidGlass } from '@aberhamm/liquid-glass-react';

<LiquidGlass cornerRadius={24} padding="16px 24px">
  <span>Frosted by default — portable across engines</span>
</LiquidGlass>;
```

There are **two independent, opt-in ways** to add real refraction. They compose,
and both are off by default.

### `displacement` — bend the LIVE page (Chromium only)

`displacement` attaches the SVG `feDisplacementMap` as a `backdrop-filter: url()`,
so it warps the **live content behind** the glass. This only composites in
Chromium (Chrome, Edge, Brave, Opera); Firefox and Safari/WebKit **silently fall
back** to the frosted surface.

```tsx
// Chromium bends the real page behind the glass; other engines stay frosted.
<LiquidGlass displacement>
  <span>Live-backdrop refraction where supported</span>
</LiquidGlass>;
```

> **Upgrading from `0.1.x`?** Refraction used to be the default look. Add
> `displacement` to restore the old Chromium live-backdrop bend.

### `refract` / `size` / `center` — refract a COPY (cross-browser)

The cross-browser path applies the same SVG displacement as an **element**
`filter: url()` on a **copy** of content. Because it filters an element (not the
backdrop), a real refractive lens renders in Chrome, Safari **and** Firefox. Two
modes:

- **In-place** — pass `size` and/or `center` to refract a copy of the glass's own
  children, with the crisp children on top:

  ```tsx
  <LiquidGlass size={{ width: 320, height: 200 }} center={{ x: 0.5, y: 0.5 }}>
    <span>Refracts a copy of its own children — all engines</span>
  </LiquidGlass>;
  ```

- **Lens over foreign content** — pass `refract={node}` to float a lens over
  content the glass doesn't own; `behind` fills any bleed the copied node doesn't
  cover:

  ```tsx
  <LiquidGlass refract={<img src="/poster.jpg" alt="" />} behind="#0b0b0f">
    <span>Floats a refractive lens over the poster</span>
  </LiquidGlass>;
  ```

> **Which bends what?** `displacement` bends the **live page** behind the glass
> (Chromium only). `refract` / `size` / `center` refract a **copy** of content via
> an element filter (Chrome, Safari, **and** Firefox). They are distinct and
> compose. The refracted copy is decorative — `aria-hidden` + `inert` +
> `pointer-events: none` — so keep the copied subtree **purely presentational**
> (no `id`s, effects, focusable controls, or data fetching; it mounts twice).

---

## Expo / React Native

The **same `<LiquidGlass>` import** works in an Expo / React Native app. Metro
resolves the native build automatically via the package's `react-native` export
condition — there is no separate import path:

```tsx
import { LiquidGlass } from '@aberhamm/liquid-glass-react';
import { Text } from 'react-native';

export function Badge() {
  return (
    <LiquidGlass cornerRadius={24} padding={16} onPress={() => {}}>
      <Text style={{ color: 'white', fontWeight: '600' }}>Liquid glass</Text>
    </LiquidGlass>
  );
}
```

The native surface renders **frosted glass** — an `expo-blur` `BlurView` with a
tint and a gradient sheen. It is a genuinely different renderer from the web build,
so the web-only props are **documented no-ops** on native: `displacement`,
`refract`, `size`, `center`, `behind`, `saturation`, `variant`, `mode`,
`aberrationIntensity`, and the pointer/motion props. The native primitive uses
`onPress` (the web primitive uses `onClick`) and takes `style?: ViewStyle`.

> **iOS is the quality bar; Android is best-effort.** Android uses expo-blur's
> `experimentalBlurMethod` and degrades gracefully where blur support is limited.

### Optional peer deps

The Expo target needs two **optional** peer dependencies — `expo-blur` and
`expo-linear-gradient` — plus `react-native` (and `expo` itself), which your Expo
app already provides. They are marked `optional` in `peerDependenciesMeta`, so
**web-only consumers never install them**:

```bash
npx expo install expo-blur expo-linear-gradient
# react-native and expo come from your Expo app itself
```

The prebuilt `GlassButton`, `GlassCard`, and `GlassSegmentedControl` are
**web-only this round** — they are DOM components and are intentionally **not**
part of the native barrel (`src/index.native.ts`), so they won't resolve in a
native bundle. Use the `<LiquidGlass>` primitive on native.

---

## What works where

| Capability | Chrome / Edge | Safari / WebKit | Firefox | Expo (iOS) | Expo (Android) |
| --- | --- | --- | --- | --- | --- |
| **Frosted glass** (default) | ✅ | ✅ | ✅ | ✅ | ⚠️ best-effort |
| **`displacement`** (live-backdrop bend) | ✅ | frosted fallback | frosted fallback | no-op | no-op |
| **Cross-browser refraction** (`refract` / `size` / `center`) | ✅ | ✅ | ✅ | no-op | no-op |
| **Prebuilt** `GlassButton` / `GlassCard` / `GlassSegmentedControl` | ✅ | ✅ | ✅ | ❌ web-only | ❌ web-only |

Frosted is the portable default everywhere. `displacement` bends the live page and
is Chromium-only (frosted fallback elsewhere). The cross-browser `refract` path
renders a refractive copy in all three web engines. The prebuilt components are
web-only this round.

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

The **default** render is the portable frosted surface — identical in Chrome,
Safari/WebKit, and Firefox. The runtime `canRefract` gate
(`supportsBackdropFilter && supportsSvgBackdropDisplacement`, where the latter is
positive Blink-family detection) only decides what the **opt-in `displacement`**
prop does: whether the live-backdrop SVG bend composites, or degrades to frosted.
The cross-browser `refract` / `size` / `center` path does **not** depend on this
gate — it renders in every engine. All tiers share **identical box geometry**, so
moving between them causes **no layout shift**. See
[`docs/PARITY.md`](./docs/PARITY.md) for the full contract.

Behavior when `displacement` is requested:

| Engine | `canRefract` | With `displacement` | Default (no `displacement`) |
| --- | --- | --- | --- |
| **Chromium** (Chrome, Edge, Brave, Opera) | `true` | **Live-backdrop refraction** — SVG `feDisplacementMap` bends the live page behind the glass, over `backdrop-filter` blur/saturate, with chromatic aberration and elastic motion. | Frosted surface. |
| **Firefox** (Gecko) | `false` | **Frosted fallback** — `displacement` degrades silently; no live-backdrop bend. | Frosted surface. |
| **Safari / WebKit** | `false` | **Frosted fallback** — same as Firefox; WebKit does not composite the SVG displacement over the backdrop. | Frosted surface. |
| No `backdrop-filter` (very old engines) | `false` | **Solid translucent fallback** — scheme-aware `rgba(...)` fill so content stays legible; never a transparent box. | Solid translucent fallback. |
| **SSR / pre-mount** | `false` | **Conservative (frosted/degraded)** — all capabilities `false` until the client mount effect re-evaluates, avoiding hydration mismatch. | Conservative. |

The cross-browser `refract` / `size` / `center` path renders a refractive **copy**
in all of the above web engines regardless of `canRefract` (see
[Web usage](#refract--size--center--refract-a-copy-cross-browser)).

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

## Scroll-aware shadow (`scrollAwareShadow`)

Apple's Liquid Glass deepens a pinned bar's drop-shadow as content scrolls
beneath it — lifting it above the text — and eases it over solid backgrounds.
`scrollAwareShadow` brings that to `<LiquidGlass>`: when `true` the glass reuses
the **same** backdrop-luminance sampler as `adaptiveTint` and modulates **only**
its decoupled drop-shadow — **deeper and darker** over a dark/dense backdrop,
**shallower and lighter** over a light/solid one.

```tsx
// The drop-shadow tracks the backdrop as content scrolls beneath the bar.
<LiquidGlass scrollAwareShadow>
  <span>Pinned toolbar</span>
</LiquidGlass>
```

It is **additive and opt-in**: `scrollAwareShadow` defaults to `false`, so the
default render is byte-for-byte unchanged and the sampler is never loaded on the
default path. Only the shadow's **blur / offset / opacity** vary — it stays the
decoupled sibling behind the clipped surface (never a `box-shadow` on the clipped
node), so no clipping eats it and no new layer is added.

**SSR / hydration-safe.** The server and the first client paint render the
conservative static shadow; the modulated shadow is applied in an effect after
mount, so hydration never mismatches.

**Graceful degradation.** When the backdrop can't be sampled (cross-origin taint,
no canvas, SSR) the reading is `sampled: false` and the shadow falls back to the
static one — no error, no flicker loop, no `console.error`.

**Reduced motion.** Under `(prefers-reduced-motion: reduce)` the shadow **snaps**
between depths instead of animating (the `box-shadow` transition is dropped).

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
| `displacement` | `boolean` | `false` | Opt into live-backdrop SVG refraction (**Chromium only**; frosted fallback on Firefox/Safari). Bends the real page behind the glass via `backdrop-filter: url()`. No-op on native. |
| `displacementScale` | `number` | `70` | Strength of the refraction distortion; higher bends the backdrop more. |
| `blurAmount` | `number` | `0.0625` | Backdrop blur radius (px) applied behind the glass. |
| `saturation` | `number` | `140` | Backdrop saturation multiplier (`1` = unchanged). |
| `aberrationIntensity` | `number` | `2` | Chromatic aberration (RGB separation) at refracted edges; `0` disables. |
| `elasticity` | `number` | `0.15` | Pointer-follow softness; `0` is rigid, higher is rubbery. |
| `cornerRadius` | `number \| string` | `999` | Corner radius. Number = px; string = CSS length (e.g. `'1rem'`, `'50%'`). |
| `padding` | `number \| string` | `'24px 32px'` | Inner padding. Number = px; string = CSS shorthand. |
| `overLight` | `boolean` | `false` | Hint that the glass sits over a light background; tunes tint/contrast. The manual override — always wins over `adaptiveTint`. |
| `adaptiveTint` | `boolean` | `false` | Opt into content-adaptive auto-tint: samples the backdrop and auto-shifts light/dark for legibility (see [Content-adaptive auto-tint](#content-adaptive-auto-tint-adaptivetint)). |
| `scrollAwareShadow` | `boolean` | `false` | Opt in: the decoupled drop-shadow deepens/darkens over dark/dense backdrops and eases/lightens over light/solid ones, from the same backdrop sampler (see [Scroll-aware shadow](#scroll-aware-shadow-scrollawareshadow)). |
| `variant` | `'regular' \| 'clear'` | `'regular'` | Material variant. `regular` = today's fully adaptive surface; `clear` is permanently more transparent and non-adaptive (`adaptiveTint` is a no-op) with a dimming scrim (see [Material variants](#material-variants-regular-vs-clear-variant)). |
| `mode` | `DisplacementMode` | `'standard'` | Displacement algorithm (see [Displacement `mode`](#displacement-mode)). |
| `refract` | `ReactNode` | `undefined` | **Cross-browser** copy-refraction: floats a refracted lens rendering this node (Chrome, Safari, Firefox). The copy is `aria-hidden` + `inert` + `pointer-events:none` — keep it presentational. No-op on native. |
| `size` | `GlassSize` (`{ width: number; height: number }`) | measured | Explicit lens size in px. Setting it (with or without `refract`) opts into **in-place** cross-browser copy-refraction of the glass's own children. No-op on native. |
| `center` | `GlassCenter` (`{ x: number; y: number }`) | `{ x: 0.5, y: 0.5 }` | Lens focal point as fractions in `[0, 1]`; drives the refracted copy's `transform-origin`. Opts into in-place copy-refraction like `size`. No-op on native. |
| `behind` | `string` | `undefined` | CSS `background` painted behind the refracted copy to fill bleed (most useful with `refract`). No effect unless copy-refraction is active. No-op on native. |
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
- **Types** — `LiquidGlassProps`, `DisplacementMode`, `GlassVariant`,
  `GlassSize`, `GlassCenter`, `MousePos`, `GlassCapabilities`, `GlassButtonProps`,
  `GlassCardProps`, `GlassSegmentedControlProps`, `GlassSegmentedOption`, and the
  variant/size/elevation unions. The native barrel additionally exports
  `LiquidGlassCoreProps` (the platform-neutral base).
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
