import { expect, test } from '@playwright/test';
import { btn, needsReview } from './helpers.ts';

// Production build: honesty labels visible, dataset counts derived, local-only network, clean console.
test('shell loads locally with labels, derived counts and no console errors', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http')) external.push(req.url());
  });

  await page.goto('/');
  await expect(page.locator('.lockup-word')).toHaveText('Harbor Desk');
  // Workspace refresh (DESIGN §17): the place line is hidden on desktop (kept in the title); the persistent
  // honesty label is “Demo data”, which opens About / Sources.
  await expect(page).toHaveTitle(/Independent concept/);
  await expect(page.getByText('Buffalo River · Independent concept')).toBeAttached();
  await expect(btn(page, 'Demo data')).toBeVisible();
  await expect(page.getByLabel(/^Simulation time 15 Jul 2026 08:45 EDT$/)).toBeVisible();
  const tiles = page.locator('.summary-zone .kpi');
  await expect(tiles).toHaveCount(2);
  // Overview strip (refresh): occupancy from agreements and check-ins by the clock, values above labels.
  await expect(tiles.nth(0)).toContainText('88%Occupied tonight111 of 126 slips');
  await expect(tiles.nth(1)).toContainText(/3\s*\/\s*15Arrived todayIn by 08:45/);
  // Open reviews are counted in Tasks; money on unconfirmed berths lives in the arrivals board.
  await expect(needsReview(page)).toHaveText('0');
  await btn(page, /Open the arrivals board/).click();
  await page.getByText('Revenue estimates', { exact: true }).click();
  await expect(page.getByTestId('arrivals-board')).toContainText('Value under review$0');
  await expect(page.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/\blive\b/i)).toHaveCount(0); // no “Live” badge masquerading as telemetry

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
