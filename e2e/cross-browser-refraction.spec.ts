/**
 * Cross-browser copy-refraction tests (plan 030).
 *
 * The headline point: unlike the Chromium-only `backdrop-filter: url(#…)` bend
 * (see refraction.spec.ts), applying the SAME SVG displacement filter as an
 * ELEMENT `filter: url(#…)` to a COPY of content runs in Chromium, Firefox AND
 * WebKit. This spec asserts that on ALL THREE engines (no per-engine skips).
 *
 * Story id (from storybook-static/index.json):
 *   - Refract: components-liquidglass--refract
 *
 * Stable DOM selectors (do NOT modify the component to make these pass):
 *   [data-lg-refraction]       — the decorative copy layer (aria-hidden sibling)
 *   [data-lg-refraction-copy]  — the element that carries `filter: url(#…-copy)`
 *   [data-lg-content]          — the crisp, interactive content sibling
 *   filter[id$="-copy"]        — the inline SVG <filter> graph for the copy path
 */

import { expect, test } from '@playwright/test';

test.describe('Refract story (cross-browser copy refraction)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/iframe.html?id=components-liquidglass--refract&viewMode=story');
    await page.waitForSelector('[data-lg-refraction-copy]', { state: 'attached' });
  });

  // ALL engines: the copy layer carries an ELEMENT filter: url( — this is the
  // whole point of the plan (cross-browser, unlike backdrop-filter:url()).
  test('all engines: [data-lg-refraction-copy] carries element filter: url(', async ({ page }) => {
    // Both the in-place and refract={node} panels render a copy layer.
    const filtered = page.locator('[data-lg-refraction-copy]');
    await expect(filtered.first()).toBeAttached();
    const count = await filtered.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Every copy layer's ELEMENT filter references an SVG url() (poll for mount).
    for (let i = 0; i < count; i++) {
      await expect
        .poll(
          async () => filtered.nth(i).evaluate((el) => (el as HTMLElement).style.filter || ''),
          { timeout: 5000, message: 'copy layer should carry filter: url(' },
        )
        .toContain('url(');
    }

    // The referenced <filter> graph(s) exist and run the displacement pass.
    await expect(page.locator('filter[id$="-copy"]').first()).toBeAttached();
    await expect(page.locator('filter[id$="-copy"] feDisplacementMap').first()).toBeAttached();

    expect(consoleErrors).toHaveLength(0);
  });

  // ALL engines: this is an ELEMENT filter, NOT a backdrop-filter — the surface's
  // backdrop-filter must NOT carry the copy url() (that path is Chromium-only and
  // is off in this story; copy refraction is engine-agnostic).
  test('all engines: the copy url() is an element filter, not a backdrop-filter', async ({
    page,
  }) => {
    const surfaces = page.locator('[data-lg-surface]');
    const count = await surfaces.count();
    for (let i = 0; i < count; i++) {
      const bf = await surfaces
        .nth(i)
        .evaluate((el) => (el as HTMLElement).style.backdropFilter || '');
      expect(bf).not.toContain('-copy)');
    }
  });

  // ALL engines: content isolation — the crisp content layer is a SIBLING of the
  // refracted copy, never nested inside it (the warp never touches real content).
  test('all engines: crisp content is a sibling of (not inside) the refracted copy', async ({
    page,
  }) => {
    const isolated = await page.evaluate(() => {
      const copies = Array.from(document.querySelectorAll('[data-lg-refraction]'));
      const contents = Array.from(document.querySelectorAll('[data-lg-content]'));
      if (copies.length === 0 || contents.length === 0) return false;
      // No copy layer may contain a crisp content layer, and vice versa.
      for (const copy of copies) {
        for (const content of contents) {
          if (copy.contains(content) || content.contains(copy)) return false;
        }
      }
      return true;
    });
    expect(isolated).toBe(true);
  });

  // ALL engines: the copy layer renders a real, non-zero box (not a broken layer).
  test('all engines: the refracted copy has a non-zero box', async ({ page }) => {
    const layer = page.locator('[data-lg-refraction]').first();
    const box = await layer.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });
});
