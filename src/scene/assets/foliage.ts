/**
 * Trees and shrubs (TASKS T33). Three broadleaf forms and one shrub, each ONE merged geometry that the scene
 * instances with varied scale, turn and tint, so a row of trees no longer reads as one stamped model.
 *
 * A crown is a cluster of irregular leaf masses arranged around an ellipsoid, each a low sphere whose surface
 * is pushed in and out by seeded noise. Baked shading does most of the work: masses are darker underneath and
 * toward the middle of the crown, lighter on top and outside. The shared material adds leaf-scale break-up
 * (materials.ts, foliage kind). Origin at the ground; deterministic.
 */
import type { BufferGeometry } from 'three';
import { F } from './finishes.ts';
import { MeshBuilder, clamp, lerp, rng, shade, type Finish, type V3 } from './mesh.ts';

export interface TreeForm {
  seed: number;
  /** Clear trunk below the crown (m). */
  trunk: number;
  /** Crown half-width and height (m). */
  crownR: number;
  crownH: number;
  /** Leaf masses around the crown. */
  masses: number;
  /** Fewer, coarser faces per mass: for trees that are only ever seen from far away. */
  coarse?: boolean;
}
/** Broad and round; taller and oval; small and young. */
export const TREE_FORMS: readonly TreeForm[] = [
  { seed: 11, trunk: 2.5, crownR: 3.4, crownH: 5.0, masses: 24 },
  { seed: 23, trunk: 3.1, crownR: 2.8, crownH: 6.6, masses: 26 },
  { seed: 37, trunk: 1.9, crownR: 2.4, crownH: 3.7, masses: 17 },
];

type Detail = 'fine' | 'mid' | 'coarse';
const GRID: Record<Detail, readonly [number, number]> = { fine: [10, 7], mid: [8, 5], coarse: [6, 3] };

/** One irregular leaf mass. `core` is the crown centre: faces turned toward it are shaded darker. */
function leafMass(mb: MeshBuilder, c: V3, r: V3, f: Finish, core: V3, crownBottom: number, crownTop: number, rand: () => number, detail: Detail = 'mid') {
  const [around, bands] = GRID[detail];
  const bump = Array.from({ length: around }, () => Array.from({ length: bands + 1 }, () => 0.8 + rand() * 0.42));
  // Two or three broad lobes on top of the per-vertex bumps, so a mass is never a plain ball.
  const lobes = 2 + Math.floor(rand() * 2);
  const phase = rand() * Math.PI * 2;
  const depth = detail === 'coarse' ? 0 : 0.14 + rand() * 0.1;
  const pts: V3[][] = [];
  const shadeAt: number[][] = [];
  for (let i = 0; i < around; i++) {
    const th = (i / around) * Math.PI * 2;
    const col: V3[] = [];
    const sh: number[] = [];
    for (let j = 0; j <= bands; j++) {
      const ph = (j / bands - 0.5) * Math.PI;
      const k = (j === 0 || j === bands ? 0.9 : bump[i]![j]!) * (1 + depth * Math.sin(lobes * th + phase) * Math.cos(ph));
      const p: V3 = [c[0] + Math.cos(ph) * Math.cos(th) * r[0] * k, c[1] + Math.sin(ph) * r[1] * k, c[2] + Math.cos(ph) * Math.sin(th) * r[2] * k];
      col.push(p);
      // Height in the crown (sky light from above) and how far this point faces out of the crown.
      const up = clamp((p[1] - crownBottom) / (crownTop - crownBottom));
      const out: V3 = [p[0] - core[0], (p[1] - core[1]) * 0.6, p[2] - core[2]];
      const outLen = Math.hypot(out[0], out[1], out[2]) || 1;
      const n: V3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const nLen = Math.hypot(n[0], n[1], n[2]) || 1;
      const facing = (out[0] * n[0] + out[1] * n[1] + out[2] * n[2]) / (outLen * nLen);
      sh.push(lerp(0.42, 1.12, Math.pow(up, 0.75)) * lerp(0.62, 1.04, clamp(facing * 0.5 + 0.5)));
    }
    pts.push(col);
    shadeAt.push(sh);
  }
  mb.grid(pts, f, { closeU: true, shade: (i, j) => shadeAt[i]![j]!, finishAt: (i, j) => (shadeAt[i]![j]! < 0.5 ? F.leafDark : f) });
}

export function buildTree(form: TreeForm = TREE_FORMS[0]!): BufferGeometry {
  const mb = new MeshBuilder();
  const rand = rng(form.seed);
  const { trunk, crownR, crownH } = form;
  const detail: Detail = form.coarse ? 'coarse' : 'fine';
  const crownBottom = trunk * 0.8;
  const crownTop = crownBottom + crownH;
  const core: V3 = [0, crownBottom + crownH * 0.5, 0];
  // Trunk with a slight lean, and three limbs reaching into the crown.
  const lean: V3 = [(rand() - 0.5) * 0.35, trunk + crownH * 0.3, (rand() - 0.5) * 0.35];
  mb.cyl([0, 0, 0], [lean[0] * 0.5, trunk, lean[2] * 0.5], 0.24, 0.16, 7, F.bark, false);
  mb.cyl([0, 0, 0], [0, 0.22, 0], 0.36, 0.25, 7, F.bark, false); // root flare
  mb.cyl([lean[0] * 0.5, trunk, lean[2] * 0.5], lean, 0.16, 0.07, 6, F.bark, false);
  for (let i = 0; i < (form.coarse ? 0 : 3); i++) {
    const th = (i / 3) * Math.PI * 2 + rand() * 0.8;
    const reach = crownR * (0.5 + rand() * 0.2);
    mb.cyl([lean[0] * 0.5, trunk * (0.82 + rand() * 0.15), lean[2] * 0.5], [Math.cos(th) * reach, trunk + crownH * (0.28 + rand() * 0.2), Math.sin(th) * reach], 0.1, 0.04, 5, F.bark, false);
  }
  // A dark inner mass so gaps between the outer masses read as depth, not sky.
  leafMass(mb, core, [crownR * 0.62, crownH * 0.4, crownR * 0.62], shade(F.leafDark, 0.9), core, crownBottom, crownTop, rand, form.coarse ? 'coarse' : 'mid');
  // Outer masses on a jittered spiral around the crown ellipsoid; fewer underneath.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const masses: { c: V3; r: number }[] = [];
  const tone = () => {
    const t = rand();
    return t < 0.34 ? F.leaf : t < 0.67 ? shade(F.leaf, 0.9) : shade(F.leafLight, 0.98);
  };
  for (let i = 0; i < form.masses; i++) {
    const t = (i + 0.5) / form.masses;
    const y = lerp(-0.62, 0.96, t) + (rand() - 0.5) * 0.12; // −1 … 1 up the crown
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * golden + rand() * 0.5;
    const spread = 0.6 + rand() * 0.16;
    const c: V3 = [Math.cos(th) * ring * crownR * spread, core[1] + y * crownH * 0.5 * (0.62 + rand() * 0.1), Math.sin(th) * ring * crownR * spread];
    const size = crownR * (form.coarse ? 0.4 + rand() * 0.2 : 0.3 + rand() * 0.2) * (y > 0.7 ? 0.86 : 1);
    masses.push({ c, r: size });
    leafMass(mb, c, [size * (0.95 + rand() * 0.25), size * (0.72 + rand() * 0.2), size * (0.95 + rand() * 0.25)], tone(), core, crownBottom, crownTop, rand, detail);
  }
  // Tufts: small masses on the outside of the big ones. They are what breaks a crown's outline into foliage.
  for (let i = 0; i < (form.coarse ? 0 : form.masses * 2); i++) {
    const m = masses[Math.floor(rand() * masses.length)]!;
    const out: V3 = [m.c[0] - core[0], (m.c[1] - core[1]) * 0.7, m.c[2] - core[2]];
    const ol = Math.hypot(out[0], out[1], out[2]) || 1;
    // Mostly outward from the crown, with a random turn and a lift toward the light.
    const d: V3 = [out[0] / ol + (rand() - 0.5) * 1.1, out[1] / ol + rand() * 0.7, out[2] / ol + (rand() - 0.5) * 1.1];
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    const reach = m.r * (0.78 + rand() * 0.3);
    const c: V3 = [m.c[0] + (d[0] / dl) * reach, m.c[1] + (d[1] / dl) * reach * 0.8, m.c[2] + (d[2] / dl) * reach];
    const size = m.r * (0.3 + rand() * 0.22);
    leafMass(mb, c, [size * (0.9 + rand() * 0.4), size * (0.7 + rand() * 0.3), size * (0.9 + rand() * 0.4)], tone(), core, crownBottom, crownTop, rand, 'coarse');
  }
  const g = mb.build();
  g.name = `tree-${form.seed}${form.coarse ? '-far' : ''}`;
  return g;
}

/** The same three trees for the distance: a third of the masses, coarse faces, no limbs or tufts. */
export const TREE_FORMS_FAR: readonly TreeForm[] = TREE_FORMS.map((f) => ({ ...f, masses: Math.round(f.masses * 0.42), coarse: true }));

/** Background tree for the unmown ground beyond the yard: the same construction with a third of the faces. */
export const SCRUB_FORM: TreeForm = { seed: 51, trunk: 1.6, crownR: 2.9, crownH: 4.4, masses: 6, coarse: true };

/** Low rounded shrub, about 1.2 m high and 2 m across. */
export function buildShrub(seed = 5): BufferGeometry {
  const mb = new MeshBuilder();
  const rand = rng(seed);
  const core: V3 = [0, 0.5, 0];
  for (let i = 0; i < 4; i++) {
    const th = (i / 4) * Math.PI * 2 + rand();
    const d = i === 0 ? 0 : 0.45 + rand() * 0.3;
    const s = 0.55 + rand() * 0.3;
    leafMass(mb, [Math.cos(th) * d, 0.45 + rand() * 0.25, Math.sin(th) * d], [s, s * 0.8, s], rand() > 0.5 ? F.shrub : shade(F.shrub, 0.88), core, 0, 1.3, rand, 'mid');
  }
  const g = mb.build();
  g.name = 'shrub';
  return g;
}
