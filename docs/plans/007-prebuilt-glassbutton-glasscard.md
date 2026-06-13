---
id: 007
title: Prebuilt GlassButton and GlassCard components
status: pending
blocked-by: [006]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

A "component library" needs more than one primitive. This plan ships two
batteries-included components built on `<LiquidGlass>`: `<GlassButton>` and
`<GlassCard>`, each with sensible defaults, variants, and proper semantics so a
consumer gets a polished result without tuning a dozen props. The "user" writes
`<GlassButton variant="primary" onClick={...}>Subscribe</GlassButton>` or
`<GlassCard>…</GlassCard>` and gets an accessible, good-looking glass element that
inherits all the cross-browser behavior from 004–006.

**Acceptance criteria:**

- [ ] `<GlassButton>` renders a real `<button>` by default, forwards `onClick`,
      `disabled`, `type`, `aria-*`, and `ref`; supports `variant`
      (`'primary'|'secondary'|'subtle'`) and `size`
      (`'sm'|'md'|'lg'|'icon'` — `icon` is square and centers a single icon child);
      maps to tuned `LiquidGlass` props; keyboard-focusable with a visible focus
      ring; and an optional `shine` (default on) that sweeps a brief highlight on
      press. A `contentClassName` prop styles the isolated content layer (the span
      holding `children`) independently of the wrapper.
- [ ] Both components support `asChild` (polymorphic composition): when
      `asChild` is set, the component renders its single child element and merges
      its own props/className/ref onto it (so `<GlassButton asChild><a
      href="…">…</a></GlassButton>` yields a real anchor with glass styling). This
      is implemented with a small INTERNAL slot helper (clone-element + prop/ref
      merge), NOT a dependency on `@radix-ui/react-slot`.
- [ ] `<GlassCard>` renders a container (a `<div>` by default, or its child via
      `asChild`) with sensible padding/cornerRadius defaults, accepts `children`,
      `className`, `style`, and an optional `elevation` knob; forwards `ref`.
- [ ] Both expose an escape hatch to override the underlying `LiquidGlass` props
      (e.g. `glassProps` or direct pass-through of known props).
- [ ] Variants/sizes are resolved by a tiny STANDALONE variant helper (a
      ~15-line `cva`-style function that maps variant/size keys to class names),
      not the `class-variance-authority` package, and the components ship their
      OWN CSS (a stylesheet or CSS-in-JS the consumer imports) so they render
      correctly with ZERO Tailwind/design-token assumptions in the host app.
- [ ] Both are exported from `src/index.ts` with their prop types; the stylesheet
      (if a separate file) is exported via a documented import path / package
      `exports` subpath.
- [ ] Render tests assert semantics (button is a button, click fires, disabled
      blocks click), variant/size prop mapping, ref forwarding, and that they
      render without console errors under both full and fallback capabilities.
- [ ] Content legibility on glass: each component sets a default foreground
      treatment (text color / subtle text-shadow or scrim) that keeps `children`
      readable over a light OR dark backdrop, and the stories include a
      light-background and dark-background case so contrast is visually checked
      (target WCAG AA for body text where feasible).

## Design

Thin, opinionated wrappers over `<LiquidGlass>`. Variants/sizes are lookup tables
mapping to `displacementScale`/`blurAmount`/`saturation`/`cornerRadius`/`padding`
and to class names from the components' own stylesheet. Accessibility is
first-class: `GlassButton` must be operable by keyboard and screen reader; the
glass layers are decorative (`aria-hidden`). Concrete defaults: `GlassButton`
focus ring uses `:focus-visible` with a `2px` offset outline tuned for legibility
on a translucent surface (not a removed/`outline:none` ring).

**Controlled/uncontrolled contract.** Any stateful surface these components expose
(and the convention every interactive component in this library follows) supports
both controlled and uncontrolled use: a `value`/`defaultValue` pair with an
`onValueChange` (or equivalently-named) callback, falling back to internal state
when uncontrolled. GlassButton itself is mostly stateless, but lock the convention
here so the segmented control (012) and future components stay consistent.

**Polymorphism via `asChild` (internal Slot), not Radix.** Inspired by the
shadcn/Radix `asChild` ergonomics, but we ship our own ~15-line `Slot` that
`React.cloneElement`s the single child and merges className, style, event
handlers, and ref. This keeps the polymorphic API without adding
`@radix-ui/react-slot` as a dependency. (React-version note: under React 18,
`cloneElement` forwards `ref` normally; under React 19, `ref` is a regular prop —
merge it onto the child's props rather than relying on `cloneElement` ref
forwarding. Detect from the installed React version; the library peer-deps
`react >=18`.) The shared inset-shadow edge from 005 is consumed via
`src/glass-edge.ts`'s exported CSS custom properties referenced in the stylesheet
(single source of truth — never re-hardcode the box-shadow values here). `asChild` replaces the earlier plain `as`
prop idea (Slot is strictly more capable). Document that with `asChild` the
consumer's child element owns its own semantics/a11y.

**Standalone variants + own CSS, NOT Tailwind.** A tiny internal variant resolver
(give it the `cva` shape — base + variants + defaultVariants — in ~15 lines)
returns class names; the components ship a real stylesheet so they look correct in
ANY React app. We deliberately do NOT depend on `class-variance-authority`,
`clsx`/`tailwind-merge`, or Tailwind utility classes — the library stays zero-dep
and framework-agnostic (the whole point of not being a shadcn add-on).

**Files expected to change:**

- `src/slot.tsx`: internal `Slot` helper (clone-element + className/style/handler/
  ref merge) powering `asChild`. Not exported as public API (or exported minimally).
- `src/variants.ts`: the ~15-line standalone `cva`-style variant resolver.
- `src/components.css` (or CSS-in-JS): the shipped stylesheet for button/card
  variants, sizes, focus ring, and shine; reuses the inset-shadow edge from 005.
- `src/glass-button.tsx`: `<GlassButton>` + `GlassButtonProps`, `forwardRef`,
  `asChild`, `shine`.
- `src/glass-card.tsx`: `<GlassCard>` + `GlassCardProps`, `forwardRef`, `asChild`.
- `src/glass-button.test.tsx`, `src/glass-card.test.tsx`: RTL semantics/variant/
  ref/`asChild`/console-error tests under mocked capabilities.
- `src/index.ts`: export both + their types; expose the stylesheet path.
- `src/types.ts`: add `GlassButtonProps`/`GlassCardProps` if co-located there.
- `package.json`: add a `./styles.css` (or similar) `exports` subpath for the CSS.

**Testing approach:** browser-based — user-facing components; semantics/props
verified via Vitest + RTL now, visual/interaction verified in Storybook (009) and
Playwright (010).

**Out of scope:** Storybook stories (009), Playwright (010), additional components
beyond Button and Card, theming systems. Keep the API small and composable.

## Tasks

1. Implement the internal `Slot` (`src/slot.tsx`) and the standalone variant
   resolver (`src/variants.ts`); write the components' stylesheet.
2. Implement `<GlassButton>` (semantic button, `asChild`, variant/size incl.
   `icon`, `contentClassName` on the isolated content layer, focus ring,
   shine-on-press, disabled handling, ref forwarding, aria-hidden glass).
3. Implement `<GlassCard>` (defaults, `asChild`, `elevation`, children, ref).
4. Add the `glassProps` escape hatch to both.
5. Export both + types from `src/index.ts`; add the CSS `exports` subpath.
6. Write `src/glass-button.test.tsx` and `src/glass-card.test.tsx` (semantics,
   `asChild` polymorphism + ref/handler merge, variants, click/disabled,
   console-error spy under full + fallback caps).
7. Run typecheck/lint/test.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- glass-button`
- [cmd] `pnpm test -- glass-card`
- [assert] `pnpm test 2>&1 | tail -6` contains `pass`
- [manual] Tab to a GlassButton and activate with Enter/Space; confirm visible focus ring and that disabled blocks activation.
