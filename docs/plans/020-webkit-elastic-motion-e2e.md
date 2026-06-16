---
id: 020
title: WebKit elastic-motion E2E coverage (closes TODO T5)
status: pending
blocked-by: []
priority:
goal: apple-tier-liquid-glass-enhancements
allows-migrations: false
needs-review: none
created: 2026-06-16
---

## Requirements

The library's headline promise is "works everywhere," and the elastic
cursor-follow motion is pure CSS transform (so it should work in WebKit), yet the
cross-engine E2E (plan 010) asserts the pointer-move transform change only in
"at least Chromium and Firefox" — WebKit motion is the one cross-browser behavior
with no E2E proof (logged as TODO T5). This plan closes that gap: a Playwright
assertion that pointer movement changes the glass `transform` in WebKit too. The
"user" is the maintainer/CI who needs the "works everywhere" claim actually
proven on Safari/WebKit.

Test-only. No library/runtime change.

**Acceptance criteria:**

- [ ] `e2e/interaction.spec.ts` asserts that moving the pointer near/over the
      glass changes its inline/computed `transform` in the WEBKIT project (not
      just chromium + firefox), reusing 010's `playwright.config.ts` harness and
      the existing interaction-test patterns.
- [ ] The assertion is real (reads the transform before and after pointer move
      and asserts inequality), not a render-only smoke; it does not rely on
      refraction (motion is engine-independent).
- [ ] It respects reduced-motion the same way the existing interaction test does
      (does not run under emulated reduced-motion, or asserts the snap path
      separately).
- [ ] `pnpm e2e -- interaction` passes across all three engines (chromium,
      firefox, webkit); zero console errors.
- [ ] `TODOS.md` marks T5 as ✅ done (pulled in-scope), mirroring how T3 was
      closed by plan 010.

## Design

Extend the existing pointer-move interaction spec so the transform-change
assertion runs in the WebKit project (e.g. remove a `browserName !== 'webkit'`
skip, or add WebKit to the engines the test covers), keeping the at-rest →
moved transform-inequality check. No component change; this is test debt.

**Files expected to change:**

- `e2e/interaction.spec.ts`: include WebKit in the transform-change assertion.
- `TODOS.md`: mark T5 ✅ done.

**Out of scope:** the specular/glow E2E (plan 016 owns its own), any component
behavior change, new harness/config (reuse 010's). Do not weaken the
assertion to make WebKit pass — if WebKit genuinely fails to animate, that's a
real bug to surface, not to skip.

**Testing approach:** browser-based (E2E) — Playwright across all three engines.

## Tasks

1. Read the existing `e2e/interaction.spec.ts` transform-change test + its
   engine gating.
2. Extend the assertion to run (and pass) in the WebKit project.
3. Run `pnpm e2e -- interaction` across all three engines; confirm green.
4. Mark T5 ✅ done in `TODOS.md` with a note that it was pulled into plan 020.

## Verification

Checks:
- [cmd] `pnpm build-storybook`
- [cmd] `pnpm e2e -- interaction`
- [assert] `pnpm e2e -- interaction 2>&1 | tail -15` contains `passed`
- [assert] `grep -A2 "T5" TODOS.md | grep -qi "done\|✅" && echo found` outputs `found`
- [manual] The WebKit interaction test genuinely asserts a transform delta on pointer move.
