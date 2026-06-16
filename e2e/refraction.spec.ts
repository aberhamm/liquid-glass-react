/**
 * Cross-browser refraction tests.
 *
 * Story IDs (from storybook-static/index.json):
 *   - Showcase:  components-liquidglass--showcase
 *   - Playground: components-liquidglass--playground
 *   - Modes:     components-liquidglass--modes
 *
 * Stable DOM selectors (do NOT modify the component to make these pass):
 *   [data-lg-surface]  — glass surface div carrying backdrop-filter
 *   filter[id^="lg-"] — inline SVG filter (only when canRefract=true)
 *
 * Cross-browser behaviour:
 *   - Chromium: backdrop-filter CONTAINS url( pointing to the SVG filter id
 *     (serialised as url("#lg-...") with quotes by the browser)
 *   - Firefox/WebKit: backdrop-filter does NOT contain url( for the filter,
 *     fallback frosted glass
 *
 * NOTE on backdrop-filter serialisation: when the component sets
 * `backdropFilter: 'url("#lg-r0") blur(1px) saturate(140%)'` via React inline
 * styles, browsers serialise the inline-style value. In Chromium the value
 * contains `url(` followed by a quoted or unquoted fragment id. We test for
 * the presence of `url(` in the backdrop-filter value, which is the reliable
 * cross-serialisation signal that the SVG displacement filter is wired up.
 * In Firefox/WebKit the filter is omitted entirely, so the value will not
 * contain `url(`.
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Showcase story — full refraction check (Chromium) + degradation (FF/WebKit)
// ---------------------------------------------------------------------------

test.describe('Showcase story', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/iframe.html?id=components-liquidglass--showcase&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
  });

  // Chromium-only: assert the full refraction effect is active
  test('chromium: backdrop-filter contains url( and SVG filter is present', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Full refraction only in Chromium');

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Poll until the backdrop-filter contains a url( reference (the SVG filter).
    // The browser serialises the inline style as url("#lg-...") with quotes,
    // so we check for url( which is stable across quote/no-quote serialisations.
    await expect
      .poll(
        async () => {
          const bf = await surface.evaluate((el) => (el as HTMLElement).style.backdropFilter || '');
          return bf;
        },
        { timeout: 5000, message: 'backdrop-filter should contain url( in Chromium' },
      )
      .toContain('url(');

    // The inline SVG filter element must exist in the DOM
    const svgFilter = page.locator('filter[id^="lg-"]').first();
    await expect(svgFilter).toBeAttached();
  });

  // Chromium-only: blocking pixel-diff baseline for the glass surface region
  test('chromium: glass surface visual baseline (pixel-diff)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Pixel baseline pinned to chromium');

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Wait for refraction to attach (backdrop-filter includes url()
    await expect
      .poll(
        async () => {
          const bf = await surface.evaluate((el) => (el as HTMLElement).style.backdropFilter || '');
          return bf;
        },
        { timeout: 5000 },
      )
      .toContain('url(');

    // Screenshot the glass surface element (not the whole animated page)
    // to avoid backdrop-animation flakiness. The refraction edge effect
    // is visible here even without the full backdrop motion.
    await expect(surface).toHaveScreenshot('showcase-glass-chromium.png', {
      maxDiffPixelRatio: 0.03,
      // Disable CSS animations for a stable snapshot
      animations: 'disabled',
    });
  });

  // Firefox + WebKit: assert graceful degradation (this passing IS the assertion)
  test('firefox/webkit: fallback — no url( in backdrop-filter, non-zero box, zero errors', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'Degradation test for non-Chromium engines');

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Allow a short delay for mount + capability detection
    await page.waitForTimeout(500);

    // Fallback: backdrop-filter must NOT contain a url( displacement reference
    const backdropFilter = await surface.evaluate(
      (el) => (el as HTMLElement).style.backdropFilter || '',
    );
    // In fallback tier the value is "blur(...) saturate(...)" — no url(
    expect(backdropFilter).not.toContain('url(');

    // The glass box must have non-zero dimensions (no broken/empty box)
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    // Zero console errors and page errors — graceful degradation defined
    expect(consoleErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Modes story — shader and turbulence mode smoke (Chromium only)
// ---------------------------------------------------------------------------

test.describe('Modes smoke (Chromium)', () => {
  /**
   * Wait for the SVG filter to attach (backdrop-filter contains url() for the
   * filter reference). Reusable helper across mode smoke tests.
   */
  async function waitForFilterAttached(page: import('@playwright/test').Page): Promise<void> {
    await expect
      .poll(
        async () => {
          const bf = await page
            .locator('[data-lg-surface]')
            .first()
            .evaluate((el) => (el as HTMLElement).style.backdropFilter || '');
          return bf;
        },
        { timeout: 5000, message: 'backdrop-filter should contain url( once filter attaches' },
      )
      .toContain('url(');
  }

  // Use URL args to target a single mode at a time on the Playground story
  // for deterministic per-tile querying. The Modes story renders all five
  // tiles together which makes per-tile selector disambiguation fragile.

  test('shader mode: feImage carries a non-empty data: URL', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mode smoke gated to Chromium');

    // Navigate to Playground with mode=shader arg override
    await page.goto(
      '/iframe.html?id=components-liquidglass--playground&viewMode=story&args=mode:shader',
    );
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
    await waitForFilterAttached(page);

    // The feImage href must be a non-empty data: URL (runtime canvas generation ran).
    // The first feImage in the filter graph (before the edge-mask feImage) is the
    // displacement map source; edge-mask feImage uses a fragment (#...) href.
    const feImages = page.locator('filter[id^="lg-"] feImage');
    const count = await feImages.count();
    expect(count).toBeGreaterThan(0);

    // Find the feImage with the data: URL
    let foundDataUrl = false;
    for (let i = 0; i < count; i++) {
      const href = await feImages.nth(i).getAttribute('href');
      if (href?.startsWith('data:')) {
        foundDataUrl = true;
        expect(href.length).toBeGreaterThan(50); // non-trivial data URL
      }
    }
    expect(foundDataUrl).toBe(true);
  });

  test('turbulence mode: feTurbulence node present, no feImage data: URL', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Mode smoke gated to Chromium');

    await page.goto(
      '/iframe.html?id=components-liquidglass--playground&viewMode=story&args=mode:turbulence',
    );
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
    await waitForFilterAttached(page);

    // An feTurbulence node must be present in the filter
    const feTurbulence = page.locator('filter[id^="lg-"] feTurbulence').first();
    await expect(feTurbulence).toBeAttached();

    // No feImage with a data: URL (turbulence uses the procedural path, not canvas)
    const feImages = page.locator('filter[id^="lg-"] feImage');
    const count = await feImages.count();
    for (let i = 0; i < count; i++) {
      const href = await feImages.nth(i).getAttribute('href');
      // Edge-mask feImage uses a fragment (#...) ref, NOT a data: URL
      if (href) {
        expect(href).not.toMatch(/^data:/);
      }
    }
  });

  test('turbulence mode: filter is attached (backdrop-filter contains url()', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Mode smoke gated to Chromium');

    await page.goto(
      '/iframe.html?id=components-liquidglass--playground&viewMode=story&args=mode:turbulence',
    );
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
    await waitForFilterAttached(page);

    // Verified by the poll inside waitForFilterAttached — explicit assert for clarity
    const bf = await page
      .locator('[data-lg-surface]')
      .first()
      .evaluate((el) => (el as HTMLElement).style.backdropFilter || '');
    expect(bf).toContain('url(');
  });
});
