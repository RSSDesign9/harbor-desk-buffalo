/**
 * Batch 5 (T11–T13): the slip-review view model, the name board rule, evidence stills and the replay/branch
 * store behaviour, all over the real fixtures and the real engine.
 */
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { apply, type Command } from '../../src/domain/engine.ts';
import { seedSession, type DemoSession } from '../../src/domain/session.ts';
import { buildSnapshot, CHECKPOINT_ORDER } from '../../src/domain/replay.ts';
import { createStore } from '../../src/domain/store.ts';
import { memoryStorage, STORAGE_KEY } from '../../src/domain/persistence.ts';
import { slipPresence, vesselLocation } from '../../src/domain/selectors.ts';
import type { FixtureBundle } from '../../src/domain/types.ts';
import { evidenceImage, resultMessage, slipReview, stageSteps } from '../../src/features/slip-review/model.ts';
import { hullForSlip, nameBoardForSlip } from '../../src/scene/hulls.ts';
import { cruiserDecals } from '../../src/scene/assets/nameboard.ts';

const fx = loadFixtures().bundle;
const sc = fx.scenario;
const ISSUE = 'ISS-0001';
const advance: Command = { type: 'advanceToUncertain' };
const request: Command = { type: 'requestDockCheck', issueId: ISSUE };
const load: Command = { type: 'loadDockCheckResult', issueId: ISSUE };
const review: Command = { type: 'openReview', issueId: ISSUE };
const ack: Command = { type: 'acknowledgeEvidence', evidenceId: sc.staffEvidenceId, value: true };
const confirm: Command = { type: 'confirmIdentity', issueId: ISSUE };

function run(s: DemoSession, ...cmds: Command[]): DemoSession {
  for (const c of cmds) {
    const r = apply(fx, s, c);
    if (!r.ok) throw new Error(`${c.type} rejected: ${r.reason}`);
    s = r.session;
  }
  return s;
}
const m = (s: DemoSession) => slipReview(fx, s, 'B-12')!;

describe('T11 observation review', () => {
  it('normal 08:45: empty but assigned, departure explained, only the scenario control is offered', () => {
    const r = m(seedSession(fx));
    expect(r.stage).toBe('normal');
    expect(r.issue).toBeNull();
    expect(r.normal).toEqual({ assignedName: 'Lake Effect', departedAt: '08:10', observedEmptyAt: '08:45' });
    expect(r.observation).toBeNull();
    expect(r.request).toEqual({ allowed: false, reason: 'no_issue' });
  });

  it('uncertain 09:12: observed vs not established; possible match is a comparison, not an identity', () => {
    const r = m(run(seedSession(fx), advance));
    expect(r.stage).toBe('uncertain');
    expect(r.observation).toMatchObject({ at: '09:12', sourceLabel: 'Camera C-02', possibleMatch: { name: 'Harbor Light' } });
    expect(r.observation!.notEstablished.join(' ')).toMatch(/not legible/);
    expect(r.observation!.image.src).toBe('/assets/evidence/ev-7k2q.webp');
    // Candidate comparison never moves Harbor Light: its row still shows its own assignment.
    const assignedRow = r.comparison!.rows.find((x) => x.label === 'Assigned slip')!;
    expect(assignedRow).toMatchObject({ assigned: 'B-12', candidate: 'B-14' });
    expect(r.comparison!.rows.find((x) => x.label === 'Last activity')).toMatchObject({ candidate: 'Departed B-14 08:30', assigned: 'Departed B-12 08:10' });
    expect(r.request).toEqual({ allowed: true });
    expect(r.confirm.blocker).toBe('evidence_unavailable');
    expect(r.staffEvidence).toBeNull();
    // No future evidence or confirmation text before 09:18 (inv. 8, 10).
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/42 AB|EV-STAFF|staff dock check|confirmed by/i);
    expect(r.resolution).toBeNull();
  });

  it('requesting a check creates one local task, keeps the issue open, and a repeat creates nothing', () => {
    const s1 = run(seedSession(fx), advance, request);
    const r = m(s1);
    expect(r.task).toMatchObject({ id: 'TSK-0001', status: 'pending', requestedAt: '09:13' });
    expect(r.issue!.state).toBe('pending_check');
    expect(r.request).toEqual({ allowed: false, reason: 'already_requested' });
    const again = apply(fx, s1, request);
    expect(again).toMatchObject({ ok: true, effect: 'unchanged' });
    expect(again.session.tasks).toHaveLength(1);
    expect(resultMessage(fx, 'request', again, again.session)).toMatch(/already requested.*No duplicate/);
    expect(resultMessage(fx, 'request', { ok: true, effect: 'changed' }, s1)).toBe('Dock check TSK-0001 requested at 09:13. No message sent.');
  });

  it('selection changes and returning keep the pending issue and the open review', () => {
    const s1 = run(seedSession(fx), advance, request, review);
    const away = run(s1, { type: 'select', selection: { kind: 'slip', id: 'B-14' } }, { type: 'select', selection: { kind: 'vessel', id: 'V-022' } });
    const back = run(away, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
    expect(m(back)).toMatchObject({ stage: 'pending_check', reviewOpen: true, task: { status: 'pending' } });
    expect(back.issues).toEqual(s1.issues);
  });

  it('a missing image still leaves text evidence; a planned (never rendered) asset yields no URL', () => {
    const planned: FixtureBundle = { ...fx, evidenceAssets: fx.evidenceAssets.map((a) => ({ ...a, status: 'planned' as const })) };
    const frame = fx.stagedEvidence.find((e) => e.id === sc.cameraEvidenceId)!;
    expect(evidenceImage(planned, frame)).toEqual({ src: null, srcSet: null, alt: frame.altText });
    const r = slipReview(planned, run(seedSession(fx), advance), 'B-12')!;
    expect(r.observation!.image.src).toBeNull();
    expect(r.observation!.summary).toMatch(/not legible/);
    expect(r.request.allowed).toBe(true);
  });

  it('every available evidence still exists at 1× and 2×, with an opaque name and a modest size', () => {
    for (const a of fx.evidenceAssets.filter((x) => x.status === 'available')) {
      for (const p of [a.path, a.path.replace(/\.webp$/, '@2x.webp')]) {
        const file = new URL(`../../public/${p}`, import.meta.url);
        expect(existsSync(file), p).toBe(true);
        expect(statSync(file).size).toBeLessThan(120_000);
        expect(p).not.toMatch(/lake|harbor|021|022|B-?12/i);
      }
    }
  });

  it('camera offline: the note names the last frame and presence stays unknown, never empty', () => {
    const s = run(seedSession(fx), advance, { type: 'setSourceStatus', sourceId: 'C-02', status: 'offline' }, load);
    const r = m(s);
    expect(r.camera).toMatchObject({ id: 'C-02', status: 'offline' });
    expect(r.camera!.note).toBe('C-02 offline · last frame 09:12');
    expect(slipPresence(fx, s, 'B-12').current).toBe('unknown');
    // Newer staff evidence remains distinct from the stale camera frame.
    expect(r.staffEvidence).toMatchObject({ at: '09:18', sourceLabel: 'Staff dock check' });
  });
});

describe('T12 evidence, acknowledgment, resolution, history', () => {
  it('confirmation is blocked until staff evidence exists AND is acknowledged', () => {
    const open = run(seedSession(fx), advance, review);
    expect(m(open).confirm).toMatchObject({ blocker: 'evidence_unavailable' });
    expect(m(open).confirm.hint).toBe('Needs staff evidence.');
    const loaded = run(open, load);
    expect(m(loaded)).toMatchObject({ stage: 'verification_review', acknowledged: false, confirm: { blocker: 'acknowledgement_required' }, request: { allowed: false, reason: 'staff_evidence_available' } });
    expect(m(loaded).staffEvidence).toMatchObject({ registrationSuffix: '42 AB', vesselName: 'Lake Effect', image: { src: '/assets/evidence/ev-p3m8.webp' } });
    expect(m(run(loaded, ack)).confirm.blocker).toBeNull();
    expect(resultMessage(fx, 'confirm', apply(fx, loaded, confirm), loaded)).toMatch(/acknowledge the staff evidence first.*stays open/);
  });

  it('missing staff evidence: loading fails and the issue stays open', () => {
    const noStaff: FixtureBundle = { ...fx, stagedEvidence: fx.stagedEvidence.filter((e) => e.kind !== 'staff-dock-check') };
    const s = run(seedSession(fx), advance, review);
    const r = apply(noStaff, s, load);
    expect(r).toMatchObject({ ok: false, reason: 'evidence_unavailable' });
    expect(slipReview(noStaff, r.session, 'B-12')!).toMatchObject({ confirm: { blocker: 'evidence_unavailable' }, issue: { state: 'open' } });
    expect(resultMessage(fx, 'load', r, r.session)).toBe('No simulated dock-check result is available. The issue stays open.');
  });

  it('cancel/back leaves the issue open and clears the acknowledgment', () => {
    const before = run(seedSession(fx), advance, request, review, load, ack);
    const after = run(before, { type: 'cancelReview' });
    expect(m(after)).toMatchObject({ reviewOpen: false, acknowledged: false, issue: { state: 'pending_check' }, confirm: { blocker: 'acknowledgement_required' } });
  });

  for (const path of ['pending', 'direct'] as const) {
    it(`resolution (${path} path): summary, unchanged agreement and Harbor Light, retained observation, one result`, () => {
      const cmds = path === 'pending' ? [advance, request, review, load, ack, confirm] : [advance, review, load, ack, confirm];
      const s = run(seedSession(fx), ...cmds);
      const r = m(s);
      expect(r.stage).toBe('resolved');
      expect(r.resolution).toMatchObject({ vesselName: 'Lake Effect', decidedAt: '09:20', verifiedAt: '09:18', agreement: 'Unchanged · Seasonal B-12' });
      expect(r.resolution!.candidateNote).toBe('Harbor Light, the possible match, is unchanged: assigned B-14, departed 08:30.');
      expect(r.trail.filter((x) => x.title === 'Dock check completed').map((x) => x.detail)).toEqual(path === 'pending' ? ['TSK-0001 closed'] : []);
      expect(vesselLocation(fx, s, 'V-022')).toMatchObject({ kind: 'departed', slipId: 'B-14', at: '2026-07-15T12:30:00Z' });
      expect(fx.agreements.find((a) => a.slipId === 'B-12')).toMatchObject({ vesselId: 'V-021', status: 'active' });
      // Original observation and candidate stay in the trail.
      const obs = r.trail.find((x) => x.kind === 'observation')!;
      expect(obs).toMatchObject({ at: '09:12', title: 'Vessel present · identity unverified' });
      expect(obs.detail).toBe('Camera C-02 · second source · possible match Harbor Light');
      // T32: the dock-walk entry opened the issue; both sources stay in the history, in time order.
      expect(r.trail.find((x) => x.kind === 'dock-walk')).toMatchObject({ at: '09:10', title: 'Dock walk · marked Occupied', detail: 'Demo dock staff: Marked Occupied on the morning dock walk; Lake Effect departed 08:10.' });
      expect(r.trail.map((x) => x.at).slice(0, 3)).toEqual(['08:10', '09:10', '09:12']);
      expect(r.trail.filter((x) => x.kind === 'decision')).toHaveLength(1);
      expect(r.trail.filter((x) => x.kind === 'resolution')).toHaveLength(1);
      // Duplicate confirm: same session object, nothing appended.
      const twice = apply(fx, s, confirm);
      expect(twice.session).toBe(s);
      expect(resultMessage(fx, 'confirm', twice, s)).toMatch(/Already resolved/);
    });
  }

  it('the observed hull keeps its key and size; only a name board is added, and only after the decision', () => {
    const before = run(seedSession(fx), advance, request, review, load, ack);
    const after = run(before, confirm);
    expect(hullForSlip(fx, after, 'B-12')).toEqual(hullForSlip(fx, before, 'B-12'));
    expect(nameBoardForSlip(fx, before, 'B-12')).toBeNull();
    expect(nameBoardForSlip(fx, after, 'B-12')).toEqual({ name: 'Lake Effect', registrationSuffix: '42 AB' });
    // Never for the candidate's berth, and never for seed-confirmed neighbours.
    expect(nameBoardForSlip(fx, after, 'B-14')).toBeNull();
    expect(nameBoardForSlip(fx, after, 'B-10')).toBeNull();
  });

  it('name-board decals sit on the transom and bow quarters with unit normals', () => {
    const d = cruiserDecals(28.5 * 0.3048, 9.7 * 0.3048);
    for (const p of [d.name, ...d.registration]) {
      expect(p.position.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...p.normal)).toBeCloseTo(1, 5);
      expect(p.width).toBeGreaterThan(0.3);
      expect(p.width).toBeLessThan(1.2);
    }
    expect(d.name.position[0]).toBeLessThan(-3); // transom, aft of centre
    expect(d.registration.map((r) => Math.sign(r.position[2]))).toEqual([1, -1]); // port and starboard
  });
});

describe('T13 replay, branching, reset', () => {
  it('stage strip: the optional check is skipped on the direct path and done on the pending path', () => {
    const direct = stageSteps(fx, run(seedSession(fx), advance, review, load, ack, confirm));
    expect(direct.map((x) => x.state)).toEqual(['done', 'done', 'skipped', 'done', 'current']);
    const pending = stageSteps(fx, run(seedSession(fx), advance, request));
    expect(pending.map((x) => x.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(pending.map((x) => x.time)).toEqual(['08:45', '09:12', '09:13', '09:18', '09:20']);
  });

  it('earlier snapshots expose no later evidence, decision or audit in the review model', () => {
    const later: Record<string, RegExp> = {
      normal: /09:12|possible match|TSK-|42 AB|confirmed/i,
      uncertain: /TSK-|42 AB|Staff evidence received|confirmed by/i,
      pending_check: /42 AB|Staff evidence received|confirmed by/i,
      verification_review: /Identity confirmed|Issue resolved|confirmed by/i,
    };
    for (const cp of CHECKPOINT_ORDER) {
      const snap = buildSnapshot(fx, cp);
      const text = JSON.stringify(slipReview(fx, snap, 'B-12'));
      if (later[cp]) expect(text, cp).not.toMatch(later[cp]!);
      expect(snap.audit.every((a) => a.eventAt <= sc.checkpoints[cp])).toBe(true);
    }
  });

  it('“Try this state” isolates a branch; refresh restores it; a replay view is never stored', () => {
    const storage = memoryStorage();
    const store = createStore(fx, { backend: 'memory', storage });
    for (const c of [advance, request, review, load, ack, confirm]) store.dispatch(c);
    store.viewReplay('uncertain');
    // Refresh during replay: the interactive run comes back, not the snapshot.
    const refreshed = createStore(fx, { backend: 'memory', storage });
    expect(refreshed.getState().view.mode).toBe('interactive');
    expect(refreshed.getState().interactive.decisions).toHaveLength(1);
    store.startBranch('uncertain');
    const branch = store.getState().interactive;
    expect(branch).toMatchObject({ branchId: 'branch-1', clock: sc.checkpoints.uncertain, tasks: [], decisions: [], acknowledgedEvidenceIds: [], revealedEvidenceIds: [] });
    expect(createStore(fx, { backend: 'memory', storage }).getState().interactive).toEqual(branch);
    // The branch is independent: requesting a check there creates its own first task.
    store.dispatch(request);
    expect(store.getState().interactive.tasks).toEqual([expect.objectContaining({ id: 'TSK-0001', status: 'pending' })]);
  });

  it('restart clears tasks, decisions, acknowledgment, selection, clock and storage', () => {
    const storage = memoryStorage();
    const store = createStore(fx, { backend: 'memory', storage });
    for (const c of [advance, request, review, load, ack] as Command[]) store.dispatch(c);
    store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-12' } });
    store.restart();
    const s = store.getState().interactive;
    expect(s).toEqual(seedSession(fx));
    expect(s.clock).toBe(sc.checkpoints.normal);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(createStore(fx, { backend: 'memory', storage }).getState().interactive).toEqual(seedSession(fx));
  });
});
