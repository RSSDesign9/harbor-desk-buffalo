/**
 * Pure Dock B layout math (local metres). No three.js here, so it is unit-testable.
 * All dock component dimensions are ASSUME (design/ASSET-PLAN.md): floating headwalk 2.4 m wide,
 * fingers 0.6 m wide, piles at finger ends. Slip polygons are berth WATER; decks are built beside them.
 */
import type { EN, SlipGeom } from '../data/site.ts';

export const DECK_WIDTH_M = 2.4;
export const FINGER_WIDTH_M = 0.6;
export const FINGER_LENGTH_RATIO = 0.8;
export const DECK_TOP_Y = 0.45; // floating dock freeboard (ASSUME)
export const FEET = 0.3048;

const sub = (a: EN, b: EN): [number, number] => [a[0] - b[0], a[1] - b[1]];
const add = (a: EN, b: EN): [number, number] => [a[0] + b[0], a[1] + b[1]];
const mul = (a: EN, k: number): [number, number] => [a[0] * k, a[1] * k];
const len = (a: EN) => Math.hypot(a[0], a[1]);
const norm = (a: EN): [number, number] => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

/** Unit vector from a slip’s dock edge toward open water, and the along-dock unit vector. */
export function slipAxes(s: SlipGeom): { out: [number, number]; along: [number, number] } {
  const out = norm(sub(s.outer, s.inner));
  return { out, along: [-out[1], out[0]] };
}

/** Polygon (local [e, n]) for a headwalk deck strip: from `waterOffset` metres water-side of the line back to the land side. */
export function deckStrip(line: readonly EN[], towardWater: EN, waterOffset = 0.55): [number, number][][] {
  const quads: [number, number][][] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const t = norm(sub(b, a));
    let n: [number, number] = [-t[1], t[0]];
    if (n[0] * towardWater[0] + n[1] * towardWater[1] < 0) n = [-n[0], -n[1]];
    const w = mul(n, waterOffset);
    const l = mul(n, waterOffset - DECK_WIDTH_M);
    // Extend each segment slightly so joints close.
    const a2 = add(a, mul(t, -0.3));
    const b2 = add(b, mul(t, 0.3));
    quads.push([add(a2, l), add(b2, l), add(b2, w), add(a2, w)]);
  }
  return quads;
}

/** Fingers sit on the boundaries between adjacent slips of one run (and at each run’s ends). */
export function fingerPolygons(slips: readonly SlipGeom[]): { polygon: [number, number][]; tip: [number, number] }[] {
  const out: { polygon: [number, number][]; tip: [number, number] }[] = [];
  const sorted = [...slips];
  const widthOf = (s: SlipGeom) => len(sub(s.corners[1]!, s.corners[0]!)) < len(sub(s.corners[2]!, s.corners[1]!)) ? len(sub(s.corners[1]!, s.corners[0]!)) : len(sub(s.corners[2]!, s.corners[1]!));
  const lengthOf = (s: SlipGeom) => len(sub(s.outer, s.inner));
  const boundaries: { base: [number, number]; out: [number, number]; length: number }[] = [];
  sorted.forEach((s, i) => {
    const { out: o, along } = slipAxes(s);
    const half = widthOf(s) / 2;
    const L = lengthOf(s) * FINGER_LENGTH_RATIO;
    const prev = sorted[i - 1];
    const adjacentPrev = prev && len(sub(prev.inner, s.inner)) < widthOf(s) * 1.2;
    // boundary on the “−along” side unless the previous slip already produced it
    if (!adjacentPrev) boundaries.push({ base: add(s.inner, mul(along, -half)), out: o, length: L });
    boundaries.push({ base: add(s.inner, mul(along, half)), out: o, length: L });
  });
  for (const b of boundaries) {
    const side: [number, number] = [-b.out[1] * (FINGER_WIDTH_M / 2), b.out[0] * (FINGER_WIDTH_M / 2)];
    const tip = add(b.base, mul(b.out, b.length));
    out.push({ polygon: [add(b.base, side), add(tip, side), sub(tip, side), sub(b.base, side)], tip });
  }
  return out;
}

export interface BoatPlacement {
  /** Hull centre, local [e, n]. */
  center: [number, number];
  /** Yaw so that the hull’s +x (bow) points toward open water: angle in the (east, north) plane, radians. */
  yaw: number;
  lengthM: number;
  beamM: number;
}

/** Stern toward the dock, bow out; clamped to stay inside the berth with clearance. */
export function placeBoat(s: SlipGeom, lengthFt: number, beamFt: number): BoatPlacement {
  const { out } = slipAxes(s);
  const slipLen = len(sub(s.outer, s.inner));
  const lengthM = Math.min(lengthFt * FEET, slipLen - 0.9);
  const sternGap = 0.6;
  const center = add(s.inner, mul(out, sternGap + lengthM / 2));
  return { center, yaw: Math.atan2(out[1], out[0]), lengthM, beamM: beamFt * FEET };
}

/** Footprint rectangle of a placement (for tests and contact shadows). */
export function placementFootprint(p: BoatPlacement): [number, number][] {
  const u: [number, number] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  const v: [number, number] = [-u[1], u[0]];
  const hl = p.lengthM / 2;
  const hb = p.beamM / 2;
  return [add(add(p.center, mul(u, -hl)), mul(v, -hb)), add(add(p.center, mul(u, hl)), mul(v, -hb)), add(add(p.center, mul(u, hl)), mul(v, hb)), add(add(p.center, mul(u, -hl)), mul(v, hb))];
}

/** Local [e, n] → scene [x, z] (x = east, z = −north). */
export const toXZ = (p: EN): [number, number] => [p[0], -p[1]];
/** Local yaw (radians in the e/n plane, CCW from east) → three.js rotation.y. */
export const yawToRotationY = (yaw: number) => yaw;
