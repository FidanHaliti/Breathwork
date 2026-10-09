import { test, expect } from '@playwright/test';

async function headingContrast(page) {
  return page.evaluate(() => {
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(getComputedStyle(document.querySelector('h1')).color);
    const background = luminance(getComputedStyle(document.documentElement).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

test('theme follows the device until a choice is saved and works without restarting the timer', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await headingContrast(page)).toBeGreaterThan(4.5);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141d19');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await headingContrast(page)).toBeGreaterThan(4.5);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(12000);
  await expect(page.getByRole('timer')).toHaveText('00:48');
  const toggle = page.getByRole('button', { name: 'Pamje e errët', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('timer')).toHaveText('00:48');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.clock.fastForward(1000);
  await expect(page.getByRole('timer')).toHaveText('00:47');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('breathwork.theme'))).toBe('dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await toggle.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme toggle also works when optional local storage is blocked', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pamje e errët', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('guidance and completed session are readable on mobile in both themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(610000);
  await expect(page.getByRole('heading', { name: 'Seanca përfundoi' })).toBeVisible();
  await expect(page.locator('.complete-text')).toHaveText('Merr frymënormalisht.');
  await page.screenshot({ path: 'test-results/light-complete-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Pamje e errët', exact: true }).click();
  await page.screenshot({ path: 'test-results/dark-complete-mobile.png', fullPage: true });
  await page.locator('.practice-guide summary').click();
  await expect(page.locator('.guide-content')).toBeVisible();
  await expect(page.locator('.guide-content')).toContainText('kohët janë orientuese');
  await page.screenshot({ path: 'test-results/dark-guide-mobile.png', fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/dark-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
