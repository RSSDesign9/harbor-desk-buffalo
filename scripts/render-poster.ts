/**
 * Renders the T24 poster: the opening shot's start pose (ESTABLISHING_POSE) at 08:45 with nothing selected,
 * from this app's own scene, so the poster can fade onto the first live frame (PRD F15).
 *
 *   node scripts/render-poster.ts [--url http://127.0.0.1:4719] [--gpu]
 *
 * Output: public/assets/poster/harbor-1600.webp (1600×1000) and harbor-2400.webp (2400×1500). Rendered at the
 * desktop layout, so the rail's framing offset matches the live scene; DOM chrome and the poster are hidden.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

type Pose = { position: number[]; target: number[] };
type W = { __harborScene: { camera: { flying(): boolean; jump(p: Pose): void; establishing: Pose } } };

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719')!;
const OUT = new URL('../public/assets/poster/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });

for (const [scale, name] of [[1, 'harbor-1600'], [1.5, 'harbor-2400']] as const) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(`${url}/?debug`);
  // Paused motion: no opening shot, and still water for a clean frame. Fresh seed: 08:45, nothing selected.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', solidPanels: false, motionPaused: true, mobile3d: false }));
  });
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__harborScene?.camera));
  await page.waitForTimeout(1500); // let the (skipped) opening shot settle before placing the camera
  await page.evaluate(() => {
    const cam = (window as unknown as W).__harborScene.camera;
    cam.jump(cam.establishing);
  });
  await page.addStyleTag({ content: '.topbar,.rail,.summary-zone,.notice-zone,.bottom-left-zone,.view-controls,.attribution,.scene-poster{visibility:hidden!important}' });
  await page.waitForTimeout(1500);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  // The browser is the WebP encoder (no image dependency), as in render-evidence.ts.
  const data = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.7); // T33: the detailed scene compresses less well; 0.7 keeps the 2× poster near 110 KB
  }, png);
  if (!data.startsWith('data:image/webp')) throw new Error('Browser did not encode WebP');
  const buf = Buffer.from(data.split(',')[1]!, 'base64');
  writeFileSync(new URL(`${name}.webp`, OUT), buf);
  console.log(`wrote public/assets/poster/${name}.webp (${buf.length} bytes)`);
  await page.close();
}
await browser.close();
