/**
 * Runtime download totals for PRD §11 (TASKS T16): which files the complete demo actually requests, and what
 * they weigh compressed and uncompressed.
 *
 *   node scripts/measure-transfer.ts [--url http://127.0.0.1:4719] [--out qa/gate-d/transfer.json]
 *
 * Method: run against the production build served by `vite preview`. A cold browser context loads the app
 * with a 2× display (so the larger evidence images and every font weight the UI uses are requested), then
 * walks the whole scenario: 3D scene, both list tabs, a selected slip, the B-12 review through resolution,
 * guided replay and the component gallery route if linked. Every same-origin response is recorded.
 *
 * `vite preview` does not compress, so “transferred” is computed from the files themselves: text assets are
 * gzip- and brotli-compressed here at the levels a static host uses; fonts (WOFF2) and images (WebP/PNG/SVGZ)
 * are already compressed and count at their file size. Uncompressed disk size is reported separately, as are
 * files in dist/ that the demo never requested. Source maps are not runtime resources and are excluded.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/gate-d/transfer.json');
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
type W = { __harborScene?: { camera?: unknown }; __harborDesk?: { store: { dispatch(c: unknown): unknown } } };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const requested = new Map<string, { status: number; type: string }>();
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.origin !== new URL(url).origin) requested.set(r.url(), { status: r.status(), type: 'EXTERNAL' });
  else requested.set(u.pathname === '/' ? '/index.html' : u.pathname, { status: r.status(), type: r.headers()['content-type'] ?? '' });
});
await page.goto(`${url}/?debug`);
await page.waitForFunction(() => { const w = window as unknown as W; return Boolean(w.__harborScene?.camera && w.__harborDesk); });
const dispatch = (c: unknown) => page.evaluate((cmd) => (window as unknown as W).__harborDesk!.store.dispatch(cmd), c);
// The whole scenario, so deferred evidence and every UI state is requested.
// The registry list starts closed on desktop (T25): open it before using its tabs.
const showList = page.getByRole('button', { name: 'Show list', exact: true });
if (await showList.isVisible()) await showList.click();
await page.getByRole('tab', { name: /^Vessels/ }).click();
await page.getByRole('tab', { name: /^Slips/ }).click();
await dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-12' } });
for (const c of [
  { type: 'advanceToUncertain' },
  { type: 'requestDockCheck', issueId: 'ISS-0001' },
  { type: 'openReview', issueId: 'ISS-0001' },
  { type: 'loadDockCheckResult', issueId: 'ISS-0001' },
  { type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true },
  { type: 'confirmIdentity', issueId: 'ISS-0001' },
]) {
  await dispatch(c);
  await page.waitForTimeout(500);
}
await page.getByRole('radio', { name: 'Map', exact: true }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Guided replay' }).click().catch(() => undefined);
await page.waitForTimeout(1200);
await browser.close();

const isText = (f: string) => /\.(js|css|html|json|svg|txt|map|geojson|webmanifest)$/.test(f);
const kind = (f: string) => (/\.woff2?$/.test(f) ? 'font' : /\.(webp|png|jpe?g|avif|svg)$/.test(f) ? 'image' : /\.js$/.test(f) ? 'script' : /\.css$/.test(f) ? 'style' : /\.html$/.test(f) ? 'document' : 'other');
const weigh = (rel: string) => {
  const buf = readFileSync(join(DIST, rel));
  const text = isText(rel);
  return {
    file: rel,
    kind: kind(rel),
    diskBytes: buf.length,
    gzipBytes: text ? gzipSync(buf, { level: 9 }).length : buf.length,
    brotliBytes: text ? brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length : buf.length,
  };
};
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [relative(DIST, join(dir, f))]));
const all = walk(DIST).filter((f) => !f.endsWith('.map'));
const external = [...requested.entries()].filter(([, v]) => v.type === 'EXTERNAL').map(([k]) => k);
const failed = [...requested.entries()].filter(([, v]) => v.status >= 400).map(([k, v]) => `${v.status} ${k}`);
const wanted = [...requested.keys()].filter((k) => k.startsWith('/')).map((k) => decodeURIComponent(k.slice(1)));
const loaded = all.filter((f) => wanted.includes(f)).map(weigh);
const unrequested = all.filter((f) => !wanted.includes(f)).map(weigh);
const sum = (rows: ReturnType<typeof weigh>[], key: 'diskBytes' | 'gzipBytes' | 'brotliBytes') => rows.reduce((a, r) => a + r[key], 0);
const byKind = (rows: ReturnType<typeof weigh>[]) => Object.fromEntries([...new Set(rows.map((r) => r.kind))].map((k) => [k, { files: rows.filter((r) => r.kind === k).length, diskBytes: sum(rows.filter((r) => r.kind === k), 'diskBytes'), gzipBytes: sum(rows.filter((r) => r.kind === k), 'gzipBytes'), brotliBytes: sum(rows.filter((r) => r.kind === k), 'brotliBytes') }]));
const fonts = loaded.filter((r) => r.kind === 'font');
const report = {
  measuredAt: new Date().toISOString(),
  method: 'Production build via vite preview; cold context, 2x display, full B-12 scenario and replay. Compressed sizes computed from dist/ with gzip -9 and brotli 11 for text; fonts and images at file size.',
  requestedFromOtherOrigins: external,
  failedRequests: failed,
  requested: { files: loaded.length, diskBytes: sum(loaded, 'diskBytes'), gzipBytes: sum(loaded, 'gzipBytes'), brotliBytes: sum(loaded, 'brotliBytes'), byKind: byKind(loaded) },
  fonts: { files: fonts.map((f) => `${f.file} (${f.diskBytes} B)`), transferredBytes: sum(fonts, 'diskBytes'), budgetBytes: 200_000, pass: sum(fonts, 'diskBytes') < 200_000 },
  budget: { compressedBytes: 6_000_000, gzipPass: sum(loaded, 'gzipBytes') < 6_000_000 },
  /** Everything deployable, requested or not (other font weights, 1× images when 2× was used, the gallery chunk). */
  wholeDist: { files: all.length, diskBytes: sum([...loaded, ...unrequested], 'diskBytes'), gzipBytes: sum([...loaded, ...unrequested], 'gzipBytes'), brotliBytes: sum([...loaded, ...unrequested], 'brotliBytes') },
  notRequested: unrequested.map((r) => `${r.file} (${r.diskBytes} B)`),
  files: loaded.sort((a, b) => b.gzipBytes - a.gzipBytes),
};
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ requested: report.requested, fonts: report.fonts, budget: report.budget, wholeDist: report.wholeDist, external, failed, notRequested: report.notRequested.length }, null, 1));
console.log(`wrote ${out}`);
