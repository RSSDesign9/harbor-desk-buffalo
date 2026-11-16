import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { buildSnapshot, CHECKPOINT_ORDER } from '../../src/domain/replay.ts';
import { seedSession, type DemoSession } from '../../src/domain/session.ts';
import { arrivalsBoard, latestSweepTick, operatorSummary, scenarioStage, slipPresence, unsoldNights, mapSlipStatus } from '../../src/domain/selectors.ts';
import { checkpointAt, dayBounds, projectSession, timelineSnapshot, toIso } from '../../src/domain/timeline.ts';
import { toMs } from '../../src/domain/time.ts';

const fx = loadFixtures().bundle;
const full = buildSnapshot(fx, 'resolved', 'timeline');
const { from, to } = dayBounds(fx);
const minutes = (a: string, b: string) => (toMs(b) - toMs(a)) / 60_000;
const every = (stepMin: number) => Array.from({ length: Math.floor(minutes(from, to) / stepMin) + 1 }, (_, i) => toIso(toMs(from) + i * stepMin * 60_000));
const sel = { kind: 'slip' as const, id: 'B-12' };

/** Every time a session record carries. */
function stamps(s: DemoSession): string[] {
  return [
    ...s.issues.flatMap((i) => [i.createdAt, i.resolvedAt]),
    ...s.tasks.flatMap((k) => [k.requestedAt, k.completedAt]),
    ...s.decisions.map((d) => d.decidedAt),
    ...s.audit.map((a) => a.eventAt),
    ...s.sourceEvents.map((e) => e.at),
    ...s.revealedEvidenceIds.map((id) => fx.stagedEvidence.find((e) => e.id === id)!.capturedAt),
  ].filter((x): x is string => typeof x === 'string');
}

describe('day timeline (T31, PRD F21)', () => {
  it('spans 06:00–22:00 EDT on 15 July', () => {
    expect(from).toBe('2026-07-15T10:00:00Z');
    expect(to).toBe('2026-07-16T02:00:00Z');
  });

  it('equals the guided-replay snapshot at every checkpoint (projection and replay agree)', () => {
    for (const cp of CHECKPOINT_ORDER) {
      const t = fx.scenario.checkpoints[cp];
      const projected = projectSession(fx, full, t);
      const replay = buildSnapshot(fx, cp, 'timeline');
      expect({ ...projected, selection: null, branchId: '' }, cp).toEqual({ ...replay, selection: null, branchId: '' });
      expect(timelineSnapshot(fx, t, sel).selection).toEqual(sel);
    }
  });

  it('never shows anything later than its time, scrubbing forward or backward', () => {
    const times = every(5);
    for (const t of [...times, ...times.slice().reverse()]) {
      const s = timelineSnapshot(fx, t, sel);
      expect(s.clock).toBe(t);
      for (const x of stamps(s)) expect(toMs(x), `${x} at ${t}`).toBeLessThanOrEqual(toMs(t));
      // KPIs and the board are read at the same time.
      expect(operatorSummary(fx, s).arrivedSoFar).toBe(arrivalsBoard(fx, s).filter((r) => r.kind === 'check-in' && r.status === 'arrived').length);
      for (const r of arrivalsBoard(fx, s)) if (r.status === 'arrived') expect(toMs(r.at!)).toBeLessThanOrEqual(toMs(t));
    }
  });

  it('lines the B-12 stages up with 08:45 / 09:12 / 09:13 / 09:18 / 09:20', () => {
    const at = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number) as [number, number];
      return toIso(toMs(from) + ((h - 6) * 60 + m) * 60_000);
    };
    const stage = (hhmm: string) => scenarioStage(fx, timelineSnapshot(fx, at(hhmm), sel));
    expect([stage('07:00'), stage('08:45'), stage('09:11'), stage('09:12'), stage('09:13'), stage('09:17'), stage('09:18'), stage('09:19'), stage('09:20'), stage('15:00')]).toEqual([
      'normal', 'normal', 'normal', 'uncertain', 'pending_check', 'pending_check', 'verification_review', 'verification_review', 'resolved', 'resolved',
    ]);
    expect(checkpointAt(fx, at('07:00'))).toBeNull();
    expect(checkpointAt(fx, at('09:19'))).toBe('verification_review');
    // B-12 on the map follows the same story: away until the hull is seen, then review, then occupied.
    expect(mapSlipStatus(fx, timelineSnapshot(fx, at('08:30'), sel), 'B-12')).toBe('away');
    expect(mapSlipStatus(fx, timelineSnapshot(fx, at('09:15'), sel), 'B-12')).toBe('review');
    expect(mapSlipStatus(fx, timelineSnapshot(fx, at('12:00'), sel), 'B-12')).toBe('occupied');
  });

  it('the scrubber never touches the interactive run', () => {
    const run = seedSession(fx);
    const before = JSON.stringify(run);
    for (const t of every(30)) timelineSnapshot(fx, t, run.selection);
    expect(JSON.stringify(run)).toBe(before);
  });
});

describe('camera sweeps (T31)', () => {
  it('keep online cameras current outside the scripted morning, and leave the scenario checkpoints untouched', () => {
    const at = (iso: string) => ({ ...seedSession(fx), clock: iso });
    // At every scripted checkpoint a real frame is newer than the last sweep tick, so no slip rests on a sweep.
    for (const cp of CHECKPOINT_ORDER) {
      const tick = latestSweepTick(fx, fx.scenario.checkpoints[cp]);
      expect(tick === null || tick < toMs(fx.scenario.checkpoints.normal) || tick < toMs(fx.scenario.checkpoints[cp]) - 9 * 60_000, cp).toBe(true);
      const s = buildSnapshot(fx, cp, 'x');
      for (const sl of fx.slips) expect(slipPresence(fx, s, sl.id).basis?.refId.startsWith('SWEEP') ?? false, `${cp} ${sl.id}`).toBe(false);
    }
    // Mid-afternoon: every slip under an online camera with a known state reads fresh; C-04's dock stays unknown.
    const s = at('2026-07-15T18:02:00Z');
    let fresh = 0;
    for (const sl of fx.slips) {
      const p = slipPresence(fx, s, sl.id);
      if (p.cameraId === 'C-04') expect(p.current, sl.id).toBe('unknown');
      else if (p.current !== 'unknown') fresh += 1;
    }
    expect(fresh).toBeGreaterThan(100);
    // A sweep repeats the latest report: a boat logged out at 14:00 reads empty at 14:05, never present.
    const dep = fx.movements.find((m) => m.kind === 'departure' && toMs(m.at) > toMs('2026-07-15T14:00:00Z'))!;
    const after = slipPresence(fx, at(toIso(toMs(dep.at) + 6 * 60_000)), dep.slipId);
    if (after.cameraStatus === 'online') expect(after.current).toBe('empty');
  });

  it('vacant slips show unsold nights over the week', () => {
    const s = seedSession(fx);
    for (const sl of fx.slips.filter((x) => mapSlipStatus(fx, s, x.id) === 'vacant')) expect(unsoldNights(fx, s, sl.id)).toBeGreaterThanOrEqual(1);
    expect(unsoldNights(fx, s, 'B-12')).toBe(0);
  });
});
