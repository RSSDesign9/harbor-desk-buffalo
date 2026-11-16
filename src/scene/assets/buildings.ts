/**
 * Waterfront masses for the working yard and its surroundings (TASKS T15): a concrete grain elevator,
 * metal sheds, hard-standing boat stands and a highway viaduct. All authored here as low-cost massing:
 * recognisable silhouettes, no interiors, no signage, no branding.
 *
 * Each `add…` function builds around its own origin (footprint centre on the ground, long axis along +x,
 * y up) into the caller’s MeshBuilder, so the scene can place it with a transform and merge everything
 * into a few draw calls. Dimensions come from the caller; heights are ASSUME (design/ASSET-PLAN.md).
 */
import { Matrix4, type BufferGeometry } from 'three';
import { F } from './finishes.ts';
import { MeshBuilder, lerp, rng, shade, type V3 } from './mesh.ts';

/**
 * Grain elevator: two rows of cylindrical concrete bins with a gallery along the top, a taller workhouse
 * at one end and a low shed on the land side. Unpainted concrete: this is the site’s own elevator from the
 * 2022 map, not a painted landmark from elsewhere on the river.
 *
 * T33 detail, all inside the same footprint and silhouette: slip-form lift bands and weather staining on the
 * bins, a windowed gallery with roof monitors, pilasters, a window grid, a parapet and roof plant on the
 * workhouse, an outside stair, and a conveyor bridge. No signage, no marine tower (none is sourced).
 */
export function addElevator(mb: MeshBuilder, length: number, width: number, o: { binHeight?: number; seed?: number } = {}) {
  const binH = o.binHeight ?? 30;
  const rand = rng(o.seed ?? 5);
  const dia = Math.min(12, width * 0.31);
  const r = dia / 2;
  const bankLen = length * 0.74;
  const count = Math.max(3, Math.floor(bankLen / (dia * 0.97)));
  const x0 = -length / 2 + r + 1;
  const sides = 18;
  // Slip-formed concrete shows a faint band at every lift; the base is darker (damp, splash), the top paler.
  const lifts = 10;
  const levels = Array.from({ length: lifts + 1 }, (_v, j) => j / lifts);
  for (const z of [-(r + 0.15), r + 0.15])
    for (let i = 0; i < count; i++) {
      const x = x0 + i * dia * 0.97;
      const f = shade(F.elevator, 0.93 + rand() * 0.1);
      const tone = levels.map((k, j) => lerp(0.78, 1.02, Math.pow(k, 0.6)) * (j % 2 === 0 ? 1 : 0.965) * (0.985 + rand() * 0.03));
      const pts: V3[][] = [];
      for (let sd = 0; sd < sides; sd++) {
        const th = (sd / sides) * Math.PI * 2;
        pts.push(levels.map((k): V3 => [x + Math.cos(th) * r, k * binH, z + Math.sin(th) * r]));
      }
      mb.grid(pts, f, { closeU: true, shade: (_i, j) => tone[j]! });
    }
  const bankEnd = x0 + (count - 1) * dia * 0.97 + r;
  const bankStart = x0 - r;
  const bankMid = (bankStart + bankEnd) / 2;
  const span = bankEnd - bankStart;
  // Concrete plinth the bins stand on.
  mb.box([bankMid, 0.45, 0], [span + 1.2, 0.9, dia * 2 + 1.6], shade(F.elevator, 0.8), { topShade: 0.9 });
  // Bin-top slab with a slight overhang, and the conveyor gallery along it.
  mb.box([bankMid, binH + 0.3, 0], [span + 0.8, 0.6, dia * 2 + 1.2], F.elevator, { topShade: 0.98, sideShade: 0.84 });
  const galW = 7;
  const galH = 5;
  mb.box([bankMid, binH + 0.6 + galH / 2, 0], [span - 3, galH, galW], F.elevator, { topShade: 0.86, sideShade: 0.97 });
  mb.box([bankMid, binH + 0.6 + galH + 0.12, 0], [span - 2.4, 0.24, galW + 0.7], F.roofTar, { topShade: 1 });
  // Gallery windows on both long sides, and roof monitors (ventilators) along the ridge.
  for (const zs of [-1, 1])
    for (let x = bankStart + 3.5; x < bankEnd - 5.5; x += 5.2) {
      const z = zs * (galW / 2 + 0.03);
      mb.quad([x, binH + 2.3, z], [x + 2.4, binH + 2.3, z], [x + 2.4, binH + 4.1, z], [x, binH + 4.1, z], F.window);
    }
  for (let x = bankStart + 8; x < bankEnd - 8; x += 15) mb.box([x, binH + 0.6 + galH + 0.9, 0], [3.2, 1.4, 2.2], F.elevator, { topShade: 0.8, sideShade: 0.9 });

  // Workhouse (headhouse): the tall block that gives an elevator its silhouette.
  const houseLen = length / 2 - bankEnd - 0.5;
  const hx = bankEnd + houseLen / 2;
  const houseW = Math.min(width * 0.62, dia * 2);
  const houseH = binH * 1.5;
  mb.box([hx, houseH / 2, 0], [houseLen, houseH, houseW], F.elevator, { topShade: 0.9, sideShade: 0.97 });
  // Pilasters at the corners and along the long faces; a parapet; a darker band at the base.
  const pil = 0.9;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) mb.box([hx + sx * (houseLen / 2 - pil / 2 + 0.25), houseH / 2, sz * (houseW / 2 - pil / 2 + 0.25)], [pil, houseH, pil], shade(F.elevator, 1.04), { skip: ['y-'] });
  for (const sz of [-1, 1]) mb.box([hx, houseH / 2, sz * (houseW / 2 + 0.2)], [pil, houseH, 0.4], shade(F.elevator, 1.03), { skip: ['y-'] });
  mb.box([hx, houseH + 0.5, 0], [houseLen + 0.6, 1, houseW + 0.6], shade(F.elevator, 0.96), { topShade: 0.7 });
  mb.box([hx, houseH + 0.55, 0], [houseLen - 0.4, 1.02, houseW - 0.4], F.roofTar, { skip: ['y-', 'x+', 'x-', 'z+', 'z-'], topShade: 0.9 });
  mb.box([hx, 1.4, 0], [houseLen + 0.3, 2.8, houseW + 0.3], shade(F.elevator, 0.78), { skip: ['y-', 'y+'] });
  // Penthouse and roof plant.
  mb.box([hx + houseLen * 0.12, houseH + 2.7, 0], [houseLen * 0.5, 4.4, houseW * 0.55], F.elevator, { topShade: 0.82, sideShade: 0.92 });
  mb.box([hx + houseLen * 0.12, houseH + 5.0, 0], [houseLen * 0.5 + 0.5, 0.25, houseW * 0.55 + 0.5], F.roofTar);
  mb.box([hx - houseLen * 0.3, houseH + 1.6, houseW * 0.22], [2.2, 2.2, 2.2], F.galvanized, { topShade: 0.85 });
  mb.cyl([hx - houseLen * 0.3, houseH + 1, -houseW * 0.24], [hx - houseLen * 0.3, houseH + 4.6, -houseW * 0.24], 0.7, 0.7, 10, F.galvanized);
  // Windows: small and sparse, as on a working headhouse — three floors high up, and one row above the bins.
  const rows = [binH * 0.86, binH * 1.06, binH * 1.26];
  const frame = (a: V3, b: V3, c: V3, d: V3) => mb.quad(a, b, c, d, F.window);
  for (const y of rows) {
    for (const sz of [-1, 1]) {
      const z = sz * (houseW / 2 + 0.03);
      for (const k of [-0.3, -0.12, 0.12, 0.3]) {
        const x = hx + k * houseLen - 0.7;
        frame([x, y, z], [x + 1.4, y, z], [x + 1.4, y + 1.9, z], [x, y + 1.9, z]);
        mb.box([x + 0.7, y - 0.08, z], [1.7, 0.14, 0.16], shade(F.elevator, 0.9));
      }
    }
    for (const sx of [-1, 1]) {
      const x = hx + sx * (houseLen / 2 + 0.03);
      for (const zz of [-0.22, 0.22]) {
        const wz = zz * houseW;
        frame([x, y, wz - 0.7], [x, y, wz + 0.7], [x, y + 1.9, wz + 0.7], [x, y + 1.9, wz - 0.7]);
      }
    }
  }
  // Outside steel stair up the end wall: flights and landings.
  const sx0 = hx + houseLen / 2 + 0.75;
  const flights = 9;
  for (let i = 0; i < flights; i++) {
    const y0 = 0.3 + (i * (houseH - 2)) / flights;
    const y1 = 0.3 + ((i + 1) * (houseH - 2)) / flights;
    const zA = (i % 2 === 0 ? -1 : 1) * houseW * 0.16;
    mb.box([sx0, y1, -zA], [1.3, 0.12, 1.6], F.steel);
    mb.cyl([sx0, y0 + 0.1, zA], [sx0, y1, -zA], 0.09, 0.09, 4, F.steel, false);
    mb.cyl([sx0 + 0.55, y0 + 1.1, zA], [sx0 + 0.55, y1 + 1.0, -zA], 0.035, 0.035, 3, F.steel, false);
  }
  for (const zz of [-1, 1]) mb.cyl([sx0 + 0.6, 0, zz * houseW * 0.24], [sx0 + 0.6, houseH - 1.4, zz * houseW * 0.24], 0.08, 0.08, 4, F.steel, false);
  // Conveyor bridge from the workhouse into the gallery.
  mb.box([bankEnd - 1, binH + 0.6 + galH * 0.55, 0], [6, galH * 0.7, 3.4], F.metalWall, { topShade: 0.85 });
  // Low receiving shed on the land side, with a tar roof, doors and a lean-to canopy.
  const shedX = bankMid - bankLen * 0.1;
  const shedZ = -(dia + 0.3 + 4);
  mb.box([shedX, 4.5, shedZ], [bankLen * 0.7, 9, 8], F.elevator, { topShade: 0.82, sideShade: 0.9 });
  mb.box([shedX, 9.12, shedZ], [bankLen * 0.7 + 0.5, 0.24, 8.5], F.roofTar);
  for (let i = 0; i < 4; i++) {
    const x = shedX - bankLen * 0.27 + i * bankLen * 0.18;
    mb.quad([x - 2.2, 0.05, shedZ - 4.03], [x + 2.2, 0.05, shedZ - 4.03], [x + 2.2, 4.6, shedZ - 4.03], [x - 2.2, 4.6, shedZ - 4.03], F.shedDoor, 0.9);
    mb.quad([x - 2.6, 6.2, shedZ - 4.03], [x + 2.6, 6.2, shedZ - 4.03], [x + 2.6, 7.4, shedZ - 4.03], [x - 2.6, 7.4, shedZ - 4.03], F.window);
  }
  // Rust streaks under the gallery where roof water runs down the bins (thin vertical quads on the water side).
  for (let i = 0; i < count; i++) {
    if (rand() < 0.35) continue;
    const x = x0 + i * dia * 0.97 + (rand() - 0.5) * r;
    const zf = r + 0.15 + Math.sqrt(Math.max(0, r * r - Math.pow(x - (x0 + i * dia * 0.97), 2))) + 0.02;
    const drop = 6 + rand() * 9;
    mb.quad([x - 0.35, binH - drop, zf], [x + 0.35, binH - drop, zf], [x + 0.5, binH, zf], [x - 0.5, binH, zf], shade(F.elevator, 0.8));
  }
}

/** Gabled metal shed. `doors` roll-up doors are spread along the +z long wall; `windows` adds a strip of them instead. */
export function addShed(mb: MeshBuilder, length: number, width: number, eave: number, ridge: number, o: { doors?: number; windows?: boolean; wall?: typeof F.metalWall; roof?: typeof F.metalRoof } = {}) {
  const wall = o.wall ?? F.metalWall;
  const roof = o.roof ?? F.metalRoof;
  const hl = length / 2;
  const hw = width / 2;
  mb.box([0, eave / 2, 0], [length, eave, width], wall, { skip: ['y+', 'y-'], sideShade: 1 });
  // Gable ends.
  for (const s of [-1, 1]) mb.poly([[s * hl, eave, -hw], [s * hl, eave, hw], [s * hl, ridge, 0]], wall, 0.96);
  // Roof planes with a small overhang.
  const ov = 0.5;
  const drop = ((ridge - eave) / hw) * ov;
  for (const s of [-1, 1])
    mb.quad([-hl - ov, ridge, 0], [hl + ov, ridge, 0], [hl + ov, eave - drop, s * (hw + ov)], [-hl - ov, eave - drop, s * (hw + ov)], roof, s === 1 ? 1 : 0.9);
  mb.box([0, ridge + 0.08, 0], [length + ov * 2, 0.16, 0.5], roof, { topShade: 1.1 });
  // T33: standing seams on the roof, a concrete plinth, gutters and downpipes, ridge vents.
  const slope = Math.hypot(hw + ov, ridge - (eave - drop));
  const tilt = Math.atan2(ridge - (eave - drop), hw + ov);
  for (const sd of [-1, 1])
    for (let x = -hl - ov + 0.6; x < hl + ov; x += 1.5)
      mb.with(new Matrix4().makeTranslation(x, (ridge + eave - drop) / 2 + 0.03, (sd * (hw + ov)) / 2).multiply(new Matrix4().makeRotationX(sd * tilt)), () => mb.box([0, 0, 0], [0.07, 0.06, slope], roof, { topShade: sd === 1 ? 1.12 : 1, skip: ['y-'] }));
  mb.box([0, 0.2, 0], [length + 0.3, 0.4, width + 0.3], F.concrete, { skip: ['y-'], topShade: 0.9 });
  for (const sd of [-1, 1]) {
    mb.box([0, eave - drop - 0.05, sd * (hw + ov + 0.08)], [length + ov * 2, 0.16, 0.18], F.galvanized);
    for (const ex of [-1, 1]) mb.cyl([ex * (hl - 0.2), 0.4, sd * (hw + 0.1)], [ex * (hl - 0.2), eave - drop, sd * (hw + 0.1)], 0.06, 0.06, 5, F.galvanized, false);
  }
  for (let x = -hl * 0.6; x <= hl * 0.61; x += hl * 0.6) mb.box([x, ridge + 0.45, 0], [1.4, 0.6, 0.9], F.galvanized, { topShade: 0.9 });
  const z = hw + 0.04;
  if (o.doors) {
    const pitch = length / (o.doors + 1);
    for (let i = 1; i <= o.doors; i++) {
      const x = -hl + i * pitch;
      const dw = Math.min(5, pitch * 0.55) / 2;
      const dh = Math.min(eave - 0.8, 5);
      mb.quad([x - dw, 0.02, z], [x + dw, 0.02, z], [x + dw, dh, z], [x - dw, dh, z], F.shedDoor);
      // Roll-up door slats and a header.
      for (let y = 0.5; y < dh; y += 0.5) mb.quad([x - dw, y, z + 0.01], [x + dw, y, z + 0.01], [x + dw, y + 0.05, z + 0.01], [x - dw, y + 0.05, z + 0.01], F.shedDoor, 0.82);
      mb.box([x, dh + 0.12, z], [dw * 2 + 0.3, 0.24, 0.12], F.steel);
    }
  }
  if (o.windows) {
    for (let x = -hl + 2; x < hl - 2.5; x += 3.4) {
      mb.quad([x, 1.1, z], [x + 1.5, 1.1, z], [x + 1.5, 2.3, z], [x, 2.3, z], F.window);
      mb.box([x + 0.75, 1.05, z + 0.03], [1.7, 0.08, 0.1], F.shedDoor);
    }
    mb.quad([hl - 1.9, 0.02, z], [hl - 0.9, 0.02, z], [hl - 0.9, 2.1, z], [hl - 1.9, 2.1, z], F.shedDoor);
  }
}

/**
 * Hard-standing support for a hauled-out boat whose hull pivot (waterline, centreline) is at the origin
 * raised `lift` metres above the ground: keel blocks down the centreline and four jack stands at the bilge.
 * `keel` is how far the keel hangs below the waterline.
 */
export function addBoatStand(mb: MeshBuilder, lengthM: number, beamM: number, lift: number, keel: number) {
  const keelY = lift - keel;
  for (const kx of [-0.28, 0.02, 0.3]) mb.box([kx * lengthM, keelY / 2, 0], [0.45, keelY, 0.4], F.standBlock, { topShade: 0.9 });
  for (const sx of [-0.24, 0.22])
    for (const sz of [-1, 1]) {
      const foot: V3 = [sx * lengthM, 0, sz * (beamM * 0.5 + 0.35)];
      const head: V3 = [sx * lengthM, lift - keel * 0.35, sz * beamM * 0.3];
      mb.cyl(foot, head, 0.05, 0.04, 5, F.standPaint, false);
      // Tripod feet.
      for (const a of [0.5, 2.6, 4.7]) mb.cyl([foot[0] + Math.cos(a) * 0.42, 0, foot[2] + Math.sin(a) * 0.42], [lerp(foot[0], head[0], 0.3), lerp(foot[1], head[1], 0.3), lerp(foot[2], head[2], 0.3)], 0.03, 0.03, 3, F.standPaint, false);
      mb.box([head[0], head[1], head[2]], [0.34, 0.06, 0.24], F.standBlock);
    }
}

/**
 * Highway viaduct along +x: a slab on steel girders, parapets, a median barrier, lane lines and light poles,
 * carried on two-column bents with cap beams down to `groundY` (water or land).
 * Pier spacing and every detail on the deck are ASSUME; the caller places the whole span approximately.
 */
export function addViaduct(mb: MeshBuilder, length: number, width: number, deckY: number, o: { spacing?: number; groundY?: number } = {}) {
  const spacing = o.spacing ?? 58;
  const ground = o.groundY ?? -1;
  const hw = width / 2;
  // Deck slab with an asphalt surface; girders below it.
  mb.box([0, deckY - 0.3, 0], [length, 0.6, width], F.viaduct, { topShade: 0.6, sideShade: 0.97 });
  mb.quad([-length / 2, deckY + 0.01, -hw + 0.6], [-length / 2, deckY + 0.01, hw - 0.6], [length / 2, deckY + 0.01, hw - 0.6], [length / 2, deckY + 0.01, -hw + 0.6], F.roofTar, 0.95);
  const girders = 6;
  for (let i = 0; i < girders; i++) {
    const z = lerp(-hw + 1.4, hw - 1.4, i / (girders - 1));
    mb.box([0, deckY - 1.5, z], [length, 1.8, 0.5], F.steel, { skip: ['y+'], sideShade: i === 0 || i === girders - 1 ? 1 : 0.7 });
  }
  // Parapets, a median barrier and lane lines.
  for (const sd of [-1, 1]) mb.box([0, deckY + 0.5, sd * (hw - 0.25)], [length, 1.0, 0.5], F.viaduct, { topShade: 1.02 });
  mb.box([0, deckY + 0.42, 0], [length, 0.84, 0.6], F.viaduct, { topShade: 1.02 });
  const lanes = [-hw * 0.56, hw * 0.56];
  for (const z of lanes) for (let x = -length / 2 + 4; x < length / 2 - 4; x += 12) mb.quad([x, deckY + 0.03, z - 0.08], [x, deckY + 0.03, z + 0.08], [x + 3.2, deckY + 0.03, z + 0.08], [x + 3.2, deckY + 0.03, z - 0.08], F.roadLine);
  for (const sd of [-1, 1]) {
    const z = sd * (hw - 0.9);
    mb.quad([-length / 2, deckY + 0.03, z - 0.07], [-length / 2, deckY + 0.03, z + 0.07], [length / 2, deckY + 0.03, z + 0.07], [length / 2, deckY + 0.03, z - 0.07], F.roadLine, 0.92);
  }
  // Light poles on alternate sides.
  let side = 1;
  for (let x = -length / 2 + 20; x < length / 2 - 10; x += 44) {
    const z = side * (hw - 0.25);
    mb.cyl([x, deckY + 1, z], [x, deckY + 10, z], 0.11, 0.07, 5, F.galvanized, false);
    mb.cyl([x, deckY + 10, z], [x, deckY + 10.4, z - side * 2.2], 0.05, 0.05, 4, F.galvanized, false);
    mb.box([x, deckY + 10.35, z - side * 2.4], [0.7, 0.14, 0.34], F.lamp);
    side = -side;
  }
  // Bents: two round columns under a cap beam; an expansion joint line over each.
  const n = Math.floor(length / spacing);
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (length - n * spacing) / 2 + i * spacing;
    const capY = deckY - 2.4;
    mb.box([x, capY - 1.0, 0], [2.6, 2.0, width * 0.9], F.viaduct, { sideShade: 0.9, topShade: 0.7 });
    for (const sd of [-1, 1]) {
      const z = sd * width * 0.27;
      const pts: V3[][] = [];
      const sides = 10;
      for (let k = 0; k < sides; k++) {
        const th = (k / sides) * Math.PI * 2;
        pts.push([ground, lerp(ground, capY - 2, 0.25), capY - 2].map((y): V3 => [x + Math.cos(th) * 1.25, y, z + Math.sin(th) * 1.25]));
      }
      // Darker at the foot: tide marks on a pier in water, splash and grime on one on land.
      mb.grid(pts, F.viaduct, { closeU: true, shade: (_i, j) => [0.7, 0.9, 0.98][j]! });
    }
    mb.quad([x - 0.12, deckY + 0.025, -hw + 0.6], [x - 0.12, deckY + 0.025, hw - 0.6], [x + 0.12, deckY + 0.025, hw - 0.6], [x + 0.12, deckY + 0.025, -hw + 0.6], F.steel, 0.7);
  }
}

/**
 * Parked car, about 4.5 m long, nose along +x, origin on the ground at its centre. A plain three-box saloon:
 * body, cabin with dark glass, wheels. White, so the scene can tint each instance (T33 scenery; no make).
 */
export function buildCar(): BufferGeometry {
  const mb = new MeshBuilder();
  const paintF = { rgb: [1, 1, 1] as const, rough: 0.35, metal: 0.25, kind: 0 };
  // Body: a boxy lower shell with rounded corners; bonnet and boot a little lower than the waistline.
  mb.pillow([0, 0.6, 0], [4.45, 0.66, 1.8], paintF, { n: 7, seg: 5, shade: (y) => 0.86 + 0.14 * (y > 0 ? 1 : 0) });
  // Cabin: glass all round, tapering to a painted roof.
  const base: [number, number][] = [[-1.45, 0.78], [0.95, 0.78], [0.95, -0.78], [-1.45, -0.78]];
  const top: [number, number][] = [[-1.0, 0.62], [0.35, 0.62], [0.35, -0.62], [-1.0, -0.62]];
  for (let i = 0; i < 4; i++) {
    const a0 = base[i]!;
    const a1 = base[(i + 1) % 4]!;
    const b0 = top[i]!;
    const b1 = top[(i + 1) % 4]!;
    mb.quad([a0[0], 0.9, a0[1]], [a1[0], 0.9, a1[1]], [b1[0], 1.4, b1[1]], [b0[0], 1.4, b0[1]], F.carGlass);
  }
  mb.quad([top[0]![0], 1.4, top[0]![1]], [top[1]![0], 1.4, top[1]![1]], [top[2]![0], 1.4, top[2]![1]], [top[3]![0], 1.4, top[3]![1]], paintF);
  for (const sx of [-1.4, 1.38])
    for (const sz of [-1, 1]) mb.cyl([sx, 0.33, sz * 0.72], [sx, 0.33, sz * 0.93], 0.33, 0.33, 10, F.tyre);
  const g = mb.build();
  g.name = 'car';
  return g;
}

const sample = (name: string, fn: (mb: MeshBuilder) => void) => (): BufferGeometry => {
  const mb = new MeshBuilder();
  fn(mb);
  const g = mb.build();
  g.name = name;
  return g;
};

/** Standalone samples for the asset report / GLB export (real placement happens in the scene). */
export const BUILDING_PARTS: Record<string, () => BufferGeometry> = {
  'grain-elevator-104x38m': sample('grain-elevator', (mb) => addElevator(mb, 104, 38)),
  'service-shed-36x22m': sample('service-shed', (mb) => addShed(mb, 36, 22, 6.5, 9.4, { doors: 3 })),
  'office-20x16m': sample('office', (mb) => addShed(mb, 20, 16, 3.4, 5.4, { windows: true })),
  'boat-stand-8m': sample('boat-stand', (mb) => addBoatStand(mb, 8.2, 2.8, 1.5, 0.55)),
  'viaduct-232m': sample('viaduct', (mb) => addViaduct(mb, 232, 28, 30)),
};
