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

- [ ] `<GlassButton>` renders a real `<button>` (or `role="button"`), forwards
      `onClick`, `disabled`, `type`, `aria-*`, and `ref`; supports `variant`
      (`'primary'|'secondary'|'subtle'`) and `size` (`'sm'|'md'|'lg'`) mapping to
      tuned `LiquidGlass` props; keyboard-focusable with a visible focus ring.
- [ ] `<GlassCard>` renders a container with sensible padding/cornerRadius
      defaults, accepts `children`, `className`, `style`, and an optional
      `as`/`elevation` knob; forwards `ref`.
- [ ] Both expose an escape hatch to override the underlying `LiquidGlass` props
      (e.g. `glassProps` or direct pass-through of known props).
- [ ] Both are exported from `src/index.ts` with their prop types.
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
mapping to `displacementScale`/`blurAmount`/`saturation`/`cornerRadius`/`padding`.
Accessibility is first-class: `GlassButton` must be operable by keyboard and
screen reader; the glass layers are decorative (`aria-hidden`). Concrete defaults
to remove ambiguity (design review may refine): `GlassButton` focus ring uses
`:focus-visible` with a `2px` offset outline tuned for legibility on a
translucent surface (not a removed/`outline:none` ring). `GlassCard`'s `as` prop
is typed `React.ElementType` defaulting to `'div'`; it stays presentational
(no implicit interactive semantics), and if `as` is set to an interactive element
the consumer owns the resulting a11y.

**Files expected to change:**

- `src/glass-button.tsx`: `<GlassButton>` + `GlassButtonProps`, `forwardRef`.
- `src/glass-card.tsx`: `<GlassCard>` + `GlassCardProps`, `forwardRef`.
- `src/glass-button.test.tsx`, `src/glass-card.test.tsx`: RTL semantics/variant/
  ref/console-error tests under mocked capabilities.
- `src/index.ts`: export both + their types.
- `src/types.ts`: add `GlassButtonProps`/`GlassCardProps` if co-located there.

**Testing approach:** browser-based — user-facing components; semantics/props
verified via Vitest + RTL now, visual/interaction verified in Storybook (009) and
Playwright (010).

**Out of scope:** Storybook stories (009), Playwright (010), additional components
beyond Button and Card, theming systems. Keep the API small and composable.

## Tasks

1. Implement `<GlassButton>` (semantic button, variant/size tables, focus ring,
   disabled handling, ref forwarding, aria-hidden glass layers).
2. Implement `<GlassCard>` (defaults, `as`/`elevation`, children, ref forwarding).
3. Add the `glassProps` escape hatch to both.
4. Export both + types from `src/index.ts`.
5. Write `src/glass-button.test.tsx` and `src/glass-card.test.tsx` (semantics,
   variants, ref, click/disabled, console-error spy under full + fallback caps).
6. Run typecheck/lint/test.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- glass-button`
- [cmd] `pnpm test -- glass-card`
- [assert] `pnpm test 2>&1 | tail -6` contains `pass`
- [manual] Tab to a GlassButton and activate with Enter/Space; confirm visible focus ring and that disabled blocks activation.
