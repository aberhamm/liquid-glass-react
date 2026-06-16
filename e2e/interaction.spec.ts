/**
 * Interaction test: elastic motion on pointer movement.
 *
 * Asserts that moving the pointer to an offset position relative to the glass
 * center changes its transform (elastic motion is live). Uses the Playground
 * story which has a backdrop and a single LiquidGlass instance.
 *
 * The transform is applied to [data-lg-surface]. We read the at-rest transform,
 * move the pointer to a position offset from element center (within the 200px
 * ACTIVATION_DISTANCE), then assert the transform changed.
 *
 * Key insight: moving the pointer TO the element center yields offset {0,0}
 * which produces the identity transform. We must move the pointer to an offset
 * AWAY from center to get non-identity motion.
 *
 * Note: reduced-motion is NOT forced for this test — forcing it would suppress
 * the elastic motion we're testing.
 */

import { expect, test } from '@playwright/test';

test.describe('Elastic interaction (chromium + firefox)', () => {
  test('pointer move near glass changes transform', async ({ page, browserName }) => {
    // WebKit (Safari) has stricter privacy restrictions on mouse simulation
    // that can make headless pointer tracking unreliable for this kind of test;
    // limit to chromium + firefox where mousemove simulation is reliable.
    test.skip(browserName === 'webkit', 'Elastic motion test limited to chromium/firefox');

    await page.goto('/iframe.html?id=components-liquidglass--playground&viewMode=story');
    await page.waitForSelector('[data-lg-surface]', { state: 'visible' });

    const surface = page.locator('[data-lg-surface]').first();
    await expect(surface).toBeVisible();

    // Allow initial mount/measurement to complete
    await page.waitForTimeout(300);

    // Capture the at-rest transform (identity: translate(0px, 0px) scale(1, 1))
    const atRestTransform = await surface.evaluate(
      (el) => (el as HTMLElement).style.transform || 'none',
    );

    // Get element bounding box to compute center
    const box = await surface.boundingBox();
    if (box === null) {
      throw new Error('Surface element has no bounding box — element not visible');
    }

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Move pointer to 100px right of center — within ACTIVATION_DISTANCE (200px).
    // This gives offset {x: 100, y: 0} which produces non-identity translate/scale.
    await page.mouse.move(centerX + 100, centerY);
    await page.waitForTimeout(200);

    // Read post-move transform
    const afterMoveTransform = await surface.evaluate(
      (el) => (el as HTMLElement).style.transform || 'none',
    );

    // The transform should differ from at-rest (elastic motion activated).
    // At-rest: "translate(0px, 0px) scale(1, 1)"
    // After move: "translate(Xpx, Ypx) scale(sx, sy)" with non-zero values.
    expect(afterMoveTransform).not.toBe(atRestTransform);

    // Also move to an opposite offset to confirm the motion responds
    await page.mouse.move(centerX - 80, centerY - 60);
    await page.waitForTimeout(200);

    const afterSecondMove = await surface.evaluate(
      (el) => (el as HTMLElement).style.transform || 'none',
    );
    expect(afterSecondMove).not.toBe(atRestTransform);
    // Second position should differ from first (different offset = different transform)
    expect(afterSecondMove).not.toBe(afterMoveTransform);
  });
});
