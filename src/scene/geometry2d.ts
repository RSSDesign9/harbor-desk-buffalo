/**
 * Small, dependency-free 2D geometry helpers in local metres (east, north).
 * Used by the geometry validation script (T02) and by scene construction (T08+).
 */
import type { EastNorth } from './geo.ts';

export type Pt = EastNorth;
export type Ring = readonly Pt[];

export const sub = (a: Pt, b: Pt): Pt => ({ east: a.east - b.east, north: a.north - b.north });
export const add = (a: Pt, b: Pt): Pt => ({ east: a.east + b.east, north: a.north + b.north });
export const scale = (a: Pt, k: number): Pt => ({ east: a.east * k, north: a.north * k });
export const dot = (a: Pt, b: Pt): number => a.east * b.east + a.north * b.north;
export const cross = (a: Pt, b: Pt): number => a.east * b.north - a.north * b.east;
export const len = (a: Pt): number => Math.hypot(a.east, a.north);
export const dist = (a: Pt, b: Pt): number => len(sub(a, b));
export const norm = (a: Pt): Pt => {
  const l = len(a);
  return l === 0 ? { east: 0, north: 0 } : scale(a, 1 / l);
};
/** Left-hand perpendicular (rotate +90°). */
export const perp = (a: Pt): Pt => ({ east: -a.north, north: a.east });

/** Drop the closing vertex of a GeoJSON-style closed ring. */
export function openRing(ring: Ring): Pt[] {
  const pts = [...ring];
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && first && last && first.east === last.east && first.north === last.north) pts.pop();
  return pts;
}

/** Signed area (positive = counter-clockwise in east/north axes). */
export function signedArea(ring: Ring): number {
  const pts = openRing(ring);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.east * b.north - b.east * a.north;
  }
  return s / 2;
}

export const area = (ring: Ring): number => Math.abs(signedArea(ring));

export function centroid(ring: Ring): Pt {
  const pts = openRing(ring);
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-12) {
    const sum = pts.reduce((acc, p) => add(acc, p), { east: 0, north: 0 });
    return scale(sum, 1 / Math.max(1, pts.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const f = p.east * q.north - q.east * p.north;
    cx += (p.east + q.east) * f;
    cy += (p.north + q.north) * f;
  }
  return { east: cx / (6 * a), north: cy / (6 * a) };
}

export function pointInPolygon(p: Pt, ring: Ring): boolean {
  const pts = openRing(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.north > p.north !== b.north > p.north) {
      const x = ((b.east - a.east) * (p.north - a.north)) / (b.north - a.north) + a.east;
      if (p.east < x) inside = !inside;
    }
  }
  return inside;
}

export function closestPointOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; t: number; distance: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const point = add(a, scale(ab, t));
  return { point, t, distance: dist(p, point) };
}

export interface PolylineHit {
  point: Pt;
  distance: number;
  segment: number;
  /** Distance along the polyline from its first vertex. */
  chainage: number;
  /** Unit tangent of the hit segment. */
  tangent: Pt;
}

export function closestPointOnPolyline(p: Pt, line: readonly Pt[]): PolylineHit {
  let best: PolylineHit | null = null;
  let run = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const hit = closestPointOnSegment(p, a, b);
    if (!best || hit.distance < best.distance) {
      best = { point: hit.point, distance: hit.distance, segment: i, chainage: run + hit.t * dist(a, b), tangent: norm(sub(b, a)) };
    }
    run += dist(a, b);
  }
  if (!best) throw new RangeError('Polyline needs at least two vertices');
  return best;
}

export function polylineLength(line: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < line.length - 1; i++) s += dist(line[i]!, line[i + 1]!);
  return s;
}

/** Sutherland–Hodgman clip of `subject` by a convex `clip` polygon. Returns the intersection ring. */
export function clipConvex(subject: Ring, clip: Ring): Pt[] {
  let output = openRing(subject);
  const c = openRing(clip);
  const ccw = signedArea(c) > 0;
  for (let i = 0; i < c.length && output.length > 0; i++) {
    const a = c[i]!;
    const b = c[(i + 1) % c.length]!;
    const inside = (p: Pt) => (ccw ? cross(sub(b, a), sub(p, a)) >= 0 : cross(sub(b, a), sub(p, a)) <= 0);
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn !== prevIn) {
        const d1 = cross(sub(b, a), sub(prev, a));
        const d2 = cross(sub(b, a), sub(cur, a));
        const t = d1 / (d1 - d2);
        output.push(add(prev, scale(sub(cur, prev), t)));
      }
      if (curIn) output.push(cur);
    }
  }
  return output;
}

/** Overlap area of a polygon with a convex polygon (m²). */
export function convexOverlapArea(subject: Ring, convexClip: Ring): number {
  const r = clipConvex(subject, convexClip);
  return r.length < 3 ? 0 : area(r);
}

/** Overlap area of a convex polygon with a possibly concave polygon, via fan triangulation of the concave one. */
export function overlapWithPolygon(convex: Ring, polygon: Ring): number {
  // Ear-free approach: sample-based estimate is robust for concave land polygons.
  const pts = openRing(convex);
  const minE = Math.min(...pts.map((p) => p.east));
  const maxE = Math.max(...pts.map((p) => p.east));
  const minN = Math.min(...pts.map((p) => p.north));
  const maxN = Math.max(...pts.map((p) => p.north));
  const step = 0.25;
  let hits = 0;
  for (let e = minE + step / 2; e < maxE; e += step) {
    for (let n = minN + step / 2; n < maxN; n += step) {
      const p = { east: e, north: n };
      if (pointInPolygon(p, pts) && pointInPolygon(p, polygon)) hits++;
    }
  }
  return hits * step * step;
}

/** Interior angles (degrees) of an open ring. */
export function interiorAngles(ring: Ring): number[] {
  const pts = openRing(ring);
  return pts.map((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    const u = norm(sub(prev, p));
    const v = norm(sub(next, p));
    return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
  });
}

/** Offset a polyline sideways by `d` metres (positive = left of travel direction), mitred at joints. */
export function offsetPolyline(line: readonly Pt[], d: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    const tPrev = i > 0 ? norm(sub(p, line[i - 1]!)) : null;
    const tNext = i < line.length - 1 ? norm(sub(line[i + 1]!, p)) : null;
    const t = tPrev && tNext ? norm(add(tPrev, tNext)) : (tPrev ?? tNext)!;
    const n = perp(t);
    const miter = tPrev && tNext ? 1 / Math.max(0.3, dot(perp(tPrev), n)) : 1;
    out.push(add(p, scale(n, d * miter)));
  }
  return out;
}

export interface Similarity {
  /** Scale (target units per source unit). */
  s: number;
  /** Rotation, radians, counter-clockwise. */
  theta: number;
  tx: number;
  ty: number;
}

/** Least-squares 2D similarity (Umeyama) mapping source → target. Plain x/y pairs. */
export function fitSimilarity(src: readonly [number, number][], dst: readonly [number, number][]): Similarity {
  if (src.length !== dst.length || src.length < 2) throw new RangeError('Need ≥2 matched points');
  const n = src.length;
  const mean = (a: readonly [number, number][]) => a.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  const [sx, sy] = mean(src);
  const [dx, dy] = mean(dst);
  let a = 0;
  let b = 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i]![0] - sx;
    const py = src[i]![1] - sy;
    const qx = dst[i]![0] - dx;
    const qy = dst[i]![1] - dy;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    ss += px * px + py * py;
  }
  const theta = Math.atan2(b, a);
  const s = Math.hypot(a, b) / ss;
  const c = Math.cos(theta);
  const si = Math.sin(theta);
  return { s, theta, tx: dx - s * (c * sx - si * sy), ty: dy - s * (si * sx + c * sy) };
}

export function applySimilarity(t: Similarity, [x, y]: readonly [number, number]): [number, number] {
  const c = Math.cos(t.theta);
  const s = Math.sin(t.theta);
  return [t.s * (c * x - s * y) + t.tx, t.s * (s * x + c * y) + t.ty];
}

export function invertSimilarity(t: Similarity): Similarity {
  const c = Math.cos(-t.theta);
  const s = Math.sin(-t.theta);
  const k = 1 / t.s;
  return { s: k, theta: -t.theta, tx: -k * (c * t.tx - s * t.ty), ty: -k * (s * t.tx + c * t.ty) };
}
