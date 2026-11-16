import { expect, test, type Page } from '@playwright/test';

/**
 * Batch 5 (T11–T13) journeys on the production build. Real DOM controls, real store, real canvas (the
 * `?debug` bridge is used to read scene state and, where a test says so, to issue a command a UI control
 * deliberately does not offer, such as confirming without evidence).
 * Headless Chromium renders WebGL through SwiftShader here: this is not GPU validation.
 */
type Hull = { key: string; geometry: string; position: number[]; rotationY: number; nameBoards: number } | null;
type St = {
  interactive: {
    clock: string;
    branchId: string;
    selection: { kind: string; id: string } | null;
    issues: { state: string }[];
    tasks: { id: string; status: string }[];
    decisions: unknown[];
    verifications: unknown[];
    audit: { type: string }[];
    acknowledgedEvidenceIds: string[];
  };
  view: { mode: string };
  fixtures: { observations: unknown[]; agreements: { slipId: string; vesselId: string; status: string }[] };
};
/** The `?debug` bridge, typed locally (scene.spec.ts declares its own narrower global shape). */
type Win = {
  __harborScene: { hull(id: string): Hull; camera: { flying(): boolean } | null };
  __harborDesk: { store: { getState(): St; dispatch(c: unknown): { ok: boolean; reason?: string; effect?: string } } };
};

const ISSUE = 'ISS-0001';
async function open(page: Page) {
  await page.goto('/?debug');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Win>).__harborScene?.camera && (window as unknown as Partial<Win>).__harborDesk));
}
const st = (page: Page) => page.evaluate(() => (window as unknown as Win).__harborDesk.store.getState());
const dispatch = (page: Page, cmd: unknown) => page.evaluate((c) => (window as unknown as Win).__harborDesk.store.dispatch(c), cmd);
const hull = (page: Page, id = 'B-12') => page.evaluate((i) => (window as unknown as Win).__harborScene.hull(i), id);
const idle = (page: Page) => page.waitForFunction(() => (window as unknown as Win).__harborScene.camera!.flying() === false, undefined, { timeout: 10_000 });
const review = (page: Page) => page.getByTestId('slip-review');
const inspector = (page: Page) => page.getByTestId('inspector');
const announcer = (page: Page) => page.getByTestId('announcer');
const kpi = (page: Page, label: string) => page.locator('.kpi', { hasText: label }).locator('.data-lg');
const btn = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

async function toUncertain(page: Page) {
  await btn(page, 'Explore slip review').click();
  await expect(inspector(page).getByRole('heading', { name: /Slip B-12/ })).toBeVisible();
  await btn(page, 'Show dock-walk discrepancy').click();
  await expect(review(page)).toHaveAttribute('data-stage', 'uncertain');
}
const imgLoaded = (page: Page, testId: string) =>
  page.getByTestId(testId).locator('img').evaluate((el) => new Promise<number>((res) => {
    const i = el as HTMLImageElement;
    if (i.complete) res(i.naturalWidth);
    else i.addEventListener('load', () => res(i.naturalWidth), { once: true });
  }));

test('direct path: normal → uncertain → evidence review → acknowledgment → resolution, scene and DOM in step', async ({ page }) => {
  const evidenceRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/evidence/')) evidenceRequests.push(new URL(r.url()).pathname);
  });
  await open(page);
  const fixturesBefore = JSON.stringify((await st(page)).fixtures.observations);

  // Overview → Explore slip review → normal 08:45.
  await expect(kpi(page, 'Needs review')).toHaveText('0');
  await btn(page, 'Explore slip review').click();
  await expect(review(page)).toHaveAttribute('data-stage', 'normal');
  await expect(review(page)).toContainText('Lake Effect departed at 08:10 (staff log).');
  await expect(inspector(page).locator('.summary-grid')).toContainText('AgreementAssigned');
  await expect(inspector(page).locator('.summary-grid')).toContainText('BookableNo');
  expect(await hull(page)).toBeNull(); // no boat drawn at B-12
  await idle(page);

  // Uncertain 09:12.
  await btn(page, 'Show dock-walk discrepancy').click();
  await expect(review(page)).toHaveAttribute('data-stage', 'uncertain');
  await expect(inspector(page).locator('.observation-headline').first()).toHaveText('PresentIdentity unverified');
  await expect(inspector(page).locator('.possible-match')).toContainText('Harbor Light');
  await expect(kpi(page, 'Needs review')).toHaveText('1');
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
  expect(await imgLoaded(page, 'camera-evidence')).toBeGreaterThan(0);
  await expect(page.getByTestId('camera-evidence').locator('img')).toHaveAttribute('alt', /no name is legible/);
  const before = await hull(page);
  expect(before).toMatchObject({ key: 'observed:B-12', nameBoards: 0 });
  expect(evidenceRequests.some((u) => u.includes('ev-p3m8'))).toBe(false); // staff photo not even requested yet

  // Evidence review: camera evidence alone cannot confirm.
  await btn(page, 'Review observation').click();
  await expect(page.getByTestId('comparison')).toContainText('B-14');
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled();
  await expect(page.getByTestId('confirm-hint')).toHaveText('Needs staff evidence.');
  expect(await dispatch(page, { type: 'confirmIdentity', issueId: ISSUE })).toMatchObject({ ok: false, reason: 'evidence_unavailable' });

  // Verification review 09:18 (explicit scenario control).
  await btn(page, 'Load simulated dock-check result').click();
  await expect(page.getByTestId('staff-evidence')).toContainText('registration ending 42 AB match Lake Effect');
  expect(await imgLoaded(page, 'staff-photo')).toBeGreaterThan(0);
  await expect(page.locator('.sim-time')).toContainText('09:18');
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled();
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified'); // no success styling yet
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await expect(btn(page, 'Confirm identity & resolve')).toBeEnabled();

  // Duplicate clicks cannot duplicate decisions, audit or task closure.
  await btn(page, 'Confirm identity & resolve').dblclick();
  await expect(review(page)).toHaveAttribute('data-stage', 'resolved');
  const s = (await st(page)).interactive;
  expect(s.clock).toBe('2026-07-15T13:20:00Z');
  expect(s.decisions).toHaveLength(1);
  expect(s.verifications).toHaveLength(1);
  expect(s.audit.filter((a) => a.type === 'identity_confirmed')).toHaveLength(1);
  expect(s.audit.filter((a) => a.type === 'issue_resolved')).toHaveLength(1);
  expect(s.tasks).toEqual([]);
  await expect(announcer(page)).toHaveText('Lake Effect confirmed at B-12. Issue resolved.');

  // Scene: same hull, same place and geometry, now labelled; review contour and marker cleared.
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Lake Effect');
  await expect(page.locator('.scene-marker-review')).toHaveCount(0);
  await page.waitForFunction(() => ((window as unknown as Win).__harborScene.hull('B-12')?.nameBoards ?? 0) > 0);
  const after = await hull(page);
  expect({ ...after, nameBoards: 0 }).toEqual({ ...before, nameBoards: 0 });
  await expect(kpi(page, 'Needs review')).toHaveText('0');

  // Resolution summary, retained observation and candidate, unchanged agreement.
  await expect(page.getByTestId('resolution-agreement')).toHaveText('Unchanged · Seasonal B-12');
  await expect(page.getByTestId('candidate-note')).toHaveText('Harbor Light, the possible match, is unchanged: assigned B-14, departed 08:30.');
  await expect(page.getByTestId('activity-trail')).toContainText('Vessel present · identity unverifiedCamera C-02 · second source · possible match Harbor Light');
  await page.getByTestId('original-observation').locator('summary').click();
  await expect(page.getByTestId('original-observation')).toContainText('Possible match at the time: Harbor Light');
  await page.screenshot({ path: 'qa/batch13/e2e-resolved-direct.png' });

  // Harbor Light's record and berth: unchanged, and no phantom boat at B-14.
  const fx = (await st(page)).fixtures;
  expect(fx.agreements.filter((a) => a.slipId === 'B-12' || a.slipId === 'B-14').map((a) => `${a.slipId}:${a.vesselId}:${a.status}`)).toEqual(['B-12:V-021:active', 'B-14:V-022:active']);
  expect(JSON.stringify(fx.observations)).toBe(fixturesBefore);
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).fill('Harbor Light');
  await page.getByRole('tab', { name: /Vessels/ }).click();
  await page.getByRole('option', { name: /Harbor Light/ }).click();
  await expect(inspector(page)).toContainText('Away · departed 08:30');
  await expect(inspector(page)).toContainText('Source: staff log');
  expect(await hull(page, 'B-14')).toBeNull();
});

test('pending path: request twice → one task → leave, return, reload → review → resolve → one completed task', async ({ page }) => {
  await open(page);
  await toUncertain(page);
  await page.getByTestId('request-dock-check').dblclick();
  await expect(page.getByTestId('task-status')).toContainText('TSK-0001');
  await expect(page.getByTestId('task-status')).toContainText('no message sent');
  await expect(page.getByTestId('task-status')).toBeFocused();
  await expect(announcer(page)).toHaveText('Dock check TSK-0001 requested at 09:13. No message sent.');
  expect(await dispatch(page, { type: 'requestDockCheck', issueId: ISSUE })).toMatchObject({ ok: true, effect: 'unchanged' });
  let s = (await st(page)).interactive;
  expect(s.tasks).toEqual([expect.objectContaining({ id: 'TSK-0001', status: 'pending' })]);
  expect(s.audit.filter((a) => a.type === 'dock_check_requested')).toHaveLength(1);
  expect(s.issues[0]!.state).toBe('pending_check');
  await expect(kpi(page, 'Needs review')).toHaveText('1');
  await expect(page.getByTestId('request-dock-check')).toHaveCount(0);

  // Selection changes and return keep the unresolved state.
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).fill('B14');
  await page.getByRole('searchbox', { name: 'Search slips and vessels' }).press('Enter');
  await expect(inspector(page).getByRole('heading', { name: /Slip B-14/ })).toBeVisible();
  await btn(page, 'Explore slip review').click();
  await expect(page.getByTestId('task-status')).toContainText('Dock checkTSK-0001');
  await expect(inspector(page).locator('.inspector-head .pill')).toHaveText('Dock check pending');

  // Refresh restores the interactive session; waiting never resolves anything.
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Win>).__harborDesk));
  await expect(page.getByTestId('task-status')).toContainText('TSK-0001');
  await expect(page.locator('.stage-strip li[aria-current="step"]')).toContainText('Dock check');
  s = (await st(page)).interactive;
  expect(s.decisions).toEqual([]);

  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  await expect(page.getByTestId('activity-trail')).toContainText('Dock check completedTSK-0001 closed');
  s = (await st(page)).interactive;
  expect(s.tasks).toEqual([expect.objectContaining({ id: 'TSK-0001', status: 'completed' })]);
  expect(s.audit.filter((a) => a.type === 'dock_check_completed')).toHaveLength(1);
  expect(s.decisions).toHaveLength(1);
  await expect(page.locator('.stage-strip li[data-state="done"]')).toHaveCount(4);
  await page.screenshot({ path: 'qa/batch13/e2e-resolved-pending.png' });
});

test('missing evidence, unchecked acknowledgment and cancel all leave the issue open', async ({ page }) => {
  await open(page);
  await toUncertain(page);
  await btn(page, 'Review observation').click();
  await expect(page.getByTestId('no-staff-evidence')).toContainText('Camera evidence alone cannot confirm identity');
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).toBeDisabled();
  expect(await dispatch(page, { type: 'confirmIdentity', issueId: ISSUE })).toMatchObject({ ok: false, reason: 'evidence_unavailable' });

  await btn(page, 'Load simulated dock-check result').click();
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled();
  await expect(page.getByTestId('confirm-hint')).toHaveText('Tick the acknowledgment above to enable confirmation.');
  expect(await dispatch(page, { type: 'confirmIdentity', issueId: ISSUE })).toMatchObject({ ok: false, reason: 'acknowledgement_required' });

  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Back to observation').click();
  await expect(page.getByTestId('evidence-review')).toHaveCount(0);
  await expect(btn(page, 'Review staff evidence')).toBeFocused();
  await expect(announcer(page)).toHaveText('Back to the observation. B-12 still needs review.');
  await btn(page, 'Review staff evidence').click();
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).not.toBeChecked();
  await expect(btn(page, 'Confirm identity & resolve')).toBeDisabled();

  const s = (await st(page)).interactive;
  expect(s.issues[0]!.state).toBe('open');
  expect(s.decisions).toEqual([]);
  expect(s.acknowledgedEvidenceIds).toEqual([]);
  await expect(kpi(page, 'Needs review')).toHaveText('1');
  await expect(inspector(page).locator('.inspector-head .pill')).toHaveText('Needs review');
});

test('guided replay is read-only and temporally correct; Try this state branches; restart and reload reset', async ({ page }) => {
  const staffPhoto: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('ev-p3m8')) staffPhoto.push(r.url());
  });
  await open(page);
  await toUncertain(page);
  await page.getByTestId('request-dock-check').click();
  const run = (await st(page)).interactive;

  await btn(page, 'Guided replay').click();
  await expect(page.getByTestId('scenario-panel')).toHaveAttribute('data-mode', 'replay');
  await expect(page.getByTestId('replay-banner')).toHaveText(/08:45 snapshot · read-only/);
  await expect(review(page)).toHaveAttribute('data-stage', 'normal');
  await expect(page.getByTestId('readonly-note')).toBeVisible();
  await expect(btn(page, 'Show dock-walk discrepancy')).toHaveCount(0);
  await expect(page.locator('.sim-time .label')).toHaveText('Replay time');

  await page.getByRole('radio', { name: '09:12 Discrepancy' }).click();
  await expect(review(page)).toHaveAttribute('data-stage', 'uncertain');
  await expect(page.getByTestId('task-status')).toHaveCount(0); // the interactive task is not in the snapshot
  await expect(btn(page, 'Review observation')).toHaveCount(0);
  await expect(page.getByTestId('request-dock-check')).toHaveCount(0);
  expect(await dispatch(page, { type: 'requestDockCheck', issueId: ISSUE })).toMatchObject({ ok: false, reason: 'replay_read_only' });

  expect(staffPhoto).toEqual([]); // nothing from 09:18 has been fetched for an earlier snapshot
  await page.getByRole('radio', { name: '09:20 Resolved' }).click();
  await expect(page.getByTestId('resolution-headline')).toHaveText('Lake Effect confirmed at B-12');
  await expect(page.getByTestId('activity-trail')).toContainText('Dock check completed');
  // Backward: the 09:12 snapshot shows nothing from 09:13 onward.
  await page.getByRole('radio', { name: '09:12 Discrepancy' }).click();
  await expect(inspector(page)).not.toContainText('42 AB');
  await expect(inspector(page)).not.toContainText('confirmed at B-12');
  await expect(page.getByTestId('activity-trail')).not.toContainText('Staff evidence received');
  await expect(page.locator('.scene-marker-selected')).toHaveText('B-12 · Vessel present · identity unverified');
  await expect(kpi(page, 'Needs review')).toHaveText('1');

  // Viewing replay never touched the interactive run.
  expect((await st(page)).interactive).toEqual(run);
  await btn(page, 'Back to my run').click();
  await expect(page.getByTestId('task-status')).toContainText('TSK-0001');

  // Try this state: an isolated branch from 09:12.
  await btn(page, 'Guided replay').click();
  await page.getByRole('radio', { name: '09:12 Discrepancy' }).click();
  await btn(page, 'Try this state').click();
  let s = (await st(page)).interactive;
  expect(s).toMatchObject({ branchId: 'branch-1', clock: '2026-07-15T13:12:00Z', tasks: [], decisions: [] });
  await expect(page.getByTestId('scenario-panel')).toHaveAttribute('data-mode', 'interactive');
  await expect(page.getByTestId('request-dock-check')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Win>).__harborDesk));
  s = (await st(page)).interactive;
  expect(s).toMatchObject({ branchId: 'branch-1', clock: '2026-07-15T13:12:00Z', tasks: [] });
  await expect(review(page)).toHaveAttribute('data-stage', 'uncertain');

  // Restart: seed state, nothing selected, storage cleared; reload keeps the seed.
  await btn(page, 'Restart demo').click();
  await expect(btn(page, 'Explore slip review')).toBeFocused();
  s = (await st(page)).interactive;
  expect(s).toMatchObject({ branchId: 'main', clock: '2026-07-15T12:45:00Z', selection: null, issues: [], tasks: [], decisions: [], acknowledgedEvidenceIds: [] });
  await expect(inspector(page)).toHaveCount(0);
  await expect(kpi(page, 'Needs review')).toHaveText('0');
  expect(await page.evaluate(() => localStorage.getItem('harbor-desk:session'))).toBeNull();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<Win>).__harborDesk));
  expect((await st(page)).interactive.issues).toEqual([]);
});

test('keyboard only: focus follows each result and every action is announced', async ({ page }) => {
  await open(page);
  const tabTo = async (name: RegExp, max = 80) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const a = document.activeElement as HTMLInputElement | null;
        if (!a) return '';
        const labelled = a.labels?.[0]?.textContent ?? '';
        return `${a.getAttribute('aria-label') ?? ''} ${a.textContent ?? ''} ${labelled}`.trim();
      });
      if (name.test(label)) return;
    }
    throw new Error(`Never reached ${name}`);
  };
  await page.locator('body').focus();
  await tabTo(/Explore slip review/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-title')).toBeFocused();
  await expect(announcer(page)).toContainText('Slip B-12 selected');

  await tabTo(/Show dock-walk discrepancy/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#review-heading')).toBeFocused();
  await expect(announcer(page)).toHaveText('09:12: dock walk marked B-12 Occupied; camera C-02 shows a vessel, identity unverified. Review issue opened.');

  await tabTo(/^Request dock check$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock-check-status')).toBeFocused();
  await expect(announcer(page)).toContainText('No message sent');

  await tabTo(/^Review observation$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence-review-heading')).toBeFocused();

  await tabTo(/^Load simulated dock-check result$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#staff-evidence-heading')).toBeFocused();
  await expect(announcer(page)).toHaveText('09:18: simulated staff evidence loaded. Review it, then acknowledge.');

  await tabTo(/I reviewed the staff evidence/);
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox', { name: /I reviewed the staff evidence/ })).toBeChecked();
  await tabTo(/^Confirm identity & resolve$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#resolution-heading')).toBeFocused();
  await expect(announcer(page)).toHaveText('Lake Effect confirmed at B-12. Issue resolved.');
  // The focused heading has a visible focus indicator.
  const outline = await page.locator('#resolution-heading').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.screenshot({ path: 'qa/batch13/e2e-keyboard-resolved.png' });
});

test('missing thumbnail and an offline camera keep text evidence, actions and an honest presence state', async ({ page }) => {
  await page.route('**/assets/evidence/ev-7k2q*', (r) => r.abort());
  await open(page);
  await toUncertain(page);
  await expect(page.getByTestId('camera-evidence-missing')).toContainText('Image unavailable · text evidence below');
  await expect(page.getByTestId('camera-evidence-missing')).toHaveAttribute('aria-label', /no name is legible\. Image unavailable\./);
  await expect(page.getByTestId('camera-evidence-text')).toContainText('stern name not legible');
  await expect(page.getByTestId('request-dock-check')).toBeEnabled();

  // Camera C-02 drops at 09:12 (scenario/test control): the delivered 09:12 frame stands; nothing becomes empty.
  expect(await dispatch(page, { type: 'setSourceStatus', sourceId: 'C-02', status: 'offline' })).toMatchObject({ ok: true });
  await expect(page.getByTestId('camera-note')).toHaveText('C-02 offline · last frame 09:12');
  await expect(inspector(page).locator('.observation-headline .pill').first()).toHaveText('Present');

  await btn(page, 'Review observation').click();
  await btn(page, 'Load simulated dock-check result').click();
  // 09:18: the 09:12 frame is stale and the camera is offline → unknown, never empty. Staff evidence is separate.
  await expect(inspector(page).locator('.summary-grid')).toContainText('PresenceUnknown');
  await expect(inspector(page).locator('.observation-headline .pill').first()).toHaveText('Camera offline');
  await expect(page.getByTestId('staff-evidence')).toContainText('Demo dock staff · 09:18');
  expect(await imgLoaded(page, 'staff-photo')).toBeGreaterThan(0);

  await page.getByRole('checkbox', { name: /I reviewed the staff evidence/ }).check();
  await btn(page, 'Confirm identity & resolve').click();
  // The recent staff verification stays valid while the camera is offline.
  await expect(inspector(page)).toContainText('SourceStaff check · 09:18');
  await expect(inspector(page).locator('.summary-grid')).toContainText('PresencePresent');
  await expect(inspector(page)).toContainText('C-02 offline');
});
