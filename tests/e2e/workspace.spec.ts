import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { session, showList } from './helpers.ts';

const tasks = (page: Page) => page.getByRole('button', { name: /^Tasks \d/ });
const open = async (page: Page, query = '') => {
  await page.goto(`/?debug${query}`);
  await expect(page.getByTestId('task-queue')).toBeVisible();
};
const explore = async (page: Page) => {
  await page.getByRole('button', { name: 'Explore slip review', exact: true }).click();
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'uncertain');
};

test('discrepancy-first workspace completes the evidence workflow and counts unresolved work', async ({ page }) => {
  await open(page);
  await expect(page.locator('.summary-zone .kpi')).toHaveCount(2);
  await expect(tasks(page)).toHaveText('Tasks 1');
  await expect(page.getByTestId('request-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demo data', exact: true })).toBeVisible();
  await expect(page.locator('.tag:visible')).toHaveCount(0);
  await expect(page.getByTestId('day-scrubber')).not.toBeVisible();
  await explore(page);
  await expect(tasks(page)).toHaveText('Tasks 2');
  await expect(page.getByTestId('inspector')).toContainText('Held by agreement');
  await expect(page.locator('.summary-grid')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to tasks', exact: true }).click();
  await expect(tasks(page)).toHaveText('Tasks 2');
  await page.getByRole('button', { name: /Slip B-12 Vessel identity needs review/ }).click();
  await page.getByRole('button', { name: 'Request dock check', exact: true }).click();
  await expect(page.getByTestId('task-status')).toContainText('no message sent');
  await page.getByRole('button', { name: 'Review observation', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm identity & resolve', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByTestId('load-result').click();
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await confirm.click();
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'resolved');
  await expect(tasks(page)).toHaveText('Tasks 1');
  expect((await session(page)).decisions).toHaveLength(1);
  await expect(page.getByTestId('resolution-agreement')).toContainText('Unchanged');
  await page.getByText('Activity history', { exact: true }).click();
  await expect(page.getByTestId('activity-trail')).toContainText('Dock check completed');
  await expect(page.getByTestId('activity-trail')).toContainText('Issue resolved');
});

test('list/detail navigation preserves filters and scroll; empty is never bookable by implication', async ({ page }) => {
  await open(page);
  await showList(page);
  const dock = page.getByRole('combobox', { name: 'Dock', exact: true });
  await dock.selectOption('B');
  const last = page.getByRole('option', { name: /B-36/ });
  await last.scrollIntoViewIfNeeded();
  const before = await page.locator('.rail-body').evaluate((el) => el.scrollTop);
  await last.click();
  await expect(page.getByRole('heading', { name: 'Slip B-36', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to slips & vessels', exact: true }).click();
  await expect(dock).toHaveValue('B');
  expect(await page.locator('.rail-body').evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(before - 48);
  await page.getByRole('searchbox').fill('A-02');
  await dock.selectOption('all');
  await page.getByRole('option', { name: /A-02/ }).click();
  await expect(page.getByTestId('inspector')).toContainText('Availability not assessed');
  await expect(page.getByTestId('inspector')).not.toContainText('No vessel present');
  await page.getByRole('button', { name: 'Back to slips & vessels', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('A-02');
  await expect(page.getByRole('listbox')).toBeVisible();
});

test('request detail keeps fit conditions, assignment, and undo accessible', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Northern Tern/ }).click();
  const card = page.getByTestId('request-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('lake-conditions')).not.toBeVisible();
  await card.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByTestId('request-assigned')).toContainText('D-01');
  await expect(tasks(page)).toHaveText('Tasks 0');
  await card.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tasks(page)).toHaveText('Tasks 1');
  await page.getByText('Conditions & what-if', { exact: true }).click();
  await page.getByRole('radio', { name: 'SW gale (what-if)' }).check();
  await expect(page.getByTestId('lake-conditions')).toHaveAttribute('data-lake', 'sw-gale');
  await expect(card).toContainText('Verify before a real assignment');
});

for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [720, 450]] as const) {
  test(`workspace fits ${width}×${height}, with accessible controls and a prominent map`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, '&gpu=capable');
    await expect(page.getByRole('region', { name: 'Marina map', exact: true })).toBeVisible({ timeout: 30000 });
    const map = await page.locator('.scene-layer').boundingBox();
    expect(map!.height).toBeGreaterThan(height < 560 ? 200 : width < 600 ? 240 : 600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Explore slip review', exact: true })).toBeInViewport();
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations;
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    await page.screenshot({ path: `test-results/workspace-${width}.png` });
    await explore(page);
    await expect(page.getByRole('button', { name: 'Review observation', exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/workspace-review-${width}.png` });
  });
}

test('financial estimates are available on demand in arrivals, with their meaning stated', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Open the arrivals board/ }).click();
  await expect(page.getByTestId('arrivals-board')).toBeVisible();
  await expect(page.getByText('Value under review', { exact: true })).not.toBeVisible();
  await page.getByText('Revenue estimates', { exact: true }).click();
  await expect(page.getByText('Value under review', { exact: true })).toBeVisible();
  await expect(page.getByTestId('arrivals-board')).toContainText('not a forecast of lost revenue');
});

test('demo replay stays read-only and returns to the same interactive run', async ({ page }) => {
  await open(page);
  await explore(page);
  const before = await session(page);
  await page.locator('.demo-tray > summary').click();
  await page.getByRole('button', { name: 'Guided replay', exact: true }).click();
  await expect(page.getByTestId('replay-banner')).toContainText('read-only');
  await expect(page.getByRole('button', { name: 'Review observation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Return to my run', exact: true }).click();
  expect(await session(page)).toEqual(before);
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'uncertain');
});
