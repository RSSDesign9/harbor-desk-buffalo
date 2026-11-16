/**
 * The PRD §11 rendering profile (TASKS T16): one defined 60-second overview / select / orbit run.
 *
 *   node scripts/profile-scene.ts --gpu [--dsf 2] [--url http://127.0.0.1:4719] [--out qa/batch6/profile.json] [--query lake=sw-gale]
 *
 * Run it against the PRODUCTION build (`npm run build`, then the preview on 4719).
 *
 * What it does, in order (≈60 s of continuous camera movement and selection):
 *   0–10 s   overview, orbiting ±25°            32–40 s  select D-10 (fly-to), orbit
 *   10–20 s  “Dock B” preset (fly-to), orbit     40–46 s  select A-05 (fly-to), orbit
 *   20–32 s  select B-12 (fly-to), orbit         46–52 s  top-down preset, pan
 *                                                52–60 s  overview (fly-to), orbit
 *
 * What it records:
 *   - requestAnimationFrame spacing for EVERY frame of the run (median fps, p95 and max frame time);
 *   - per phase: draw calls, triangles, hull LODs, and back-to-back frame cost with gl.finish() (not vsync-capped);
 *   - selection feedback: time from the select command to the inspector showing the slip;
 *   - renderer memory counters before and after (resource reuse/disposal across selection and view changes);
 *   - device, browser, viewport, DPR and build under test.
 *
 * Without --gpu, headless Chromium renders in software (SwiftShader): a floor, not the target.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { chromium } from '@playwright/test';

type Pose = { position: number[]; target: number[] };
type Stats = { frame: number; calls: number; triangles: number; geometries: number; textures: number; programs: number; hullLods: number[]; dpr: number; renderer: string; shadowUpdates?: number };
/** The `?debug` bridge installed by src/scene/DebugBridge.tsx and src/app (QA only). */
type W = {
  __harborScene: { camera: { flying(): boolean; pose(): Pose; jump(p: Pose): void }; stats(): Stats; timeFrames(n: number): { median: number; p95: number; max: number } };
  __harborDesk: { store: { dispatch(c: unknown): unknown } };
  __prof: { dts: number[]; marks: { at: number; label: string }[]; stop: boolean };
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const gpu = process.argv.includes('--gpu');
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/batch6/profile.json');
const dsf = Number(arg('dsf', '1'));

const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: gpu ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
// T35: `--query lake=sw-gale` profiles the gale what-if (wind on the water, overcast light).
const query = arg('query', '');
await page.goto(`${url}/?debug${query ? `&${query}` : ''}`);
await page.waitForFunction(() => { const x = window as unknown as Partial<W>; return Boolean(x.__harborScene?.camera && x.__harborDesk); });
await page.evaluate(() => (window as unknown as W).__harborDesk.store.dispatch({ type: 'advanceToUncertain' }));
await page.waitForTimeout(800);
// Warm-up: compile programs and upload buffers for the overview, the dock view and one selected slip.
await page.evaluate(() => (window as unknown as W).__harborScene.timeFrames(30));
const memoryBefore = await page.evaluate(() => { const s = (window as unknown as W).__harborScene.stats(); return { geometries: s.geometries, textures: s.textures, programs: s.programs }; });

// Continuous recorder: every animation frame of the run.
await page.evaluate(() => {
  const w = window as unknown as W;
  w.__prof = { dts: [], marks: [], stop: false };
  let last = performance.now();
  const tick = (t: number) => {
    w.__prof.dts.push(t - last);
    last = t;
    if (!w.__prof.stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const phases: unknown[] = [];
const selectionMs: Record<string, number> = {};
/** Wait for a fly-to to finish, then orbit ±25° (or pan, for the plan view) for the rest of `seconds`. */
async function phase(label: string, seconds: number, action: () => Promise<unknown>, mode: 'orbit' | 'pan' = 'orbit') {
  const t0 = Date.now();
  await page.evaluate((l) => { const w = window as unknown as W; w.__prof.marks.push({ at: w.__prof.dts.length, label: l }); }, label);
  await action();
  await page.waitForTimeout(60);
  await page.waitForFunction(() => (window as unknown as W).__harborScene.camera.flying() === false);
  const remaining = Math.max(500, seconds * 1000 - (Date.now() - t0));
  const stats = await page.evaluate(
    async ([ms, pan]) => {
      const h = (window as unknown as W).__harborScene;
      const pose = h.camera.pose();
      const [px, py, pz] = pose.position as [number, number, number];
      const [tx, ty, tz] = pose.target as [number, number, number];
      const r = Math.hypot(px - tx, pz - tz);
      const a0 = Math.atan2(pz - tz, px - tx);
      let mid: Stats | null = null;
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const tick = (t: number) => {
          const k = (t - t0) / (ms as number);
          const s = Math.sin(k * Math.PI * 2);
          if (pan) h.camera.jump({ position: [px + s * 90, py, pz + s * 60], target: [tx + s * 90, ty, tz + s * 60] });
          else {
            const a = a0 + s * 0.44;
            h.camera.jump({ position: [tx + Math.cos(a) * r, py, tz + Math.sin(a) * r], target: pose.target });
          }
          if (!mid && k > 0.25) mid = h.stats();
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      h.camera.jump(pose);
      return mid ?? h.stats();
    },
    [remaining, mode === 'pan'] as const,
  );
  phases.push({
    label,
    seconds,
    drawCalls: stats.calls,
    triangles: stats.triangles,
    hullLods: stats.hullLods.reduce((acc: Record<string, number>, l: number) => ({ ...acc, [`lod${l}`]: (acc[`lod${l}`] ?? 0) + 1 }), {}),
    dpr: stats.dpr,
  });
  console.log(label, JSON.stringify(phases[phases.length - 1]));
}
const preset = (name: string) => () => page.getByRole('radio', { name, exact: true }).click();
/** Dispatch a selection and time how long the inspector takes to show it (the PRD’s “selection feedback”). */
const select = (id: string) => async () => {
  selectionMs[id] = await page.evaluate(async (slip) => {
    const w = window as unknown as W;
    const t0 = performance.now();
    w.__harborDesk.store.dispatch({ type: 'select', selection: { kind: 'slip', id: slip } });
    for (;;) {
      if (document.querySelector('[data-testid="inspector"]')?.textContent?.includes(`Slip ${slip}`)) return Math.round((performance.now() - t0) * 10) / 10;
      await new Promise((r) => setTimeout(r, 0));
      if (performance.now() - t0 > 2000) return -1;
    }
  }, id);
};

const started = Date.now();
await phase('overview', 10, async () => undefined);
await phase('dock-b preset', 10, preset('Dock B'));
await phase('select B-12', 12, select('B-12'));
await phase('select D-10', 8, select('D-10'));
await phase('select A-05', 6, select('A-05'));
await phase('map', 6, preset('Map'), 'pan');
await phase('overview again', 8, preset('Overview'));
const wallSeconds = (Date.now() - started) / 1000;

const recorded = await page.evaluate(() => {
  const w = window as unknown as W;
  w.__prof.stop = true;
  return { dts: w.__prof.dts.slice(2), marks: w.__prof.marks };
});
// Back-to-back cost per view, after the timed run so it cannot disturb it.
const cost: Record<string, unknown> = {};
for (const [label, go] of [['overview', preset('Overview')], ['dock-b', preset('Dock B')], ['b12-selected', select('B-12')]] as const) {
  await go();
  await page.waitForTimeout(1100);
  cost[label] = await page.evaluate(() => { const h = (window as unknown as W).__harborScene; h.timeFrames(10); const f = h.timeFrames(120); const s = h.stats(); return { medianMs: Math.round(f.median * 100) / 100, p95Ms: Math.round(f.p95 * 100) / 100, maxMs: Math.round(f.max * 100) / 100, drawCalls: s.calls, triangles: s.triangles }; });
}
const end = await page.evaluate(() => (window as unknown as W).__harborScene.stats());
await page.evaluate(() => (window as unknown as W).__harborDesk.store.dispatch({ type: 'select', selection: null }));

const sorted = [...recorded.dts].sort((a, b) => a - b);
const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))]!;
const r2 = (n: number) => Math.round(n * 100) / 100;
const summary = {
  seconds: r2(recorded.dts.reduce((a, b) => a + b, 0) / 1000),
  frames: recorded.dts.length,
  medianFps: r2(1000 / q(0.5)),
  medianFrameMs: r2(q(0.5)),
  p95FrameMs: r2(q(0.95)),
  p99FrameMs: r2(q(0.99)),
  maxFrameMs: r2(q(1)),
  framesOver33ms: recorded.dts.filter((d) => d > 33.3).length,
  target: { medianFpsAtLeast: 55, p95FrameMsAtMost: 33.3 },
  meetsTargetOnThisDevice: 1000 / q(0.5) >= 55 && q(0.95) <= 33.3,
};
let git = 'unknown';
try {
  git = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() + (execSync('git status --porcelain .', { encoding: 'utf8' }).trim() ? ' + uncommitted changes' : '');
} catch {
  /* not a repository */
}
const report = {
  measuredAt: new Date().toISOString(),
  build: { url, mode: 'production build served by `vite preview`', git },
  device: { cpu: os.cpus()[0]?.model ?? 'unknown', cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30), platform: `${process.platform} ${process.arch} ${os.release()}` },
  browser: `Chromium ${browser.version()} (Playwright, ${process.argv.includes('--headed') ? 'visible window' : 'headless'})`,
  renderer: end.renderer,
  gpuFlag: gpu,
  viewport: '1440x900',
  deviceScaleFactor: dsf,
  canvasDprAtEnd: end.dpr,
  warmUp: '30 back-to-back frames in the overview before recording',
  method: 'requestAnimationFrame spacing for every frame of the run; the camera is moved every frame, so every frame renders',
  wallSeconds: r2(wallSeconds),
  summary,
  phases,
  selectionFeedbackMs: selectionMs,
  backToBackFrameCost: cost,
  rendererMemory: { before: memoryBefore, after: { geometries: end.geometries, textures: end.textures, programs: end.programs } },
  targetHardware: 'PRD §11 names an M1 MacBook Air. This run is NOT on that device unless `device` says so.',
};
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ summary, selectionMs, cost, memory: report.rendererMemory }, null, 1));
console.log(`wrote ${out}`);
await browser.close();
