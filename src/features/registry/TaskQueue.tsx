import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { activeAssignmentForRequest, visibleRequests } from '../../domain/selectors.ts';
import { formatClock } from '../../domain/time.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/icons.tsx';
import { useAnnounce } from '../../ui/Announcer.tsx';
import { focusSoon } from '../slip-review/useReviewActions.ts';
import { useRegistryUi } from './RegistryContext.tsx';

/** Unresolved work is counted until it is completed, never merely read. */
export function TaskQueue({ onRequest }: { onRequest: (id: string) => void }) {
  const state = useAppState();
  const store = useStore();
  const ui = useRegistryUi();
  const announce = useAnnounce();
  if (!state || !store) return null;
  const s = activeSession(state);
  const issues = s.issues.filter((issue) => issue.state !== 'resolved');
  const requests = visibleRequests(state.fixtures, s);
  const started = s.issues.some((issue) => issue.slipId === state.fixtures.scenario.slipId);
  const openSlip = (id: string) => {
    store.dispatch({ type: 'select', selection: { kind: 'slip', id } });
    ui.setPane('details');
    focusSoon('inspector-title');
  };
  const explore = () => {
    if (state.view.mode === 'replay') store.returnToInteractive();
    const result = store.dispatch({ type: 'advanceToUncertain' });
    if (!result.ok) return;
    openSlip(state.fixtures.scenario.slipId);
    announce('Discrepancy at B-12. A vessel is present, but its identity is unverified. Review the evidence.');
  };
  return (
    <section className="task-queue" aria-label="Tasks" data-testid="task-queue">
      {!started && state.view.mode !== 'replay' ? (
        <div className="workflow-intro">
          <div className="workflow-symbol"><Icon name="question" /></div>
          <h2>Who’s in B-12?</h2>
          <p>A returning boat needs an identity check. Follow the evidence to resolve a slip discrepancy.</p>
          <Button variant="primary" icon="chevronRight" id="explore-slip-review" onClick={explore}>Explore slip review</Button>
          <span className="workflow-caption">Interactive demo · You make the call</span>
        </div>
      ) : null}
      <div className="task-section">
        <h2>Needs review <span>{issues.length}</span></h2>
        {issues.length === 0 ? <p className="task-empty"><Icon name="check" size={16} />No open reviews</p> : (
          <ul className="task-list">
            {issues.map((issue) => (
              <li key={issue.id}>
                <button className="task-row" type="button" onClick={() => openSlip(issue.slipId)}>
                  <span className="task-indicator"><Icon name={issue.state === 'pending_check' ? 'refresh' : 'question'} /></span>
                  <span><strong>Slip {issue.slipId}</strong><span>{issue.state === 'pending_check' ? 'Dock check pending' : 'Vessel identity needs review'}</span></span>
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {started && issues.length === 0 ? <button type="button" className="link-btn" onClick={() => openSlip(state.fixtures.scenario.slipId)}>View resolved review</button> : null}
      </div>
      <div className="task-section">
        <h2>Incoming requests <span>{requests.filter((r) => !activeAssignmentForRequest(s, r.id)).length}</span></h2>
        {requests.length === 0 ? <p className="task-empty">No incoming requests</p> : (
          <ul className="task-list">
            {requests.map((request) => {
              const assignment = activeAssignmentForRequest(s, request.id);
              return <li key={request.id}>
                <button type="button" className="task-row request-task" onClick={() => onRequest(request.id)}>
                  <span><strong>{request.vesselName}</strong><span>{assignment ? `Assigned to ${assignment.slipId}` : `${formatClock(request.arrivalFrom)}–${formatClock(request.arrivalTo)} · ${request.loa_ft} ft · ${request.nights} nights`}</span></span>
                  <Icon name={assignment ? 'check' : 'chevronRight'} size={16} />
                </button>
              </li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
