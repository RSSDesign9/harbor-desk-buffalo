/**
 * Comparison sheet for T33: any number of labelled captures in a grid, for a before/after or a
 * target/result review. QA only; never shipped.
 *
 *   node scripts/compare-v3.ts --out qa/batch12/sheet.png --cols 2 --title "…" "Before=qa/a.png" "After=qa/b.png" …
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};
const out = opt('out', 'qa/batch12/sheet.png');
const cols = Number(opt('cols', '2'));
const title = opt('title', '');
const items = args.filter((a, i) => a.includes('=') && !args[i - 1]?.startsWith('--')).map((a) => ({ label: a.slice(0, a.indexOf('=')), path: a.slice(a.indexOf('=') + 1) }));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const uri = (path: string) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * 1100 + 24, height: 800 } });
await page.setContent(`<body style="margin:0;background:#101418;font:15px/1.35 system-ui;color:#dfe5ea">
  <div id="sheet" style="padding:12px">
    ${title ? `<h1 style="font-size:20px;font-weight:600;margin:4px 2px 12px">${esc(title)}</h1>` : ''}
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px">
      ${items.map((it) => `<figure style="margin:0"><img src="${uri(it.path)}" style="width:100%;display:block"><figcaption style="padding:6px 2px 4px">${esc(it.label)}</figcaption></figure>`).join('')}
    </div>
  </div></body>`);
await page.waitForTimeout(300);
await page.locator('#sheet').screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
