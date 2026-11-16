import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { apply, type Command } from '../../src/domain/engine.ts';
import { seedSession, type DemoSession } from '../../src/domain/session.ts';
import {
  activityTrail,
  bookability,
  confirmBlocker,
  datasetSummary,
  needsReviewCount,
  scenarioStage,
  slipIdentity,
  slipPresence,
  vesselLocation,
} from '../../src/domain/selectors.ts';
import { buildSnapshot, CHECKPOINT_ORDER } from '../../src/domain/replay.ts';
import { createStore } from '../../src/domain/store.ts';
import { memoryStorage, STORAGE_KEY, type StorageLike } from '../../src/domain/persistence.ts';
import type { CheckpointId } from '../../src/domain/types.ts';

const fx = loadFixtures().bundle;
const sc = fx.scenario;
const ISSUE = 'ISS-0001';
const EV = sc.staffEvidenceId;

function run(s: DemoSession, ...cmds: Command[]): DemoSession {
  for (const c of cmds) {
    const r = apply(fx, s, c);
    if (!r.ok) throw new Error(`${c.type} rejected: ${r.reason}`);
    s = r.session;
  }
  return s;
}
const advance: Command = { type: 'advanceToUncertain' };
const request: Command = { type: 'requestDockCheck', issueId: ISSUE };
const load: Command = { type: 'loadDockCheckResult', issueId: ISSUE };
const review: Command = { type: 'openReview', issueId: ISSUE };
const ack: Command = { type: 'acknowledgeEvidence', evidenceId: EV, value: true };
const confirm: Command = { type: 'confirmIdentity', issueId: ISSUE };

const seed = () => seedSession(fx);
const fullPending = () => run(seed(), advance, request, load, review, ack, confirm);
const fullDirect = () => run(seed(), advance, review, load, ack, confirm);

/** Everything that must never change because of B-12 actions. */
const invariantView = (s: DemoSession) => ({
  agreements: JSON.stringify(fx.agreements),
  harborLight: vesselLocation(fx, s, 'V-022'),
  observations: JSON.stringify(fx.observations),
});

describe('canonical stages (PRD §7)', () => {
  it('normal 08:45: B-12 empty, assigned to Lake Effect, not bookable, no issue', () => {
    const s = seed();
    expect(scenarioStage(fx, s)).toBe('normal');
    expect(slipPresence(fx, s, 'B-12')).toMatchObject({ current: 'empty', freshness: 'fresh', basis: { kind: 'camera', sourceId: 'C-02' } });
    expect(slipIdentity(fx, s, 'B-12')).toEqual({ state: 'none' });
    expect(bookability(fx, 'B-12')).toMatchObject({ bookable: false, reason: 'assigned' });
    expect(vesselLocation(fx, s, 'V-021')).toMatchObject({ kind: 'departed', slipId: 'B-12', at: '2026-07-15T12:10:00Z' });
    expect(needsReviewCount(s)).toBe(0);
  });

  it('uncertain 09:12: present, identity unverified, Harbor Light only a candidate; one open issue', () => {
    const s = run(seed(), advance);
    expect(s.clock).toBe(sc.checkpoints.uncertain);
    expect(slipPresence(fx, s, 'B-12').current).toBe('present');
    expect(slipIdentity(fx, s, 'B-12')).toEqual({ state: 'unverified', candidateVesselIds: ['V-022'], observationId: sc.uncertainObservationId });
    expect(s.issues).toEqual([expect.objectContaining({ id: ISSUE, state: 'open', observationId: sc.uncertainObservationId })]);
    expect(datasetSummary(fx, s)).toEqual({ slips: 126, vessels: 113, needsReview: 1 });
    // The issue never claims a confirmed wrong boat.
    expect(s.issues[0]!.reason).not.toMatch(/wrong|mismatch confirmed/i);
  });

  it('pending check 09:13: one task, issue still open, nothing resolved by waiting', () => {
    const s = run(seed(), advance, request);
    expect(s.tasks).toEqual([expect.objectContaining({ status: 'pending', requestedAt: sc.checkpoints.pending_check })]);
    expect(s.issues[0]!.state).toBe('pending_check');
    expect(slipIdentity(fx, s, 'B-12').state).toBe('unverified');
    expect(needsReviewCount(s)).toBe(1);
  });

  it('verification review 09:18: evidence available but nothing closed yet', () => {
    const s = run(seed(), advance, request, load, review);
    expect(scenarioStage(fx, s)).toBe('verification_review');
    expect(s.decisions).toEqual([]);
    expect(s.issues[0]!.state).toBe('pending_check');
    expect(slipIdentity(fx, s, 'B-12').state).toBe('unverified');
    expect(confirmBlocker(fx, s, ISSUE)).toBe('acknowledgement_required');
  });

  it('resolved 09:20: Lake Effect confirmed by an appended decision; observation and candidate retained', () => {
    const s = fullPending();
    expect(s.clock).toBe(sc.checkpoints.resolved);
    expect(slipIdentity(fx, s, 'B-12')).toMatchObject({ state: 'confirmed', vesselId: 'V-021', basis: 'identity-decision' });
    expect(s.decisions).toEqual([expect.objectContaining({ observationId: sc.uncertainObservationId, confirmedVesselId: 'V-021', actorId: 'ACT-DOCKMASTER' })]);
    const obs = fx.observations.find((o) => o.id === sc.uncertainObservationId)!;
    expect(obs.candidateVesselIds).toEqual(['V-022']); // original candidate remains in history
    expect(s.issues[0]).toMatchObject({ state: 'resolved', resolvedAt: sc.checkpoints.resolved });
    expect(s.tasks[0]).toMatchObject({ status: 'completed', completedAt: sc.checkpoints.resolved, verificationId: s.verifications[0]!.id });
    expect(bookability(fx, 'B-12')).toMatchObject({ bookable: false });
    expect(vesselLocation(fx, s, 'V-021')).toMatchObject({ kind: 'confirmed-present', slipId: 'B-12' });
    expect(activityTrail(fx, s, ISSUE).map((e) => e.label)).toEqual([
      'Departure logged',
      'Dock walk · marked Occupied',
      'Camera C-02 · vessel present, identity unverified',
      'Dock check requested',
      'Staff evidence received',
      'Identity confirmed',
      'Dock check completed',
      'Issue resolved',
    ]);
  });

  it('direct review path resolves without a task', () => {
    const s = fullDirect();
    expect(s.tasks).toEqual([]);
    expect(slipIdentity(fx, s, 'B-12')).toMatchObject({ state: 'confirmed', vesselId: 'V-021' });
  });
});

describe('state invariants (PRD §7)', () => {
  it('inv. 1/2: presence, identity, agreement and bookability are independent; B-12 is never bookable', () => {
    let s = seed();
    for (const cmd of [advance, request, load, review, ack, confirm]) {
      s = run(s, cmd);
      expect(bookability(fx, 'B-12').bookable).toBe(false);
    }
    // Unassigned slips are “not assessed”, never “available”.
    const unassigned = fx.slips.find((x) => !fx.agreements.some((a) => a.slipId === x.id))!;
    expect(bookability(fx, unassigned.id)).toEqual({ bookable: null, reason: 'not-assessed' });
  });

  it('inv. 3/4: the candidate never relocates Harbor Light, and no agreement changes, at any stage', () => {
    const before = invariantView(seed());
    let s = seed();
    for (const cmd of [advance, request, load, review, ack, confirm]) {
      s = run(s, cmd);
      expect(invariantView(s)).toEqual(before);
      expect(vesselLocation(fx, s, 'V-022')).toMatchObject({ kind: 'departed', slipId: 'B-14', at: '2026-07-15T12:30:00Z' });
    }
    expect(fx.agreements.find((a) => a.vesselId === 'V-022')?.slipId).toBe('B-14');
    expect(slipPresence(fx, s, 'B-14').current).toBe('empty');
  });

  it('inv. 5: resolution appends; the seed observation objects are untouched', () => {
    const snapshot = JSON.stringify(fx.observations);
    const s = fullPending();
    expect(JSON.stringify(fx.observations)).toBe(snapshot);
    expect(s.verifications).toHaveLength(1);
    expect(s.audit.map((a) => a.type)).toEqual(['issue_opened', 'dock_check_requested', 'staff_evidence_received', 'identity_confirmed', 'dock_check_completed', 'issue_resolved']);
  });

  it('confirmation needs revealed staff evidence AND acknowledgement', () => {
    const uncertain = run(seed(), advance, review);
    expect(apply(fx, uncertain, confirm)).toMatchObject({ ok: false, reason: 'evidence_unavailable' });
    const loaded = run(uncertain, load);
    expect(apply(fx, loaded, confirm)).toMatchObject({ ok: false, reason: 'acknowledgement_required' });
    expect(apply(fx, run(loaded, ack), confirm).ok).toBe(true);
  });

  it('a camera-only candidate cannot resolve the issue (insufficient evidence leaves it open)', () => {
    const s = run(seed(), advance, review);
    // Even acknowledging the camera frame is impossible: it is not revealed staff evidence.
    expect(apply(fx, s, { type: 'acknowledgeEvidence', evidenceId: sc.cameraEvidenceId, value: true })).toMatchObject({ ok: false, reason: 'evidence_not_revealed' });
    expect(apply(fx, s, confirm)).toMatchObject({ ok: false });
    expect(s.issues[0]!.state).toBe('open');
  });

  it('inv. 6: confirmation is atomic and idempotent; double clicks create one result', () => {
    const once = fullPending();
    const twice = apply(fx, once, confirm);
    expect(twice).toMatchObject({ ok: true, effect: 'unchanged', note: 'already_resolved' });
    expect(twice.session).toBe(once);
    expect(once.decisions).toHaveLength(1);
    expect(once.verifications).toHaveLength(1);
    expect(once.audit.filter((a) => a.type === 'identity_confirmed')).toHaveLength(1);
    expect(once.tasks.filter((t) => t.status === 'completed')).toHaveLength(1);
  });

  it('a duplicate dock-check request returns the existing task without new audit', () => {
    const s1 = run(seed(), advance, request);
    const r = apply(fx, s1, request);
    expect(r).toMatchObject({ ok: true, effect: 'unchanged', note: 'existing_task' });
    expect(r.session.tasks).toHaveLength(1);
    expect(r.session.audit).toHaveLength(s1.audit.length);
  });

  it('cancel/back from verification returns to the unresolved state without mutation', () => {
    const before = run(seed(), advance, request, load, review, ack);
    const after = run(before, { type: 'cancelReview' });
    expect(after.review).toBeNull();
    expect(after.acknowledgedEvidenceIds).toEqual([]); // acknowledgement must be given again
    expect({ ...after, review: null, acknowledgedEvidenceIds: [] }).toEqual({ ...before, review: null, acknowledgedEvidenceIds: [] });
    expect(after.issues[0]!.state).toBe('pending_check');
    expect(apply(fx, after, confirm)).toMatchObject({ ok: false, reason: 'acknowledgement_required' });
  });

  it('inv. 7: a pending check never auto-resolves by selection change or reload', () => {
    const storage = memoryStorage();
    const store = createStore(fx, { backend: 'memory', storage });
    for (const c of [advance, request] as Command[]) store.dispatch(c);
    store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-14' } });
    store.dispatch({ type: 'select', selection: { kind: 'vessel', id: 'V-021' } });
    const reloaded = createStore(fx, { backend: 'memory', storage });
    const s = reloaded.getState().interactive;
    expect(s.issues[0]!.state).toBe('pending_check');
    expect(s.tasks[0]!.status).toBe('pending');
    expect(s.decisions).toEqual([]);
    expect(s.selection).toEqual({ kind: 'vessel', id: 'V-021' });
  });

  it('inv. 8: replay snapshots never contain later evidence, audit or decisions', () => {
    const seen: Record<CheckpointId, DemoSession> = Object.fromEntries(CHECKPOINT_ORDER.map((cp) => [cp, buildSnapshot(fx, cp)])) as Record<CheckpointId, DemoSession>;
    expect(seen.normal.issues).toEqual([]);
    expect(slipPresence(fx, seen.normal, 'B-12').current).toBe('empty');
    expect(seen.uncertain.revealedEvidenceIds).toEqual([]);
    expect(seen.uncertain.tasks).toEqual([]);
    expect(seen.pending_check.revealedEvidenceIds).toEqual([]);
    expect(seen.verification_review.decisions).toEqual([]);
    for (const cp of CHECKPOINT_ORDER) {
      expect(seen[cp].clock).toBe(sc.checkpoints[cp]);
      expect(seen[cp].audit.every((a) => a.eventAt <= sc.checkpoints[cp])).toBe(true);
    }
    // Building the resolved snapshot first does not leak into a later normal snapshot.
    buildSnapshot(fx, 'resolved');
    expect(buildSnapshot(fx, 'normal')).toEqual(seen.normal);
    // Observations after the clock are invisible: at 08:45 the 09:12 observation does not count.
    expect(slipIdentity(fx, seen.normal, 'B-12').state).toBe('none');
  });

  it('inv. 8: viewing replay never mutates the interactive run, and replay is read-only', () => {
    const store = createStore(fx, { backend: 'memory', storage: memoryStorage() });
    store.dispatch(advance);
    const interactive = store.getState().interactive;
    store.viewReplay('resolved');
    expect(store.dispatch(request)).toMatchObject({ ok: false, reason: 'replay_read_only' });
    store.dispatch({ type: 'select', selection: { kind: 'slip', id: 'B-10' } }); // selection is allowed in replay
    store.returnToInteractive();
    expect(store.getState().interactive).toBe(interactive);
  });

  it('“Try this state” starts a fresh isolated branch; “Restart demo” clears it', () => {
    const storage = memoryStorage();
    const store = createStore(fx, { backend: 'memory', storage });
    for (const c of [advance, request, load, review, ack, confirm] as Command[]) store.dispatch(c);
    store.startBranch('uncertain');
    const branch = store.getState().interactive;
    expect(branch.branchId).toBe('branch-1');
    expect(branch.decisions).toEqual([]);
    expect(branch.tasks).toEqual([]);
    expect(branch.revealedEvidenceIds).toEqual([]);
    expect(scenarioStage(fx, branch)).toBe('uncertain');
    store.restart();
    expect(store.getState().interactive).toEqual(seedSession(fx));
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('inv. 9: an offline or stale source does not make a slip empty; last reported presence is kept', () => {
    // C-02 goes offline during the uncertain stage: the 09:18 frame never arrives.
    const s = run(seed(), advance, { type: 'setSourceStatus', sourceId: 'C-02', status: 'offline' }, load);
    const p = slipPresence(fx, s, 'B-12');
    expect(p.current).toBe('unknown');
    expect(p.freshness).toBe('stale');
    expect(p.cameraStatus).toBe('offline');
    expect(p.lastReported).toMatchObject({ presence: 'present', at: sc.checkpoints.uncertain, sourceId: 'C-02' });
    // Dock C, C-01…C-09: camera C-04, the one camera offline since 07:05 in the fixtures.
    const cDock = slipPresence(fx, seed(), 'C-02');
    expect(cDock.current).toBe('unknown');
    expect(cDock.cameraStatus).toBe('offline');
    expect(cDock.lastReported?.presence).toBe('present');
  });

  it('recent staff verification stays valid when the camera is offline', () => {
    // C-02 drops at 09:12, so its 09:18 frame never arrives; at 09:20 the 09:12 frame is stale.
    const s = run(seed(), advance, { type: 'setSourceStatus', sourceId: 'C-02', status: 'offline' }, review, load, ack, confirm);
    const p = slipPresence(fx, s, 'B-12');
    expect(p.basis).toMatchObject({ kind: 'staff', at: sc.checkpoints.verification_review });
    expect(p).toMatchObject({ current: 'present', freshness: 'fresh', basis: { kind: 'staff' }, cameraStatus: 'offline' });
    expect(slipIdentity(fx, s, 'B-12')).toMatchObject({ state: 'confirmed', vesselId: 'V-021' });
  });

  it('“unknown” camera readings (glare) are reported as unknown, not empty', () => {
    const p = slipPresence(fx, seed(), 'D-06');
    expect(p.current).toBe('unknown');
    expect(p.freshness).toBe('fresh');
    expect(p.lastReported?.presence).toBe('present');
  });

  it('inv. 10: nothing in the uncertain session reveals the resolved identity early', () => {
    const s = run(seed(), advance, request);
    expect(JSON.stringify(s)).not.toContain('V-021');
    expect(JSON.stringify(s)).not.toMatch(/Lake Effect/);
    expect(sc.uncertainObservationId).not.toMatch(/B-?12|021|LAKE/i);
  });

  it('selection never changes records; unknown targets are rejected', () => {
    const s = run(seed(), advance);
    const r = apply(fx, s, { type: 'select', selection: { kind: 'slip', id: 'B-12' } });
    expect({ ...r.session, selection: null }).toEqual({ ...s, selection: null });
    expect(apply(fx, s, { type: 'select', selection: { kind: 'slip', id: 'Z-99' } })).toMatchObject({ ok: false, reason: 'unknown_target' });
  });

  it('commands never mutate the session they were given', () => {
    const s = Object.freeze(run(seed(), advance));
    expect(() => run(s, request, load, review, ack, confirm)).not.toThrow();
  });
});

describe('persistence (PRD §8)', () => {
  it('round-trips the interactive branch through storage', () => {
    const storage = memoryStorage();
    const a = createStore(fx, { backend: 'memory', storage });
    for (const c of [advance, request, load] as Command[]) a.dispatch(c);
    const b = createStore(fx, { backend: 'memory', storage });
    expect(b.getState().interactive).toEqual(a.getState().interactive);
    expect(b.getState().storage.notice).toBeNull();
  });

  it('discards corrupt data and starts from the seed with a notice', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const store = createStore(fx, { backend: 'memory', storage });
    expect(store.getState().interactive).toEqual(seedSession(fx));
    expect(store.getState().storage.notice).toBe('corrupt');
  });

  it('discards an incompatible version', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, scenarioVersion: 'old', session: {} }));
    expect(createStore(fx, { backend: 'memory', storage }).getState().storage.notice).toBe('incompatible_version');
  });

  it('discards a session that references records the fixtures do not have', () => {
    const storage = memoryStorage();
    const bad = { ...run(seed(), advance), selection: { kind: 'vessel', id: 'V-999' } };
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, scenarioVersion: sc.scenarioVersion, session: bad }));
    const store = createStore(fx, { backend: 'memory', storage });
    expect(store.getState().storage.notice).toBe('inconsistent');
    expect(store.getState().interactive.issues).toEqual([]);
  });

  it('keeps working in memory when storage throws on write', () => {
    const throwing: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => undefined };
    const store = createStore(fx, { backend: 'local', storage: throwing });
    const r = store.dispatch(advance);
    expect(r.ok).toBe(true);
    expect(store.getState().interactive.issues).toHaveLength(1);
    expect(store.getState().storage.lastSaveError).toMatch(/Quota/);
  });
});
