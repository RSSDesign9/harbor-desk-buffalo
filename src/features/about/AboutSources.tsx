import { useRef, type ReactNode } from 'react';
import { useAppState } from '../../app/AppStore.tsx';
import './about.css';

function Reference({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a>;
}

/** Native dialog keeps long-form source reading and keyboard focus together; closing restores the opener. */
export function AboutSources({ variant }: { variant: 'topbar' | 'footer' | 'demo' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const state = useAppState();
  const sources = state?.fixtures.sources.filter((s) => s.id.startsWith('SRC-')) ?? [];
  return <>
    <button className={variant === 'demo' ? 'about-trigger demo-data' : variant === 'topbar' ? 'about-trigger btn btn-ghost' : 'about-trigger link-btn'} type="button" aria-haspopup="dialog" onClick={() => {
      dialog.current?.showModal();
      heading.current?.focus();
    }}>{variant === 'demo' ? 'Demo data' : variant === 'topbar' ? 'About' : 'About / Sources'}</button>
    <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title">
      <header className="about-header">
        <h2 id="about-title" ref={heading} tabIndex={-1}>About Harbor Desk</h2>
        <button type="button" className="btn btn-secondary" onClick={() => dialog.current?.close()}>Close</button>
      </header>
      <div className="about-body">
        <p>Harbor Desk is an independent portfolio concept set on the Buffalo River. There is no partnership, endorsement, operator deployment or demonstrated customer impact.</p>
        <h3>What this demo represents</h3>
        <p>The 126 slips, A–E dock names, numbering and berth dimensions are design assumptions, not verified marina capacity. Buildings, water boundaries and surrounding geometry are approximate; boats ashore and buildings are scenery, not records. This is not a survey or navigation tool.</p>
        <p>All vessels, observations, evidence images, staff actions and history are fictional. The scenario takes place on 15 July 2026; fixtures were generated on 14 November 2026. A “verified” decision means the viewer reviewed simulated staff evidence.</p>
        <p>There are no camera feeds or functioning AI recognition. Possible matches are scripted, not measured model performance. Document review is simulated metadata, not an automated registration or insurance compliance determination. Dock checks stay in this browser; no one is contacted.</p>
        <h3>Reading the source labels</h3>
        <dl className="source-labels">
          <dt>DOC</dt><dd>Documented source — linked evidence with a date where known. It does not guarantee present accuracy.</dd>
          <dt>ASSUME</dt><dd>Design assumption — generated slips, inferred placement or approximate dimensions.</dd>
          <dt>SIM</dt><dd>Simulated — fictional records, evidence and decisions, including staff verification.</dd>
          <dt>FIELD</dt><dd>Field validation needed — current services or operating details have not been checked on site.</dd>
        </dl>
        <h3>Geography and workflow references</h3>
        <p>Sources were reviewed for this build on 14 November 2026. Historical service labels do not establish current availability or operating policy.</p>
        <ul className="source-list">{sources.map((s) => <li key={s.id}>
          <strong>{s.url ? <Reference href={s.url}>{s.title}</Reference> : s.title}</strong>
          <span className="source-date">{s.date ?? 'Publication date not recorded'} · {s.provenance}</span>
          <p>{s.caveats}</p>
        </li>)}</ul>
        <h3>Assets and credits</h3>
        <p>Dock geometry © <Reference href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</Reference>, available under the <Reference href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License</Reference>. The ESD map is a dated reference and is not reproduced here.</p>
        <p>Boat models, materials, evidence renders, lighthouse mark and vessel icons are authored for this concept. No third-party model, photograph, map tile or Google-extracted mesh is loaded.</p>
        <p>Commissioner (Kostas Bartsokas), Work Sans (Wei Huang) and Atkinson Hyperlegible Mono (Braille Institute) are served locally under the SIL Open Font License: <Reference href="/fonts/Commissioner-OFL.txt">Commissioner</Reference>, <Reference href="/fonts/WorkSans-OFL.txt">Work Sans</Reference>, <Reference href="/fonts/AtkinsonHyperlegibleMono-OFL.txt">Atkinson Hyperlegible Mono</Reference>. <Reference href="/THIRD-PARTY-NOTICES.txt">Bundled asset and software credits</Reference>.</p>
        <h3>What a real pilot would require</h3>
        <p>Operator research and consent; a surveyed slip plan and current service checks; authorized vessel and agreement records; camera placement and privacy review; representative evaluation of recognition errors; human review, secure access, retention rules and a shared audit trail. None of these has been validated by this concept.</p>
      </div>
    </dialog>
  </>;
}
