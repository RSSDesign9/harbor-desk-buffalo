import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { showList } from './helpers.ts';

/**
 * Batch 6 (T14–T16) journeys on the production build, driving the REAL canvas with mouse events: the full
 * assumed layout (docks A–E), the surroundings as non-selectable scenery, and the rendering budget.
 * Headless Chromium renders WebGL in software here (SwiftShader); `?debug` exposes read-only helpers.
 */
const SITE = JSON.parse(readFileSync(new URL('../../data/derived/site-runtime.json', import.meta.url), 'utf8')) as { slips: { id: string; dock: string }[]; masses: { id: string; ring: [number, number][] }[] };

type V3 = [number, number, number];
type Pose = { position: V3; target: V3 };
type Bridge = {
  project(id: string, part?: string): { x: number; y: number } | null;
  at(east: number, north: number, y?: number): { x: number; y: number };
  hits(x: number, y: number): string[];
  stats(): { frame: number; calls: number; triangles: number; hullLods: number[]; shadowUpdates: number; dpr: number };
  inventory(): { storedBoats: number; unknownBerths: number; hulls: number; pickMeshes: number };
  camera: { pose(): Pose; flying(): boolean; jump(p: Pose): void };
};
type Desk = { store: { getState(): { interactive: { selection: { kind: string; id: string } | null } }; dispatch(c: unknown): { ok: boolean } } };
const bridge = () => (window as unknown as { __harborScene: Bridge }).__harborScene;
void bridge;

async function open(page: Page) {
  await page.goto('/?debug');
  await page.waitForFunction(() => { const w = window as unknown as { __harborScene?: Bridge; __harborDesk?: Desk }; return Boolean(w.__harborScene?.camera && w.__harborDesk); });
}
const idle = async (page: Page) => {
  await page.waitForTimeout(80);
  await page.waitForFunction(() => (window as unknown as { __harborScene: Bridge }).__harborScene.camera.flying() === false, undefined, { timeout: 15_000 });
  await page.waitForTimeout(250);
};
const selection = (page: Page) => page.evaluate(() => (window as unknown as { __harborDesk: Desk }).__harborDesk.store.getState().interactive.selection);
const dispatch = (page: Page, cmd: unknown) => page.evaluate((c) => (window as unknown as { __harborDesk: Desk }).__harborDesk.store.dispatch(c), cmd);
const project = (page: Page, id: string, part = 'berth-outer') => page.evaluate(([i, p]) => (window as unknown as { __harborScene: Bridge }).__harborScene.project(i!, p), [id, part] as const);
const hits = (page: Page, x: number, y: number) => page.evaluate(([a, b]) => (window as unknown as { __harborScene: Bridge }).__harborScene.hits(a!, b!), [x, y] as const);
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __harborScene: Bridge }).__harborScene.stats());
const inventory = (page: Page) => page.evaluate(() => (window as unknown as { __harborScene: Bridge }).__harborScene.inventory());
const select = (page: Page, id: string) => dispatch(page, { type: 'select', selection: { kind: 'slip', id } });
const inScene = (p: { x: number; y: number }) => p.x > 20 && p.x < 1040 && p.y > 200 && p.y < 640;

test('every dock is in the scene: one pick mesh, hulls on all five docks, counters and list from the data', async ({ page }) => {
  await open(page);
  await idle(page);
  const inv = await inventory(page);
  expect(inv.pickMeshes).toBe(1);
  expect(inv.hulls).toBeGreaterThan(30);
  expect(inv.hulls).toBeLessThan(113); // away vessels are not drawn, so fewer hulls than registry records

  // Counters are derived: tiles, tab labels and list rows agree with the supplied data.
  await expect(page.locator('.summary-zone')).toContainText('/126');
  await showList(page);
  await expect(page.getByRole('tab', { name: /^Slips/ })).toHaveText(/126/);
  await expect(page.getByRole('tab', { name: /^Vessels/ })).toHaveText(/113/);
  const counts: Record<string, number> = {};
  for (const s of SITE.slips) counts[s.dock] = (counts[s.dock] ?? 0) + 1;
  for (const dock of ['A', 'B', 'C', 'D', 'E']) {
    await page.getByRole('combobox', { name: 'Dock' }).selectOption(dock);
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(counts[dock]!);
  }
  await page.getByRole('combobox', { name: 'Dock' }).selectOption('all');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(126);
  // The inspector no longer says any dock is “outlined only”.
  await select(page, 'E-03');
  await expect(page.getByTestId('inspector')).toContainText('Slip E-03');
  await expect(page.getByTestId('inspector')).not.toContainText('outlined only');
  await page.screenshot({ path: 'qa/handoff/e2e-e03-selected.png' });
});

test('canvas clicks on berths of every dock select exactly that slip (per-berth IDs survive the merged pick mesh)', async ({ page }) => {
  test.setTimeout(120_000); // ~15 fly-tos and canvas clicks in software rendering
  await open(page);
  await showList(page);
  // For each dock: fly to one slip, then click its neighbours on the canvas.
  const plan: [string, string[]][] = [
    ['A-20', ['A-18', 'A-19', 'A-21', 'A-22']],
    ['B-28', ['B-26', 'B-27', 'B-29']],
    ['C-08', ['C-07', 'C-09', 'C-10']],
    ['D-11', ['D-09', 'D-10', 'D-12']],
    ['E-05', ['E-04', 'E-06']],
  ];
  const clicked: string[] = [];
  for (const [anchor, targets] of plan) {
    await select(page, anchor);
    await idle(page);
    const pose = await page.evaluate(() => (window as unknown as { __harborScene: Bridge }).__harborScene.camera.pose());
    for (const id of targets) {
      const p = (await project(page, id))!;
      if (!inScene(p)) continue;
      expect(await hits(page, p.x, p.y), id).toContain('berth');
      await page.mouse.click(p.x, p.y);
      await expect.poll(() => selection(page), { message: `clicked ${id}` }).toEqual({ kind: 'slip', id });
      await expect(page.getByTestId('inspector')).toContainText(`Slip ${id}`);
      await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toContainText(id);
      clicked.push(id);
      // Put the camera back so the next neighbour is clicked from the same framing.
      await page.evaluate((q) => (window as unknown as { __harborScene: Bridge }).__harborScene.camera.jump(q), pose);
      await page.waitForTimeout(120);
    }
  }
  expect(clicked.length).toBeGreaterThanOrEqual(10);
  expect(new Set(clicked.map((id) => id[0])).size).toBe(5);
});

test('unknown and empty berths stay distinct; distant docks add no field of labels; scenery is not selectable', async ({ page }) => {
  await open(page);
  await idle(page);
  const inv = await inventory(page);
  expect(inv.unknownBerths).toBeGreaterThan(5); // berths without a current report (the one offline camera, glare) are outlined as unknown, not shown as empty (T28: was 28 with two docks dark)
  expect(inv.unknownBerths).toBeLessThan(60);
  expect(inv.storedBoats).toBeGreaterThan(5);

  // Overview, nothing selected, before the scenario: no markers at all. At 09:12: exactly one (the review).
  await expect(page.locator('.scene-marker')).toHaveCount(0);
  await dispatch(page, { type: 'advanceToUncertain' });
  await expect(page.locator('.scene-marker')).toHaveCount(1);
  await expect(page.locator('.scene-marker')).toHaveText('B-12 · Needs review');
  await page.screenshot({ path: 'qa/handoff/e2e-overview-uncertain.png' });

  // Unknown vs empty in words, not colour alone.
  await select(page, 'C-05');
  await idle(page);
  await expect(page.getByTestId('inspector')).toContainText(/Presence unknown|Camera offline/);
  await expect(page.getByTestId('inspector')).not.toContainText('No vessel present');
  await select(page, 'A-02');
  await idle(page);
  await expect(page.getByTestId('inspector')).toContainText('No vessel present');
  await expect(page.locator('.scene-marker')).toHaveCount(2); // the selection and the review marker only

  // Clicking the elevator, a storage area or the open yard changes nothing: scenery has no identity.
  await dispatch(page, { type: 'select', selection: null });
  await page.getByRole('radio', { name: 'Overview' }).click(); // the wide view, where the yard and buildings are on screen
  await idle(page);
  const centre = (id: string) => {
    const r = SITE.masses.find((m) => m.id === id)!.ring;
    return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length] as const;
  };
  let tried = 0;
  for (const id of ['storage-4a', 'storage-6', 'small-building']) {
    const [e, n] = centre(id);
    const p = await page.evaluate(([a, b]) => (window as unknown as { __harborScene: Bridge }).__harborScene.at(a!, b!, 1.5), [e, n] as const);
    if (!inScene(p)) continue;
    expect(await hits(page, p.x, p.y)).not.toContain('berth');
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
    expect(await selection(page)).toBeNull();
    tried += 1;
  }
  expect(tried).toBeGreaterThan(0);
  await expect(page.locator('.scene-marker-selected')).toHaveCount(0);
});

test('rendering budget: draw calls stay under the aim in every view, and orbiting reuses the shadow map', async ({ page }) => {
  await open(page);
  await dispatch(page, { type: 'advanceToUncertain' });
  await idle(page);
  const views: Record<string, () => Promise<unknown>> = {
    overview: async () => undefined,
    map: () => page.getByRole('radio', { name: 'Map', exact: true }).click(),
    dock: () => page.getByRole('radio', { name: 'Dock B' }).click(),
    b12: () => select(page, 'B-12'),
    d10: () => select(page, 'D-10'),
  };
  for (const [name, go] of Object.entries(views)) {
    await go();
    await idle(page);
    const s = await stats(page);
    expect(s.calls, `${name} draw calls`).toBeLessThan(300); // PRD §11 aim; the ceiling is 2,000
    expect(s.triangles, `${name} triangles`).toBeLessThan(900_000);
  }
  // Orbit around the fixed target: the shadow map is not redrawn (no caster changed, the frustum did not move).
  await page.waitForTimeout(600);
  const before = await stats(page);
  await page.evaluate(async () => {
    const h = (window as unknown as { __harborScene: Bridge }).__harborScene;
    const pose = h.camera.pose();
    const [px, py, pz] = pose.position;
    const [tx, , tz] = pose.target;
    const r = Math.hypot(px - tx, pz - tz);
    const a0 = Math.atan2(pz - tz, px - tx);
    for (const da of [0.01, 0.02, 0.03, 0.02, 0.01, 0]) {
      h.camera.jump({ position: [tx + Math.cos(a0 + da) * r, py, tz + Math.sin(a0 + da) * r], target: pose.target });
      await new Promise((res) => setTimeout(res, 250));
    }
  });
  await page.waitForTimeout(900);
  const after = await stats(page);
  // Several frames were drawn; at most one shadow redraw is allowed (a hull crossing a detail threshold).
  expect(after.frame - before.frame).toBeGreaterThanOrEqual(3);
  expect(after.shadowUpdates - before.shadowUpdates).toBeLessThanOrEqual(1);
  // Selection survives all of that camera movement.
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'D-10' });
  // And the scene comes to rest: nothing keeps rendering.
  const a = (await stats(page)).frame;
  await page.waitForTimeout(900);
  expect((await stats(page)).frame).toBe(a);
});
