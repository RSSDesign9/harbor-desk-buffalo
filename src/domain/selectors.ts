/**
 * Pure selectors (TASKS T06). The 3D view, DOM panels, filters, counters and audit all read these;
 * nothing keeps a competing copy of vessel state (PRD §8).
 *
 * Rules encoded here:
 * - Presence, identity, agreement, issue and document review are derived separately (inv. 1).
 * - Empty + assigned is never “available”; v1 assesses no bookings (inv. 2).
 * - A possible match is never an identity or a location (inv. 3, 4).
 * - Effective identity comes from appended decisions/verifications; observations are untouched (inv. 5).
 * - Stale/offline never means empty; the last reported presence is kept separately (inv. 9).
 * - Nothing after the session clock is visible (inv. 8).
 */
import type { DemoSession } from './session.ts';
import type {
  Agreement,
  CheckpointId,
  DockCheckTask,
  FixtureBundle,
  IsoTime,
  Movement,
  Observation,
  Presence,
  ReviewIssue,
  StagedEvidence,
  Verification,
} from './types.ts';
import { localDate, minutesBetween, toMs } from './time.ts';

type Fx = FixtureBundle;
type S = DemoSession;

const atOrBefore = (t: IsoTime, clock: IsoTime) => toMs(t) <= toMs(clock);

// ---------- sources ----------
/**
 * Status of a source at time t. With `strictlyBefore`, an event at exactly t is not yet in force: an outage
 * recorded at 09:12 does not retract the 09:12 frame that had already been delivered.
 */
export function sourceStatusAt(fx: Fx, s: S, sourceId: string, t: IsoTime, strictlyBefore = false): 'online' | 'offline' {
  const events = [...fx.sourceStatus, ...s.sourceEvents].filter((e) => e.sourceId === sourceId && (strictlyBefore ? toMs(e.at) < toMs(t) : atOrBefore(e.at, t)));
  events.sort((a, b) => toMs(a.at) - toMs(b.at));
  return events[events.length - 1]?.status ?? 'online';
}

/** Observations a source actually delivered up to the clock (an offline source delivers nothing). */
export function deliveredObservations(fx: Fx, s: S, slipId: string): Observation[] {
  return fx.observations
    .filter((o) => o.slipId === slipId && atOrBefore(o.observedAt, s.clock) && sourceStatusAt(fx, s, o.sourceId, o.observedAt, true) === 'online')
    .sort((a, b) => toMs(a.observedAt) - toMs(b.observedAt));
}

export function allVerifications(fx: Fx, s: S): Verification[] {
  return [...fx.verifications, ...s.verifications].filter((v) => atOrBefore(v.checkedAt, s.clock));
}

// ---------- presence ----------
type ReportKind = 'camera' | 'staff' | 'movement';
interface Report {
  kind: ReportKind;
  at: IsoTime;
  presence: Presence;
  sourceId: string;
  refId: string;
}

/**
 * Per-session memo (T31: the scrubber re-reads the whole marina every minute). Sessions are immutable values and
 * fixtures are frozen, so (fixtures, session, key) always gives the same answer; entries die with the session.
 */
const memo = new WeakMap<Fx, WeakMap<S, Map<string, unknown>>>();
function cached<T>(fx: Fx, s: S, key: string, compute: () => T): T {
  let bySession = memo.get(fx);
  if (!bySession) memo.set(fx, (bySession = new WeakMap()));
  let m = bySession.get(s);
  if (!m) bySession.set(s, (m = new Map()));
  if (m.has(key)) return m.get(key) as T;
  const v = compute();
  m.set(key, v);
  return v;
}

function reportsForSlip(fx: Fx, s: S, slipId: string): Report[] {
  return cached(fx, s, `reports:${slipId}`, () => computeReports(fx, s, slipId));
}
function computeReports(fx: Fx, s: S, slipId: string): Report[] {
  const reports: Report[] = [
    ...deliveredObservations(fx, s, slipId).map((o) => ({ kind: 'camera' as const, at: o.observedAt, presence: o.presence, sourceId: o.sourceId, refId: o.id })),
    ...allVerifications(fx, s)
      .filter((v) => v.slipId === slipId)
      .map((v) => ({ kind: 'staff' as const, at: v.checkedAt, presence: 'present' as const, sourceId: v.sourceId, refId: v.id })),
    ...fx.movements
      .filter((m) => m.slipId === slipId && atOrBefore(m.at, s.clock))
      .map((m) => ({ kind: 'movement' as const, at: m.at, presence: (m.kind === 'departure' ? 'empty' : 'present') as Presence, sourceId: m.sourceId, refId: m.id })),
  ];
  reports.sort((a, b) => toMs(a.at) - toMs(b.at));
  const sweep = sweepReport(fx, s, slipId, reports);
  if (sweep) reports.push(sweep);
  return reports;
}

/** Latest camera sweep tick at or before the clock (T31), or null outside every sweep window. */
export function latestSweepTick(fx: Fx, clock: IsoTime): number | null {
  const sw = fx.scenario.cameraSweep;
  if (!sw) return null;
  const now = toMs(clock);
  const step = sw.everyMinutes * 60_000;
  let tick: number | null = null;
  for (const [from, to] of sw.windows) {
    const f = toMs(from);
    if (now < f) continue;
    const last = Math.min(now, toMs(to) - 1);
    const t = f + Math.floor((last - f) / step) * step;
    if (tick === null || t > tick) tick = t;
  }
  return tick;
}

/**
 * Camera sweep (T31): inside the sweep windows an ONLINE camera re-reads its slips every few minutes, and a
 * re-read reports the slip's latest known state (the last real report, which the staff movement log keeps up
 * to date). It refreshes freshness; it never invents a new presence, never names a vessel, and an offline
 * camera delivers no sweep. The windows exclude the scripted B-12 morning, so the scenario is untouched.
 */
function sweepReport(fx: Fx, s: S, slipId: string, real: readonly Report[]): Report | null {
  const tick = latestSweepTick(fx, s.clock);
  if (tick === null) return null;
  const latest = real[real.length - 1];
  if (!latest || latest.presence === 'unknown' || toMs(latest.at) >= tick) return null;
  const cameraId = fx.observations.find((o) => o.slipId === slipId)?.sourceId;
  if (!cameraId) return null;
  const at = new Date(tick).toISOString().replace('.000Z', 'Z');
  if (sourceStatusAt(fx, s, cameraId, at) !== 'online') return null;
  return { kind: 'camera', at, presence: latest.presence, sourceId: cameraId, refId: `SWEEP-${cameraId}-${at}` };
}

export interface SlipPresence {
  /** What the demo can currently say. `unknown` whenever the latest report is stale or unreadable. */
  current: Presence;
  freshness: 'fresh' | 'stale' | 'none';
  /** The report the current state rests on (may be stale). */
  basis: { kind: ReportKind; at: IsoTime; sourceId: string; refId: string } | null;
  /** Last report that actually said present or empty, kept separately from current confidence. */
  lastReported: { presence: 'present' | 'empty'; at: IsoTime; kind: ReportKind; sourceId: string } | null;
  /** Status of the camera covering this slip, at the clock. */
  cameraStatus: 'online' | 'offline' | null;
  cameraId: string | null;
}

export function slipPresence(fx: Fx, s: S, slipId: string): SlipPresence {
  return cached(fx, s, `presence:${slipId}`, () => computePresence(fx, s, slipId));
}
function computePresence(fx: Fx, s: S, slipId: string): SlipPresence {
  const reports = reportsForSlip(fx, s, slipId);
  const cameraId = fx.observations.find((o) => o.slipId === slipId)?.sourceId ?? null;
  const cameraStatus = cameraId ? sourceStatusAt(fx, s, cameraId, s.clock) : null;
  const latest = reports[reports.length - 1] ?? null;
  const known = [...reports].reverse().find((r) => r.presence !== 'unknown') ?? null;
  const lastReported = known ? { presence: known.presence as 'present' | 'empty', at: known.at, kind: known.kind, sourceId: known.sourceId } : null;
  if (!latest) return { current: 'unknown', freshness: 'none', basis: null, lastReported, cameraStatus, cameraId };
  const limit = latest.kind === 'camera' ? fx.scenario.cameraFreshMinutes : fx.scenario.staffFreshMinutes;
  const fresh = minutesBetween(latest.at, s.clock) <= limit;
  return {
    current: fresh ? latest.presence : 'unknown',
    freshness: fresh ? 'fresh' : 'stale',
    basis: { kind: latest.kind, at: latest.at, sourceId: latest.sourceId, refId: latest.refId },
    lastReported,
    cameraStatus,
    cameraId,
  };
}

// ---------- identity ----------
export type SlipIdentity =
  | { state: 'none' }
  | { state: 'confirmed'; vesselId: string; at: IsoTime; basis: 'staff-verification' | 'identity-decision' | 'arrival-log'; refId: string }
  | { state: 'unverified'; candidateVesselIds: string[]; observationId: string | null };

/**
 * Identity of whatever is (or was last reported) present, derived from the current presence run:
 * consecutive reports back to the most recent “empty”. Candidates never become identity.
 */
export function slipIdentity(fx: Fx, s: S, slipId: string): SlipIdentity {
  const reports = reportsForSlip(fx, s, slipId);
  const run: Report[] = [];
  for (let i = reports.length - 1; i >= 0; i--) {
    const r = reports[i]!;
    if (r.presence === 'empty') break;
    run.push(r);
  }
  if (!run.some((r) => r.presence === 'present')) return { state: 'none' };
  const runObsIds = new Set(run.filter((r) => r.kind === 'camera').map((r) => r.refId));
  const confirmations: Extract<SlipIdentity, { state: 'confirmed' }>[] = [];
  const vers = new Map(allVerifications(fx, s).map((v) => [v.id, v]));
  for (const r of run) {
    if (r.kind === 'staff') {
      const v = vers.get(r.refId)!;
      confirmations.push({ state: 'confirmed', vesselId: v.verifiedVesselId, at: v.checkedAt, basis: 'staff-verification', refId: v.id });
    }
    if (r.kind === 'movement') {
      const m = fx.movements.find((x) => x.id === r.refId)!;
      confirmations.push({ state: 'confirmed', vesselId: m.vesselId, at: m.at, basis: 'arrival-log', refId: m.id });
    }
  }
  for (const d of s.decisions) {
    if (runObsIds.has(d.observationId) && atOrBefore(d.decidedAt, s.clock)) confirmations.push({ state: 'confirmed', vesselId: d.confirmedVesselId, at: d.decidedAt, basis: 'identity-decision', refId: d.id });
  }
  confirmations.sort((a, b) => toMs(a.at) - toMs(b.at));
  const confirmed = confirmations[confirmations.length - 1];
  if (confirmed) return confirmed;
  const obsInRun = fx.observations.filter((o) => runObsIds.has(o.id));
  const candidates = [...new Set(obsInRun.flatMap((o) => o.candidateVesselIds))];
  const withCandidates = obsInRun.filter((o) => o.candidateVesselIds.length > 0).sort((a, b) => toMs(b.observedAt) - toMs(a.observedAt))[0];
  return { state: 'unverified', candidateVesselIds: candidates, observationId: withCandidates?.id ?? obsInRun[obsInRun.length - 1]?.id ?? null };
}

// ---------- vessel location (never from candidates) ----------
export type VesselLocation =
  | { kind: 'none' }
  | { kind: 'confirmed-present'; slipId: string; at: IsoTime; basis: 'staff-verification' | 'identity-decision' | 'arrival-log'; refId: string }
  | { kind: 'departed'; slipId: string; at: IsoTime; refId: string };

export function vesselLocation(fx: Fx, s: S, vesselId: string): VesselLocation {
  return cached(fx, s, `location:${vesselId}`, () => computeLocation(fx, s, vesselId));
}
function computeLocation(fx: Fx, s: S, vesselId: string): VesselLocation {
  const events: VesselLocation[] = [];
  for (const v of allVerifications(fx, s)) if (v.verifiedVesselId === vesselId) events.push({ kind: 'confirmed-present', slipId: v.slipId, at: v.checkedAt, basis: 'staff-verification', refId: v.id });
  for (const m of fx.movements) {
    if (m.vesselId !== vesselId || !atOrBefore(m.at, s.clock)) continue;
    events.push(m.kind === 'departure' ? { kind: 'departed', slipId: m.slipId, at: m.at, refId: m.id } : { kind: 'confirmed-present', slipId: m.slipId, at: m.at, basis: 'arrival-log', refId: m.id });
  }
  for (const d of s.decisions) {
    if (d.confirmedVesselId !== vesselId || !atOrBefore(d.decidedAt, s.clock)) continue;
    const obs = fx.observations.find((o) => o.id === d.observationId);
    if (obs) events.push({ kind: 'confirmed-present', slipId: obs.slipId, at: d.decidedAt, basis: 'identity-decision', refId: d.id });
  }
  events.sort((a, b) => toMs((a as { at: IsoTime }).at) - toMs((b as { at: IsoTime }).at));
  return events[events.length - 1] ?? { kind: 'none' };
}

// ---------- agreements, bookability, documents ----------
export const activeAgreementForSlip = (fx: Fx, slipId: string): Agreement | null => fx.agreements.find((a) => a.slipId === slipId && a.status === 'active') ?? null;
export const activeAgreementForVessel = (fx: Fx, vesselId: string): Agreement | null => fx.agreements.find((a) => a.vesselId === vesselId && a.status === 'active') ?? null;

export type Bookability = { bookable: false; reason: 'assigned'; agreementId: string } | { bookable: null; reason: 'not-assessed' };

/** Never derives availability from presence. Unassigned slips are “not assessed”, not “available”. */
export function bookability(fx: Fx, slipId: string): Bookability {
  const a = activeAgreementForSlip(fx, slipId);
  return a ? { bookable: false, reason: 'assigned', agreementId: a.id } : { bookable: null, reason: 'not-assessed' };
}

export const documentsForVessel = (fx: Fx, vesselId: string) => fx.documents.filter((d) => d.vesselId === vesselId);

// ---------- issues, tasks, evidence ----------
export const issueById = (s: S, id: string): ReviewIssue | null => s.issues.find((i) => i.id === id) ?? null;
export const latestIssueForSlip = (s: S, slipId: string): ReviewIssue | null => [...s.issues].reverse().find((i) => i.slipId === slipId) ?? null;
export const taskForIssue = (s: S, issueId: string): DockCheckTask | null => s.tasks.find((t) => t.issueId === issueId) ?? null;
export const openIssues = (s: S) => s.issues.filter((i) => i.state !== 'resolved');
export const needsReviewCount = (s: S) => openIssues(s).length;

/** Staff evidence for an issue that the scenario has revealed and whose time has come. */
export function revealedStaffEvidence(fx: Fx, s: S, issueId: string): StagedEvidence | null {
  const issue = issueById(s, issueId);
  if (!issue) return null;
  return (
    fx.stagedEvidence.find(
      (e) => e.kind === 'staff-dock-check' && e.slipId === issue.slipId && s.revealedEvidenceIds.includes(e.id) && atOrBefore(e.capturedAt, s.clock),
    ) ?? null
  );
}

/** T32: the dock-walk entry that opened the issue, once its time has come (a text-only record; never an identity). */
export function dockWalkEvidenceForIssue(fx: Fx, s: S, issueId: string): StagedEvidence | null {
  const issue = issueById(s, issueId);
  if (!issue) return null;
  return fx.stagedEvidence.find((e) => e.kind === 'dock-walk-mark' && e.slipId === issue.slipId && atOrBefore(e.capturedAt, s.clock)) ?? null;
}

export function cameraEvidenceForObservation(fx: Fx, s: S, observationId: string): StagedEvidence | null {
  const obs = fx.observations.find((o) => o.id === observationId);
  if (!obs || !atOrBefore(obs.observedAt, s.clock) || !obs.evidenceAssetId) return null;
  return fx.stagedEvidence.find((e) => e.kind === 'camera-frame' && e.assetId === obs.evidenceAssetId) ?? null;
}

export type ConfirmBlocker = 'unknown_issue' | 'already_resolved' | 'evidence_unavailable' | 'acknowledgement_required';

/** Single guard used by the engine and by the UI’s disabled state. */
export function confirmBlocker(fx: Fx, s: S, issueId: string): ConfirmBlocker | null {
  const issue = issueById(s, issueId);
  if (!issue) return 'unknown_issue';
  if (issue.state === 'resolved') return 'already_resolved';
  const ev = revealedStaffEvidence(fx, s, issueId);
  if (!ev || !ev.verifiedVesselId) return 'evidence_unavailable';
  if (!s.acknowledgedEvidenceIds.includes(ev.id)) return 'acknowledgement_required';
  return null;
}

// ---------- scenario stage and summaries ----------
export function scenarioStage(fx: Fx, s: S): CheckpointId {
  const issue = latestIssueForSlip(s, fx.scenario.slipId);
  if (!issue) return 'normal';
  if (issue.state === 'resolved') return 'resolved';
  if (revealedStaffEvidence(fx, s, issue.id)) return 'verification_review';
  if (issue.state === 'pending_check') return 'pending_check';
  return 'uncertain';
}

export function datasetSummary(fx: Fx, s: S) {
  return { slips: fx.slips.length, vessels: fx.vessels.length, needsReview: needsReviewCount(s) };
}

const DAY_MS = 86_400_000;
const nightsBetween = (start: string, end: string) => Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS));

/** What an agreement is worth over its whole term: the season fee, or the nightly rate × nights booked. */
export const agreementValueUsd = (a: Agreement): number => (a.rateBasis === 'season' ? a.rateUsd : a.rateUsd * nightsBetween(a.start, a.end));
/** What it earns per night: the nightly rate, or the season fee spread over the season. */
export const agreementNightlyUsd = (a: Agreement): number => (a.rateBasis === 'night' ? a.rateUsd : a.rateUsd / nightsBetween(a.start, a.end));

export interface AwayBoat {
  vesselId: string;
  slipId: string;
  /** When it left, per the staff log. */
  since: IsoTime;
  /** The plan, if one was logged. `null` = no return expected today. */
  expectedReturnAt: IsoTime | null;
}

/** Boats whose latest logged movement (at the clock) is a departure. Away is a flag derived from the log, not a stored state. */
export function awayBoats(fx: Fx, s: S): AwayBoat[] {
  const latest = new Map<string, Movement>();
  for (const m of fx.movements) {
    if (!atOrBefore(m.at, s.clock)) continue;
    const prev = latest.get(m.vesselId);
    if (!prev || toMs(m.at) >= toMs(prev.at)) latest.set(m.vesselId, m);
  }
  return [...latest.values()]
    .filter((m) => m.kind === 'departure')
    .map((m) => ({ vesselId: m.vesselId, slipId: m.slipId, since: m.at, expectedReturnAt: m.expectedReturnAt }))
    .sort((a, b) => toMs(a.since) - toMs(b.since));
}

/** Cameras that are offline at the clock. */
export const offlineCameras = (fx: Fx, s: S): string[] =>
  fx.sources.filter((x) => x.kind === 'sim-camera' && sourceStatusAt(fx, s, x.id, s.clock) === 'offline').map((x) => x.id);

/**
 * Operator KPIs for the summary tiles (TASKS T25/T28, PRD F18), all derived from the fixtures and the session.
 * - occupancy: slips with an active agreement covering the scenario night, out of all (assumed) slips.
 * - arrivals: transient check-ins logged for the scenario day, whatever the clock (a day plan, not a live feed).
 *   A seasonal boat coming back from an outing is not an arrival.
 * - needsAttention: open review issues.
 * - revenueAtRiskUsd: the term value of the agreements on slips with an open review issue: money tied to a
 *   berth nobody has confirmed yet (SIM, on ASSUME rates).
 * - nightlyRevenueUsd: what tonight's agreements earn per night (SIM, on ASSUME rates).
 */
export function operatorSummary(fx: Fx, s: S) {
  const night = fx.scenario.date;
  const held = fx.agreements.filter((a) => a.status === 'active' && a.start <= night && a.end > night);
  const heldIds = new Set(held.map((a) => a.slipId));
  const occupied = fx.slips.filter((x) => heldIds.has(x.id)).length;
  const atRisk = openIssues(s).flatMap((i) => held.filter((a) => a.slipId === i.slipId));
  const checkIns = fx.movements.filter((m) => m.kind === 'arrival' && m.trip === 'stay' && localDate(m.at) === night);
  const local = activeAssignments(s).filter((a) => !heldIds.has(a.slipId)).length;
  return {
    occupied: occupied + local,
    /** Demo assignments (T30) included in `occupied`. */
    localAssignments: local,
    /** Check-ins logged so far at the clock (T31: the tile follows the time scrubber). */
    arrivedSoFar: checkIns.filter((m) => atOrBefore(m.at, s.clock)).length,
    slips: fx.slips.length,
    occupancyPct: fx.slips.length ? Math.round(((occupied + local) / fx.slips.length) * 100) : 0,
    arrivals: checkIns.length,
    needsAttention: needsReviewCount(s),
    away: awayBoats(fx, s).length,
    offlineCameras: offlineCameras(fx, s).length,
    nightlyRevenueUsd: Math.round(held.reduce((sum, a) => sum + agreementNightlyUsd(a), 0)),
    revenueAtRiskUsd: atRisk.reduce((sum, a) => sum + agreementValueUsd(a), 0),
  };
}

// ---------- local assignments (T30) ----------
export const activeAssignments = (s: S) => (s.assignments ?? []).filter((a) => a.undoneAt === null && atOrBefore(a.assignedAt, s.clock));
export const activeAssignmentForSlip = (s: S, slipId: string) => activeAssignments(s).find((a) => a.slipId === slipId) ?? null;
export const activeAssignmentForRequest = (s: S, requestId: string) => activeAssignments(s).find((a) => a.requestId === requestId) ?? null;

/** Requests the marina has received by the clock (a request is never visible before it arrived). */
export const visibleRequests = (fx: Fx, s: S) => fx.transientRequests.filter((r) => atOrBefore(r.receivedAt, s.clock));

/**
 * Nights a slip is unsold over the week from the scenario night (T31: “vacant slips show unsold nights”):
 * nights no agreement or demo assignment covers. Agreements are the berth plan, known in advance.
 */
export const UNSOLD_HORIZON_NIGHTS = 7;
export function unsoldNights(fx: Fx, s: S, slipId: string): number {
  const start = Date.parse(`${fx.scenario.date}T00:00:00Z`);
  const local = activeAssignmentForSlip(s, slipId);
  const req = local ? fx.transientRequests.find((r) => r.id === local.requestId) : undefined;
  let n = 0;
  for (let i = 0; i < UNSOLD_HORIZON_NIGHTS; i++) {
    const night = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const held = fx.agreements.some((a) => a.slipId === slipId && a.status === 'active' && a.start <= night && a.end > night);
    const assigned = req !== undefined && i < req.nights;
    if (!held && !assigned) n += 1;
  }
  return n;
}

// ---------- arrivals board (T31) ----------
export interface BoardRow {
  key: string;
  kind: 'check-in' | 'return' | 'request';
  vesselName: string;
  slipId: string | null;
  status: 'arrived' | 'due';
  /** Logged arrival time, or the expected return / requested window start; null when the time is not known yet. */
  at: IsoTime | null;
}

/**
 * Today's arrivals at the clock. Nothing later than the clock leaks: a check-in shows its time only once it is
 * logged (before that the booking says only “due today”), and a return shows only after the departure that
 * carried its expected time was logged. Demo assignments of incoming requests appear as due at their window.
 */
export function arrivalsBoard(fx: Fx, s: S): BoardRow[] {
  const night = fx.scenario.date;
  const name = (id: string) => fx.vessels.find((v) => v.id === id)?.name ?? id;
  const rows: BoardRow[] = [];
  for (const a of fx.agreements.filter((x) => x.type === 'transient' && x.status === 'active' && x.start === night)) {
    const logged = fx.movements.find((m) => m.vesselId === a.vesselId && m.kind === 'arrival' && m.trip === 'stay' && atOrBefore(m.at, s.clock));
    rows.push({ key: `in:${a.id}`, kind: 'check-in', vesselName: name(a.vesselId), slipId: a.slipId, status: logged ? 'arrived' : 'due', at: logged?.at ?? null });
  }
  for (const d of fx.movements.filter((m) => m.kind === 'departure' && m.trip === 'outing' && m.expectedReturnAt && atOrBefore(m.at, s.clock))) {
    const back = fx.movements.find((m) => m.vesselId === d.vesselId && m.kind === 'arrival' && toMs(m.at) > toMs(d.at) && atOrBefore(m.at, s.clock));
    rows.push({ key: `ret:${d.id}`, kind: 'return', vesselName: name(d.vesselId), slipId: d.slipId, status: back ? 'arrived' : 'due', at: back?.at ?? d.expectedReturnAt });
  }
  for (const a of activeAssignments(s)) {
    const r = fx.transientRequests.find((x) => x.id === a.requestId);
    if (r) rows.push({ key: `req:${a.id}`, kind: 'request', vesselName: r.vesselName, slipId: a.slipId, status: 'due', at: r.arrivalFrom });
  }
  const rank = (r: BoardRow) => (r.status === 'arrived' ? 0 : r.at ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || (a.at && b.at ? toMs(a.at) - toMs(b.at) : 0) || a.vesselName.localeCompare(b.vesselName));
}

// ---------- dock map statuses (T29, PRD F19) ----------
export type MapStatus = 'occupied' | 'away' | 'reserved' | 'review' | 'vacant';
export const MAP_STATUSES: readonly MapStatus[] = ['occupied', 'away', 'reserved', 'review', 'vacant'];
/** Short, dockmaster-facing names. They never name a vessel, so a plate can be hovered without leaking identity. */
export const MAP_STATUS_LABEL: Record<MapStatus, string> = {
  occupied: 'Occupied',
  away: 'Away',
  reserved: 'Reserved',
  review: 'Needs review',
  vacant: 'Vacant',
};
/** One-line meaning, for the legend. Statuses are about the night's berth plan, not a camera reading. */
export const MAP_STATUS_HINT: Record<MapStatus, string> = {
  occupied: 'Held tonight, boat not logged out',
  away: 'Held tonight, boat logged out',
  reserved: 'Arriving today, not checked in yet (includes your demo assignments)',
  review: 'Open review issue',
  vacant: 'Not held tonight: unsold night',
};

/**
 * What the dock map shows for a berth on the scenario night, first match wins:
 * 1. review: an open review issue on the slip (uncertain identity outranks the plan).
 * 2. vacant: no agreement covers tonight. Never inferred from an empty berth (inv. 2), and an agreement
 *    is never dropped because a berth looks empty or a camera is offline (inv. 9).
 * 3. away: the holder's latest confirmed location at the clock is a logged departure. A later staff
 *    verification or identity decision brings it back; a possible match never does (inv. 3, 4).
 * 4. reserved: a transient agreement starting tonight whose holder has no logged location yet.
 * 5. occupied: otherwise. “Held, not logged out”: not a claim that a camera currently sees the boat.
 * Reads nothing after the session clock except agreements, which are known in advance (inv. 8).
 */
export function mapSlipStatus(fx: Fx, s: S, slipId: string): MapStatus {
  const issue = latestIssueForSlip(s, slipId);
  if (issue && issue.state !== 'resolved') return 'review';
  const night = fx.scenario.date;
  const held = fx.agreements.find((a) => a.slipId === slipId && a.status === 'active' && a.start <= night && a.end > night);
  if (!held) return activeAssignmentForSlip(s, slipId) ? 'reserved' : 'vacant';
  const loc = vesselLocation(fx, s, held.vesselId);
  if (loc.kind === 'departed' && loc.slipId === slipId) return 'away';
  if (loc.kind === 'none' && held.type === 'transient' && held.start === night) return 'reserved';
  return 'occupied';
}

/** Every slip's map status, in fixture order. */
export const mapStatuses = (fx: Fx, s: S): Map<string, MapStatus> => new Map(fx.slips.map((x) => [x.id, mapSlipStatus(fx, s, x.id)]));

export function mapStatusCounts(fx: Fx, s: S): Record<MapStatus, number> {
  const out: Record<MapStatus, number> = { occupied: 0, away: 0, reserved: 0, review: 0, vacant: 0 };
  for (const st of mapStatuses(fx, s).values()) out[st] += 1;
  return out;
}

export interface TrailEntry {
  at: IsoTime;
  kind: 'departure' | 'observation' | 'audit';
  label: string;
  refId: string;
}

/** Observation → verification → resolution trail for an issue, never showing anything after the clock. */
export function activityTrail(fx: Fx, s: S, issueId: string): TrailEntry[] {
  const issue = issueById(s, issueId);
  if (!issue) return [];
  const entries: TrailEntry[] = [];
  const agreement = activeAgreementForSlip(fx, issue.slipId);
  const dep = fx.movements.filter((m) => m.slipId === issue.slipId && m.kind === 'departure' && agreement && m.vesselId === agreement.vesselId && atOrBefore(m.at, issue.createdAt)).pop();
  if (dep) entries.push({ at: dep.at, kind: 'departure', label: 'Departure logged', refId: dep.id });
  const walk = dockWalkEvidenceForIssue(fx, s, issueId);
  if (walk) entries.push({ at: walk.capturedAt, kind: 'observation', label: 'Dock walk · marked Occupied', refId: walk.id });
  const obs = fx.observations.find((o) => o.id === issue.observationId);
  if (obs) entries.push({ at: obs.observedAt, kind: 'observation', label: 'Camera C-02 · vessel present, identity unverified', refId: obs.id });
  for (const a of s.audit) {
    if (a.issueId !== issueId || a.type === 'issue_opened' || !atOrBefore(a.eventAt, s.clock)) continue;
    entries.push({ at: a.eventAt, kind: 'audit', label: AUDIT_LABEL[a.type], refId: a.id });
  }
  return entries.sort((a, b) => toMs(a.at) - toMs(b.at));
}

export const AUDIT_LABEL: Record<DemoSession['audit'][number]['type'], string> = {
  issue_opened: 'Review issue opened',
  dock_check_requested: 'Dock check requested',
  staff_evidence_received: 'Staff evidence received',
  identity_confirmed: 'Identity confirmed',
  dock_check_completed: 'Dock check completed',
  issue_resolved: 'Issue resolved',
  source_status_changed: 'Source status changed',
};
