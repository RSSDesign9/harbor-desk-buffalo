/**
 * T17 responsive journeys on the production build: desktop 1440×900 and 1280×800, tablet 1024×768, mobile
 * 390×844. Real 200 % browser zoom is in zoom.spec.ts (its own project: no emulated device).
 */
import { expect, test } from '@playwright/test';
import { btn, dispatch, ISSUE, openApp, session, zoneOverlaps } from './helpers.ts';

test('desktop 1440×900 and 1280×800: no zone collisions; the selected boat stays in the open scene beside the inspector', async ({ page }) => {
  for (const [w, h] of [[1440, 900], [1280, 800]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await openApp(page, '', { scene: true });
    await page.evaluate(() => localStorage.removeItem('harbor-desk:session')); // each size starts from the seed
    await openApp(page, '', { scene: true });
    await dispatch(page, { type: 'advanceToUncertain' });
    await btn(page, 'Explore slip review').click();
    await page.waitForFunction(() => (window as unknown as { __harborScene: { camera: { flying(): boolean } } }).__harborScene.camera.flying() === false);
    await expect(page.locator('.app')).toHaveAttribute('data-layout', 'desktop');
    expect(await zoneOverlaps(page)).toEqual([]);
    const p = await page.evaluate(() => (window as unknown as { __harborScene: { project(id: string, part: string): { x: number; y: number } } }).__harborScene.project('B-12', 'hull'));
    const rail = (await page.locator('.rail').boundingBox())!;
    const top = (await page.locator('.topbar').boundingBox())!;
    const bottom = (await page.locator('.bottom-left-zone').boundingBox())!;
    expect(p.x).toBeLessThan(rail.x - 20);
    expect(p.y).toBeGreaterThan(top.y + top.height);
    expect(p.y < bottom.y || p.x > bottom.x + bottom.width).toBe(true);
    // Nothing else is on top of the boat's screen point.
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [p.x, p.y])).toBe('CANVAS');
    await page.screenshot({ path: `qa/handoff/e2e-desktop-${w}-uncertain.png` });
  }
});

test('tablet 1024×768: one rail with Details / list navigation, collapsible, no collisions', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page, '', { scene: true });
  await expect(page.locator('.app')).toHaveAttribute('data-layout', 'tablet');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: /^B-12/ }).click();
  await expect(page.locator('#inspector-title')).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0); // Details replaces the list
  await btn(page, 'Slips & vessels').click();
  await expect(page.getByRole('listbox')).toBeFocused();
  expect((await session(page)).selection).toEqual({ kind: 'slip', id: 'B-12' }); // back keeps the selection
  await btn(page, 'Details').click();
  await expect(page.locator('#inspector-title')).toBeVisible();
  expect(await zoneOverlaps(page)).toEqual([]);
  await btn(page, 'Hide panel').click();
  await expect(page.locator('#rail-body')).toBeHidden();
  await expect(btn(page, 'Show panel')).toHaveAttribute('aria-expanded', 'false');
  expect(await zoneOverlaps(page)).toEqual([]);
  await btn(page, 'Show panel').click();
  await expect(page.locator('#inspector-title')).toBeVisible();
  await page.screenshot({ path: 'qa/handoff/e2e-tablet-1024-details.png' });
});

for (const path of ['direct', 'pending'] as const) {
  test(`mobile 390×844: plan + sheet, no 3D; ${path} path resolves with taps`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    await expect(page.locator('.app')).toHaveAttribute('data-layout', 'mobile');
    await expect(page.getByTestId('plan-view')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0); // lightweight by default
    await expect(page.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeAttached();
    expect(await zoneOverlaps(page)).toEqual([]);
    // Select B-12 on the plan itself (zoom to Dock B first; slips are tappable at dock scale).
    await page.getByRole('button', { name: 'Zoom to dock B' }).click();
    await page.locator('[data-slip="B-12"] .plan-berth').click();
    await expect(page.getByTestId('plan-marker')).toHaveText('B-12 · Empty · assigned');
    await expect(page.locator('#inspector-title')).toContainText('Slip B-12');
    await btn(page, 'Show dock-walk discrepancy').click();
    await expect(page.getByTestId('plan-marker')).toHaveText('B-12 · Vessel present · identity unverified');
    await expect(page.locator('[data-slip="B-12"]')).toHaveAttribute('data-review', 'true');
    if (path === 'pending') {
      await page.getByTestId('request-dock-check').click();
      await expect(page.getByTestId('task-status')).toContainText('no message sent');
    }
    await btn(page, 'Review observation').click();
    await btn(page, 'Load simulated dock-check result').click();
    await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
    await btn(page, 'Confirm identity & resolve').click();
    await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
    await expect(page.getByTestId('plan-marker')).toHaveText('B-12 · Lake Effect');
    await expect(page.locator('[data-slip="B-12"]')).not.toHaveAttribute('data-review', 'true');
    const s = await session(page);
    expect(s.decisions).toHaveLength(1);
    expect(s.tasks.map((t) => t.status)).toEqual(path === 'pending' ? ['completed'] : []);
    await expect(page.getByTestId('activity-trail')).toContainText('Camera C-02 · second source · possible match Harbor Light');
    await page.screenshot({ path: `qa/handoff/e2e-mobile-390-resolved-${path}.png` });
    // Back to the list keeps the record selected and the sheet scrolls from the top.
    await btn(page, 'Slips & vessels').click();
    await expect(page.getByRole('listbox')).toBeFocused();
    await expect(page.getByRole('option', { name: /^B-12/ })).toHaveAttribute('aria-selected', 'true');
  });
}

test('changing viewport, view and theme keeps selection and the open review exactly as they were', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, '', { scene: true });
  for (const c of [{ type: 'advanceToUncertain' }, { type: 'select', selection: { kind: 'slip', id: 'B-12' } }, { type: 'requestDockCheck', issueId: ISSUE }, { type: 'openReview', issueId: ISSUE }, { type: 'loadDockCheckResult', issueId: ISSUE }]) await dispatch(page, c);
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  const before = await session(page);
  for (const [w, h] of [[390, 844], [1024, 768], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).toBeChecked();
    await expect(btn(page, 'Confirm identity & resolve')).toBeEnabled();
    expect(await session(page)).toEqual(before);
  }
  await btn(page, 'Display').click();
  await page.getByRole('radio', { name: /Chart/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('checkbox', { name: /Solid panels/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-solid-panels', 'true');
  await page.keyboard.press('Escape');
  await expect(btn(page, 'Display')).toBeFocused();
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  expect(await session(page)).toEqual(before);
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).toBeChecked();
  await page.screenshot({ path: 'qa/handoff/e2e-desktop-light-solid-review.png' });
});
