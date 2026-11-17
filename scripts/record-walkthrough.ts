/**
 * T22 walkthrough recorder: drives the production build through the real UI with a visible pointer and records
 * the browser's own frames (Chrome DevTools screencast), then encodes them with ffmpeg. No video framework.
 *
 *   npm run build && npm run preview                       (serves dist/ on 4719)
 *   node scripts/record-walkthrough.ts --gpu               (captioned walkthrough, 1600×1000)
 *   node scripts/record-walkthrough.ts --gpu --take card   (uncaptioned take, cut into the portfolio card loop)
 *
 * Cut (PRD §15): poster → establishing move → drag-to-assign (+ the lake what-if) → day scrubber →
 * dock-walk review → resolve. The pointer and captions are drawn by this script into the recorded page only;
 * the app is unchanged. Every record shown is simulated, and the app's own “Demo data” label stays in frame.
 *
 * Needs ffmpeg on PATH. Frames go to node_modules/.cache/harbor-record/<take>/ and are deleted after encoding
 * unless --keep-frames is passed.
 *
 * Output (showcase/video/):
 *   harbor-desk-walkthrough-1600.mp4   captioned, ~85 s, H.264 CRF 18 (the walkthrough)
 *   harbor-desk-card-1600.mp4          uncaptioned, ~24 s loop for the /experiments card, ~1.2 Mbit/s
 *   harbor-desk-<take>-marks.json      beat timings in the encoded video
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator } from '@playwright/test';

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719')!;
const take = arg('take', 'walkthrough') as 'walkthrough' | 'card';
const captions = take === 'walkthrough';
const W = 1600;
const H = 1000;
const ROOT = fileURLToPath(new URL('../', import.meta.url)); // decoded: the project path has spaces
const OUT = `${ROOT}showcase/video/`;
const FRAMES = `${ROOT}node_modules/.cache/harbor-record/${take}/`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(OUT, { recursive: true });

type Scene = { camera: { flying(): boolean } | null; project(id: string): { x: number; y: number } | null; map(): { mode: boolean; mix: number } };
type Win = { __harborScene?: Scene; __rec: { caption(text: string | null): void } };

/** Pointer and caption overlay, injected into the recorded page only. */
const OVERLAY = `(() => {
  const css = \`
  #rec-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);will-change:transform}
  #rec-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
  #rec-ring{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;z-index:2147483646;pointer-events:none;
    border:2px solid rgba(255,255,255,.95);opacity:0;transform:scale(.4)}
  #rec-ring.on{animation:recring .45s ease-out}
  @keyframes recring{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(1.25)}}
  #rec-caption{position:fixed;bottom:118px;transition-property:opacity,transform;z-index:2147483645;pointer-events:none;transform:translateX(-50%) translateY(6px);opacity:0;
    transition:opacity .35s ease, transform .35s ease;max-width:640px;padding:12px 18px;border-radius:12px;text-align:center;
    background:rgba(10,22,34,.86);color:#f4f7fa;font:500 17px/1.4 "Work Sans",system-ui,sans-serif;letter-spacing:.005em;
    box-shadow:0 8px 24px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12)}
  #rec-caption.on{opacity:1;transform:translateX(-50%) translateY(0)}\`;
  const add = () => {
    if (document.getElementById('rec-cursor')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'rec-cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 2.5 L4 20.5 L8.6 16.4 L11.6 23.2 L14.7 21.9 L11.8 15.2 L18 15.2 Z" fill="#fff" stroke="#0b1622" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const r = document.createElement('div'); r.id = 'rec-ring';
    const cap = document.createElement('div'); cap.id = 'rec-caption';
    document.body.append(c, r, cap);
    const at = (e) => { c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 2) + 'px)'; };
    addEventListener('pointermove', at, true);
    addEventListener('pointerdown', (e) => { at(e); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); }, true);
    // Centred over the map, clear of the workspace, and always above the camera bar (and its map legend).
    const place = () => {
      const rail = document.querySelector('.rail');
      const right = rail && rail.getBoundingClientRect().width > 0 ? rail.getBoundingClientRect().left : innerWidth;
      const bar = document.querySelector('.view-controls');
      const top = bar && bar.getBoundingClientRect().height > 0 ? bar.getBoundingClientRect().top : innerHeight - 100;
      cap.style.left = (right / 2) + 'px';
      cap.style.bottom = (innerHeight - top + 16) + 'px';
      requestAnimationFrame(place);
    };
    place();
    window.__rec = { caption(text) {
      if (!text) { cap.classList.remove('on'); return; }
      cap.classList.remove('on');
      setTimeout(() => { cap.textContent = text; cap.classList.add('on'); }, cap.textContent ? 220 : 0);
    } };
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();`;

const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
await context.addInitScript(OVERLAY);
const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));

// Fresh run, dark theme, motion running (water, traffic and the opening shot).
await page.goto(`${url}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', solidPanels: false, motionPaused: false, mobileView: 'auto' }));
});

// ---------- screencast ----------
const cdp = await context.newCDPSession(page);
const stamps: number[] = [];
cdp.on('Page.screencastFrame', (f) => {
  const n = stamps.length;
  writeFileSync(`${FRAMES}f${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  stamps.push(f.metadata.timestamp ?? Date.now() / 1000);
  void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const marks: Record<string, number> = {};
const mark = (name: string) => {
  marks[name] = Date.now() / 1000;
};

// ---------- pointer ----------
let px = W * 0.42;
let py = H * 0.62;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Time-based, so a move lasts `ms` however long each input event takes under load. */
async function glide(x: number, y: number, ms = 650) {
  const [x0, y0] = [px, py];
  const t0 = Date.now();
  for (;;) {
    const k = ease(Math.min(1, (Date.now() - t0) / ms));
    await page.mouse.move(x0 + (x - x0) * k, y0 + (y - y0) * k);
    if (k >= 1) break;
    await page.waitForTimeout(8);
  }
  [px, py] = [x, y];
}
const hold = (ms: number) => page.waitForTimeout(ms);
const caption = async (text: string | null) => {
  if (captions) await page.evaluate((t) => (window as unknown as Win).__rec.caption(t), text);
};
const centre = async (loc: Locator) => {
  await loc.waitFor({ state: 'visible' });
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Wheel the workspace until the target is in view, like a person would. */
async function reveal(loc: Locator) {
  await loc.waitFor({ state: 'attached' });
  const rail = await centre(page.locator('.rail-body'));
  for (let i = 0; i < 30; i++) {
    const b = await loc.boundingBox();
    if (b && b.y + b.height < H - 60 && b.y > 90) return;
    await glide(rail.x, Math.min(rail.y, H - 200), 250);
    await page.mouse.wheel(0, b && b.y < 90 ? -90 : 90);
    await hold(60);
  }
}
async function tap(loc: Locator, { ms = 650, pause = 220 } = {}) {
  const p = await centre(loc);
  await glide(p.x, p.y, ms);
  await hold(pause);
  await page.mouse.down();
  await hold(70);
  await page.mouse.up();
}
const button = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const settle = async (ms = 600) => {
  await page.waitForFunction(() => !(window as unknown as Win).__harborScene!.camera!.flying(), undefined, { timeout: 20_000 });
  await hold(ms);
};
const slipPoint = async (id: string) => (await page.evaluate((s) => (window as unknown as Win).__harborScene!.project(s), id))!;

// ---------- the cut ----------
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
await page.goto(`${url}/?debug`);
await page.locator('.scene-poster').first().waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
mark('start');
await page.waitForFunction(() => Boolean((window as unknown as Win).__harborScene?.camera), undefined, { timeout: 30_000 });
await page.mouse.move(px, py);
await hold(800);
await caption('A Buffalo River marina, built in 3D from OpenStreetMap geometry');
await settle(2600);

// 1. Drag-to-assign on the 3D dock map.
mark('assign');
await caption('A boat wants a slip tonight. Drag the request onto the map: fit is checked as you hover.');
await tap(page.getByRole('button', { name: /^Northern Tern/ }));
await hold(700);
await tap(page.getByRole('radio', { name: 'Map', exact: true }));
await page.waitForFunction(() => (window as unknown as Win).__harborScene!.map().mix === 1, undefined, { timeout: 15_000 });
await settle(700);
const handle = await centre(page.getByTestId('request-drag'));
await glide(handle.x, handle.y, 700);
await hold(250);
await page.mouse.down();
const a01 = await slipPoint('A-01');
await glide(a01.x, a01.y, 1400);
await hold(1500);
const d01 = await slipPoint('D-01');
await glide(d01.x, d01.y, 1100);
await hold(1500);
await page.mouse.up();
mark('assigned');
await caption('Dropped on a slip that fits. The boat sails in; nothing teleports, and Undo sends it back.');
await page.getByTestId('request-assigned').waitFor();
await hold(4200);

// 2. Lake what-if.
mark('gale');
await caption('What if a south-west gale blows? The seiche drops the lake, and every fit is re-checked.');
const cond = page.locator('.request-card summary', { hasText: 'Conditions' });
await reveal(cond);
await tap(cond);
await hold(500);
const gale = page.locator('label.lake-option', { hasText: 'SW gale' });
await reveal(gale);
await tap(gale);
await hold(1800);
await tap(page.getByRole('radio', { name: 'Overview', exact: true }));
await settle(2600);
mark('calm');
await tap(page.locator('label.lake-option', { hasText: 'Calm' }));
await hold(900);

// 3. Day scrubber (read-only replay).
mark('scrub');
await caption('Scrub the day: arrivals, departures and camera sweeps replay, read-only.');
await tap(page.locator('.demo-tray > summary'));
await hold(700);
const slider = page.getByRole('slider', { name: 'Day timeline' });
const sb = (await slider.boundingBox())!;
const frac = (min: number) => sb.x + 8 + (sb.width - 16) * (min / 960);
await glide(frac(165), sb.y + sb.height / 2, 700);
await hold(200);
await page.mouse.down();
await glide(frac(14 * 60), sb.y + sb.height / 2, 5200);
await hold(900);
await glide(frac(11 * 60), sb.y + sb.height / 2, 1600);
await page.mouse.up();
await hold(1200);
await tap(button('Return to my run'));
await hold(900);
// Leaving replay usually closes the tray by itself; close it only if it is still open.
if (await page.locator('.demo-tray').evaluate((d) => (d as HTMLDetailsElement).open)) {
  await tap(page.locator('.demo-tray > summary'));
  await hold(500);
}

// 4. Dock-walk review.
mark('review');
await caption('The dock walk marked B-12 occupied, but its boat left at 08:10. Who is in B-12?');
await tap(page.locator('#tasks-tab'));
await hold(500);
await tap(button('Explore slip review'));
await settle(2400);
await caption('A camera shows a boat, not an identity. Presence and identity are kept apart.');
await hold(1400);
const review = button('Review observation');
await reveal(review);
await tap(review);
await hold(2800);
const load = page.getByTestId('load-result');
await reveal(load);
await caption('Staff evidence from the dock check is what can confirm identity.');
await tap(load);
await hold(1800);
const ack = page.getByText(/I reviewed the staff evidence/);
await reveal(ack);
await tap(ack);
await hold(500);
const confirm = button('Confirm identity & resolve');
await reveal(confirm);
await tap(confirm);

// 5. Resolve.
mark('resolved');
await caption('Resolved: Lake Effect confirmed. The berth agreement and the original observation are unchanged.');
await hold(2400);
const agreement = page.getByTestId('resolution-agreement');
await reveal(agreement);
await hold(1200);
const history = page.locator('summary', { hasText: 'Activity history' });
await reveal(history);
await tap(history);
await hold(800);
await reveal(page.getByTestId('activity-trail'));
await hold(1600);
await caption('Harbor Desk · an independent concept · every record here is simulated');
await hold(3600);
mark('end');
await cdp.send('Page.stopScreencast');
await hold(300);
await browser.close();

// ---------- encode ----------
const t0 = marks.start!;
const t1 = marks.end!;
const keep = stamps.map((t, i) => ({ t, i })).filter((f) => f.t >= t0 - 0.05 && f.t <= t1);
if (keep.length < 100) throw new Error(`Only ${keep.length} frames captured`);
const lines: string[] = [];
keep.forEach((f, k) => {
  const next = keep[k + 1]?.t ?? t1;
  lines.push(`file 'f${String(f.i).padStart(5, '0')}.jpg'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
});
lines.push(`file 'f${String(keep[keep.length - 1]!.i).padStart(5, '0')}.jpg'`);
writeFileSync(`${FRAMES}list.txt`, lines.join('\n'));
const rel: Record<string, number> = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round((v - keep[0]!.t) * 100) / 100]));
writeFileSync(`${OUT}harbor-desk-${take}-marks.json`, JSON.stringify({ frames: keep.length, seconds: rel.end, fpsAverage: Math.round((keep.length / rel.end!) * 10) / 10, marks: rel }, null, 2) + '\n');
console.log(`captured ${keep.length} frames over ${rel.end}s`, rel);

const master = `${FRAMES}master.mp4`;
const ff = (args: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ff(['-f', 'concat', '-safe', '0', '-i', `${FRAMES}list.txt`, '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', master]);

if (take === 'walkthrough') {
  execFileSync('cp', [master, `${OUT}harbor-desk-walkthrough-1600.mp4`]);
  console.log('wrote showcase/video/harbor-desk-walkthrough-1600.mp4');
} else {
  // Card loop: opening move, the drag and the boat sailing in, the gale overview, then the review to resolved.
  const seg = (a: number, b: number) => [Math.max(0, a), b] as const;
  const parts = [
    seg(rel.start! + 0.8, rel.start! + 5.4),
    seg(rel.assign! + 4.6, rel.assigned! + 3.2),
    seg(rel.gale! + 4.2, rel.calm! - 0.2),
    seg(rel.review! + 2.2, rel.review! + 7.4),
    seg(rel.resolved! - 3.8, rel.resolved! + 2.6),
  ];
  const fade = 0.35;
  const filters: string[] = [];
  parts.forEach(([a, b], i) => filters.push(`[0:v]trim=${a.toFixed(2)}:${b.toFixed(2)},setpts=PTS-STARTPTS[s${i}]`));
  let last = 's0';
  let offset = parts[0]![1] - parts[0]![0];
  for (let i = 1; i < parts.length; i++) {
    offset -= fade;
    filters.push(`[${last}][s${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[x${i}]`);
    last = `x${i}`;
    offset += parts[i]![1] - parts[i]![0];
  }
  const card = `${OUT}harbor-desk-card-1600.mp4`;
  ff(['-i', master, '-filter_complex', filters.join(';'), '-map', `[${last}]`, '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '1300k', '-maxrate', '1800k', '-bufsize', '3600k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', card]);
  ff(['-ss', '1.2', '-i', card, '-frames:v', '1', '-q:v', '3', `${OUT}harbor-desk-card-poster.jpg`]);
  console.log(`wrote showcase/video/harbor-desk-card-1600.mp4 (${parts.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)}`).join(', ')})`);
}
if (!process.argv.includes('--keep-frames')) rmSync(FRAMES, { recursive: true, force: true });
