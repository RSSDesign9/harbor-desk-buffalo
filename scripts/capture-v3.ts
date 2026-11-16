/**
 * T33 look-dev captures: the same named frames every time, on the real GPU, so a before/after or a
 * target/result pair is always the same camera, clock and viewport. It asserts nothing.
 *
 *   node scripts/capture-v3.ts --out qa/batch12 --prefix before [--url http://localhost:5173]
 *        [--only hero,overview] [--size 1440x900] [--dpr 1] [--stats]
 *
 * Frames: `hero` (B-12 selected at the 09:12 discrepancy, with the interface), `hero-clean` (same camera, no
 * interface or overlays), `dock`, `close`, `overview` (clean and with the interface), `map`, `establishing`, and
 * the Dock B view at 06:30, 13:30, 19:45, 21:15. `--query ao=show|ao=off` passes a debug switch to the app.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

type Pose = { position: number[]; target: number[] };
type W = {
  __harborScene: {
    camera: { flying(): boolean; pose(): Pose; jump(p: Pose): void };
    overlays(visible: boolean): void;
    stats(): { calls: number; triangles: number; geometries: number; textures: number; programs: number; renderer: string };
    timeFrames(n: number): { median: number; p95: number; max: number };
  };
  __harborDesk: { store: { dispatch(c: unknown): unknown; viewTimeline(at: string): void } };
};

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const [w, h] = (arg('size', '1440x900') ?? '1440x900').split('x').map(Number) as [number, number];
const url = arg('url', 'http://localhost:5173')!;
const outDir = arg('out', 'qa/batch12')!;
const prefix = arg('prefix', 'v3')!;
const only = arg('only')?.split(',');
mkdirSync(outDir, { recursive: true });

interface Shot {
  name: string;
  /** Local time on 15 Jul 2026 (EDT), or none for the app's own clock. */
  time?: string;
  commands?: unknown[];
  select?: string;
  preset?: 'Overview' | 'Dock B' | 'Map';
  pose?: Pose;
  clean?: boolean;
}
/** Low over the fairway off B-12, looking back at the dock: hulls, lines, reflections and the bank at close range. */
const CLOSE: Pose = { target: [-6, 0.6, 2], position: [12, 10, -11] };
const ESTABLISHING: Pose = { target: [50, 0, 40], position: [300, 210, -270] };
const SHOTS: Shot[] = [
  { name: 'hero', commands: [{ type: 'advanceToUncertain' }], select: 'B-12' },
  { name: 'hero-clean', commands: [{ type: 'advanceToUncertain' }], select: 'B-12', clean: true },
  { name: 'dock', preset: 'Dock B', clean: true },
  { name: 'close', pose: CLOSE, clean: true },
  { name: 'overview', preset: 'Overview', clean: true },
  { name: 'overview-ui', preset: 'Overview' },
  { name: 'map', preset: 'Map' },
  { name: 'establishing', pose: ESTABLISHING, clean: true },
  { name: 'dock-0630', preset: 'Dock B', time: '06:30', clean: true },
  { name: 'dock-1330', preset: 'Dock B', time: '13:30', clean: true },
  { name: 'dock-1945', preset: 'Dock B', time: '19:45', clean: true },
  { name: 'dock-2115', preset: 'Dock B', time: '21:15', clean: true },
];

// Ad-hoc frame: --pose "x,y,z,tx,ty,tz" [--name close] [--time 21:15] (scene axes; no interface).
const adhoc = arg('pose');
if (adhoc) {
  const n = adhoc.split(',').map(Number);
  SHOTS.length = 0;
  SHOTS.push({ name: arg('name', 'custom')!, pose: { position: n.slice(0, 3), target: n.slice(3, 6) }, clean: true, ...(arg('time') ? { time: arg('time')! } : {}) });
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function settle(page: Page) {
  await page.waitForTimeout(900);
  await page.waitForFunction(() => (window as unknown as W).__harborScene.camera.flying() === false);
}

for (const shot of SHOTS) {
  if (only && !only.includes(shot.name)) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(arg('dpr', '1')) });
  page.on('pageerror', (e) => console.error(`[${shot.name}] pageerror:`, e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`[${shot.name}] console:`, m.text());
  });
  // Motion paused: the water is still, so two captures of one frame are comparable.
  await page.addInitScript(() => window.localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', solidPanels: false, motionPaused: true })));
  await page.goto(`${url}/?debug${arg('query') ? `&${arg('query')}` : ''}`);
  await page.waitForFunction(() => {
    const x = window as unknown as Partial<W>;
    return Boolean(x.__harborScene?.camera && x.__harborDesk);
  });
  await page.keyboard.press('Escape'); // skip the opening move
  await settle(page);
  if (shot.commands)
    await page.evaluate((list) => {
      for (const c of list) (window as unknown as W).__harborDesk.store.dispatch(c);
    }, shot.commands);
  if (shot.select) await page.evaluate((id) => (window as unknown as W).__harborDesk.store.dispatch({ type: 'select', selection: { kind: 'slip', id } }), shot.select);
  if (shot.preset) await page.getByRole('radio', { name: shot.preset, exact: true }).click();
  await settle(page);
  if (shot.time) {
    const [hh, mm] = shot.time.split(':').map(Number) as [number, number];
    const iso = new Date(Date.UTC(2026, 6, 15, hh + 4, mm)).toISOString();
    await page.evaluate((at) => (window as unknown as W).__harborDesk.store.viewTimeline(at), iso);
    await settle(page);
  }
  if (shot.pose) await page.evaluate((p) => (window as unknown as W).__harborScene.camera.jump(p), shot.pose);
  if (shot.clean) {
    await page.evaluate(() => (window as unknown as W).__harborScene.overlays(false));
    await page.addStyleTag({ content: 'body *:not(:has(canvas)):not(canvas) { visibility: hidden !important; }' });
  }
  await page.waitForTimeout(700);
  await page.evaluate(() => (window as unknown as W).__harborScene.timeFrames(3));
  if (has('stats')) console.log(shot.name, JSON.stringify(await page.evaluate(() => (window as unknown as W).__harborScene.stats())));
  const file = `${outDir}/${prefix}-${shot.name}.png`;
  await page.screenshot({ path: file });
  console.log(`saved ${file}`);
  await page.close();
}
await browser.close();
