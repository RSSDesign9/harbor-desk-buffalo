/**
 * Boats on the move (TASKS T30, T31).
 *
 * - Scheduled traffic (T31): every logged departure and arrival takes TRANSIT_MINUTES of sim time along its
 *   berth's authored path (approach.ts), starting AT its log entry: a departure leaves bow first, an arrival comes
 *   in from the channel and backs into the slip. Nothing moves before its record exists, so scrubbing never
 *   shows a later log entry early (PRD §7 inv. 8). While an arrival is in transit its berthed hull is not drawn;
 *   it settles exactly onto the berthed placement, so the hand-over is seamless.
 * - Planned boats (T30): a demo assignment draws the request's boat translucent (planned, not observed) in the
 *   slip after a short real-time approach along the same path; undo sends it back out. Reduced motion cuts.
 * Neither kind is pickable: clicks go to the berth underneath.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { useAppState } from '../app/AppStore.tsx';
import { slipGeom } from '../data/site.ts';
import { activeAssignments } from '../domain/selectors.ts';
import { activeSession } from '../domain/store.ts';
import type { FixtureBundle, IsoTime, TransientRequest, Vessel } from '../domain/types.ts';
import { toMs } from '../domain/time.ts';
import { approachPath, TRANSIT_MINUTES, type Pose2 } from './approach.ts';
import { Boat } from './Boat.tsx';
import type { HullSpec } from './hulls.ts';
import { invalidateShadows } from './quality.ts';
import { prefersReducedMotion } from './viewRequests.ts';
import { setScenePicker } from '../features/assign/dragStore.ts';
import { pickAt } from './pick.ts';

const specOf = (v: Pick<Vessel, 'modelAssetKey' | 'loa_ft' | 'beam_ft' | 'hullColor' | 'canvasColor'>, key: string, stale: boolean): HullSpec => ({
  key,
  family: v.modelAssetKey,
  lengthFt: v.loa_ft,
  beamFt: v.beam_ft ?? v.loa_ft * 0.34,
  hullColor: v.hullColor,
  canvas: v.canvasColor,
  observed: false,
  stale,
});

export interface Transit {
  key: string;
  slipId: string;
  kind: 'arrival' | 'departure';
  /** 0…1 along the path. */
  progress: number;
  pose: Pose2;
  spec: HullSpec;
  lengthM: number;
  beamM: number;
}

/** Scheduled boats in transit at the clock (pure; tests/unit/approach.test.ts). */
export function transitsAt(fx: FixtureBundle, clock: IsoTime): Transit[] {
  const now = toMs(clock);
  const span = TRANSIT_MINUTES * 60_000;
  const out: Transit[] = [];
  for (const m of fx.movements) {
    const k = (now - toMs(m.at)) / span;
    if (k < 0 || k >= 1) continue;
    const g = slipGeom(m.slipId);
    const v = fx.vessels.find((x) => x.id === m.vesselId);
    if (!g || !v) continue;
    const spec = specOf(v, `transit:${m.id}`, false);
    const path = approachPath(g, spec.lengthFt, spec.beamFt);
    out.push({ key: m.id, slipId: m.slipId, kind: m.kind, progress: k, pose: m.kind === 'arrival' ? path.arrival(k) : path.departure(k), spec, lengthM: path.placement.lengthM, beamM: path.placement.beamM });
  }
  return out;
}

/** Slips whose boat is still coming in at the clock: their berthed hull waits for the transit to finish. */
export const arrivingSlipsAt = (fx: FixtureBundle, clock: IsoTime) => new Set(transitsAt(fx, clock).filter((t) => t.kind === 'arrival').map((t) => t.slipId));

/** QA: where every moving boat is, by key (local [e, n] and yaw). Read by the debug bridge. */
export const transitDebug = new Map<string, { e: number; n: number; yaw: number; kind: string }>();

export function ScheduledTraffic() {
  const state = useAppState();
  const fx = state?.fixtures;
  const clock = state ? activeSession(state).clock : null;
  const transits = useMemo(() => (fx && clock ? transitsAt(fx, clock) : []), [fx, clock]);
  useEffect(() => {
    for (const k of [...transitDebug.keys()]) if (k.startsWith('MOV')) transitDebug.delete(k);
    for (const t of transits) transitDebug.set(t.key, { e: t.pose.center[0], n: t.pose.center[1], yaw: t.pose.yaw, kind: t.kind });
    invalidateShadows();
  }, [transits]);
  return (
    <group name="scheduled-traffic">
      {transits.map((t) => (
        <Boat key={t.key} spec={t.spec} slipId={t.slipId} placement={{ center: t.pose.center, yaw: t.pose.yaw, lengthM: t.lengthM, beamM: t.beamM }} interactive={false} />
      ))}
    </group>
  );
}

const IN_MS = 3600;
const OUT_MS = 2400;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

interface Planned {
  id: string;
  slipId: string;
  request: TransientRequest;
  /** Animation: arriving, berthed, or leaving (after undo). */
  phase: 'in' | 'still' | 'out';
  start: number;
}

/** One planned boat, moved by its group each frame while it animates. */
function PlannedBoat({ p, onGone }: { p: Planned; onGone: (id: string) => void }) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const spec = useMemo(() => specOf({ modelAssetKey: p.request.modelAssetKey, loa_ft: p.request.loa_ft, beam_ft: p.request.beam_ft, hullColor: p.request.hullColor, canvasColor: p.request.canvasColor }, `request:${p.id}`, true), [p.id, p.request]);
  const path = useMemo(() => approachPath(slipGeom(p.slipId)!, spec.lengthFt, spec.beamFt), [p.slipId, spec]);
  const place = (pose: Pose2) => {
    const g = group.current;
    if (!g) return;
    g.position.set(pose.center[0], 0, -pose.center[1]);
    g.rotation.y = pose.yaw;
    transitDebug.set(`ASN:${p.id}`, { e: pose.center[0], n: pose.center[1], yaw: pose.yaw, kind: p.phase });
  };
  const done = useRef(false);
  useFrame(() => {
    if (p.phase === 'still' || done.current) return;
    const k = Math.min(1, (performance.now() - p.start) / (p.phase === 'out' ? OUT_MS : IN_MS));
    place(p.phase === 'in' ? path.arrival(ease(k)) : path.departure(ease(k)));
    invalidateShadows();
    if (k < 1) invalidate();
    else {
      done.current = true; // berthed (or gone): stop moving and stop redrawing shadows
      if (p.phase === 'out') onGone(p.id);
    }
  });
  useEffect(() => {
    done.current = false;
    place(p.phase === 'out' ? path.departure(0) : p.phase === 'in' ? path.arrival(0) : path.arrival(1));
    invalidate();
    return () => {
      transitDebug.delete(`ASN:${p.id}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.phase, p.id]);
  return (
    <group ref={group} name="planned-boat" userData={{ slipId: p.slipId, assignmentId: p.id }}>
      <Boat spec={spec} slipId={p.slipId} placement={{ center: [0, 0], yaw: 0, lengthM: path.placement.lengthM, beamM: path.placement.beamM }} interactive={false} />
    </group>
  );
}

export function PlannedBoats() {
  const state = useAppState();
  const fx = state?.fixtures;
  const session = state ? activeSession(state) : null;
  const live = session ? activeAssignments(session) : [];
  const liveKey = live.map((a) => `${a.id}:${a.slipId}`).join('|');
  const [items, setItems] = useState<Planned[]>([]);
  const first = useRef(true);
  useEffect(() => {
    if (!fx) return;
    const animate = !first.current && !prefersReducedMotion();
    first.current = false;
    const now = performance.now();
    setItems((prev) => {
      const ids = new Set(live.map((a) => a.id));
      const next: Planned[] = [];
      for (const it of prev) {
        if (ids.has(it.id)) next.push(it);
        else if (animate && it.phase !== 'out') next.push({ ...it, phase: 'out', start: now });
        else if (it.phase === 'out') next.push(it);
      }
      for (const a of live) {
        if (prev.some((x) => x.id === a.id)) continue;
        const request = fx.transientRequests.find((r) => r.id === a.requestId);
        if (request) next.push({ id: a.id, slipId: a.slipId, request, phase: animate ? 'in' : 'still', start: now });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, fx]);
  const gone = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  return (
    <group name="planned-boats">
      {items.map((p) => (
        <PlannedBoat key={p.id} p={p} onGone={gone} />
      ))}
    </group>
  );
}

/** Registers the drag-to-assign picker (T30) while the scene is mounted. */
export function ScenePicker() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    setScenePicker((x, y) => {
      const { camera, scene, gl } = get();
      // Only the marina takes drops; skipping land, trees and buildings keeps each pointer move cheap.
      const hit = pickAt(camera, scene.getObjectByName('marina') ?? scene, gl.domElement.getBoundingClientRect(), x, y);
      return hit && 'slipId' in hit ? hit.slipId : null;
    });
    return () => setScenePicker(null);
  }, [get]);
  return null;
}
