/**
 * Inspector step 4 (PRD §6): the slip-review workflow for the selected slip.
 *   normal → scenario control to show the 09:12 observation
 *   uncertain / pending → observation evidence, “Review observation”, “Request dock check”
 *   review open → comparison, staff evidence (or the scenario control that loads it), acknowledgment, confirm, back
 *   resolved → resolution summary, retained original observation, activity trail
 * In a guided-replay snapshot everything is shown read-only and no command can be issued.
 */
import { useState, type ReactNode } from 'react';
import { Button } from '../../ui/Button.tsx';
import { Checkbox } from '../../ui/Fields.tsx';
import { Icon } from '../../ui/icons.tsx';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { slipReview, type EvidenceImage, type SlipReviewModel } from './model.ts';
import { FOCUS, useReviewActions } from './useReviewActions.ts';
import './slip-review.css';

/** An evidence still that degrades to its text: a missing or failed image never hides the evidence or the actions. */
function EvidenceFigure({ image, caption, variant, testId }: { image: EvidenceImage; caption: string; variant: 'camera' | 'staff'; testId: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = image.src !== null && failedSrc === image.src;
  return (
    <figure className={`evidence evidence-${variant}`} data-testid={testId}>
      {image.src && !failed ? (
        <img src={image.src} srcSet={image.srcSet ?? undefined} width={480} height={300} alt={image.alt} decoding="async" onError={() => setFailedSrc(image.src)} />
      ) : (
        <div className="evidence-missing" role="img" aria-label={`${image.alt} Image unavailable.`} data-testid={`${testId}-missing`}>
          <Icon name="alert" size={16} />
          <span>{image.src ? 'Image unavailable' : 'No image stored'} · text evidence below</span>
        </div>
      )}
      <figcaption className="label">{caption}</figcaption>
    </figure>
  );
}

function ScenarioControl({ children }: { children: ReactNode }) {
  return (
    <div className="scenario-control">
      <p className="label scenario-control-label">
        Scenario control
      </p>
      {children}
    </div>
  );
}

function Trail({ items }: { items: SlipReviewModel['trail'] }) {
  if (items.length === 0) return null;
  return (
    <details className="inspector-more review-block">
      <summary>Activity history</summary>
      <ol className="trail" data-testid="activity-trail">
        {items.map((i) => (
          <li key={i.refId} data-kind={i.kind}>
            <time className="data">{i.at}</time>
            <div>
              <p className="trail-title">{i.title}</p>
              <p className="body-sm secondary">{i.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Comparison({ m }: { m: NonNullable<SlipReviewModel['comparison']> }) {
  return (
    <table className="comparison" data-testid="comparison">
      <caption className="sr-only">Observation compared with registry records</caption>
      <thead>
        <tr>
          <td />
          <th scope="col">Observed</th>
          <th scope="col">
            {m.assignedName}
            <span className="col-note">assigned</span>
          </th>
          <th scope="col">
            {m.candidateName}
            <span className="col-note">possible match</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {m.rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.observed}</td>
            <td>{r.assigned}</td>
            <td>{r.candidate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SlipReview({ slipId }: { slipId: string }) {
  const state = useAppState();
  const store = useStore();
  const s = state ? activeSession(state) : null;
  const m = state && s ? slipReview(state.fixtures, s, slipId) : null;
  const act = useReviewActions(m?.issue?.id ?? null);
  if (!state || !store || !s || !m) return null;
  const readOnly = state.view.mode === 'replay';

  const readOnlyNote = readOnly ? (
    <p className="readonly-note body-sm" data-testid="readonly-note">
      <Icon name="info" size={16} /> Read-only. Use “Try this state” to interact.
    </p>
  ) : null;

  // ---- normal: empty but assigned ----
  if (!m.issue) {
    if (!m.normal) return null;
    return (
      <section className="inspector-section review" aria-labelledby={FOCUS.review} data-stage="normal" data-testid="slip-review">
        <h3 className="label" id={FOCUS.review} tabIndex={-1}>
          Slip review
        </h3>
        <p className="body-sm">
          No open issue. {m.normal.assignedName} {m.normal.departedAt ? `departed at ${m.normal.departedAt} (staff log)` : 'is not confirmed here'}.
        </p>
        {readOnly ? (
          readOnlyNote
        ) : (
          <ScenarioControl>
            <Button variant="secondary" block onClick={() => act('advance')}>
              Show dock-walk discrepancy
            </Button>
          </ScenarioControl>
        )}
      </section>
    );
  }

  const obs = m.observation!;
  const resolved = m.issue.state === 'resolved';

  // ---- resolved ----
  if (resolved && m.resolution) {
    const r = m.resolution;
    return (
      <section className="inspector-section review" aria-labelledby={FOCUS.resolution} data-stage="resolved" data-testid="slip-review">
        <h3 className="label" id={FOCUS.resolution} tabIndex={-1}>
          Resolution
        </h3>
        <p className="observation-headline">
          <span data-testid="resolution-headline">
            {r.vesselName} confirmed at {slipId}
          </span>
        </p>
        <dl className="facts" aria-label="Resolution">
          <div className="fact">
            <dt>Identity</dt>
            <dd>
              <span>
                Confirmed {r.decidedAt} by {r.actorLabel}
              </span>
            </dd>
          </div>
          <div className="fact">
            <dt>Agreement</dt>
            <dd>
              <span data-testid="resolution-agreement">{r.agreement}</span>
            </dd>
          </div>
        </dl>
        <p className="body-sm secondary" data-testid="candidate-note">
          {r.candidateNote}
        </p>
        <details className="inspector-more" data-testid="original-observation">
          <summary>Original observation</summary>
          <EvidenceFigure image={obs.image} caption={`${obs.sourceLabel} · ${obs.at} · Camera evidence`} variant="camera" testId="camera-evidence" />
          <p className="body-sm">{obs.summary}</p>
          <p className="body-sm secondary">
            Possible match at the time: {obs.possibleMatch?.name ?? 'none'}.
          </p>
        </details>
        <Trail items={m.trail} />
      </section>
    );
  }

  // ---- uncertain / pending / verification review ----
  const taskBlock = m.task ? (
    <div className="task-status" id={FOCUS.taskStatus} tabIndex={-1} data-testid="task-status" role="group" aria-label="Dock check">
      <p className="observation-headline">
        <span>Dock check</span>
        <span className="data">{m.task.id}</span>
      </p>
      <p className="body-sm">Requested {m.task.requestedAt} · no message sent</p>
    </div>
  ) : null;
  const requestButton =
    !readOnly && m.request.allowed ? (
      <Button variant="secondary" block onClick={() => act('request')} data-testid="request-dock-check">
        Request dock check
      </Button>
    ) : null;

  return (
    <section className="inspector-section review" aria-labelledby={FOCUS.review} data-stage={m.stage} data-testid="slip-review">
      <h3 className="label" id={FOCUS.review} tabIndex={-1}>
        Discrepancy review
      </h3>
      {m.dockWalk ? (
        <div className="staff-note" data-testid="dock-walk">
          <p className="body-sm">
            <strong>
              Dock walk · {m.dockWalk.at}
            </strong>
          </p>
          <p className="body-sm">{m.dockWalk.summary}</p>
          <p className="body-sm secondary">Staff report · Recorded in this demo</p>
        </div>
      ) : null}
      {!m.reviewOpen && !readOnly ? <div className="review-actions">
        <Button variant="primary" block id={FOCUS.reviewButton} onClick={() => act('open')}>{m.staffEvidence ? 'Review staff evidence' : 'Review observation'}</Button>
        {requestButton}
      </div> : null}
      <EvidenceFigure image={obs.image} caption={`${obs.sourceLabel} · ${obs.at} · Camera evidence`} variant="camera" testId="camera-evidence" />
      {m.camera?.note ? (
        <p className="body-sm source-note" data-testid="camera-note">
          <Icon name="offline" size={16} /> {m.camera.note}
        </p>
      ) : null}
      <details className="inspector-more evidence-details"><summary>What the camera can establish</summary>
      <div className="observed-split" data-testid="camera-evidence-text">
        <div>
          <p className="label">Observed</p>
          <ul className="body-sm">
            {obs.observed.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Not established</p>
          <ul className="body-sm">
            {obs.notEstablished.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      </details>

      {taskBlock}

      {!m.reviewOpen ? (
        readOnly ? readOnlyNote : null
      ) : (
        <section className="review-block evidence-review" aria-labelledby={FOCUS.evidenceReview} data-testid="evidence-review">
          <h4 className="label" id={FOCUS.evidenceReview} tabIndex={-1}>
            Evidence review
          </h4>
          {m.comparison ? <Comparison m={m.comparison} /> : null}

          <section className="review-block" aria-labelledby={FOCUS.staffEvidence}>
            <h4 className="label" id={FOCUS.staffEvidence} tabIndex={-1}>
              Staff evidence
            </h4>
            {m.staffEvidence ? (
              <div className="staff-card" data-theme="light" data-testid="staff-evidence">
                <EvidenceFigure image={m.staffEvidence.image} caption="Staff photo" variant="staff" testId="staff-photo" />
                <p className="body-sm">
                  <strong>
                    {m.staffEvidence.actorLabel} · {m.staffEvidence.at}
                  </strong>
                </p>
                <p className="body-sm">{m.staffEvidence.summary}</p>
              </div>
            ) : (
              <div className="no-evidence" data-testid="no-staff-evidence">
                <p className="body-sm">
                  <strong>No staff evidence yet.</strong> Camera evidence alone cannot confirm identity.
                </p>
                {!readOnly ? (
                  <ScenarioControl>
                    <Button variant="secondary" block onClick={() => act('load')} data-testid="load-result">
                      Load simulated dock-check result
                    </Button>
                  </ScenarioControl>
                ) : null}
              </div>
            )}
          </section>

          {readOnly ? (
            readOnlyNote
          ) : (
            <div className="confirm-block">
              <Checkbox
                checked={m.acknowledged}
                disabled={!m.staffEvidence}
                onChange={(e) => {
                  if (m.staffEvidence) store.dispatch({ type: 'acknowledgeEvidence', evidenceId: m.staffEvidence.id, value: e.currentTarget.checked });
                }}
                label={
                  m.staffEvidence
                    ? `I reviewed the staff evidence: name and registration ending ${m.staffEvidence.registrationSuffix ?? '—'} match ${m.staffEvidence.vesselName}’s record.`
                    : 'I reviewed the staff evidence'
                }
              />
              <Button variant="primary" block disabled={m.confirm.blocker !== null} aria-describedby={m.confirm.hint ? 'confirm-hint' : undefined} onClick={() => act('confirm')} data-testid="confirm-identity">
                Confirm identity &amp; resolve
              </Button>
              {m.confirm.hint ? (
                <p className="body-sm secondary" id="confirm-hint" data-testid="confirm-hint">
                  {m.confirm.hint}
                </p>
              ) : null}
              {requestButton}
              <Button variant="ghost" block onClick={() => act('cancel')}>
                Back to observation
              </Button>
            </div>
          )}
        </section>
      )}
      <Trail items={m.trail} />
    </section>
  );
}
