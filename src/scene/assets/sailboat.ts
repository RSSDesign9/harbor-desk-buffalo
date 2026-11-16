/**
 * Sailboat: a small keelboat at its berth. Round-bilged hull with a spring sheer and counter stern, cabin
 * trunk with portlights, cockpit well and coamings, mast with spreaders, boom under a sail cover, furled
 * headsail, standing rigging, pulpit, pushpit and lifelines.
 */
import { F, CANVAS_FINISH, HULL_FINISH } from './finishes.ts';
import { addHull, halfBeam, hullPoint, sectionHalf, sheerLoop, sheerPoint, sheerY, stationX, type HullForm } from './hull.ts';
import { finish, lerp, lerp3, smooth, spline, type MeshBuilder, type V3 } from './mesh.ts';
import { addCleat, addFender, type BoatParams, type Lod } from './parts.ts';
import { TOKEN_COLORS as T } from '../palette.ts';

const NAVY_STRIPE = finish(T.silo_blue, 0.4);

export function buildSailboat(mb: MeshBuilder, p: BoatParams, lod: Lod) {
  const L = p.lengthM;
  const k = L / 8.2; // proportions were drawn for a 27 ft boat
  const h: HullForm = { kind: 'sail', x0: -L / 2, length: L, beam: p.beamM, fbStern: 0.108 * L, fbMid: 0.096 * L, fbBow: 0.138 * L, stemRake: 0.13 * L, sternRake: 0.05 * L };
  const white = p.hull === 'white';
  const pick = <A>(a: A, b: A, c: A): A => (lod === 0 ? a : lod === 1 ? b : c);
  const stations = pick(30, 14, 8);
  addHull(mb, h, { topsides: HULL_FINISH[p.hull], boot: white ? NAVY_STRIPE : F.gelcoat, bottom: F.antifoul }, stations, pick(5, 3, 2));

  const X = (t: number) => stationX(h, t, sheerY(h, t));
  const hbIn = (t: number) => Math.max(halfBeam(h, t) - 0.03, 0.006);
  // Cabin trunk and cockpit are steps in one deck surface.
  const T0 = 0.37; // trunk aft bulkhead
  const T1 = 0.75; // trunk forward end
  const C0 = 0.08; // cockpit aft
  const C1 = 0.34; // cockpit forward (bridge deck)
  const trunkH = 0.36 * k;
  const wellD = 0.38 * k;
  const deckY = (t: number, z: number, part: 'aft' | 'well' | 'bridge' | 'trunk' | 'fore' = t < C0 ? 'aft' : t < C1 ? 'well' : t < T0 ? 'bridge' : t < T1 + 0.02 ? 'trunk' : 'fore') => {
    const w = Math.min(1, Math.abs(z) / hbIn(t));
    let y = sheerY(h, t) + 0.02 + 0.05 * k * (1 - w * w);
    if (part === 'trunk') y += trunkH * (1 - smooth(0.5, 0.62, w)) * (1 - smooth(T1 - 0.11, T1 + 0.02, t)) * (0.94 + 0.06 * (1 - w * w));
    if (part === 'well') y += -wellD * (1 - smooth(0.4, 0.45, w)) + 0.1 * k * smooth(0.45, 0.5, w) * (1 - smooth(0.6, 0.66, w));
    return y;
  };
  const deckPoint = (t: number, w: number, part?: Parameters<typeof deckY>[2]): V3 => [X(t), deckY(t, w * hbIn(t), part), w * hbIn(t)];

  // --- Deck in sections, so the bulkheads are vertical steps rather than ramps.
  {
    const nW = pick(26, 12, 6);
    const section = (a: number, b: number, n: number, part: NonNullable<Parameters<typeof deckY>[2]>) => {
      const pts: V3[][] = [];
      for (let i = 0; i <= n; i++) {
        const t = lerp(a, b, i / n);
        const col: V3[] = [];
        for (let j = 0; j <= nW; j++) col.push(deckPoint(t, (j / nW) * 2 - 1, part));
        pts.push(col);
      }
      mb.grid(pts, part === 'well' ? F.nonskid : F.gelcoat, { shade: (_i, j) => (part === 'well' && Math.abs((j / nW) * 2 - 1) < 0.42 ? 0.82 : 1) });
      return pts;
    };
    const aft = section(0, C0, 1, 'aft');
    const well = section(C0, C1, pick(4, 2, 1), 'well');
    const bridge = section(C1, T0, 1, 'bridge');
    const trunk = section(T0, T1 + 0.02, pick(10, 5, 2), 'trunk');
    section(T1 + 0.02, 1, pick(8, 4, 2), 'fore');
    // Vertical faces where the sections meet.
    mb.grid([aft[aft.length - 1]!, well[0]!], F.gelcoat, { shade: () => 0.84 });
    mb.grid([well[well.length - 1]!, bridge[0]!], F.gelcoat, { shade: () => 0.84 });
    mb.grid([bridge[bridge.length - 1]!, trunk[0]!], F.gelcoat, { shade: () => 0.9 });
    if (lod <= 1) {
      // Companionway boards and sliding hatch.
      const x = X(T0) - 0.012;
      mb.quad([x, deckY(T0, 0, 'bridge') + 0.03, -0.24 * k], [x, deckY(T0, 0, 'bridge') + 0.03, 0.24 * k], [x, deckY(T0, 0, 'trunk') - 0.03, 0.2 * k], [x, deckY(T0, 0, 'trunk') - 0.03, -0.2 * k], F.glass);
      mb.box([X(T0) + 0.3 * k, deckY(T0 + 0.04, 0, 'trunk') + 0.025 * k, 0], [0.6 * k, 0.05 * k, 0.56 * k], F.gelcoat, { sideShade: 0.85 });
      const below = (q: V3): V3 => [q[0], 0, q[2]];
      for (const side of [1, -1])
        for (const [a, b] of [
          [T0 + 0.05, T0 + 0.15],
          [T0 + 0.18, T0 + 0.27],
        ] as const)
          mb.decal((t, w) => deckPoint(t, w * side, 'trunk'), [a, b, 0.535, 0.6], pick(8, 4, 2), 2, 0.012, below, F.glass, { round: 3 });
      mb.decal((t, w) => deckPoint(t, w, 'trunk'), [T1 - 0.2, T1 - 0.14, -0.22, 0.22], pick(6, 3, 2), pick(6, 3, 2), 0.012, below, F.glass, { round: 5 });
    }
  }
  if (lod <= 1) mb.tube(sheerLoop(h, stations, 0.0, 0.03), 0.022 * k, pick(5, 3, 3), F.rubRail, { closed: true });

  // --- Spars: mast, spreaders, boom.
  const tMast = 0.6;
  const mastFoot: V3 = [X(tMast), deckY(tMast, 0, 'trunk'), 0];
  const mastH = 1.2 * L;
  const mastTop: V3 = [mastFoot[0] - 0.02 * L, mastFoot[1] + mastH, 0];
  const onMast = (f: number) => lerp3(mastFoot, mastTop, f);
  mb.tube([mastFoot, onMast(0.5), mastTop], (f) => lerp(0.075, 0.048, f) * k, pick(8, 5, 3), F.alloy, { caps: true });
  const gooseneck = onMast(0.085);
  const boomEnd: V3 = [gooseneck[0] - 0.4 * L, gooseneck[1] + 0.03 * k, 0];
  mb.cyl(gooseneck, boomEnd, 0.05 * k, 0.042 * k, pick(6, 4, 3), F.alloy);
  // Sail cover over the flaked mainsail (or the bare flaked sail when there is no canvas).
  {
    const cover = p.canvas === 'none' ? F.cushion : CANVAS_FINISH[p.canvas];
    const n = pick(12, 6, 3);
    const sides = pick(8, 6, 4);
    const pts: V3[][] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const col: V3[] = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const c = lerp3([gooseneck[0] + 0.1 * k, gooseneck[1], 0], [boomEnd[0] + 0.1 * k, boomEnd[1], 0], f);
        const ry = lerp(0.3, 0.1, Math.pow(f, 0.6)) * k * (1 - 0.5 * smooth(0.96, 1, f));
        const rz = lerp(0.12, 0.07, f) * k * (1 - 0.5 * smooth(0.96, 1, f));
        col.push([c[0], c[1] + ry * 0.75 + Math.sin(a) * ry, Math.cos(a) * rz]);
      }
      pts.push(col);
    }
    mb.grid(pts, cover, { closeU: true, shade: (i) => lerp(0.82, 1, 0.5 + 0.5 * Math.sin((i / sides) * Math.PI * 2)) });
  }
  const spreaderAt = onMast(0.52);
  const chain = (side: 1 | -1) => sheerPoint(h, tMast - 0.03, side, 0.05 * k, 0.03);
  const spreaderTip = (side: 1 | -1): V3 => [spreaderAt[0] - 0.08 * k, spreaderAt[1] + 0.03 * k, side * 0.78 * k];
  const bow: V3 = [X(1) - 0.04 * k, sheerY(h, 1) + 0.05, 0];
  const stern: V3 = [X(0) + 0.06 * k, sheerY(h, 0) + 0.04, 0];
  const forestayTop = onMast(0.94);

  // --- Furled headsail on the forestay.
  {
    const furl = p.canvas === 'none' ? F.cushion : CANVAS_FINISH[p.canvas];
    mb.tube([lerp3(bow, forestayTop, 0.06), lerp3(bow, forestayTop, 0.5), lerp3(bow, forestayTop, 0.93)], (f) => lerp(0.055, 0.028, f) * k, pick(6, 4, 3), furl, { caps: true });
  }

  // --- Standing rigging.
  if (lod <= 1) {
    const wire = (a: V3, b: V3) => mb.cyl(a, b, 0.009 * k, 0.009 * k, 3, F.stainless, false);
    wire(bow, forestayTop);
    wire(stern, mastTop);
    for (const side of [1, -1] as const) {
      mb.cyl(spreaderAt, spreaderTip(side), 0.022 * k, 0.016 * k, pick(5, 3, 3), F.alloy);
      wire(chain(side), spreaderTip(side));
      wire(spreaderTip(side), onMast(0.93));
      wire(chain(side), [spreaderAt[0], spreaderAt[1] - 0.1 * k, side * 0.04]);
    }
  }

  // --- Pulpit, pushpit, lifelines.
  if (lod <= 1) {
    const railH = 0.6 * k;
    const post = (t: number, side: 1 | -1, f = 1): V3 => sheerPoint(h, t, side, 0.06 * k, 0.03 + railH * f);
    const pulpit: V3[] = [post(0.86, 1, 0), post(0.87, 1), post(0.94, 1), [X(1) + 0.02 * k, sheerY(h, 1) + 0.03 + railH, 0], post(0.94, -1), post(0.87, -1), post(0.86, -1, 0)];
    const pushpit: V3[] = [post(0.13, 1, 0), post(0.12, 1), post(0.03, 1), [X(0) - 0.0 * k, sheerY(h, 0) + 0.03 + railH, 0.0], post(0.03, -1), post(0.12, -1), post(0.13, -1, 0)];
    for (const rail of [pulpit, pushpit]) mb.tube(lod === 0 ? spline(rail, 22) : rail, 0.016 * k, pick(5, 3, 3), F.stainless, { caps: true });
    const stanchions = [0.26, 0.42, 0.58, 0.73];
    for (const side of [1, -1] as const) {
      const line: V3[] = [post(0.12, side), ...stanchions.map((t) => post(t, side)), post(0.87, side)];
      mb.tube(line, 0.007 * k, 3, F.stainless);
      for (const t of lod === 0 ? stanchions : [0.42, 0.73]) mb.cyl(sheerPoint(h, t, side, 0.06 * k, 0.03), post(t, side), 0.012 * k, 0.012 * k, 4, F.stainless, false);
      mb.cyl(sheerPoint(h, 0.94, side, 0.06 * k, 0.03), post(0.94, side), 0.012 * k, 0.012 * k, 4, F.stainless, false);
      mb.cyl(sheerPoint(h, 0.03, side, 0.06 * k, 0.03), post(0.03, side), 0.012 * k, 0.012 * k, 4, F.stainless, false);
    }
  }

  // --- Cockpit: wheel or tiller, winches.
  if (lod === 0) {
    const yWell = deckY((C0 + C1) / 2, 0, 'well');
    if (L >= 8) {
      const c: V3 = [X(C0) + 0.42 * k, yWell + 0.85 * k, 0];
      mb.cyl([c[0], yWell, 0], [c[0], c[1] - 0.05 * k, 0], 0.05 * k, 0.04 * k, 6, F.gelcoat);
      const ring: V3[] = [];
      for (let a = 0; a < 14; a++) {
        const th = (a / 14) * Math.PI * 2;
        ring.push([c[0] - 0.05 * k, c[1] + Math.sin(th) * 0.36 * k, Math.cos(th) * 0.36 * k]);
      }
      mb.tube(ring, 0.014 * k, 5, F.stainless, { closed: true });
    } else {
      mb.cyl([X(0.03), sheerY(h, 0.03) + 0.1 * k, 0], [X(C0) + 0.85 * k, yWell + 0.62 * k, 0.06 * k], 0.022 * k, 0.016 * k, 5, F.fascia);
    }
    for (const side of [1, -1] as const) {
      const w = deckPoint(0.24, 0.52 * side, 'well');
      mb.cyl(w, [w[0], w[1] + 0.12 * k, w[2]], 0.06 * k, 0.05 * k, 8, F.stainless);
      addCleat(mb, sheerPoint(h, 0.06, side, 0.1 * k, 0.03), k);
      addCleat(mb, sheerPoint(h, 0.5, side, 0.1 * k, 0.03), k);
      addCleat(mb, sheerPoint(h, 0.92, side, 0.07 * k, 0.03), k);
    }
  }

  // --- Cove stripe and fenders.
  if (lod <= 1)
    for (const side of [1, -1] as const) {
      const onHull = (t: number, v: number) => hullPoint(h, t, v * sheerY(h, t), side);
      mb.decal(onHull, [0.03, 0.965, 0.86, 0.91], pick(28, 12, 6), 1, 0.006, (q) => [q[0], q[1], 0], white ? NAVY_STRIPE : F.gelcoat);
      for (const t of [0.3, 0.6]) {
        const y = sheerY(h, t) * 0.45;
        addFender(mb, [stationX(h, t, y), y, side * (sectionHalf(h, t, y) + 0.1 * k)], sheerPoint(h, t, side, 0.02, 0.03), k * 0.9, lod);
      }
    }
}
