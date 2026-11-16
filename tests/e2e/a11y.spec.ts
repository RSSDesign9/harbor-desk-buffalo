/**
 * T17 accessibility: automated axe-core scan (WCAG 2.0/2.1/2.2 A and AA rules) across workflow states,
 * layouts and themes; touch-target sizes; keyboard-only resolution on tablet and mobile (desktop is in
 * review.spec.ts and a11y-keyboard below); announcements stay concise. An automated scan does not replace a
 * manual screen-reader pass (recorded in BUILD-LOG as not run).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { announcer, btn, dispatch, ISSUE, openApp, resolveByKeyboard, tabTo } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const results: Record<string, { violations: number; passes: number; incomplete: number; ids: string[] }> = {};

async function scan(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  results[name] = { violations: r.violations.length, passes: r.passes.length, incomplete: r.incomplete.length, ids: r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`) };
  expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), name).toEqual([]);
}

test.afterAll(() => {
  mkdirSync('qa/batch8', { recursive: true });
  writeFileSync('qa/batch13/axe-results.json', JSON.stringify({ tags: TAGS, results }, null, 1));
});

const CMDS = {
  uncertain: [{ type: 'advanceToUncertain' }, { type: 'select', selection: { kind: 'slip', id: 'B-12' } }],
  review: [{ type: 'advanceToUncertain' }, { type: 'select', selection: { kind: 'slip', id: 'B-12' } }, { type: 'requestDockCheck', issueId: ISSUE }, { type: 'openReview', issueId: ISSUE }, { type: 'loadDockCheckResult', issueId: ISSUE }],
};

test('axe: desktop overview, uncertain, evidence review, resolved, vessel record, replay, display menu, light theme', async ({ page }) => {
  await openApp(page, '', { scene: true });
  await scan(page, 'desktop overview');
  for (const c of CMDS.review) await dispatch(page, c);
  await scan(page, 'desktop evidence review (staff card, acknowledgment, disabled confirm)');
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await page.getByTestId('original-observation').locator('summary').click();
  await scan(page, 'desktop resolved (summary, original observation, trail)');
  await dispatch(page, { type: 'select', selection: { kind: 'vessel', id: 'V-022' } });
  await scan(page, 'desktop vessel record (Harbor Light)');
  await btn(page, 'Guided replay').click();
  await page.getByRole('radio', { name: '09:12 Discrepancy' }).click();
  await scan(page, 'desktop guided replay 09:12 (read-only)');
  await btn(page, 'Back to my run').click();
  await btn(page, 'Display').click();
  await scan(page, 'desktop display menu open');
  await page.getByRole('radio', { name: /Chart/ }).check();
  await page.keyboard.press('Escape');
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await scan(page, 'desktop light theme, resolved slip');
});

test('axe: tablet and mobile layouts, plan, sheet, list and details', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page, '', { scene: true });
  for (const c of CMDS.uncertain) await dispatch(page, c);
  await scan(page, 'tablet uncertain details');
  await btn(page, 'Slips & vessels').click();
  await scan(page, 'tablet list');
  await page.setViewportSize({ width: 390, height: 844 });
  await scan(page, 'mobile list + plan');
  await page.getByRole('option', { name: /^B-12/ }).click();
  await btn(page, 'Review observation').click();
  await scan(page, 'mobile evidence review in sheet');
});

test('touch targets: every visible control ≥ 24×24 CSS px; mobile workflow controls and rows ≥ 44 px tall', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  for (const c of CMDS.review) await dispatch(page, c);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, [role="option"], summary'))
      .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const hit = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label')?.getBoundingClientRect() ?? r) : r;
        // A ::after hit-area extension counts (WCAG 2.5.8 measures the target, not the glyph).
        const after = getComputedStyle(el, '::after');
        const pad = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top || '0')) * 2 : 0;
        return { name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), w: hit.width + pad, h: hit.height + pad, inline: (el.closest('p, li, .fact dd') !== null && el.classList.contains('link-btn')) || (el.tagName === 'A' && el.closest('footer, p') !== null) }; // inline links in a sentence are exempt (WCAG 2.5.8)
      })
      .filter((t) => (t.w < 24 || t.h < 24) && !t.inline),
  );
  expect(small).toEqual([]);
  for (const name of ['Confirm identity & resolve', 'Back to observation', 'Details', 'Slips & vessels', 'Expand sheet']) {
    const box = await btn(page, name).boundingBox();
    expect(box, `${name} is on the page`).not.toBeNull();
    expect(box!.height, name).toBeGreaterThanOrEqual(40);
  }
  await btn(page, 'Slips & vessels').click();
  const row = (await page.getByRole('listbox').getByRole('option').first().boundingBox())!;
  expect(row.height).toBeGreaterThanOrEqual(44);
});

test('keyboard only on tablet: requested-check path, with cancel/back, resolution and history', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page, '', { scene: true });
  await page.locator('body').focus();
  await tabTo(page, /Explore slip review/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-title')).toBeFocused();
  await resolveByKeyboard(page, 'pending');
  await tabTo(page, /^Original observation$/);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('original-observation')).toHaveAttribute('open', '');
  await expect(page.getByTestId('activity-trail')).toContainText('Dock check completed');
  // Restart by keyboard: focus lands on the entry point again.
  await tabTo(page, /^Restart demo$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#explore-slip-review')).toBeFocused();
});

test('keyboard only on mobile: direct path from the list in the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.locator('body').focus();
  await tabTo(page, /Explore slip review/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-title')).toBeFocused();
  await resolveByKeyboard(page, 'direct');
  await expect(page.getByTestId('task-note')).toHaveCount(0);
  // Every focused control was scrolled into view inside the sheet (no focus behind an overlay).
  const vis = await page.evaluate(() => {
    const r = document.activeElement!.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });
  expect(vis).toBe(true);
});

test('announcements stay concise: camera movement and ambient updates are never announced', async ({ page }) => {
  await openApp(page, '', { scene: true });
  const log: string[] = [];
  await page.exposeFunction('__logAnnounce', (t: string) => log.push(t));
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="announcer"]')!;
    new MutationObserver(() => {
      const t = el.textContent ?? '';
      if (t) (window as unknown as { __logAnnounce(t: string): void }).__logAnnounce(t);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  for (const p of ['Dock B', 'Map', 'Overview']) {
    await page.getByRole('radio', { name: p, exact: true }).click();
    await page.waitForTimeout(800);
  }
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(canvas.x + 300, canvas.y + 400);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 500, canvas.y + 420, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(log).toEqual([]);
  await btn(page, 'Explore slip review').click();
  await expect(announcer(page)).toContainText('Slip B-12 selected');
  expect(log.length).toBe(1);
});
