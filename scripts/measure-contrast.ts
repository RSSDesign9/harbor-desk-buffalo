/**
 * T17: WCAG text contrast measured on the ACTUAL composited surface (glass over the rendered scene, plan or
 * solid panels), not on token pairs.
 *
 * For each state it takes a screenshot with every text colour made transparent (backgrounds, blur and the
 * scene are untouched, motion paused so the frame is identical), then for every visible text run compares the
 * run's computed colour with each background pixel under its glyph box. Reported ratio = 2nd-percentile pixel
 * (robust against single anti-aliased edge pixels), plus the minimum. Thresholds: 4.5:1, or 3:1 for large text
 * (≥ 24 px, or ≥ 18.66 px at weight ≥ 600). Disabled controls are exempt (WCAG 1.4.3) and listed separately.
 *
 *   node scripts/measure-contrast.ts --url http://127.0.0.1:4719 --gpu --out qa/batch7/contrast.json
 */
import { writeFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

const arg = (n: string, f: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1]! : f;
};
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/batch7/contrast.json');

type Cmds = unknown[];
const ISS = 'ISS-0001';
const UNCERTAIN: Cmds = [{ type: 'advanceToUncertain' }, { type: 'select', selection: { kind: 'slip', id: 'B-12' } }];
const REVIEW: Cmds = [...UNCERTAIN, { type: 'requestDockCheck', issueId: ISS }, { type: 'openReview', issueId: ISS }, { type: 'loadDockCheckResult', issueId: ISS }];
const RESOLVED: Cmds = [...REVIEW, { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true }, { type: 'confirmIdentity', issueId: ISS }];

interface State {
  name: string;
  size: [number, number];
  theme: 'dark' | 'light';
  solid?: boolean;
  cmds: Cmds;
  scroll?: string;
  hover?: string;
}
const STATES: State[] = [
  { name: 'desktop-dark-overview', size: [1440, 900], theme: 'dark', cmds: [] },
  { name: 'desktop-dark-uncertain', size: [1440, 900], theme: 'dark', cmds: UNCERTAIN },
  { name: 'desktop-dark-review-staff-card', size: [1440, 900], theme: 'dark', cmds: REVIEW, scroll: '[data-testid="staff-evidence"]' },
  { name: 'desktop-dark-possible-match', size: [1440, 900], theme: 'dark', cmds: UNCERTAIN, scroll: '.possible-match' },
  { name: 'desktop-light-possible-match', size: [1440, 900], theme: 'light', cmds: UNCERTAIN, scroll: '.possible-match' },
  { name: 'desktop-dark-confirm-block', size: [1440, 900], theme: 'dark', cmds: REVIEW, scroll: '.confirm-block' },
  { name: 'desktop-light-confirm-block', size: [1440, 900], theme: 'light', cmds: REVIEW, scroll: '.confirm-block' },
  { name: 'desktop-dark-resolved', size: [1440, 900], theme: 'dark', cmds: RESOLVED },
  { name: 'desktop-dark-unknown-berth', size: [1440, 900], theme: 'dark', cmds: [{ type: 'select', selection: { kind: 'slip', id: 'C-05' } }] },
  { name: 'desktop-light-uncertain', size: [1440, 900], theme: 'light', cmds: UNCERTAIN },
  { name: 'desktop-light-review-staff-card', size: [1440, 900], theme: 'light', cmds: REVIEW, scroll: '[data-testid="staff-evidence"]' },
  { name: 'desktop-solid-uncertain', size: [1440, 900], theme: 'dark', solid: true, cmds: UNCERTAIN },
  { name: 'tablet-dark-uncertain', size: [1024, 768], theme: 'dark', cmds: UNCERTAIN },
  { name: 'mobile-dark-uncertain', size: [390, 844], theme: 'dark', cmds: UNCERTAIN },
  { name: 'mobile-light-list', size: [390, 844], theme: 'light', cmds: [] },
];

async function measure(page: Page) {
  await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; }', });
  await page.waitForTimeout(250);
  const shotB = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ bg }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${bg}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const scale = img.width / innerWidth;
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const L = (r: number, gg: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      // Read colours from a style tag-free source: the text colours were captured before transparency.
      const results: { text: string; where: string; ratio: number; min: number; need: number; px: number; weight: number }[] = [];
      const exempt: string[] = [];
      const zones = '.topbar, .rail, .summary-zone, .notice-zone, .bottom-left-zone, .view-controls, .scene-marker, .plan-toolbar, .plan-legend, .plan-marker, .display-panel';
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const colors = (window as unknown as { __textColors: Map<Element, string> }).__textColors;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.textContent ?? '').trim();
        if (!t) continue;
        const el = n.parentElement!;
        if (!el.closest(zones) || el.closest('.sr-only, [hidden]')) continue; // aria-hidden markers are still visible text
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
        if (rects.length === 0) continue;
        // Clip to every overflow ancestor (scrolled or clipped text is not on screen and must not be sampled).
        let clip = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
        for (let a = el.parentElement; a; a = a.parentElement) {
          const o = getComputedStyle(a);
          if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
          const ar = a.getBoundingClientRect();
          clip = { top: Math.max(clip.top, ar.top), left: Math.max(clip.left, ar.left), bottom: Math.min(clip.bottom, ar.bottom), right: Math.min(clip.right, ar.right) };
        }
        const fg = colors.get(el);
        if (!fg) continue;
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(fg);
        if (!m) continue;
        const [fr, fgc, fb, fa] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
        if (el.closest('button:disabled, [aria-disabled="true"], input:disabled + span, .checkbox:has(input:disabled)')) {
          exempt.push(t.slice(0, 40));
          continue;
        }
        // A line cut by its panel's scroll edge is not readable until scrolled; it is measured in the scrolled states.
        if (rects.some((r) => (Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top)) / r.height < 0.85 && r.bottom > clip.top && r.top < clip.bottom)) {
          exempt.push(`(scroll edge) ${t.slice(0, 30)}`);
          continue;
        }
        const ratios: number[] = [];
        for (const r of rects) {
          const x0 = Math.max(0, Math.floor(Math.max(r.left, clip.left) * scale)), x1 = Math.min(c.width, Math.ceil(Math.min(r.right, clip.right) * scale));
          const y0 = Math.max(0, Math.floor(Math.max(r.top, clip.top) * scale)), y1 = Math.min(c.height, Math.ceil(Math.min(r.bottom, clip.bottom) * scale));
          if (x1 <= x0 || y1 <= y0) continue;
          const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
          const step = Math.max(1, Math.floor(d.length / 4 / 600));
          for (let i = 0; i < d.length; i += 4 * step) {
            const br = d[i]!, bgc = d[i + 1]!, bb = d[i + 2]!;
            // Text colour composited over this pixel.
            const cr = fr * fa + br * (1 - fa), cg = fgc * fa + bgc * (1 - fa), cb = fb * fa + bb * (1 - fa);
            ratios.push(ratio(L(cr, cg, cb), L(br, bgc, bb)));
          }
        }
        if (ratios.length === 0) continue;
        ratios.sort((a, b) => a - b);
        const px = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;
        const large = px >= 24 || (px >= 18.66 && weight >= 600);
        const where = (el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.closest('[class]')?.className ?? el.tagName).toString().slice(0, 40);
        results.push({ text: t.slice(0, 48), where, ratio: Math.round(ratios[Math.floor(ratios.length * 0.02)]! * 100) / 100, min: Math.round(ratios[0]! * 100) / 100, need: large ? 3 : 4.5, px, weight });
      }
      return { checked: results.length, failures: results.filter((r) => r.ratio < r.need), lowest: [...results].sort((a, b) => a.ratio / a.need - b.ratio / b.need).slice(0, 6), exemptDisabled: exempt };
    },
    { bg: shotB },
  );
}

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const report: Record<string, unknown> = {};
for (const st of STATES) {
  const page = await browser.newPage({ viewport: { width: st.size[0], height: st.size[1] }, deviceScaleFactor: 1 });
  await page.addInitScript((p) => localStorage.setItem('harbor-desk:prefs', JSON.stringify(p)), { theme: st.theme, solidPanels: Boolean(st.solid), motionPaused: true, mobile3d: false });
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => Boolean((window as unknown as { __harborDesk?: unknown }).__harborDesk));
  await page.evaluate((cmds) => {
    const s = (window as unknown as { __harborDesk: { store: { dispatch(c: unknown): unknown } } }).__harborDesk.store;
    for (const c of cmds) s.dispatch(c);
  }, st.cmds);
  await page.waitForTimeout(2500);
  if (st.scroll) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), st.scroll);
  await page.waitForTimeout(400);
  // Capture every text colour before the transparency style is applied.
  await page.evaluate(() => {
    const map = new Map<Element, string>();
    for (const el of Array.from(document.querySelectorAll('body *'))) map.set(el, getComputedStyle(el).color);
    (window as unknown as { __textColors: Map<Element, string> }).__textColors = map;
  });
  if (process.argv.includes('--shots')) await page.screenshot({ path: `${out.replace(/[^/]+$/, '')}contrast-${st.name}.png` });
  report[st.name] = await measure(page);
  await page.close();
}
writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), url, gpu: process.argv.includes('--gpu'), report }, null, 1));
for (const [k, v] of Object.entries(report) as [string, { checked: number; failures: unknown[] }][]) console.log(k, 'checked', v.checked, 'failures', v.failures.length, JSON.stringify(v.failures).slice(0, 600));
await browser.close();
