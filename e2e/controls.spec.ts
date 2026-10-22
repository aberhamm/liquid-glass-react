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
