/**
 * Cabin cruiser (express cruiser), the main boat family and the hull used for the B-12 observation.
 * Authored parametric geometry: lofted hull, crowned foredeck and cabin trunk, wrapped raked windshield,
 * cockpit well with seating, radar arch, camper canvas with clear-vinyl panels, bow rail, cleats, fenders,
 * swim platform. Nothing here knows which vessel it is drawing.
 *
 * LOD 0 = selected-slip detail, LOD 1 = dock distance, LOD 2 = far silhouette.
 */
import { F, CANVAS_FINISH, HULL_FINISH } from './finishes.ts';
import { addHull, halfBeam, hullPoint, sectionHalf, sheerLoop, sheerPoint, sheerY, stationAt, stationX, type HullForm } from './hull.ts';
import { finish, lerp, lerp3, norm, cross, add, mul, shade, smooth, spline, sub, type MeshBuilder, type V3 } from './mesh.ts';
import { addCleat, addFender, type BoatParams, type Lod } from './parts.ts';
import { TOKEN_COLORS as T } from '../palette.ts';

const NAVY_STRIPE = finish(T.silo_blue, 0.4);

/** The cruiser's hull form, shared with the name-board placement (src/scene/assets/nameboard.ts). */
export function cruiserHullForm(lengthM: number, beamM: number): HullForm {
  const L = lengthM;
  const plat = 0.07 * L;
  const fbS = 0.104 * L;
  return { kind: 'power', x0: -L / 2 + plat, length: L - plat, beam: beamM, fbStern: fbS, fbMid: fbS, fbBow: fbS * 1.48, stemRake: 0.1 * L, sternRake: 0 };
}

export function buildCruiser(mb: MeshBuilder, p: BoatParams, lod: Lod) {
  const L = p.lengthM;
  const k = L / 8.7; // proportions were drawn for a 28.5 ft boat
  const fbS = 0.104 * L;
  const h: HullForm = cruiserHullForm(L, p.beamM);
  const white = p.hull === 'white';
  const hullF = HULL_FINISH[p.hull];
  const pick = <A>(a: A, b: A, c: A): A => (lod === 0 ? a : lod === 1 ? b : c);
  const stations = pick(34, 16, 8);

  addHull(mb, h, { topsides: hullF, boot: white ? NAVY_STRIPE : F.gelcoat, bottom: F.antifoul }, stations, pick(6, 3, 2));

  const X = (t: number) => stationX(h, t, sheerY(h, t));
  const LIFT = 0.025;
  const tC0 = 0.05; // cockpit aft wall
  const tC1 = 0.5; // cabin bulkhead
  const coaming = 0.2 * k;
  const yFloor = fbS - 0.58 * k;
  const hbIn = (t: number) => Math.max(halfBeam(h, t) - 0.03, 0.006);
  const zin = (t: number) => halfBeam(h, t) - coaming;
  const bump = (t: number) => 0.36 * k * (1 - smooth(0.7, 0.97, t));
  const deckY = (t: number, z: number) => {
    const w = Math.min(1, Math.abs(z) / hbIn(t));
    return sheerY(h, t) + LIFT + bump(t) * (1 - smooth(0.42, 0.8, w)) + 0.03 * (1 - w * w);
  };
  const deckPoint = (t: number, w: number): V3 => [X(t), deckY(t, w * hbIn(t)), w * hbIn(t)];

  // --- Foredeck and cabin trunk: one crowned surface from the bulkhead to the stem.
  {
    const nT = pick(20, 9, 4);
    const nW = pick(16, 8, 4);
    const pts: V3[][] = [];
    for (let i = 0; i <= nT; i++) {
      const t = lerp(tC1, 1, i / nT);
      const col: V3[] = [];
      for (let j = 0; j <= nW; j++) col.push(deckPoint(t, (j / nW) * 2 - 1));
      pts.push(col);
    }
    mb.grid(pts, F.gelcoat);
  }

  // --- Rub rail around the sheer.
  if (lod <= 1) mb.tube(sheerLoop(h, stations, -0.012, 0), 0.03 * k, pick(6, 4, 3), F.rubRail, { closed: true });

  // --- Cockpit: coaming tops, well, bulkhead.
  const yC = (t: number) => sheerY(h, t) + LIFT;
  {
    const n = pick(10, 5, 2);
    for (const side of [1, -1] as const) {
      const top: V3[][] = [];
      const wall: V3[][] = [];
      for (let i = 0; i <= n; i++) {
        const t = lerp(0, tC1, i / n);
        top.push([sheerPoint(h, t, side, 0.03, LIFT), [X(t), yC(t), side * zin(t)]]);
        const tw = lerp(tC0, tC1, i / n);
        wall.push([
          [X(tw), yFloor, side * zin(tw)],
          [X(tw), yC(tw), side * zin(tw)],
        ]);
      }
      mb.grid(top, F.gelcoat);
      if (lod <= 1) mb.grid(wall, F.gelcoat, { shade: (_i, j) => (j === 0 ? 0.72 : 0.92) });
    }
    const z0 = zin(tC0);
    mb.quad([X(0), yC(0), -zin(0)], [X(0), yC(0), zin(0)], [X(tC0), yC(tC0), z0], [X(tC0), yC(tC0), -z0], F.gelcoat);
    const z1 = zin(tC1);
    if (lod <= 1) {
      mb.quad([X(tC0), yFloor, -z0], [X(tC0), yFloor, z0], [X(tC0), yC(tC0), z0], [X(tC0), yC(tC0), -z0], F.gelcoat, 0.86);
      mb.quad([X(tC0), yFloor, -z0], [X(tC1), yFloor, -z1], [X(tC1), yFloor, z1], [X(tC0), yFloor, z0], F.sole, 0.84);
      // Cabin bulkhead: follows the crown of the cabin top.
      const nb = 8;
      const face: V3[][] = [];
      for (let j = 0; j <= nb; j++) {
        const z = lerp(-z1, z1, j / nb);
        face.push([
          [X(tC1), yFloor, z],
          [X(tC1), deckY(tC1, z), z],
        ]);
      }
      mb.grid(face, F.gelcoat, { shade: (_i, j) => (j === 0 ? 0.74 : 0.9) });
      // Companionway door.
      const dx = X(tC1) - 0.012;
      mb.quad([dx, yFloor + 0.06, -0.34 * k], [dx, yFloor + 0.06, 0.26 * k], [dx, deckY(tC1, 0) - 0.07, 0.26 * k], [dx, deckY(tC1, 0) - 0.07, -0.34 * k], F.glass);
    } else if (p.canvas === 'none') {
      mb.quad([X(tC0), yC(0) - 0.14, -z0], [X(tC1), yC(0) - 0.14, -z1], [X(tC1), yC(0) - 0.14, z1], [X(tC0), yC(0) - 0.14, z0], F.sole, 0.7);
    }
  }

  // --- Cockpit furniture (hidden under canvas at distance, so LOD 0/1 only).
  if (lod <= 1) {
    const seg = pick(6, 4, 3);
    const xA = X(tC0);
    const z0 = zin(tC0);
    const occ = (y: number) => lerp(0.8, 1, y);
    mb.pillow([xA + 0.27 * k, yFloor + 0.22 * k, 0], [0.5 * k, 0.44 * k, 2 * z0 - 0.06], F.cushion, { seg, n: 5, shade: occ });
    mb.pillow([xA + 0.08 * k, yFloor + 0.55 * k, 0], [0.16 * k, 0.44 * k, 2 * z0 - 0.06], F.cushion, { seg, n: 5 });
    const zh = zin(0.36) * 0.52;
    mb.pillow([X(0.36), yFloor + 0.3 * k, zh], [0.5 * k, 0.6 * k, 0.6 * k], F.cushion, { seg, n: 5, shade: occ });
    mb.pillow([X(0.36) - 0.2 * k, yFloor + 0.78 * k, zh], [0.14 * k, 0.5 * k, 0.58 * k], F.cushion, { seg, n: 5 });
    const zl = -zin(0.33) + 0.34 * k;
    mb.pillow([X(0.33), yFloor + 0.22 * k, zl], [1.15 * k, 0.44 * k, 0.6 * k], F.cushion, { seg, n: 5, shade: occ });
    mb.pillow([X(0.33), yFloor + 0.52 * k, -zin(0.33) + 0.09 * k], [1.15 * k, 0.4 * k, 0.15 * k], F.cushion, { seg, n: 5 });
    if (lod === 0) {
      // Helm: wheel on a short column at the bulkhead.
      const c: V3 = [X(tC1) - 0.2 * k, yFloor + 1.0 * k, zh];
      const ring: V3[] = [];
      for (let a = 0; a < 14; a++) {
        const th = (a / 14) * Math.PI * 2;
        ring.push([c[0] + Math.sin(th) * 0.19 * k * 0.45, c[1] + Math.sin(th) * 0.19 * k * 0.9, c[2] + Math.cos(th) * 0.19 * k]);
      }
      mb.tube(ring, 0.016 * k, 5, F.stainless, { closed: true });
      mb.cyl(c, [X(tC1), c[1] - 0.12 * k, zh], 0.025 * k, 0.03 * k, 6, F.rubber, false);
      mb.box([X(tC1) - 0.07 * k, yFloor + 1.12 * k, zh], [0.14 * k, 0.2 * k, 0.6 * k], F.rubber);
    }
  }

  // --- Windshield: wrapped, raked glass with an alloy frame.
  const xWf = X(0.655);
  const xWb = X(0.45);
  const zW = 0.8 * hbIn(0.5);
  const ysRef = sheerY(h, tC1) + LIFT;
  const wsBase = (phi: number): V3 => {
    const c = Math.cos(phi);
    const x = xWb + (xWf - xWb) * Math.pow(Math.max(c, 0), 0.75);
    const z = zW * Math.sign(phi) * Math.pow(Math.abs(Math.sin(phi)), 0.85);
    return [x, deckY(stationAt(h, x), z), z];
  };
  const wsTop = (phi: number): V3 => {
    const c = Math.max(Math.cos(phi), 0);
    const b = wsBase(phi);
    return [b[0] - 0.62 * k * Math.pow(c, 0.8) - 0.05 * k, ysRef + lerp(0.42, 1.0, Math.pow(c, 0.45)) * k, b[2] * 0.88];
  };
  {
    const n = pick(30, 14, 8);
    const pts: V3[][] = [];
    const top: V3[] = [];
    const base: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const phi = lerp(-Math.PI / 2, Math.PI / 2, i / n);
      const a = wsBase(phi);
      const b = wsTop(phi);
      const mid = lerp3(a, b, 0.5);
      const out = norm([Math.cos(phi), 0, Math.sin(phi)]);
      pts.push([a, add(mid, mul(out, 0.035 * k)), b]);
      top.push(b);
      base.push(a);
    }
    mb.grid(pts, F.glass);
    if (lod <= 1) {
      mb.tube(top, 0.022 * k, pick(6, 4, 3), F.alloy, { caps: true });
      for (const phi of [-1.02, -0.38, 0.38, 1.02]) mb.cyl(wsBase(phi), wsTop(phi), 0.017 * k, 0.017 * k, pick(5, 3, 3), F.alloy, false);
      for (const phi of [-Math.PI / 2, Math.PI / 2]) mb.cyl(wsBase(phi), wsTop(phi), 0.02 * k, 0.02 * k, pick(5, 3, 3), F.alloy, false);
    }
    if (lod === 0) mb.tube(base, 0.016 * k, 4, F.rubber);
  }

  // --- Radar arch.
  const tA = 0.16;
  const archFoot: V3 = [X(tA), yC(tA), halfBeam(h, tA) - 0.1 * k];
  const archTop: V3 = [archFoot[0] + 0.4 * k, archFoot[1] + 1.3 * k, 0];
  if (lod <= 1 && p.canvas === 'none') {
    const half: V3[] = [archFoot, [archFoot[0] + 0.2 * k, archFoot[1] + 0.75 * k, archFoot[2] * 0.94], [archFoot[0] + 0.36 * k, archFoot[1] + 1.2 * k, archFoot[2] * 0.72], archTop];
    const ctrl: V3[] = [...half, ...half.slice(0, -1).reverse().map((q): V3 => [q[0], q[1], -q[2]])];
    const path = spline(ctrl, pick(25, 11, 7));
    const rings: V3[][] = [];
    const sides = pick(10, 6, 4);
    for (let i = 0; i < path.length; i++) {
      const tan = norm(sub(path[Math.min(i + 1, path.length - 1)]!, path[Math.max(i - 1, 0)]!));
      const n = norm(cross(tan, [1, 0, 0]));
      const edge = Math.abs(i / (path.length - 1) - 0.5) * 2; // 1 at the feet, 0 at the top
      const chord = lerp(0.22, 0.36, edge) * k;
      const ring: V3[] = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.6);
        const cy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.6);
        ring.push(add(path[i]!, add([(cx * chord) / 2, 0, 0], mul(n, cy * 0.04 * k))));
      }
      rings.push(ring);
    }
    const pts: V3[][] = [];
    for (let s = 0; s < sides; s++) pts.push(rings.map((r) => r[s]!));
    mb.grid(pts, F.gelcoat, { closeU: true });
    {
      mb.pillow([archTop[0], archTop[1] + 0.13 * k, 0], [0.46 * k, 0.2 * k, 0.46 * k], F.gelcoat, { n: 2.6, seg: pick(6, 4, 3) });
      mb.cyl([archTop[0] - 0.1 * k, archTop[1], 0.3 * k], [archTop[0] - 0.1 * k, archTop[1] + 0.4 * k, 0.3 * k], 0.012 * k, 0.008 * k, 4, F.gelcoat);
    }
  }

  // --- Camper canvas: from the windshield top over the arch, sloping to the transom coaming.
  if (p.canvas !== 'none') {
    const cf = CANVAS_FINISH[p.canvas];
    const xA = wsTop(0)[0] + 0.02 * k;
    const xB = X(0.015);
    const xWingEnd = wsTop(Math.PI / 2)[0];
    const yPeak = fbS + 1.42 * k;
    const sArch = (xA - archTop[0]) / (xA - xB);
    const yAft = yC(0) + 0.42 * k;
    const lowAt = (x: number): { z: number; y: number } => {
      const t = stationAt(h, x);
      const co = { z: halfBeam(h, t) - 0.07 * k, y: yC(t) };
      if (x <= xWingEnd - 0.3 * k) return co;
      // Along the windshield wing the curtain meets the top of the glass.
      let lo = 0;
      let hi = Math.PI / 2;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (wsTop(mid)[0] > x) lo = mid;
        else hi = mid;
      }
      const w = wsTop(Math.min((lo + hi) / 2, Math.PI / 2));
      const wing = { z: w[2] + 0.02 * k, y: w[1] + 0.012 * k };
      const f = smooth(xWingEnd - 0.3 * k, xWingEnd + 0.02 * k, x);
      return { z: lerp(co.z, wing.z, f), y: lerp(co.y, wing.y, f) };
    };
    const topAt = (s: number) => {
      const front = lerp(wsTop(0)[1] + 0.03 * k, yPeak, smooth(0, 0.34, s));
      const aft = lerp(yPeak, yAft, Math.pow(smooth(sArch, 1, s), 1.15));
      const sag = s < sArch ? 0.026 * k * Math.pow(Math.sin(Math.PI * (s / sArch) * 3), 2) : 0;
      return (s < sArch ? front : aft) - sag;
    };
    const E = 2 / 3.4;
    const canvasPoint = (s: number, th: number): V3 => {
      const x = lerp(xA, xB, s);
      const low = lowAt(x);
      const c = Math.cos(th);
      const top = Math.max(topAt(s), low.y + 0.02);
      return [x, low.y + (top - low.y) * Math.pow(Math.max(Math.sin(th), 0), E), low.z * Math.sign(c) * Math.pow(Math.abs(c), E)];
    };
    const nS = pick(26, 10, 5);
    const nT = pick(18, 8, 5);
    const pts: V3[][] = [];
    for (let i = 0; i <= nS; i++) {
      const col: V3[] = [];
      for (let j = 0; j <= nT; j++) col.push(canvasPoint(i / nS, (j / nT) * Math.PI));
      pts.push(col);
    }
    mb.grid(pts, cf, { shade: (_i, j) => lerp(0.86, 1, Math.sin((j / nT) * Math.PI)) });
    mb.poly(pts[nS]!, cf, 0.9);
    if (lod <= 1) {
      const inside = (q: V3): V3 => [q[0], fbS, 0];
      const windows: [number, number, number, number][] = [
        [0.2, 0.43, 0.05 * Math.PI, 0.25 * Math.PI],
        [0.49, sArch - 0.03, 0.05 * Math.PI, 0.25 * Math.PI],
      ];
      for (const w of windows) {
        mb.decal(canvasPoint, w, pick(8, 4, 2), pick(4, 2, 2), 0.012, inside, F.vinyl, { round: 8 });
        mb.decal(canvasPoint, [w[0], w[1], Math.PI - w[3], Math.PI - w[2]], pick(8, 4, 2), pick(4, 2, 2), 0.012, inside, F.vinyl, { round: 8 });
      }
      mb.decal(canvasPoint, [sArch + 0.14, 0.93, 0.36 * Math.PI, 0.64 * Math.PI], pick(8, 4, 2), pick(8, 4, 2), 0.012, inside, F.vinyl, { round: 8 });
    }
  }

  // --- Bow rail with stanchions.
  if (lod <= 1) {
    const railH = (t: number) => (0.56 - 0.1 * smooth(0.7, 1, t)) * k;
    const ts = [0.5, 0.53, 0.57, 0.65, 0.74, 0.83, 0.91, 0.97];
    const railPt = (t: number, side: 1 | -1, f = 1): V3 => sheerPoint(h, t, side, 0.08 * k, LIFT + railH(t) * f);
    const half = ts.map((t, i) => railPt(t, 1, i === 0 ? 0 : i === 1 ? 0.8 : 1));
    const tip: V3 = [X(1) + 0.1 * k, sheerY(h, 1) + LIFT + railH(1), 0];
    const ctrl: V3[] = [...half, tip, ...half.map((q): V3 => [q[0], q[1], -q[2]]).reverse()];
    mb.tube(lod === 0 ? spline(ctrl, 46) : ctrl, 0.02 * k, pick(6, 4, 3), F.stainless, { caps: true });
    for (const side of [1, -1] as const)
      for (const t of lod === 0 ? [0.57, 0.65, 0.74, 0.83, 0.91, 0.97] : [0.57, 0.74, 0.91]) mb.cyl(sheerPoint(h, t, side, 0.08 * k, LIFT), railPt(t, side), 0.014 * k, 0.014 * k, pick(5, 3, 3), F.stainless, false);
    mb.cyl([X(1) - 0.02, sheerY(h, 1) + LIFT, 0], tip, 0.014 * k, 0.014 * k, pick(5, 3, 3), F.stainless, false);
  }

  // --- Swim platform.
  {
    const wp = halfBeam(h, 0) * 0.97;
    const r = 0.2 * k;
    const xa = -L / 2;
    const xf = h.x0 + 0.03;
    const yTop = 0.31 * k;
    const ring: V3[] = [[xf, yTop, wp]];
    const arc = pick(5, 3, 1);
    for (let i = 0; i <= arc; i++) {
      const a = (i / arc) * (Math.PI / 2);
      ring.push([xa + r - Math.sin(a) * r, yTop, wp - r + Math.cos(a) * r]);
    }
    for (let i = arc; i >= 0; i--) {
      const a = (i / arc) * (Math.PI / 2);
      ring.push([xa + r - Math.sin(a) * r, yTop, -(wp - r) - Math.cos(a) * r]);
    }
    ring.push([xf, yTop, -wp]);
    mb.poly(ring, F.gelcoat);
    mb.grid(
      ring.map((q) => [q, [q[0], yTop - 0.1 * k, q[2]] as V3]),
      F.gelcoat,
      { shade: (_i, j) => (j === 0 ? 1 : 0.7) },
    );
    if (lod <= 1) mb.poly(ring.map((q): V3 => [lerp(q[0], (xa + xf) / 2, 0.16) , yTop + 0.006, q[2] * 0.88]), F.sole);
  }

  // --- Hull graphics and glazing, laid on the hull and deck surfaces.
  if (lod <= 1) {
    for (const side of [1, -1] as const) {
      const onHull = (t: number, v: number) => hullPoint(h, t, v * sheerY(h, t), side);
      const inside = (q: V3): V3 => [q[0], q[1], 0];
      mb.decal(onHull, [0.012, 0.972, 0.82, 0.9], pick(32, 14, 6), 1, 0.006, inside, white ? NAVY_STRIPE : F.gelcoat);
      mb.decal(onHull, [0.6, 0.84, 0.56, 0.74], pick(12, 5, 3), 2, 0.008, inside, F.glass, { round: 3 });
    }
    const below = (q: V3): V3 => [q[0], 0, q[2]];
    mb.decal(deckPoint, [0.74, 0.8, -0.24, 0.24], pick(8, 4, 2), pick(6, 3, 2), 0.014, below, F.glass, { round: 5 });
    if (lod === 0) mb.decal(deckPoint, [0.855, 0.895, -0.26, 0.26], 8, 4, 0.014, below, F.glass, { round: 5 });
  }

  // --- Deck hardware.
  if (lod === 0) {
    for (const side of [1, -1] as const) {
      addCleat(mb, sheerPoint(h, 0.07, side, 0.1 * k, LIFT), k);
      addCleat(mb, sheerPoint(h, 0.52, side, 0.09 * k, LIFT), k);
      addCleat(mb, sheerPoint(h, 0.93, side, 0.07 * k, LIFT), k);
    }
    // Bow roller and anchor.
    const bx = X(1);
    mb.box([bx + 0.08 * k, sheerY(h, 1) + 0.045, 0], [0.42 * k, 0.05 * k, 0.15 * k], F.alloy);
    mb.pillow([bx + 0.2 * k, sheerY(h, 1) - 0.05 * k, 0], [0.3 * k, 0.12 * k, 0.2 * k], shade(F.galvanized, 0.8), { n: 2.2, seg: 4 });
  }
  if (lod <= 1) {
    for (const side of [1, -1] as const)
      for (const t of [0.27, 0.6]) {
        const y = sheerY(h, t) * 0.46;
        addFender(mb, [stationX(h, t, y), y, side * (sectionHalf(h, t, y) + 0.105 * k)], sheerPoint(h, t, side, 0.02, LIFT), k, lod);
      }
  }
}
