/** Shared helpers for the Batch 7 specs (the `?debug` bridge, typed locally). */
import { expect, type Page } from '@playwright/test';

export type Stage = { clock: string; issues: { state: string }[]; tasks: { id: string; status: string }[]; decisions: unknown[]; audit: { type: string }[]; selection: { kind: string; id: string } | null; review: unknown; acknowledgedEvidenceIds: string[] };
type Win = {
  __harborDesk?: { store: { getState(): { interactive: Stage; view: { mode: string }; storage: { backend: string; lastSaveError: string | null } }; dispatch(c: unknown): { ok: boolean; reason?: string; effect?: string } } };
  __harborScene?: { camera: { flying(): boolean } | null; project(id: string, part?: string): { x: number; y: number } | null; stats(): { frame: number }; hull(id: string): { key: string; geometry: string; position: number[]; nameBoards: number; fallback?: boolean } | null };
};
export const ISSUE = 'ISS-0001';

export async function openApp(page: Page, query = '', { scene = false } = {}) {
  await page.goto(`/?debug${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as Win).__harborDesk));
  if (scene) await page.waitForFunction(() => Boolean((window as unknown as Win).__harborScene?.camera), undefined, { timeout: 20_000 });
}
export const session = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborDesk!.store.getState().interactive);
export const storage = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborDesk!.store.getState().storage);
export const dispatch = (page: Page, cmd: unknown) => page.evaluate((c) => (window as unknown as Win).__harborDesk!.store.dispatch(c), cmd);
export const hull = (page: Page, id: string) => page.evaluate((i) => (window as unknown as Win).__harborScene?.hull(i) ?? null, id);
export const frame = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborScene!.stats().frame);
export const announcer = (page: Page) => page.getByTestId('announcer');
/** Desktop starts with the registry list closed (T25); open it when a test reads the list. */
export async function showList(page: Page) {
  const show = page.getByRole('button', { name: 'Show list', exact: true });
  if (await show.isVisible()) await show.click();
  else {
    const browse = page.getByRole('button', { name: 'Slips & vessels', exact: true });
    if (await browse.isVisible()) await browse.click();
  }
}
export const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

// ---------- map-first workspace (16 Nov 2026 refresh) ----------
/** Tasks → “Explore slip review” opens the 09:12 discrepancy at B-12 directly (no separate normal-stage step). */
export async function explore(page: Page) {
  await btn(page, 'Explore slip review').click();
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'uncertain');
}
/** Select B-12 at its normal stage (search), then show the dock-walk discrepancy from the inspector. */
export async function exploreFromNormal(page: Page) {
  const search = page.getByRole('searchbox', { name: 'Search slips and vessels' });
  await search.fill('B12');
  await search.press('Enter');
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'normal');
  await btn(page, 'Show dock-walk discrepancy').click();
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'uncertain');
}
/** The Tasks queue's “Needs review” count (replaces the old Needs-review KPI tile). Readable while hidden. */
export const needsReview = (page: Page) => page.getByTestId('task-queue').locator('.task-section h2', { hasText: 'Needs review' }).locator('span');
/** The Tasks queue row for a slip's issue: “Vessel identity needs review” or “Dock check pending”. */
export const taskRow = (page: Page, slipId: string) => page.getByTestId('task-queue').locator('.task-row', { hasText: `Slip ${slipId}` });
/** The inspector's presence pill: Present, Empty, Camera offline or Presence unknown. */
export const presencePill = (page: Page) => page.getByTestId('inspector').locator('.slip-situation .pill').first();
/** Open (or keep open) the collapsed Demo controls tray. */
export async function demoControls(page: Page) {
  const tray = page.locator('.demo-tray');
  if (!(await tray.evaluate((d) => (d as HTMLDetailsElement).open))) await tray.locator('> summary').click();
}
/** Open the incoming request from Tasks. */
export async function openRequest(page: Page, name = 'Northern Tern') {
  const tasks = page.locator('#tasks-tab');
  if ((await tasks.getAttribute('aria-pressed')) !== 'true' || (await page.getByTestId('task-queue').isHidden())) await tasks.click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByTestId('request-card')).toBeVisible();
}
/** Reveal the request's lake what-if (a disclosure since the refresh). */
export async function openConditions(page: Page) {
  const d = page.locator('.request-card details', { hasText: 'Conditions' });
  if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open))) await d.locator('> summary').click();
}

/** Tab until the focused element's accessible text matches (labels of inputs included). */
export async function tabTo(page: Page, name: RegExp, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const a = document.activeElement as HTMLInputElement | null;
      if (!a) return '';
      return `${a.getAttribute('aria-label') ?? ''} ${a.textContent ?? ''} ${a.labels?.[0]?.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
    });
    if (name.test(label)) return;
  }
  throw new Error(`Never reached ${name}`);
}

/** Complete the B-12 review with the keyboard only. `path` = direct (no dock check) or pending. */
export async function resolveByKeyboard(page: Page, path: 'direct' | 'pending') {
  // The Tasks invitation opens the discrepancy and moves focus to the slip's title.
  await tabTo(page, /Explore slip review/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-title')).toBeFocused();
  await expect(page.getByTestId('slip-review')).toHaveAttribute('data-stage', 'uncertain');
  if (path === 'pending') {
    await tabTo(page, /^Request dock check$/);
    await page.keyboard.press('Enter');
    await expect(page.locator('#dock-check-status')).toBeFocused();
    await expect(announcer(page)).toContainText('No message sent');
  }
  await tabTo(page, /^Review observation$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence-review-heading')).toBeFocused();
  await tabTo(page, /^Load simulated dock-check result$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#staff-evidence-heading')).toBeFocused();
  // Cancel/back once: the acknowledgment is cleared and the issue stays open.
  await tabTo(page, /I reviewed the staff evidence/);
  await page.keyboard.press('Space');
  await tabTo(page, /^Back to observation$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#review-observation-button')).toBeFocused();
  await expect(announcer(page)).toContainText('still needs review');
  await page.keyboard.press('Enter'); // “Review staff evidence”
  await expect(page.locator('#evidence-review-heading')).toBeFocused();
  await tabTo(page, /I reviewed the staff evidence/);
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).not.toBeChecked();
  await page.keyboard.press('Space');
  await tabTo(page, /^Confirm identity & resolve$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#resolution-heading')).toBeFocused();
  await expect(announcer(page)).toHaveText('Lake Effect confirmed at B-12. Issue resolved.');
}

/** Bounding boxes of layout zones that overlap (a collision), at the current viewport. */
export const zoneOverlaps = (page: Page) =>
  page.evaluate(() => {
    const sel = ['.topbar', '.summary-zone', '.notice-zone', '.rail', '.bottom-left-zone', '.view-controls', '.plan-toolbar', '.plan-legend'];
    const boxes = sel.flatMap((s) => {
      const el = document.querySelector(s) as HTMLElement | null;
      if (!el || el.offsetParent === null) return [];
      const r = el.getBoundingClientRect();
      return r.width && r.height ? [{ s, r }] : [];
    });
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const pair = [a.s, b.s];
        // Nested inside the mobile sheet by design (either order): only a real sibling collision counts.
        if (pair.includes('.rail') && (pair.includes('.summary-zone') || pair.includes('.notice-zone')) && document.querySelector('.rail')!.contains(document.querySelector(pair.find((x) => x !== '.rail')!))) continue;
        if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1) hits.push(`${a.s} × ${b.s}`);
      }
    return hits;
  });
