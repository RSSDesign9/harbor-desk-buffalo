/**
 * Day timeline (TASKS T31, PRD F21): the time scrubber's model.
 *
 * The scrubber is guided replay made continuous. Guided replay shows the scripted day at three checkpoints; the
 * scrubber shows the same scripted day at ANY minute from 06:00 to 22:00. Both are read-only views rebuilt from
 * the seed (src/domain/replay.ts): they never read from or write to the interactive run, and “Try this state”
 * is still the only way to turn a moment into a run of your own.
 *
 * A snapshot at time t is the full canonical run projected back to t: every appended record dated after t is
 * dropped and every state is the state it had at t (an issue opened at 09:12 is absent at 09:11, a dock check
 * requested at 09:13 is not pending at 09:12, …). Nothing later than t can be shown (PRD §7 inv. 8). At the
 * checkpoints the projection equals the replay snapshot exactly (tests/unit/timeline.test.ts).
 */
import { buildSnapshot, CHECKPOINT_ORDER } from './replay.ts';
import type { DemoSession, Selection } from './session.ts';
import type { CheckpointId, FixtureBundle, IsoTime } from './types.ts';
import { toMs } from './time.ts';

/** Scrubber range: 06:00–22:00 on the scenario day (July: EDT, UTC−4). */
export function dayBounds(fx: FixtureBundle): { from: IsoTime; to: IsoTime } {
  const at = (h: number) => new Date(Date.parse(`${fx.scenario.date}T00:00:00Z`) + (h + 4) * 3_600_000).toISOString().replace('.000Z', 'Z');
  return { from: at(6), to: at(22) };
}

export const MINUTE_MS = 60_000;
export const toIso = (ms: number): IsoTime => new Date(ms).toISOString().replace('.000Z', 'Z');

/** The latest checkpoint at or before t (the scripted stage in force), or null before the first one. */
export function checkpointAt(fx: FixtureBundle, t: IsoTime): CheckpointId | null {
  let found: CheckpointId | null = null;
  for (const cp of CHECKPOINT_ORDER) if (toMs(fx.scenario.checkpoints[cp]) <= toMs(t)) found = cp;
  return found;
}

let fullRun: { fx: FixtureBundle; run: DemoSession } | null = null;
const canonicalDay = (fx: FixtureBundle) => {
  if (fullRun?.fx !== fx) fullRun = { fx, run: buildSnapshot(fx, 'resolved', 'timeline') };
  return fullRun.run;
};

/** Project a session back to time t: only records dated at or before t, each in the state it had at t. */
export function projectSession(fx: FixtureBundle, full: DemoSession, t: IsoTime): DemoSession {
  const at = toMs(t);
  const by = (x: IsoTime | null | undefined) => x !== null && x !== undefined && toMs(x) <= at;
  const decisions = full.decisions.filter((d) => by(d.decidedAt));
  // A session verification is created by its identity decision (dated by the staff photo, which is earlier).
  const verIds = new Set(decisions.map((d) => d.verificationId));
  const tasks = full.tasks
    .filter((k) => by(k.requestedAt))
    .map((k) => (by(k.completedAt) ? k : { ...k, status: 'pending' as const, completedAt: null, verificationId: null }));
  const issues = full.issues
    .filter((i) => by(i.createdAt))
    .map((i) => {
      if (by(i.resolvedAt)) return i;
      const pending = tasks.some((k) => k.issueId === i.id);
      return { ...i, state: pending ? ('pending_check' as const) : ('open' as const), resolvedAt: null };
    });
  const revealedEvidenceIds = full.revealedEvidenceIds.filter((id) => by(fx.stagedEvidence.find((e) => e.id === id)?.capturedAt));
  const resolved = issues.some((i) => i.state === 'resolved');
  const open = issues.find((i) => i.state !== 'resolved');
  return {
    ...full,
    clock: t,
    issues,
    tasks,
    verifications: full.verifications.filter((v) => verIds.has(v.id)),
    decisions,
    audit: full.audit.filter((a) => by(a.eventAt)),
    sourceEvents: full.sourceEvents.filter((e) => by(e.at)),
    revealedEvidenceIds,
    // The scripted reviewer acknowledges the staff evidence as they resolve, and reviews it from when it arrives.
    acknowledgedEvidenceIds: resolved ? full.acknowledgedEvidenceIds : [],
    review: open && revealedEvidenceIds.length > 0 ? { issueId: open.id } : null,
    assignments: [],
  };
}

/** The scripted day at t, read-only. Exactly the guided-replay snapshot at a checkpoint. */
export function timelineSnapshot(fx: FixtureBundle, t: IsoTime, selection: Selection): DemoSession {
  const cp = CHECKPOINT_ORDER.find((c) => fx.scenario.checkpoints[c] === t);
  const base = cp ? buildSnapshot(fx, cp, `timeline:${t}`) : { ...projectSession(fx, canonicalDay(fx), t), branchId: `timeline:${t}` };
  return { ...base, selection };
}
