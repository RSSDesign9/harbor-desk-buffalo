/**
 * Mooring lines (TASKS T33). Pure layout math, local metres in, scene coordinates out: for a boat lying stern-to
 * in its slip, two stern lines to the headwalk beside the slip’s cleat and one line from each bow quarter to
 * the finger on that side, where there is one. ASSUME scenery: how each boat is really tied is not recorded.
 *
 * Lines are drawn only for hulls whose presence is confirmed (Marina.tsx), so a line never ties up a boat the
 * records are unsure about, and they go when the boat goes.
 */
import type { EN, SlipGeom } from '../data/site.ts';
import { DECK_TOP_Y, type BoatPlacement } from './layout.ts';
import type { DockPlan } from './marina.ts';

export type P3 = readonly [number, number, number];
export interface MooringLine {
  /** On the boat, at the gunwale. */
  from: P3;
  /** On the dock. */
  to: P3;
}

/** Longest rope drawn: beyond this the boat is not beside that piece of dock. */
export const MAX_LINE_M = 4.6;
/** Deck height where a line leaves the boat (m above the water): low for a small boat, higher for a large one. */
export const gunwaleY = (lengthM: number) => 0.5 + 0.04 * lengthM;

const scene = (p: EN, y: number): P3 => [p[0], y, -p[1]];
const dist = (a: EN, b: EN) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function mooringLines(s: SlipGeom, p: BoatPlacement, plan: DockPlan): MooringLine[] {
  const u: EN = [Math.cos(p.yaw), Math.sin(p.yaw)]; // toward the bow (open water)
  const v: EN = [-u[1], u[0]];
  const at = (along: number, across: number): EN => [p.center[0] + u[0] * along + v[0] * across, p.center[1] + u[1] * along + v[1] * across];
  const y = gunwaleY(p.lengthM);
  const out: MooringLine[] = [];
  const add = (from: EN, to: EN, toY: number) => {
    if (dist(from, to) <= MAX_LINE_M) out.push({ from: scene(from, y), to: scene(to, toY) });
  };
  // Stern lines: each quarter to the headwalk, a little outboard of the hull, level with the slip's cleat.
  const cleat = plan.cleats[plan.slips.findIndex((x) => x.id === s.id)] ?? s.inner;
  for (const side of [-1, 1]) {
    const from = at(-(p.lengthM / 2 - 0.3), side * (p.beamM / 2 - 0.15));
    const to: EN = [cleat[0] + v[0] * side * (p.beamM / 2 + 0.3), cleat[1] + v[1] * side * (p.beamM / 2 + 0.3)];
    add(from, to, plan.deckTop + 0.06);
  }
  // Bow lines: to the finger along each side of the berth, if this slip has one there.
  const width = Math.min(dist(s.corners[0]!, s.corners[1]!), dist(s.corners[1]!, s.corners[2]!));
  for (const side of [-1, 1]) {
    const boundary: EN = [s.inner[0] + v[0] * side * (width / 2), s.inner[1] + v[1] * side * (width / 2)];
    const finger = plan.fingers.find((f) => dist(f.base, boundary) < 0.9);
    if (!finger) continue;
    const fingerLen = dist(finger.base, finger.tip);
    const along = Math.min(fingerLen - 1.0, 0.6 + p.lengthM * 0.72);
    if (along < 1) continue;
    const to: EN = [finger.base[0] + finger.out[0] * along, finger.base[1] + finger.out[1] * along];
    add(at(p.lengthM * 0.22, side * (p.beamM / 2 - 0.12)), to, DECK_TOP_Y + 0.06);
  }
  return out;
}

/** A rope hangs: points along a line with a little sag in the middle. */
export function ropePath(l: MooringLine, segments = 4): P3[] {
  const len = Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1], l.to[2] - l.from[2]);
  const sag = 0.04 + 0.05 * len;
  const pts: P3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push([l.from[0] + (l.to[0] - l.from[0]) * t, l.from[1] + (l.to[1] - l.from[1]) * t - sag * 4 * t * (1 - t), l.from[2] + (l.to[2] - l.from[2]) * t]);
  }
  return pts;
}
