/** Map-first shell: one task/list/detail workspace at every breakpoint.
 * The scene is independent of the record state; failures fall back to the accessible plan.
 * Desktop and tablet float the workspace beside the map. Mobile uses a resizable bottom sheet.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { LoadingShell } from './LoadingShell.tsx';
import { ScenePoster } from './ScenePoster.tsx';
import { useAppState, useFixtureLoad, useStore } from './AppStore.tsx';
import { railInsetPx, useLayoutMode } from './layout.ts';
import { hasFault } from './faults.ts';
import { usePrefs } from './prefs.ts';
import { canUseWebGL, gpuCapable } from '../scene/webgl.ts';
import { useMapMode } from '../scene/viewRequests.ts';
import { modelFailures, subscribeModelFailures } from '../scene/modelFailures.ts';
import { activeSession } from '../domain/store.ts';
import { activeAssignmentForRequest, operatorSummary, visibleRequests } from '../domain/selectors.ts';
import { formatClock, formatDay, formatZone } from '../domain/time.ts';
import { Icon } from '../ui/icons.tsx';
import { Lockup } from '../ui/Lockup.tsx';
import { SearchField } from '../ui/Fields.tsx';
import { Button, IconButton } from '../ui/Button.tsx';
import { KpiTile, Notice } from '../ui/Status.tsx';
import { useAnnounce } from '../ui/Announcer.tsx';
import { RegistryProvider, useRegistryUi } from '../features/registry/RegistryContext.tsx';
import { RegistryList } from '../features/registry/RegistryList.tsx';
import { Inspector } from '../features/registry/Inspector.tsx';
import { TaskQueue } from '../features/registry/TaskQueue.tsx';
import { parseQuery, slipRows, slipStateLabel, vesselRows, vesselStatus } from '../features/registry/model.ts';
import { ViewControls } from '../features/view/ViewControls.tsx';
import { MapLegend } from '../features/view/MapLegend.tsx';
import { DisplayMenu } from '../features/view/DisplayMenu.tsx';
import { AboutSources } from '../features/about/AboutSources.tsx';
import { ScenarioPanel } from '../features/demo-controls/ScenarioPanel.tsx';
import { RequestCard } from '../features/assign/RequestCard.tsx';
import { focusSoon } from '../features/slip-review/useReviewActions.ts';
import '../features/registry/registry.css';
import './workspace.css';

// The 3D scene and the plan are code-split so the shell paints before geometry or three.js download.
const loadScene = () => import('../scene/SceneRoot.tsx');
const loadPlan = () => import('../features/plan/PlanView.tsx');

const STORAGE_NOTICE: Record<string, string> = {
  corrupt: 'Saved demo data was unreadable. Started fresh.',
  incompatible_version: 'Saved demo was from an older version. Started fresh.',
  inconsistent: 'Saved demo did not match this data. Started fresh.',
  read_failed: 'Saved demo could not be read. Started fresh.',
};

export function Shell() {
  return (
    <RegistryProvider>
      <ShellBody />
    </RegistryProvider>
  );
}

function TopSearch() {
  const state = useAppState();
  const store = useStore();
  const ui = useRegistryUi();
  if (!state || !store) return null;
  const s = activeSession(state);
  const onChange = (q: string) => {
    ui.setQuery(q);
    ui.setListOpen(true);
    ui.setPane('list');
    // Show whichever list has results when the current one has none.
    const nSlips = slipRows(state.fixtures, s, q, ui.filters).length;
    const nVessels = vesselRows(state.fixtures, s, q, ui.filters).length;
    if (ui.tab === 'arrivals') ui.setTab(nSlips === 0 && nVessels > 0 ? 'vessels' : 'slips');
    if (ui.tab === 'slips' && nSlips === 0 && nVessels > 0) ui.setTab('vessels');
    if (ui.tab === 'vessels' && nVessels === 0 && nSlips > 0) ui.setTab('slips');
  };
  return (
    <form
      className="top-search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = parseQuery(ui.query);
        const fx = state.fixtures;
        let sel: { kind: 'slip' | 'vessel'; id: string } | null;
        if (q.slipId && fx.slips.some((x) => x.id === q.slipId)) sel = { kind: 'slip', id: q.slipId };
        else if (q.vesselId && fx.vessels.some((x) => x.id === q.vesselId)) sel = { kind: 'vessel', id: q.vesselId };
        else {
          const slips = slipRows(fx, s, ui.query, ui.filters);
          const vessels = vesselRows(fx, s, ui.query, ui.filters);
          sel = slips.length + vessels.length === 1 ? (slips[0] ? { kind: 'slip', id: slips[0].id } : { kind: 'vessel', id: vessels[0]!.id }) : null;
        }
        if (sel) {
          store.dispatch({ type: 'select', selection: sel });
          ui.setPane('details');
        }
      }}
    >
      <SearchField label="Search slips and vessels" placeholder="Slip, vessel or ID" value={ui.query} onValueChange={onChange} />
    </form>
  );
}

type MapStatus = { status: 'ok' } | { status: 'lost' } | { status: 'failed'; geometry: boolean };

function useModelFailures() {
  return useSyncExternalStore(subscribeModelFailures, modelFailures, () => 0);
}

function ShellBody() {
  const mode = useLayoutMode();
  const prefs = usePrefs();
  const [webgl] = useState(() => !hasFault('webgl-unsupported') && canUseWebGL());
  const [capableGpu] = useState(() => webgl && gpuCapable());
  const mapMode = useMapMode();
  // React caches a rejected lazy import; a new lazy() per attempt lets “Try again” refetch a failed chunk.
  const [SceneRoot, setSceneRoot] = useState(() => lazy(loadScene));
  const [PlanView, setPlanView] = useState(() => lazy(loadPlan));
  const [sceneKey, setSceneKey] = useState(0);
  const [map3d, setMap3d] = useState<MapStatus>({ status: 'ok' });
  const [planFailed, setPlanFailed] = useState<{ geometry: boolean } | null>(null);
  const load = useFixtureLoad();
  const state = useAppState();
  const store = useStore();
  const ui = useRegistryUi();
  const announce = useAnnounce();
  const failures = useModelFailures();
  const session = state ? activeSession(state) : null;
  const summary = state && session ? operatorSummary(state.fixtures, session) : null;

  // Deep link: ?select=B12 / V-021. Unknown IDs show a recoverable notice instead of a blank inspector.
  const [deepLink] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('select');
    if (!raw || !state) return { valid: null, invalid: null };
    const q = parseQuery(raw);
    if (q.slipId && state.fixtures.slips.some((x) => x.id === q.slipId)) return { valid: { kind: 'slip' as const, id: q.slipId }, invalid: null };
    if (q.vesselId && state.fixtures.vessels.some((x) => x.id === q.vesselId)) return { valid: { kind: 'vessel' as const, id: q.vesselId }, invalid: null };
    return { valid: null, invalid: raw };
  });
  const [invalidSelection, setInvalidSelection] = useState<string | null>(deepLink.invalid);
  useEffect(() => {
    if (deepLink.valid && store) store.dispatch({ type: 'select', selection: deepLink.valid });
  }, [deepLink, store]);
  // Any real selection supersedes the invalid-link notice.
  useEffect(
    () =>
      store?.subscribe(() => {
        if (store.getState().interactive.selection) setInvalidSelection(null);
      }),
    [store],
  );

  // Announce selection results politely (the canvas and plan are aria-hidden). Camera movement is never announced.
  const selKey = session?.selection ? `${session.selection.kind}:${session.selection.id}` : '';
  const selectionText = useMemo(() => {
    if (!state || !session?.selection) return '';
    const { kind, id } = session.selection;
    if (kind === 'slip') return `Slip ${id} selected. ${slipStateLabel(state.fixtures, session, id)}.`;
    const v = state.fixtures.vessels.find((x) => x.id === id);
    return v ? `${v.name} selected. ${vesselStatus(state.fixtures, session, id).label}.` : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey]);
  useEffect(() => {
    if (selectionText) announce(selectionText);
  }, [selectionText, announce]);

  // A new selection opens Details; back navigation retains the selected record.
  const hasDetails = Boolean(session?.selection) || invalidSelection !== null;
  const pane = ui.paneFor(selKey, hasDetails);
  const railOpen = mode === 'mobile' || ui.railOpen;
  const [requestId, setRequestId] = useState<string | undefined>();
  const pendingRequests = state && session ? visibleRequests(state.fixtures, session).filter((r) => !activeAssignmentForRequest(session, r.id)).length : 0;
  const taskCount = (summary?.needsAttention ?? 0) + pendingRequests;
  // Keep list position when inspecting a record. Each detail starts at its own top.
  const railBody = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  const scrollKey = pane === 'details' ? `details:${selKey}` : pane === 'list' ? `list:${ui.tab}` : pane;
  useLayoutEffect(() => {
    if (railBody.current) railBody.current.scrollTop = scrollPositions.current[scrollKey] ?? 0;
  }, [scrollKey, mode]);

  // ---------- map region ----------
  // Small screens: the 3D dock map when the GPU is capable (or the user chose 3D), the flat plan otherwise.
  const mobile3d = prefs.mobileView === '3d' || (prefs.mobileView === 'auto' && capableGpu);
  const want3d = webgl && (mode !== 'mobile' || mobile3d);
  const use3d = want3d && map3d.status === 'ok';
  const retry3d = () => {
    setSceneRoot(() => lazy(loadScene));
    setSceneKey((k) => k + 1);
    setMap3d({ status: 'ok' });
    announce('Restarting the 3D view.');
  };
  const retryPlan = () => {
    setPlanView(() => lazy(loadPlan));
    setPlanFailed(null);
  };
  const isGeometry = (e: Error) => e.name === 'SiteGeometryError' || /Map geometry failed/.test(e.message);
  const mapRegion = use3d ? (
    // Distinct keys: the 3D and plan boundaries must never share an instance (and its caught error).
    <ErrorBoundary key={`map-3d-${sceneKey}`} region="3D view" fallback={() => null} onError={(e) => setMap3d({ status: 'failed', geometry: isGeometry(e) })}>
      <Suspense fallback={<LoadingShell label="Loading 3D marina view…" />}>
        <SceneRoot
          key={sceneKey}
          rightInsetPx={railInsetPx(mode, railOpen)}
          // The opening shot lands where Reset returns: Dock B, or the dock map on a small screen.
          restingPreset={mode === 'mobile' ? 'map' : 'dock'}
          // Mobile canvas occupies its own grid row; the sheet does not overlap it.
          onContextLost={() => {
            setMap3d({ status: 'lost' });
            announce('3D view stopped. The plan shows the same records.');
          }}
        />
      </Suspense>
      <ScenePoster />
    </ErrorBoundary>
  ) : planFailed ? null : (
    <ErrorBoundary key="map-plan" region="Plan" fallback={() => null} onError={(e) => setPlanFailed({ geometry: isGeometry(e) })}>
      <Suspense fallback={<LoadingShell label="Loading plan…" />}>
        <PlanView />
      </Suspense>
    </ErrorBoundary>
  );

  const geometryFailed = (map3d.status === 'failed' && map3d.geometry) || planFailed?.geometry === true;
  const mapNotices: ReactNode[] = [];
  if (geometryFailed) {
    mapNotices.push(
      <Notice key="geo" tone="warning" title="Map unavailable">
        Map geometry failed its checks, so no map is drawn. The list and the review still work.
      </Notice>,
    );
  } else {
    if (want3d && map3d.status === 'failed')
      mapNotices.push(
        <Notice key="3d" tone="warning" title="3D view unavailable" action={<Button variant="secondary" onClick={retry3d}>Try again</Button>}>
          It failed to load. The plan shows the same records.
        </Notice>,
      );
    if (want3d && map3d.status === 'lost')
      mapNotices.push(
        <Notice key="lost" tone="warning" title="3D view stopped" action={<Button variant="secondary" onClick={retry3d}>Restart 3D view</Button>}>
          The browser lost its graphics context. The plan shows the same records.
        </Notice>,
      );
    if (!webgl && mode !== 'mobile')
      mapNotices.push(
        <Notice key="nogl" title="3D view unavailable">
          This browser has no WebGL. The plan and list show the same records.
        </Notice>,
      );
    if (planFailed)
      mapNotices.push(
        <Notice key="plan" tone="warning" title="Plan unavailable" action={<Button variant="secondary" onClick={retryPlan}>Try again</Button>}>
          It failed to load. The list and the review still work.
        </Notice>,
      );
  }
  if (use3d && failures > 0)
    mapNotices.push(
      <Notice key="model" tone="warning" title="Some boat models failed to build">
        Plain grey shapes stand in.
      </Notice>,
    );

  // ---------- pieces ----------
  const simTime = session ? (
    <span className="sim-time" aria-label={`${state?.view.mode === 'replay' ? 'Replay' : 'Simulation'} time ${formatDay(session.clock)} ${formatClock(session.clock)} ${formatZone(session.clock)}`}>
      <span className="label">{state?.view.mode === 'replay' ? 'Replay' : 'Demo'}</span>
      <span className="data">
        <span className="sim-day">{formatDay(session.clock)} · </span>
        {formatClock(session.clock)} {formatZone(session.clock)}
      </span>
    </span>
  ) : null;

  const topbar = (
    <header className="topbar panel">
      <Lockup />
      <span className="topbar-place secondary">Buffalo River · Independent concept</span>
      <TopSearch />
      <span className="topbar-right">
        {simTime}
        <AboutSources variant="demo" />
      </span>
      <DisplayMenu canUse3d={webgl} use3dOnMobile={mobile3d} mode={mode} />
    </header>
  );

  const tiles = summary ? (
    <div className="summary-zone" aria-label="Marina overview">
      {/* Operator KPIs (T25, PRD F18). Provenance lives in the top-bar marker and the detail rows, not on the tiles. */}
      <KpiTile label="Occupied tonight" value={`${summary.occupancyPct}%`} note={`${summary.occupied} of ${summary.slips} slips`} />
      <KpiTile
        label="Arrived today"
        value={<>{summary.arrivedSoFar}<span className="metric-total"> / {summary.arrivals}</span></>}
        note={`In by ${state ? formatClock(activeSession(state).clock) : ''}`}
        onOpen={() => {
          ui.setTab('arrivals');
          ui.setListOpen(true);
          ui.setPane('list');
        }}
        openLabel="Open the arrivals board"
      />

    </div>
  ) : null;

  const issues = load.issues.filter((i) => i.severity !== 'warning');
  const notices = (
    <div className="notice-zone">
      {load.status === 'fatal' ? (
        <Notice tone="error" title="Demo data failed validation" live="assertive">
          The workflow is disabled so no false records are shown. {load.issues.find((i) => i.severity === 'fatal')?.message}
        </Notice>
      ) : null}
      {load.status === 'degraded' ? (
        <Notice tone="warning" title="Some demo records were set aside">
          {load.removed.length} record(s) failed validation and are hidden. Everything else still works.
          <span className="notice-detail" data-testid="quarantine-detail">
            {issues.slice(0, 4).map((i) => (
              <span key={`${i.collection}:${i.id}:${i.message}`} className="data">
                {i.collection} {i.id ?? ''}: {i.message}
              </span>
            ))}
          </span>
        </Notice>
      ) : null}
      {state?.storage.notice ? <Notice title={STORAGE_NOTICE[state.storage.notice] ?? 'Started fresh.'} /> : null}
      {state?.storage.backend === 'memory' ? <Notice title="Browser storage unavailable">Changes last until this tab closes.</Notice> : null}
      {state?.storage.backend === 'local' && state.storage.lastSaveError ? (
        <Notice title="Changes are no longer being saved">The browser refused to store the demo. Changes last until this tab closes.</Notice>
      ) : null}
      {mapNotices}
    </div>
  );

  const inspector = state ? <Inspector invalidSelection={invalidSelection} onDismissInvalid={() => setInvalidSelection(null)} /> : null;
  const attribution = (
    <footer className="attribution">
      {mode === 'mobile' ? <AboutSources variant="footer" /> : null}
      {mode !== 'mobile' || !state ? <>Dock geometry ©{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        OpenStreetMap contributors
      </a>
      </> : null}
    </footer>
  );
  // The map legend rides in the camera panel on desktop and tablet (one zone, so it cannot collide with
  // another), and floats over the map on mobile, where there is no camera panel.
  const legend = use3d && mapMode ? <MapLegend /> : null;
  const viewControls = use3d ? <ViewControls legend={legend} /> : null;

  const showTasks = () => { ui.setPane('tasks'); focusSoon('tasks-tab'); };
  const back = () => {
    ui.setPane(pane === 'request' ? 'tasks' : ui.returnPane);
    focusSoon(ui.returnPane === 'list' && pane !== 'request' ? 'registry-listbox' : 'tasks-tab');
  };
  const railNav = (
    <nav className="rail-nav" aria-label="Workspace">
      <div className="rail-tabs" role="group" aria-label="Show in panel">
        <button id="tasks-tab" type="button" className="rail-tab" aria-pressed={pane === 'tasks' || pane === 'request' || (pane === 'details' && ui.returnPane === 'tasks')} onClick={showTasks}>
          Tasks <span className="task-count" data-active={taskCount > 0 || undefined}>{taskCount}</span>
        </button>
        <button type="button" className="rail-tab" aria-pressed={pane === 'list' || (pane === 'details' && ui.returnPane === 'list')} onClick={() => { ui.setPane('list'); focusSoon('registry-listbox'); }}>
          Slips &amp; vessels
        </button>
      </div>
      <IconButton
        label={mode === 'mobile' ? ui.sheetExpanded ? 'Collapse sheet' : 'Expand sheet' : railOpen ? 'Hide panel' : 'Show panel'}
        icon="chevronRight"
        className="icon-btn workspace-toggle"
        aria-expanded={mode === 'mobile' ? ui.sheetExpanded : railOpen}
        aria-controls="rail-body"
        onClick={() => mode === 'mobile' ? ui.setSheetExpanded(!ui.sheetExpanded) : ui.setRailOpen(!ui.railOpen)}
      />
    </nav>
  );
  const workspace = state ? (
    <aside className={`rail${mode === 'mobile' ? ' sheet' : ''}`} data-pane={pane} aria-label="Marina workspace">
      {railNav}
      {railOpen && (pane === 'details' || pane === 'request') ? (
        <div className="workspace-back"><button type="button" className="back-link" onClick={back}>
          <Icon name="chevronLeft" size={16} /> Back to {pane === 'request' || ui.returnPane === 'tasks' ? 'tasks' : 'slips & vessels'}
        </button></div>
      ) : null}
      <div className="rail-body" id="rail-body" ref={railBody} hidden={!railOpen} onScroll={(event) => { scrollPositions.current[scrollKey] = event.currentTarget.scrollTop; }}>
        {mode === 'mobile' ? notices : null}
        <div className="workspace-view" hidden={pane !== 'tasks'}>
          <TaskQueue onRequest={(id) => { setRequestId(id); ui.setPane('request'); focusSoon('request-title'); }} />
          {mode === 'mobile' ? tiles : null}
        </div>
        <div className="workspace-view" hidden={pane !== 'list'}><RegistryList /></div>
        {pane === 'details' ? inspector : null}
        {pane === 'request' ? <RequestCard requestId={requestId} /> : null}
      </div>
      {mode === 'mobile' ? <div className="workspace-footer"><ScenarioPanel /></div> : null}
    </aside>
  ) : null;

  return (
    <div className="app" data-layout={mode} data-map={use3d ? '3d' : 'plan'} data-rail={railOpen ? 'open' : 'closed'} data-sheet={ui.sheetExpanded ? 'full' : 'half'}>
      <div className="scene-layer">{mapRegion}{mode === 'mobile' ? legend : null}</div>
      {topbar}
      {mode !== 'mobile' ? <>{tiles}{notices}</> : null}
      {workspace}
      {mode !== 'mobile' ? (
        <div className="bottom-left-zone">{state ? <ScenarioPanel /> : null}{attribution}</div>
      ) : <div className="persistent-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>}
      {viewControls}
    </div>
  );
}
