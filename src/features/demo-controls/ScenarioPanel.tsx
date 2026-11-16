import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { GUIDED_CHECKPOINTS } from '../../domain/replay.ts';
import type { CheckpointId } from '../../domain/types.ts';
import { formatClock } from '../../domain/time.ts';
import { requestView } from '../../scene/viewRequests.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/icons.tsx';
import { SegmentedControl } from '../../ui/Tabs.tsx';
import { useAnnounce } from '../../ui/Announcer.tsx';
import { stageSteps } from '../slip-review/model.ts';
import { focusSoon } from '../slip-review/useReviewActions.ts';
import { useRegistryUi } from '../registry/RegistryContext.tsx';
import { DayScrubber } from './DayScrubber.tsx';
import './scenario.css';

const LABEL: Record<CheckpointId, string> = { normal: 'Before', uncertain: 'Discrepancy', pending_check: 'Dock check', verification_review: 'Evidence', resolved: 'Resolved' };

/** Demo tooling is separate from the operator's work. Replay never changes the interactive run. */
export function ScenarioPanel() {
  const state = useAppState();
  const store = useStore();
  const ui = useRegistryUi();
  const announce = useAnnounce();
  if (!state || !store) return null;
  const s = activeSession(state);
  const replay = state.view.mode === 'replay' ? state.view : null;
  const steps = stageSteps(state.fixtures, s);
  const view = (checkpoint: CheckpointId) => {
    store.viewReplay(checkpoint);
    ui.setPane('details');
    announce(`Replay: ${LABEL[checkpoint]}. Read-only; your run is unchanged.`);
  };
  const restart = () => {
    store.restart();
    ui.setPane('tasks');
    requestView('dock');
    announce('Demo restarted. No tasks or decisions from your previous run remain.');
    focusSoon('explore-slip-review');
  };
  return (
    <section className="scenario-panel panel" data-mode={replay ? 'replay' : 'interactive'} data-testid="scenario-panel" aria-label="Demo controls">
      <details className="demo-tray" open={replay ? true : undefined}>
        <summary id="scenario-heading"><Icon name="play" size={16} /><span>{replay ? 'Replay · Read-only' : 'Demo controls'}</span><Icon name="chevronRight" size={16} /></summary>
        <div className="demo-tray-body">
          {replay ? <>
            <Button variant="secondary" onClick={() => { store.returnToInteractive(); ui.setPane(state.interactive.selection ? 'details' : 'tasks'); announce('Returned to your unchanged run.'); focusSoon('tasks-tab'); }}>Return to my run</Button>
            <SegmentedControl label="Replay snapshot" value={replay.checkpoint} onChange={view} options={GUIDED_CHECKPOINTS.map((cp) => ({ id: cp, label: LABEL[cp] }))} />
          </> : <div className="demo-actions">
            <Button variant="secondary" onClick={() => view('normal')}>Guided replay</Button>
            <Button variant="ghost" onClick={restart} data-testid="restart-demo">Restart demo</Button>
          </div>}
          <DayScrubber />
          {replay ? <>
            <p className="body-sm secondary">Start from {formatClock(state.fixtures.scenario.checkpoints[replay.checkpoint])}. This replaces your current run.</p>
            <Button variant="primary" onClick={() => { store.startBranch(replay.checkpoint); ui.setPane('details'); announce('A new interactive run started from this stage.'); focusSoon('inspector-title'); }} data-testid="try-this-state">Try this state</Button>
          </> : null}
          <details className="demo-steps"><summary>Review steps</summary>
            <ol className="stage-strip" aria-label="Scenario stages">{steps.map((step) => <li key={step.id} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
              <span className="stage-dot" aria-hidden="true">{step.state === 'done' ? <Icon name="check" size={16} /> : null}</span>
              <span className="stage-label">{step.label}{step.optional ? ' (optional)' : ''}</span>
              <span className="data stage-time">{step.time}</span>
            </li>)}</ol>
          </details>
        </div>
      </details>
    </section>
  );
}
