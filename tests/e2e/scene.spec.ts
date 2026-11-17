import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { showList } from './helpers.ts';

const SITE = JSON.parse(readFileSync(new URL('../../data/derived/site-runtime.json', import.meta.url), 'utf8')) as { slips: { id: string; centroid: [number, number] }[] };
/** Scene-space (x, z) of a slip centroid: x = east, z = −north. */
const sceneXZ = (id: string) => {
  const c = SITE.slips.find((s) => s.id === id)!.centroid;
  return [c[0], -c[1]] as const;
};

/**
 * Batch 3 (T08/T10) journeys on the production build, driving the REAL canvas with mouse events.
 * Headless Chromium renders WebGL through its software path here; the renderer string is recorded per test.
 * `?debug` exposes read-only helpers (projection, raycast names, camera pose) and the store for scenario setup.
 */
type V3 = [number, number, number];
declare global {
  interface Window {
    __harborScene?: {
      project(id: string, part?: string): { x: number; y: number } | null;
      hits(x: number, y: number): string[];
      stats(): { frame: number; calls: number; triangles: number; hullLods: number[] };
      camera: { pose(): { position: V3; target: V3 }; flying(): boolean; flightsStarted(): number; jump(p: { position: V3; target: V3 }): void } | null;
    };
    __harborDesk?: { store: { getState(): { interactive: { selection: { kind: string; id: string } | null } }; dispatch(c: unknown): { ok: boolean } } };
    __harborSceneClicks?: { slipId: string; delta: number }[];
  }
}

async function open(page: Page, query = '') {
  await page.goto(`/?debug${query}`);
  await page.waitForFunction(() => Boolean(window.__harborScene?.camera && window.__harborDesk));
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  test.info().annotations.push({ type: 'webgl-renderer', description: renderer });
}
const idle = (page: Page) => page.waitForFunction(() => window.__harborScene!.camera!.flying() === false, undefined, { timeout: 10_000 });
const selection = (page: Page) => page.evaluate(() => window.__harborDesk!.store.getState().interactive.selection);
const dispatch = (page: Page, cmd: unknown) => page.evaluate((c) => window.__harborDesk!.store.dispatch(c), cmd);
const project = (page: Page, id: string, part = 'berth') => page.evaluate(([i, p]) => window.__harborScene!.project(i!, p), [id, part] as const);
const options = (page: Page) => page.getByRole('listbox').getByRole('option');
const hits = (page: Page, x: number, y: number) => page.evaluate(([a, b]) => window.__harborScene!.hits(a!, b!), [x, y] as const);
async function dockView(page: Page) {
  await page.getByRole('radio', { name: 'Dock B' }).click();
  await page.waitForTimeout(50);
  await idle(page);
}

test('overview renders the marina with nothing selected', async ({ page }) => {
  await open(page);
  await idle(page);
  expect(await selection(page)).toBeNull();
  expect(await page.locator('[data-testid="scene-canvas"]').getAttribute('aria-hidden')).toBe('true');
  await page.screenshot({ path: 'qa/handoff/e2e-overview.png' });
});

test('clicking an EMPTY berth on the canvas selects it; inspector and list follow', async ({ page }) => {
  await open(page);
  await showList(page);
  await dockView(page);
  const p = (await project(page, 'B-12'))!;
  expect(await hits(page, p.x, p.y)).toContain('berth');
  await page.mouse.click(p.x, p.y);
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'B-12' });
  const insp = page.getByTestId('inspector');
  await expect(insp.getByRole('heading', { name: 'Slip B-12' })).toBeVisible();
  await expect(insp).toContainText('No vessel present');
  await expect(insp.locator('.summary-grid')).toContainText('BookableNo');
  await expect(insp).toContainText('Lake Effect'); // assignment, shown as assignment
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toContainText('B-12');
  await idle(page);
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Empty · assigned');
  await page.screenshot({ path: 'qa/handoff/e2e-b12-selected-normal.png' });
});

test('dragging across a berth orbits the camera and never selects', async ({ page }) => {
  await open(page);
  await dockView(page);
  const before = await page.evaluate(() => window.__harborScene!.camera!.pose());
  const p = (await project(page, 'B-14'))!;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 60, p.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await selection(page)).toBeNull();
  const after = await page.evaluate(() => window.__harborScene!.camera!.pose());
  expect(after.position).not.toEqual(before.position); // the camera moved…
  expect(await selection(page)).toBeNull(); // …and selection did not
  const clicks = await page.evaluate(() => window.__harborSceneClicks ?? []);
  expect(clicks.every((c) => c.delta > 5)).toBe(true); // any click R3F reported was classified as a drag
});

test('a new fly-to interrupts the running one and starts from the current pose', async ({ page }) => {
  await open(page);
  await page.getByRole('radio', { name: 'Overview' }).click(); // start far from Dock B so the flight is long
  await idle(page);
  const n0 = await page.evaluate(() => window.__harborScene!.camera!.flightsStarted());
  const [bx, bz] = sceneXZ('B-10');
  // Interrupt from inside the page as soon as the camera is verifiably mid-flight (robust to slow frames).
  const mid = await page.evaluate(
    ([x, z]) =>
      new Promise<{ target: V3; flying: boolean }>((resolve) => {
        const c = window.__harborScene!.camera!;
        const start = c.pose().target;
        window.__harborDesk!.store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-10' } });
        const check = () => {
          const t = c.pose().target;
          const total = Math.hypot(x! - start[0], z! - start[2]);
          const done = Math.hypot(t[0] - start[0], t[2] - start[2]);
          if (c.flying() && done > total * 0.15 && done < total * 0.85) {
            window.__harborDesk!.store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'A-03' } });
            resolve({ target: t, flying: true });
          } else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    [bx, bz] as const,
  );
  expect(mid.flying).toBe(true);
  await idle(page);
  const end = await page.evaluate(() => window.__harborScene!.camera!.pose());
  expect(await page.evaluate(() => window.__harborScene!.camera!.flightsStarted())).toBe(n0 + 2);
  const [ax, az] = sceneXZ('A-03');
  expect(Math.abs(end.target[0] - ax)).toBeLessThan(0.5);
  expect(Math.abs(end.target[2] - az)).toBeLessThan(0.5);
  // The interrupted flight was really mid-way (not yet at B-10).
  expect(Math.hypot(mid.target[0] - bx, mid.target[2] - bz)).toBeGreaterThan(5);
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'A-03' });
});

test('reduced motion cuts straight to the target', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await page.waitForTimeout(60);
  expect(await page.evaluate(() => window.__harborScene!.camera!.flying())).toBe(false);
  const pose = await page.evaluate(() => window.__harborScene!.camera!.pose());
  expect(Math.abs(pose.target[0] - sceneXZ('B-12')[0])).toBeLessThan(0.2);
});

test('clicks on panels never select the berth behind them', async ({ page }) => {
  await open(page);
  await showList(page); // a full-height panel to hide the berth behind
  await dockView(page);
  const rail = (await page.locator('.rail .registry').boundingBox())!;
  const goal = { x: rail.x + rail.width / 2, y: rail.y + rail.height * 0.6 };
  // Shift camera + target together by (dx, dz) and solve the screen-space Jacobian to put B-12 under the panel.
  const base = await page.evaluate(() => window.__harborScene!.camera!.pose());
  const place = async (dx: number, dz: number) => {
    await page.evaluate(([b, x, z]) => {
      const bp = b as { position: V3; target: V3 };
      window.__harborScene!.camera!.jump({ position: [bp.position[0] + (x as number), bp.position[1], bp.position[2] + (z as number)], target: [bp.target[0] + (x as number), bp.target[1], bp.target[2] + (z as number)] });
    }, [base, dx, dz] as const);
    await page.waitForTimeout(120);
    return (await project(page, 'B-12'))!;
  };
  // Newton steps: the screen position is not linear in the camera shift over large moves (perspective), so
  // re-estimate the Jacobian at each step. (T30 moved the registry lower in the rail, out of one linear step's reach.)
  let ox = 0;
  let oz = 0;
  let p = await place(0, 0);
  for (let i = 0; i < 5; i++) {
    const px = await place(ox + 2, oz);
    const pz = await place(ox, oz + 2);
    const j = [[(px.x - p.x) / 2, (pz.x - p.x) / 2], [(px.y - p.y) / 2, (pz.y - p.y) / 2]] as const;
    const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
    const ex = goal.x - p.x;
    const ey = goal.y - p.y;
    ox += (ex * j[1][1] - ey * j[0][1]) / det;
    oz += (j[0][0] * ey - j[1][0] * ex) / det;
    p = await place(ox, oz);
    if (Math.hypot(p.x - goal.x, p.y - goal.y) < 20) break;
  }
  const underPanel = p.x > rail.x && p.x < rail.x + rail.width && p.y > rail.y && p.y < rail.y + rail.height;
  const found = underPanel && (await hits(page, p.x, p.y)).includes('berth') ? p : null;
  expect(found, 'could not place B-12 behind the panel').not.toBeNull();
  await page.mouse.click(found!.x, found!.y);
  await page.waitForTimeout(200);
  const sel = await selection(page);
  expect(sel?.id).not.toBe('B-12');
  expect((await page.evaluate(() => window.__harborSceneClicks ?? [])).some((c) => c.slipId === 'B-12')).toBe(false);
});

test('keyboard: search B12 → Enter selects B-12; arrows + Enter move the selection; camera follows', async ({ page }) => {
  await open(page);
  await idle(page);
  const search = page.getByRole('searchbox', { name: 'Search slips and vessels' });
  await search.fill('B12');
  await search.press('Enter');
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'B-12' });
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).press('Escape');
  const list = page.getByRole('listbox', { name: /Slips/ });
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'B-13' });
  await idle(page);
  const pose = await page.evaluate(() => window.__harborScene!.camera!.pose());
  expect(Math.abs(pose.target[0] - sceneXZ('B-13')[0])).toBeLessThan(0.3);
  await expect(page.getByTestId('announcer')).toContainText('Slip B-13 selected');
});

test('uncertain hull: picking it opens the SLIP; labels never name it; possible match frames Harbor Light’s empty berth', async ({ page }) => {
  await open(page);
  expect((await dispatch(page, { type: 'advanceToUncertain' })).ok).toBe(true);
  await expect(page.locator('.summary-zone .kpi').nth(2)).toContainText('1');
  await dockView(page);
  const h = (await project(page, 'B-12', 'hull'))!;
  expect((await hits(page, h.x, h.y))[0]).toBe('Mesh'); // a hull mesh is the nearest object
  await page.mouse.move(h.x, h.y);
  await expect(page.locator('.scene-marker-hover')).toHaveText('B-12 · Vessel present · identity unverified');
  await page.mouse.click(h.x, h.y);
  expect(await selection(page)).toEqual({ kind: 'slip', id: 'B-12' });
  const insp = page.getByTestId('inspector');
  await expect(insp.locator('.observation-headline').first()).toHaveText('PresentIdentity unverified');
  await expect(insp).toContainText('Camera C-02 · 09:12');
  await expect(insp.getByRole('button', { name: /possible match Harbor Light/ })).toBeVisible();
  await idle(page);
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
  await page.screenshot({ path: 'qa/handoff/e2e-b12-selected-uncertain.png' });

  // Search must not surface B-12 through the candidate.
  const search = page.getByRole('searchbox', { name: 'Search slips and vessels' });
  await search.fill('Harbor Light');
  await page.getByRole('tab', { name: /^Slips/ }).click();
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText('B-14');
  await search.fill('');

  await insp.getByRole('button', { name: /possible match Harbor Light/ }).click();
  expect(await selection(page)).toEqual({ kind: 'vessel', id: 'V-022' });
  await expect(page.getByTestId('inspector')).toContainText('Away · departed 08:30');
  await idle(page);
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-14 · Assigned berth · last confirmed away');
  const pose = await page.evaluate(() => window.__harborScene!.camera!.pose());
  expect(Math.abs(pose.target[0] - sceneXZ('B-14')[0])).toBeLessThan(0.3);
  const b14 = (await project(page, 'B-14', 'hull'))!;
  expect((await hits(page, b14.x, b14.y))[0]).toBe('berth'); // no phantom boat drawn at B-14
  // Harbor Light’s agreement and location are unchanged.
  await expect(page.getByTestId('inspector')).toContainText('B-14 · seasonal');
});

test('no-results and invalid-selection states recover', async ({ page }) => {
  await open(page, '&select=Z-99');
  await expect(page.getByText('No slip or vessel “Z-99”')).toBeVisible();
  await page.getByRole('button', { name: 'Show all slips' }).click();
  await expect(page.getByText('No slip or vessel “Z-99”')).toHaveCount(0);
  const search = page.getByRole('searchbox', { name: 'Search slips and vessels' });
  await search.fill('zz99');
  await expect(page.getByText(/No (slips|vessels) match/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(search).toHaveValue('');
  await expect(options(page)).toHaveCount(126);
});

test('deep link selects a vessel; dock and needs-review filters derive from shared state', async ({ page }) => {
  await open(page, '&select=V21');
  await showList(page);
  expect(await selection(page)).toEqual({ kind: 'vessel', id: 'V-021' });
  await expect(page.getByTestId('inspector')).toContainText('Registration');
  await expect(page.getByTestId('inspector')).toContainText('ending 42 AB');
  await expect(page.getByTestId('inspector')).toContainText('HIN');
  await page.getByRole('combobox', { name: 'Dock' }).selectOption('B');
  await page.getByRole('tab', { name: /^Slips/ }).click();
  await expect(options(page)).toHaveCount(37);
  await page.getByRole('checkbox', { name: 'Needs review' }).check();
  await expect(page.getByText('No slips match')).toBeVisible();
  await dispatch(page, { type: 'advanceToUncertain' });
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText('B-12');
});

test('T09 assets: detail follows camera distance, draw calls stay small, and the idle scene renders nothing', async ({ page }) => {
  await open(page);
  expect((await dispatch(page, { type: 'advanceToUncertain' })).ok).toBe(true);
  await idle(page);
  await page.waitForTimeout(300);
  // Overview is hundreds of metres out: every hull uses a cheaper distance representation.
  const far = await page.evaluate(() => window.__harborScene!.stats());
  expect(far.hullLods.length).toBeGreaterThan(10);
  expect(Math.min(...far.hullLods)).toBeGreaterThanOrEqual(1);

  // Selecting B-12 flies in: the observed hull and its neighbours switch to full detail.
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await page.waitForTimeout(100);
  await idle(page);
  await page.waitForTimeout(400);
  const near = await page.evaluate(() => window.__harborScene!.stats());
  expect(near.hullLods).toContain(0);
  expect(near.calls).toBeLessThan(300); // PRD §11: aim < 300 draw calls in the normal view
  expect(near.triangles).toBeLessThan(far.triangles * 4);

  // Picking still resolves to the hull, and the hull still opens the SLIP.
  const h = (await project(page, 'B-12', 'hull'))!;
  expect((await hits(page, h.x, h.y))[0]).toBe('Mesh');
  await page.mouse.move(h.x, h.y);
  await expect(page.locator('.scene-marker-hover, .scene-marker-selected').first()).toHaveText('B-12 · Vessel present · identity unverified');

  // Nothing animates on its own (water ripples are static in this build), so reduced motion has nothing to freeze.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const a = await page.evaluate(() => window.__harborScene!.stats().frame);
  await page.waitForTimeout(700);
  const b = await page.evaluate(() => window.__harborScene!.stats().frame);
  expect(b).toBe(a);
});

test('T09 assets: no scene label, tooltip or asset request names the observed hull before verification', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await open(page);
  expect((await dispatch(page, { type: 'advanceToUncertain' })).ok).toBe(true);
  await dockView(page);
  const h = (await project(page, 'B-12', 'hull'))!;
  await page.mouse.move(h.x, h.y);
  await expect(page.locator('.scene-marker-hover')).toHaveText('B-12 · Vessel present · identity unverified');
  await page.mouse.click(h.x, h.y);
  await idle(page);
  for (const marker of await page.locator('.scene-marker').allTextContents()) expect(marker).not.toMatch(/Lake Effect|Harbor Light/);
  // The canvas exposes no accessible name or title, and nothing fetched carries a vessel name or a model file.
  const canvas = page.locator('[data-testid="scene-canvas"]');
  expect(await canvas.getAttribute('aria-hidden')).toBe('true');
  expect(await canvas.getAttribute('title')).toBeNull();
  for (const url of requested) {
    expect(decodeURIComponent(url)).not.toMatch(/lake.?effect|harbor.?light/i);
    expect(new URL(url).hostname).toBe('127.0.0.1');
    expect(url).not.toMatch(/\.(glb|gltf|hdr|exr|ktx2)(\?|$)/);
  }
});
