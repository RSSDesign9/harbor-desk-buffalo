/**
 * Scenario state engine (TASKS T06, PRD §7). Pure: `apply(fixtures, session, command)` returns a new session
 * and never mutates its inputs. Every write appends; nothing in the fixtures is edited.
 *
 * Commands map to the canonical stages:
 *   normal 08:45 → advanceToUncertain 09:12 → [requestDockCheck 09:13] → loadDockCheckResult 09:18
 *   → acknowledgeEvidence → confirmIdentity 09:20
 * Agreements are not part of the session at all, so no command can change one.
 */
import type { DemoSession, Selection } from './session.ts';
import { seqId } from './session.ts';
import type { AuditEvent, FixtureBundle, IsoTime, LakeScenarioId } from './types.ts';
import { conditionsForRequest } from './lake.ts';
import { activeAssignmentForRequest, confirmBlocker, issueById, latestIssueForSlip, revealedStaffEvidence, slipIdentity, taskForIssue } from './selectors.ts';
import { checkFit, offeredSlips } from './fit.ts';
import { toMs } from './time.ts';

export type Command =
  | { type: 'select'; selection: Selection }
  | { type: 'advanceToUncertain' }
  | { type: 'requestDockCheck'; issueId: string }
  | { type: 'loadDockCheckResult'; issueId: string }
  | { type: 'openReview'; issueId: string }
  | { type: 'cancelReview' }
  | { type: 'acknowledgeEvidence'; evidenceId: string; value: boolean }
  | { type: 'confirmIdentity'; issueId: string }
  /** Scenario/test control for stale and offline handling (T18). Appends a status event at the clock. */
  | { type: 'setSourceStatus'; sourceId: string; status: 'online' | 'offline' }
  /** T30: assign an incoming transient request to an offered slip (a local SIM assignment). */
  | { type: 'assignRequest'; requestId: string; slipId: string; /** T35: the lake what-if the fit is checked under (calm if absent). */ lake?: LakeScenarioId }
  /** T30: undo a demo assignment (stamps undoneAt; the record stays). */
  | { type: 'undoAssignment'; assignmentId: string };

export type RejectReason =
  | 'unknown_target'
  | 'unknown_issue'
  | 'issue_resolved'
  | 'wrong_stage'
  | 'staff_evidence_already_available'
  | 'evidence_unavailable'
  | 'evidence_not_revealed'
  | 'acknowledgement_required'
  | 'unknown_source'
  | 'replay_read_only'
  | 'unknown_request'
  | 'request_not_received'
  | 'already_assigned'
  | 'slip_not_offered'
  | 'no_fit'
  | 'unknown_assignment';

export type CommandResult =
  | { ok: true; session: DemoSession; effect: 'changed' | 'unchanged'; note?: string }
  | { ok: false; session: DemoSession; reason: RejectReason };

const ok = (session: DemoSession, note?: string): CommandResult => (note ? { ok: true, session, effect: 'changed', note } : { ok: true, session, effect: 'changed' });
const same = (session: DemoSession, note: string): CommandResult => ({ ok: true, session, effect: 'unchanged', note });
const no = (session: DemoSession, reason: RejectReason): CommandResult => ({ ok: false, session, reason });

const later = (a: IsoTime, b: IsoTime) => (toMs(a) >= toMs(b) ? a : b);

function audit(s: DemoSession, e: Omit<AuditEvent, 'id' | 'provenance'>, offset = 0): AuditEvent {
  return { id: seqId('AUD', s.audit.length + 1 + offset), provenance: 'SIM', ...e };
}

export function apply(fx: FixtureBundle, s: DemoSession, cmd: Command): CommandResult {
  const sc = fx.scenario;
  switch (cmd.type) {
    case 'select': {
      const sel = cmd.selection;
      if (sel && !(sel.kind === 'slip' ? fx.slips.some((x) => x.id === sel.id) : fx.vessels.some((x) => x.id === sel.id))) return no(s, 'unknown_target');
      if (sel?.id === s.selection?.id && sel?.kind === s.selection?.kind) return same(s, 'already_selected');
      return ok({ ...s, selection: sel });
    }

    case 'advanceToUncertain': {
      if (latestIssueForSlip(s, sc.slipId)) return same(s, 'already_advanced');
      if (s.clock !== sc.checkpoints.normal) return no(s, 'wrong_stage');
      const clock = sc.checkpoints.uncertain;
      const issue = {
        id: seqId('ISS', s.issues.length + 1),
        slipId: sc.slipId,
        observationId: sc.uncertainObservationId,
        state: 'open' as const,
        reason: 'Vessel present; identity unverified. The possible match is a candidate only.',
        createdAt: clock,
        resolvedAt: null,
        provenance: 'SIM' as const,
      };
      return ok({
        ...s,
        clock,
        issues: [...s.issues, issue],
        audit: [...s.audit, audit(s, { issueId: issue.id, type: 'issue_opened', actorId: 'ACT-SYSTEM', eventAt: clock, refs: { observationId: sc.uncertainObservationId } })],
      });
    }

    case 'requestDockCheck': {
      const issue = issueById(s, cmd.issueId);
      if (!issue) return no(s, 'unknown_issue');
      const existing = taskForIssue(s, issue.id);
      if (existing) return same(s, 'existing_task'); // duplicate requests return the existing task
      if (issue.state === 'resolved') return no(s, 'issue_resolved');
      if (revealedStaffEvidence(fx, s, issue.id)) return no(s, 'staff_evidence_already_available');
      const clock = later(s.clock, sc.checkpoints.pending_check);
      const task = { id: seqId('TSK', s.tasks.length + 1), issueId: issue.id, slipId: issue.slipId, requestedAt: clock, status: 'pending' as const, completedAt: null, verificationId: null, provenance: 'SIM' as const };
      return ok({
        ...s,
        clock,
        tasks: [...s.tasks, task],
        issues: s.issues.map((i) => (i.id === issue.id ? { ...i, state: 'pending_check' as const } : i)),
        audit: [...s.audit, audit(s, { issueId: issue.id, type: 'dock_check_requested', actorId: sc.demoActorId, eventAt: clock, refs: { taskId: task.id } })],
      });
    }

    case 'loadDockCheckResult': {
      const issue = issueById(s, cmd.issueId);
      if (!issue) return no(s, 'unknown_issue');
      if (issue.state === 'resolved') return no(s, 'issue_resolved');
      if (s.revealedEvidenceIds.includes(sc.staffEvidenceId)) return same(s, 'already_loaded');
      const ev = fx.stagedEvidence.find((e) => e.id === sc.staffEvidenceId && e.slipId === issue.slipId);
      if (!ev) return no(s, 'evidence_unavailable');
      const clock = later(s.clock, ev.capturedAt);
      const task = taskForIssue(s, issue.id);
      return ok({
        ...s,
        clock,
        revealedEvidenceIds: [...s.revealedEvidenceIds, ev.id],
        audit: [...s.audit, audit(s, { issueId: issue.id, type: 'staff_evidence_received', actorId: ev.actorId ?? 'ACT-STAFF', eventAt: clock, refs: task ? { evidenceId: ev.id, taskId: task.id } : { evidenceId: ev.id } })],
      });
    }

    case 'openReview': {
      const issue = issueById(s, cmd.issueId);
      if (!issue) return no(s, 'unknown_issue');
      if (issue.state === 'resolved') return no(s, 'issue_resolved');
      if (s.review?.issueId === issue.id) return same(s, 'already_open');
      return ok({ ...s, review: { issueId: issue.id } });
    }

    case 'cancelReview': {
      // Back/cancel: leaves the issue, task, evidence and clock exactly as they were; clears acknowledgement.
      if (!s.review && s.acknowledgedEvidenceIds.length === 0) return same(s, 'nothing_open');
      return ok({ ...s, review: null, acknowledgedEvidenceIds: [] });
    }

    case 'acknowledgeEvidence': {
      if (!s.revealedEvidenceIds.includes(cmd.evidenceId)) return no(s, 'evidence_not_revealed');
      const has = s.acknowledgedEvidenceIds.includes(cmd.evidenceId);
      if (has === cmd.value) return same(s, 'unchanged');
      return ok({ ...s, acknowledgedEvidenceIds: cmd.value ? [...s.acknowledgedEvidenceIds, cmd.evidenceId] : s.acknowledgedEvidenceIds.filter((e) => e !== cmd.evidenceId) });
    }

    case 'confirmIdentity': {
      const blocker = confirmBlocker(fx, s, cmd.issueId);
      if (blocker === 'already_resolved') return same(s, 'already_resolved'); // idempotent
      if (blocker === 'unknown_issue') return no(s, 'unknown_issue');
      if (blocker === 'evidence_unavailable') return no(s, 'evidence_unavailable');
      if (blocker === 'acknowledgement_required') return no(s, 'acknowledgement_required');
      const issue = issueById(s, cmd.issueId)!;
      const ev = revealedStaffEvidence(fx, s, issue.id)!;
      const clock = later(s.clock, sc.checkpoints.resolved);
      const before = slipIdentity(fx, s, issue.slipId);
      const verification = {
        id: seqId('VER-S', s.verifications.length + 1),
        slipId: issue.slipId,
        verifiedVesselId: ev.verifiedVesselId!,
        checkedAt: ev.capturedAt,
        actorId: ev.actorId ?? 'ACT-STAFF',
        method: 'staff-dock-check' as const,
        evidenceSummary: ev.summary,
        evidenceAssetId: ev.assetId,
        sourceId: ev.sourceId,
        provenance: 'SIM' as const,
      };
      const decision = { id: seqId('DEC', s.decisions.length + 1), observationId: issue.observationId, confirmedVesselId: ev.verifiedVesselId!, verificationId: verification.id, actorId: sc.demoActorId, decidedAt: clock, provenance: 'SIM' as const };
      const task = taskForIssue(s, issue.id);
      const events: AuditEvent[] = [];
      const push = (e: Omit<AuditEvent, 'id' | 'provenance'>) => events.push(audit(s, e, events.length));
      push({
        issueId: issue.id,
        type: 'identity_confirmed',
        actorId: sc.demoActorId,
        eventAt: clock,
        refs: { observationId: issue.observationId, verificationId: verification.id, decisionId: decision.id, evidenceId: ev.id },
        before: before.state === 'unverified' ? `identity unverified; candidates (not identities): ${before.candidateVesselIds.join(', ') || 'none'}` : before.state,
        after: `confirmed ${decision.confirmedVesselId} by ${decision.id}`,
      });
      if (task && task.status === 'pending') push({ issueId: issue.id, type: 'dock_check_completed', actorId: sc.demoActorId, eventAt: clock, refs: { taskId: task.id, verificationId: verification.id } });
      push({ issueId: issue.id, type: 'issue_resolved', actorId: sc.demoActorId, eventAt: clock, refs: { decisionId: decision.id } });
      // One new session object: all records land together or not at all.
      return ok({
        ...s,
        clock,
        review: null,
        verifications: [...s.verifications, verification],
        decisions: [...s.decisions, decision],
        tasks: s.tasks.map((t) => (t.issueId === issue.id && t.status === 'pending' ? { ...t, status: 'completed' as const, completedAt: clock, verificationId: verification.id } : t)),
        issues: s.issues.map((i) => (i.id === issue.id ? { ...i, state: 'resolved' as const, resolvedAt: clock } : i)),
        audit: [...s.audit, ...events],
      });
    }

    case 'assignRequest': {
      const req = fx.transientRequests.find((r) => r.id === cmd.requestId);
      if (!req) return no(s, 'unknown_request');
      if (toMs(req.receivedAt) > toMs(s.clock)) return no(s, 'request_not_received');
      const current = activeAssignmentForRequest(s, req.id);
      if (current?.slipId === cmd.slipId) return same(s, 'already_assigned_here');
      if (current) return no(s, 'already_assigned');
      const slip = fx.slips.find((x) => x.id === cmd.slipId);
      if (!slip) return no(s, 'unknown_target');
      if (!offeredSlips(fx, s).some((x) => x.id === slip.id)) return no(s, 'slip_not_offered');
      const svc = fx.slipServices.find((v) => v.slipId === slip.id);
      const lake = cmd.lake ?? 'calm';
      if (!svc || checkFit(req, slip, svc, conditionsForRequest(fx, req, lake)).verdict === 'no-fit') return no(s, 'no_fit');
      const assignments = s.assignments ?? [];
      const a = { id: seqId('ASN', assignments.length + 1), requestId: req.id, slipId: slip.id, assignedAt: s.clock, undoneAt: null, actorId: sc.demoActorId, lake, provenance: 'SIM' as const };
      return ok({ ...s, assignments: [...assignments, a] });
    }

    case 'undoAssignment': {
      const assignments = s.assignments ?? [];
      const a = assignments.find((x) => x.id === cmd.assignmentId);
      if (!a) return no(s, 'unknown_assignment');
      if (a.undoneAt !== null) return same(s, 'already_undone');
      return ok({ ...s, assignments: assignments.map((x) => (x.id === a.id ? { ...x, undoneAt: s.clock } : x)) });
    }

    case 'setSourceStatus': {
      if (!fx.sources.some((x) => x.id === cmd.sourceId && x.kind === 'sim-camera')) return no(s, 'unknown_source');
      const ev = { id: seqId('SST-S', s.sourceEvents.length + 1), sourceId: cmd.sourceId, status: cmd.status, at: s.clock, provenance: 'SIM' as const };
      return ok({
        ...s,
        sourceEvents: [...s.sourceEvents, ev],
        audit: [...s.audit, audit(s, { issueId: null, type: 'source_status_changed', actorId: 'ACT-SYSTEM', eventAt: s.clock, refs: { sourceId: cmd.sourceId }, after: cmd.status })],
      });
    }
  }
}
