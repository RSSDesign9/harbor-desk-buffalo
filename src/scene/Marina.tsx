/**
 * The assumed marina, docks A–E (TASKS T14): decks, fingers, piles, gangways, all 126 selectable berths
 * (empty or not), the boats the observations support, hover/selection outlines and markers. Everything reads the shared domain state; the only write is
 * `select` on a click (never on drag, never from camera movement).
 *
 * Draw-call budget (T16): one structure mesh per dock, one instanced mesh for every pile, ONE pick mesh for all
 * 126 berths (the picked triangle maps back to its slip ID), one instanced mesh for all contact shadows. Hulls
 * stay one mesh each, because each has its own authored geometry and level of detail.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, Euler, Float32BufferAttribute, LineDashedMaterial, Matrix4, Quaternion, Vector3, type InstancedMesh, type LineSegments } from 'three';
import { useAppState, useStore } from '../app/AppStore.tsx';
import { activeSession } from '../domain/store.ts';
import { SITE, slipGeom, type SlipGeom } from '../data/site.ts';
import { frameTarget, markerLabel, slipStateLabel } from '../features/registry/model.ts';
import { MAP_STATUS_LABEL, latestIssueForSlip, mapSlipStatus, mapStatuses, type MapStatus } from '../domain/selectors.ts';
import { STATUS_CODE, berthGeometry, berthMaterial } from './MapLayer.tsx';
import { useAssignDragActive, useAssignDragHover } from '../features/assign/dragStore.ts';
import { VERDICT_LABEL, verdictsFor, type FitResult, type Verdict } from '../domain/fit.ts';
import { arrivingSlipsAt } from './Traffic.tsx';
import { useMapMode } from './viewRequests.ts';
import { hullForSlip, nameBoardForSlip } from './hulls.ts';
import { DECK_TOP_Y, placeBoat, placementFootprint } from './layout.ts';
import { DOCK_PLANS, LAND_TOP } from './marina.ts';
import { useOverlaysVisible } from './overlays.ts';
import { buildDockStructure, buildGangway, buildPile } from './assets/dock.ts';
import { contactShadowMaterial, surfaceMaterial } from './materials.ts';
import { slipPresence } from '../domain/selectors.ts';
import type { BoatPlacement } from './layout.ts';
import { Boat } from './Boat.tsx';
import { debugEnabled } from './DebugBridge.tsx';
import { TOKEN_COLORS as T } from './palette.ts';
import { OVERLAY_LAYER } from './PostAO.tsx';
import { mooringLines, ropePath } from './mooring.ts';
import { MeshBuilder, shade } from './assets/mesh.ts';
import { F } from './assets/finishes.ts';
import { dockPlan } from './marina.ts';

/** Pixels the pointer may travel between down and up and still count as a click (not a drag). */
export const CLICK_TOLERANCE_PX = 5;

const dockSlips = SITE.slips;
const ringY = (s: SlipGeom, y: number): [number, number, number][] => [...s.corners, s.corners[0]!].map(([e, n]) => [e, y, -n]);
const noRaycast = () => null;

function Decking() {
  const { structures, gangways, pileMatrices } = useMemo(() => {
    const structures = DOCK_PLANS.map((d) => ({
      dock: d.dock,
      geo: buildDockStructure({ deck: d.deck, fingers: d.fingers, pedestals: d.pedestals, cleats: d.cleats, deckTop: d.deckTop, fingerTop: DECK_TOP_Y, quay: d.kind === 'fixed' }),
    }));
    const gangways = DOCK_PLANS.flatMap((d) =>
      d.gangway ? [{ dock: d.dock, geo: buildGangway([d.gangway.head[0], LAND_TOP + 0.3, -d.gangway.head[1]], [d.gangway.foot[0], DECK_TOP_Y + 0.05, -d.gangway.foot[1]]) }] : [],
    );
    const pileMatrices = DOCK_PLANS.flatMap((d) => d.piles).map((p) => new Matrix4().makeTranslation(p[0], 0, -p[1]));
    return { structures, gangways, pileMatrices };
  }, []);
  const pile = useMemo(() => buildPile(), []);
  const setInstances = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    pileMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  return (
    <group name="dock-structures">
      {structures.map((d) => (
        <mesh key={d.dock} name="dock-structure" userData={{ dock: d.dock }} geometry={d.geo} material={surfaceMaterial()} castShadow receiveShadow />
      ))}
      {gangways.map((g) => (
        <mesh key={g.dock} name="gangway" geometry={g.geo} material={surfaceMaterial()} castShadow receiveShadow raycast={noRaycast} />
      ))}
      <instancedMesh name="piles" ref={setInstances} args={[pile, surfaceMaterial(), pileMatrices.length]} castShadow receiveShadow />
    </group>
  );
}

function Marker({ slip, text, tone }: { slip: SlipGeom; text: string; tone: 'selected' | 'hover' | 'review' }) {
  return (
    <Html position={[slip.centroid[0], 4.5, -slip.centroid[1]]} center zIndexRange={[3, 0]} /* below every panel (z ≥ 4): a marker never covers a control */ style={{ pointerEvents: 'none' }}>
      <div className={`scene-marker scene-marker-${tone}`} aria-hidden="true">
        {text}
      </div>
    </Html>
  );
}


/** Dashed outline around every berth whose presence is unknown (one draw call). Not colour-only: the hover and list say “Presence unknown”. */
function unknownOutline(unknown: ReadonlySet<string>): BufferGeometry {
  const pos: number[] = [];
  for (const s of dockSlips) {
    if (!unknown.has(s.id)) continue;
    s.corners.forEach((p, i) => {
      const q = s.corners[(i + 1) % s.corners.length]!;
      pos.push(p[0], 0.06, -p[1], q[0], 0.06, -q[1]);
    });
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return g;
}

const unknownSlipKey = (state: ReturnType<typeof useAppState>): string => {
  if (!state) return '';
  const session = activeSession(state);
  return dockSlips.filter((s) => slipPresence(state.fixtures, session, s.id).current === 'unknown').map((s) => s.id).join(',');
};
/** Map statuses (T29) as a stable string, so the berth mesh is rebuilt only when one changes. */
const statusKey = (state: ReturnType<typeof useAppState>): string => {
  if (!state) return '';
  const st = mapStatuses(state.fixtures, activeSession(state));
  return dockSlips.map((s) => STATUS_CODE[st.get(s.id) ?? 'vacant']).join('');
};
const CODE_STATUS = Object.fromEntries(Object.entries(STATUS_CODE).map(([k, v]) => [v, k])) as Record<number, MapStatus>;
const berthMeshes = (unknownKey: string, statuses: string, verdictKey: string) => {
  const unknown = new Set(unknownKey ? unknownKey.split(',') : []);
  const status = new Map(dockSlips.map((s, i) => [s.id, CODE_STATUS[Number(statuses[i] ?? 4)] ?? 'vacant']));
  const verdicts = new Map(verdictKey ? verdictKey.split(',').map((kv) => kv.split('=') as [string, Verdict]) : []);
  return { tint: berthGeometry(dockSlips, unknown, status, verdicts), outline: unknownOutline(unknown) };
};

/** Soft patch under every drawn hull, as one instanced mesh. */
function ContactShadows({ placements }: { placements: readonly BoatPlacement[] }) {
  const ref = useRef<InstancedMesh>(null);
  const signature = placements.map((p) => `${p.center[0]},${p.center[1]},${p.lengthM},${p.beamM}`).join('|');
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
    placements.forEach((p, i) => {
      const q = new Quaternion().setFromEuler(new Euler(0, p.yaw, 0)).multiply(flat);
      mesh.setMatrixAt(i, new Matrix4().compose(new Vector3(p.center[0], 0.015, -p.center[1]), q, new Vector3(p.lengthM * 1.14, p.beamM * 1.5, 1)));
    });
    mesh.count = placements.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  // Capacity is fixed at the slip count, so the mesh is never rebuilt as boats come and go.
  return (
    <instancedMesh name="contact-shadows" ref={ref} args={[undefined, contactShadowMaterial(), dockSlips.length]} raycast={noRaycast} renderOrder={1}>
      <planeGeometry />
    </instancedMesh>
  );
}

/**
 * Mooring lines for every settled, confirmed hull, as ONE merged mesh (T33). Rebuilt only when the set of
 * moored boats changes; a boat that leaves takes its lines with it.
 */
function MooringLines({ boats }: { boats: readonly { s: SlipGeom; placement: BoatPlacement }[] }) {
  const signature = boats.map((b) => `${b.s.id}:${b.placement.lengthM.toFixed(2)}:${b.placement.beamM.toFixed(2)}`).join('|');
  const geometry = useMemo(() => {
    const mb = new MeshBuilder();
    const rope = shade(F.rope, 0.8);
    for (const b of boats) {
      const plan = dockPlan(b.s.dock);
      if (!plan) continue;
      for (const line of mooringLines(b.s, b.placement, plan)) mb.tube(ropePath(line), 0.028, 4, rope);
    }
    return mb.triangles > 0 ? mb.build() : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh name="mooring-lines" geometry={geometry} material={surfaceMaterial()} raycast={noRaycast} />;
}

/** The slip under a dragged request (T30): ring and verdict label. Re-renders only when that slip changes. */
function DragHover({ verdicts }: { verdicts: readonly FitResult[] }) {
  const id = useAssignDragHover();
  const g = id ? slipGeom(id) : undefined;
  if (!id || !g) return null;
  const v = verdicts.find((x) => x.slipId === id);
  return (
    <>
      <Line layers={OVERLAY_LAYER} points={ringY(g, 0.16)} color={T.midnight} lineWidth={5.5} depthTest={false} toneMapped={false} renderOrder={10} />
      <Line layers={OVERLAY_LAYER} points={ringY(g, 0.16)} color={T.limestone} lineWidth={2.5} depthTest={false} renderOrder={11} />
      <Marker slip={g} text={v ? `${v.slipId} · ${VERDICT_LABEL[v.verdict]} · ${v.reason}` : `${id} · Not offered: held or occupied`} tone="hover" />
    </>
  );
}

export function Marina() {
  const state = useAppState();
  const store = useStore();
  // Hover comes from two pick targets (the berth mesh and a hull); the hull wins while both are under the pointer.
  const [hoveredBerth, setHoveredBerth] = useState<string | null>(null);
  const [hoveredHull, setHoveredHull] = useState<string | null>(null);
  const hovered = hoveredHull ?? hoveredBerth;
  const overlays = useOverlaysVisible();
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const fx = state?.fixtures;
  const session = state ? activeSession(state) : null;
  // Berths with no current presence report (camera-less docks, stale reports): tinted and outlined differently from empty ones.
  const unknownKey = unknownSlipKey(state);
  const mapKey = statusKey(state);
  // T30: fit verdicts for the incoming request, drawn while it is dragged (one request in the demo data).
  const dragging = useAssignDragActive();
  const dragRequest = state?.fixtures.transientRequests[0]?.id ?? null;
  const verdictList = useMemo(() => (state && dragRequest ? verdictsFor(state.fixtures, activeSession(state), dragRequest, state.lake) : []), [state, dragRequest]);
  const verdictKey = verdictList.map((v) => `${v.slipId}=${v.verdict}`).join(',');
  const berths = useMemo(() => berthMeshes(unknownKey, mapKey, verdictKey), [unknownKey, mapKey, verdictKey]);
  const mapMode = useMapMode();
  useEffect(() => () => {
    berths.tint.dispose();
    berths.outline.dispose();
  }, [berths]);
  const materials = useMemo(
    () => ({
      // Daytime tint and, in the dock map, status plates (MapLayer.tsx).
      tint: berthMaterial(),
      dash: new LineDashedMaterial({ color: T.limestone, dashSize: 0.9, gapSize: 0.7, transparent: true, opacity: 0.55, depthWrite: false }),
    }),
    [],
  );
  const dashes = (line: LineSegments | null) => line?.computeLineDistances();

  if (!state || !store || !fx || !session) return null;
  const target = frameTarget(fx, session);
  const selectedSlip = target ? slipGeom(target.slipId) : undefined;

  // A boat still coming in (T31) is drawn by the traffic layer until it has settled in the slip.
  const arriving = arrivingSlipsAt(fx, session.clock);
  const hulls = dockSlips.flatMap((s) => {
    if (arriving.has(s.id)) return [];
    const spec = hullForSlip(fx, session, s.id);
    return spec ? [{ s, spec, placement: placeBoat(s, spec.lengthFt, spec.beamFt) }] : [];
  });

  // Open review issues with a drawn hull get a dashed contour around the observed hull; it clears on resolution.
  const reviewSlips = hulls.flatMap(({ s, placement }) => {
    const issue = latestIssueForSlip(session, s.id);
    if (!issue || issue.state === 'resolved') return [];
    const fp = placementFootprint(placement);
    const ring = [...fp, fp[0]!].map(([e, n]) => [e, 0.2, -n] as [number, number, number]);
    return [{ s, footprint: ring }];
  });

  const select = (slipId: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (debugEnabled()) (window.__harborSceneClicks ??= []).push({ slipId, delta: e.delta });
    if (e.delta > CLICK_TOLERANCE_PX) return; // a drag, not a click
    store.dispatch({ type: 'select', selection: { kind: 'slip', id: slipId } });
  };
  /** The slip under a hit on the merged berth mesh: two triangles per berth, in SITE.slips order. */
  const berthAt = (e: { faceIndex?: number | null | undefined }): string | null => (e.faceIndex == null ? null : dockSlips[e.faceIndex >> 1]?.id ?? null);

  return (
    <group name="marina">
      <Decking />
      <mesh
        name="berth"
        geometry={berths.tint}
        material={materials.tint}
        onClick={(e) => {
          const id = berthAt(e);
          if (id) select(id)(e);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHoveredBerth(berthAt(e));
        }}
        onPointerOut={() => setHoveredBerth(null)}
      />
      {/* In the dock map the plates carry the status; presence-unknown stays in hover text, list and inspector. */}
      <lineSegments key={unknownKey} name="berth-unknown" ref={dashes} geometry={berths.outline} material={materials.dash} raycast={noRaycast} renderOrder={2} visible={!mapMode} />
      <ContactShadows placements={hulls.map((h) => h.placement)} />
      <MooringLines boats={hulls.filter((h) => !h.spec.stale)} />
      {hulls.map(({ s, spec, placement }) => (
        <Boat
          key={spec.key + s.id}
          spec={spec}
          slipId={s.id}
          nameBoard={nameBoardForSlip(fx, session, s.id)}
          placement={placement}
          onSelect={select(s.id)}
          onHover={(over) => setHoveredHull((h) => (over ? s.id : h === s.id ? null : h))}
        />
      ))}
      {overlays
        ? reviewSlips.map(({ s, footprint }) => (
            <group key={`review-${s.id}`} name="review-contour">
              {/* Needs review: amber, dashed and text-labelled; independent of the orange selection outline (PRD §6). */}
              <Line layers={OVERLAY_LAYER} points={footprint} color={T.midnight} lineWidth={5} dashed dashSize={0.45} gapSize={0.3} depthTest={false} toneMapped={false} renderOrder={8} />
              <Line layers={OVERLAY_LAYER} points={footprint} color={T.warning} lineWidth={2} dashed dashSize={0.45} gapSize={0.3} depthTest={false} renderOrder={9} />
              {s.id !== selectedSlip?.id && s.id !== hovered ? <Marker slip={s} text={`${s.id} · Needs review`} tone="review" /> : null}
            </group>
          ))
        : null}
      {dragging ? <DragHover verdicts={verdictList} /> : null}
      {overlays && !dragging && hovered && hovered !== selectedSlip?.id ? (
        <>
          <Line layers={OVERLAY_LAYER} points={ringY(slipGeom(hovered)!, 0.12)} color={T.chartCyan} lineWidth={1.5} transparent opacity={0.8} depthTest={false} renderOrder={10} />
          <Marker slip={slipGeom(hovered)!} text={mapMode ? `${hovered} · ${MAP_STATUS_LABEL[mapSlipStatus(fx, session, hovered)]} · ${slipStateLabel(fx, session, hovered)}` : markerLabel(fx, session, hovered)} tone="hover" />
        </>
      ) : null}
      {overlays && selectedSlip ? (
        <>
          {/* Drawn over hulls so the selected berth is never hidden by a boat (DESIGN §4.2 selection outline). */}
          <Line layers={OVERLAY_LAYER} points={ringY(selectedSlip, 0.14)} color={T.midnight} lineWidth={5.5} depthTest={false} toneMapped={false} renderOrder={10} />
          <Line layers={OVERLAY_LAYER} points={ringY(selectedSlip, 0.14)} color={T.signal} lineWidth={2.5} depthTest={false} renderOrder={11} />
          <Marker slip={selectedSlip} text={markerLabel(fx, session, selectedSlip.id, target?.via === 'away-vessel' ? 'away-vessel' : 'slip')} tone="selected" />
        </>
      ) : null}
    </group>
  );
}
