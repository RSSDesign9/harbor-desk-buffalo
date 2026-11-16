/**
 * T07 component foundation gallery (`/?ui=primitives`). A QA surface for visual and keyboard inspection,
 * not a product screen. Content is placeholder copy about the demo; no workflow is wired here.
 */
import { useState, type ReactNode } from 'react';
import { useAppState } from '../../app/AppStore.tsx';
import { datasetSummary } from '../../domain/selectors.ts';
import { activeSession } from '../../domain/store.ts';
import { useAnnounce } from '../Announcer.tsx';
import { Button, IconButton } from '../Button.tsx';
import { Checkbox, SearchField, TextField } from '../Fields.tsx';
import { VesselGlyph } from '../icons.tsx';
import { Lockup } from '../Lockup.tsx';
import { EmptyState, KpiTile, Notice, ProvenanceTag, StatusPill } from '../Status.tsx';
import { SegmentedControl, Tabs } from '../Tabs.tsx';
import './gallery.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="g-section" aria-labelledby={`g-${title}`}>
      <h2 className="label" id={`g-${title}`}>
        {title}
      </h2>
      <div className="g-row">{children}</div>
    </section>
  );
}

function Primitives({ theme }: { theme: 'dark' | 'light' }) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [ack, setAck] = useState(false);
  const [tab, setTab] = useState('slips');
  const [view, setView] = useState<'overview' | 'dock' | 'plan'>('overview');
  const announce = useAnnounce();
  const state = useAppState();
  const summary = state ? datasetSummary(state.fixtures, activeSession(state)) : null;
  const t = theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="g-theme" data-theme={theme}>
      <h1 className="g-theme-title">{t} theme{theme === 'light' ? ' · chart mode' : ' · default'}</h1>

      <Section title={`${t} · Brand and type`}>
        <div className="panel g-stack">
          <Lockup />
          <p className="object-name">Slip B-12</p>
          <p className="panel-title">Assigned vessel</p>
          <p>Body text in Work Sans 400. Simulated roster, 113 vessels. Slip count assumed; survey pending.</p>
          <p className="body-sm secondary">Secondary text (body-sm) carries essential detail.</p>
          <p className="label">Label · Commissioner 600, flare off</p>
          <p className="data">09:12 · 29.0 ft · B-12</p>
          <p className="data-lg">126</p>
          <p className="body-sm decorative-hint">Decorative hint only (text-muted is not AA on glass).</p>
        </div>
      </Section>

      <Section title={`${t} · Buttons`}>
        <div className="panel g-stack">
          <div className="g-inline">
            <Button variant="primary">Review observation</Button>
            <Button variant="secondary">Request dock check</Button>
            <Button variant="ghost">Cancel</Button>
          </div>
          <div className="g-inline">
            <Button variant="primary" disabled>
              Confirm identity &amp; resolve
            </Button>
            <Button variant="secondary" disabled>
              Disabled secondary
            </Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 1500);
              }}
            >
              Save (shows loading)
            </Button>
            <Button variant="secondary" icon="refresh">
              Restart demo
            </Button>
          </div>
          <div className="g-inline">
            <IconButton label="Reset camera" icon="refresh" />
            <IconButton label="Close panel" icon="close" />
            <IconButton label="Search unavailable" icon="search" disabled />
            <span className="g-glyphs" aria-label="Vessel type glyphs">
              <VesselGlyph kind="v-power" label="Powerboat" />
              <VesselGlyph kind="v-sail" label="Sailboat" />
              <VesselGlyph kind="v-trailer" label="Hauled out" />
            </span>
          </div>
        </div>
      </Section>

      <Section title={`${t} · Fields`}>
        <div className="panel g-stack g-narrow">
          <SearchField label={`Search slips and vessels (${t})`} placeholder="Search B-12, Lake Effect, V-021" value={query} onValueChange={setQuery} />
          <TextField label="Note" hint="Local to this demo session. Nothing is sent." placeholder="Optional" />
          <TextField label="Registration suffix" defaultValue="42 A" error="Enter two digits and two letters." />
          <TextField label="Disabled field" disabled defaultValue="Not recorded" />
          <Checkbox
            label="I reviewed the simulated staff evidence for this identity check"
            description="Required before confirming. Demo acknowledgement only."
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <Checkbox label="Disabled option" disabled />
        </div>
      </Section>

      <Section title={`${t} · Navigation`}>
        <div className="panel g-stack g-narrow">
          <SegmentedControl
            label={`Camera view (${t})`}
            value={view}
            onChange={setView}
            options={[
              { id: 'overview', label: 'Overview' },
              { id: 'dock', label: 'Dock B' },
              { id: 'plan', label: 'Plan' },
            ]}
          />
          <Tabs
            label={`Registry (${t})`}
            value={tab}
            onChange={setTab}
            items={[
              { id: 'slips', label: 'Slips', content: <EmptyState eyebrow="No slips match" action={<Button variant="secondary">Clear filters</Button>}>Try a slip ID such as B-12, or clear the dock filter.</EmptyState> },
              { id: 'vessels', label: 'Vessels', content: <EmptyState eyebrow="No vessels in view">Simulated roster, 113 vessels.</EmptyState> },
            ]}
          />
        </div>
      </Section>

      <Section title={`${t} · Status and provenance`}>
        <div className="panel g-stack">
          <div className="g-inline">
            <StatusPill tone="present">Present</StatusPill>
            <StatusPill tone="empty">Empty</StatusPill>
            <StatusPill tone="away">Last confirmed away</StatusPill>
            <StatusPill tone="unknown">Presence unknown</StatusPill>
            <StatusPill tone="offline">Camera offline</StatusPill>
            <StatusPill tone="review">Identity unverified</StatusPill>
            <StatusPill tone="pending">Dock check pending</StatusPill>
            <StatusPill tone="resolved">Resolved</StatusPill>
          </div>
          <div className="g-inline">
            <span className="body-sm">Provenance (hover or focus):</span>
            <ProvenanceTag value="DOC" />
            <ProvenanceTag value="ASSUME" />
            <ProvenanceTag value="SIM" />
            <ProvenanceTag value="FIELD" />
          </div>
        </div>
      </Section>

      <Section title={`${t} · Notices and tiles`}>
        <div className="g-stack g-narrow">
          <Notice title="Dock check requested (simulated)">No message was sent. The issue stays open.</Notice>
          <Notice tone="warning" title="Camera C-04 offline since 07:05">Last reported presence is kept; current presence unknown.</Notice>
          <Notice tone="error" title="Evidence image unavailable" live="off" action={<Button variant="ghost">Retry</Button>}>
            The text evidence below still applies.
          </Notice>
          <Button variant="secondary" onClick={() => announce(`Announcement from the ${theme} gallery.`)}>
            Announce to screen reader
          </Button>
        </div>
        <div className="g-inline g-top">
          <KpiTile label="Slips" value={summary?.slips ?? '—'} provenance="ASSUME" />
          <KpiTile label="Vessels" value={summary?.vessels ?? '—'} provenance="SIM" />
          <KpiTile label="Needs review" value={summary?.needsReview ?? '—'} provenance="SIM" />
        </div>
      </Section>
    </div>
  );
}

/** Glass over worst-case scene colours, to inspect composited legibility (T07 contrast rule). */
function GlassStrip() {
  const backdrops = [
    ['White gelcoat', '#ffffff'],
    ['Sand concrete', '#e6e5df'],
    ['Lake sky', '#91a8c3'],
    ['River water', '#4e6d98'],
    ['Midnight', '#011b2b'],
  ] as const;
  return (
    <section className="g-section" aria-labelledby="g-glass">
      <h2 className="label" id="g-glass">
        Dark glass over scene backdrops
      </h2>
      <div className="g-glass">
        {backdrops.map(([name, color]) => (
          <div key={name} className="g-swatch" style={{ background: color }}>
            <div className="panel g-stack" data-theme="dark">
              <span className="label">{name}</span>
              <span>Vessel present · identity unverified</span>
              <span className="body-sm secondary">Camera C-02 · 09:12 · simulated</span>
              <span className="g-inline">
                <StatusPill tone="review">Needs review</StatusPill>
                <ProvenanceTag value="SIM" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Gallery() {
  const [solid, setSolid] = useState(false);
  return (
    <main className="gallery" data-solid-panels={solid}>
      <header className="g-header">
        <Lockup />
        <div>
          <h1 className="panel-title">Component foundation (T07)</h1>
          <p className="body-sm secondary">QA surface for tokens, local fonts and accessible primitives. Not a product screen. All content is simulated.</p>
        </div>
        <Checkbox label="Solid panels (no transparency)" checked={solid} onChange={(e) => setSolid(e.target.checked)} />
      </header>
      <GlassStrip />
      <div className="g-themes">
        <Primitives theme="dark" />
        <Primitives theme="light" />
      </div>
    </main>
  );
}
