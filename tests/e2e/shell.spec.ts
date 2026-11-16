import { expect, test } from '@playwright/test';

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
  await expect(page.getByText('Buffalo River · Independent concept')).toBeVisible();
  await expect(page.getByText('Simulated demo')).toBeVisible();
  await expect(page.getByLabel(/^Simulation time 15 Jul 2026 08:45 EDT$/)).toBeVisible();
  const tiles = page.locator('.summary-zone .kpi');
  await expect(tiles).toHaveCount(4);
  // Operator KPIs (T25, T28): occupancy from agreements, check-ins for the day, open reviews, money on unconfirmed berths.
  await expect(tiles.nth(0)).toContainText('Occupancy88%Tonight · 111/126');
  // T31: check-ins logged by the clock, of the day's plan; the tile opens the arrivals board.
  await expect(tiles.nth(1)).toContainText('Arrivals3/15In by 08:45');
  await expect(tiles.nth(2)).toContainText('Needs review0');
  await expect(tiles.nth(3)).toContainText('Revenue at risk$0');
  await expect(page.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/\blive\b/i)).toHaveCount(0); // no “Live” badge masquerading as telemetry

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
