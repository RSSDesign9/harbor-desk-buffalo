/**
 * Batch 13 — T35 Buffalo seiche and gale what-if feeding the T30 fit verdicts (PRD F23 option E).
 * Real keys and pointer drags; the store is read only to check outcomes.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { announcer, btn, demoControls, openApp, openConditions, openRequest, session } from './helpers.ts';

type W = {
  __harborScene: { project(id: string): { x: number; y: number } | null; camera: { flying(): boolean } | null; map(): { mode: boolean; mix: number }; weather(): { toward: [number, number]; strength: number; whitecaps: number; sunIntensity: number } };
  __harborDesk: { store: { getState(): { lake: string; view: { mode: string }; interactive: { assignments: { id: string; slipId: string; lake?: string; undoneAt: string | null }[]; clock: string; issues: unknown[] } } } };
};
const state = (page: Page) => page.evaluate(() => (window as unknown as W).__harborDesk.store.getState());
const weather = (page: Page) => page.evaluate(() => (window as unknown as W).__harborScene.weather());
const slipOptions = (page: Page) => page.getByRole('combobox', { name: 'Slip' }).locator('option').allTextContents();
const lake = (page: Page) => page.getByTestId('lake-conditions');
const setScrub = (page: Page, minutes: number) =>
  page.getByRole('slider', { name: 'Day timeline' }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, minutes);

test('T35 keyboard: the gale what-if re-checks every offered slip, assigns under it, and flags an assignment that no longer fits', async ({ page }) => {
  await openApp(page);
  await openRequest(page);
  await openConditions(page); // the what-if is a disclosure inside the request since the workspace refresh
  await expect(lake(page)).toBeVisible();
  // DESIGN §17: no routine SIM badge; the card states that fit uses assumed inputs and must be verified.
  await expect(page.getByTestId('request-card')).toContainText('assumed depths');
  await expect(page.getByTestId('request-card')).toContainText('Verify before a real assignment');
  const calm = page.getByRole('radio', { name: 'Calm' });
  await expect(calm).toBeChecked();
  expect((await slipOptions(page))[0]).toBe('D-01 · Fits');

  // Native radio group: an arrow key moves the choice.
  await calm.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'SW gale (what-if)' })).toBeChecked();
  await expect(announcer(page)).toContainText('SW gale what-if. Low water −1.5\u00a0ft at 18:45 during the stay. Northern Tern: 0 fit, 1 tight, 14 no fit.');
  await expect(page.getByTestId('lake-now')).toContainText(/08:45 · SW 3\d\u00a0kt, gusts 4\d · level \+4\u00a0ft/);
  await expect(page.getByTestId('lake-stay')).toContainText('Stay low −1.5\u00a0ft at 18:45');
  const gale = await slipOptions(page);
  expect(gale[0]).toBe('D-01 · Tight');
  expect(gale.slice(1).every((o) => o.endsWith('· No fit'))).toBe(true);
  await expect(page.locator('.request-why')).toContainText('Tight: Draft 4.5\u00a0ft in 5.5\u00a0ft of water at the 18:45 low (7\u00a0ft assumed, −1.5\u00a0ft)');
  await page.screenshot({ path: 'qa/handoff/e2e-gale-request.png' });
  const axe = await new AxeBuilder({ page }).include('[data-testid="request-card"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // D-19 was tight on the calm day; under the gale it is a no fit and Assign is disabled.
  await page.getByRole('combobox', { name: 'Slip' }).selectOption('D-19');
  await expect(btn(page, 'Assign')).toBeDisabled();
  await expect(page.locator('.request-why')).toContainText('aground');

  // Assign D-01 under the gale: the record carries the what-if.
  await page.getByRole('combobox', { name: 'Slip' }).selectOption('D-01');
  await btn(page, 'Assign').click();
  await expect(page.getByTestId('request-assigned')).toContainText('Assigned to D-01');
  expect((await state(page)).interactive.assignments).toEqual([expect.objectContaining({ slipId: 'D-01', lake: 'sw-gale', undoneAt: null })]);
  // Back to calm: D-01 only gets better, so nothing is flagged.
  await page.getByRole('radio', { name: 'Calm' }).check();
  await expect(page.getByTestId('request-drift')).toHaveCount(0);
  await btn(page, 'Undo').click();

  // Assign D-19 on the calm day, then switch to the gale: the assignment is flagged, not changed.
  await page.getByRole('combobox', { name: 'Slip' }).selectOption('D-19');
  await btn(page, 'Assign').click();
  await expect(page.getByTestId('request-assigned')).toContainText('Assigned to D-19');
  await openConditions(page); // the assigned card renders its own Conditions disclosure, closed
  await page.getByRole('radio', { name: 'SW gale (what-if)' }).check();
  await expect(page.getByTestId('request-drift')).toContainText('Under the SW gale what-if D-19 is a no fit: Draft 4.5\u00a0ft in 4\u00a0ft of water at the 18:45 low');
  const s = await state(page);
  expect(s.interactive.assignments.filter((a) => a.undoneAt === null)).toEqual([expect.objectContaining({ slipId: 'D-19', lake: 'calm' })]);
  // The lens never moves the run: same clock, no issues.
  const run = await session(page);
  expect(run.clock).toBe('2026-07-15T12:45:00Z');
  expect(run.issues).toEqual([]);
});

test('T35 scene and timeline: the gale shows on the water and in the light, follows the scrubber, and the calm day is untouched', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await openRequest(page);
  await openConditions(page);
  // Calm: no wind on the water, authored light.
  const c = await weather(page);
  expect(c).toMatchObject({ strength: 0, whitecaps: 0 });
  await page.getByRole('radio', { name: 'SW gale (what-if)' }).check();
  await expect.poll(async () => (await weather(page)).strength).toBeGreaterThan(0.9);
  const g = await weather(page);
  expect(g.whitecaps).toBe(1);
  expect(g.sunIntensity).toBeLessThan(c.sunIntensity * 0.6);
  expect(g.toward[0]).toBeGreaterThan(0.6); // blowing toward the north-east
  expect(g.toward[1]).toBeLessThan(-0.5);

  // Scrub to 20:00: read-only replay, the wind has eased, the level is below still water, and the switch still works.
  await demoControls(page);
  await setScrub(page, 14 * 60);
  await expect(page.getByTestId('lake-now')).toContainText(/^20:00 · .* level −/);
  expect((await state(page)).view.mode).toBe('replay');
  await expect.poll(async () => (await weather(page)).strength).toBeLessThan(0.6);
  await expect(btn(page, 'Assign')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Calm' }).check();
  await expect.poll(async () => (await weather(page)).strength).toBe(0);
  expect((await state(page)).lake).toBe('calm');
});

test('T35 drag on the dock map under the gale: verdicts and reasons follow the what-if', async ({ page }) => {
  await openApp(page, '&lake=sw-gale', { scene: true });
  await openRequest(page);
  await openConditions(page);
  await expect(page.getByRole('radio', { name: 'SW gale (what-if)' })).toBeChecked();
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await page.waitForFunction(() => {
    const h = (window as unknown as W).__harborScene;
    return h.map().mix === 1 && !h.camera!.flying();
  });
  await page.waitForTimeout(300);
  const dragTo = async (slipId: string) => {
    const handle = (await page.getByTestId('request-drag').boundingBox())!;
    const p = (await page.evaluate((id) => (window as unknown as W).__harborScene.project(id), slipId))!;
    await page.mouse.move(handle.x + 16, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y, { steps: 10 });
  };
  await dragTo('D-19');
  await expect(page.getByTestId('drag-chip')).toContainText('D-19 · No fit');
  await expect(page.locator('.scene-marker-hover')).toContainText('D-19 · No fit · Draft 4.5');
  await page.mouse.up();
  await expect(announcer(page)).toContainText('No fit at D-19');
  expect((await state(page)).interactive.assignments).toEqual([]);
  await dragTo('D-01');
  await expect(page.getByTestId('drag-chip')).toContainText('D-01 · Tight');
  await page.screenshot({ path: 'qa/handoff/e2e-gale-drag-d01.png' });
  await page.mouse.up();
  await expect(page.getByTestId('request-assigned')).toContainText('Assigned to D-01');
  expect((await state(page)).interactive.assignments).toEqual([expect.objectContaining({ slipId: 'D-01', lake: 'sw-gale' })]);
});
