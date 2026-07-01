/**
 * Cross-browser FROSTED PARITY (plan 028).
 *
 * The primary web success criterion is that the frosted DEFAULT looks consistent
 * across Chrome, Firefox, and Safari (WebKit), and that SVG displacement appears
 * ONLY where supported (Chromium) when opted in. `refraction.spec.ts` already
 * asserts url( absence + blur/saturate on the default and url( presence on the
 * displacement story; it does NOT assert that the full frosted RECIPE (tint fill
 * + hairline ring + drop shadow) is structurally present on every engine. This
 * spec adds that cross-engine parity coverage and the per-browser visual
 * baselines (chromium + firefox + webkit).
 *
 * Stable DOM selectors (do NOT modify the component to make these pass):
 *   [data-lg-surface] — glass surface: backdrop-filter + tint background +
 *                       inset hairline ring / bevel box-shadow.
 *   [data-lg-shadow]  — decoupled sibling carrying the outer drop shadow
 *                       (rgba(0,0,0,...) — never inset, never on the clipped node).
 *
 * Frosted recipe tokens (src/tokens.ts, src/glass-edge.ts):
 *   - tint:     FROSTED_DEFAULT_FILL   = rgba(255, 255, 255, 0.1)  → surface background-color
 *   - hairline: FROSTED_HAIRLINE_RING  = rgba(255, 255, 255, 0.5) 1px inset ring,
 *               PREPENDED to the bevel. The 0.5 alpha is distinct from every bevel
 *               inset (0.75 / 0.4 / 0.22 / 0.1), so matching it proves the hairline
 *               specifically — not just "some inset shadow exists".
 *   - shadow:   buildDropShadow(...)   → outer rgba(0,0,0,α) box-shadow on [data-lg-shadow].
 *
 * Serialization differs across engines, so assertions match on substrings/tokens
 * (blur(, saturate(, the rgb triplet + alpha), never exact strings.
 */

import { expect, test } from '@playwright/test';

const SHOWCASE_STORY = '/iframe.html?id=components-liquidglass--showcase&viewMode=story';
const DISPLACEMENT_STORY =
  '/iframe.html?id=components-liquidglass--displacement-showcase&viewMode=story';

/** Read the surface backdrop-filter, tolerating the -webkit- prefixed property. */
async function readBackdropFilter(surface: import('@playwright/test').Locator): Promise<string> {
  return surface.evaluate((el) => {
    const s = (el as HTMLElement).style;
    return s.backdropFilter || s.webkitBackdropFilter || '';
  });
}

// ---------------------------------------------------------------------------
// Frosted DEFAULT — the recipe must be STRUCTURALLY present on ALL three engines.
// Each of these tests runs on chromium, firefox AND webkit (no browserName skip).
// ---------------------------------------------------------------------------

test.describe('Frosted default — cross-browser parity (all engines)', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto(SHOWCASE_STORY);
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
    // Let mount + capability detection settle so the frosted recipe is stable.
    await page.waitForTimeout(500);
  });

  test('backdrop-filter: blur() + saturate(), never url( — every engine', async ({ page }) => {
    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    const bf = await readBackdropFilter(surface);
    // Portable frosted backdrop on every engine…
    expect(bf).toContain('blur(');
    expect(bf).toContain('saturate(');
    // …and NEVER an SVG displacement reference on the default path.
    expect(bf).not.toContain('url(');
    // No inline SVG <filter> is rendered on the default path, on any engine.
    await expect(page.locator('filter[id^="lg-"]')).toHaveCount(0);

    expect(consoleErrors).toHaveLength(0);
  });

  test('tint fill: translucent-white surface background — every engine', async ({ page }) => {
    const surface = page.locator('[data-lg-surface]').first();
    const bg = await surface.evaluate((el) => getComputedStyle(el).backgroundColor);

    // FROSTED_DEFAULT_FILL is rgba(255, 255, 255, 0.1). Parse the computed value
    // (serialization varies) and assert it is a translucent WHITE fill — a real
    // milky body, not opaque and not fully transparent.
    const match = bg.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    expect(match, `expected an rgb(a) surface background, got "${bg}"`).not.toBeNull();
    const [, r, g, b, a] = match ?? [];
    expect(r).toBe('255');
    expect(g).toBe('255');
    expect(b).toBe('255');
    const alpha = a === undefined ? 1 : Number.parseFloat(a);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  test('hairline ring: inset translucent-white ring in surface box-shadow — every engine', async ({
    page,
  }) => {
    const surface = page.locator('[data-lg-surface]').first();
    const boxShadow = await surface.evaluate((el) => getComputedStyle(el).boxShadow);

    expect(boxShadow).not.toBe('none');
    // The frosted hairline is an INSET ring…
    expect(boxShadow).toContain('inset');
    // …and its 0.5-alpha white is distinct from every bevel inset (0.75/0.4/0.22/0.1),
    // so this matches the hairline specifically rather than any inset shadow.
    expect(boxShadow).toMatch(/255,\s*255,\s*255,\s*0?\.5\b/);
  });

  test('drop shadow: decoupled outer shadow sibling present — every engine', async ({ page }) => {
    const shadow = page.locator('[data-lg-shadow]').first();
    await expect(shadow).toBeAttached();

    const boxShadow = await shadow.evaluate((el) => getComputedStyle(el).boxShadow);
    // buildDropShadow emits outer rgba(0,0,0,α) layers (never inset) on a sibling
    // node so the glow is not clipped by the surface's overflow:hidden.
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).toMatch(/rgba?\(\s*0,\s*0,\s*0/);
    expect(boxShadow).not.toContain('inset');
  });

  // Per-browser VISUAL baseline for the frosted default. Runs on ALL three
  // projects (no browserName skip), so Playwright generates and diffs
  // frosted-parity-glass-{chromium,firefox,webkit}-darwin.png.
  test('visual baseline: frosted-default surface per engine (pixel-diff)', async ({ page }) => {
    // Baselines are platform-suffixed and generated on darwin; a Linux CI runner
    // can't match a darwin baseline, so skip there to keep CI green while
    // preserving the blocking visual gate locally (macOS). Mirrors
    // refraction.spec.ts. To run on CI, commit Linux baselines and drop this.
    test.skip(
      process.platform !== 'darwin',
      'Visual baselines are darwin-pinned; need Linux baselines to run on CI',
    );

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Screenshot the glass surface element (not the animated page) for stability.
    await expect(surface).toHaveScreenshot('frosted-parity-glass.png', {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    });
  });
});

// ---------------------------------------------------------------------------
// Displacement opt-in — the SVG backdrop bend is Chromium-only. Self-contained
// here (does not depend on refraction.spec.ts) so the parity story is complete:
// url( appears on chromium, NEVER on firefox/webkit (silent frosted fallback).
// ---------------------------------------------------------------------------

test.describe('Displacement opt-in — url( only where supported (all engines)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DISPLACEMENT_STORY);
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });
  });

  test('backdrop-filter url( present on chromium, absent on firefox/webkit', async ({
    page,
    browserName,
  }) => {
    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    if (browserName === 'chromium') {
      // Chromium attaches the SVG filter — backdrop-filter gains a url( reference.
      await expect
        .poll(async () => readBackdropFilter(surface), {
          timeout: 5000,
          message: 'backdrop-filter should contain url( in Chromium',
        })
        .toContain('url(');
      await expect(page.locator('filter[id^="lg-"]').first()).toBeAttached();
    } else {
      // Firefox / WebKit: displacement is a silent no-op — the frosted fallback
      // renders with NO url( reference, but the portable blur backdrop remains.
      await page.waitForTimeout(500);
      const bf = await readBackdropFilter(surface);
      expect(bf).not.toContain('url(');
      expect(bf).toContain('blur(');
      await expect(page.locator('filter[id^="lg-"]')).toHaveCount(0);
    }
  });
});
