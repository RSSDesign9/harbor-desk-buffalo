/**
 * T17 layout QA: captures the app at the verification sizes and reports overlaps between layout zones and
 * controls that sit under another zone. Never asserts; the browser tests do that.
 *
 *   node scripts/capture-layouts.ts --url http://127.0.0.1:4719 --out qa/batch7 [--gpu] [--stage uncertain] [--select B-12]
 *
 * Sizes: 1440×900, 1280×800, 1024×768, 768×1024, 390×844, and 720×450 at device scale 2 — the CSS viewport and
 * pixel ratio that 200 % browser zoom gives a 1440×900 window (the zoom check itself is tests/e2e/zoom.spec.ts).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (n: string, f?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : f;
};
const url = arg('url', 'http://127.0.0.1:4719')!;
const out = arg('out', 'qa/batch7')!;
const stage = arg('stage');
const select = arg('select');
const suffix = arg('suffix', stage ?? 'overview')!;
mkdirSync(out, { recursive: true });
const ONLY = arg('only');
const SIZES_ALL: [string, number, number, number][] = [
  ['desktop-1440', 1440, 900, 1],
  ['desktop-1600', 1600, 1000, 1],
  ['desktop-1280', 1280, 800, 1],
  ['tablet-1024', 1024, 768, 1],
  ['tablet-768', 768, 1024, 1],
  ['mobile-390', 390, 844, 2],
  ['zoom200-1440', 720, 450, 2],
];
const SIZES = ONLY ? SIZES_ALL.filter(([n]) => ONLY.split(',').includes(n)) : SIZES_ALL;
const STAGES: Record<string, unknown[]> = {
  uncertain: [{ type: 'advanceToUncertain' }],
  review: [{ type: 'advanceToUncertain' }, { type: 'openReview', issueId: 'ISS-0001' }, { type: 'loadDockCheckResult', issueId: 'ISS-0001' }],
  resolved: [
    { type: 'advanceToUncertain' },
    { type: 'requestDockCheck', issueId: 'ISS-0001' },
    { type: 'openReview', issueId: 'ISS-0001' },
    { type: 'loadDockCheckResult', issueId: 'ISS-0001' },
    { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true },
    { type: 'confirmIdentity', issueId: 'ISS-0001' },
  ],
};

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const report: Record<string, unknown> = {};
for (const [name, w, h, dsf] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const theme = arg('theme');
  if (theme || process.argv.includes('--solid') || process.argv.includes('--paused'))
    await page.addInitScript(
      (p) => localStorage.setItem('harbor-desk:prefs', JSON.stringify(p)),
      { theme: theme ?? 'dark', solidPanels: process.argv.includes('--solid'), motionPaused: process.argv.includes('--paused'), mobile3d: false },
    );
  page.on('pageerror', (e) => console.error(name, 'pageerror:', e.message));
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => Boolean((window as unknown as { __harborDesk?: unknown }).__harborDesk));
  await page.evaluate(
    ([cmds, sel]) => {
      const st = (window as unknown as { __harborDesk: { store: { dispatch(c: unknown): unknown } } }).__harborDesk.store;
      for (const c of cmds as unknown[]) st.dispatch(c);
      if (sel) st.dispatch({ type: 'select', selection: { kind: 'slip', id: sel } });
    },
    [stage ? STAGES[stage] ?? [] : [], select ?? null] as const,
  );
  await page.waitForTimeout(2500);
  const zones = await page.evaluate(() => {
    const sel = ['.topbar', '.summary-zone', '.notice-zone', '.rail', '.bottom-left-zone', '.view-controls', '.plan-toolbar', '.plan-legend'];
    const boxes = sel.flatMap((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el || el.offsetParent === null) return [];
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return [];
      return [{ s, x: r.left, y: r.top, r: r.right, b: r.bottom }];
    });
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        // The sheet and in-flow pieces nest legitimately on mobile; only report siblings that cross.
        if (a.s === '.rail' && ['.summary-zone', '.notice-zone'].includes(b.s)) continue;
        const ix = Math.min(a.r, b.r) - Math.max(a.x, b.x);
        const iy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
        if (ix > 1 && iy > 1) overlaps.push(`${a.s} × ${b.s} (${Math.round(ix)}×${Math.round(iy)})`);
      }
    // Controls whose centre is covered by something else (hidden behind an overlay).
    const covered: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, [role="option"], [tabindex="0"]'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue; // off-screen inside a scroller
      let scroller = el.parentElement;
      while (scroller && !/(auto|scroll|hidden)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (cy < sr.top || cy > sr.bottom) continue; // scrolled out of its own panel
      }
      const top = document.elementFromPoint(cx, cy);
      if (top && !el.contains(top) && !top.contains(el)) covered.push(`${el.tagName.toLowerCase()} “${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}” under ${top.className || top.tagName}`);
    }
    const horizontalScroll = document.documentElement.scrollWidth > innerWidth + 1;
    return { layout: document.querySelector('.app')?.getAttribute('data-layout'), map: document.querySelector('.app')?.getAttribute('data-map'), overlaps, covered: covered.slice(0, 12), horizontalScroll, inner: [innerWidth, innerHeight, devicePixelRatio] };
  });
  report[name] = zones;
  await page.screenshot({ path: `${out}/layout-${name}-${suffix}.png` });
  await page.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
