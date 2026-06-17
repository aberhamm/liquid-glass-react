---
id: 017
title: Backdrop-luminance sampling infrastructure (lazy, taint-aware)
status: in-progress
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

Apple's signature Liquid Glass behavior is content-adaptive: the material reads
the brightness of what's behind it and adjusts tint/legibility. No React library
ships this. Before the consuming feature (adaptive tint, plan 018) can exist, we
need the load-bearing infrastructure: a way to estimate the average luminance
(and a coarse light/dark verdict) of the page content BEHIND a given element,
SSR-safely, cheaply, and without crashing on cross-origin content. The "user"
is plan 018's worker, who calls `useBackdropLuminance(ref)` and gets a stable
luminance reading to drive tint.

This plan ships ONLY the infrastructure (hook + util + tests), with NO visual
change to any component and NO bundle-size cost on the default path. ADDITIVE.

**Acceptance criteria:**

- [ ] `src/backdrop-luminance.ts` exports a pure-ish `estimateLuminance(...)`
      helper and the sampling logic: given an element's viewport rect, sample
      the backdrop (via `html2canvas`-free approach — see Design; canvas readback
      of a snapshot OR a DOM/computed-background heuristic) and return a
      normalized luminance in [0,1] plus a `'light' | 'dark'` verdict at a
      documented threshold. Pure helpers (e.g. `relativeLuminance(r,g,b)`,
      `averageColorToVerdict`) are unit-tested against known values.
- [ ] `src/use-backdrop-luminance.ts` exports `useBackdropLuminance(ref, options?)`
      returning `{ luminance: number | null, scheme: 'light'|'dark'|null,
      sampled: boolean }`. It is SSR-safe (returns null/unsampled on the server
      and first client paint — no measurement during render), runs sampling in an
      effect after mount, and re-samples on a THROTTLED basis (rAF/timeout
      throttle; optionally on scroll/resize) with coarse sampling for perf.
- [ ] CROSS-ORIGIN TAINT is handled honestly: if sampling requires a canvas and
      the canvas becomes tainted (cross-origin image without CORS), `getImageData`
      throws `SecurityError`; the hook MUST catch it, return
      `{ sampled: false, luminance: null, scheme: null }`, and NOT throw or log
      an error. Document the limitation. (Same-origin backdrops — e.g. 015's
      bundled demo photos — sample fine.)
- [ ] BUNDLE DISCIPLINE (closes TODO T2 concern): the sampling module must NOT be
      pulled into the default `<LiquidGlass>` bundle path. It is a separate module
      consumed only when a consumer opts into adaptive tint (018), so a
      `LiquidGlass` import without adaptive tint does not grow. Verify
      tree-shakeability: a build/inspection check that the sampling code is in its
      own chunk or is not referenced from the always-loaded path. (If the repo has
      no size gate, add a minimal one or assert via bundle inspection.)
- [ ] Unit tests cover: the pure luminance/verdict math; the hook's SSR/no-window
      path (returns unsampled); the throttle (rapid triggers coalesce to limited
      sampling calls); and the taint path (a sampling function that throws
      SecurityError ⇒ `sampled:false`, no throw, no console.error). jsdom has no
      real canvas, so mock the canvas/sampling boundary and assert behavior, not
      pixels.
- [ ] No public `<LiquidGlass>`/component behavior changes in this plan; exported
      from `src/index.ts` for advanced consumers.

## Design

There is no reliable, cheap, universal way to read "the pixels behind an
arbitrary element" in a browser — `backdrop-filter` does it in the compositor,
not in JS. So the sampling helper is pluggable and degrades: the default
strategy walks the DOM behind the element's center point
(`document.elementsFromPoint`) and derives an average background color from
computed `background-color`/`background-image` (cheap, no canvas, no taint), and
ONLY falls back to a canvas snapshot path where explicitly enabled. Either way
the contract is the same `{ luminance, scheme, sampled }`. Keep it React-free in
`backdrop-luminance.ts`; the hook wraps it with effect + throttle + SSR guards
(reuse the rAF-throttle + ResizeObserver-guard patterns already in the repo).
Keep the module independently importable so it tree-shakes out of the default
path.

**Files expected to change:**

- `src/backdrop-luminance.ts` (new): pure luminance math + the pluggable
  sampling strategy (DOM-background default; optional canvas path; taint-safe).
- `src/use-backdrop-luminance.ts` (new): the hook (effect + throttle + SSR guard).
- `src/backdrop-luminance.test.ts` (new): math + hook + throttle + taint + SSR.
- `src/index.ts`: export the hook + helper for advanced consumers.
- `vite.config.ts`/`package.json`: only if a tree-shake/size assertion needs wiring.

**Out of scope:** consuming the luminance to change tint (plan 018) — NO
`liquid-glass.tsx` rendering change here; the `regular`/`clear` variant (019);
scroll-aware shadow (021). Do not add a heavy image-snapshot dependency
(zero-new-deps holds — the canvas path uses the platform canvas API only).

**Testing approach:** unit-only — pure math + a hook whose sampling boundary is
mocked (jsdom has no canvas); verified via Vitest.

## Tasks

1. Implement pure `relativeLuminance` + average-color → `scheme` verdict with TSDoc.
2. Implement the pluggable, taint-safe sampling strategy (DOM-background default).
3. Implement `useBackdropLuminance` (effect-driven, throttled, SSR-safe, returns
   `{luminance, scheme, sampled}`).
4. Export from `src/index.ts`; keep the module out of the default LiquidGlass path.
5. Write unit tests (math, SSR, throttle, taint ⇒ sampled:false no-throw).
6. Verify tree-shakeability (chunk/bundle inspection or a size assertion); run gate.

## Verification

Checks:
- [cmd] `pnpm typecheck`
- [cmd] `pnpm lint`
- [cmd] `pnpm test -- backdrop-luminance`
- [assert] `pnpm test -- backdrop-luminance 2>&1 | tail -6` contains `pass`
- [cmd] `pnpm build`
- [assert] `node -e "const fs=require('fs');const mjs=fs.readFileSync('dist/index.mjs','utf8');process.stdout.write(/getImageData|elementsFromPoint|backdrop-luminance|estimateLuminance/.test(mjs)?'present':'absent')"` — document the result (the sampling code may be present in the full bundle but must be tree-shakeable / not on the default LiquidGlass render path; assert via the size/chunk strategy chosen).
- [manual] Confirm a cross-origin tainted sample returns `sampled:false` without throwing or logging.
