---
id: 016
title: Pointer-tracked specular hotspot and glow-on-press
status: done
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
completed: 2026-06-17
reviewed: false
qa: automated
---

## Requirements

Apple's Liquid Glass has specular highlights that respond to a light source and
geometry; the best web demos position a highlight hotspot that tracks the
pointer and an inner glow that "illuminates from within" on press. Our rim is
currently a `linear-gradient` whose ANGLE tracks the cursor's horizontal offset
only — a weak approximation. This plan upgrades the highlight to a positioned
radial specular hotspot that follows the actual pointer position over the glass,
plus a glow-from-within on press that originates at the click point. The "user"
moves their cursor across a `<LiquidGlass>` and sees a bright highlight track
under the pointer, and on press sees light bloom outward from the contact point
— in every browser (pure CSS, independent of refraction).

ADDITIVE and non-breaking: enhances existing highlight layers; defaults produce
a strictly better-but-equivalent resting state. Gated on the existing
`useReducedMotion` (NO dependency on the a11y plans).

**Acceptance criteria:**

- [ ] The rim/highlight layer in `<LiquidGlass>` is upgraded from an angle-only
      linear gradient to a POSITIONED `radial-gradient` specular hotspot whose
      center tracks the pointer's position over the element (derived from the
      existing `useMousePosition`/offset data). When the pointer is absent
      (rest), it falls back to a neutral, top-biased highlight (so the resting
      appearance is sensible and stable).
- [ ] A glow-from-within on press: when the element is pressed (pointerdown /
      `:active`, or activation for interactive uses), an inner radial glow
      originates at the contact point and spreads outward, then fades. Use the
      existing pointer position for the origin where available.
- [ ] Both effects are pure CSS (transform/gradient/opacity) and render in all
      engines regardless of `canRefract` — they are polish, not refraction.
- [ ] Both effects are GATED on `useReducedMotion`: when reduced-motion is set,
      the hotspot is static (neutral highlight, no pointer tracking) and the
      press glow does not animate (snap or omit).
- [ ] The new layers stay decorative: `aria-hidden`, never intercept pointer
      events (`pointer-events: none`), never affect layout/geometry, and keep
      content legible.
- [ ] Prebuilt components inherit the upgrade through the primitive; `GlassButton`'s
      existing `shine`-on-press still works (reconcile with the new glow — they
      should compose, not conflict; document the relationship).
- [ ] Unit tests assert the specular layer's inline `background`/position style
      UPDATES after a synthetic pointer move (assert the written style differs,
      jsdom-style), the press glow appears on pointerdown, and reduced-motion
      (mocked) yields the static/no-animation path. `console.error` spy silent.
- [ ] Cross-engine Playwright: pointer move over the glass changes the specular
      highlight's inline style/position in at least chromium + firefox; no
      console errors.
- [ ] The Showcase render changes (resting highlight differs), so REGENERATE +
      COMMIT the Chromium pixel baseline so `pnpm e2e` stays green on darwin.
- [ ] This plan OWNS its own story: a `Specular` story (over a real photo from
      015 if available, else a backdrop) demonstrating the pointer-tracked
      highlight + press glow.

## Design

Reuse `useMousePosition` (already provides pointer offset relative to the
element center and an active flag) to drive a CSS custom property pair
(`--lg-spec-x`/`--lg-spec-y`) on the highlight layer, consumed by a
`radial-gradient(circle at var(--lg-spec-x) var(--lg-spec-y), ...)`. The press
glow is a second radial layer toggled on pointerdown with a transition (gated on
reduced-motion). Keep the layered inset bevel (`glass-edge.ts`) and the existing
border layer; this plan replaces the linear highlight gradient, not the bevel.

**Files expected to change:**

- `src/liquid-glass.tsx`: replace the angle-only highlight with a
  pointer-positioned radial specular layer; add the press-glow layer; gate both
  on `useReducedMotion`.
- `src/components.css` (if any shared classes/vars help; keep DRY).
- `src/liquid-glass.test.tsx`: specular-updates-on-move, press-glow, reduced-motion.
- `src/liquid-glass.stories.tsx`: a `Specular` story (owned here).
- `e2e/interaction.spec.ts`: specular-position-changes-on-pointer-move (chromium+firefox).
- `e2e/refraction.spec.ts-snapshots/showcase-glass-chromium-chromium-darwin.png`:
  regenerated baseline.

**Out of scope:** the WebKit elastic-motion E2E (plan 020), adaptive tint (018),
the a11y branches (013/014), changing the elastic stretch/translate math (005).
Do not couple to `prefers-reduced-transparency`.

**Testing approach:** browser-based — interactive highlight; unit asserts the
written inline styles after synthetic pointer events (jsdom can't paint), real
pointer behavior via Playwright.

## Tasks

1. Drive `--lg-spec-x/y` from `useMousePosition` and render a radial specular
   hotspot layer (with a sensible rest fallback).
2. Add the press-glow radial layer toggled on pointerdown, gated on reduced-motion.
3. Reconcile with `GlassButton`'s `shine` so they compose; keep all decorative
   layers `aria-hidden` + `pointer-events:none`.
4. Add unit tests (move updates style, press glow, reduced-motion static path).
5. Add the `Specular` story and extend `e2e/interaction.spec.ts` (chromium+firefox).
6. Regenerate + commit the Chromium Showcase pixel baseline; run the suite green.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test 2>&1 | tail -6` contains `pass`
- [cmd] `pnpm e2e -- interaction`
- [assert] `pnpm e2e -- interaction 2>&1 | tail -15` contains `passed`
- [cmd] `pnpm e2e -- refraction` (passes with regenerated baseline)
- [browse] start `pnpm storybook`, open the Specular story, move the cursor across the glass and confirm the highlight tracks the pointer and a press blooms a glow; no console errors; stop the server
- [manual] The specular hotspot looks like light on glass, not a flat gradient sweep.

## Implementation Notes

Replaced the angle-only linear-gradient highlight with a positioned
`radial-gradient` specular hotspot driven by `--lg-spec-x`/`--lg-spec-y` CSS
custom props computed from `useMousePosition` (neutral top-biased `50%/0%`
fallback at rest), and added a `[data-lg-press-glow]` radial layer that blooms
from the contact point on pointerdown and fades via an opacity transition. Both
are pure-CSS decorative siblings (`aria-hidden`, `pointer-events:none`,
screen-blended), render in every engine regardless of `canRefract`, and gate on
`useReducedMotion` (static hotspot + no animated bloom). GlassButton `shine`
reconciliation: its diagonal `::after` sweep lives on the button element inside
the content layer while the press-glow is a surface-side sibling behind content,
so they compose on different nodes/layers (documented in a code comment). Added
8 unit tests, a cross-engine Playwright interaction spec (chromium+firefox), and
a `Specular` story over the 015 real photo. `[browse]` ran via gstack: hotspot
tracked (`50%|0%`→`25%|25%`), press glow opacity 0→1→0, zero console errors.

**Note:** the Chromium pixel baseline was re-run with `--update-snapshots` but
came out byte-identical (resting-highlight change is within the 3% diff
tolerance), so the committed PNG is unchanged and still passes — no baseline
commit needed. Also added `.gstack/` to `.gitignore` (browse-tooling artifact,
consistent with the existing `.mstack/` ignore).

**Files changed:**

- `src/liquid-glass.tsx` (modified)
- `src/liquid-glass.test.tsx` (modified)
- `src/liquid-glass.stories.tsx` (modified)
- `e2e/interaction.spec.ts` (modified)
- `.gitignore` (modified)

**Commit:** `8b200b7` — `feat(liquid-glass): pointer-tracked specular hotspot + press glow`
