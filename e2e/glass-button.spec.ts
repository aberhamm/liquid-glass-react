/**
 * GlassButton accessibility / keyboard tests (all three engines).
 *
 * Story: components-glassbutton--playground
 * The Playground story renders a single GlassButton wrapping a <button>.
 * The GlassButton renders: LiquidGlass > [data-lg-content] > button.
 *
 * We use [data-lg-content] button to scope to the actual GlassButton,
 * not Storybook's own UI buttons (which also appear as <button> elements
 * but are not visible in the rendered content area).
 *
 * Assertions:
 * 1. The button is a real <button> element
 * 2. It receives keyboard focus via Tab or direct .focus()
 * 3. Enter and Space activate it without throwing a page error
 * 4. The button remains visible when focused (no hidden-on-focus regression)
 *
 * This is an a11y-level check that must pass in all three engines.
 */

import { expect, test } from '@playwright/test';

test.describe('GlassButton keyboard accessibility', () => {
  let pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    // Listen for page errors — any throw during keyboard interaction = failure
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.goto('/iframe.html?id=components-glassbutton--playground&viewMode=story');
    // Wait for the actual GlassButton (scoped inside data-lg-content, not Storybook UI buttons)
    await page.waitForSelector('[data-lg-content] button', { state: 'visible' });
  });

  test('button is a semantic <button> element', async ({ page }) => {
    // Scope selector to the GlassButton's content layer to avoid matching
    // Storybook's own UI controls which also render hidden <button> elements.
    const button = page.locator('[data-lg-content] button').first();
    await expect(button).toBeVisible();

    const tagName = await button.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('button');
  });

  test('button receives focus programmatically', async ({ page }) => {
    const button = page.locator('[data-lg-content] button').first();

    // Focus programmatically (Tab key may move through Storybook UI elements first)
    await button.focus();
    await page.waitForTimeout(100);

    // The button should now be focused
    const isFocused = await button.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test('Enter key activates button without throwing', async ({ page }) => {
    const button = page.locator('[data-lg-content] button').first();
    await button.focus();

    // Verify it is focused
    const isFocused = await button.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Press Enter — should activate without throwing
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // No page errors during keyboard activation
    expect(pageErrors).toHaveLength(0);
  });

  test('Space key activates button without throwing', async ({ page }) => {
    const button = page.locator('[data-lg-content] button').first();
    await button.focus();

    const isFocused = await button.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Press Space — should activate without throwing
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    expect(pageErrors).toHaveLength(0);
  });

  test('focused button has a visible focus state (not hidden)', async ({ page }) => {
    const button = page.locator('[data-lg-content] button').first();
    await button.focus();

    // The button should remain visible when focused (no hidden-on-focus regression)
    await expect(button).toBeVisible();

    // Confirm no errors accumulated
    expect(pageErrors).toHaveLength(0);
  });
});
