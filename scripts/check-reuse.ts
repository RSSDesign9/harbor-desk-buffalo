/**
 * Resource reuse check (TASKS T16): cycle selection, presets, the full B-12 scenario and a restart several
 * times and record the renderer's geometry/texture/program counts after each cycle. A leak shows as growth.
 *
 *   node scripts/check-reuse.ts [--gpu] [--url http://127.0.0.1:4719] [--out qa/batch6/reuse.json]
 */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

type W = { __harborScene: { camera: { flying(): boolean }; stats(): { geometries: number; textures: number; programs: number } }; __harborDesk: { store: { dispatch(c: unknown): unknown; restart(): void } } };
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/batch6/reuse.json');
const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${url}/?debug`);
await page.waitForFunction(() => { const w = window as unknown as Partial<W>; return Boolean(w.__harborScene?.camera && w.__harborDesk); });
const settle = async () => {
  await page.waitForTimeout(120);
  await page.waitForFunction(() => (window as unknown as W).__harborScene.camera.flying() === false);
  await page.waitForTimeout(200);
};
const dispatch = (c: unknown) => page.evaluate((cmd) => (window as unknown as W).__harborDesk.store.dispatch(cmd), c);
const cycles: unknown[] = [];
for (let i = 0; i < 5; i++) {
  for (const id of ['B-12', 'D-10', 'A-05', 'C-05', 'E-03']) {
    await dispatch({ type: 'select', selection: { kind: 'slip', id } });
    await settle();
  }
  for (const c of [{ type: 'advanceToUncertain' }, { type: 'openReview', issueId: 'ISS-0001' }, { type: 'loadDockCheckResult', issueId: 'ISS-0001' }, { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true }, { type: 'confirmIdentity', issueId: 'ISS-0001' }]) await dispatch(c);
  await dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await settle();
  await page.getByRole('button', { name: 'Guided replay', exact: true }).click();
  for (const name of ['09:20 Resolved', '09:12 Discrepancy', '08:45 Normal']) {
    await page.getByRole('radio', { name, exact: true }).click();
    await settle();
  }
  await page.getByRole('button', { name: 'Back to my run', exact: true }).click();
  for (const name of ['Map', 'Dock B', 'Overview']) {
    await page.getByRole('radio', { name }).click();
    await settle();
  }
  await page.evaluate(() => (window as unknown as W).__harborDesk.store.restart());
  await settle();
  const s = await page.evaluate(() => { const x = (window as unknown as W).__harborScene.stats(); return { geometries: x.geometries, textures: x.textures, programs: x.programs }; });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const dom = await cdp.send('Memory.getDOMCounters');
  await cdp.detach();
  cycles.push({ cycle: i + 1, ...s, dom });
  console.log(JSON.stringify(cycles[i]));
}
await browser.close();
writeFileSync(out, `${JSON.stringify({ measuredAt: new Date().toISOString(), url, note: 'Counts after each full cycle (5 selections, full B-12 resolution, replay backward, 3 presets, restart; DOM counters after forced GC). Flat counts indicate bounded renderer/DOM resources over this procedure, not a proof of all long-duration memory behavior.', cycles }, null, 2)}\n`);
console.log(`wrote ${out}`);
