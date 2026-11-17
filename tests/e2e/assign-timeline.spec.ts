/**
 * Batch 11 — T30 fit-aware drag-to-assign and T31 time scrubber + arrivals board (PRD F20, F21).
 * Real pointer drags and real keys; the store is read only to check outcomes.
 */
import { expect, test, type Page } from '@playwright/test';
import { announcer, btn, frame, openApp, session } from './helpers.ts';

type Pose = { e: number; n: number; yaw: number; kind: string };
type W = {
  __harborScene: { project(id: string): { x: number; y: number } | null; transits(): Record<string, Pose>; camera: { flying(): boolean } | null; map(): { mode: boolean; mix: number } };
  __harborDesk: { store: { getState(): { view: { mode: string; at?: string }; interactive: { assignments: { id: string; slipId: string; undoneAt: string | null }[]; clock: string } } } };
};
/** Set the scrubber like a pointer would (one input event), in minutes after 06:00. */
const setScrub = (page: Page, minutes: number) =>
  page.getByRole('slider', { name: 'Day timeline' }).evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, minutes);
const w = (page: Page) => page.evaluate(() => (window as unknown as W).__harborDesk.store.getState());

async function openMap(page: Page) {
  await openApp(page, '', { scene: true });
  await page.getByRole('radio', { name: 'Map', exact: true }).click();
  await page.waitForFunction(() => {
    const h = (window as unknown as W).__harborScene;
    return h.map().mix === 1 && !h.camera!.flying();
  });
  await page.waitForTimeout(300);
}

/** Press the request's drag handle and move the pointer to a slip; returns before releasing. */
async function dragTo(page: Page, slipId: string) {
  const handle = (await page.getByTestId('request-drag').boundingBox())!;
  const p = (await page.evaluate((id) => (window as unknown as W).__harborScene.project(id), slipId))!;
  await page.mouse.move(handle.x + 16, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 10 });
}

/** Sample the planned boat every frame until it stops; fail on any jump. */
const sampleMotion = (page: Page, key: string, ms: number) =>
  page.evaluate(
    async ([k, dur]) => {
      const out: [number, number, number, number][] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < (dur as number)) {
        await new Promise((r) => requestAnimationFrame(r));
        const p = (window as unknown as W).__harborScene.transits()[k as string];
        if (p) out.push([p.e, p.n, p.yaw, performance.now()]);
      }
      return out;
    },
    [key, ms] as const,
  );
/**
 * Fastest speed between samples, m/s. The whole path is ~200 m and its longest leg takes 2.4 s with an ease whose
 * peak is twice the mean, so a continuous run stays under ~170 m/s; a teleport (the whole path in one frame,
 * however slow the frames) is far above it, because samples are timed.
 */
const maxSpeed = (s: [number, number, number, number][]) => s.slice(1).reduce((m, p, i) => Math.max(m, Math.hypot(p[0] - s[i]![0], p[1] - s[i]![1]) / Math.max(1, p[3] - s[i]![3]) * 1000), 0);

test('T30 drag and drop: verdict while dragging, drop assigns with an animated approach (no teleport), undo sends it back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openMap(page);
  // Over a held slip: not offered.
  await dragTo(page, 'B-12');
  await expect(page.getByTestId('drag-chip')).toContainText('B-12 · not offered');
  await page.mouse.up();
  await expect(announcer(page)).toContainText('B-12 is not offered');
  expect((await w(page)).interactive.assignments).toEqual([]);
  // Over a slip too shallow / too narrow: no fit, and dropping does nothing.
  await dragTo(page, 'A-01');
  await expect(page.getByTestId('drag-chip')).toContainText('A-01 · No fit');
  await expect(page.locator('.scene-marker-hover')).toContainText('A-01 · No fit · LOA 36');
  await page.mouse.up();
  await expect(announcer(page)).toContainText('No fit at A-01');
  expect((await w(page)).interactive.assignments).toEqual([]);
  // Over D-01: fits. Drop.
  await dragTo(page, 'D-01');
  await expect(page.getByTestId('drag-chip')).toContainText('D-01 · Fits');
  await expect(page.getByTestId('drag-chip')).toHaveAttribute('data-verdict', 'fits');
  await page.screenshot({ path: 'qa/handoff/t30-drag-over-d01.png' });
  await page.mouse.up();
  const motion = sampleMotion(page, 'ASN:ASN-0001', 4200);
  await expect(page.getByTestId('request-assigned')).toContainText('Assigned to D-01');
  const s = await motion;
  expect(s.length).toBeGreaterThan(8); // it moved over several frames…
  expect(maxSpeed(s)).toBeLessThan(220); // …without a jump
  await expect(announcer(page)).toContainText('Northern Tern assigned to D-01 (demo). Fits');
  expect((await w(page)).interactive.assignments).toEqual([expect.objectContaining({ id: 'ASN-0001', slipId: 'D-01', undoneAt: null })]);
  await expect(page.getByTestId('map-legend')).toContainText(/Reserved\s*13/);
  // Undo: the record stays, stamped; the boat leaves along its path; the slip is offered again.
  await btn(page, 'Undo').click();
  const out = await sampleMotion(page, 'ASN:ASN-0001', 3000);
  expect(out.length).toBeGreaterThan(4);
  expect(maxSpeed(out)).toBeLessThan(220);
  expect((await w(page)).interactive.assignments).toEqual([expect.objectContaining({ id: 'ASN-0001', undoneAt: expect.any(String) })]);
  await expect(page.getByRole('combobox', { name: 'Slip' })).toBeVisible();
  await expect(page.getByTestId('map-legend')).toContainText(/Reserved\s*12/);
  await expect.poll(async () => Object.keys(await page.evaluate(() => (window as unknown as W).__harborScene.transits()))).toEqual([]);
});

test('T30 keyboard path: Slip list → Assign, with the reason announced; held slips are never in the list', async ({ page }) => {
  await openApp(page);
  const list = page.getByRole('combobox', { name: 'Slip' });
  const options = await list.locator('option').allTextContents();
  expect(options[0]).toMatch(/· Fits$/);
  expect(options.some((o) => /· Tight$/.test(o))).toBe(true);
  expect(options.some((o) => /· No fit$/.test(o))).toBe(true);
  expect(options.some((o) => o.startsWith('B-12'))).toBe(false);
  // Choose a no-fit slip: Assign is disabled and the reason says why.
  const noFit = options.find((o) => /No fit$/.test(o))!.split(' · ')[0]!;
  await list.selectOption(noFit);
  await expect(btn(page, 'Assign')).toBeDisabled();
  await expect(page.locator('.request-why')).toContainText('No fit:');
  // Choose the first tight slip in the list (a native select: its keys differ by platform, so the choice is set
  // as a selection), then reach Assign with Tab and press Enter.
  const firstTight = options.findIndex((o) => /Tight$/.test(o));
  await list.selectOption(options[firstTight]!.split(' · ')[0]!);
  await expect(page.locator('.request-why')).toContainText('Tight:');
  await list.focus();
  await page.keyboard.press('Tab');
  await expect(btn(page, 'Assign')).toBeFocused();
  await page.keyboard.press('Enter');
  const slip = options[firstTight]!.split(' · ')[0]!;
  await expect(announcer(page)).toContainText(`Northern Tern assigned to ${slip} (demo). Tight:`);
  await expect(page.getByTestId('request-assigned')).toContainText(`Assigned to ${slip}`);
  await page.getByRole('button', { name: 'Undo' }).focus();
  await page.keyboard.press('Enter');
  await expect(announcer(page)).toContainText(`Assignment to ${slip} undone`);
  // The run's clock, issues and selection never moved.
  const s = await session(page);
  expect(s.clock).toBe('2026-07-15T12:45:00Z');
  expect(s.issues).toEqual([]);
});

test('T31 scrubber by keyboard: read-only scripted day, KPIs and board follow it, backward never shows the future, the run is untouched', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await btn(page, 'Explore slip review').click();
  await btn(page, 'Show dock-walk discrepancy').click();
  const run = await session(page);
  const scrub = page.getByRole('slider', { name: 'Day timeline' });
  await scrub.focus();
  await page.keyboard.press('End');
  await expect(scrub).toHaveAttribute('aria-valuetext', /^22:00 EDT · B-12 resolved/);
  await expect(page.locator('.sim-time')).toContainText('22:00');
  await expect(page.getByTestId('scenario-panel')).toHaveAttribute('data-mode', 'replay');
  await expect(page.locator('.kpi', { hasText: 'Arrivals' })).toContainText('15/15');
  await expect(page.getByTestId('request-card')).toContainText('Read-only here');
  // Home: 06:00, nothing has happened yet.
  await page.keyboard.press('Home');
  await expect(scrub).toHaveAttribute('aria-valuetext', '06:00 EDT');
  await expect(page.locator('.kpi', { hasText: 'Arrivals' })).toContainText('0/15');
  await expect(page.locator('.kpi', { hasText: 'Needs review' })).toContainText('0');
  // Arrow keys step a minute at a time: 09:11 has no issue; 09:12 has it. Backward again: gone.
  await setScrub(page, 3 * 60 + 11);
  await expect(scrub).toHaveAttribute('aria-valuetext', '09:11 EDT');
  const inspector = page.locator('.inspector');
  await expect(inspector).not.toContainText('Identity unverified');
  await page.keyboard.press('ArrowRight');
  await expect(scrub).toHaveAttribute('aria-valuetext', '09:12 EDT · B-12 needs review');
  await expect(page.locator('.kpi', { hasText: 'Needs review' })).toContainText('1');
  await expect(inspector).toContainText('Identity unverified');
  await page.keyboard.press('ArrowLeft');
  await expect(scrub).toHaveAttribute('aria-valuetext', '09:11 EDT');
  await expect(page.locator('.kpi', { hasText: 'Needs review' })).toContainText('0');
  await expect(page.getByRole('heading', { name: 'Slip B-12' })).toBeVisible();
  await expect(inspector).not.toContainText('Identity unverified');
  // The board shows logged arrivals with times and bookings as “due”, never a later check-in time.
  await setScrub(page, 8 * 60);
  await page.locator('.kpi', { hasText: 'Arrivals' }).click();
  const board = page.getByTestId('arrivals-board');
  await expect(board).toContainText('by 14:00');
  const rows = await board.locator('li').evaluateAll((els) => els.map((e) => ({ status: e.getAttribute('data-status'), time: e.querySelector('.board-time')?.textContent ?? '' })));
  for (const r of rows) if (r.status === 'arrived') expect(r.time <= '14:00').toBe(true);
  expect(rows.some((r) => r.status === 'due')).toBe(true);
  await page.screenshot({ path: 'qa/handoff/t31-scrub-1400-board.png' });
  // Back to the run: exactly as it was.
  await btn(page, 'Back to my run').click();
  expect(await session(page)).toEqual(run);
  await expect(page.locator('.sim-time')).toContainText('09:12');
});

test('T31 idle frames: after scrubbing, the paused scene stops rendering; under reduced motion a jump cuts', async ({ page }) => {
  await openApp(page, '', { scene: true });
  const scrub = page.getByRole('slider', { name: 'Day timeline' });
  await scrub.focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(1500);
  const a = await frame(page);
  await page.waitForTimeout(1000);
  expect(await frame(page)).toBe(a);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Home');
  // A cut: the very next state is already at 06:00 (no glide through the day).
  expect((await w(page)).view.at).toBe('2026-07-15T10:00:00Z');
  await page.waitForTimeout(1500);
  const b = await frame(page);
  await page.waitForTimeout(1000);
  expect(await frame(page)).toBe(b);
});
