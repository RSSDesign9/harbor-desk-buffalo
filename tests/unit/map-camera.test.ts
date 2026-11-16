import { describe, expect, it } from 'vitest';
import { BASE_FOV, MAP_FOV, MAP_LABEL_PX_PER_M, interpolatePose, lensScale, mapPose, mapSlipPose, pxPerMetre, type MapViewport, type Pose, type Vec3 } from '../../src/scene/camera.ts';
import { PRESETS } from '../../src/scene/camera.ts';
import { freeRect } from '../../src/scene/camera.ts';
import { SITE, slipGeom } from '../../src/data/site.ts';
import { PerspectiveCamera, Vector3 } from 'three';

/** Project scene points with a real three.js camera set up exactly as CameraRig does (view offset included). */
function projector(pose: Pose, vp: MapViewport) {
  const cam = new PerspectiveCamera(pose.fov ?? BASE_FOV, vp.width / vp.height, 1, 1e6);
  cam.setViewOffset(vp.width + 2 * vp.insetX, vp.height + 2 * vp.insetY, 2 * vp.insetX, 2 * vp.insetY, vp.width, vp.height);
  cam.position.set(...pose.position);
  cam.lookAt(new Vector3(...pose.target));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return (p: Vec3) => {
    const v = new Vector3(...p).project(cam);
    return { x: ((v.x + 1) / 2) * vp.width, y: ((1 - v.y) / 2) * vp.height, depth: cam.position.distanceTo(new Vector3(...p)) };
  };
}
const corners: Vec3[] = SITE.slips.flatMap((s) => s.corners.map(([e, n]) => [e, 0, -n] as Vec3));

const VIEWPORTS: Record<string, MapViewport> = {
  desktop: { width: 1440, height: 900, insetX: 200, insetY: 0, free: { left: 10, top: 213, right: 1046, bottom: 654 } },
  tablet: { width: 1024, height: 768, insetX: 174, insetY: 0, free: { left: 10, top: 280, right: 518, bottom: 522 } },
  mobile: { width: 390, height: 259, insetX: 0, insetY: 0, free: { left: 10, top: 10, right: 380, bottom: 196 } },
};

describe('3D dock map camera (T29)', () => {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    it(`frames every berth inside the free area at ${name} width, with the target on the water`, () => {
      const pose = mapPose(vp);
      expect(pose.fov).toBe(MAP_FOV);
      expect(pose.target[1]).toBeCloseTo(0, 6);
      const project = projector(pose, vp);
      for (const c of corners) {
        const p = project(c);
        expect(p.x).toBeGreaterThanOrEqual(vp.free.left - 0.5);
        expect(p.x).toBeLessThanOrEqual(vp.free.right + 0.5);
        expect(p.y).toBeGreaterThanOrEqual(vp.free.top - 0.5);
        expect(p.y).toBeLessThanOrEqual(vp.free.bottom + 0.5);
      }
      // pxPerMetre agrees with the projection: B-12's width on screen.
      const g = slipGeom('B-12')!;
      const [a, b] = g.corners as unknown as [[number, number], [number, number]];
      const pa = project([a[0], 0, -a[1]]);
      const pb = project([b[0], 0, -b[1]]);
      const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(Math.hypot(pb.x - pa.x, pb.y - pa.y) / w).toBeCloseTo(pxPerMetre(pose, vp), 1);
    });
  }

  it('is orthographic in effect: the 2° lens changes scale by under 3 % across the marina', () => {
    const pose = mapPose(VIEWPORTS.desktop!);
    const project = projector(pose, VIEWPORTS.desktop!);
    const depths = corners.map((c) => project(c).depth);
    expect(Math.max(...depths) / Math.min(...depths)).toBeLessThan(1.03);
    // Dock A sits on the right of the map, Dock E on the left.
    const x = (id: string) => project([slipGeom(id)!.centroid[0], 0, -slipGeom(id)!.centroid[1]]).x;
    expect(x('A-01')).toBeGreaterThan(x('E-01'));
  });

  it('a selection on the map keeps the lens and orientation and zooms in until slip numbers show', () => {
    const vp = VIEWPORTS.desktop!;
    const map = mapPose(vp);
    const p = mapSlipPose(slipGeom('D-10')!, vp, map);
    expect(p.fov).toBe(MAP_FOV);
    expect(pxPerMetre(p, vp)).toBeGreaterThanOrEqual(MAP_LABEL_PX_PER_M);
    const d = (q: Pose) => q.position.map((v, i) => v - q.target[i]!);
    const n = (v: number[]) => v.map((x) => x / Math.hypot(...v));
    n(d(p)).forEach((v, i) => expect(v).toBeCloseTo(n(d(map))[i]!, 6));
    // Already zoomed further in: it does not zoom out.
    const close = mapSlipPose(slipGeom('D-10')!, vp, p);
    const closer = mapSlipPose(slipGeom('D-11')!, vp, { ...close, position: close.position.map((v, i) => close.target[i]! + (v - close.target[i]!) * 0.5) as Vec3 });
    expect(pxPerMetre(closer, vp)).toBeCloseTo(pxPerMetre(close, vp) * 2, 3);
    // And the berth lands in the middle of the free area.
    const c = projector(p, vp)([slipGeom('D-10')!.centroid[0], 0, -slipGeom('D-10')!.centroid[1]]);
    expect(c.x).toBeCloseTo((vp.free.left + vp.free.right) / 2, 0);
    expect(c.y).toBeCloseTo((vp.free.top + vp.free.bottom) / 2, 0);
  });

  it('a lens change is a smooth dolly-zoom; a flight without one is the straight line it always was', () => {
    const from: Pose = { ...PRESETS.dock, fov: BASE_FOV };
    const to = mapPose(VIEWPORTS.desktop!);
    const a = interpolatePose(from, to, 0);
    const b = interpolatePose(from, to, 1);
    a.position.forEach((v, i) => expect(v).toBeCloseTo(from.position[i]!, 6));
    b.position.forEach((v, i) => expect(v).toBeCloseTo(to.position[i]!, 3));
    expect(a.fov).toBeCloseTo(BASE_FOV, 9);
    expect(b.fov).toBeCloseTo(MAP_FOV, 9);
    let prevFov = Infinity;
    for (let e = 0; e <= 1.0001; e += 0.05) {
      const p = interpolatePose(from, to, e);
      expect(p.fov).toBeLessThanOrEqual(prevFov + 1e-9);
      prevFov = p.fov;
    }
    const straight = interpolatePose(PRESETS.overview, PRESETS.dock, 0.5);
    straight.position.forEach((v, i) => expect(v).toBeCloseTo((PRESETS.overview.position[i]! + PRESETS.dock.position[i]!) / 2, 9));
    expect(lensScale(BASE_FOV)).toBeCloseTo(1, 12);
    expect(lensScale(MAP_FOV)).toBeGreaterThan(15);
  });

  it('finds the open middle of the canvas between the panels', () => {
    const r = freeRect(1440, 900, [
      { left: 24, top: 12, right: 1416, bottom: 70 }, // top bar
      { left: 24, top: 84, right: 700, bottom: 202 }, // KPI tiles
      { left: 1056, top: 84, right: 1416, bottom: 876 }, // rail
      { left: 24, top: 664, right: 544, bottom: 888 }, // scenario panel
      { left: 560, top: 682, right: 1040, bottom: 876 }, // camera panel + legend
    ]);
    expect(r).toEqual({ left: 10, top: 212, right: 1046, bottom: 654 });
  });
});
