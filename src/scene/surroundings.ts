/**
 * Placement of the waterfront surroundings (TASKS T15). Pure math in local metres ([east, north]); no
 * three.js objects, so the rules are unit-tested (tests/unit/surroundings.test.ts).
 *
 * Evidence, per data/GEOMETRY-VALIDATION.md:
 * - The bank is the authored `land-west` mask (ASSUME north of the canal mouth, DOC canal edge south of it).
 * - Buildings, storage areas, parking and the yard are the masses digitized from the 1 Jun 2022 ESD map
 *   (ASSUME, ±10 m). They show what the map depicted in 2022, not current use.
 * - Everything dressed onto them here (promenade, verge, rock, lamps, trees, stored boats, viaduct piers) is
 *   ASSUME scenery. Stored boats are NOT registry records: they have no IDs and are never counted.
 *
 * Nothing is placed for fuel, pump-out, a travel lift, launches, depths or north-bank landmarks: no
 * positions are sourced for them.
 */
import { SITE, type EN } from '../data/site.ts';
import { rng } from './assets/mesh.ts';
import type { BoatParams } from './assets/parts.ts';
import { DOCK_PLANS, WEST_BANK, closestOnRing, insideRing } from './marina.ts';
import { ribbon } from './shapes.ts';

export const inPoly = insideRing;
const near = (p: EN, ring: readonly EN[], margin: number) => inPoly(p, ring) || closestOnRing(p, ring).distance < margin;
const segDist = (p: EN, a: EN, b: EN) => closestOnRing(p, [a, b]).distance;

/** The dressed shoreline: the west bank from north-west of Dock A to south-east of Dock E. */
export const BANK_LINE: readonly EN[] = WEST_BANK.slice(0, 39);

export interface Station {
  p: EN;
  /** Unit normal pointing at the water. */
  n: EN;
  /** Distance along the line (m). */
  s: number;
}
/** Points every `step` metres along a polyline, each with the unit normal that faces the water (off the land mask). */
export function walk(line: readonly EN[], step: number): Station[] {
  const out: Station[] = [];
  let carried = 0;
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    const t: EN = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let n: EN = [-t[1], t[0]];
    const m: EN = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (inPoly([m[0] + n[0] * 0.5, m[1] + n[1] * 0.5], WEST_BANK)) n = [-n[0], -n[1]];
    for (let d = carried; d < len; d += step) out.push({ p: [a[0] + t[0] * d, a[1] + t[1] * d], n, s: total + d });
    carried = carried + Math.ceil((len - carried) / step) * step - len;
    total += len;
  }
  return out;
}
const offset = (w: { p: EN; n: EN }, d: number): EN => [w.p[0] + w.n[0] * d, w.p[1] + w.n[1] * d];

const MASS = (id: string) => SITE.masses.find((m) => m.id === id)!;
const BUILDING_RINGS_RAW = SITE.masses.filter((m) => m.kind === 'building');
const ROAD_RINGS = SITE.lines.filter((l) => l.kind === 'road').map((l) => ribbon(l.line, l.widthM + 5));
const OPEN_RINGS = [...SITE.masses.filter((m) => m.kind !== 'boundary' && m.kind !== 'building').map((m) => m.ring), ...SITE.osmContext.filter((c) => c.kind === 'parking').map((c) => c.ring)];
const APRONS = DOCK_PLANS.filter((d) => d.kind === 'fixed').flatMap((d) => d.deck);
const GANGWAYS = DOCK_PLANS.flatMap((d) => (d.gangway ? [d.gangway] : []));

// ---------- buildings ----------
export interface Frame {
  id: string;
  center: EN;
  /** Rotation about +y in scene space that turns the generator’s +x onto the footprint’s long axis. */
  yaw: number;
  length: number;
  width: number;
}
/** Oriented rectangle of a digitized four-corner footprint. The generator’s +z wall faces the water. */
export function frameOf(id: string, ring: readonly EN[], towardWater: EN): Frame {
  const [a, b, c] = ring as [EN, EN, EN];
  const e0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const e1 = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const [from, to, length, width] = e0 >= e1 ? [a, b, e0, e1] : [b, c, e1, e0];
  let u: EN = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  // Right of u is the generator’s +z.
  if (u[1] * towardWater[0] - u[0] * towardWater[1] < 0) u = [-u[0], -u[1]];
  const center: EN = [ring.slice(0, 4).reduce((s, p) => s + p[0], 0) / 4, ring.slice(0, 4).reduce((s, p) => s + p[1], 0) / 4];
  return { id, center, yaw: Math.atan2(u[1], u[0]), length, width };
}
const TOWARD_WATER = DOCK_PLANS.find((d) => d.dock === 'B')!.toward;
/**
 * Derived correction (T15). The elevator footprint digitized from the 2022 aerial (ASSUME, ±10 m) puts its
 * water-side corners about 17 m beyond the documented City Ship Canal edge, across Dock D’s headwalk. The
 * aerial is not orthographic and the outline was picked at roof level, so a tall building leans toward the
 * water in it. Documented water wins: the footprint is moved straight inland until every corner is at least
 * `ELEVATOR_BANK_CLEARANCE_M` behind the bank. Its position stays approximate.
 */
export const ELEVATOR_BANK_CLEARANCE_M = 6;
const shifted = (m: number): EN[] => MASS('grain-elevator').ring.map((p): EN => [p[0] - TOWARD_WATER[0] * m, p[1] - TOWARD_WATER[1] * m]);
export const ELEVATOR_INLAND_SHIFT_M = (() => {
  const clear = (ring: readonly EN[]) => ring.every((p) => inPoly(p, WEST_BANK) && closestOnRing(p, WEST_BANK).distance >= ELEVATOR_BANK_CLEARANCE_M);
  let m = 0;
  while (!clear(shifted(m)) && m < 60) m += 1;
  return m;
})();
export const ELEVATOR_RING: readonly EN[] = shifted(ELEVATOR_INLAND_SHIFT_M);
export const BUILDINGS = {
  elevator: frameOf('grain-elevator', ELEVATOR_RING, TOWARD_WATER),
  service: frameOf('service-building', MASS('service-building').ring, TOWARD_WATER),
  office: frameOf('small-building', MASS('small-building').ring, TOWARD_WATER),
};
/** Heights are not sourced (ASSUME). */
export const BUILDING_HEIGHTS = { elevatorBins: 30, serviceEave: 6.5, serviceRidge: 9.4, officeEave: 3.4, officeRidge: 5.4, skywayDeck: 30 };

export const SKYWAY = (() => {
  const l = SITE.lines.find((x) => x.id === 'skyway')!;
  const a = l.line[0]!;
  const b = l.line[l.line.length - 1]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as EN, yaw: Math.atan2(b[1] - a[1], b[0] - a[0]), length, width: l.widthM };
})();

/** Building footprints as built: the elevator in its corrected position. */
export const buildingRings = (): readonly (readonly EN[])[] => BUILDING_RINGS_RAW.map((m) => (m.id === 'grain-elevator' ? ELEVATOR_RING : m.ring));

// ---------- bank dressing ----------
/** Consecutive stations that satisfy `ok`, split into runs of at least two. */
function runs(stations: readonly Station[], ok: (w: Station) => boolean): Station[][] {
  const out: Station[][] = [];
  let cur: Station[] = [];
  for (const w of stations) {
    if (ok(w)) cur.push(w);
    else {
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
const onLand = (p: EN) => inPoly(p, WEST_BANK);
const PROMENADE = { near: -0.7, far: -4.5 };
const VERGE = { near: -4.5, far: -17.1 };

/**
 * Keep only the stretches whose painted ribbon lies wholly on land and off every building: a ribbon corner
 * can swing past the bank where the bank turns, so the finished outline is checked, not just the stations.
 */
function safeRibbons(candidates: Station[][], centre: number, width: number): { line: EN[]; width: number }[] {
  let todo = candidates;
  const done: Station[][] = [];
  for (let pass = 0; pass < 6 && todo.length; pass++) {
    const next: Station[][] = [];
    for (const run of todo) {
      const line = run.map((w) => offset(w, centre));
      const outline = ribbon(line, width);
      const n = line.length;
      const bad = line.map((_p, i) => [outline[i]!, outline[2 * n - 1 - i]!].some((q) => !onLand(q) || buildingRings().some((r) => inPoly(q, r))));
      if (!bad.some(Boolean)) {
        done.push(run);
        continue;
      }
      let cur: Station[] = [];
      run.forEach((w, i) => {
        // Drop the offending station and its neighbours.
        if (bad[i] || bad[i - 1] || bad[i + 1]) {
          if (cur.length > 1) next.push(cur);
          cur = [];
        } else cur.push(w);
      });
      if (cur.length > 1) next.push(cur);
    }
    todo = next;
  }
  return done.map((run) => ({ line: run.map((w) => offset(w, centre)), width }));
}

/** Paved walk just behind the bank, as ribbons (centre lines + width). Never over water or through a building. */
export function promenadeRuns(): { line: EN[]; width: number }[] {
  const ok = (w: Station) => onLand(offset(w, PROMENADE.near - 0.3)) && onLand(offset(w, PROMENADE.far)) && !buildingRings().some((r) => near(offset(w, PROMENADE.far), r, 1));
  return safeRibbons(runs(walk(BANK_LINE, 3), ok), (PROMENADE.near + PROMENADE.far) / 2, PROMENADE.near - PROMENADE.far);
}
/** Lawn strip behind the walk, where it fits on land and clear of buildings. */
export function vergeRuns(): { line: EN[]; width: number }[] {
  const ok = (w: Station) => onLand(offset(w, VERGE.near)) && onLand(offset(w, VERGE.far)) && !buildingRings().some((r) => near(offset(w, VERGE.far), r, 1) || near(offset(w, (VERGE.near + VERGE.far) / 2), r, 1));
  return safeRibbons(runs(walk(BANK_LINE, 4), ok), (VERGE.near + VERGE.far) / 2, VERGE.near - VERGE.far);
}

export interface Placed {
  at: EN;
  y: number;
  yaw: number;
  scale: [number, number, number];
  tilt: number;
  /** Distance along the bank (rocks only): used to group them into chunks. */
  s?: number;
}
/** Courses of revetment rock climbing the bank: distance from the bank line (+ toward the water), height, size. */
const ROCK_COURSES = [
  { d: 0.98, y: 0.04, size: 0.7 },
  { d: 0.68, y: 0.3, size: 0.68 },
  { d: 0.38, y: 0.56, size: 0.66 },
  { d: 0.08, y: 0.82, size: 0.64 },
  { d: -0.22, y: 1.06, size: 0.6 },
  { d: -0.5, y: 1.22, size: 0.52 },
];
/**
 * Revetment along the bank, except where a fixed quay apron or a gangway meets it.
 * `detail` 1 is the full six-course revetment; lower values use fewer, larger stones (distant banks).
 */
export function revetment(detail: (w: Station) => number = () => 1): Placed[] {
  const rand = rng(41);
  const rocks: Placed[] = [];
  const stations = walk(BANK_LINE, 0.6);
  ROCK_COURSES.forEach((c, row) => {
    stations.forEach((w, i) => {
      const k = detail(w);
      const along = (rand() - 0.5) * 0.3 + (row % 2) * 0.3;
      const jitter = [rand(), rand(), rand(), rand(), rand(), rand(), rand()];
      if (k < 1 && (i % 2 === 1 || row % 2 === 1)) return; // coarse: every other stone on every other course
      const big = k < 1 ? 1.9 : 1;
      const p = offset(w, c.d + (jitter[0]! - 0.5) * 0.25);
      const q: EN = [p[0] - w.n[1] * along, p[1] + w.n[0] * along];
      if (APRONS.some((a) => near(q, a, 0.4))) return;
      if (GANGWAYS.some((g) => segDist(q, g.head, g.foot) < 1.15)) return;
      const s = c.size * (0.75 + jitter[1]! * 0.5) * big;
      rocks.push({ at: q, y: c.y + (jitter[2]! - 0.5) * 0.12 + (big - 1) * 0.08, yaw: jitter[3]! * Math.PI * 2, scale: [s * (0.9 + jitter[4]! * 0.4), s * (0.8 + jitter[5]! * 0.5), s], tilt: (jitter[6]! - 0.5) * 0.5, s: w.s });
    });
  });
  return rocks;
}

export function lampPosts(): EN[] {
  return promenadeRuns().flatMap((r) => r.line.filter((_p, i) => i % 9 === 4)).map((p) => {
    const c = closestOnRing(p, BANK_LINE, true);
    const d = c.distance || 1;
    // Step to the landward edge of the walk.
    return [p[0] + ((p[0] - c.point[0]) / d) * 2.4, p[1] + ((p[1] - c.point[1]) / d) * 2.4] as EN;
  });
}

// ---------- stored boats (scenery) ----------
export interface StoredBoat {
  at: EN;
  yaw: number;
  params: BoatParams;
}
const FEET = 0.3048;
const STORAGE_IDS = ['storage-4a', 'storage-4b', 'storage-6'];
/**
 * A sparse summer scatter of hauled-out boats on the 2022 map’s storage areas: rows along each area’s long
 * axis, a fraction of the positions filled. Scenery only. Deterministic (seeded).
 */
export function storedBoats(): StoredBoat[] {
  const rand = rng(77);
  const out: StoredBoat[] = [];
  const hulls: BoatParams['hull'][] = ['white', 'white', 'white', 'slate', 'forest', 'rust'];
  for (const id of STORAGE_IDS) {
    const ring = MASS(id).ring;
    // Long axis: the longest edge.
    let u: EN = [1, 0];
    let best = 0;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) {
        best = l;
        u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      }
    });
    const v: EN = [-u[1], u[0]];
    const us = ring.map((p) => p[0] * u[0] + p[1] * u[1]);
    const vs = ring.map((p) => p[0] * v[0] + p[1] * v[1]);
    for (let b = Math.min(...vs) + 8; b < Math.max(...vs) - 6; b += 15)
      for (let a = Math.min(...us) + 6; a < Math.max(...us) - 6; a += 6.4) {
        const roll = [rand(), rand(), rand(), rand(), rand(), rand()];
        const at: EN = [u[0] * a + v[0] * b, u[1] * a + v[1] * b];
        const clear = [[0, 0], [5.5, 0], [-5.5, 0], [0, 3], [0, -3]].every(([du, dv]) => {
          const q: EN = [at[0] + u[0] * dv! + v[0] * du!, at[1] + u[1] * dv! + v[1] * du!];
          return inPoly(q, ring) && onLand(q) && !buildingRings().some((r) => near(q, r, 5)) && !ROAD_RINGS.some((r) => inPoly(q, r));
        });
        if (!clear || closestOnRing(at, BANK_LINE, true).distance < 22) continue;
        if (roll[0]! > 0.14) continue;
        const family: BoatParams['family'] = roll[1]! < 0.42 ? 'sail' : roll[1]! < 0.76 ? 'cruiser' : 'console';
        const lengthFt = family === 'console' ? 19 + Math.round(roll[2]! * 5) : 24 + Math.round(roll[2]! * 8);
        out.push({
          at,
          // Bow across the row, alternating so the rows do not read as stamped copies.
          yaw: Math.atan2(v[1], v[0]) + (roll[3]! < 0.5 ? 0 : Math.PI) + (roll[4]! - 0.5) * 0.12,
          params: { family, lengthM: lengthFt * FEET, beamM: lengthFt * (family === 'sail' ? 0.33 : 0.35) * FEET, hull: hulls[Math.floor(roll[5]! * hulls.length)]!, canvas: family === 'sail' ? 'none' : roll[5]! < 0.5 ? 'navy' : 'sand' },
        });
      }
  }
  return out;
}

// ---------- trees ----------
/** Two loose rows behind the walk; never on water, a building, a road, a stored boat or a gangway landing. */
export function trees(stored: readonly StoredBoat[] = storedBoats()): Placed[] {
  const rand = rng(43);
  const out: Placed[] = [];
  const blockedHard = [...buildingRings(), ...ROAD_RINGS];
  const clear = (p: EN, rings: readonly (readonly EN[])[]) =>
    [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([de, dn]) => {
      const q: EN = [p[0] + de!, p[1] + dn!];
      return onLand(q) && !rings.some((r) => inPoly(q, r));
    });
  for (const [row, d] of [-11, -24].entries())
    for (const w of walk(BANK_LINE, row === 0 ? 9.5 : 13)) {
      const roll = [rand(), rand(), rand(), rand(), rand(), rand()];
      if (roll[0]! < 0.16) continue;
      const along = (roll[1]! - 0.5) * 5 + row * 6;
      const p = offset(w, d + (roll[2]! - 0.5) * (row === 0 ? 4 : 8));
      const q: EN = [p[0] - w.n[1] * along, p[1] + w.n[0] * along];
      // Buildings and roads always block a tree; open hard-standing blocks only the back row.
      if (!clear(q, row === 0 ? blockedHard : [...blockedHard, ...OPEN_RINGS])) continue;
      if (closestOnRing(q, BANK_LINE, true).distance < 7.5) continue; // not on the walk or the revetment
      if (buildingRings().some((r) => near(q, r, 6))) continue;
      if (APRONS.some((a) => near(q, a, 4)) || GANGWAYS.some((g) => Math.hypot(q[0] - g.head[0], q[1] - g.head[1]) < 7)) continue;
      if (stored.some((b) => Math.hypot(q[0] - b.at[0], q[1] - b.at[1]) < 9)) continue;
      const s = 0.82 + roll[3]! * 0.5;
      out.push({ at: q, y: 0, yaw: roll[4]! * Math.PI * 2, scale: [s, s * (0.9 + roll[5]! * 0.25), s], tilt: 0 });
    }
  return out;
}

/**
 * Low shrubs beside some of the trees (T33): the same placement rules as a tree, so none stands on water, a
 * building, a road, open hard-standing, a stored boat or the bank walk. Scenery only; seeded.
 */
export function shrubs(stored: readonly StoredBoat[] = storedBoats()): Placed[] {
  const rand = rng(59);
  const out: Placed[] = [];
  const blocked = [...buildingRings(), ...ROAD_RINGS, ...OPEN_RINGS];
  for (const t of trees(stored)) {
    const n = rand() < 0.55 ? (rand() < 0.4 ? 2 : 1) : 0;
    for (let i = 0; i < n; i++) {
      const roll = [rand(), rand(), rand(), rand()];
      const th = roll[0]! * Math.PI * 2;
      const d = 3.2 + roll[1]! * 3.4;
      const q: EN = [t.at[0] + Math.cos(th) * d, t.at[1] + Math.sin(th) * d];
      const ok = [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].every(([de, dn]) => {
        const c: EN = [q[0] + de!, q[1] + dn!];
        return onLand(c) && !blocked.some((r) => inPoly(c, r));
      });
      if (!ok || closestOnRing(q, BANK_LINE, true).distance < 7.5) continue;
      if (APRONS.some((a) => near(q, a, 3)) || GANGWAYS.some((g) => Math.hypot(q[0] - g.head[0], q[1] - g.head[1]) < 6)) continue;
      if (stored.some((b) => Math.hypot(q[0] - b.at[0], q[1] - b.at[1]) < 7)) continue;
      const s = 0.8 + roll[2]! * 0.6;
      out.push({ at: q, y: 0, yaw: roll[3]! * Math.PI * 2, scale: [s, s * (0.85 + roll[2]! * 0.3), s], tilt: 0 });
    }
  }
  return out;
}

/**
 * Scrub trees on the unmown ground outside the 2022 site boundary and on the peninsula (T33). Background
 * scenery only: loose clumps from a seeded scatter, never inside the site boundary (the approved yard stays as
 * it is), on a road or building, within 45 m of the dressed bank, or within 12 m of any water’s edge.
 * No real tree positions are sourced; this shows “rough vegetated ground”, not a survey.
 */
export function scrubTrees(): Placed[] {
  const rand = rng(67);
  const out: Placed[] = [];
  const boundary = SITE.masses.filter((m) => m.kind === 'boundary').map((m) => m.ring);
  const keepOut = [...boundary, ...buildingRings(), ...ROAD_RINGS, ...OPEN_RINGS];
  const clump = (p: EN) => Math.sin(p[0] * 0.013 + 1.3) * Math.sin(p[1] * 0.017 + 0.4) + 0.6 * Math.sin((p[0] + p[1]) * 0.0071 + 2.1) + 0.4 * Math.sin((p[0] - p[1]) * 0.023);
  for (const land of SITE.land.filter((l) => l.id === 'land-west' || l.id === 'land-east')) {
    const es = land.ring.map((p) => p[0]);
    const ns = land.ring.map((p) => p[1]);
    const step = 15;
    for (let e = Math.min(...es); e < Math.max(...es); e += step)
      for (let n = Math.min(...ns); n < Math.max(...ns); n += step) {
        const roll = [rand(), rand(), rand(), rand(), rand()];
        const q: EN = [e + (roll[0]! - 0.5) * step, n + (roll[1]! - 0.5) * step];
        if (clump(q) < 0.18 || roll[2]! < 0.25) continue;
        if (!inPoly(q, land.ring) || land.holes.some((h) => inPoly(q, h))) continue;
        if (closestOnRing(q, land.ring).distance < 12 || land.holes.some((h) => closestOnRing(q, h).distance < 12)) continue;
        if (keepOut.some((r) => near(q, r, 6))) continue;
        if (closestOnRing(q, BANK_LINE, true).distance < 45) continue;
        const s = 0.75 + roll[3]! * 0.75;
        out.push({ at: q, y: 0, yaw: roll[4]! * Math.PI * 2, scale: [s, s * (0.85 + roll[3]! * 0.3), s], tilt: 0 });
      }
  }
  return out;
}

/**
 * Parked cars on the mapped parking areas (T33): rows along each area’s long axis, about one bay in seven
 * taken, none within 30 m of the bank (the lawn and walk) or on a boat-storage area. Scenery only (ASSUME): no bay layout is sourced, and nothing here is a record. Seeded.
 */
export interface ParkedCar {
  at: EN;
  yaw: number;
  /** 0…1: picks the paint colour. */
  tone: number;
}
export function parkedCars(): ParkedCar[] {
  const rand = rng(83);
  const out: ParkedCar[] = [];
  const lots = [...SITE.masses.filter((m) => m.kind === 'parking').map((m) => m.ring), ...SITE.osmContext.filter((c) => c.kind === 'parking').map((c) => c.ring)];
  for (const ring of lots) {
    let u: EN = [1, 0];
    let best = 0;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) {
        best = l;
        u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      }
    });
    const v: EN = [-u[1], u[0]];
    const us = ring.map((p) => p[0] * u[0] + p[1] * u[1]);
    const vs = ring.map((p) => p[0] * v[0] + p[1] * v[1]);
    // Bays 2.7 m wide along the row; rows 5.4 m deep with a 6.5 m aisle after every second row.
    let row = 0;
    for (let b = Math.min(...vs) + 4; b < Math.max(...vs) - 3.5; b += row % 2 === 1 ? 5.4 : 11.9, row++)
      for (let a = Math.min(...us) + 3; a < Math.max(...us) - 3; a += 2.7) {
        const roll = [rand(), rand(), rand(), rand()];
        if (roll[0]! > 0.14) continue;
        const at: EN = [u[0] * a + v[0] * b, u[1] * a + v[1] * b];
        // Never on the lawn or the walk behind the bank, on a boat-storage area, or beside a stored boat.
        if (closestOnRing(at, BANK_LINE, true).distance < 30) continue;
        if (STORAGE_IDS.some((id) => near(at, MASS(id).ring, 4))) continue;
        const clear = [[0, 0], [2.4, 1], [-2.4, 1], [2.4, -1], [-2.4, -1]].every(([dv, du]) => {
          const q: EN = [at[0] + u[0] * du! + v[0] * dv!, at[1] + u[1] * du! + v[1] * dv!];
          return inPoly(q, ring) && onLand(q) && !buildingRings().some((r) => near(q, r, 3)) && !ROAD_RINGS.some((r) => inPoly(q, r));
        });
        if (!clear) continue;
        out.push({ at, yaw: Math.atan2(v[1], v[0]) + (roll[1]! < 0.5 ? 0 : Math.PI) + (roll[2]! - 0.5) * 0.06, tone: roll[3]! });
      }
  }
  return out;
}

/** Bank length per revetment chunk (m), and the camera distance inside which a chunk shows every stone. */
export const ROCK_CHUNK_M = 70;
export const ROCK_FINE_DISTANCE = 190;
/** The revetment grouped into bank chunks, each with a full and a coarse (fewer, larger stones) set. */
export function revetmentChunks(): { center: EN; fine: Placed[]; coarse: Placed[] }[] {
  const bucket = (rocks: Placed[]) => {
    const m = new Map<number, Placed[]>();
    for (const r of rocks) {
      const k = Math.floor((r.s ?? 0) / ROCK_CHUNK_M);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  };
  const fine = bucket(revetment(() => 1));
  const coarse = bucket(revetment(() => 0.5));
  return [...fine.keys()].sort((a, b) => a - b).map((k) => {
    const f = fine.get(k)!;
    return { center: [f.reduce((s, r) => s + r.at[0], 0) / f.length, f.reduce((s, r) => s + r.at[1], 0) / f.length] as EN, fine: f, coarse: coarse.get(k) ?? [] };
  });
}
