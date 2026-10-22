import { expect, test } from '@playwright/test';

const story = (name: string) =>
  `/iframe.html?id=themes-liquid-glass-${name}--default&viewMode=story`;

test('switch supports keyboard input and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(story('glass-switch'));
  const control = page.getByRole('switch', { name: 'Notifications' });
  await expect(control).toBeChecked();
  await control.focus();
  await page.keyboard.press('Space');
  await expect(control).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(control).toBeChecked();
});

test('slider supports arrow keys, Home and End', async ({ page }) => {
  await page.goto(story('glass-slider'));
  const control = page.getByRole('slider', { name: 'Volume' });
  await control.focus();
  await page.keyboard.press('ArrowRight');
  await expect(control).toHaveValue('51');
  await page.keyboard.press('Home');
  await expect(control).toHaveValue('0');
  await page.keyboard.press('End');
  await expect(control).toHaveValue('100');
});

test('segmented control has native radio keyboard behavior', async ({ page }) => {
  await page.goto(story('glass-segmented-control'));
  await page.getByRole('radio', { name: 'Week' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Month' })).toBeChecked();
});

test('button is clickable and disabled state is enforced', async ({ page }) => {
  await page.goto(story('glass-button'));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved 1 time')).toBeVisible();
  await page.goto(`${story('glass-button')}&args=disabled:true`);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});

test('notification copy lens renders on a narrow viewport without page errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story('glass-notification'));
  await expect(page.getByText('The glass collection is ready.')).toBeVisible();
  await expect(page.locator('svg filter').first()).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// Compare real rendered pixels with displacement enabled and disabled, keeping
// blur, tint and highlights unchanged. This catches a glass-looking flat fill.
test('button visibly bends the pattern instead of merely frosting it', async ({ page }) => {
  await page.goto(story('glass-button'));
  const shell = page.locator('.matui-glass-button-shell');
  await expect(shell.locator('feDisplacementMap').first()).toBeAttached();
  await expect
    .poll(() => shell.locator('feImage').first().getAttribute('href'))
    .toMatch(/^data:image\/png;base64,.{500}/);
  await page.getByRole('button', { name: 'Save changes' }).evaluate((el) => {
    el.style.color = 'transparent';
  });
  const refracted = await shell.screenshot({ animations: 'disabled' });
  await shell.locator('feDisplacementMap').evaluateAll((nodes) => {
    for (const node of nodes) node.setAttribute('scale', '0');
  });
  // Firefox/WebKit may cache SVG output by filter id. Force a fresh flat raster.
  await shell.locator('filter').evaluateAll((filters) => {
    for (const filter of filters) {
      const oldId = filter.id;
      const newId = `${oldId}-flat`;
      filter.id = newId;
      const root = filter.closest('.matui-glass-button-shell');
      for (const node of root?.querySelectorAll<HTMLElement>('[style]') ?? []) {
        const value = node.style.filter;
        if (value.includes(`#${oldId}`))
          node.style.filter = value.replace(`#${oldId}`, `#${newId}`);
      }
    }
  });
  const flat = await shell.screenshot({ animations: 'disabled' });
  const difference = await page.evaluate(
    async ({ a, b }) => {
      const decode = async (value: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${value}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No canvas context for pixel comparison');
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          data: context.getImageData(0, 0, image.width, image.height).data,
        };
      };
      const [actual, baseline] = await Promise.all([decode(a), decode(b)]);
      let changed = 0;
      let total = 0;
      for (let y = 5; y < actual.height - 5; y++) {
        for (let x = 5; x < actual.width - 5; x++) {
          const i = (y * actual.width + x) * 4;
          const delta =
            Math.abs(actual.data[i] - baseline.data[i]) +
            Math.abs(actual.data[i + 1] - baseline.data[i + 1]) +
            Math.abs(actual.data[i + 2] - baseline.data[i + 2]);
          if (delta > 30) changed++;
          total++;
        }
      }
      return changed / total;
    },
    { a: refracted.toString('base64'), b: flat.toString('base64') },
  );
  // At least 10% of interior pixels must visibly move, allowing engine raster differences.
  expect(difference).toBeGreaterThan(0.1);
});
