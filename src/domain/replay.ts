/**
 * Guided replay (PRD F10, inv. 8). A snapshot is rebuilt from the seed by applying only the canonical
 * commands up to its checkpoint, so later evidence or audit cannot exist in it. Snapshots are read-only
 * and are never derived from, or written into, the interactive run.
 */
import { apply, type Command } from './engine.ts';
import { seedSession, seqId, type DemoSession } from './session.ts';
import type { CheckpointId, FixtureBundle } from './types.ts';

export const CHECKPOINT_ORDER: readonly CheckpointId[] = ['normal', 'uncertain', 'pending_check', 'verification_review', 'resolved'];
/** The three guided frames shown in the replay control (all five remain buildable). */
export const GUIDED_CHECKPOINTS: readonly CheckpointId[] = ['normal', 'uncertain', 'resolved'];

export function canonicalScript(fx: FixtureBundle, upTo: CheckpointId): Command[] {
  const issueId = seqId('ISS', 1);
  const steps: Record<CheckpointId, Command[]> = {
    normal: [],
    uncertain: [{ type: 'advanceToUncertain' }],
    pending_check: [{ type: 'requestDockCheck', issueId }],
    verification_review: [{ type: 'loadDockCheckResult', issueId }, { type: 'openReview', issueId }],
    resolved: [{ type: 'acknowledgeEvidence', evidenceId: fx.scenario.staffEvidenceId, value: true }, { type: 'confirmIdentity', issueId }],
  };
  const out: Command[] = [];
  for (const cp of CHECKPOINT_ORDER) {
    out.push(...steps[cp]);
    if (cp === upTo) break;
  }
  return out;
}

export function buildSnapshot(fx: FixtureBundle, checkpoint: CheckpointId, branchId = `replay:${checkpoint}`): DemoSession {
  let s: DemoSession = { ...seedSession(fx, branchId), selection: { kind: 'slip', id: fx.scenario.slipId } };
  for (const cmd of canonicalScript(fx, checkpoint)) {
    const r = apply(fx, s, cmd);
    if (!r.ok) throw new Error(`Canonical script failed at ${cmd.type}: ${r.reason}`);
    s = r.session;
  }
  if (s.clock !== fx.scenario.checkpoints[checkpoint]) throw new Error(`Snapshot ${checkpoint} landed at ${s.clock}`);
  return s;
}
