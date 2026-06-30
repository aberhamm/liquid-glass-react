---
id: 029
title: Document web + Expo usage, displacement opt-in, and peer-dep install
status: blocked
blocked-by: [023, 025, 030]
priority:
goal: cross-browser-expo-liquid-glass
allows-migrations: false
needs-review: none
created: 2026-06-22
---

## Requirements

The package now serves two render targets (web and Expo/React Native) from one
install, with a frosted default and an opt-in `displacement` enhancement, plus
optional expo peer deps. None of that is documented. A consumer must be able to
read the README and know: how to use it on the web, how to use it in an Expo app
(including which peer deps to install), that frosted is the cross-browser default
and `displacement` is a web-only opt-in, and what is NOT supported on native.

**Acceptance criteria:**

- [ ] README has a Web usage section showing the default frosted import/use, the
      `displacement` opt-in (Chrome-only live-backdrop bend), AND the
      cross-browser refraction (plan 030: `filter`-on-a-copy via in-place
      `size`/`center` or `refract={node}`) that works in Chrome/Safari/Firefox —
      with a clear note on which bends the live page (Chrome) vs a copy
      (cross-browser).
- [ ] README has an Expo / React Native section: install the optional peer deps
      (`expo-blur`, `expo-linear-gradient`, plus `react-native`/Expo), the same
      `<LiquidGlass>` import (Metro auto-resolves the native build), and a note
      that displacement/SVG props are no-ops on native (iOS-first, Android
      best-effort).
- [ ] README documents that prebuilt `GlassButton`/`GlassCard`/
      `GlassSegmentedControl` are web-only this round (not in the native barrel).
- [ ] `CHANGELOG.md` has an entry describing the frosted-default + opt-in
      displacement + Expo support change (and the default-look behavior change).
- [ ] `package.json` `version` is bumped to reflect that the default render
      changed (refraction → frosted) and the new Expo target — a visible change
      for published consumers. State the chosen bump (minor for pre-1.0 `0.x`,
      or major if post-1.0) in the CHANGELOG entry.
- [ ] Doc code snippets are accurate against the shipped API (props, peer-dep
      names, import paths).

## Design

Documentation only. Update `README.md` with two clearly separated usage paths
(Web, Expo) and a short "What works where" matrix (frosted everywhere;
displacement web-only; prebuilt components web-only). Add the peer-dep install
line for Expo. Add a `CHANGELOG.md` entry noting the default-look change is
intentional and how to restore the old refraction look (`displacement`).

**Files expected to change:**

- `README.md`: Web + Expo usage, displacement opt-in, support matrix.
- `CHANGELOG.md`: entry for this round.

**Out of scope:** Code/behavior changes, Storybook (027), the verification
harness (026). Native prebuilt-component docs beyond "web-only this round."

Testing approach: unit-only

## Tasks

1. Write the README Web usage section (default frosted + `displacement` opt-in).
2. Write the README Expo section (optional peer-dep install + shared import +
   native no-op note + iOS-first/Android best-effort).
3. Add the "what works where" support matrix and the web-only-prebuilts note.
4. Add a `CHANGELOG.md` entry, including the intentional default-look change and
   how to opt back into displacement.

## Verification

- [assert] `grep -niE "expo" README.md` outputs matches
- [assert] `grep -niE "displacement" README.md` outputs matches
- [assert] `grep -niE "expo-blur" README.md` outputs a match (peer-dep install documented)
- [cmd] `pnpm pack:check`
