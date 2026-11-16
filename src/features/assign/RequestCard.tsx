/**
 * Incoming transient request (TASKS T30, PRD F20).
 *
 * Two equivalent paths:
 * - Pointer: press the handle and drag over the 3D scene, the dock map or the 2D plan. Every offered slip shows
 *   its verdict (fits / tight / no fit) and the slip under the pointer names its reason; dropping on a fitting
 *   or tight slip assigns, anywhere else does nothing. Escape cancels.
 * - Keyboard (list → Assign): the Slip list holds every offered slip with its verdict, best first; Assign is
 *   enabled for fits and tight. The reason for the chosen slip is shown and announced.
 * Either way the result is one appended local SIM assignment, which Undo stamps as undone.
 * Held or occupied slips are never in the list and never accept a drop. Read-only in the replay timeline.
 */
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeAssignmentForRequest, visibleRequests } from '../../domain/selectors.ts';
import { activeSession } from '../../domain/store.ts';
import { checkFit, VERDICT_LABEL, verdictsFor, type FitResult } from '../../domain/fit.ts';
import { conditionsForRequest } from '../../domain/lake.ts';
import { formatClock } from '../../domain/time.ts';
import { Button } from '../../ui/Button.tsx';
import { useAnnounce } from '../../ui/Announcer.tsx';
import { TYPE_LABEL } from '../registry/model.ts';
import { getAssignDrag, setAssignDrag, slipAtPoint, useAssignDrag, useAssignDragActive } from './dragStore.ts';
import { LakeConditions } from './LakeConditions.tsx';
import './assign.css';

const REJECT: Record<string, string> = {
  slip_not_offered: 'is not offered: it is held tonight or a boat is in it',
  no_fit: 'is a no fit',
  already_assigned: 'cannot take it: the request is already assigned',
};

/**
 * `collapsible` (desktop rail): while a slip or vessel is open in the inspector, the card shrinks to its header
 * so the review keeps its room; Show expands it again for that selection.
 */
export function RequestCard({ collapsible = false, requestId }: { collapsible?: boolean; requestId?: string | undefined }) {
  const state = useAppState();
  const store = useStore();
  const announce = useAnnounce();
  const id = useId();
  const dragging = useAssignDragActive();
  const [choice, setChoice] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<{ open: boolean; selKey: string } | null>(null);
  const handle = useRef<HTMLSpanElement>(null);

  // Escape cancels a drag in progress.
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAssignDrag({ active: false, hoverSlipId: null });
        announce('Drag cancelled. Nothing assigned.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging, announce]);

  const s = state ? activeSession(state) : null;
  const req = state && s ? visibleRequests(state.fixtures, s).find((r) => !requestId || r.id === requestId) : undefined;
  const lake = state?.lake ?? 'calm';
  const verdicts = useMemo(() => (state && s && req ? verdictsFor(state.fixtures, s, req.id, lake) : []), [state, s, req, lake]);
  if (!state || !store || !s || !req) return null;
  const readOnly = state.view.mode === 'replay';
  const assignment = activeAssignmentForRequest(s, req.id);
  const selKey = s.selection ? `${s.selection.kind}:${s.selection.id}` : '';
  const expanded = !collapsible || (openFor && openFor.selKey === selKey ? openFor.open : selKey === '');
  const chosen: FitResult | undefined = verdicts.find((v) => v.slipId === choice) ?? verdicts.find((v) => v.verdict !== 'no-fit');
  const window_ = `${formatClock(req.arrivalFrom)}–${formatClock(req.arrivalTo)}`;
  // T35: an assignment made under one what-if, re-checked under the one now shown. Only a worse verdict is flagged.
  const drift = (() => {
    if (!assignment || (assignment.lake ?? 'calm') === lake) return null;
    const slip = state.fixtures.slips.find((x) => x.id === assignment.slipId);
    const svc = state.fixtures.slipServices.find((x) => x.slipId === assignment.slipId);
    if (!slip || !svc) return null;
    const now = checkFit(req, slip, svc, conditionsForRequest(state.fixtures, req, lake));
    const then = checkFit(req, slip, svc, conditionsForRequest(state.fixtures, req, assignment.lake ?? 'calm'));
    const rank = { fits: 0, tight: 1, 'no-fit': 2 } as const;
    return rank[now.verdict] > rank[then.verdict] ? now : null;
  })();

  const assign = (slipId: string) => {
    const r = store.dispatch({ type: 'assignRequest', requestId: req.id, slipId, lake });
    const v = verdicts.find((x) => x.slipId === slipId);
    if (r.ok) announce(`${req.vesselName} assigned to ${slipId} (demo). ${v ? `${VERDICT_LABEL[v.verdict]}: ${v.reason}.` : ''} Due ${window_}. Undo is available.`);
    else announce(`${slipId} ${REJECT[r.reason] ?? 'cannot take this request'}. Nothing assigned.`);
  };
  const undo = () => {
    if (!assignment) return;
    store.dispatch({ type: 'undoAssignment', assignmentId: assignment.id });
    announce(`Assignment to ${assignment.slipId} undone. ${req.vesselName} is unassigned.`);
  };

  // ---------- pointer drag ----------
  const move = (e: ReactPointerEvent) => {
    if (!getAssignDrag().active) return;
    setAssignDrag({ x: e.clientX, y: e.clientY, hoverSlipId: slipAtPoint(e.clientX, e.clientY) });
  };
  const down = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0 || readOnly || assignment) return;
    e.preventDefault();
    handle.current?.setPointerCapture(e.pointerId);
    setAssignDrag({ active: true, requestId: req.id, x: e.clientX, y: e.clientY, hoverSlipId: null });
  };
  const up = (e: ReactPointerEvent) => {
    if (!getAssignDrag().active) return;
    const slipId = slipAtPoint(e.clientX, e.clientY);
    setAssignDrag({ active: false, hoverSlipId: null });
    if (!slipId) return; // dropped outside the map: nothing happens
    const v = verdicts.find((x) => x.slipId === slipId);
    if (!v) announce(`${slipId} ${REJECT.slip_not_offered}. Nothing assigned.`);
    else if (v.verdict === 'no-fit') announce(`No fit at ${slipId}: ${v.reason}. Nothing assigned.`);
    else assign(slipId);
  };

  return (
    <section className="panel request-card" aria-labelledby="request-title" data-testid="request-card">
      <header className="request-head">
        <h2 className="panel-title" id="request-title" tabIndex={-1}>Incoming request</h2>
        {collapsible ? (
          <button type="button" className="btn btn-ghost request-toggle" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={() => setOpenFor({ open: !expanded, selKey })}>
            {expanded ? 'Hide' : 'Show'}
            <span className="sr-only"> request</span>
          </button>
        ) : null}
      </header>
      {!expanded ? (
        <p className="body-sm request-summary">
          {req.vesselName} · {req.loa_ft}&nbsp;ft · {assignment ? `assigned to ${assignment.slipId}` : 'not assigned'}
          {lake === 'sw-gale' ? ' · gale what-if' : ''}
        </p>
      ) : null}
      <div className="request-body" id={`${id}-body`} hidden={!expanded}>
      <p className="request-name">
        {req.vesselName} <span className="secondary">{TYPE_LABEL[req.type].toLowerCase()}</span>
      </p>
      <dl className="request-overview" aria-label="Arrival details">
        <div><dt>Arrival window</dt><dd>{window_}</dd></div>
        <div><dt>Stay</dt><dd>{req.nights} nights</dd></div>
        <div><dt>Length</dt><dd>{req.loa_ft} ft</dd></div>
      </dl>
      <details className="inspector-more request-particulars">
        <summary>Vessel requirements</summary>
        <dl className="facts">
          <div className="fact"><dt>Length / beam</dt><dd>{req.loa_ft} ft / {req.beam_ft} ft</dd></div>
          <div className="fact"><dt>Draft</dt><dd>{req.draft_ft} ft</dd></div>
          <div className="fact"><dt>Shore power</dt><dd>{req.powerA} A</dd></div>
        </dl>
      </details>
      {assignment ? (
        <div className="request-done" data-testid="request-assigned">
          <p className="body-sm">
            Assigned to <strong className="data">{assignment.slipId}</strong> · demo assignment
          </p>
          {drift ? (
            <p className="body-sm request-drift" data-verdict={drift.verdict} data-testid="request-drift">
              Under the {lake === 'sw-gale' ? 'SW gale' : 'calm'} what-if {assignment.slipId} is {drift.verdict === 'no-fit' ? 'a no fit' : 'tight'}: {drift.reason}.
            </p>
          ) : null}
          {!readOnly ? (
            <Button variant="secondary" onClick={undo}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : readOnly ? (
        <p className="body-sm secondary">Read-only here. Back in your run you can assign it.</p>
      ) : (
        <div className="request-actions">
          <label className="request-slip">
            <span className="body-sm">Slip</span>
            <select className="input" value={chosen?.slipId ?? ''} onChange={(e) => setChoice(e.target.value)} aria-describedby={`${id}-why`}>
              {verdicts.map((v) => (
                <option key={v.slipId} value={v.slipId}>
                  {v.slipId} · {VERDICT_LABEL[v.verdict]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" disabled={!chosen || chosen.verdict === 'no-fit'} onClick={() => chosen && assign(chosen.slipId)}>
            Assign
          </Button>
          <p className="body-sm request-why" id={`${id}-why`} data-verdict={chosen?.verdict}>
            {chosen ? `${VERDICT_LABEL[chosen.verdict]}: ${chosen.reason}` : 'No slip is offered.'}
          </p>
          <span
            ref={handle}
            className="drag-handle"
            aria-hidden="true"
            data-testid="request-drag"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setAssignDrag({ active: false, hoverSlipId: null })}
          >
            <span className="drag-grip" />
            Or drag onto a slip
          </span>
        </div>
      )}
      <p className="request-note">Fit preview uses assumed depths and services. Verify before a real assignment.</p>
      <details className="inspector-more" open={lake === 'sw-gale' || undefined}>
        <summary>Conditions &amp; what-if {lake === 'sw-gale' ? '· SW gale' : ''}</summary>
        <LakeConditions req={req} />
      </details>
      </div>
      {dragging ? <DragChip name={req.vesselName} verdicts={verdicts} /> : null}
    </section>
  );
}

/** Follows the pointer while dragging (the only part that re-renders on every move). Portalled out of the glass panel. */
function DragChip({ name, verdicts }: { name: string; verdicts: readonly FitResult[] }) {
  const drag = useAssignDrag();
  const hover = drag.hoverSlipId ? verdicts.find((v) => v.slipId === drag.hoverSlipId) ?? null : null;
  return createPortal(
    <div className="drag-chip" style={{ left: drag.x + 14, top: drag.y + 14 }} aria-hidden="true" data-testid="drag-chip" data-verdict={hover?.verdict ?? 'none'}>
      <strong>{name}</strong>
      <span>{drag.hoverSlipId ? (hover ? `${hover.slipId} · ${VERDICT_LABEL[hover.verdict]}` : `${drag.hoverSlipId} · not offered`) : 'Over a vacant slip'}</span>
    </div>,
    document.body,
  );
}
