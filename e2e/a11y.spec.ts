/**
 * Accessibility: prefers-reduced-transparency (plan 013).
 *
 * jsdom's `matchMedia` stub returns `matches:false` for unknown queries, so a
 * unit-only test of the reduced-transparency render branch passes vacuously
 * (the live hook never sees `true` in jsdom). This Playwright test is the
 * cross-engine truth: it turns the OS "Reduce transparency" setting ON in a real
 * Chromium, then asserts the Showcase glass DROPS the `url(#...)` SVG
 * displacement from its `backdrop-filter` (live lensing suppressed) while
 * staying a non-zero, error-free, frosted surface.
 *
 * Mirrors how `refraction.spec.ts` reads `[data-lg-surface]` and checks for the
 * presence/absence of `url(` in the serialized backdrop-filter — the same
 * pattern 010 uses for reduced-motion. We drive the media feature over the
 * Chrome DevTools Protocol (`Emulation.setEmulatedMedia`) because Playwright's
 * `page.emulateMedia()` does not (as of 1.61) expose a `reducedTransparency`
 * option, whereas CDP does. This is Chromium-only by nature; refraction is a
 * Chromium-only effect, so there is nothing to drop on Firefox/WebKit.
 */

import { type CDPSession, expect, test } from '@playwright/test';

/** Set (or clear) the emulated `prefers-reduced-transparency` media feature. */
async function setReducedTransparency(
  client: CDPSession,
  value: 'reduce' | 'no-preference',
): Promise<void> {
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value }],
  });
}

test.describe('prefers-reduced-transparency (Showcase)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
  });

  // Chromium-only: under emulated reduce-transparency the full-effect tier must
  // DROP the url( refraction it would otherwise carry.
  test('chromium: reduce-transparency drops url( from backdrop-filter', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Refraction is Chromium-only; nothing to drop elsewhere');

    // Turn the OS "Reduce transparency" setting ON before navigation so the
    // live hook reads it on first mount.
    const client = await page.context().newCDPSession(page);
    await setReducedTransparency(client, 'reduce');

    await page.goto('/iframe.html?id=components-liquidglass--showcase&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Sanity: the media query really evaluates true in this context.
    const matches = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
    );
    expect(matches).toBe(true);

    // Allow mount + capability detection + the reduced-transparency hook to settle.
    await page.waitForTimeout(500);

    const backdropFilter = await surface.evaluate(
      (el) => (el as HTMLElement).style.backdropFilter || '',
    );

    // Live lensing suppressed: NO url( reference under reduce-transparency, even
    // though Chromium would normally attach it on the Showcase story.
    expect(backdropFilter).not.toContain('url(');
    // The inline SVG <filter> must not be present either (no-filter path reused).
    await expect(page.locator('filter[id^="lg-"]')).toHaveCount(0);

    // The surface stays a real, non-zero box (no layout shift / broken box).
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    // Graceful: no console/page errors.
    expect(consoleErrors).toHaveLength(0);
  });

  // Control: with the setting OFF, Chromium still attaches the refraction url(.
  // This guards against the branch firing unconditionally (regressing the
  // default-off, byte-for-byte-unchanged invariant).
  test('chromium: WITHOUT reduce-transparency the url( refraction is present', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Full refraction only in Chromium');

    const client = await page.context().newCDPSession(page);
    await setReducedTransparency(client, 'no-preference');

    await page.goto('/iframe.html?id=components-liquidglass--showcase&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });

    const surface = page.locator('[data-lg-surface]').first();
    await expect
      .poll(async () => surface.evaluate((el) => (el as HTMLElement).style.backdropFilter || ''), {
        timeout: 5000,
        message: 'backdrop-filter should contain url( with the setting off',
      })
      .toContain('url(');

    expect(consoleErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// prefers-contrast: more (plan 014).
//
// Unlike reduced-transparency, Playwright 1.61 natively supports the contrast
// media feature via `page.emulateMedia({ contrast: 'more' })`, so we drive it
// with the native API (no CDP). jsdom can't evaluate the query, so this is the
// cross-engine truth: with Increase Contrast ON the Chromium Showcase glass
// must gain a SOLID 2px inset border ring (a `... 0px 0px 0px 2px inset`
// box-shadow prepended to the soft bevel) — the visible delineated edge the
// bevel alone can't provide — while staying a non-zero, error-free surface.
//
// NOTE: a real browser RE-SERIALIZES `box-shadow` with the color FIRST and
// `inset` LAST (`rgba(...) 0px 0px 0px 2px inset`), unlike jsdom which keeps the
// authored `inset 0 0 0 2px rgba(...)` order. So this e2e matcher targets the
// reordered computed form; it keys on the 2px spread, which only the contrast
// ring uses (the bevel hairline is 1px).
// ---------------------------------------------------------------------------

/** Matches the solid inset border ring the contrast branch prepends. */
const SOLID_BORDER_RING = /0px 0px 0px 2px inset/;

test.describe('prefers-contrast: more (Showcase)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
  });

  test('chromium: increase-contrast adds the solid inset border ring', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Showcase glass is exercised on Chromium');

    // Turn "Increase contrast" ON before navigation so the live hook reads it on
    // first mount. Native API — no CDP needed for the contrast feature.
    await page.emulateMedia({ contrast: 'more' });

    await page.goto('/iframe.html?id=components-liquidglass--showcase&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Sanity: the media query really evaluates true in this context.
    const matches = await page.evaluate(
      () => window.matchMedia('(prefers-contrast: more)').matches,
    );
    expect(matches).toBe(true);

    // Allow mount + capability detection + the contrast hook to settle, then
    // assert the solid inset border ring is present on the surface box-shadow.
    await expect
      .poll(async () => surface.evaluate((el) => (el as HTMLElement).style.boxShadow || ''), {
        timeout: 5000,
        message: 'box-shadow should gain the solid inset border ring under increase-contrast',
      })
      .toMatch(SOLID_BORDER_RING);

    // The surface stays a real, non-zero box (no layout shift / broken box).
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    // Graceful: no console/page errors.
    expect(consoleErrors).toHaveLength(0);
  });

  test('chromium: WITHOUT increase-contrast there is no solid border ring', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Showcase glass is exercised on Chromium');

    await page.emulateMedia({ contrast: 'no-preference' });

    await page.goto('/iframe.html?id=components-liquidglass--showcase&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();
    await page.waitForTimeout(500);

    const boxShadow = await surface.evaluate((el) => (el as HTMLElement).style.boxShadow || '');
    // Default-off invariant: the soft bevel only, no solid inset border ring.
    expect(boxShadow).not.toMatch(SOLID_BORDER_RING);

    expect(consoleErrors).toHaveLength(0);
  });
});
