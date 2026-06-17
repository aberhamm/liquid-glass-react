---
id: 021
title: Scroll-aware shadow (optional polish)
status: in-progress
blocked-by: [017]
priority: 90
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

OPTIONAL, lowest-priority polish. Apple's Liquid Glass deepens the glass's drop
shadow as content scrolls beneath it (lifting it above text) and lightens it over
solid backgrounds — reinforcing the "floating above content" read. Reusing the
luminance infrastructure (017), the decoupled drop-shadow can modulate its
depth/darkness based on the backdrop behind the element. The "user" scrolls a
page with a pinned glass bar and sees its shadow subtly deepen over dense content
and ease over plain areas.

ADDITIVE, opt-in, non-breaking. Explicitly lowest priority (`priority: 90`) — it
rides 017's sampling infra and is fine to defer or drop without affecting the
rest of the round.

**Acceptance criteria:**

- [ ] `<LiquidGlass>` gains an opt-in `scrollAwareShadow?: boolean` (default
      `false`) that, when enabled, modulates the existing decoupled
      `[data-lg-shadow]` sibling element's depth/darkness from the
      `useBackdropLuminance` reading (darker/deeper over dark/dense backdrops,
      lighter over light/solid ones).
- [ ] Default OFF ⇒ default rendering and the committed Showcase pixel baseline
      are unchanged.
- [ ] The shadow stays a SIBLING of the clipped glass surface (never a box-shadow
      on the `overflow:hidden` node — preserve the 005 layering invariant); only
      its blur/offset/opacity vary.
- [ ] Gated on `useReducedMotion` (no animated shadow transitions under reduced
      motion — snap or static) and degrades when `sampled:false` (falls back to
      the current static shadow, no error).
- [ ] SSR-safe: conservative static shadow on server/first paint; modulation in
      an effect after mount (no hydration mismatch — a console-error-spy assertion).
- [ ] Unit tests: enabled+scheme→shadow-style mapping (mock the luminance hook),
      sampled:false fallback, reduced-motion static path, default-off no-op,
      console-error spy silent.
- [ ] OWNS a brief story (or extends ScrollUnderGlass from 015) showing the
      shadow responding to backdrop content.
- [ ] `docs/PARITY.md`/`README.md` note the opt-in `scrollAwareShadow`.

## Design

Thin consumer of 017: read `scheme`/`luminance` and map to the existing
drop-shadow style on `[data-lg-shadow]`. No new layer — modulate the existing
one. Keep modulation in an effect (post-mount) for SSR safety; throttle via the
hook. Reuse reduced-motion gating. Strictly additive and behind the new prop.

**Files expected to change:**

- `src/types.ts`: add `scrollAwareShadow?: boolean` (TSDoc).
- `src/liquid-glass.tsx`: modulate `[data-lg-shadow]` style from luminance when
  enabled; SSR-safe; reduced-motion + sampled:false fallbacks.
- `src/liquid-glass.test.tsx`: mapping, fallback, reduced-motion, default-off.
- `src/liquid-glass.stories.tsx` (or extend ScrollUnderGlass): a short demo.
- `docs/PARITY.md`, `README.md`: note the prop.

**Out of scope:** the sampling infra (017), adaptive tint (018), variants (019),
changing default rendering. Do not move the shadow onto the clipped node.

**Testing approach:** browser-based — a rendering polish; unit/RTL/jsdom with the
luminance hook mocked.

## Tasks

1. Add `scrollAwareShadow` to `LiquidGlassProps` (TSDoc).
2. Modulate the `[data-lg-shadow]` sibling style from `useBackdropLuminance` when
   enabled (effect-driven, throttled, reduced-motion-gated, sampled:false fallback).
3. Add unit tests (mapping, fallback, reduced-motion, default-off no-op, hydration).
4. Add/extend a story; update `docs/PARITY.md` + `README.md`. Run the gate.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test -- liquid-glass 2>&1 | tail -8` contains `pass`
- [cmd] `pnpm build-storybook`
- [cmd] `pnpm e2e -- refraction` (default-off ⇒ baseline still passes)
- [manual] With `scrollAwareShadow`, the shadow visibly deepens over dense content and eases over solid areas; default-off is unchanged.
