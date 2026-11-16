/**
 * T17 evidence: the accessibility tree Chromium exposes (Playwright ariaSnapshot) for the rail in each B-12 stage,
 * plus a check that the unverified hull's eventual identity appears nowhere in the observation, markers or
 * announcements before resolution. A SUBSTITUTE record, not a screen-reader test: it shows roles, names and
 * states, not how a reader speaks or navigates them.
 *
 *   node scripts/aria-snapshots.ts --url http://127.0.0.1:4719 --out qa/batch7/aria-snapshots.md
 */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (n: string, f: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1]! : f;
};
const url = arg('url', 'http://127.0.0.1:4719');
const out = arg('out', 'qa/batch7/aria-snapshots.md');
const ISS = 'ISS-0001';
const steps: [string, unknown[]][] = [
  ['08:45 normal (B-12 selected)', [{ type: 'select', selection: { kind: 'slip', id: 'B-12' } }]],
  ['09:12 uncertain', [{ type: 'advanceToUncertain' }]],
  ['09:13 dock check requested', [{ type: 'requestDockCheck', issueId: ISS }]],
  ['09:18 evidence review (staff evidence loaded, not acknowledged)', [{ type: 'openReview', issueId: ISS }, { type: 'loadDockCheckResult', issueId: ISS }]],
  ['09:20 resolved', [{ type: 'acknowledgeEvidence', evidenceId: 'EV-STAFF-0918', value: true }, { type: 'confirmIdentity', issueId: ISS }]],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('harbor-desk:prefs', JSON.stringify({ theme: 'dark', motionPaused: true })));
await page.goto(`${url}/?debug`);
await page.waitForFunction(() => Boolean((window as unknown as { __harborDesk?: unknown }).__harborDesk));
let md = `# Accessibility-tree snapshots (Batch 7)\n\nChromium ${browser.version()} via Playwright \`ariaSnapshot()\`, production build, 1440×900. **Substitute evidence, not a screen-reader test.**\n\n`;
const leaks: string[] = [];
for (const [label, cmds] of steps) {
  await page.evaluate((c) => {
    const s = (window as unknown as { __harborDesk: { store: { dispatch(x: unknown): unknown } } }).__harborDesk.store;
    for (const x of c) s.dispatch(x);
  }, cmds);
  await page.waitForTimeout(600);
  const rail = await page.locator('.rail').ariaSnapshot();
  md += `## ${label}\n\n\`\`\`yaml\n${rail}\n\`\`\`\n\n`;
  if (!label.startsWith('09:20')) {
    // Before resolution the observed hull is never named: not in the observation section, the scene marker or the announcement.
    const observed = await page.locator('[aria-labelledby="sec-observed"]').ariaSnapshot().catch(() => '');
    const marker = (await page.locator('.scene-marker').allTextContents()).join(' ');
    const announced = (await page.getByTestId('announcer').textContent()) ?? '';
    for (const [where, text] of [['observation section', observed], ['scene marker', marker], ['announcement', announced]] as const) if (/Lake Effect/.test(text)) leaks.push(`${label}: ${where}`);
  }
}
md += `## Identity-leak check before resolution\n\n${leaks.length ? leaks.map((l) => `- LEAK: ${l}`).join('\n') : '- None: the observation section, scene marker and announcements never name the observed hull before 09:20.'}\n`;
writeFileSync(out, md);
console.log(`wrote ${out}; leaks: ${leaks.length}`);
await browser.close();
