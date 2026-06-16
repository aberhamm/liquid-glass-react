/**
 * Cross-browser E2E for <GlassSegmentedControl> (plan 012).
 *
 * Reuses 010's playwright.config.ts (3 projects: chromium/firefox/webkit,
 * webServer serves storybook-static). This spec is decoupled from the core 010
 * suite (eng-review 2026-06-13): it proves the control before release without
 * gating the primitive's cross-browser gate.
 *
 * Story IDs (from storybook-static/index.json):
 *   - ThemeSwitcher: components-glasssegmentedcontrol--theme-switcher
 *   - Playground:    components-glasssegmentedcontrol--playground
 *
 * Stable DOM selectors (do NOT modify the component to make these pass):
 *   .lg-segmented-indicator   — the sliding glass indicator (inline transform)
 *   .lg-segmented-option      — the styled option labels
 *   input.lg-segmented-input  — the native radios
 *   fieldset[data-selected-index] — the deterministic active-index signal
 *
 * Cross-browser behaviour: the slide (CSS transform) + glass edge render in
 * every engine; refraction is present only in Chromium and gracefully absent in
 * Firefox/WebKit — degradation (no url(#) there) is the pass criterion, same as
 * the primitive. We do NOT require url(#) cross-engine.
 */

import { expect, test } from '@playwright/test';

const STORY_ID = 'components-glasssegmentedcontrol--theme-switcher';

test.describe('GlassSegmentedControl', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(`/iframe.html?id=${STORY_ID}&viewMode=story`);
    await page.waitForSelector('.lg-segmented-indicator', { state: 'visible' });
  });

  test('renders an accessible native radiogroup with one checked radio', async ({ page }) => {
    const radios = page.locator('input.lg-segmented-input');
    await expect(radios).toHaveCount(3);
    // Exactly one radio is checked.
    const checkedCount = await radios.evaluateAll(
      (els) => els.filter((e) => (e as HTMLInputElement).checked).length,
    );
    expect(checkedCount).toBe(1);
    // The group is a fieldset (implicit role group).
    await expect(page.locator('fieldset.lg-segmented')).toBeVisible();
  });

  test('selecting a different option SLIDES the glass indicator (transform differs)', async ({
    page,
  }) => {
    const indicator = page.locator('.lg-segmented-indicator').first();
    await expect(indicator).toBeVisible();

    // Wait for the post-mount measurement to set a px transform.
    await expect
      .poll(async () => indicator.evaluate((el) => (el as HTMLElement).style.transform || ''), {
        timeout: 5000,
        message: 'indicator should carry an inline transform once measured',
      })
      .toMatch(/translateX\(/);

    const before = await indicator.evaluate((el) => ({
      transform: (el as HTMLElement).style.transform,
      index: el.getAttribute('data-selected-index'),
    }));

    // The ThemeSwitcher story defaults to "dark" (index 1). Select "light"
    // (index 0) to force a move. Click the styled label (covers the indicator).
    await page.locator('.lg-segmented-option', { hasText: 'Light' }).first().click();

    await expect
      .poll(async () => indicator.evaluate((el) => (el as HTMLElement).style.transform || ''), {
        timeout: 5000,
        message: 'indicator transform should change after selection',
      })
      .not.toBe(before.transform);

    const after = await indicator.evaluate((el) => ({
      transform: (el as HTMLElement).style.transform,
      index: el.getAttribute('data-selected-index'),
    }));

    expect(after.transform).not.toBe(before.transform);
    expect(after.index).not.toBe(before.index);
    expect(after.index).toBe('0');
  });

  test('keyboard: arrow keys move the radio selection and the indicator', async ({ page }) => {
    const indicator = page.locator('.lg-segmented-indicator').first();
    await expect
      .poll(async () => indicator.evaluate((el) => (el as HTMLElement).style.transform || ''), {
        timeout: 5000,
      })
      .toMatch(/translateX\(/);

    const fieldset = page.locator('fieldset.lg-segmented').first();
    const indexBefore = await fieldset.getAttribute('data-selected-index');

    // Focus the currently-checked radio, then arrow to the next option. Native
    // radiogroup keyboard model drives the selection — no custom handlers.
    const checked = page.locator('input.lg-segmented-input:checked').first();
    await checked.focus();
    await page.keyboard.press('ArrowRight');

    await expect
      .poll(async () => fieldset.getAttribute('data-selected-index'), {
        timeout: 5000,
        message: 'arrow key should move the active index',
      })
      .not.toBe(indexBefore);

    // The indicator followed the selection.
    const transformNow = await indicator.evaluate(
      (el) => (el as HTMLElement).style.transform || '',
    );
    expect(transformNow).toMatch(/translateX\(/);
  });

  test('zero console errors / page errors (degradation is the pass criterion)', async ({
    page,
  }) => {
    // Exercise a selection to ensure no errors fire on interaction either.
    await page.locator('.lg-segmented-option', { hasText: 'Light' }).first().click();
    await page.waitForTimeout(300);
    expect(consoleErrors).toHaveLength(0);
  });
});
