/**
 * QA capture for the selected B-12 view (TASKS T09): opens the app, optionally advances the SIM scenario,
 * selects a slip and saves a screenshot. Used for the v2 comparison; it never asserts anything.
 *
 *   node scripts/capture-scene.ts --url http://127.0.0.1:4719 --out qa/batch4/b12.png [--stage uncertain]
 *        [--select B-12] [--size 1440x900] [--pose "x,y,z,tx,ty,tz"] [--preset dock] [--stats]
 *        [--stage normal|uncertain|pending|review|resolved] [--path direct] [--scroll <testid or id>]
 *
 * Headless Chromium renders WebGL in software (SwiftShader) unless --gpu is passed.
 */
import { chromium } from '@playwright/test';

type Pose = { position: number[]; target: number[] };
/** The `?debug` bridge installed by src/scene/DebugBridge.tsx and src/app (QA only). */
type W = {
  __harborScene: {
    camera: { flying(): boolean; pose(): Pose; jump(p: Pose): void };
    stats(): { frame: number; calls: number; triangles: number; geometries: number; textures: number; programs: number; hullLods: number[]; dpr: number; renderer: string };
    timeFrames(n: number): { median: number; p95: number; max: number };
  };
  __harborDesk: { store: { dispatch(c: unknown): unknown } };
};

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const [w, h] = (arg('size', '1440x900') ?? '1440x900').split('x').map(Number) as [number, number];
const url = arg('url', 'http://127.0.0.1:5173')!;
const out = arg('out', 'qa/batch4/capture.png')!;

const browser = await chromium.launch({ args: has('gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(arg('dpr', '1')) });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('console:', m.text());
});
await page.goto(`${url}/?debug`);
await page.waitForFunction(() => { const x = window as unknown as Partial<W>; return Boolean(x.__harborScene?.camera && x.__harborDesk); });
// Scenario stages (Batch 5): normal | uncertain | pending | review | resolved; --path direct skips the dock check.
const STAGES: Record<string, unknown[]> = {
  normal: [],
  uncertain: [{ type: 'advanceToUncertain' }],
  pending: [{ type: 'advanceToUncertain' }, { type: 'requestDockCheck', issueId: 'ISS-0001' }],
  review: [{ type: 'advanceToUncertain' }, { type: 'requestDockCheck', issueId: 'ISS-0001' }, { type: 'openReview', issueId: 'ISS-0001' }, { type: 'loadDockCheckResult', issueId: 'ISS-0001' }],
  resolved: [
    { type: 'advanceToUncertain' },
    { type: 'requestDockCheck', issueId: 'ISS-0001' },
    { type: 'openReview', issueId: 'ISS-0001' },
    { type: 'loadDockCheckResult', issueId: 'ISS-0001' },
    { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true },
    { type: 'confirmIdentity', issueId: 'ISS-0001' },
  ],
};
const stage = arg('stage');
if (stage) {
  if (!STAGES[stage]) throw new Error(`Unknown --stage ${stage}`);
  const cmds = arg('path') === 'direct' ? STAGES[stage]!.filter((c) => (c as { type: string }).type !== 'requestDockCheck') : STAGES[stage]!;
  await page.evaluate((list) => { for (const c of list) (window as unknown as W).__harborDesk.store.dispatch(c); }, cmds);
}
const select = arg('select');
if (select) await page.evaluate((id) => (window as unknown as W).__harborDesk.store.dispatch({ type: 'select', selection: { kind: 'slip', id } }), select);
const preset = arg('preset');
if (preset) await page.getByRole('radio', { name: preset }).click();
await page.waitForTimeout(1200);
await page.waitForFunction(() => (window as unknown as W).__harborScene.camera.flying() === false);
const pose = arg('pose');
if (pose) {
  const n = pose.split(',').map(Number);
  await page.evaluate((p) => (window as unknown as W).__harborScene.camera.jump({ position: p.slice(0, 3), target: p.slice(3, 6) }), n);
}
const scroll = arg('scroll');
if (scroll) await page.evaluate((id) => document.querySelector(`[data-testid="${id}"], #${id}`)?.scrollIntoView({ block: 'start' }), scroll);
await page.waitForTimeout(Number(arg('wait', '900')));
if (has('settle')) await page.evaluate(() => (window as unknown as W).__harborScene.timeFrames(3));
if (has('stats')) console.log(JSON.stringify(await page.evaluate(() => (window as unknown as W).__harborScene.stats())));
await page.screenshot({ path: out });
console.log(`saved ${out}`);
await browser.close();
