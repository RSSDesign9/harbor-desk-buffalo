import { Color, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector2, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EN } from '../data/site.ts';

const open = (ring: readonly EN[]) => {
  const pts = [...ring];
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (a && b && a[0] === b[0] && a[1] === b[1]) pts.pop();
  return pts;
};

/** Local [e, n] ring (+ holes) → three.Shape in (x = east, y = north) shape space. */
export function ringToShape(ring: readonly EN[], holes: readonly (readonly EN[])[] = []): Shape {
  const shape = new Shape(open(ring).map(([e, n]) => new Vector2(e, n)));
  for (const h of holes) shape.holes.push(new Shape(open(h).map(([e, n]) => new Vector2(e, n))));
  return shape;
}

/**
 * Extruded prism from a local ring. Geometry is pre-rotated so shape space (e, n, depth) maps to
 * scene (x = e, y = depth, z = −n); place the mesh with position.y = base height.
 */
export function prism(ring: readonly EN[], height: number, holes: readonly (readonly EN[])[] = []): BufferGeometry {
  const g = new ExtrudeGeometry(ringToShape(ring, holes), { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Flat polygon lying on the XZ plane (y = 0) from a local ring. */
export function flat(ring: readonly EN[], holes: readonly (readonly EN[])[] = []): BufferGeometry {
  const g = new ShapeGeometry(ringToShape(ring, holes));
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Ribbon polygon (local ring) along a polyline with a width. */
export function ribbon(line: readonly EN[], width: number): EN[] {
  const left: EN[] = [];
  const right: EN[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i]!;
    const a = line[Math.max(0, i - 1)]!;
    const b = line[Math.min(line.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (width / 2);
    const ny = (dx / l) * (width / 2);
    left.push([p[0] + nx, p[1] + ny]);
    right.push([p[0] - nx, p[1] - ny]);
  }
  return [...left, ...right.reverse()];
}

/**
 * Flat ground “paint”: several coloured polygons merged into one geometry, in order. Drawn without depth
 * writes, later layers simply cover earlier ones, so overlapping yards, roads and paths cannot z-fight.
 */
export function paint(layers: readonly { ring: readonly EN[]; holes?: readonly (readonly EN[])[]; color: string; kind?: number }[]): BufferGeometry {
  const c = new Color();
  const parts = layers.map((l) => {
    const g = flat(l.ring, l.holes);
    c.set(l.color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    // Ground kind for the detail shader (ground.ts); 0 = grass.
    g.setAttribute('gkind', new Float32BufferAttribute(new Float32Array(n).fill(l.kind ?? 0), 1));
    return g;
  });
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}
