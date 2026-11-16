/**
 * Side-by-side sheet for the T09 visual check: design/visual-target-v2.png beside a capture of the app.
 * The concept render is an authoring reference only; this sheet lives in qa/ and is never shipped.
 *
 *   node scripts/compare-v2.ts qa/batch4/b12-selected-gpu-1440.png qa/batch4/compare-v2.png
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [ours = 'qa/batch4/b12-selected-gpu-1440.png', out = 'qa/batch4/compare-v2.png', label = 'selected B-12 at 09:12'] = process.argv.slice(2);
const uri = (path: string) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 720 } });
await page.setContent(`<body style="margin:0;background:#111;font:14px/1.3 system-ui;color:#ddd">
  <div style="display:flex;gap:8px;padding:8px;align-items:flex-start">
    <figure style="margin:0;flex:1"><img src="${uri('design/visual-target-v2.png')}" style="width:100%;display:block"><figcaption style="padding:6px 2px">Visual target v2 (concept render, authoring reference)</figcaption></figure>
    <figure style="margin:0;flex:1"><img src="${uri(ours)}" style="width:100%;display:block"><figcaption style="padding:6px 2px">Harbor Desk, ${label} (${ours})</figcaption></figure>
  </div></body>`);
await page.waitForTimeout(200);
await page.locator('body > div').screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
