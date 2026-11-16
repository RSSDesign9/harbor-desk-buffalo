/**
 * Arrivals board (TASKS T31, PRD F21): today's check-ins, expected returns and demo assignments, read at the
 * clock (the interactive run's, or the replay timeline's). A booking says only “due today” until its check-in
 * is logged, and a return shows its expected time only once the departure that carried it was logged, so the
 * board never leaks a later log entry. Vacant slips and their unsold nights follow the same clock.
 */
import { useAppState } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { arrivalsBoard, operatorSummary, mapStatuses, unsoldNights, UNSOLD_HORIZON_NIGHTS } from '../../domain/selectors.ts';
import { formatClock } from '../../domain/time.ts';
import { StatusPill } from '../../ui/Status.tsx';
import '../assign/assign.css';

const KIND: Record<'check-in' | 'return' | 'request', string> = { 'check-in': 'Check-in', return: 'Back from outing', request: 'Demo assignment' };

export function ArrivalsBoard() {
  const state = useAppState();
  if (!state) return null;
  const fx = state.fixtures;
  const s = activeSession(state);
  const rows = arrivalsBoard(fx, s);
  const financial = operatorSummary(fx, s);
  const checkIns = rows.filter((r) => r.kind === 'check-in');
  const arrived = checkIns.filter((r) => r.status === 'arrived').length;
  const vacant = [...mapStatuses(fx, s)].filter(([, st]) => st === 'vacant').map(([id]) => id);
  const unsold = vacant.reduce((n, id) => n + unsoldNights(fx, s, id), 0);
  return (
    <div className="arrivals-board" data-testid="arrivals-board">
      <section className="board-summary" aria-label="Arrival summary">
        <div className="board-progress">
          <p><strong>{arrived}<span> / {checkIns.length}</span></strong> checked in</p>
          <span className="board-asof">As of {formatClock(s.clock)}</span>
        </div>
        <progress value={arrived} max={checkIns.length || 1} aria-label="Today's check-ins" />
        <dl className="board-metrics">
          <div><dt>Vacant tonight</dt><dd>{vacant.length}<span> slips</span></dd></div>
          <div><dt>Unsold · next {UNSOLD_HORIZON_NIGHTS} nights</dt><dd>{unsold}<span> nights</span></dd></div>
        </dl>
      </section>
      <ul className="board-list" aria-label={`Arrivals today, as of ${formatClock(s.clock)}`}>
        {rows.map((r) => (
          <li key={r.key} data-status={r.status}>
            <span className="board-schedule">
              <span className="data board-time">{r.at ? formatClock(r.at) : '—'}</span>
              <span className="data board-slip">{r.slipId ?? '—'}</span>
            </span>
            <span className="board-name">
              {r.vesselName}
              <span className="board-kind">{KIND[r.kind]}</span>
            </span>
            <StatusPill tone={r.status === 'arrived' ? 'present' : r.kind === 'return' ? 'away' : 'pending'}>
              {r.status === 'arrived' ? 'Arrived' : r.kind === 'return' ? 'Expected' : 'Due'}
            </StatusPill>
          </li>
        ))}
      </ul>
      <details className="inspector-more financial-details">
        <summary>Revenue estimates</summary>
        <dl className="facts">
          <div className="fact"><dt>Nightly agreements</dt><dd>${financial.nightlyRevenueUsd.toLocaleString('en-US')}</dd></div>
          <div className="fact"><dt>Value under review</dt><dd>${financial.revenueAtRiskUsd.toLocaleString('en-US')}</dd></div>
        </dl>
        <p className="body-sm secondary">Illustrative rates. Value under review is the full term value of agreements linked to open issues, not a forecast of lost revenue.</p>
      </details>
    </div>
  );
}
