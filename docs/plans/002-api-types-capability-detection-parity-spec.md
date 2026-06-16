---
id: 002
title: Public API types, capability detection, and parity spec
status: done
blocked-by: [001]
priority:
goal: liquid-glass-component-library
allows-migrations: false
needs-review: none
created: 2026-06-13
completed: 2026-06-16
reviewed: false
qa: automated
---

## Requirements

The whole library hinges on two contracts that must be defined ONCE, up front,
so every later plan builds against a stable surface: (1) the complete public
prop/type API for the `<LiquidGlass>` PRIMITIVE, plus the shared types and
conventions the prebuilt components extend (the `DisplacementMode` union, `MousePos`,
`GlassCapabilities`, and the controlled/uncontrolled convention). Each prebuilt
component's OWN full API is defined in its own plan — `GlassButton`/`GlassCard` in
007, `GlassSegmentedControl` in 012 — not frozen here (eng-review 2026-06-13, Codex
outside-voice: 002 fixes the primitive + shared surface, not every component's props).
And (2) a runtime capability-detection module that decides whether the Chromium-only
refraction effect can render. Without these, the refraction plan (004), the motion plan
(005), and the fallback plan (006) would each redefine the API and re-detect
capabilities incompatibly. This plan also writes the parity/non-goals spec that
keeps the non-forked reimplementation honest about what we match and what we
deliberately don't. The "user" is every subsequent plan's worker plus advanced
consumers importing types and the `useGlassCapabilities` hook.

**Acceptance criteria:**

- [ ] `src/types.ts` exports the COMPLETE `LiquidGlassProps` interface including:
      `children`, `displacementScale`, `blurAmount`, `saturation`,
      `aberrationIntensity`, `elasticity`, `cornerRadius`, `padding`,
      `overLight`, `mode` (`DisplacementMode` union of
      `'standard'|'polar'|'prominent'|'shader'|'turbulence'`), `className`, `style`,
      `onClick`, and the motion/tracking props `globalMousePos`, `mouseOffset`,
      `mouseContainer`. Each prop is documented with a TSDoc comment and (where
      applicable) a default noted.
- [ ] `src/capabilities.ts` exports `detectGlassCapabilities()` returning a typed
      `GlassCapabilities` object (`supportsBackdropFilter`, `isChromium`,
      `supportsSvgBackdropDisplacement`, `isFirefox`, `prefersReducedMotion`,
      `canRefract`) and is SSR-safe (no crash when `window`/`document`/`navigator`
      are undefined — returns conservative `false` defaults).
- [ ] A `useGlassCapabilities()` React hook re-evaluates capabilities on mount
      (client-only) and returns the current `GlassCapabilities`.
- [ ] Unit tests cover capability detection with mocked `CSS.supports`,
      `navigator.userAgent`, and `matchMedia`, including the SSR (no-window) path.
      Specifically (eng-review 2026-06-13): assert `isChromium`/`canRefract` are
      TRUE for Chrome AND Edge UAs (with backdrop-filter supported), and FALSE for
      Safari/WebKit and Firefox UAs — locking the positive-Blink gate so 010's
      per-engine expectations hold.
- [ ] `docs/PARITY.md` documents: supported props (mapped to upstream), expected
      full-effect behavior, expected degraded behavior per browser, and explicit
      non-goals (e.g. no WebGL, no pixel-perfect match to upstream).

## Design

Types and capabilities are the load-bearing contracts. `canRefract` is the single
gate later plans consult: `supportsBackdropFilter && supportsSvgBackdropDisplacement`,
where `supportsSvgBackdropDisplacement` is derived from POSITIVE Blink detection
(`isChromium`), not a negative `!isFirefox` exclusion (see the decision below).
Detection must never throw during SSR.

**Files expected to change:**

- `src/types.ts`: all public interfaces and unions; re-exported from `src/index.ts`.
- `src/capabilities.ts`: `detectGlassCapabilities()`, `GlassCapabilities` type,
  feature probes (`CSS.supports('backdrop-filter','blur(1px)')` OR
  `CSS.supports('-webkit-backdrop-filter','blur(1px)')` for
  `supportsBackdropFilter`; Firefox UA check for `isFirefox`; `matchMedia(
  '(prefers-reduced-motion: reduce)')` for `prefersReducedMotion`).
  **Decision (eng-review 2026-06-13) — `supportsSvgBackdropDisplacement` via POSITIVE
  Blink detection:** there is no standardized `CSS.supports` probe for "an SVG
  `feDisplacementMap` applied via `filter:` composites over `backdrop-filter`" (it is
  a Chromium rendering-pipeline quirk, not a CSS feature). A negative
  `supportsBackdropFilter && !isFirefox` inference is WRONG because Safari/WebKit
  supports `-webkit-backdrop-filter` and is not Firefox, so it would be admitted to
  the full-effect tier — but Safari does NOT composite the displacement filter and
  must degrade. Instead add `isChromium` (positive Blink-family detection:
  Chrome/Edge/Brave/Opera; explicitly NOT Firefox, NOT Safari/WebKit) and define
  `supportsSvgBackdropDisplacement = isChromium`. Therefore
  `canRefract = supportsBackdropFilter && isChromium`. This matches the
  "Chromium-only refraction" intent verbatim and makes 010's Firefox+WebKit
  "no filter applied" assertions pass by construction. Document this inference (and
  its UA-sniffing fragility) in `docs/PARITY.md` as a known, revisitable assumption.
- `src/use-glass-capabilities.ts`: client-only hook (useState + useEffect).
- `src/capabilities.test.ts`: mocked-environment unit tests incl. SSR path.
- `src/index.ts`: export types, `detectGlassCapabilities`, `useGlassCapabilities`.
- `docs/PARITY.md`: parity table + non-goals.

**Testing approach:** unit-only — pure detection logic and types; verified with
Vitest + mocked browser globals. No component rendering yet.

**Out of scope:** rendering anything, the SVG filter, displacement-map
generation, fallback markup, motion math. This plan only defines contracts and
detection. Do not implement `<LiquidGlass>` here.

## Tasks

1. Write `src/types.ts` with the full `LiquidGlassProps`, `DisplacementMode`,
   `MousePos`, and `GlassCapabilities` types, each with TSDoc + default notes.
2. Write `src/capabilities.ts`: SSR-guarded `detectGlassCapabilities()` deriving
   `canRefract` from the sub-probes.
3. Write `src/use-glass-capabilities.ts` hook (returns conservative defaults on
   first SSR render, real values after mount).
4. Write `src/capabilities.test.ts` mocking `CSS.supports`, `navigator.userAgent`,
   `matchMedia`, and the no-`window` SSR case.
5. Author `docs/PARITY.md` (supported props ↔ upstream, full vs degraded behavior
   per engine, non-goals).
6. Export the public surface from `src/index.ts`; run typecheck + tests.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm test -- capabilities`
- [assert] `pnpm test -- capabilities 2>&1 | tail -5` contains `pass`
- [cmd] `test -f docs/PARITY.md`
- [assert] `grep -q "Non-goals" docs/PARITY.md && echo found` outputs `found`
- [manual] Confirm `detectGlassCapabilities()` returns all-false (conservative) when `window` is undefined.

## Implementation Notes

Implemented the load-bearing contracts: complete public types (`LiquidGlassProps`,
`DisplacementMode`, `MousePos`, `GlassCapabilities`) with TSDoc + documented defaults;
an SSR-safe `detectGlassCapabilities()` using a POSITIVE Blink gate
(`canRefract = supportsBackdropFilter && isChromium`, never `!isFirefox`); a
`useGlassCapabilities()` hook (conservative-first-render then useEffect re-eval); Vitest
tests asserting Chrome/Edge are refraction-capable while Safari/Firefox are not, plus
SSR/partial-env guard paths; and `docs/PARITY.md` with the prop-parity table and an
explicit "Non-goals" section. Code review fixed 3 low-severity findings; health PASS
9.1, tests 9→11. No rendering/component/SVG work, as scoped. No deviations.

**Files changed:**

- `src/index.ts` (modified)
- `src/types.ts` (created)
- `src/capabilities.ts` (created)
- `src/use-glass-capabilities.ts` (created)
- `src/capabilities.test.ts` (created)
- `docs/PARITY.md` (created)

**Commit:** `ca26248` — feat(api): public types, SSR-safe capability detection, PARITY spec
