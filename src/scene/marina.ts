/**
 * Layout of every assumed dock, A–E (TASKS T14). Pure math in local metres ([east, north]); no three.js,
 * so it is unit-tested (tests/unit/marina-layout.test.ts).
 *
 * Inputs: the OSM headwalk lines (DOC) and the 126 supplied berth polygons (ASSUME), unchanged.
 * Everything built on them here is ASSUME (design/ASSET-PLAN.md): deck widths, finger piers on the berth
 * boundaries, piles, pedestals, cleats, and one gangway per floating dock.
 *
 * Fixed docks (A, E) are quay walls: a concrete apron from the headwalk line back to the bank, with floating
 * finger piers. Floating docks (B, C, D) are a 2.4 m planked headwalk on floats.
 */
import { SITE, type EN, type SlipGeom } from '../data/site.ts';
import { DECK_TOP_Y, DECK_WIDTH_M, deckStrip, fingerPolygons, slipAxes } from './layout.ts';

export const LAND_TOP = 1.2; // bank height above the water (ASSUME)
/** Top of a fixed quay apron: just proud of the bank. */
export const QUAY_TOP_Y = LAND_TOP + 0.12;
/** Offsets from the headwalk line (m, + toward the water). Slip inner edges sit on the line. */
const PEDESTAL_OFFSET = -1.45;
const CLEAT_OFFSET = 0.36;
const ANCHOR_PILE_OFFSET = -2.08;
const TIP_PILE_GAP = 0.24;
/** Water-side overhang of every headwalk deck past the OSM line (as validated for Dock B). */
const WATER_OFFSET = 0.55;

export interface FingerPlan {
  polygon: [number, number][];
  /** Pile position just beyond the outer end. */
  tip: EN;
  base: EN;
  out: EN;
}
export interface DockPlan {
  dock: string;
  kind: 'fixed' | 'floating';
  slips: readonly SlipGeom[];
  /** Unit vector from the dock toward open water. */
  toward: EN;
  /** Headwalk deck rectangles in run order. */
  deck: [number, number][][];
  fingers: FingerPlan[];
  pedestals: { at: EN; facing: EN }[];
  cleats: EN[];
  piles: EN[];
  /** Headwalk walking surface height. Fingers always float at DECK_TOP_Y. */
  deckTop: number;
  /** Bank-to-dock gangway for a floating dock (bank end, dock end). */
  gangway: { head: EN; foot: EN } | null;
}

const off = (p: EN, dir: EN, d: number): EN => [p[0] + dir[0] * d, p[1] + dir[1] * d];
const mid = (a: EN, b: EN): EN => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: EN, b: EN) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Closest point on a closed ring (or, with `open`, on a polyline) to `p`. */
export function closestOnRing(p: EN, ring: readonly EN[], open = false): { point: EN; distance: number } {
  let best: { point: EN; distance: number } = { point: ring[0]!, distance: Infinity };
  for (let i = 0; i < ring.length - (open ? 1 : 0); i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const q: EN = [a[0] + vx * t, a[1] + vy * t];
    const d = dist(p, q);
    if (d < best.distance) best = { point: q, distance: d };
  }
  return best;
}

export const WEST_BANK: readonly EN[] = SITE.land.find((l) => l.id === 'land-west')!.ring;
export const insideRing = (p: EN, ring: readonly EN[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

/**
 * Fixed quay apron: for each headwalk segment that runs along the shore, a strip from the water-side
 * overhang back past the bank; for a segment that turns out toward the water, a 2.4 m pier centred on it.
 */
function quayStrip(line: readonly EN[], toward: EN): [number, number][][] {
  const quads: [number, number][][] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const l = dist(a, b) || 1;
    const t: EN = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    let n: EN = [-t[1], t[0]];
    const across = n[0] * toward[0] + n[1] * toward[1];
    if (across < 0) n = [-n[0], -n[1]];
    if (Math.abs(across) < 0.5) {
      // Return pier: centred, standard width.
      quads.push([off(a, n, -DECK_WIDTH_M / 2), off(b, n, -DECK_WIDTH_M / 2), off(b, n, DECK_WIDTH_M / 2), off(a, n, DECK_WIDTH_M / 2)] as [number, number][]);
      continue;
    }
    // Reach back to 1.2 m inside the bank at the farther end of this segment.
    const back = Math.max(closestOnRing(a, WEST_BANK).distance, closestOnRing(b, WEST_BANK).distance) + 1.2;
    const a2 = off(a, t, -0.3);
    const b2 = off(b, t, 0.3);
    quads.push([off(a2, n, -back), off(b2, n, -back), off(b2, n, WATER_OFFSET), off(a2, n, WATER_OFFSET)] as [number, number][]);
  }
  return quads;
}

function planDock(dock: string): DockPlan {
  const hw = SITE.headwalks[dock]!;
  const slips = SITE.slips.filter((s) => s.dock === dock);
  const toward = slipAxes(slips[Math.floor(slips.length / 2)]!).out;
  const fixed = hw.kind === 'fixed';
  const fingers: FingerPlan[] = fingerPolygons(slips).map((f) => {
    const a = f.polygon[0]!;
    const b = f.polygon[1]!;
    const len = dist(a, b) || 1;
    const out: EN = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return { polygon: f.polygon, tip: off(f.tip, out, TIP_PILE_GAP), base: mid(f.polygon[0]!, f.polygon[3]!), out };
  });
  const piles = [...fingers.map((f) => f.tip)];
  // Floating headwalks are held by anchor piles on their land side; a quay needs none.
  if (!fixed) piles.push(...fingers.filter((_f, i) => i % 4 === 0).map((f) => off(f.base, f.out, ANCHOR_PILE_OFFSET)));

  const planGangway = (): DockPlan['gangway'] => {
    if (fixed) return null;
    if (dock === 'B') {
      // Run break between B-19 and B-20 (2022 map marker 5, ±10 m): validated in Batch 4.
      const a = hw.line[4]!;
      const b = hw.line[5]!;
      const m = mid(a, b);
      const l = dist(a, b) || 1;
      let n: EN = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
      if (n[0] * toward[0] + n[1] * toward[1] < 0) n = [-n[0], -n[1]];
      return ({ head: off(m, n, -6.4), foot: off(m, n, -1.0) });
    }
    {
      // Where the headwalk comes closest to the bank (ASSUME): a short ramp straight across.
      const nearest = hw.line.map((p) => ({ p, c: closestOnRing(p, WEST_BANK) })).sort((x, y) => x.c.distance - y.c.distance)[0]!;
      if (insideRing(nearest.p, WEST_BANK)) {
        // The OSM headwalk itself comes ashore here: ramp down along it from where it crosses the bank.
        const i = hw.line.indexOf(nearest.p);
        const other = hw.line[i === 0 ? 1 : i - 1]!;
        const l = dist(nearest.p, other) || 1;
        const dir: EN = [(other[0] - nearest.p[0]) / l, (other[1] - nearest.p[1]) / l];
        let t = 0;
        while (t < l && insideRing(off(nearest.p, dir, t), WEST_BANK)) t += 0.25;
        return ({ head: off(nearest.p, dir, Math.max(0, t - 1.6)), foot: off(nearest.p, dir, t + 1.2) });
      }
      const d = nearest.c.distance || 1;
      const inland: EN = [(nearest.c.point[0] - nearest.p[0]) / d, (nearest.c.point[1] - nearest.p[1]) / d];
      // Land the ramp 1.6 m inside the bank; at a corner of the bank, turn until that point is on land.
      let head: EN = nearest.c.point;
      search: for (const reach of [1.6, 2.4, 3.4])
        for (let k = 0; k < 12; k++) {
          const a = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 6);
          const q = off(nearest.c.point, [inland[0] * Math.cos(a) - inland[1] * Math.sin(a), inland[0] * Math.sin(a) + inland[1] * Math.cos(a)], reach);
          // On land with a little margin all round, so the abutment does not hang over the water.
          if ([[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([de, dn]) => insideRing([q[0] + de!, q[1] + dn!], WEST_BANK))) {
            head = q;
            break search;
          }
        }
      return ({ head, foot: off(nearest.p, inland, 0.5) });
    }
  };
  const gangway = planGangway();

  return {
    dock,
    kind: fixed ? 'fixed' : 'floating',
    slips,
    toward,
    deck: fixed ? quayStrip(hw.line, toward) : deckStrip(hw.line, toward, WATER_OFFSET),
    fingers,
    // One shore-power pedestal per two berths (ASSUME), on the land side of the walkway.
    pedestals: fingers.filter((_f, i) => i % 2 === 1).map((f) => ({ at: off(f.base, f.out, PEDESTAL_OFFSET), facing: f.out })),
    cleats: slips.map((s) => off(s.inner, slipAxes(s).out, CLEAT_OFFSET)),
    piles,
    deckTop: fixed ? QUAY_TOP_Y : DECK_TOP_Y,
    gangway,
  };
}

export const DOCK_IDS: readonly string[] = Object.keys(SITE.headwalks).sort();
export const DOCK_PLANS: readonly DockPlan[] = DOCK_IDS.map(planDock);
export const dockPlan = (dock: string): DockPlan | undefined => DOCK_PLANS.find((d) => d.dock === dock);
