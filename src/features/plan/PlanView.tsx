/**
 * Lightweight top-down plan (TASKS T17/T18, PRD §6, F13). The small-screen default and the map whenever 3D is
 * unsupported, lost or failed. Same geometry module and the same domain selectors as the 3D scene, so plan,
 * list, inspector and counts cannot disagree. North is up (DESIGN chart mode).
 *
 * The drawing is aria-hidden like the canvas: the Slips / Vessels list is the accessible equivalent. The dock
 * zoom buttons are real buttons. Strokes do not scale with zoom; status is shape + pattern + legend text,
 * never colour alone. An unverified hull is drawn as an anonymous hull: no name, ever.
 */
import { useState } from 'react';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { SITE, slipGeom, type EN } from '../../data/site.ts';
import { activeSession } from '../../domain/store.ts';
import { latestIssueForSlip, slipPresence } from '../../domain/selectors.ts';
import { hullForSlip } from '../../scene/hulls.ts';
import { placeBoat, placementFootprint } from '../../scene/layout.ts';
import { frameTarget, markerLabel } from '../registry/model.ts';
import { KEYBOARD_PAN_PX, MAP_KEYBOARD_HELP, keyboardPanDirection } from '../../scene/keyboardPan.ts';
import './plan.css';

type Box = { x: number; y: number; w: number; h: number };
const toXY = (p: EN) => `${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`;
const ring = (pts: readonly EN[]) => pts.map(toXY).join(' ');
const path = (r: readonly EN[]) => `M${r.map(toXY).join('L')}Z`;

function bounds(points: readonly EN[], pad: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [e, n] of points) {
    x0 = Math.min(x0, e);
    x1 = Math.max(x1, e);
    y0 = Math.min(y0, -n);
    y1 = Math.max(y1, -n);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

const DOCKS = ['A', 'B', 'C', 'D', 'E'] as const;
const ALL = bounds(SITE.slips.flatMap((s) => s.corners), 25);
const DOCK_BOX: Record<string, Box> = Object.fromEntries(DOCKS.map((d) => [d, bounds(SITE.slips.filter((s) => s.dock === d).flatMap((s) => s.corners), 14)]));

type Focus = { kind: 'all' } | { kind: 'dock'; dock: string } | { kind: 'slip'; id: string };

function viewFor(focus: Focus): Box {
  if (focus.kind === 'dock') return DOCK_BOX[focus.dock] ?? ALL;
  if (focus.kind === 'slip') {
    const g = slipGeom(focus.id);
    if (!g) return ALL;
    const r = 32;
    return { x: g.centroid[0] - r, y: -g.centroid[1] - r * 0.8, w: 2 * r, h: 1.6 * r };
  }
  return ALL;
}

export default function PlanView() {
  const state = useAppState();
  const store = useStore();
  // The user's zoom choice holds until the selection changes; then the plan focuses the new selection.
  const [choice, setChoice] = useState<{ focus: Focus; selKey: string } | null>(null);
  const [pan, setPan] = useState({ key: '', x: 0, y: 0 });
  const s = state ? activeSession(state) : null;
  const fx = state?.fixtures;
  const target = fx && s ? frameTarget(fx, s) : null;
  const selKey = s?.selection ? `${s.selection.kind}:${s.selection.id}` : '';
  const focus: Focus = choice && choice.selKey === selKey ? choice.focus : target ? { kind: 'slip', id: target.slipId } : { kind: 'all' };

  const baseView = viewFor(focus);
  const panKey = `${selKey}:${JSON.stringify(focus)}`;
  const offset = pan.key === panKey ? pan : { x: 0, y: 0 };
  const view = { ...baseView, x: baseView.x + offset.x, y: baseView.y + offset.y };

  if (!state || !store || !fx || !s) return null;
  const selectedId = target?.slipId ?? null;
  const zoomed = view.w < 200;
  const select = (id: string) => store.dispatch({ type: 'select', selection: { kind: 'slip', id } });
  const choose = (f: Focus) => {
    setChoice({ focus: f, selKey });
    setPan({ key: '', x: 0, y: 0 });
  };

  return (
    <div
      className="plan"
      data-testid="plan-view"
      role="region"
      aria-label="Marina map"
      aria-description={MAP_KEYBOARD_HELP}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.target instanceof SVGElement) event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const direction = keyboardPanDirection(event);
        if (!direction) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const step = KEYBOARD_PAN_PX / Math.min(rect.width / view.w, rect.height / view.h);
        setPan((previous) => {
          const current = previous.key === panKey ? previous : { x: 0, y: 0 };
          return {
            key: panKey,
            x: Math.max(ALL.x - view.w, Math.min(ALL.x + ALL.w, baseView.x + current.x + direction[0] * step)) - baseView.x,
            y: Math.max(ALL.y - view.h, Math.min(ALL.y + ALL.h, baseView.y + current.y + direction[1] * step)) - baseView.y,
          };
        });
      }}
    >
      <div className="plan-toolbar" role="group" aria-label="Plan zoom">
        <button type="button" className="plan-chip" aria-pressed={focus.kind === 'all'} onClick={() => choose({ kind: 'all' })}>
          All docks
        </button>
        {DOCKS.map((d) => (
          <button key={d} type="button" className="plan-chip" aria-pressed={focus.kind === 'dock' && focus.dock === d} onClick={() => choose({ kind: 'dock', dock: d })}>
            <span className="sr-only">Zoom to dock </span>
            {d}
          </button>
        ))}
      </div>
      <svg className="plan-svg" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-testid="plan-svg">
        <rect className="plan-water" x={ALL.x - 2000} y={ALL.y - 2000} width={ALL.w + 4000} height={ALL.h + 4000} />
        {SITE.land.map((l) => (
          <path key={l.id} className="plan-land" d={[path(l.ring), ...l.holes.map(path)].join(' ')} fillRule="evenodd" />
        ))}
        {Object.entries(SITE.headwalks).map(([id, h]) => (
          <polyline key={id} className="plan-headwalk" points={ring(h.line)} />
        ))}
        {SITE.slips.map((g) => {
          const p = slipPresence(fx, s, g.id);
          const hull = hullForSlip(fx, s, g.id);
          const issue = latestIssueForSlip(s, g.id);
          const review = issue !== null && issue.state !== 'resolved';
          return (
            <g key={g.id} className="plan-slip" data-slip={g.id} data-state={p.current} data-review={review || undefined} data-selected={g.id === selectedId || undefined} onClick={() => select(g.id)}>
              <polygon className="plan-berth" points={ring(g.corners)} />
              {hull ? <polygon className={`plan-hull${hull.stale ? ' is-stale' : ''}`} points={ring(placementFootprint(placeBoat(g, hull.lengthFt, hull.beamFt)))} /> : null}
              {zoomed ? (
                <text className="plan-label" x={g.outer[0]} y={-g.outer[1]} textAnchor="middle" dominantBaseline="middle">
                  {g.id.slice(2)}
                </text>
              ) : null}
            </g>
          );
        })}
        {selectedId && slipGeom(selectedId) ? (
          <polygon className="plan-selected" points={ring(slipGeom(selectedId)!.corners)} />
        ) : null}
      </svg>
      {selectedId ? (
        <p className="plan-marker data" aria-hidden="true" data-testid="plan-marker">
          {markerLabel(fx, s, selectedId, target?.via === 'away-vessel' ? 'away-vessel' : 'slip')}
        </p>
      ) : null}
      <ul className="plan-legend body-sm" aria-label="Plan legend">
        <li><span className="key key-present" aria-hidden="true" />Present</li>
        <li><span className="key key-empty" aria-hidden="true" />Empty</li>
        <li><span className="key key-unknown" aria-hidden="true" />Unknown (not empty)</li>
        <li><span className="key key-review" aria-hidden="true" />Needs review</li>
      </ul>
    </div>
  );
}
