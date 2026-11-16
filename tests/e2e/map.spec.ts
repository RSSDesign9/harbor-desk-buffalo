/**
 * T29 — 3D dock map mode (PRD F19). The map replaces the old Top-down preset: a tilted, long-lens view of all 126
 * berths with status plates, slip numbers when zoomed in and a legend. On a small screen a capable GPU opens on
 * it; the flat plan stays the fallback. Headless Chromium renders in software, so the GPU probe is overridden
 * with `?debug&gpu=capable|low` (src/scene/webgl.ts).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { btn, dispatch, session } from './helpers.ts';

type Pose = { position: number[]; target: number[]; fov: number };
type Bridge = {
  camera: { flying(): boolean; pose(): Pose; map(): { pxPerM: number }; jump(p: Pose): void } | null;
  project(id: string): { x: number; y: number } | null;
  pick(x: number, y: number): { slipId: string } | { blockedBy: string } | null;
  map(): { mode: boolean; mix: number };
  stats(): { calls: number; triangles: number };
};
type Win = { __harborScene?: Bridge; __harborDesk: { store: { getState(): { fixtures: { slips: { id: string }[] } } } } };

async function openMap(page: Page, query = '') {
  await page.goto(`/?debug${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as Win).__harborScene?.camera), undefined, { timeout: 30_000 });
}
/** Wait until the map is fully up and the camera has landed. */
const settled = (page: Page) =>
  page.waitForFunction(() => {
    const h = (window as unknown as Win).__harborScene!;
    return h.map().mode && h.map().mix === 1 && !h.camera!.flying();
  }, undefined, { timeout: 15_000 });

/** For every slip: on the canvas (not under a panel) and a click there would select exactly that slip. */
const audit = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    const h = w.__harborScene!;
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const bad: string[] = [];
    const ids = w.__harborDesk.store.getState().fixtures.slips.map((s) => s.id);
    for (const id of ids) {
      const p = h.project(id)!;
      const onCanvas = p.x > canvas.left && p.x < canvas.right && p.y > canvas.top && p.y < canvas.bottom;
      const top = document.elementFromPoint(p.x, p.y);
      const pick = h.pick(p.x, p.y);
      if (!onCanvas || top?.tagName !== 'CANVAS' || !pick || !('slipId' in pick) || pick.slipId !== id) bad.push(`${id}: ${onCanvas ? '' : 'off-canvas '}${top?.tagName ?? ''} ${JSON.stringify(pick)}`);
    }
    return { total: ids.length, bad };
  });

/** The suite's saved display preferences (motion paused), with the small-screen map left on auto. */
const resetPrefs = (page: Page) =>
  page.evaluate(() => localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', solidPanels: false, motionPaused: true, mobileView: 'auto' })));

const legendCounts = async (page: Page) => {
  const text = await page.getByTestId('map-legend').locator('.map-legend-count').allTextContents();
  return text.map(Number);
};

for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
  test(`map pose at ${w}×${h}: all 126 slips visible and pickable, legend shown, a real click selects`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openMap(page, '&gpu=capable');
    if (w >= 768) await page.getByRole('radio', { name: 'Map', exact: true }).click(); // mobile opens on the map
    await settled(page);
    await expect(page.locator('.app')).toHaveAttribute('data-map', '3d');
    const pose = await page.evaluate(() => (window as unknown as Win).__harborScene!.camera!.pose());
    expect(pose.fov).toBe(2);
    const result = await audit(page);
    expect(result.total).toBe(126);
    expect(result.bad).toEqual([]);
    // Legend: five statuses, counted, adding up to every slip.
    const legend = page.getByTestId('map-legend');
    await expect(legend).toBeVisible();
    await expect(legend.locator('li')).toHaveText([/^Occupied/, /^Away/, /^Reserved/, /^Needs review/, /^Vacant/]);
    expect((await legendCounts(page)).reduce((a, b) => a + b, 0)).toBe(126);
    await page.screenshot({ path: `qa/batch13/t29-map-${w}.png` });
    // A real pointer click on the first and last berths of the frontage selects them (no store shortcut).
    const mapView = await page.evaluate(() => (window as unknown as Win).__harborScene!.camera!.pose());
    for (const id of ['A-01', 'E-10']) {
      const p = await page.evaluate((s) => (window as unknown as Win).__harborScene!.project(s), id);
      await page.mouse.click(p!.x, p!.y);
      await expect.poll(async () => (await session(page)).selection).toEqual({ kind: 'slip', id });
      // Selecting on the map keeps the map, zoomed in far enough to number the slips.
      await settled(page);
      expect(await page.evaluate(() => (window as unknown as Win).__harborScene!.camera!.map().pxPerM)).toBeGreaterThanOrEqual(4.5);
      // Back to the whole map for the next berth (the camera only; the selection is cleared through the store).
      await dispatch(page, { type: 'select', selection: null });
      await page.evaluate((pose) => (window as unknown as Win).__harborScene!.camera!.jump(pose), mapView);
      await settled(page);
      await page.waitForTimeout(400); // let a frame render: pointer picking uses the last drawn camera
    }
  });
}

test('map statuses follow the scenario; presets leave the map; nothing but the camera changes', async ({ page }) => {
  await openMap(page);
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await settled(page);
  const [, , , review0] = await legendCounts(page);
  expect(review0).toBe(0);
  await dispatch(page, { type: 'advanceToUncertain' });
  await expect.poll(async () => (await legendCounts(page))[3]).toBe(1);
  // Hover names the status and the observation, never a candidate vessel.
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await settled(page);
  const before = await session(page);
  const p = await page.evaluate(() => (window as unknown as Win).__harborScene!.project('B-12'));
  await page.mouse.move(p!.x + 1, p!.y + 1);
  await page.getByRole('button', { name: /Close details/ }).click();
  await page.mouse.move(p!.x, p!.y);
  await expect(page.locator('.scene-marker-hover')).toContainText('B-12 · Needs review');
  await expect(page.locator('.scene-marker-hover')).not.toContainText('Harbor Light');
  await page.screenshot({ path: 'qa/batch13/t29-map-uncertain-zoomed.png' });
  // Leaving the map: the lens opens back to 30°, plates and legend go.
  await page.getByRole('radio', { name: 'Dock B', exact: true }).click();
  await page.waitForFunction(() => {
    const h = (window as unknown as Win).__harborScene!;
    return !h.map().mode && h.map().mix === 0 && !h.camera!.flying();
  });
  expect((await page.evaluate(() => (window as unknown as Win).__harborScene!.camera!.pose())).fov).toBe(30);
  await expect(page.getByTestId('map-legend')).toHaveCount(0);
  const after = await session(page);
  expect({ ...after, selection: null }).toEqual({ ...before, selection: null });
});

test('map: axe passes with the legend on desktop and mobile', async ({ page }) => {
  await openMap(page, '&gpu=capable');
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await settled(page);
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('map-legend')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test('mobile: a capable GPU opens on the 3D map, a low-power one on the plan; Display switches; context loss falls back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page, '&gpu=capable');
  await settled(page);
  await expect(page.locator('.app')).toHaveAttribute('data-map', '3d');
  await btn(page, 'Display').click();
  await expect(page.getByRole('checkbox', { name: /^Use 3D map/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^Use 3D map/ }).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).toHaveAttribute('data-map', 'plan');
  await expect(page.getByTestId('plan-view')).toBeVisible();
  // The explicit choice survives a reload, even on a capable GPU.
  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-map', 'plan');
  await resetPrefs(page);

  // Low-power / software GPU: the plan, with 3D one checkbox away.
  await page.goto('/?debug&gpu=low');
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await btn(page, 'Display').click();
  await expect(page.getByRole('checkbox', { name: /^Use 3D map/ })).not.toBeChecked();
  await page.keyboard.press('Escape');

  // Context loss on the mobile map: the plan takes over with the same records and selection.
  await resetPrefs(page);
  await openMap(page, '&gpu=capable');
  await settled(page);
  await btn(page, 'Explore slip review').click();
  const before = await session(page);
  const lost = await page.evaluate(() => {
    const ext = document.querySelector('canvas')!.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return Boolean(ext);
  });
  expect(lost).toBe(true);
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart 3D view' })).toBeVisible();
  expect(await session(page)).toEqual(before);
  await page.screenshot({ path: 'qa/batch13/t29-mobile-context-lost.png' });
});
