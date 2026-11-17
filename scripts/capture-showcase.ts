/**
 * T22 portfolio stills: the same three moments every time, from the production build, driven through the real UI.
 *
 *   npm run build && npm run preview          (serves dist/ on 4719)
 *   node scripts/capture-showcase.ts --gpu    (real GPU through Metal; without --gpu you get the lite tier)
 *
 * Output (showcase/stills/), each at 1600×1000 and @2x (3200×2000):
 *   01-overview   the whole marina from the Overview preset, nothing selected, 08:45
 *   02-assign     the 3D dock map with the incoming request dragged over D-01 (Fits)
 *   03-uncertain  the 09:12 dock-walk discrepancy at B-12 (camera shows a vessel, identity unverified)
 *   04-gale       the SW gale what-if under the request's Conditions & what-if, map view
 *   05-resolved   B-12 resolved: identity confirmed from staff evidence, agreement unchanged
 * Labels (SIM, ASSUME, “Independent concept”) are part of the UI and stay in frame.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719')!;
const only = arg('only');
const OUT = new URL('../showcase/stills/', import.meta.url);
mkdirSync(OUT, { recursive: true });

type W = {
  __harborScene: { camera: { flying(): boolean } | null; project(id: string): { x: number; y: number } | null; map(): { mode: boolean; mix: number } };
};

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });

async function open(scale: number) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(`${url}/?debug`);
  // Fresh run, dark theme, motion paused (still water, no opening shot) so every still is repeatable.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', solidPanels: false, motionPaused: true, mobileView: 'auto' }));
  });
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__harborScene?.camera), undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  return page;
}
const settle = async (page: Page, ms = 900) => {
  await page.waitForFunction(() => !(window as unknown as W).__harborScene.camera!.flying(), undefined, { timeout: 15_000 });
  await page.waitForTimeout(ms);
};
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const preset = async (page: Page, name: 'Overview' | 'Dock B' | 'Map') => {
  await page.getByRole('radio', { name, exact: true }).click();
  if (name === 'Map') await page.waitForFunction(() => (window as unknown as W).__harborScene.map().mix === 1);
  await settle(page);
};
async function openRequest(page: Page) {
  await page.getByRole('button', { name: /^Northern Tern/ }).click();
  await page.getByTestId('request-card').waitFor();
}
async function dragOver(page: Page, slipId: string) {
  const handle = (await page.getByTestId('request-drag').boundingBox())!;
  const p = (await page.evaluate((id) => (window as unknown as W).__harborScene.project(id), slipId))!;
  await page.mouse.move(handle.x + 16, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 12 });
  await page.waitForTimeout(500);
}
/** The Tasks invitation opens the 09:12 discrepancy at B-12 directly (workspace refresh, 16 Nov). */
const explore = async (page: Page) => {
  await click(page, 'Explore slip review');
  await page.getByTestId('slip-review').and(page.locator('[data-stage="uncertain"]')).waitFor();
};
async function toResolved(page: Page) {
  await explore(page);
  await click(page, 'Review observation');
  await page.getByTestId('load-result').click();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await click(page, 'Confirm identity & resolve');
  await page.getByTestId('slip-review').and(page.locator('[data-stage="resolved"]')).waitFor();
  await page.getByTestId('resolution-agreement').scrollIntoViewIfNeeded();
}

const shots: Record<string, (page: Page) => Promise<void>> = {
  '01-overview': async (page) => preset(page, 'Overview'),
  '02-assign': async (page) => {
    await openRequest(page);
    await preset(page, 'Map');
    await dragOver(page, 'D-01');
  },
  '03-uncertain': async (page) => {
    await explore(page);
    await settle(page, 1200);
  },
  '04-gale': async (page) => {
    await openRequest(page);
    await preset(page, 'Map');
    await page.locator('.request-card summary', { hasText: 'Conditions' }).click();
    await page.locator('label.lake-option', { hasText: 'SW gale' }).click();
    await page.getByTestId('lake-strip').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  },
  '05-resolved': async (page) => {
    await toResolved(page);
    await settle(page, 1200);
  },
};

for (const [name, run] of Object.entries(shots)) {
  if (only && !name.startsWith(only)) continue;
  for (const [scale, suffix] of [[1, ''], [2, '@2x']] as const) {
    const page = await open(scale);
    await run(page);
    const file = `${name}${suffix}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(file, OUT)), type: 'png' });
    console.log(`wrote showcase/stills/${file}`);
    await page.close();
  }
}
await browser.close();
