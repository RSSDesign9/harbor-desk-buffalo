/**
 * Rasterize data/derived/site-plan-annotated.svg → .png with the Playwright Chromium already used for tests.
 *   node scripts/render-plan.ts
 */
import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(ROOT, 'data/derived/site-plan-annotated.svg');
const png = join(ROOT, 'data/derived/site-plan-annotated.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(svg).href);
await page.screenshot({ path: png });
await browser.close();
console.log(`Wrote ${png}`);
