/**
 * Small powerboat: a center console with T-top, leaning post, bow seating and outboard power
 * (twin engines from 27 ft). Same lofted hull as the cruiser with lower freeboard and an open liner.
 */
import { F, CANVAS_FINISH, HULL_FINISH } from './finishes.ts';
import { addHull, halfBeam, hullPoint, sectionHalf, sheerLoop, sheerPoint, sheerY, stationX, type HullForm } from './hull.ts';
import { finish, lerp, shade, smooth, spline, type MeshBuilder, type V3 } from './mesh.ts';
import { addCleat, addFender, type BoatParams, type Lod } from './parts.ts';
import { TOKEN_COLORS as T } from '../palette.ts';

const NAVY_STRIPE = finish(T.silo_blue, 0.4);

export function buildConsole(mb: MeshBuilder, p: BoatParams, lod: Lod) {
  const L = p.lengthM;
  const k = L / 7.3; // proportions were drawn for a 24 ft boat
  const engine = 0.42 * k; // the outboard hangs aft of the transom, inside the overall length
  const fbS = 0.088 * L;
  const h: HullForm = { kind: 'power', x0: -L / 2 + engine, length: L - engine, beam: p.beamM, fbStern: fbS, fbMid: fbS, fbBow: fbS * 1.6, stemRake: 0.09 * L, sternRake: 0 };
  const white = p.hull === 'white';
  const pick = <A>(a: A, b: A, c: A): A => (lod === 0 ? a : lod === 1 ? b : c);
  const stations = pick(30, 14, 8);
  addHull(mb, h, { topsides: HULL_FINISH[p.hull], boot: white ? NAVY_STRIPE : F.gelcoat, bottom: F.antifoul }, stations, pick(5, 3, 2));

  const X = (t: number) => stationX(h, t, sheerY(h, t));
  const LIFT = 0.02;
  const tC0 = 0.045;
  const tC1 = 0.9;
  const gunwale = 0.16 * k;
  const yC = (t: number) => sheerY(h, t) + LIFT;
  const zin = (t: number) => Math.max(halfBeam(h, t) - gunwale, 0.04);
  const ySole = fbS - 0.4 * k;
  /** Cockpit sole, stepping up to the casting deck forward. */
  const yFloor = (t: number) => ySole + 0.2 * k * smooth(0.665, 0.69, t);

  if (lod <= 1) mb.tube(sheerLoop(h, stations, -0.012, 0), 0.028 * k, pick(6, 4, 3), F.rubRail, { closed: true });

  // --- Liner: gunwale tops, inner walls, sole, foredeck cap.
  {
    const n = pick(18, 9, 4);
    for (const side of [1, -1] as const) {
      const top: V3[][] = [];
      const wall: V3[][] = [];
      for (let i = 0; i <= n; i++) {
        const t = lerp(0, tC1, i / n);
        top.push([sheerPoint(h, t, side, 0.025, LIFT), [X(t), yC(t), side * zin(t)]]);
        const tw = lerp(tC0, tC1, i / n);
        wall.push([
          [X(tw), yFloor(tw), side * zin(tw)],
          [X(tw), yC(tw), side * zin(tw)],
        ]);
      }
      mb.grid(top, F.gelcoat);
      if (lod <= 1) mb.grid(wall, F.gelcoat, { shade: (_i, j) => (j === 0 ? 0.74 : 0.93) });
    }
    const z0 = zin(tC0);
    mb.quad([X(0), yC(0), -zin(0)], [X(0), yC(0), zin(0)], [X(tC0), yC(tC0), z0], [X(tC0), yC(tC0), -z0], F.gelcoat);
    if (lod <= 1) mb.quad([X(tC0), ySole, -z0], [X(tC0), ySole, z0], [X(tC0), yC(tC0), z0], [X(tC0), yC(tC0), -z0], F.gelcoat, 0.86);
    const floor: V3[][] = [];
    const nf = pick(22, 10, 3);
    for (let i = 0; i <= nf; i++) {
      const t = lerp(tC0, tC1, i / nf);
      floor.push([
        [X(t), lod === 2 ? yC(t) - 0.2 * k : yFloor(t), -zin(t)],
        [X(t), lod === 2 ? yC(t) - 0.2 * k : yFloor(t), zin(t)],
      ]);
    }
    mb.grid(floor, F.nonskid, { shade: () => (lod === 2 ? 0.8 : 0.9) });
    // Anchor-locker cap at the bow.
    const cap: V3[][] = [];
    const nc = pick(6, 3, 2);
    for (let i = 0; i <= nc; i++) {
      const t = lerp(tC1, 1, i / nc);
      const hb = Math.max(halfBeam(h, t) - 0.025, 0.006);
      cap.push([
        [X(t), yC(t), -hb],
        [X(t), yC(t) + 0.02, 0],
        [X(t), yC(t), hb],
      ]);
    }
    mb.grid(cap, F.gelcoat);
    if (lod <= 1) mb.quad([X(tC1), yFloor(tC1), -zin(tC1)], [X(tC1), yFloor(tC1), zin(tC1)], [X(tC1), yC(tC1), zin(tC1)], [X(tC1), yC(tC1), -zin(tC1)], F.gelcoat, 0.85);
  }

  // --- Console, windscreen, wheel, leaning post.
  const xc = X(0.47);
  const seg = pick(6, 4, 3);
  mb.pillow([xc, ySole + 0.5 * k, 0], [0.78 * k, 1.0 * k, 0.8 * k], F.gelcoat, { n: 6, seg, shade: (y) => lerp(0.82, 1, y) });
  mb.quad([xc + 0.36 * k, ySole + 0.98 * k, -0.36 * k], [xc + 0.36 * k, ySole + 0.98 * k, 0.36 * k], [xc + 0.1 * k, ySole + 1.42 * k, 0.32 * k], [xc + 0.1 * k, ySole + 1.42 * k, -0.32 * k], F.glass);
  if (lod <= 1) {
    const post = xc - 0.82 * k;
    mb.pillow([post, ySole + 0.86 * k, 0], [0.42 * k, 0.16 * k, 0.9 * k], F.cushion, { n: 5, seg });
    mb.pillow([post - 0.2 * k, ySole + 1.12 * k, 0], [0.1 * k, 0.34 * k, 0.86 * k], F.cushion, { n: 5, seg });
    mb.pillow([post, ySole + 0.4 * k, 0], [0.36 * k, 0.78 * k, 0.74 * k], F.gelcoat, { n: 6, seg: pick(5, 3, 3), shade: (y) => lerp(0.8, 0.96, y) });
    // Stern bench and bow cushions.
    mb.pillow([X(tC0) + 0.24 * k, ySole + 0.2 * k, 0], [0.42 * k, 0.4 * k, 2 * zin(tC0) - 0.2 * k], F.cushion, { n: 5, seg, shade: (y) => lerp(0.82, 1, y) });
    for (const side of [1, -1] as const) mb.pillow([X(0.78), yFloor(0.78) + 0.11 * k, side * zin(0.78) * 0.52], [0.95 * k, 0.2 * k, zin(0.78) * 0.8], F.cushion, { n: 5, seg, shade: (y) => lerp(0.85, 1, y) });
  }
  if (lod === 0) {
    const c: V3 = [xc - 0.44 * k, ySole + 0.95 * k, 0.12 * k];
    const ring: V3[] = [];
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2;
      ring.push([c[0] + Math.sin(th) * 0.17 * k * 0.3, c[1] + Math.sin(th) * 0.17 * k * 0.95, c[2] + Math.cos(th) * 0.17 * k]);
    }
    mb.tube(ring, 0.015 * k, 5, F.stainless, { closed: true });
    mb.cyl(c, [xc - 0.36 * k, c[1] - 0.04 * k, c[2]], 0.02 * k, 0.03 * k, 5, F.rubber, false);
  }

  // --- T-top: tube frame and a canvas (or moulded) top.
  {
    const topY = ySole + 2.02 * k;
    const topC: V3 = [xc - 0.12 * k, topY, 0];
    const topF = p.canvas === 'none' ? F.gelcoat : CANVAS_FINISH[p.canvas];
    mb.pillow([topC[0], topY + 0.04 * k, 0], [1.95 * k, 0.1 * k, 1.7 * k], topF, { n: 7, seg: pick(8, 5, 3), shade: (y) => lerp(0.7, 1, y) });
    if (lod <= 1) {
      for (const sx of [1, -1])
        for (const sz of [1, -1]) {
          const foot: V3 = [xc + sx * 0.3 * k, ySole + 0.2 * k, sz * 0.43 * k];
          const mid: V3 = [xc + sx * 0.36 * k, ySole + 1.3 * k, sz * 0.47 * k];
          const head: V3 = [topC[0] + sx * 0.72 * k, topY, sz * 0.66 * k];
          mb.tube(lod === 0 ? spline([foot, mid, head], 8) : [foot, mid, head], 0.024 * k, pick(6, 3, 3), F.alloy);
        }
      const frame: V3[] = [];
      for (let i = 0; i < 16; i++) {
        const th = (i / 16) * Math.PI * 2;
        const cx = Math.sign(Math.cos(th)) * Math.pow(Math.abs(Math.cos(th)), 0.35);
        const cz = Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), 0.35);
        frame.push([topC[0] + cx * 0.95 * k, topY - 0.01 * k, cz * 0.83 * k]);
      }
      mb.tube(frame, 0.022 * k, pick(5, 3, 3), F.alloy, { closed: true });
    }
    if (lod === 0) {
      for (const z of [-0.5, -0.17, 0.17, 0.5]) mb.cyl([topC[0] - 0.96 * k, topY + 0.02 * k, z * k], [topC[0] - 1.08 * k, topY + 0.3 * k, z * k], 0.028 * k, 0.028 * k, 5, F.alloy);
      mb.cyl([topC[0] + 0.5 * k, topY + 0.08 * k, 0.6 * k], [topC[0] + 0.35 * k, topY + 1.7 * k, 0.6 * k], 0.012 * k, 0.005 * k, 4, F.gelcoat);
    }
  }

  // --- Outboard power.
  {
    const zs = L >= 8.2 ? [-0.34 * k, 0.34 * k] : [0];
    for (const z of zs) {
      mb.pillow([h.x0 - 0.14 * k, fbS + 0.3 * k, z], [0.62 * k, 0.44 * k, 0.4 * k], F.engine, { n: 3.2, seg: pick(7, 4, 3), shade: (y) => lerp(0.8, 1.1, y) });
      mb.box([h.x0 - 0.2 * k, fbS - 0.2 * k, z], [0.2 * k, 0.75 * k + fbS * 0.4, 0.2 * k], shade(F.engine, 0.85));
      if (lod <= 1) mb.box([h.x0 - 0.02 * k, fbS - 0.05 * k, z], [0.14 * k, 0.3 * k, 0.3 * k], F.rubber);
    }
  }

  // --- Low bow rail, graphics, hardware.
  if (lod <= 1) {
    const ts = [0.6, 0.63, 0.72, 0.82, 0.91, 0.97];
    const railPt = (t: number, side: 1 | -1, f = 1): V3 => sheerPoint(h, t, side, 0.07 * k, LIFT + 0.24 * k * f);
    const half = ts.map((t, i) => railPt(t, 1, i === 0 ? 0 : 1));
    const tip: V3 = [X(1) + 0.03 * k, sheerY(h, 1) + LIFT + 0.24 * k, 0];
    const ctrl: V3[] = [...half, tip, ...half.map((q): V3 => [q[0], q[1], -q[2]]).reverse()];
    mb.tube(lod === 0 ? spline(ctrl, 34) : ctrl, 0.018 * k, pick(6, 3, 3), F.stainless, { caps: true });
    for (const side of [1, -1] as const) {
      for (const t of lod === 0 ? [0.72, 0.82, 0.91] : [0.82]) mb.cyl(sheerPoint(h, t, side, 0.07 * k, LIFT), railPt(t, side), 0.013 * k, 0.013 * k, 4, F.stainless, false);
      const onHull = (t: number, v: number) => hullPoint(h, t, v * sheerY(h, t), side);
      mb.decal(onHull, [0.012, 0.972, 0.8, 0.9], pick(28, 12, 6), 1, 0.006, (q) => [q[0], q[1], 0], white ? NAVY_STRIPE : F.gelcoat);
      for (const t of [0.3, 0.62]) {
        const y = sheerY(h, t) * 0.42;
        addFender(mb, [stationX(h, t, y), y, side * (sectionHalf(h, t, y) + 0.1 * k)], sheerPoint(h, t, side, 0.02, LIFT), k * 0.85, lod);
      }
    }
  }
  if (lod === 0)
    for (const side of [1, -1] as const) {
      addCleat(mb, sheerPoint(h, 0.06, side, 0.08 * k, LIFT), k);
      addCleat(mb, sheerPoint(h, 0.5, side, 0.08 * k, LIFT), k);
      addCleat(mb, sheerPoint(h, 0.93, side, 0.06 * k, LIFT), k);
    }
}
