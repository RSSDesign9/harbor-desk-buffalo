/** T21: actual gzip HTTP transfer and cold-cache startup. Starts/stops its own local static server.
 * node scripts/measure-release.ts [--headed] [--out-dir qa/batch8] — production dist/, 10 Mbps / 100 ms latency, no CPU throttle.
 * Readiness observers run in the page so Node polling latency is not part of reported times.
 */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { chromium, expect } from '@playwright/test';
const outDirIdx = process.argv.indexOf('--out-dir');
const outDir = outDirIdx > 0 ? process.argv[outDirIdx + 1] : 'qa/batch8';
const root = resolve('dist');
const files = (dir: string): string[] => readdirSync(dir).sort().flatMap(f => statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]);
const all = files(root);
const buildId = createHash('sha256');
for (const f of all) { buildId.update(relative(root, f)); buildId.update(readFileSync(f)); }
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' };
const serverMissing: string[] = [];
const served = new Map<string, { path: string; encodedBodySize: number; decodedBodySize: number }>();
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url!, 'http://local').pathname);
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try {
    const raw = readFileSync(file);
    const compressed = /\.(html|js|css|json|svg|txt)$/.test(file) && req.headers['accept-encoding']?.includes('gzip');
    const body = compressed ? gzipSync(raw, { level: 6 }) : raw;
    served.set(pathname, { path: pathname, encodedBodySize: body.length, decodedBodySize: raw.length });
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600', ...(compressed ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
    res.end(body);
  } catch { serverMissing.push(pathname); res.writeHead(404).end('Missing'); }
});
await new Promise<void>(r => server.listen(4720, '127.0.0.1', r));
const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
type W = { __harborScene?: { camera: { flying(): boolean }; stats(): { frame: number; calls: number; renderer: string } }; __harborDesk?: { store: { dispatch(c: unknown): unknown } }; __ready: { shell?: number; scene?: number } };
const samples: unknown[] = [];
const resources = new Map<string, { path: string; encodedBodySize: number; transferSize: number; decodedBodySize: number }>();
const errors: string[] = [], external: string[] = [], failed: string[] = [];
try {
  for (let run = 0; run < 4; run++) {
    const dsf = run === 3 ? 2 : 1;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} ${JSON.stringify(m.location())}`); });
    page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.url()} ${r.status()}`); });
    page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4720') external.push(r.url()); });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 10_000_000 / 8, uploadThroughput: 10_000_000 / 8 });
    await page.addInitScript(() => {
      const w = window as unknown as W; w.__ready = {};
      const tick = () => {
        // T25/T31: the desktop list starts closed and builds rows only when opened, so the useful shell is the
        // search field plus either list options or the four operator KPI tiles with values.
        const kpis = [...document.querySelectorAll('.kpi .data-lg')].filter((k) => k.textContent?.trim());
        if (!w.__ready.shell && (document.querySelector('[role="option"]') || kpis.length >= 4) && document.querySelector('input[type="search"]') && w.__harborDesk) w.__ready.shell = performance.now();
        if (!w.__ready.scene && w.__harborScene?.camera && w.__harborScene.stats().frame >= 2 && w.__harborScene.stats().calls > 0) w.__ready.scene = performance.now();
        if (!w.__ready.scene) requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    });
    await page.goto('http://127.0.0.1:4720/?debug');
    await page.waitForFunction(() => Boolean((window as unknown as W).__ready.scene));
    samples.push({ run: run + 1, dpr: dsf, ...(await page.evaluate(() => ({ ...(window as unknown as W).__ready, renderer: (window as unknown as W).__harborScene!.stats().renderer }))) });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
    if (run === 0 || run === 3) {
      // T25: the desktop registry list starts closed.
      const show = page.getByRole('button', { name: 'Show list', exact: true });
      if (await show.isVisible()) await show.click();
      await page.getByRole('tab', { name: /^Vessels/ }).click();
      await page.getByRole('tab', { name: /^Slips/ }).click();
      await page.getByRole('button', { name: 'Explore slip review', exact: true }).click();
      for (const name of ['Show dock-walk discrepancy', 'Request dock check', 'Review observation', 'Load simulated dock-check result']) await page.getByRole('button', { name, exact: true }).click();
      await page.getByTestId('staff-photo').locator('img').evaluate(async (img: HTMLImageElement) => { await img.decode(); });
      await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
      await page.getByRole('button', { name: 'Confirm identity & resolve', exact: true }).click();
      await expect(page.getByTestId('resolution-headline')).toContainText('Lake Effect confirmed');
      await page.getByRole('button', { name: 'Guided replay', exact: true }).click();
      await page.getByRole('radio', { name: '09:12 Discrepancy', exact: true }).click();
      await page.getByRole('button', { name: 'About', exact: true }).click(); // T25: top bar on desktop
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: 'Map', exact: true }).click(); // T29 dock map
      await page.setViewportSize({ width: 390, height: 844 }); // deferred plan module
      // T29: a capable GPU opens mobile on the 3D map; switch to the flat plan so its deferred module is counted.
      await page.waitForFunction(() => document.querySelector('.app')?.getAttribute('data-map'));
      if (await page.locator('.app').getAttribute('data-map') === '3d') {
        await page.getByRole('button', { name: 'Display', exact: true }).click();
        await page.getByRole('checkbox', { name: /^Use 3D map/ }).uncheck();
        await page.keyboard.press('Escape');
      }
      await page.waitForSelector('.plan-svg');
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => undefined))); });
      const entries = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(e => {
        const r = e as PerformanceResourceTiming;
        return { path: new URL(r.name).pathname, encodedBodySize: r.encodedBodySize, transferSize: r.transferSize, decodedBodySize: r.decodedBodySize };
      }));
      for (const e of entries) resources.set(e.path, e);
      // Once every workflow asset and fallback chunk has loaded, turn networking off and repeat a real workflow.
      await page.getByRole('button', { name: 'Back to my run', exact: true }).click();
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Restart demo', exact: true }).click();
      await page.getByRole('button', { name: 'Explore slip review', exact: true }).click();
      for (const name of ['Show dock-walk discrepancy', 'Review observation', 'Load simulated dock-check result']) await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
      await page.getByRole('button', { name: 'Confirm identity & resolve', exact: true }).click();
      await expect(page.getByTestId('resolution-headline')).toContainText('Lake Effect confirmed');
      await page.screenshot({ path: `${outDir}/offline-resolved-dpr${dsf}.png` });
    }
    await context.close();
  }
} finally { await browser.close(); server.close(); }
const rows = [...resources.values()];
const sum = (key: 'encodedBodySize' | 'transferSize' | 'decodedBodySize', set = rows) => set.reduce((a,r) => a + r[key], 0);
const report = {
  measuredAt: new Date().toISOString(), buildId: buildId.digest('hex'),
  device: { cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGB: os.totalmem() / 2 ** 30, os: os.release() },
  browser: browser.version(), headed: process.argv.includes('--headed'), viewport: '1440x900', network: '10 Mbps down/up, 100 ms latency (CDP), no CPU throttling; actual gzip level 6 HTTP responses',
  coldCache: 'Each sample is a fresh context with network cache disabled; shared browser/GPU process (no driver-cache flush); no app warm-up',
  readiness: 'In-page animation-frame observer: search + domain store + (list options or four valued KPI tiles, since T25 closes the desktop list); initial 3D = camera ready and >=2 rendered frames with draw calls', samples,
  transfer: { encodedBodyBytes: [...served.values()].reduce((n,r)=>n+r.encodedBodySize,0), resourceTimingEncodedBodyBytes: sum('encodedBodySize'), servedResponses: [...served.values()], resourceTimingTransferBytes: sum('transferSize'), decodedBodyBytes: sum('decodedBodySize'), fontBodyBytes: sum('encodedBodySize', rows.filter(r=>/woff2?$/.test(r.path))), fontTransferBytes: sum('transferSize', rows.filter(r=>/woff2?$/.test(r.path))), resources: rows, wholeDistGzipBytesWithoutMaps: all.filter(f=>!f.endsWith('.map')).reduce((n,f)=>n+(/\.(html|js|css|json|svg|txt)$/.test(f) ? gzipSync(readFileSync(f), {level:6}).length : statSync(f).size),0), note: 'Union of actual requested paths across complete demo at DPR 1 and 2, including both evidence densities and deferred mobile plan; Server-recorded compressed response bodies include browser favicon requests absent from Resource Timing; Resource Timing transfer includes standardized header overhead. Licenses and unlinked authoring gallery are separately included in whole dist.' },
  disk: { allBytes: all.reduce((n,f)=>n+statSync(f).size,0), withoutSourceMapsBytes: all.filter(f=>!f.endsWith('.map')).reduce((n,f)=>n+statSync(f).size,0), files: all.map(f=>relative(root,f)) },
  errors, external, failed, serverMissing, offlineWorkflow: 'Both direct mobile workflows completed after turning network offline; no reload/offline-install claim',
};
writeFileSync(`${outDir}/startup-transfer.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
