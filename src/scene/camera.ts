/**
 * Camera poses and easing (pure). Scene axes: x = east, y = up, z = −north (src/scene/geo.ts).
 * Timings follow DESIGN §7 (700 ms, cubic-bezier(0.83, 0, 0.17, 1)); reduced motion cuts instead.
 */
import { SITE, type SlipGeom } from '../data/site.ts';

export type Vec3 = [number, number, number];
export interface Pose {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view in degrees. Omitted = BASE_FOV (the normal lens). */
  fov?: number;
}
/** Camera presets. `map` is the 3D dock map (T29); it is framed at request time, so it has no static pose. */
export type Preset = 'overview' | 'dock' | 'map';
export type StaticPreset = Exclude<Preset, 'map'>;

/** The normal lens (degrees, vertical). */
export const BASE_FOV = 30;
/**
 * The dock-map lens (T29): 2°, i.e. orthographic in effect. Across the marina's on-screen depth the scale varies
 * by under 3 % (measured in tests/unit/map-camera.test.ts), so slips read as a plan at true relative size. A long
 * lens rather than an OrthographicCamera keeps ONE camera and one set of controls, so the move into and out of
 * the map is a continuous dolly-zoom instead of a cut between two cameras.
 */
export const MAP_FOV = 2;
/** Map orientation: from the water side, square to the docks' long axis (bearing 149°), so Dock A is on the right. */
export const MAP_BEARING_DEG = 59;
/** Map tilt: elevation of the view above the water. High enough to read as a plan, low enough to show the boats. */
export const MAP_ELEVATION_DEG = 52;

export const CAMERA_DURATION_MS = 700;
export const CAMERA_BOUNDS = { min: [-650, -1, -700] as Vec3, max: [750, 80, 650] as Vec3 };
export const DISTANCE_LIMITS = { min: 12, max: 1500 };
export const MAX_POLAR = (80 * Math.PI) / 180;

const deg = (d: number) => (d * Math.PI) / 180;
/** Point at a compass bearing (degrees from north), horizontal distance and height from a target. */
function from(target: Vec3, bearingDeg: number, horizontal: number, height: number): Vec3 {
  const b = deg(bearingDeg);
  return [target[0] + Math.sin(b) * horizontal, target[1] + height, target[2] - Math.cos(b) * horizontal];
}

const slipCentroids = SITE.slips.map((s) => s.centroid);
const siteCenter: Vec3 = (() => {
  const e = slipCentroids.map((c) => c[0]);
  const n = slipCentroids.map((c) => c[1]);
  return [(Math.min(...e) + Math.max(...e)) / 2, 0, -(Math.min(...n) + Math.max(...n)) / 2];
})();

const dockBFirstRun: Vec3 = (() => {
  const run = SITE.slips.filter((s) => s.dock === 'B' && Number(s.id.slice(2)) <= 19);
  const e = run.reduce((a, s) => a + s.centroid[0], 0) / run.length;
  const n = run.reduce((a, s) => a + s.centroid[1], 0) / run.length;
  return [e, 0, -n];
})();

/**
 * Overview: from the east over the peninsula, looking along the whole assumed frontage (Dock E nearest on the
 * left, Dock A far right) with the elevator and yard behind it. Dock B: from the water, as in visual target v2.
 */
export const PRESETS: Record<StaticPreset, Pose> = {
  overview: { target: siteCenter, position: from(siteCenter, 80, 680, 450) },
  dock: { target: dockBFirstRun, position: from(dockBFirstRun, 32, 120, 78) },
};

/**
 * Opening shot start (T24): from the water, north-north-east, with the grain elevator, the waterfront yard and the
 * docks in one frame — the Buffalo cue first, then the move down to Dock B. The poster is rendered from this pose.
 */
export const ESTABLISHING_POSE: Pose = { target: [50, 0, 40], position: [300, 210, -270] };

/** Frame one berth from its open-water side, angled along the dock so neighbours stay in view. */
export function slipPose(s: SlipGeom): Pose {
  const target: Vec3 = [s.centroid[0], 0.6, -s.centroid[1]];
  return { target, position: from(target, s.headingDeg - 28, 46, 30) };
}

/** cubic-bezier(x1, y1, x2, y2) timing function, solved for y at time x. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    t = Math.min(1, Math.max(0, t));
    // Bisection fallback for flat regions of the strongly-eased camera curve.
    if (Math.abs(sx(t) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        t = (lo + hi) / 2;
        if (sx(t) < x) lo = t;
        else hi = t;
      }
    }
    return sy(t);
  };
}

export const easeCamera = cubicBezier(0.83, 0, 0.17, 1);

export const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ---------------------------------------------------------------------------------------------------------------
// Lens (T29). Everything that used to read “distance from the camera” (hull level of detail, the sun's shadow
// frustum, fog) reads the distance the NORMAL lens would need for the same framing, so a 2° map lens at 20 km
// looks and costs the same as the 30° lens at the equivalent distance.
// ---------------------------------------------------------------------------------------------------------------
const tanHalf = (fovDeg: number) => Math.tan(deg(fovDeg) / 2);
/** How much farther a camera with this lens stands than the normal lens for the same framing (1 for BASE_FOV). */
export const lensScale = (fovDeg: number): number => tanHalf(BASE_FOV) / tanHalf(fovDeg);
export const poseFov = (p: Pose): number => p.fov ?? BASE_FOV;
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a: Vec3): Vec3 => scale3(a, 1 / (len3(a) || 1));
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Pose at progress e (0…1, already eased). Same lens at both ends: a straight line, as before T29. A lens
 * change: a dolly-zoom. The target moves in a straight line, the viewing direction turns, and the frame height
 * at the target and the lens change geometrically, so the picture zooms smoothly while perspective flattens
 * into the map (or opens back out of it).
 */
export function interpolatePose(from: Pose, to: Pose, e: number): Required<Pose> {
  const f0 = poseFov(from);
  const f1 = poseFov(to);
  if (Math.abs(f0 - f1) < 1e-6) return { position: lerp3(from.position, to.position, e), target: lerp3(from.target, to.target, e), fov: f0 };
  const target = lerp3(from.target, to.target, e);
  const o0 = sub3(from.position, from.target);
  const o1 = sub3(to.position, to.target);
  const dir = norm3(lerp3(norm3(o0), norm3(o1), e));
  const h0 = 2 * len3(o0) * tanHalf(f0);
  const h1 = 2 * len3(o1) * tanHalf(f1);
  const h = h0 * Math.pow(h1 / h0, e);
  const t = tanHalf(f0) * Math.pow(tanHalf(f1) / tanHalf(f0), e);
  const fov = (2 * Math.atan(t) * 180) / Math.PI;
  return { position: add3(target, scale3(dir, h / (2 * t))), target, fov };
}

/** Unit vector from the target toward the camera, for a compass bearing and an elevation above the water. */
export function viewOffsetDir(bearingDeg: number, elevationDeg: number): Vec3 {
  const b = deg(bearingDeg);
  const el = deg(elevationDeg);
  return [Math.sin(b) * Math.cos(el), Math.sin(el), -Math.cos(b) * Math.cos(el)];
}

/** Screen basis for a camera looking along −offsetDir with world up = +y. */
function screenBasis(offsetDir: Vec3) {
  const forward = scale3(offsetDir, -1);
  const right = norm3(cross3(forward, [0, 1, 0]));
  const up = cross3(right, forward);
  return { forward, right, up };
}

/** A rectangle of the canvas, in CSS pixels from its top-left corner. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const EDGE_PAD = 10;

/**
 * The largest-looking rectangle of the canvas not covered by a panel: start from the whole canvas and, for each
 * panel that overlaps it, cut away whichever side of the panel keeps the most area. Greedy, but the panels sit
 * along the edges, so it finds the open middle.
 */
export function freeRect(width: number, height: number, panels: readonly Rect[]): Rect {
  const r: Rect = { left: EDGE_PAD, top: EDGE_PAD, right: width - EDGE_PAD, bottom: height - EDGE_PAD };
  const area = (x: Rect) => Math.max(0, x.right - x.left) * Math.max(0, x.bottom - x.top);
  for (let pass = 0; pass < 3; pass++) {
    for (const p of [...panels].sort((a, b) => area(b) - area(a))) {
      if (p.right <= r.left || p.left >= r.right || p.bottom <= r.top || p.top >= r.bottom) continue;
      const options: Rect[] = [
        { ...r, left: p.right + EDGE_PAD },
        { ...r, right: p.left - EDGE_PAD },
        { ...r, top: p.bottom + EDGE_PAD },
        { ...r, bottom: p.top - EDGE_PAD },
      ];
      Object.assign(r, options.reduce((best, o) => (area(o) > area(best) ? o : best)));
    }
  }
  return r;
}

/** What the map framing needs to know about the canvas. */
export interface MapViewport {
  /** Canvas size, CSS px. */
  width: number;
  height: number;
  /** The camera's view offset (CameraRig): the projection centre sits `insetX` px left / `insetY` px above the middle. */
  insetX: number;
  insetY: number;
  /** The part of the canvas not covered by panels, where the marina must fit. */
  free: Rect;
}

/** Points the dock map must show: every corner of every berth. */
const MAP_POINTS: readonly Vec3[] = SITE.slips.flatMap((s) => s.corners.map(([e, n]) => [e, 0, -n] as Vec3));

/**
 * Pixels per metre at the target for a pose on this viewport. The view offset widens the virtual image, but
 * the lens is defined on its height: the full image height is the canvas height plus twice the vertical inset.
 */
export function pxPerMetre(pose: Pose, vp: Pick<MapViewport, 'height' | 'insetY'>): number {
  const d = len3(sub3(pose.position, pose.target));
  return (vp.height + 2 * vp.insetY) / (2 * d * tanHalf(poseFov(pose)));
}

/**
 * Place a long-lens camera so that `points` (with `margin` as a fraction of the free rectangle) fill `vp.free`
 * at `scale` px/m, or as large as fits when `scale` is omitted. The target stays on the water plane (y = 0),
 * so orbiting afterwards pivots on the marina, not on a point in the air.
 */
function frameOnFree(points: readonly Vec3[], offsetDir: Vec3, vp: MapViewport, opts: { scale?: number; margin?: number; fov?: number } = {}): Pose {
  const fov = opts.fov ?? MAP_FOV;
  const { forward, right, up } = screenBasis(offsetDir);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const x = dot3(p, right);
    const y = dot3(p, up);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const fw = Math.max(1, vp.free.right - vp.free.left);
  const fh = Math.max(1, vp.free.bottom - vp.free.top);
  const m = opts.margin ?? 0.06;
  const fit = Math.min((fw * (1 - 2 * m)) / Math.max(1e-3, x1 - x0), (fh * (1 - 2 * m)) / Math.max(1e-3, y1 - y0));
  const s = opts.scale ?? fit;
  // The point whose projection must land on the middle of the free rectangle.
  const mid = add3(scale3(right, (x0 + x1) / 2), scale3(up, (y0 + y1) / 2));
  // Projection centre on the canvas (see MapViewport.insetX/Y).
  const px = vp.width / 2 - vp.insetX;
  const py = vp.height / 2 - vp.insetY;
  const cx = (vp.free.left + vp.free.right) / 2;
  const cy = (vp.free.top + vp.free.bottom) / 2;
  // Target that puts `mid` at (cx, cy): screen x grows with `right`, screen y grows against `up`.
  let target = add3(mid, add3(scale3(right, -(cx - px) / s), scale3(up, (cy - py) / s)));
  // Slide it along the line of sight onto the water plane; the picture does not change.
  target = add3(target, scale3(forward, -target[1] / forward[1]));
  const distance = (vp.height + 2 * vp.insetY) / (2 * s * tanHalf(fov));
  return { target, position: add3(target, scale3(offsetDir, distance)), fov };
}

/** The 3D dock map (T29): all 126 berths, tilted, with the long lens, fitted into the canvas area panels leave free. */
export function mapPose(vp: MapViewport): Pose {
  return frameOnFree(MAP_POINTS, viewOffsetDir(MAP_BEARING_DEG, MAP_ELEVATION_DEG), vp);
}

/** Pixels per metre at which slip numbers appear on the map (a 4 m berth is then about 18 px wide). */
export const MAP_LABEL_PX_PER_M = 4.5;

/**
 * Selecting a berth while the map is up keeps the map: same lens, same orientation as now (the user may have
 * turned it), the berth centred in the free area, zoomed in until slip numbers show (never zoomed out).
 */
export function mapSlipPose(s: SlipGeom, vp: MapViewport, current: Pose): Pose {
  const offset = sub3(current.position, current.target);
  const dir = len3(offset) > 0 ? norm3(offset) : viewOffsetDir(MAP_BEARING_DEG, MAP_ELEVATION_DEG);
  const scale = Math.max(pxPerMetre(current, vp), MAP_LABEL_PX_PER_M * 1.5);
  return frameOnFree([[s.centroid[0], 0, -s.centroid[1]]], dir, vp, { scale });
}
