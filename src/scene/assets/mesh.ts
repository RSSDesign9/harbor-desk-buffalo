/**
 * Mesh builder for the authored, parametric assets (TASKS T09, design/ASSET-PLAN.md).
 *
 * Every asset is ONE merged BufferGeometry with per-vertex colour and a per-vertex `surf` attribute
 * (roughness, metalness, surface kind), so a whole boat or dock is a single draw call with one shared material
 * (src/scene/materials.ts). Pure three.js math: no DOM, so the same code runs in the browser and in
 * `scripts/export-assets.ts` (Node).
 *
 * Conventions: metres; +y up; a boat’s bow points +x; the pivot is on the centreline at the waterline (y = 0).
 * Faces are rendered double-sided, so winding is not load-bearing; normals are smooth within a patch and
 * hard between patches.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Vector3 } from 'three';

export type V3 = readonly [number, number, number];
/** Surface finish: linear RGB colour, roughness, metalness. */
export interface Finish {
  rgb: readonly [number, number, number];
  rough: number;
  metal: number;
  /** Surface kind for world-space detail (materials.ts KIND); 0 / absent = plain. */
  kind?: number;
}

const scratch = new Color();
/** sRGB hex → finish (colour converted to the linear working space, as three expects for vertex colours). */
export function finish(hex: string, rough: number, metal = 0, kind = 0): Finish {
  scratch.set(hex);
  return { rgb: [scratch.r, scratch.g, scratch.b], rough, metal, kind };
}
/** Same finish, colour multiplied (baked occlusion / tone variation). */
export const shade = (f: Finish, k: number): Finish => ({ rgb: [f.rgb[0] * k, f.rgb[1] * k, f.rgb[2] * k], rough: f.rough, metal: f.metal, kind: f.kind ?? 0 });

/** UV that samples the plain (white) band of the shared plank map: see materials.ts. */
export const PLAIN_UV: readonly [number, number] = [0.5, 0.92];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Deterministic PRNG (mulberry32) so generated assets are reproducible byte-for-byte. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GridOptions {
  /** Wrap the first index (columns): the last column connects back to the first. */
  closeU?: boolean;
  /** Per-vertex colour multiplier (baked occlusion). */
  shade?: (i: number, j: number) => number;
  /** Per-vertex finish override. */
  finishAt?: (i: number, j: number) => Finish;
  /** Per-vertex UV into the shared plank map (default: plain band). */
  uv?: (i: number, j: number) => readonly [number, number];
  /** Flat-shade (one normal per face). */
  flat?: boolean;
}

export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private srf: number[] = [];
  private uvs: number[] = [];
  private idx: number[] = [];
  private stack: Matrix4[] = [];
  private m: Matrix4 | null = null;
  private v = new Vector3();

  get triangles() {
    return this.idx.length / 3;
  }
  get vertices() {
    return this.pos.length / 3;
  }

  /** Run `fn` with an extra transform applied to everything it adds. */
  with(matrix: Matrix4, fn: () => void) {
    const prev = this.m;
    this.m = prev ? prev.clone().multiply(matrix) : matrix.clone();
    this.stack.push(this.m);
    fn();
    this.stack.pop();
    this.m = prev;
  }
  /** Mirror across the centreline (z → −z) and add the same parts on the other side. */
  mirror(fn: (side: 1 | -1) => void) {
    fn(1);
    this.with(new Matrix4().makeScale(1, 1, -1), () => fn(-1));
  }

  private vert(p: V3, n: V3, f: Finish, k: number, uv: readonly [number, number]) {
    let [x, y, z] = p;
    let [nx, ny, nz] = n;
    if (this.m) {
      this.v.set(x, y, z).applyMatrix4(this.m);
      x = this.v.x;
      y = this.v.y;
      z = this.v.z;
      this.v.set(nx, ny, nz).transformDirection(this.m);
      nx = this.v.x;
      ny = this.v.y;
      nz = this.v.z;
    }
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.col.push(f.rgb[0] * k, f.rgb[1] * k, f.rgb[2] * k);
    this.srf.push(f.rough, f.metal, f.kind ?? 0);
    this.uvs.push(uv[0], uv[1]);
    return this.pos.length / 3 - 1;
  }

  /** Quad-grid patch: `pts[i][j]`, i along U, j along V. Smooth normals inside the patch. */
  grid(pts: readonly (readonly V3[])[], f: Finish, o: GridOptions = {}) {
    const nu = pts.length;
    const nv = pts[0]!.length;
    if (nu < 2 || nv < 2) return;
    const at = (i: number, j: number) => pts[o.closeU ? (i + nu) % nu : clamp(i, 0, nu - 1)]![clamp(j, 0, nv - 1)]!;
    const cellsU = o.closeU ? nu : nu - 1;
    // A wrapped patch encloses a volume, so its normals and winding can be made to face out of it. Shading is
    // double-sided either way; what depends on this is the shadow lookup, which is offset along the vertex
    // normal (an inward normal pushes it into the solid and the lit side shadows itself in a hatch). T33.
    let outward = 1;
    if (o.closeU) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const col of pts) for (const q of col) {
        cx += q[0];
        cy += q[1];
        cz += q[2];
      }
      const count = nu * nv;
      const centre: V3 = [cx / count, cy / count, cz / count];
      let facing = 0;
      for (let i = 0; i < cellsU; i++)
        for (let j = 0; j < nv - 1; j++) {
          const a = at(i, j);
          facing += dot(cross(sub(at(i + 1, j), a), sub(at(i + 1, j + 1), a)), sub(a, centre));
        }
      if (facing < 0) outward = -1;
    }
    const tri = (a: number, b: number, c: number, d: number) => (outward > 0 ? this.idx.push(a, b, c, a, c, d) : this.idx.push(a, c, b, a, d, c));
    if (o.flat) {
      for (let i = 0; i < cellsU; i++)
        for (let j = 0; j < nv - 1; j++) {
          const a = at(i, j);
          const b = at(i + 1, j);
          const c = at(i + 1, j + 1);
          const d = at(i, j + 1);
          let n = cross(sub(b, a), sub(d, a));
          if (len(n) < 1e-12) n = cross(sub(c, b), sub(a, b));
          n = mul(norm(n), outward);
          const fin = o.finishAt?.(i, j) ?? f;
          const k = o.shade?.(i, j) ?? 1;
          const uv = o.uv ?? (() => PLAIN_UV);
          const ia = this.vert(a, n, fin, k, uv(i, j));
          const ib = this.vert(b, n, fin, k, uv(i + 1, j));
          const ic = this.vert(c, n, fin, k, uv(i + 1, j + 1));
          const id = this.vert(d, n, fin, k, uv(i, j + 1));
          tri(ia, ib, ic, id);
        }
      return;
    }
    // Smooth: accumulate area-weighted face normals per grid vertex.
    const acc: number[] = new Array<number>(nu * nv * 3).fill(0);
    const bump = (i: number, j: number, n: V3) => {
      const k = ((o.closeU ? (i + nu) % nu : i) * nv + j) * 3;
      acc[k] = acc[k]! + n[0];
      acc[k + 1] = acc[k + 1]! + n[1];
      acc[k + 2] = acc[k + 2]! + n[2];
    };
    for (let i = 0; i < cellsU; i++)
      for (let j = 0; j < nv - 1; j++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const d = at(i, j + 1);
        const n1 = cross(sub(b, a), sub(c, a));
        const n2 = cross(sub(c, a), sub(d, a));
        bump(i, j, n1);
        bump(i + 1, j, n1);
        bump(i + 1, j + 1, n1);
        bump(i, j, n2);
        bump(i + 1, j + 1, n2);
        bump(i, j + 1, n2);
      }
    const base = this.pos.length / 3;
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const k = (i * nv + j) * 3;
        let n: V3 = [acc[k]!, acc[k + 1]!, acc[k + 2]!];
        n = len(n) < 1e-12 ? [0, 1, 0] : mul(norm(n), outward);
        this.vert(pts[i]![j]!, n, o.finishAt?.(i, j) ?? f, o.shade?.(i, j) ?? 1, o.uv?.(i, j) ?? PLAIN_UV);
      }
    for (let i = 0; i < cellsU; i++)
      for (let j = 0; j < nv - 1; j++) {
        const i2 = (i + 1) % nu;
        const a = base + i * nv + j;
        const b = base + i2 * nv + j;
        const c = base + i2 * nv + j + 1;
        const d = base + i * nv + j + 1;
        tri(a, b, c, d);
      }
  }

  /** Flat convex-ish polygon (triangle fan around its centroid). */
  poly(ring: readonly V3[], f: Finish, k = 1, uv?: (p: V3) => readonly [number, number]) {
    if (ring.length < 3) return;
    const c = mul(ring.reduce<V3>((s, p) => add(s, p), [0, 0, 0]), 1 / ring.length);
    let n: V3 = [0, 0, 0];
    for (let i = 0; i < ring.length; i++) n = add(n, cross(sub(ring[i]!, c), sub(ring[(i + 1) % ring.length]!, c)));
    n = norm(n);
    const u = uv ?? (() => PLAIN_UV);
    const ic = this.vert(c, n, f, k, u(c));
    const ids = ring.map((p) => this.vert(p, n, f, k, u(p)));
    for (let i = 0; i < ids.length; i++) this.idx.push(ic, ids[i]!, ids[(i + 1) % ids.length]!);
  }

  /** Flat quad a→b→c→d. */
  quad(a: V3, b: V3, c: V3, d: V3, f: Finish, k = 1, uv?: readonly (readonly [number, number])[]) {
    const n = norm(cross(sub(b, a), sub(d, a)));
    const ia = this.vert(a, n, f, k, uv?.[0] ?? PLAIN_UV);
    const ib = this.vert(b, n, f, k, uv?.[1] ?? PLAIN_UV);
    const ic = this.vert(c, n, f, k, uv?.[2] ?? PLAIN_UV);
    const id = this.vert(d, n, f, k, uv?.[3] ?? PLAIN_UV);
    this.idx.push(ia, ib, ic, ia, ic, id);
  }

  /** Axis-aligned box (hard edges). `skip` omits faces: any of 'x+', 'x-', 'y+', 'y-', 'z+', 'z-'. */
  box(center: V3, size: V3, f: Finish, o: { skip?: readonly string[]; topShade?: number; sideShade?: number } = {}) {
    const [cx, cy, cz] = center;
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const p = (sx: number, sy: number, sz: number): V3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
    const skip = new Set(o.skip ?? []);
    const side = o.sideShade ?? 1;
    if (!skip.has('y+')) this.quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), f, o.topShade ?? 1);
    if (!skip.has('y-')) this.quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), f, side * 0.8);
    if (!skip.has('x+')) this.quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), f, side);
    if (!skip.has('x-')) this.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), f, side);
    if (!skip.has('z+')) this.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), f, side);
    if (!skip.has('z-')) this.quad(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1), f, side);
  }

  /**
   * Soft “pillow” (superellipsoid) for cushions, cowls, fenders and rocks: exponent 2 is an ellipsoid,
   * larger values approach a rounded box.
   */
  pillow(center: V3, size: V3, f: Finish, o: { n?: number; seg?: number; shade?: (y: number) => number } = {}) {
    const n = o.n ?? 4;
    const seg = o.seg ?? 8;
    const e = 2 / n;
    const sp = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), e);
    const pts: V3[][] = [];
    for (let i = 0; i < seg * 2; i++) {
      const th = (i / (seg * 2)) * Math.PI * 2;
      const col: V3[] = [];
      for (let j = 0; j <= seg; j++) {
        const ph = (j / seg - 0.5) * Math.PI;
        col.push([center[0] + (size[0] / 2) * sp(Math.cos(ph)) * sp(Math.cos(th)), center[1] + (size[1] / 2) * sp(Math.sin(ph)), center[2] + (size[2] / 2) * sp(Math.cos(ph)) * sp(Math.sin(th))]);
      }
      pts.push(col);
    }
    this.grid(pts, f, { closeU: true, ...(o.shade ? { shade: (_i, j) => o.shade!(j / seg) } : {}) });
  }

  /** Tube swept along a polyline (parallel-transport frame). Radius may vary along the path. */
  tube(path: readonly V3[], radius: number | ((k: number) => number), sides: number, f: Finish, o: { closed?: boolean; caps?: boolean; squashY?: number } = {}) {
    const n = path.length;
    if (n < 2) return;
    const r = typeof radius === 'number' ? () => radius : radius;
    const tangent = (i: number): V3 => {
      const a = path[o.closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
      const b = path[o.closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
      return norm(sub(b, a));
    };
    let t0 = tangent(0);
    let nrm: V3 = Math.abs(t0[1]) < 0.9 ? norm(cross(t0, [0, 1, 0])) : norm(cross(t0, [1, 0, 0]));
    const rings: V3[][] = [];
    for (let i = 0; i < n; i++) {
      const t = tangent(i);
      // Parallel transport: remove the component along the new tangent.
      nrm = norm(sub(nrm, mul(t, dot(nrm, t))));
      const bin = cross(t, nrm);
      const rad = r(n === 1 ? 0 : i / (n - 1));
      const ring: V3[] = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const off = add(mul(nrm, Math.cos(a) * rad), mul(bin, Math.sin(a) * rad));
        ring.push(add(path[i]!, o.squashY ? [off[0], off[1] * o.squashY, off[2]] : off));
      }
      rings.push(ring);
      t0 = t;
    }
    // grid(): U = around (closed), V = along.
    const pts: V3[][] = [];
    for (let s = 0; s < sides; s++) {
      const col: V3[] = [];
      for (let i = 0; i < n; i++) col.push(rings[i]![s]!);
      if (o.closed) col.push(rings[0]![s]!);
      pts.push(col);
    }
    this.grid(pts, f, { closeU: true });
    if (o.caps && !o.closed) {
      this.poly(rings[0]!, f);
      this.poly(rings[n - 1]!, f);
    }
    void t0;
  }

  /** Straight tapered cylinder from a to b. */
  cyl(a: V3, b: V3, r0: number, r1: number, sides: number, f: Finish, caps = true) {
    this.tube([a, b], (k) => lerp(r0, r1, k), sides, f, { caps });
  }

  /**
   * Thin patch laid on a parametric surface (portlights, hatches, stripes, clear-vinyl panels): samples
   * `fn(u, v)` and lifts the result `offset` metres along the surface normal, away from `inside`.
   * `round` trims the corners into a stadium / rounded rectangle.
   */
  decal(fn: (u: number, v: number) => V3, range: readonly [number, number, number, number], nu: number, nv: number, offset: number, inside: V3 | ((p: V3) => V3), f: Finish, o: { round?: number } = {}) {
    const [u0, u1, v0, v1] = range;
    const e = 1e-3;
    const pts: V3[][] = [];
    for (let i = 0; i <= nu; i++) {
      const col: V3[] = [];
      for (let j = 0; j <= nv; j++) {
        const a = i / nu;
        let b = j / nv;
        if (o.round) {
          // Shrink the V extent near the U ends (superellipse profile).
          const edge = Math.abs(a * 2 - 1);
          const k = Math.pow(1 - Math.pow(edge, o.round), 1 / o.round);
          b = 0.5 + (b - 0.5) * Math.max(k, 0.02);
        }
        const u = lerp(u0, u1, a);
        const v = lerp(v0, v1, b);
        const p = fn(u, v);
        let n = norm(cross(sub(fn(u + e, v), fn(u - e, v)), sub(fn(u, v + e), fn(u, v - e))));
        const c = typeof inside === 'function' ? inside(p) : inside;
        if (dot(n, sub(p, c)) < 0) n = mul(n, -1);
        col.push(add(p, mul(n, offset)));
      }
      pts.push(col);
    }
    this.grid(pts, f);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('surf', new Float32BufferAttribute(this.srf, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.idx);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Catmull-Rom resample of a polyline into `count` evenly spaced (by parameter) points. */
export function spline(points: readonly V3[], count: number, closed = false): V3[] {
  const n = points.length;
  const get = (i: number) => points[closed ? ((i % n) + n) % n : clamp(i, 0, n - 1)]!;
  const out: V3[] = [];
  const spans = closed ? n : n - 1;
  for (let k = 0; k < count; k++) {
    const t = (k / (closed ? count : count - 1)) * spans;
    const i = Math.min(Math.floor(t), spans - 1);
    const f = t - i;
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
  }
  return out;
}
