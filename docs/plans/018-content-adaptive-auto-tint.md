---
id: 018
title: Content-adaptive auto-tint (adaptiveTint, auto light/dark)
status: pending
blocked-by: [014, 017]
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

This is the headline differentiator: glass that adapts its tint and content
treatment to the brightness of what's behind it (Apple's core Liquid Glass
behavior; absent from every React implementation). Building on the luminance
infrastructure (017), `<LiquidGlass>` gains an opt-in `adaptiveTint` that samples
the backdrop and automatically shifts toward a light or dark treatment so content
stays legible — replacing the need to hand-set `overLight`. The "user" places a
glass card over a backdrop that is bright in one area and dark in another and the
glass keeps its label readable in both without manual tuning.

ADDITIVE and OPT-IN: `adaptiveTint` defaults OFF, so default rendering is
byte-for-byte unchanged. `overLight` remains and TAKES PRECEDENCE when explicitly
set (documented rule). Must be SSR/hydration-safe and degrade when the backdrop
can't be sampled.

**Acceptance criteria:**

- [ ] `<LiquidGlass>` accepts `adaptiveTint?: boolean` (default `false`) added to
      `LiquidGlassProps` with TSDoc. When `true`, it consumes
      `useBackdropLuminance` (017) and derives the light/dark treatment (tint +
      content foreground) automatically from the sampled `scheme`.
- [ ] PRECEDENCE RULE (written + tested): an EXPLICIT `overLight` prop always
      wins; `adaptiveTint` only drives the light/dark treatment when `overLight`
      is left unset/undefined. (i.e. `overLight` is the manual override,
      `adaptiveTint` the auto path; they never fight.) Documented in TSDoc + README.
- [ ] Auto light/dark applies the SAME underlying treatment `overLight` already
      controls (it reuses the existing `effectiveScale`/blur/tint plumbing — it
      computes an effective `overLight`-equivalent from `scheme`, it does NOT add
      a parallel tint system) so behavior is consistent and DRY.
- [ ] Content legibility: small content (e.g. button labels) flips foreground
      light↔dark with the verdict so it stays discernible; framed in docs as a
      LEGIBILITY feature with an explicit warning that auto-tint is best-effort
      and critical text over unknown/cross-origin backdrops should be verified.
- [ ] SSR/hydration-safe: server + first client paint render the default (un-
      sampled, conservative) treatment so hydration matches; the sampled
      treatment is applied in an effect after mount. A `renderToString` →
      `hydrateRoot` test (mirroring 006) with a `console.error` spy asserts NO
      hydration mismatch with `adaptiveTint` enabled.
- [ ] Graceful degradation: when `useBackdropLuminance` returns `sampled:false`
      (cross-origin taint, no canvas, SSR), `adaptiveTint` falls back to the
      default/`overLight` treatment with no error, no flON/flicker loop, and no
      `console.error`.
- [ ] Interaction with `prefers-contrast` (014): under increased contrast,
      auto-tint must not undercut the high-contrast treatment (contrast wins on
      legibility). Documented + a test for the combination.
- [ ] Unit tests: precedence (explicit overLight beats adaptiveTint); scheme→
      treatment mapping (light backdrop ⇒ light-appropriate treatment and vice
      versa, mocking the luminance hook); sampled:false fallback; the hydration
      test; console-error spy silent. jsdom-friendly (mock the luminance hook).
- [ ] This plan OWNS an `AdaptiveTint` story (over the same-origin photo from 015)
      showing the glass adapting across light and dark regions of the backdrop.
- [ ] `docs/PARITY.md` + `README.md` document `adaptiveTint` (behavior, precedence
      vs `overLight`, the cross-origin limitation). Default-off means the committed
      Showcase pixel baseline is unaffected (verify it still passes; the
      AdaptiveTint story is separate).

## Design

`adaptiveTint` is a thin consumer of 017: read `scheme` from
`useBackdropLuminance(surfaceRef)`, map it to an effective `overLight` value, and
feed the EXISTING tint/scale/blur plumbing — no new tint pipeline. Precedence:
`const effectiveOverLight = overLight ?? (adaptiveTint && scheme ? scheme === 'light' : false)`
(documented; explicit `overLight` short-circuits). All sampling stays in the
effect (post-mount), so SSR/first paint use the conservative default and
hydration matches. When `sampled` is false, `effectiveOverLight` falls back to
`overLight ?? false`. Keep `adaptiveTint={false}` paths from importing the
sampling module eagerly (017 keeps it tree-shakeable; only call the hook when the
prop is set, e.g. guard the hook usage so the default path stays lean — note any
rules-of-hooks constraint and resolve it cleanly, e.g. an internal
`<AdaptiveTintLayer>` mounted only when enabled).

**Files expected to change:**

- `src/types.ts`: add `adaptiveTint?: boolean` to `LiquidGlassProps` (TSDoc +
  precedence note).
- `src/liquid-glass.tsx`: consume `useBackdropLuminance` when enabled; compute
  effective overLight via the precedence rule; SSR-safe; sampled:false fallback.
- `src/liquid-glass.test.tsx`: precedence, mapping, fallback, hydration, contrast combo.
- `src/liquid-glass.stories.tsx`: `AdaptiveTint` story (owned here).
- `docs/PARITY.md`, `README.md`: document the feature + limitation + precedence.

**Out of scope:** the sampling infra itself (017), the `regular`/`clear` variant
(019), scroll-aware shadow (021), changing the default (adaptiveTint-off)
rendering. Do not build a second tint system — reuse the `overLight` plumbing.

**Testing approach:** browser-based — a rendering feature with SSR concerns;
unit/RTL/jsdom with the luminance hook mocked, plus the renderToString→hydrateRoot
hydration test.

## Tasks

1. Add `adaptiveTint` to `LiquidGlassProps` with TSDoc + precedence note.
2. Consume `useBackdropLuminance` (guarded so default path stays lean) and compute
   `effectiveOverLight` via the precedence rule; wire into existing tint plumbing.
3. Handle sampled:false fallback + the prefers-contrast interaction.
4. Add unit tests (precedence, mapping, fallback, hydration, contrast combo).
5. Add the `AdaptiveTint` story over the 015 same-origin photo.
6. Update `docs/PARITY.md` + `README.md`; confirm the default Showcase baseline
   still passes (default-off). Run the gate.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- liquid-glass`
- [assert] `pnpm test -- liquid-glass 2>&1 | tail -8` contains `pass`
- [cmd] `pnpm build-storybook`
- [cmd] `pnpm e2e -- refraction` (default Showcase unchanged ⇒ baseline still passes)
- [assert] `grep -qi "adaptiveTint\|adaptive tint" README.md && echo found` outputs `found`
- [browse] start `pnpm storybook`, open the AdaptiveTint story, and confirm the glass label stays legible as it sits over bright vs dark regions of the backdrop; no console errors; stop the server
- [manual] Explicit `overLight` still overrides auto-tint; cross-origin backdrop degrades silently.
