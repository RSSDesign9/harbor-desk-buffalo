/** Selected record: identity, current status, next action, then supporting details.
 * Presence, assignment and booking eligibility remain distinct domain concepts.
 */
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { MODELLED_DOCKS } from '../../data/docks.ts';
import { activeSession } from '../../domain/store.ts';
import { formatClock } from '../../domain/time.ts';
import { Icon, VesselGlyph } from '../../ui/icons.tsx';
import { Notice, StatusPill } from '../../ui/Status.tsx';
import { SlipReview } from '../slip-review/SlipReview.tsx';
import { slipInspector, vesselInspector, type Fact } from './model.ts';

/** Provenance remains in the model; the persistent Demo data disclosure explains it centrally. */
function Facts({ facts, label }: { facts: Fact[]; label: string }) {
  return (
    <dl className="facts" aria-label={label}>
      {facts.map((f) => (
        <div key={f.label} className="fact">
          <dt>{f.label}</dt>
          <dd>
            <span>{f.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LinkButton({ onClick, children, label }: { onClick: () => void; children: string; label?: string }) {
  return (
    <button type="button" className="link-btn" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

export function Inspector({ invalidSelection, onDismissInvalid }: { invalidSelection: string | null; onDismissInvalid: () => void }) {
  const state = useAppState();
  const store = useStore();
  if (!state || !store) return null;
  const fx = state.fixtures;
  const s = activeSession(state);
  const select = (kind: 'slip' | 'vessel', id: string) => store.dispatch({ type: 'select', selection: { kind, id } });
  const replayBanner =
    state.view.mode === 'replay' ? (
      <p className="replay-banner label" data-testid="replay-banner">
        <Icon name="play" size={16} />
        <span><strong>Guided replay</strong><span className="replay-caption">{formatClock(s.clock)} snapshot · read-only</span></span>
      </p>
    ) : null;

  if (invalidSelection) {
    return (
      <section className="panel inspector" aria-label="Selection">
        <Notice
          tone="warning"
          title={`No slip or vessel “${invalidSelection}”`}
          action={
            <button type="button" className="btn btn-secondary" onClick={onDismissInvalid}>
              Show all slips
            </button>
          }
        >
          Try a slip ID such as B-12 or a vessel ID such as V-021.
        </Notice>
      </section>
    );
  }
  const sel = s.selection;
  if (!sel) return null;

  if (sel.kind === 'slip') {
    const m = slipInspector(fx, s, sel.id, MODELLED_DOCKS);
    if (!m) return null;
    return (
      <section className="panel inspector" aria-labelledby="inspector-title" data-testid="inspector">
        <header className="inspector-head">
          <div className="inspector-title-row">
            <h2 className="object-name" id="inspector-title" tabIndex={-1}>Slip {m.id}</h2>
          </div>
          <p className="inspector-subtitle">{m.subtitle}</p>
          {replayBanner}
        </header>

        <section className="slip-situation" aria-label="Current slip status">
          <p className="observation-headline">
            <StatusPill tone={m.observation.badge.tone}>{m.observation.badge.label}</StatusPill>
            {m.observation.headline !== 'No vessel present' && m.observation.headline !== 'Presence unknown' ? <span>{m.observation.headline}</span> : null}
          </p>
          <dl className="facts">
            <div className="fact"><dt>Assigned vessel</dt><dd>
              {m.assignment.vessel ? <LinkButton onClick={() => select('vessel', m.assignment.vessel!.id)} label={`Open registry record for ${m.assignment.vessel.name}, assigned to ${m.id}`}>{m.assignment.vessel.name}</LinkButton> : 'None'}
            </dd></div>
            <div className="fact"><dt>Booking</dt><dd>{m.summary.find((f) => f.label === 'Bookable')?.value === 'No' ? 'Held by agreement' : 'Availability not assessed'}</dd></div>
          </dl>
          <Facts facts={m.observation.facts.filter((f) => !(f.label === 'Freshness' && f.value === 'Current'))} label="Observation status" />
        </section>

        <SlipReview slipId={m.id} />

        <details className="inspector-more">
          <summary>Assignment &amp; slip details</summary>
          {m.assignment.vessel ? <p className="body-sm secondary">{m.assignment.vessel.summary}</p> : null}
          <Facts facts={m.assignment.facts} label="Agreement" />
          <p className="body-sm secondary slip-dimensions-note">Dimensions and services are approximate, not surveyed.</p>
          <Facts facts={m.slipFacts} label="Slip details" />
          {!m.modelledIn3D ? <p className="body-sm secondary">Dock {m.id[0]} is outlined only in this build; its 3D model arrives with the full layout.</p> : null}
        </details>
      </section>
    );
  }

  const v = vesselInspector(fx, s, sel.id);
  if (!v) return null;
  return (
    <section className="panel inspector" aria-labelledby="inspector-title" data-testid="inspector">
      <header className="inspector-head">
        <div className="inspector-head-top">
          <p className="label">Vessel {v.id}</p>
        </div>
        {replayBanner}
        <h2 className="object-name vessel-name" id="inspector-title" tabIndex={-1}>
          <VesselGlyph kind={v.glyph} />
          {v.name}
        </h2>
      </header>
      <section className="inspector-section" aria-labelledby="sec-location">
        <h3 className="label" id="sec-location">
          Last confirmed activity
        </h3>
        <p className="observation-headline">
          <StatusPill tone={v.location.tone}>{v.location.label}</StatusPill>
        </p>
        {v.locationNote ? <p className="body-sm secondary">{v.locationNote}</p> : null}
        {v.assignedSlipId ? (
          <p className="body-sm">
            <LinkButton onClick={() => select('slip', v.assignedSlipId!)} label={`Open slip ${v.assignedSlipId}`}>{`Open slip ${v.assignedSlipId}`}</LinkButton>
          </p>
        ) : null}
      </section>
      <section className="inspector-section" aria-labelledby="sec-assign">
        <h3 className="label" id="sec-assign">
          Assignment
        </h3>
        <Facts facts={v.assignment} label="Assignment" />
      </section>
      <details className="inspector-more">
        <summary>Vessel specifications &amp; identifiers</summary>
        <Facts facts={v.particulars} label="Particulars" />
        <Facts facts={v.identifiers} label="Identifiers" />
      </details>
      <details className="inspector-more">
        <summary>Document review</summary>
        <Facts facts={v.documents} label="Document review" />
      </details>
    </section>
  );
}
