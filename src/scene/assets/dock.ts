/**
 * Dock and shore components (TASKS T09): floating headwalk and finger decks with planking, fascia boards,
 * flotation and bumper strips; piles with caps and guide hoops; cleats; power pedestals; an aluminium
 * gangway; revetment rock; a simplified tree. All authored here; placement comes from the validated
 * layout (src/scene/layout.ts) and is passed in, so this file holds no site coordinates.
 *
 * Inputs are local [east, north] metres; output is scene space (x = east, y = up, z = −north).
 * Component dimensions are ASSUME (design/ASSET-PLAN.md).
 */
import { TREE_FORMS, buildShrub, buildTree } from './foliage.ts';
import type { BufferGeometry } from 'three';
import { F } from './finishes.ts';
import { MeshBuilder, add, cross, lerp, lerp3, mul, norm, rng, sub, type V3 } from './mesh.ts';
import { addCleat } from './parts.ts';

export type EN = readonly [number, number];
const PLANK_WIDTH_M = 0.14;
const PLANKS_PER_REPEAT = 16; // must match src/scene/materials.ts
const U_PER_M = 1 / (PLANK_WIDTH_M * PLANKS_PER_REPEAT);
const at = (p: EN, y: number): V3 => [p[0], y, -p[1]];
const dist = (a: EN, b: EN) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * One deck slab from a rectangle a→b (length) × a→d (width): planked top, bumper strip, fascia, floats.
 * `uOffset` keeps plank seams continuous along a run.
 */
function deckSlab(mb: MeshBuilder, quad: readonly EN[], top: number, uOffset: number, o: { bumper?: boolean } = {}) {
  const [a, b, c, d] = quad as [EN, EN, EN, EN];
  const length = dist(a, b);
  const u0 = uOffset * U_PER_M;
  const u1 = (uOffset + length) * U_PER_M;
  mb.quad(at(a, top), at(d, top), at(c, top), at(b, top), F.deckBoard, 1, [
    [u0, 0.1],
    [u0, 0.6],
    [u1, 0.6],
    [u1, 0.1],
  ]);
  const ring: EN[] = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % 4]!;
    const trim = o.bumper ?? true ? F.bumper : F.fascia;
    mb.quad(at(p, top), at(q, top), at(q, top - 0.07), at(p, top - 0.07), trim, 0.96);
    mb.quad(at(p, top - 0.07), at(q, top - 0.07), at(q, top - 0.26), at(p, top - 0.26), F.fascia, 0.9);
  }
  // Flotation, inset so the deck edge throws a shadow line onto it.
  const cx = (a[0] + b[0] + c[0] + d[0]) / 4;
  const cn = (a[1] + b[1] + c[1] + d[1]) / 4;
  const inset = ring.map((p): EN => [lerp(p[0], cx, 0.12), lerp(p[1], cn, 0.12)]);
  for (let i = 0; i < 4; i++) {
    const p = inset[i]!;
    const q = inset[(i + 1) % 4]!;
    mb.quad(at(p, top - 0.26), at(q, top - 0.26), at(q, -0.1), at(p, -0.1), F.float, 0.8);
  }
}

export interface DockLayout {
  /** Headwalk deck rectangles in run order (from layout.deckStrip). */
  deck: readonly (readonly EN[])[];
  /** Finger rectangles (from layout.fingerPolygons): [base+, tip+, tip−, base−] and the pile position. */
  fingers: readonly { polygon: readonly EN[]; tip: EN }[];
  /** Power pedestal positions on the headwalk, and the direction each faces (toward the water). */
  pedestals: readonly { at: EN; facing: EN }[];
  /** Cleat positions on the headwalk’s water edge. */
  cleats: readonly EN[];
  deckTop: number;
  /** Finger pier height when it differs from the headwalk (floating fingers off a fixed quay). */
  fingerTop?: number;
  /** Fixed quay: a concrete apron with a wall face down to the water instead of a planked floating deck. */
  quay?: boolean;
}

/** One apron slab of a fixed quay: concrete top, a pale coping on the water edge, a wall face below. */
function quaySlab(mb: MeshBuilder, quad: readonly EN[], top: number) {
  const [a, b, c, d] = quad as [EN, EN, EN, EN];
  mb.quad(at(a, top), at(d, top), at(c, top), at(b, top), F.concrete, 1);
  const ring: EN[] = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % 4]!;
    mb.quad(at(p, top), at(q, top), at(q, top - 0.22), at(p, top - 0.22), F.bumper, 0.9);
    mb.quad(at(p, top - 0.22), at(q, top - 0.22), at(q, 0.25), at(p, 0.25), F.quayWall, 0.92);
    // Below the high-water line the wall is darker and wet.
    mb.quad(at(p, 0.25), at(q, 0.25), at(q, -0.4), at(p, -0.4), F.quayWall, 0.62);
  }
}

/** Everything fixed on one dock, merged into a single geometry (one draw call). */
export function buildDockStructure(l: DockLayout): BufferGeometry {
  const mb = new MeshBuilder();
  let run = 0;
  const fingerTop = l.fingerTop ?? l.deckTop;
  for (const q of l.deck) {
    if (l.quay) quaySlab(mb, q, l.deckTop);
    else deckSlab(mb, q, l.deckTop, run, { bumper: false });
    run += dist(q[0]!, q[1]!);
  }
  for (const f of l.fingers) {
    const [a, b, c, d] = f.polygon as [EN, EN, EN, EN];
    deckSlab(mb, [a, b, c, d], fingerTop - 0.02, 0);
    // Pile guide hoop at the outer end, and two cleats along the centreline.
    const base: EN = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2];
    const hoop: V3[] = [];
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * Math.PI * 2;
      hoop.push([f.tip[0] + Math.cos(th) * 0.25, fingerTop + 0.06, -f.tip[1] + Math.sin(th) * 0.25]);
    }
    mb.tube(hoop, 0.022, 4, F.galvanized, { closed: true });
    const dir = norm(sub(at(f.tip, 0), at(base, 0)));
    const yaw = Math.atan2(dir[2], dir[0]);
    for (const k of [0.3, 0.68]) {
      const p = lerp3(at(base, fingerTop - 0.02), at(f.tip, fingerTop - 0.02), k);
      // Cleats are modelled along x; rotate the two horn ends about the cleat centre.
      const horn = 0.12;
      const ax: V3 = [p[0] - Math.cos(yaw) * horn, p[1] + 0.05, p[2] - Math.sin(yaw) * horn];
      const bx: V3 = [p[0] + Math.cos(yaw) * horn, p[1] + 0.05, p[2] + Math.sin(yaw) * horn];
      mb.cyl(ax, bx, 0.016, 0.016, 5, F.galvanized);
      mb.cyl(p, [p[0], p[1] + 0.05, p[2]], 0.03, 0.02, 5, F.galvanized, false);
    }
  }
  for (const c of l.cleats) addCleat(mb, at(c, l.deckTop), 1.15, F.galvanized);
  for (const p of l.pedestals) addPedestal(mb, at(p.at, l.deckTop), norm([p.facing[0], 0, -p.facing[1]]));
  const g = mb.build();
  g.name = 'dock-structure';
  return g;
}

/** Shore-power pedestal: white post, dark service face toward the berths, lamp cap. */
function addPedestal(mb: MeshBuilder, base: V3, facing: V3) {
  const side = cross([0, 1, 0], facing);
  const corner = (sf: number, ss: number, y: number, w: number): V3 => add(add(base, mul(facing, sf * w)), add(mul(side, ss * w), [0, y, 0]));
  const ring = (y: number, w: number) => [corner(1, 1, y, w), corner(1, -1, y, w), corner(-1, -1, y, w), corner(-1, 1, y, w)];
  const post = [ring(0, 0.13), ring(0.92, 0.11)];
  mb.grid(
    [0, 1, 2, 3, 0].map((i) => [post[0]![i]!, post[1]![i]!]),
    F.pedestal,
    { flat: true, shade: (_i, j) => (j === 0 ? 0.85 : 1) },
  );
  mb.poly(ring(1.0, 0.085), F.lamp);
  mb.grid(
    [0, 1, 2, 3, 0].map((i) => [ring(0.92, 0.11)[i]!, ring(1.0, 0.085)[i]!]),
    F.lamp,
    { flat: true },
  );
  // Service face: outlets panel.
  const f0 = add(base, mul(facing, 0.127));
  mb.quad(add(f0, add(mul(side, -0.08), [0, 0.45, 0])), add(f0, add(mul(side, 0.08), [0, 0.45, 0])), add(f0, add(mul(side, 0.07), [0, 0.8, 0])), add(f0, add(mul(side, -0.07), [0, 0.8, 0])), F.pedestalFace);
}

/** Dock pile, origin at the waterline: weathered shaft (darker in the splash zone) with a pale cap. */
export function buildPile(): BufferGeometry {
  const mb = new MeshBuilder();
  const sides = 10;
  const levels = [-0.6, 0.0, 0.5, 1.2, 1.9];
  const tone = [0.6, 0.62, 0.86, 1, 1];
  const pts: V3[][] = [];
  for (let s = 0; s < sides; s++) {
    const th = (s / sides) * Math.PI * 2;
    pts.push(levels.map((y, j): V3 => [Math.cos(th) * (0.17 - j * 0.005), y, Math.sin(th) * (0.17 - j * 0.005)]));
  }
  mb.grid(pts, F.pile, { closeU: true, shade: (_i, j) => tone[j]! });
  mb.cyl([0, 1.9, 0], [0, 1.96, 0], 0.19, 0.19, sides, F.pileCap);
  mb.cyl([0, 1.96, 0], [0, 2.2, 0], 0.19, 0.03, sides, F.pileCap);
  const g = mb.build();
  g.name = 'pile';
  return g;
}

/**
 * Aluminium gangway from the bank down to the floating headwalk: treaded deck, top and bottom chords,
 * posts and diagonals, with a concrete abutment at the bank end.
 */
export function buildGangway(top: V3, bottom: V3, width = 1.25): BufferGeometry {
  const mb = new MeshBuilder();
  const dir = norm(sub(bottom, top));
  const side = norm(cross([0, 1, 0], dir));
  const length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1], bottom[2] - top[2]);
  const half = width / 2;
  const edge = (p: V3, s: number, dy = 0): V3 => add(add(p, mul(side, s * half)), [0, dy, 0]);
  mb.quad(edge(top, -1), edge(top, 1), edge(bottom, 1), edge(bottom, -1), F.alloy, 0.9, [
    [0, 0.1],
    [0, 0.6],
    [length * U_PER_M * 0.5, 0.6],
    [length * U_PER_M * 0.5, 0.1],
  ]);
  mb.quad(edge(top, -1, -0.1), edge(bottom, -1, -0.1), edge(bottom, 1, -0.1), edge(top, 1, -0.1), F.alloy, 0.6);
  const bays = Math.max(3, Math.round(length / 1.1));
  for (const s of [-1, 1]) {
    mb.tube([edge(top, s, 1.0), edge(bottom, s, 1.0)], 0.03, 5, F.alloy, { caps: true });
    mb.tube([edge(top, s, 0.5), edge(bottom, s, 0.5)], 0.018, 4, F.alloy);
    mb.tube([edge(top, s, 0.02), edge(bottom, s, 0.02)], 0.035, 4, F.alloy);
    for (let i = 0; i <= bays; i++) {
      const p = lerp3(top, bottom, i / bays);
      mb.cyl(edge(p, s, 0), edge(p, s, 1.0), 0.02, 0.02, 4, F.alloy, false);
      if (i < bays) mb.cyl(edge(p, s, 0.02), edge(lerp3(top, bottom, (i + 1) / bays), s, 0.5), 0.012, 0.012, 3, F.alloy, false);
    }
  }
  // Abutment and hinge plate at the bank.
  const back = add(top, mul(dir, -0.7));
  mb.box([(top[0] + back[0]) / 2, top[1] - 0.2, (top[2] + back[2]) / 2], [1.9, 0.44, 1.9], F.concrete);
  const g = mb.build();
  g.name = 'gangway';
  return g;
}

/** Revetment rock: a faceted, slightly irregular boulder about 1 m across (instanced with varied scale). */
export function buildRock(seed = 3): BufferGeometry {
  const mb = new MeshBuilder();
  const rand = rng(seed);
  const around = 5;
  const bands = 3;
  const jitter = Array.from({ length: around }, () => Array.from({ length: bands + 1 }, () => 0.7 + rand() * 0.5));
  const pts: V3[][] = [];
  for (let i = 0; i < around; i++) {
    const th = (i / around) * Math.PI * 2;
    const col: V3[] = [];
    for (let j = 0; j <= bands; j++) {
      const ph = (j / bands - 0.5) * Math.PI;
      const r = j === 0 || j === bands ? 1 : jitter[i]![j]!;
      col.push([Math.cos(ph) * Math.cos(th) * 0.5 * r, Math.sin(ph) * 0.3 * (j === bands ? 0.8 + jitter[i]![0]! * 0.3 : 1), Math.cos(ph) * Math.sin(th) * 0.5 * r]);
    }
    pts.push(col);
  }
  mb.grid(pts, F.rock, { closeU: true, flat: true, shade: (i, j) => (0.78 + 0.22 * (j / bands)) * (0.94 + 0.06 * ((i * 7 + j * 3) % 3)) });
  const g = mb.build();
  g.name = 'rock';
  return g;
}

/** Lamp post for the promenade, origin at the ground. */
export function buildLampPost(): BufferGeometry {
  const mb = new MeshBuilder();
  mb.cyl([0, 0, 0], [0, 4.2, 0], 0.07, 0.045, 6, F.float, false);
  mb.cyl([0, 0, 0], [0, 0.5, 0], 0.11, 0.09, 6, F.float, false);
  mb.pillow([0, 4.35, 0], [0.42, 0.3, 0.42], F.lamp, { n: 2.4, seg: 4 });
  mb.cyl([0, 4.5, 0], [0, 4.56, 0], 0.24, 0.2, 8, F.float);
  const g = mb.build();
  g.name = 'lamp-post';
  return g;
}

/** Standalone samples for the asset report / GLB export (real placement happens in the scene). */
export const DOCK_PARTS: Record<string, () => BufferGeometry> = {
  'dock-module-12m': () =>
    buildDockStructure({
      deck: [[[0, 0], [12, 0], [12, 2.4], [0, 2.4]]],
      fingers: [0.3, 3.65, 7.0, 10.35].map((x) => ({ polygon: [[x - 0.3, 2.4], [x - 0.3, 9.7], [x + 0.3, 9.7], [x + 0.3, 2.4]] as EN[], tip: [x, 9.7] as EN })),
      pedestals: [{ at: [3.65, 1.9], facing: [0, 1] }],
      cleats: [[2, 2.25], [5.3, 2.25], [8.7, 2.25]],
      deckTop: 0.45,
    }),
  pile: buildPile,
  gangway: () => buildGangway([0, 1.25, 0], [5.5, 0.5, 0]),
  rock: () => buildRock(),
  tree: () => buildTree(),
  'tree-tall': () => buildTree(TREE_FORMS[1]),
  'tree-young': () => buildTree(TREE_FORMS[2]),
  shrub: () => buildShrub(),
  'lamp-post': buildLampPost,
};
