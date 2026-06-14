---
id: 005
title: Elastic motion, rim lighting, and mouse tracking
status: pending
blocked-by: [004]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
---

## Requirements

The "liquid" feel and the glowing rim are what sell the effect, and crucially
they are pure CSS transforms + blend layers — they work in EVERY browser,
independent of the Chromium-only refraction. This plan adds: cursor tracking
(internal, or via `mouseContainer`/`globalMousePos`/`mouseOffset` overrides), an
elastic stretch-and-translate toward the cursor, and rim-lighting highlight/border
layers whose gradient angle responds to mouse offset. The "user" moves their
cursor near a `<LiquidGlass>` and watches it subtly stretch toward the pointer and
its edges catch light — in Chrome, Firefox, and Safari alike.

**Acceptance criteria:**

- [ ] `src/use-reduced-motion.ts` exports a `useReducedMotion()` hook (eng-review
      2026-06-13): the SINGLE live source of reduced-motion state — `matchMedia(
      '(prefers-reduced-motion: reduce)')` plus a `'change'` listener so it reacts
      when the user toggles the OS setting mid-session, SSR-safe (conservative
      `false`/no-motion default before mount). `useMousePosition` (005), the fallback
      path (006), and the segmented control (012) consume THIS hook; `capabilities.ts`
      (002) may surface its value but the live hook is authoritative. No path calls
      `matchMedia('prefers-reduced-motion')` independently.
- [ ] `src/use-mouse-position.ts` exports a `useMousePosition(container?)` hook
      tracking pointer position relative to an element center, respecting a
      `globalMousePos`/`mouseOffset` override and `useReducedMotion()` (no motion
      when reduced-motion is set).
- [ ] `calculateDirectionalScale()` and `calculateElasticTranslation()` pure
      functions implement the stretch/translate math (clamped, fade-in with
      distance, scaled by `elasticity`); `elasticity: 0` ⇒ no motion.
- [ ] `<LiquidGlass>` applies the resulting `transform` (scale + translate) and
      renders two highlight/border `<span>` layers using `mix-blend-mode`
      (screen/overlay) with a gradient whose angle tracks `mouseOffset.x`.
- [ ] A pure-CSS glass edge: a layered `box-shadow` stack (multiple `inset`
      highlights + soft outer shadow) renders a convincing beveled rim with NO SVG
      and NO blend dependency, so it works in every browser. Provide a light-mode
      and dark-mode variant (dark flips the inset highlight direction/color), keyed
      off `prefers-color-scheme` or an explicit prop. This is the load-bearing
      cross-browser polish (and the backbone of 006's fallback).
- [ ] The drop-shadow / glow is a SEPARATE sibling element rendered behind the
      glass surface, NOT a `box-shadow` on the glass node itself. The glass surface
      uses `overflow: hidden` + the backdrop clip, which clips a same-element
      box-shadow; a decoupled sibling shadow can blur/offset/animate freely without
      being clipped. (The inset-shadow EDGE above is the rim bevel; this is the
      outer drop shadow — they are different layers and both stay off the clipped
      node where clipping would break them.)
- [ ] Touch-aware: detect touch devices (`'ontouchstart' in window ||
      navigator.maxTouchPoints > 0`) and disable hover-only treatments + the
      cursor-follow elastic motion on touch (no hover state to chase). SSR-safe.
- [ ] Hover and active (`onClick` present) states add the press/highlight
      treatment without breaking layout.
- [ ] The motion layers, inset-shadow rim, and gradient highlights render
      regardless of `canRefract` (cross-browser), and respect `mouseContainer`
      when provided.
- [ ] Unit tests cover the scale/translate math (boundary, zero-elasticity,
      clamping) and that the hook returns neutral values under reduced-motion / SSR.
- [ ] A render test asserts the decoupled drop-shadow element is a SIBLING of (not
      a descendant of) the `overflow:hidden` clipped glass surface (eng-review
      2026-06-13) — mirroring 004's content-isolation test. This guards the
      structural property that makes the shadow render at all (a same-node
      box-shadow would be clipped away).

## Design

Mouse math mirrors the upstream behavior but is reimplemented: an activation zone
near the element, directional scale `scaleX = 1 + |nx|*stretch*0.3 -
|ny|*stretch*0.15` (symmetric for Y) with `stretch = min(centerDist/300,1) *
elasticity * fadeIn`, clamped `>= 0.8`; translation nudges by `(mouse-center) *
elasticity * 0.1 * fadeIn`. Rim layers use blend modes and a rotating gradient.

**Files expected to change:**

- `src/use-reduced-motion.ts`: the single live `useReducedMotion()` hook
  (matchMedia + change listener, SSR-safe) consumed by 002/005/006/012.
- `src/use-mouse-position.ts`: tracking hook + override handling + consumes
  `useReducedMotion()` + touch-device detection (disables follow on touch, SSR-safe).
- `src/motion.ts`: pure `calculateDirectionalScale`, `calculateElasticTranslation`.
- `src/glass-edge.ts`: the layered inset-shadow `box-shadow` strings for
  light/dark, exported as named constants (and/or CSS custom properties) from THIS
  exact path so 006's fallback, 007's stylesheet, and 012's control reuse the same
  edge treatment (DRY — one source of truth for the bevel; consumers import it, they
  do not hardcode the shadow string).
- `src/liquid-glass.tsx`: consume the hook, apply transform, render highlight/border
  layers + the inset-shadow edge, the decoupled sibling drop-shadow element, and
  hover/active states.
- `src/motion.test.ts`: math unit tests.
- `src/use-mouse-position.test.ts`: hook tests (override, reduced-motion, SSR).

**Testing approach:** browser-based — interactive motion on a React component;
math + hook verified via Vitest now, real pointer interaction verified in
Storybook (009) and Playwright (010). jsdom does not compute layout or paint, so
unit tests assert the **inline `style` prop values** the component writes (the
`transform` string and the gradient `background` angle) after dispatching
synthetic pointer events — never the painted/computed result, which would pass
vacuously.

**Out of scope:** the refraction filter (004, already done); the unsupported-browser
fallback decision logic (006 decides what renders when `canRefract` is false — this
plan just guarantees the motion/rim layers themselves are cross-browser); prebuilt
components (007).

## Tasks

1. Implement `src/motion.ts` pure math with TSDoc and clamps.
2. Implement `useMousePosition(container?)` honoring overrides, `mouseContainer`,
   reduced-motion, and SSR (neutral defaults).
3. Wire the hook + math into `<LiquidGlass>`: apply `transform`, add highlight and
   border `<span>` layers with blend modes + mouse-tracking gradient angle.
4. Add hover/active (press) states gated on `onClick`.
5. Write `src/motion.test.ts` and `src/use-mouse-position.test.ts`.
6. Run typecheck/lint/test.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- motion`
- [cmd] `pnpm test -- use-mouse-position`
- [assert] `pnpm test 2>&1 | tail -5` contains `pass`
- [manual] In any browser, moving the cursor near the glass stretches it toward the pointer; reduced-motion disables it.
