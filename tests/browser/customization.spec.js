import { test, expect } from '@playwright/test';

test('standard mode repeats the rhythm, can be edited, and opens dynamic on reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Kalo te standardi' }).click();
  await expect(page.getByRole('heading', { name: 'Merr frymë', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(5040);
  await expect(page.getByRole('heading', { name: 'Nxirr frymën', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ndrysho timerin' }).click();
  await expect(page.getByRole('button', { name: 'Vazhdo', exact: true })).toBeDisabled();
  await page.getByLabel('Marrja e frymës').fill('4');
  await page.getByLabel('Numri i cikleve').fill('2');
  await page.getByRole('button', { name: 'Ruaj ndryshimet' }).click();
  await expect(page.getByRole('timer')).toHaveText('00:04');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(18080);
  await expect(page.getByRole('heading', { name: 'Seanca përfundoi' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await page.getByRole('button', { name: 'Kalo te standardi' }).click();
  await expect(page.getByRole('timer')).toHaveText('00:04');
});

test('dynamic editor adds/removes rounds, validates, cancels and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ndrysho timerin' }).click();
  await page.getByLabel('Frymëmarrje · raundi 1').fill('0');
  await expect(page.getByRole('button', { name: 'Ruaj ndryshimet' })).toBeDisabled();
  await page.getByLabel('Frymëmarrje · raundi 1').fill('40');
  await page.getByLabel('Mbajtje · raundi 1').fill('0');
  await page.getByRole('button', { name: '+ Shto raund', exact: true }).click();
  await page.getByRole('button', { name: 'Hiq raundin 2', exact: true }).click();
  await page.getByRole('button', { name: 'Ruaj ndryshimet' }).click();
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('00:40');
  await expect(page.locator('.round-card').first()).not.toContainText('Mbajtje e frymës');
  await page.getByRole('button', { name: 'Ndrysho timerin' }).click();
  await page.getByLabel('Frymëmarrje · raundi 1').fill('80');
  await page.getByRole('button', { name: 'Anulo', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText('00:40');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'Ndrysho timerin' }).click();
  await page.getByRole('button', { name: 'Pamje e errët', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/editor-dark-mobile.png', fullPage: true });
});

test('all ambient tracks play, switch independently and remain available offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Nise muzikën' }).click();
  for (const sound of ['rain', 'wind', 'stream', 'waves']) {
    await page.getByLabel('Tingulli i sfondit').selectOption(sound);
    await expect.poll(() => page.locator('audio').evaluate(a => !a.paused && a.readyState >= 2)).toBe(true);
    await expect(page.getByRole('timer')).toHaveText('01:00');
  }
  await page.getByRole('button', { name: 'Ndal muzikën' }).click();
  await page.getByLabel('Tingulli i sfondit').selectOption('rain');
  expect(await page.locator('audio').evaluate(a => a.paused)).toBe(true);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByLabel('Tingulli i sfondit')).toHaveValue('rain');
  expect(await page.locator('audio').evaluate(a => a.paused)).toBe(true);
});
