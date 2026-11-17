/**
 * T18 failure and stale-data handling on the production build. Every condition is injected reproducibly:
 * `?debug&fault=…` (src/app/faults.ts, inert without ?debug), a blocked request, or the browser's own
 * WEBGL_lose_context extension. Each journey checks the user keeps a usable path, the failure is stated in
 * plain words, and no domain invariant moves (no duplicate task/decision/audit, no bypassed acknowledgment).
 */
import { expect, test, type Page } from '@playwright/test';
import { btn, dispatch, explore, hull, ISSUE, openApp, presencePill, session, showList, storage, taskRow } from './helpers.ts';

async function resolveDirect(page: Page) {
  // From whatever pane is showing, back to Tasks; the invitation opens the discrepancy directly.
  if (await page.getByTestId('task-queue').isHidden()) await page.locator('#tasks-tab').click();
  await explore(page);
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled(); // no failure path skips acknowledgment
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
}
const auditCount = async (page: Page) => (await session(page)).audit.length;

test('WebGL context lost after load: the plan takes over with the same selection and open review; restart restores 3D; nothing duplicated', async ({ page }) => {
  await openApp(page, '', { scene: true });
  for (const c of [{ type: 'advanceToUncertain' }, { type: 'select', selection: { kind: 'slip', id: 'B-12' } }, { type: 'requestDockCheck', issueId: ISSUE }, { type: 'openReview', issueId: ISSUE }, { type: 'loadDockCheckResult', issueId: ISSUE }]) await dispatch(page, c);
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  const before = await session(page);
  const lost = await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return Boolean(ext);
  });
  expect(lost).toBe(true);
  await expect(page.locator('.notice-title', { hasText: '3D view stopped' })).toBeVisible();
  await expect(page.getByText('The browser lost its graphics context. The plan shows the same records.')).toBeVisible();
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await expect(page.getByTestId('plan-marker')).toHaveText('B-12 · Vessel present · identity unverified');
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).toBeChecked();
  expect(await session(page)).toEqual(before);
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-context-lost.png' });
  await btn(page, 'Restart 3D view').click();
  await page.waitForFunction(() => Boolean((window as unknown as { __harborScene?: { camera: unknown } }).__harborScene?.camera), undefined, { timeout: 20_000 });
  await expect(page.locator('.notice-title', { hasText: '3D view stopped' })).toHaveCount(0);
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
  expect(await session(page)).toEqual(before);
  await btn(page, 'Confirm identity & resolve').click();
  const s = await session(page);
  expect(s.decisions).toHaveLength(1);
  expect(s.tasks).toEqual([expect.objectContaining({ status: 'completed' })]);
  expect(s.audit.filter((a) => a.type === 'identity_confirmed')).toHaveLength(1);
});

test('WebGL unsupported (fault=webgl-unsupported): the plan is the map on desktop and the whole review works on it', async ({ page }) => {
  await openApp(page, '&fault=webgl-unsupported');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByText('This browser has no WebGL. The plan and list show the same records.')).toBeVisible();
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await expect(page.locator('.view-controls')).toHaveCount(0); // no 3D camera controls without 3D
  await resolveDirect(page);
  await expect(page.getByTestId('plan-marker')).toHaveText('B-12 · Lake Effect');
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-no-webgl-desktop.png' });
});

test('invalid geometry (fault=geometry): no map is drawn, the list and record-based review still complete', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page, '&fault=geometry');
  await expect(page.getByText('Map unavailable')).toBeVisible();
  await expect(page.getByText('Map geometry failed its checks, so no map is drawn. The list and the review still work.')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('plan-view')).toHaveCount(0);
  await showList(page);
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.locator('.summary-zone .kpi').first()).toContainText('126'); // records are not geometry
  await resolveDirect(page);
  expect((await session(page)).decisions).toHaveLength(1);
  expect(errors).toEqual([]); // contained by the error boundaries: no uncaught page error
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-geometry.png' });
});

test('missing boat model (fault=model): plain grey stand-ins, a visible note, no implied identity, workflow unchanged', async ({ page }) => {
  await openApp(page, '&fault=model', { scene: true });
  await dispatch(page, { type: 'advanceToUncertain' });
  await expect(page.getByText('Some boat models failed to build')).toBeVisible();
  await taskRow(page, 'B-12').click(); // the issue already exists: open it from the Tasks queue
  await page.waitForFunction(() => (window as unknown as { __harborScene: { hull(id: string): { fallback?: boolean } | null } }).__harborScene.hull('B-12')?.fallback === true);
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
  const before = await hull(page, 'B-12');
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Lake Effect');
  const after = await hull(page, 'B-12');
  expect(after).toMatchObject({ key: before!.key, position: before!.position, fallback: true, nameBoards: 0 }); // never a name on a stand-in
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-model-fallback.png' });
});

test('missing evidence images (fault=evidence): text evidence and actions stay; acknowledgment is still required', async ({ page }) => {
  await openApp(page, '&fault=evidence');
  await explore(page);
  await expect(page.getByTestId('camera-evidence-missing')).toContainText('Image unavailable · text evidence below');
  await expect(page.getByTestId('camera-evidence-text')).toContainText('stern name not legible');
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await expect(page.getByTestId('staff-photo-missing')).toContainText('Image unavailable');
  await expect(page.getByTestId('staff-evidence')).toContainText('registration ending 42 AB match Lake Effect');
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled();
  expect(await dispatch(page, { type: 'confirmIdentity', issueId: ISSUE })).toMatchObject({ ok: false, reason: 'acknowledgement_required' });
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
});

test('missing provenance and a broken reference are quarantined with the reason; the rest of the demo works', async ({ page }) => {
  await openApp(page, '&fault=record-provenance,record-reference');
  await expect(page.getByText('Some demo records were set aside')).toBeVisible();
  const detail = page.getByTestId('quarantine-detail');
  await expect(detail).toContainText('V-030');
  await expect(detail).toContainText('AGR-031');
  await showList(page);
  await expect(page.getByRole('tab', { name: /^Vessels/ })).toHaveText(/112/); // the set-aside vessel is not shown or counted
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).fill('V-030');
  await expect(page.getByText(/No (slips|vessels) match/)).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).fill('');
  await resolveDirect(page);
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-quarantine.png' });
});

test('a broken canonical scenario record is fatal: the workflow is disabled rather than guessed', async ({ page }) => {
  await page.goto('/?debug&fault=scenario-provenance');
  await expect(page.getByText('Demo data failed validation')).toBeVisible();
  await expect(page.getByText(/The workflow is disabled so no false records are shown/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore slip review' })).toHaveCount(0);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeVisible();
});

for (const [fault, message] of [
  ['storage-unavailable', 'Browser storage unavailable'],
  ['storage-corrupt', 'Saved demo data was unreadable. Started fresh.'],
  ['storage-incompatible', 'Saved demo was from an older version. Started fresh.'],
] as const) {
  test(`storage: ${fault} → “${message}”, an in-memory session, and the review still works`, async ({ page }) => {
    await openApp(page, `&fault=${fault}`);
    await expect(page.getByText(message)).toBeVisible();
    expect((await session(page)).issues).toEqual([]);
    await resolveDirect(page);
    expect((await session(page)).decisions).toHaveLength(1);
  });
}

test('storage writes failing mid-session: one plain notice, usability kept, nothing duplicated on retry', async ({ page }) => {
  await openApp(page, '&fault=storage-write');
  await explore(page);
  await expect(page.getByText('Changes are no longer being saved')).toBeVisible();
  expect((await storage(page)).lastSaveError).toMatch(/Quota/);
  await page.getByTestId('request-dock-check').dblclick();
  await dispatch(page, { type: 'requestDockCheck', issueId: ISSUE }); // a retry
  const s = await session(page);
  expect(s.tasks).toHaveLength(1);
  expect(s.audit.filter((a) => a.type === 'dock_check_requested')).toHaveLength(1);
  // Nothing was saved, so a refresh honestly starts from the seed.
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { __harborDesk?: unknown }).__harborDesk));
  expect((await session(page)).issues).toEqual([]);
});

test('stale, offline and unknown sources never read as empty or bookable; newer staff evidence stays distinct', async ({ page }) => {
  await openApp(page);
  // Seed: Dock C camera offline since 07:05; D-06 had glare at 08:45.
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'C-05' } });
  const insp = page.getByTestId('inspector');
  await expect(insp).toContainText('C-04 offline');
  await expect(presencePill(page)).toHaveText('Camera offline'); // unknown, never “Empty”
  await expect(insp.locator('.slip-situation')).toContainText(/Booking(Held by agreement|Availability not assessed)/); // never “available”
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'D-06' } });
  await expect(insp.locator('.observation-headline .pill').first()).toHaveText('Presence unknown');
  await expect(insp).toContainText('Last confirmed: Silver Lining · presence unknown'); // last known, kept apart from current
  // B-12: camera drops at 09:12; at 09:18 the 09:12 frame is stale (last reported kept, current unknown).
  await dispatch(page, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
  await btn(page, 'Show dock-walk discrepancy').click();
  await dispatch(page, { type: 'setSourceStatus', sourceId: 'C-02', status: 'offline' });
  const n = await auditCount(page);
  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await expect(insp).toContainText('Last reported present at 09:12 · current presence unknown');
  await expect(presencePill(page)).toHaveText('Camera offline');
  await expect(insp.locator('.slip-situation')).toContainText('BookingHeld by agreement');
  await expect(page.getByTestId('staff-evidence')).toContainText('Demo dock staff · 09:18');
  expect(await auditCount(page)).toBe(n + 1); // only the staff-evidence event
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-stale-offline.png' });
});

test('mobile with 3D failing to load: the plan is already the default and every action works', async ({ page }) => {
  await page.route('**/assets/SceneRoot-*.js', (r) => r.abort('failed'));
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await resolveDirect(page);
  expect((await session(page)).decisions).toHaveLength(1);
  await page.screenshot({ path: 'qa/handoff/e2e-recovery-mobile.png' });
});
