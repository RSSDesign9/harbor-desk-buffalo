/**
 * Renders the two SIMULATED evidence stills from this app's own scene (design/ASSET-PLAN.md, “Simulated
 * evidence images”). No stock or real photography; no real camera is implied.
 *
 *   node scripts/render-evidence.ts [--url http://127.0.0.1:4719] [--gpu]
 *
 * - ev-7k2q: simulated camera C-02 frame at 09:12. Fixed, elevated, wide view of B-12 in the UNCERTAIN state,
 *   so the hull has no name board (nothing identifying exists to render). Graded and stamped like a fixed
 *   camera.
 * - ev-p3m8: simulated staff photo at 09:18. Two handheld shots (transom name board, bow registration panel)
 *   rendered after the identity decision, which is the only state in which the scene draws name boards.
 *
 * Output: public/assets/evidence/<id>.webp (480×300) and <id>@2x.webp (960×600). File names are opaque.
 * Overlays and DOM chrome are hidden through the `?debug` bridge; the app's state is reset afterwards.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

type Pose = { position: number[]; target: number[] };
type W = {
  __harborScene: { camera: { jump(p: Pose): void; flying(): boolean }; overlays(v: boolean): void; hull(id: string): { position: number[]; rotationY: number } | null };
  __harborDesk: { store: { dispatch(c: unknown): { ok: boolean }; restart(): void } };
};

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719')!;
const OUT = new URL('../public/assets/evidence/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror:', e.message));

async function boot(p: Page) {
  await p.goto(`${url}/?debug`);
  await p.evaluate(() => localStorage.clear());
  await p.goto(`${url}/?debug`);
  await p.waitForFunction(() => { const x = window as unknown as Partial<W>; return Boolean(x.__harborScene?.camera && x.__harborDesk); });
  await p.addStyleTag({ content: '.topbar,.rail,.summary-zone,.notice-zone,.scenario-panel,.view-controls,.attribution{visibility:hidden!important}' });
}
const run = (p: Page, cmds: unknown[]) => p.evaluate((c) => { for (const x of c) (window as unknown as W).__harborDesk.store.dispatch(x); }, cmds);

/** Pose relative to the B-12 hull: a = metres toward the bow, b = metres to port, y = height. */
async function shot(p: Page, cam: [number, number, number], target: [number, number, number]): Promise<string> {
  await p.evaluate(
    ([c, t]) => {
      const w = window as unknown as W;
      const h = w.__harborScene.hull('B-12')!;
      const d = [Math.cos(h.rotationY), -Math.sin(h.rotationY)];
      const q = [Math.sin(h.rotationY), Math.cos(h.rotationY)];
      const at = (a: number, b: number, y: number) => [h.position[0]! + d[0]! * a + q[0]! * b, y, h.position[2]! + d[1]! * a + q[1]! * b];
      w.__harborScene.overlays(false);
      w.__harborScene.camera.jump({ position: at(...c), target: at(...t) });
    },
    [cam, target] as const,
  );
  await p.waitForTimeout(900);
  return (await p.screenshot({ type: 'png' })).toString('base64');
}

/** In-page post-processing and WebP encoding (the browser is the encoder: no image dependency). */
async function encode(p: Page, kind: 'camera' | 'staff', shots: string[]): Promise<{ x1: string; x2: string }> {
  return p.evaluate(
    async ({ kind, shots }) => {
      const load = (b64: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${b64}`; });
      const imgs = await Promise.all(shots.map(load));
      await document.fonts.load('500 20px "Atkinson Hyperlegible Mono"');
      const c = document.createElement('canvas');
      c.width = 960;
      c.height = 600;
      const g = c.getContext('2d')!;
      // Deterministic noise.
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      if (kind === 'camera') {
        g.filter = 'saturate(0.62) contrast(1.06) brightness(0.98)';
        g.drawImage(imgs[0]!, 0, 0, 1200, 750, 0, 0, 960, 600);
        g.filter = 'none';
        // Slight cool cast and sensor noise; vignette.
        g.fillStyle = 'rgba(40, 70, 80, 0.08)';
        g.fillRect(0, 0, 960, 600);
        const id = g.getImageData(0, 0, 960, 600);
        for (let i = 0; i < id.data.length; i += 4) {
          const n = (rnd() - 0.5) * 16;
          id.data[i] = id.data[i]! + n;
          id.data[i + 1] = id.data[i + 1]! + n;
          id.data[i + 2] = id.data[i + 2]! + n;
        }
        g.putImageData(id, 0, 0);
        const v = g.createRadialGradient(480, 300, 260, 480, 300, 620);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.32)');
        g.fillStyle = v;
        g.fillRect(0, 0, 960, 600);
        // Timestamp strip, as a fixed camera stamps its frames. Labelled SIM in the frame itself.
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(0, 0, 960, 40);
        g.fillStyle = '#f2f5f8';
        g.font = '500 20px "Atkinson Hyperlegible Mono", monospace';
        g.textBaseline = 'middle';
        g.fillText('C-02  2026-07-15  09:12:00 EDT', 16, 21);
        g.textAlign = 'right';
        g.fillText('SIMULATED', 944, 21);
      } else {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 960, 600);
        const w = 468;
        imgs.forEach((im, i) => {
          // Crop 468×600 around the camera target. The app's inspector framing offset puts the target
          // 200 px left of the viewport centre (half of the 400 px rail inset), so crop there.
          const sw = 750 * (w / 600);
          const cx = i === 0 ? 600 - 200 : 660;
          // Handheld phone exposure: the shaded bow shot is lifted more than the sunlit transom.
          g.filter = i === 0 ? 'saturate(1.04) contrast(1.04) brightness(1.04)' : 'saturate(1.02) contrast(1.08) brightness(1.24)';
          g.drawImage(im, cx - sw / 2, 0, sw, 750, i * (w + 24), 0, w, 600);
          g.filter = 'none';
        });
      }
      const x2 = c.toDataURL('image/webp', 0.82);
      const s = document.createElement('canvas');
      s.width = 480;
      s.height = 300;
      const sg = s.getContext('2d')!;
      sg.imageSmoothingQuality = 'high';
      sg.drawImage(c, 0, 0, 480, 300);
      return { x1: s.toDataURL('image/webp', 0.84), x2 };
    },
    { kind, shots },
  );
}

function write(id: string, img: { x1: string; x2: string }) {
  for (const [suffix, data] of [['', img.x1], ['@2x', img.x2]] as const) {
    if (!data.startsWith('data:image/webp')) throw new Error(`Browser did not encode WebP for ${id}${suffix}`);
    const buf = Buffer.from(data.split(',')[1]!, 'base64');
    writeFileSync(new URL(`${id}${suffix}.webp`, OUT), buf);
    console.log(`wrote public/assets/evidence/${id}${suffix}.webp (${buf.length} bytes)`);
  }
}

// --- 09:12 camera frame: uncertain state, nothing selected.
await boot(page);
await run(page, [{ type: 'advanceToUncertain' }]);
const frame = await shot(page, [-15, -14, 9], [1, -1, 0.5]);
write('ev-7k2q', await encode(page, 'camera', [frame]));

// --- 09:18 staff photo: rendered after the decision (the only state with name boards), nothing selected.
const issueId = 'ISS-0001';
await run(page, [
  { type: 'openReview', issueId },
  { type: 'loadDockCheckResult', issueId },
  { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true },
  { type: 'confirmIdentity', issueId },
  { type: 'select', selection: null },
]);
await page.waitForTimeout(600);
const stern = await shot(page, [-7.4, -1.3, 1.9], [-4.1, -0.1, 0.62]);
const bow = await shot(page, [0.4, -2.7, 1.4], [2.3, -1.0, 0.6]);
write('ev-p3m8', await encode(page, 'staff', [stern, bow]));

await page.evaluate(() => (window as unknown as W).__harborDesk.store.restart());
await browser.close();
