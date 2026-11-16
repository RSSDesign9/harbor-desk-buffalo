/**
 * Test/QA bridge, installed only when the URL has `?debug` (TASKS T08/T19 verification).
 * Lets browser tests find where a berth or hull is on screen and read the camera; it never selects anything.
 */
import { reflectionStats } from './Water.tsx';
import { windUniform } from './materials.ts';
import { currentDaylight } from './Environment.tsx';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3 } from 'three';
import { slipGeom } from '../data/site.ts';
import { placeBoat } from './layout.ts';
import type { CameraDebug } from './CameraRig.tsx';
import { setOverlaysVisible } from './overlays.ts';
import { shadowUpdateCount } from './quality.ts';
import { mapMix } from './MapLayer.tsx';
import { pickAt } from './pick.ts';
import { transitDebug } from './Traffic.tsx';
import { getMapMode } from './viewRequests.ts';
import type { Mesh } from 'three';

export interface SceneDebug {
  project(slipId: string, part?: 'berth' | 'hull' | 'berth-outer'): { x: number; y: number } | null;
  /** Screen position of an arbitrary local point (east, north, height): used to click on scenery. */
  at(east: number, north: number, y?: number): { x: number; y: number };
  /** Scene inventory for QA: stored-boat scenery count, berths outlined as “presence unknown”, DOM markers. */
  inventory(): { storedBoats: number; unknownBerths: number; hulls: number; pickMeshes: number };
  /** Names of the objects under a client point, nearest first (independent of event handlers). */
  hits(x: number, y: number): string[];
  /** The slip a click at this client point would select (nearest berth or hull hit), or the name of what blocks it. */
  pick(x: number, y: number): { slipId: string } | { blockedBy: string } | null;
  /** Whether the 3D dock map is up, and how far it has faded in (0…1). */
  map(): { mode: boolean; mix: number };
  /** Boats on the move (T30/T31): scheduled transits and planned boats, local [e, n] and yaw. */
  transits(): Record<string, { e: number; n: number; yaw: number; kind: string }>;
  camera: CameraDebug | null;
  /** Renderer counters for the last frame, and the representation each hull is using (QA measurement only). */
  stats(): { frame: number; calls: number; triangles: number; geometries: number; textures: number; programs: number; hullLods: number[]; dpr: number; renderer: string; shadowUpdates: number; reflectionRenders: number };
  /** Render `frames` frames back to back and report CPU-side frame times in ms (QA measurement only). */
  timeFrames(frames: number): { median: number; p95: number; max: number };
  /** The drawn hull in a slip: stable key, geometry identity and world transform (QA: “relabelled, not moved”). */
  hull(slipId: string): { key: string; geometry: string; position: [number, number, number]; rotationY: number; nameBoards: number; fallback: boolean } | null;
  /** Hide/show outlines and markers (evidence stills are rendered from the clean scene). */
  overlays(visible: boolean): void;
  /** T35: the wind on the water now (toward x/z, strength, whitecaps) and the sun's intensity after any overcast. */
  weather(): { toward: [number, number]; strength: number; whitecaps: number; sunIntensity: number };
}

declare global {
  interface Window {
    __harborScene?: SceneDebug;
    /** Debug-only record of berth/hull click handling (slip, pointer travel in px). */
    __harborSceneClicks?: { slipId: string; delta: number }[];
  }
}

export const debugEnabled = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

export function DebugBridge({ cameraDebug }: { cameraDebug: CameraDebug | null }) {
  const { camera, gl, scene, advance } = useThree();
  useEffect(() => {
    if (!debugEnabled()) return;
    window.__harborScene = {
      camera: cameraDebug,
      stats() {
        const hullLods: number[] = [];
        scene.traverse((o) => {
          const lod = (o.userData as { lod?: number }).lod;
          if (typeof lod === 'number') hullLods.push(lod);
        });
        const ctx = gl.getContext();
        const ext = ctx.getExtension('WEBGL_debug_renderer_info');
        return {
          frame: gl.info.render.frame,
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          hullLods,
          dpr: gl.getPixelRatio(),
          shadowUpdates: shadowUpdateCount(),
          reflectionRenders: reflectionStats().renders,
          renderer: ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown',
        };
      },
      timeFrames(frames) {
        const times: number[] = [];
        const ctx = gl.getContext();
        const px = new Uint8Array(4);
        for (let i = 0; i < frames; i++) {
          const t0 = performance.now();
          advance(t0);
          // Reading a pixel back blocks until the GPU has finished the frame (gl.finish() alone returns early
          // under ANGLE), so this is the full CPU + GPU cost of one frame, not just command submission.
          ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
          times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        return { median: times[Math.floor(times.length / 2)]!, p95: times[Math.floor(times.length * 0.95)]!, max: times[times.length - 1]! };
      },
      hull(slipId) {
        let found: SceneDebug['hull'] extends (...a: never[]) => infer R ? R : never = null;
        scene.traverse((o) => {
          const u = o.userData as { slipId?: string; hullKey?: string; fallback?: boolean };
          if (found || o.name !== 'hull' || u.slipId !== slipId) return;
          const body = o.children.find((c) => (c as Mesh).isMesh && c.name !== 'contact-shadow') as Mesh | undefined;
          let boards = 0;
          o.traverse((c) => {
            if (c.name === 'name-board') boards += 1;
          });
          o.updateWorldMatrix(true, false);
          const p = o.getWorldPosition(new Vector3());
          found = { key: u.hullKey ?? '', geometry: body?.geometry.uuid ?? '', position: [p.x, p.y, p.z], rotationY: o.rotation.y, nameBoards: boards, fallback: u.fallback === true };
        });
        return found;
      },
      overlays(visible) {
        setOverlaysVisible(visible);
        advance(performance.now());
      },
      weather() {
        const w = windUniform.value;
        return { toward: [w.x, w.y], strength: w.z, whitecaps: w.w, sunIntensity: currentDaylight().sunIntensity };
      },
      at(east, north, y = 0) {
        const v = new Vector3(east, y, -north).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      inventory() {
        const out = { storedBoats: 0, unknownBerths: 0, hulls: 0, pickMeshes: 0 };
        scene.traverse((o) => {
          if (o.name === 'stored-boats') out.storedBoats = (o.userData as { count?: number }).count ?? 0;
          if (o.name === 'berth-unknown') out.unknownBerths = ((o as Mesh).geometry.getAttribute('position')?.count ?? 0) / 8;
          if (o.name === 'hull') out.hulls += 1;
          if (o.name === 'berth') out.pickMeshes += 1;
        });
        return out;
      },
      hits(x, y) {
        const r = gl.domElement.getBoundingClientRect();
        const ndc = new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
        camera.updateMatrixWorld();
        const ray = new Raycaster();
        ray.setFromCamera(ndc, camera);
        return ray.intersectObjects(scene.children, true).slice(0, 6).map((h) => h.object.name || h.object.type);
      },
      pick(x, y) {
        return pickAt(camera, scene, gl.domElement.getBoundingClientRect(), x, y);
      },
      transits: () => Object.fromEntries(transitDebug),
      map: () => ({ mode: getMapMode(), mix: mapMix.value }),
      project(slipId, part = 'berth') {
        const g = slipGeom(slipId);
        if (!g) return null;
        let e = g.centroid[0];
        let n = g.centroid[1];
        let y = 0.05;
        if (part === 'berth-outer') {
          // Near the open-water end, where no hull sits: picks the berth itself.
          e = g.inner[0] + (g.outer[0] - g.inner[0]) * 0.95;
          n = g.inner[1] + (g.outer[1] - g.inner[1]) * 0.95;
        }
        if (part === 'hull') {
          const p = placeBoat(g, 28, 9.5);
          e = p.center[0];
          n = p.center[1];
          y = 1.2;
        }
        const v = new Vector3(e, y, -n).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
    return () => {
      delete window.__harborScene;
    };
  }, [camera, gl, scene, advance, cameraDebug]);
  return null;
}
