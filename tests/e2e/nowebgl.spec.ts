/**
 * T18: a browser with WebGL genuinely switched off (Chromium launch flags, not the app's fault switch).
 * The app must notice by itself and give the plan, list and inspector with the full review.
 */
import { expect, test } from '@playwright/test';
import { btn, session } from './helpers.ts';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] } });

test('browser without WebGL: plan, list and the complete review; a plain notice; no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug');
  expect(await page.evaluate(() => document.createElement('canvas').getContext('webgl2') === null && document.createElement('canvas').getContext('webgl') === null)).toBe(true);
  await expect(page.getByText('This browser has no WebGL. The plan and list show the same records.')).toBeVisible();
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await btn(page, 'Explore slip review').click();
  await btn(page, 'Show dock-walk discrepancy').click();
  await page.getByTestId('request-dock-check').click();
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.getByTestId('activity-trail')).toContainText('Dock check completedTSK-0001 closed');
  expect((await session(page)).decisions).toHaveLength(1);
  expect(errors).toEqual([]);
});
