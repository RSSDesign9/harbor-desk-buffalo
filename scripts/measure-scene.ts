/**
 * Preliminary scene measurements for TASKS T09 (not the PRD §11 release profile, which is T16).
 * Drives the app in Chromium and records, per view: draw calls and triangles for one frame (shadow pass
 * included), back-to-back frame times with gl.finish(), and requestAnimationFrame pacing during a 6 s orbit.
 *
 *   node scripts/measure-scene.ts --url http://127.0.0.1:4719 --gpu --out qa/batch4/perf-gpu.json
 *
 * Without --gpu, headless Chromium renders in software (SwiftShader): useful as a floor, not as a target.
 */
import { writeFileSync } from 'node:fs';
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

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const gpu = process.argv.includes('--gpu');
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/batch4/perf.json');

const browser = await chromium.launch({ args: gpu ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const results: unknown[] = [];
for (const scale of [1, 2]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => { const x = window as unknown as Partial<W>; return Boolean(x.__harborScene?.camera && x.__harborDesk); });
  // Default 09:12 (Batch 4 baseline); --stage resolved adds the review, staff evidence and decision (Batch 5).
  await page.evaluate((resolved) => {
    const s = (window as unknown as W).__harborDesk.store;
    s.dispatch({ type: 'advanceToUncertain' });
    if (!resolved) return;
    for (const c of [
      { type: 'openReview', issueId: 'ISS-0001' },
      { type: 'loadDockCheckResult', issueId: 'ISS-0001' },
      { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true },
      { type: 'confirmIdentity', issueId: 'ISS-0001' },
    ])
      s.dispatch(c);
  }, arg('stage', 'uncertain') === 'resolved');
  const settle = async () => {
    await page.waitForTimeout(250);
    await page.waitForFunction(() => (window as unknown as W).__harborScene.camera.flying() === false);
    await page.waitForTimeout(500);
  };
  const views: Record<string, () => Promise<unknown>> = {
    overview: async () => page.getByRole('radio', { name: 'Overview' }).click(),
    'dock-b': async () => page.getByRole('radio', { name: 'Dock B' }).click(),
    'b12-selected': async () => page.evaluate(() => (window as unknown as W).__harborDesk.store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-12' } })),
  };
  for (const [view, go] of Object.entries(views)) {
    await go();
    await settle();
    const measured = await page.evaluate(async () => {
      const h = (window as unknown as W).__harborScene;
      h.timeFrames(20); // warm-up: programs compiled, buffers uploaded
      const frames = h.timeFrames(200);
      const stats = h.stats();
      // Orbit ±25° around the current target for 6 s and record rAF spacing.
      const pose = h.camera.pose();
      const [px, py, pz] = pose.position as [number, number, number];
      const [tx, , tz] = pose.target as [number, number, number];
      const r = Math.hypot(px - tx, pz - tz);
      const a0 = Math.atan2(pz - tz, px - tx);
      const dts: number[] = await new Promise((resolve) => {
        const t0 = performance.now();
        let last = t0;
        const list: number[] = [];
        const tick = (t: number) => {
          const k = (t - t0) / 6000;
          const a = a0 + Math.sin(k * Math.PI * 2) * 0.44;
          h.camera.jump({ position: [tx + Math.cos(a) * r, py, tz + Math.sin(a) * r], target: pose.target });
          list.push(t - last);
          last = t;
          if (k < 1) requestAnimationFrame(tick);
          else resolve(list.slice(2));
        };
        requestAnimationFrame(tick);
      });
      h.camera.jump(pose);
      dts.sort((x, y) => x - y);
      const q = (f: number) => dts[Math.min(dts.length - 1, Math.floor(dts.length * f))]!;
      const round = (n: number) => Math.round(n * 100) / 100;
      return {
        renderer: stats.renderer,
        dpr: stats.dpr,
        drawCalls: stats.calls,
        triangles: stats.triangles,
        hullLods: stats.hullLods.reduce((acc: Record<string, number>, l: number) => ({ ...acc, [`lod${l}`]: (acc[`lod${l}`] ?? 0) + 1 }), {}),
        geometries: stats.geometries,
        textures: stats.textures,
        programs: stats.programs,
        backToBackFrameMs: { median: round(frames.median), p95: round(frames.p95), max: round(frames.max) },
        orbit: { seconds: 6, frames: dts.length, medianFps: round(1000 / q(0.5)), medianFrameMs: round(q(0.5)), p95FrameMs: round(q(0.95)), maxFrameMs: round(q(1)) },
      };
    });
    results.push({ view, viewport: '1440x900', deviceScaleFactor: scale, ...(measured as object) });
    console.log(view, `dsf ${scale}`, JSON.stringify(measured));
  }
  await page.close();
}
await browser.close();
writeFileSync(out, `${JSON.stringify({ measuredAt: new Date().toISOString(), url, headless: true, gpuFlag: gpu, browser: `Chromium ${browser.version()}`, platform: `${process.platform} ${process.arch}`, results }, null, 2)}\n`);
console.log(`wrote ${out}`);
