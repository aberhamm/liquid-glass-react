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

- [ ] `src/use-mouse-position.ts` exports a `useMousePosition(container?)` hook
      tracking pointer position relative to an element center, respecting a
      `globalMousePos`/`mouseOffset` override and `prefersReducedMotion` (no motion
      when reduced-motion is set).
- [ ] `calculateDirectionalScale()` and `calculateElasticTranslation()` pure
      functions implement the stretch/translate math (clamped, fade-in with
      distance, scaled by `elasticity`); `elasticity: 0` ⇒ no motion.
- [ ] `<LiquidGlass>` applies the resulting `transform` (scale + translate) and
      renders two highlight/border `<span>` layers using `mix-blend-mode`
      (screen/overlay) with a gradient whose angle tracks `mouseOffset.x`.
- [ ] Hover and active (`onClick` present) states add the press/highlight
      treatment without breaking layout.
- [ ] The motion layers and rim lighting render regardless of `canRefract`
      (cross-browser), and respect `mouseContainer` when provided.
- [ ] Unit tests cover the scale/translate math (boundary, zero-elasticity,
      clamping) and that the hook returns neutral values under reduced-motion / SSR.

## Design

Mouse math mirrors the upstream behavior but is reimplemented: an activation zone
near the element, directional scale `scaleX = 1 + |nx|*stretch*0.3 -
|ny|*stretch*0.15` (symmetric for Y) with `stretch = min(centerDist/300,1) *
elasticity * fadeIn`, clamped `>= 0.8`; translation nudges by `(mouse-center) *
elasticity * 0.1 * fadeIn`. Rim layers use blend modes and a rotating gradient.

**Files expected to change:**

- `src/use-mouse-position.ts`: tracking hook + override handling + reduced-motion.
- `src/motion.ts`: pure `calculateDirectionalScale`, `calculateElasticTranslation`.
- `src/liquid-glass.tsx`: consume the hook, apply transform, render highlight/border
  layers, hover/active states.
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
