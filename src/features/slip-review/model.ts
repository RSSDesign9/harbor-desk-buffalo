/**
 * Slip-review view model (TASKS T11–T13, PRD §7). Pure: derived from the shared domain selectors only, so the
 * inspector, the scenario panel and the scene can never disagree about the workflow stage.
 *
 * Rules carried here:
 * - “Possible match” is always subordinate to “identity unverified” and never becomes an identity (inv. 3).
 * - Camera evidence alone can never enable confirmation; the guard is the engine’s own `confirmBlocker`.
 * - Nothing after the session clock is described (inv. 8): staff evidence appears only once revealed,
 *   decisions and audit only once appended.
 * - The dock-check task is local and simulated; the copy says so wherever the task appears.
 */
import type { DemoSession } from '../../domain/session.ts';
import type { AuditEvent, CheckpointId, DockCheckTask, FixtureBundle, IsoTime, ReviewIssue, StagedEvidence } from '../../domain/types.ts';
import {
  activeAgreementForSlip,
  activeAgreementForVessel,
  cameraEvidenceForObservation,
  dockWalkEvidenceForIssue,
  confirmBlocker,
  latestIssueForSlip,
  revealedStaffEvidence,
  scenarioStage,
  slipPresence,
  taskForIssue,
  vesselLocation,
  type ConfirmBlocker,
} from '../../domain/selectors.ts';
import { formatClock } from '../../domain/time.ts';
import { TYPE_LABEL } from '../registry/model.ts';

type Fx = FixtureBundle;
type S = DemoSession;
const t = (iso: IsoTime) => formatClock(iso);

// ---------- evidence images ----------
export interface EvidenceImage {
  /** 1× URL, or null when no image was ever produced for this evidence (text evidence still applies). */
  src: string | null;
  srcSet: string | null;
  alt: string;
}

/** Image URLs for staged evidence. Only assets marked `available` produce a URL; opaque names only (inv. 10). */
export function evidenceImage(fx: Fx, ev: StagedEvidence): EvidenceImage {
  const asset = ev.assetId ? fx.evidenceAssets.find((a) => a.id === ev.assetId) : undefined;
  if (!asset || asset.status !== 'available') return { src: null, srcSet: null, alt: ev.altText };
  const src = `/${asset.path}`;
  const at2x = src.replace(/\.webp$/, '@2x.webp');
  return { src, srcSet: `${src} 1x, ${at2x} 2x`, alt: ev.altText };
}

// ---------- stages ----------
export interface StageStep {
  id: CheckpointId;
  time: string;
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'skipped';
  optional: boolean;
}

const STAGE_LABEL: Record<CheckpointId, string> = {
  normal: 'Normal',
  uncertain: 'Discrepancy',
  pending_check: 'Dock check',
  verification_review: 'Staff evidence',
  resolved: 'Resolved',
};
export const STAGE_ORDER: readonly CheckpointId[] = ['normal', 'uncertain', 'pending_check', 'verification_review', 'resolved'];

/** The five canonical stages with done/current/upcoming state; the 09:13 check is optional and may be skipped. */
export function stageSteps(fx: Fx, s: S): StageStep[] {
  const stage = scenarioStage(fx, s);
  const at = STAGE_ORDER.indexOf(stage);
  const issue = latestIssueForSlip(s, fx.scenario.slipId);
  const hasTask = issue ? Boolean(taskForIssue(s, issue.id)) : false;
  return STAGE_ORDER.map((id, i) => {
    let state: StageStep['state'] = i < at ? 'done' : i === at ? 'current' : 'upcoming';
    if (id === 'pending_check' && !hasTask && at > i) state = 'skipped';
    return { id, time: t(fx.scenario.checkpoints[id]), label: STAGE_LABEL[id], state, optional: id === 'pending_check' };
  });
}

// ---------- slip review ----------
export interface ComparisonRow {
  label: string;
  observed: string;
  assigned: string;
  candidate: string;
}

export interface TrailItem {
  at: string;
  title: string;
  detail: string;
  kind: 'departure' | 'dock-walk' | 'observation' | 'task' | 'evidence' | 'decision' | 'resolution' | 'other';
  refId: string;
}

export interface SlipReviewModel {
  slipId: string;
  stage: CheckpointId;
  issue: ReviewIssue | null;
  /** Normal stage, scenario slip only: what explains the empty-but-assigned berth. */
  normal: { assignedName: string; departedAt: string | null; observedEmptyAt: string | null } | null;
  observation: {
    id: string;
    at: string;
    sourceLabel: string;
    summary: string;
    image: EvidenceImage;
    reason: string | null;
    observed: string[];
    notEstablished: string[];
    possibleMatch: { id: string; name: string } | null;
  } | null;
  /** T32: the dock-walk entry that opened the issue; the camera observation below is the second source. */
  dockWalk: { id: string; at: string; actorLabel: string; summary: string } | null;
  comparison: { assignedName: string; candidateName: string; rows: ComparisonRow[] } | null;
  task: (Pick<DockCheckTask, 'id' | 'status'> & { requestedAt: string; completedAt: string | null }) | null;
  request: { allowed: true } | { allowed: false; reason: 'already_requested' | 'staff_evidence_available' | 'resolved' | 'no_issue' };
  camera: { id: string; status: 'online' | 'offline'; note: string | null } | null;
  staffEvidence: { id: string; at: string; actorLabel: string; sourceLabel: string; summary: string; image: EvidenceImage; registrationSuffix: string | null; vesselName: string } | null;
  reviewOpen: boolean;
  acknowledged: boolean;
  confirm: { blocker: ConfirmBlocker | null; hint: string };
  resolution: {
    vesselName: string;
    decidedAt: string;
    actorLabel: string;
    verifiedAt: string;
    agreement: string;
    candidateNote: string;
  } | null;
  trail: TrailItem[];
}

const CONFIRM_HINT: Record<ConfirmBlocker | 'ok', string> = {
  unknown_issue: 'There is no open review for this slip.',
  already_resolved: 'This issue is already resolved.',
  evidence_unavailable: 'Needs staff evidence.',
  acknowledgement_required: 'Tick the acknowledgment above to enable confirmation.',
  ok: '',
};

const actorLabel = (fx: Fx, id: string | null) => fx.actors.find((a) => a.id === id)?.label ?? 'Simulated actor';
const vesselName = (fx: Fx, id: string | null | undefined) => fx.vessels.find((v) => v.id === id)?.name ?? 'Unknown vessel';
const sourceLabel = (fx: Fx, sourceId: string) => {
  const src = fx.sources.find((x) => x.id === sourceId);
  if (!src) return sourceId;
  if (src.kind === 'sim-camera') return `Camera ${src.id}`;
  if (src.kind === 'sim-staff-log') return 'Staff log';
  return 'Staff dock check';
};
const COVER: Record<string, string> = { navy: 'Navy', sand: 'Tan', none: 'None' };

function trailItems(fx: Fx, s: S, issue: ReviewIssue): TrailItem[] {
  const items: TrailItem[] = [];
  const ag = activeAgreementForSlip(fx, issue.slipId);
  const dep = fx.movements
    .filter((m) => m.slipId === issue.slipId && m.kind === 'departure' && ag && m.vesselId === ag.vesselId && m.at <= issue.createdAt)
    .pop();
  if (dep) items.push({ at: t(dep.at), title: 'Departure logged', detail: 'Staff log', kind: 'departure', refId: dep.id });
  const walk = dockWalkEvidenceForIssue(fx, s, issue.id);
  if (walk) items.push({ at: t(walk.capturedAt), title: 'Dock walk · marked Occupied', detail: `${actorLabel(fx, walk.actorId)}: ${walk.summary}`, kind: 'dock-walk', refId: walk.id });
  const obs = fx.observations.find((o) => o.id === issue.observationId);
  if (obs) {
    const cand = obs.candidateVesselIds.map((id) => vesselName(fx, id)).join(', ');
    items.push({
      at: t(obs.observedAt),
      title: 'Vessel present · identity unverified',
      detail: `${sourceLabel(fx, obs.sourceId)} · second source${cand ? ` · possible match ${cand}` : ''}`,
      kind: 'observation',
      refId: obs.id,
    });
  }
  const describe = (a: AuditEvent): TrailItem | null => {
    switch (a.type) {
      case 'dock_check_requested':
        return { at: t(a.eventAt), title: 'Dock check requested', detail: `${a.refs.taskId ?? ''} · no message sent`, kind: 'task', refId: a.id };
      case 'staff_evidence_received': {
        const ev = fx.stagedEvidence.find((e) => e.id === a.refs.evidenceId);
        return { at: t(a.eventAt), title: 'Staff evidence received', detail: ev ? `${actorLabel(fx, ev.actorId)}: ${ev.summary}` : 'Staff evidence received.', kind: 'evidence', refId: a.id };
      }
      case 'identity_confirmed': {
        const d = s.decisions.find((x) => x.id === a.refs.decisionId);
        return { at: t(a.eventAt), title: 'Identity confirmed', detail: `${vesselName(fx, d?.confirmedVesselId)} · ${actorLabel(fx, a.actorId)}, from staff evidence`, kind: 'decision', refId: a.id };
      }
      case 'dock_check_completed':
        return { at: t(a.eventAt), title: 'Dock check completed', detail: `${a.refs.taskId ?? ''} closed`, kind: 'task', refId: a.id };
      case 'issue_resolved':
        return { at: t(a.eventAt), title: 'Issue resolved', detail: 'Agreement unchanged', kind: 'resolution', refId: a.id };
      default:
        return null;
    }
  };
  for (const a of s.audit) {
    if (a.issueId !== issue.id || a.eventAt > s.clock) continue;
    const item = describe(a);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Everything the review UI shows for one slip. Returns null for slips that have no part in the canonical
 * scenario and no issue (the T10 inspector already covers them).
 */
export function slipReview(fx: Fx, s: S, slipId: string): SlipReviewModel | null {
  const sc = fx.scenario;
  const issue = latestIssueForSlip(s, slipId);
  if (!issue && slipId !== sc.slipId) return null;
  const stage = slipId === sc.slipId ? scenarioStage(fx, s) : issue?.state === 'resolved' ? 'resolved' : 'uncertain';
  const ag = activeAgreementForSlip(fx, slipId);
  const presence = slipPresence(fx, s, slipId);

  let normal: SlipReviewModel['normal'] = null;
  if (!issue && ag) {
    const loc = vesselLocation(fx, s, ag.vesselId);
    normal = {
      assignedName: vesselName(fx, ag.vesselId),
      departedAt: loc.kind === 'departed' && loc.slipId === slipId ? t(loc.at) : null,
      observedEmptyAt: presence.lastReported?.presence === 'empty' ? t(presence.lastReported.at) : null,
    };
  }

  const walkEv = issue ? dockWalkEvidenceForIssue(fx, s, issue.id) : null;
  const dockWalk: SlipReviewModel['dockWalk'] = walkEv ? { id: walkEv.id, at: t(walkEv.capturedAt), actorLabel: actorLabel(fx, walkEv.actorId), summary: walkEv.summary } : null;
  let observation: SlipReviewModel['observation'] = null;
  let comparison: SlipReviewModel['comparison'] = null;
  if (issue) {
    const obs = fx.observations.find((o) => o.id === issue.observationId)!;
    const frame = cameraEvidenceForObservation(fx, s, obs.id);
    const candidate = obs.candidateVesselIds.map((id) => fx.vessels.find((v) => v.id === id)).find(Boolean) ?? null;
    observation = {
      id: obs.id,
      at: t(obs.observedAt),
      sourceLabel: sourceLabel(fx, obs.sourceId),
      summary: frame?.summary ?? 'No camera frame was stored for this observation.',
      image: frame ? evidenceImage(fx, frame) : { src: null, srcSet: null, alt: 'No camera frame stored.' },
      reason: obs.reason,
      observed: ['Cabin cruiser with a tan canvas cover'],
      notEstablished: ['Which vessel: stern name not legible', 'Whether the new cover explains the difference'],
      possibleMatch: candidate ? { id: candidate.id, name: candidate.name } : null,
    };
    const assigned = ag ? fx.vessels.find((v) => v.id === ag.vesselId) ?? null : null;
    if (assigned && candidate) {
      const loc = (id: string) => {
        const l = vesselLocation(fx, s, id);
        if (l.kind === 'departed') return `Departed ${l.slipId} ${t(l.at)}`;
        if (l.kind === 'confirmed-present') return `Confirmed at ${l.slipId} ${t(l.at)}`;
        return 'None recorded today';
      };
      const candAg = activeAgreementForVessel(fx, candidate.id);
      comparison = {
        assignedName: assigned.name,
        candidateName: candidate.name,
        rows: [
          { label: 'Type', observed: 'Cabin cruiser', assigned: `${TYPE_LABEL[assigned.type]}, ${assigned.loa_ft}\u00a0ft`, candidate: `${TYPE_LABEL[candidate.type]}, ${candidate.loa_ft}\u00a0ft` },
          { label: 'Name', observed: 'Not legible', assigned: 'On record', candidate: 'On record' },
          { label: 'Cover', observed: 'Tan', assigned: COVER[assigned.canvasColor] ?? '—', candidate: COVER[candidate.canvasColor] ?? '—' },
          { label: 'Last activity', observed: `Present ${t(obs.observedAt)}`, assigned: loc(assigned.id), candidate: loc(candidate.id) },
          { label: 'Assigned slip', observed: '—', assigned: ag?.slipId ?? '—', candidate: candAg ? candAg.slipId : 'None' },
        ],
      };
    }
  }

  const task = issue ? taskForIssue(s, issue.id) : null;
  const staff = issue ? revealedStaffEvidence(fx, s, issue.id) : null;
  let request: SlipReviewModel['request'];
  if (!issue) request = { allowed: false, reason: 'no_issue' };
  else if (task) request = { allowed: false, reason: 'already_requested' };
  else if (issue.state === 'resolved') request = { allowed: false, reason: 'resolved' };
  else if (staff) request = { allowed: false, reason: 'staff_evidence_available' };
  else request = { allowed: true };

  const blocker = issue ? confirmBlocker(fx, s, issue.id) : 'unknown_issue';
  let resolution: SlipReviewModel['resolution'] = null;
  if (issue?.state === 'resolved') {
    const decision = [...s.decisions].reverse().find((d) => d.observationId === issue.observationId) ?? null;
    const verification = decision ? s.verifications.find((v) => v.id === decision.verificationId) ?? null : null;
    const obs = fx.observations.find((o) => o.id === issue.observationId);
    const cand = obs?.candidateVesselIds[0] ?? null;
    const candAg = cand ? activeAgreementForVessel(fx, cand) : null;
    const candLoc = cand ? vesselLocation(fx, s, cand) : null;
    resolution = {
      vesselName: vesselName(fx, decision?.confirmedVesselId),
      decidedAt: decision ? t(decision.decidedAt) : '—',
      actorLabel: actorLabel(fx, decision?.actorId ?? null),
      verifiedAt: verification ? t(verification.checkedAt) : '—',
      agreement: ag ? `Unchanged · ${ag.type === 'seasonal' ? 'Seasonal' : 'Transient'} ${ag.slipId}` : 'None on record',
      candidateNote: cand
        ? `${vesselName(fx, cand)}, the possible match, is unchanged: assigned ${candAg?.slipId ?? '—'}${candLoc?.kind === 'departed' ? `, departed ${t(candLoc.at)}` : ''}.`
        : 'No candidate was proposed.',
    };
  }

  const camera = presence.cameraId
    ? {
        id: presence.cameraId,
        status: presence.cameraStatus ?? 'online',
        note:
          presence.cameraStatus === 'offline'
            ? `${presence.cameraId} offline · last frame ${presence.lastReported?.kind === 'camera' ? t(presence.lastReported.at) : '—'}`
            : presence.freshness === 'stale' && presence.basis?.kind === 'camera'
              ? `${presence.cameraId} frame from ${t(presence.basis.at)} · presence unknown`
              : null,
      }
    : null;

  return {
    slipId,
    stage,
    issue,
    normal,
    observation,
    dockWalk,
    comparison,
    task: task ? { id: task.id, status: task.status, requestedAt: t(task.requestedAt), completedAt: task.completedAt ? t(task.completedAt) : null } : null,
    request,
    camera,
    staffEvidence: staff
      ? {
          id: staff.id,
          at: t(staff.capturedAt),
          actorLabel: actorLabel(fx, staff.actorId),
          sourceLabel: sourceLabel(fx, staff.sourceId),
          summary: staff.summary,
          image: evidenceImage(fx, staff),
          registrationSuffix: fx.vessels.find((v) => v.id === staff.verifiedVesselId)?.registrationSuffix ?? null,
          vesselName: vesselName(fx, staff.verifiedVesselId),
        }
      : null,
    reviewOpen: Boolean(issue && s.review?.issueId === issue.id),
    acknowledged: Boolean(staff && s.acknowledgedEvidenceIds.includes(staff.id)),
    confirm: { blocker, hint: CONFIRM_HINT[blocker ?? 'ok'] },
    resolution,
    trail: issue ? trailItems(fx, s, issue) : [],
  };
}

/** Concise, screen-reader friendly result of a workflow command (polite live region). */
export function resultMessage(
  fx: Fx,
  cmd: 'advance' | 'request' | 'load' | 'open' | 'cancel' | 'confirm',
  r: { ok: boolean; effect?: 'changed' | 'unchanged'; reason?: string; note?: string },
  s: S,
): string {
  const slip = fx.scenario.slipId;
  if (!r.ok) {
    if (cmd === 'load' && r.reason === 'evidence_unavailable') return 'No simulated dock-check result is available. The issue stays open.';
    const why: Record<string, string> = {
      evidence_unavailable: 'Not confirmed: no staff evidence is available. The issue stays open.',
      acknowledgement_required: 'Not confirmed: acknowledge the staff evidence first. The issue stays open.',
      staff_evidence_already_available: 'No dock check needed: staff evidence is already available.',
      issue_resolved: 'This issue is already resolved.',
      replay_read_only: 'Replay is read-only. Use “Try this state” to interact.',
    };
    return why[r.reason ?? ''] ?? 'That action was not applied. Nothing changed.';
  }
  const issue = latestIssueForSlip(s, slip);
  const task = issue ? taskForIssue(s, issue.id) : null;
  switch (cmd) {
    case 'advance':
      return `${t(s.clock)}: dock walk marked ${slip} Occupied; camera C-02 shows a vessel, identity unverified. Review issue opened.`;
    case 'request':
      return r.effect === 'unchanged'
        ? `Dock check already requested (${task?.id ?? 'existing task'}). No duplicate created.`
        : `Dock check ${task?.id ?? ''} requested at ${t(s.clock)}. No message sent.`;
    case 'load':
      return r.effect === 'unchanged' ? 'Simulated dock-check result already loaded.' : `${t(s.clock)}: simulated staff evidence loaded. Review it, then acknowledge.`;
    case 'open':
      return 'Evidence review open. Identity is still unverified.';
    case 'cancel':
      return `Back to the observation. ${slip} still needs review.`;
    case 'confirm':
      return r.effect === 'unchanged' ? 'Already resolved. No duplicate record created.' : `${vesselName(fx, s.decisions[s.decisions.length - 1]?.confirmedVesselId)} confirmed at ${slip}. Issue resolved.`;
  }
}
