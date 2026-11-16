import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { apply, type Command } from '../../src/domain/engine.ts';
import { seedSession, type DemoSession } from '../../src/domain/session.ts';
import { activityTrail, dockWalkEvidenceForIssue } from '../../src/domain/selectors.ts';
import { slipReview } from '../../src/features/slip-review/model.ts';

const fx = loadFixtures().bundle;
const run = (s: DemoSession, c: Command) => {
  const r = apply(fx, s, c);
  if (!r.ok) throw new Error(r.reason);
  return r.session;
};

describe('dock-walk trigger (T32)', () => {
  const walk = fx.stagedEvidence.find((e) => e.id === fx.scenario.dockWalkEvidenceId)!;

  it('is a text-only SIM dock-walk entry that names the departure and carries no identity', () => {
    expect(walk).toMatchObject({ kind: 'dock-walk-mark', slipId: 'B-12', sourceId: 'STAFF-CHECK', verifiedVesselId: null, assetId: null, provenance: 'SIM' });
    expect(walk.summary).toBe('Marked Occupied on the morning dock walk; Lake Effect departed 08:10.');
    // The departure it cites is in the movement log at exactly that time.
    expect(fx.movements.find((m) => m.vesselId === 'V-021' && m.kind === 'departure')?.at).toBe('2026-07-15T12:10:00Z');
  });

  it('shows in the review and history only once the issue exists; both sources stay unchanged', () => {
    const s0 = seedSession(fx);
    expect(slipReview(fx, s0, 'B-12')!.dockWalk).toBeNull();
    const s1 = run(s0, { type: 'advanceToUncertain' });
    const m = slipReview(fx, s1, 'B-12')!;
    expect(m.dockWalk).toMatchObject({ at: '09:10', actorLabel: 'Demo dock staff' });
    expect(m.observation).toMatchObject({ at: '09:12', sourceLabel: 'Camera C-02' });
    expect(dockWalkEvidenceForIssue(fx, s1, 'ISS-0001')?.id).toBe(walk.id);
    expect(activityTrail(fx, s1, 'ISS-0001').map((e) => e.label)).toEqual(['Departure logged', 'Dock walk · marked Occupied', 'Camera C-02 · vessel present, identity unverified']);
    // The dock-walk entry never counts as staff identity evidence: confirming is still blocked.
    expect(apply(fx, s1, { type: 'confirmIdentity', issueId: 'ISS-0001' })).toMatchObject({ ok: false, reason: 'evidence_unavailable' });
  });

  it('implies no outbound staff action: no task or message exists until a dock check is requested', () => {
    const s1 = run(seedSession(fx), { type: 'advanceToUncertain' });
    expect(s1.tasks).toEqual([]);
    expect(s1.audit.map((a) => a.type)).toEqual(['issue_opened']);
  });
});
