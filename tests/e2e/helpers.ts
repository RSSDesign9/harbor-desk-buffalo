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
  await tabTo(page, /Show dock-walk discrepancy/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#review-heading')).toBeFocused();
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
