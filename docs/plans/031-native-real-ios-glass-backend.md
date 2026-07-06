---
id: 031
title: Optional real iOS 26 Liquid Glass backend for the native (Expo/RN) surface
status: backlog
blocked-by: [025]
priority: low
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: eng
created: 2026-07-06
completed:
reviewed: false
qa: manual
---

## Requirements

Our React Native surface (`src/liquid-glass.native.tsx`, plan 025) renders an
APPROXIMATION of glass — an `expo-blur` `BlurView` + tint + gradient sheen +
hairline ring + shadow (the portable frosted recipe). It deliberately does NOT
use Apple's real Liquid Glass material, so on iOS 26+ devices we look less
authentic than libraries that wrap the native effect.

Two libraries now bridge Apple's genuine `UIGlassEffect` to React Native:

- **`expo-glass-effect`** — first-party (Expo team), Expo SDK 54+. Wraps native
  `UIVisualEffectView`; `GlassView` / `GlassContainer`; has a runtime
  availability check; needs a dev build (`pod-install`). Cleanest choice on Expo.
- **`@callstack/liquid-glass`** — Fabric/TurboModules; `LiquidGlassView` /
  `LiquidGlassContainerView`; `effect` clear|regular|none; works on bare RN and
  Expo. De-facto standard for bare RN.

Both are **iOS 26+ only**, fall back to a plain `View` on Android / older iOS,
and are **NOT available in Expo Go**.

This plan adds an OPTIONAL native backend so that, when a consumer opts in and
the device supports it, `<LiquidGlass>` renders Apple's REAL material on iOS,
and otherwise keeps today's `expo-blur` approximation. Best-of-both: authentic
iOS glass where available, universal approximation everywhere else.

**Hard constraints (why this is opt-in, not a dependency):**

- Must stay **Expo-Go-friendly for consumers who do NOT opt in** — the native
  backend is an OPTIONAL peer dependency, resolved dynamically; if it isn't
  installed, we render exactly today's approximation with no error.
- **iOS only.** Android and web are untouched (Android keeps the approximation;
  the web build is completely unaffected — no change to `liquid-glass.tsx`).
- Gated by a runtime support check (`isLiquidGlassAvailable()` /
  `isLiquidGlassSupported`); never assume iOS 26.
- The public prop contract and default look are unchanged for existing consumers.

**Acceptance criteria (draft — refine in eng review):**

- [ ] On an iOS 26+ device with the optional backend installed and opted in,
      `<LiquidGlass>` renders the real native glass; visually distinct from the
      `expo-blur` approximation.
- [ ] Without the optional dep installed (incl. Expo Go), `<LiquidGlass>` renders
      today's frosted approximation byte-for-byte — no crash, no missing-module
      error (dynamic/optional resolution).
- [ ] Android and older iOS keep the approximation via the existing support gate.
- [ ] Web build unchanged; no new dependency reaches web consumers.
- [ ] Opt-in is explicit (a prop or a documented setup step), not automatic.

## Design (open — needs eng review before implementation)

Key decisions to settle first:

1. **Which backend?** `expo-glass-effect` (first-party, Expo-centric) vs
   `@callstack/liquid-glass` (bare-RN standard) vs support both behind one
   internal adapter. Leaning: adapter that prefers `expo-glass-effect` when
   present, falls back to `@callstack/liquid-glass`, else our approximation.
2. **Opt-in surface.** A new prop (e.g. `nativeBackend?: 'auto' | 'off'`) vs a
   package-level config vs "install the peer dep = opted in". Prefer the least
   surprising: installed + supported ⇒ used, with a prop to force off.
3. **Prop mapping.** Map `LiquidGlassCoreProps` → the backend's props
   (`effect`/`tintColor`/`interactive`/`colorScheme`). Our refraction/motion
   props remain no-ops on native (as today).
4. **Optional-dep resolution.** Dynamic `require`/lazy import guarded so bundlers
   (Metro/Expo) don't hard-fail when the dep is absent; add to
   `peerDependenciesMeta` as optional.

**Out of scope:** Any web change. Android real-glass (no equivalent). Replacing
the `expo-blur` approximation (it stays as the universal fallback).

## Tasks (rough)

1. Eng review: pick backend strategy + opt-in surface (decisions above).
2. Add the chosen dep(s) as OPTIONAL peer deps (`peerDependenciesMeta`).
3. Internal native adapter: support check + dynamic resolution + prop mapping;
   fall back to the current `expo-blur` recipe.
4. Wire into `liquid-glass.native.tsx` behind the opt-in.
5. Docs: setup (dev build / not Expo Go), iOS-only scope, fallback behavior.
6. Manual QA on a real iOS 26 device (real glass) + a non-opted-in build
   (approximation unchanged) + Android/Expo Go (approximation, no crash).

## Verification

- [cmd] `pnpm typecheck:native`
- [cmd] `pnpm test:native`
- [manual] iOS 26 device: real native glass renders when opted in
- [manual] Expo Go / no optional dep: approximation renders, no error
- [manual] Android: approximation unchanged

## Notes

Context captured from a session evaluating `callstack/liquid-glass` and
`expo-glass-effect` (2026-07). Relationship to the web work: strictly additive
and native-only — the web/DOM library is orthogonal. This is a fidelity upgrade
for the RN/iOS path, not a general dependency. Independent integration; check
each library's LICENSE before vendoring anything.
