/**
 * Lofted hull shared by the boat families (TASKS T09). A hull is a function of station t (0 = stern,
 * 1 = bow) and height y, so decks, rails, stripes and portlights can all be placed ON the same surface.
 * Dimensions are real metres; the pivot is the centreline at the waterline, bow toward +x.
 */
import { clamp, lerp, shade, smooth, type Finish, type MeshBuilder, type V3 } from './mesh.ts';

export interface HullForm {
  kind: 'power' | 'sail';
  /** x of the transom at the sheer, and hull length from there to the stem. */
  x0: number;
  length: number;
  beam: number;
  /** Freeboard at the stern, the lowest point of the sheer (sail), and the bow. */
  fbStern: number;
  fbMid: number;
  fbBow: number;
  /** How far the stem recedes between the sheer and the waterline. */
  stemRake: number;
  /** How far the transom recedes forward toward the waterline (counter stern, sail). */
  sternRake: number;
}

const STEM_HALF = 0.022; // blunt stem, so the bow closes with a soft radius rather than a knife edge

export function halfBeam(h: HullForm, t: number): number {
  let pf: number;
  if (h.kind === 'power') {
    const u = clamp((t - 0.42) / 0.58);
    pf = t < 0.42 ? lerp(0.94, 1, smooth(0, 0.42, t)) : Math.pow(1 - Math.pow(u, 2.25), 0.6);
  } else {
    const u = clamp((t - 0.45) / 0.55);
    pf = t < 0.45 ? lerp(0.68, 1, Math.pow(Math.sin((Math.PI / 2) * (t / 0.45)), 0.85)) : Math.pow(1 - Math.pow(u, 1.9), 0.72);
  }
  return Math.max((h.beam / 2) * pf, STEM_HALF);
}

export function sheerY(h: HullForm, t: number): number {
  if (h.kind === 'power') return h.fbStern + (h.fbBow - h.fbStern) * Math.pow(t, 1.7);
  const m = 0.36;
  return t < m ? h.fbMid + (h.fbStern - h.fbMid) * Math.pow((m - t) / m, 2) : h.fbMid + (h.fbBow - h.fbMid) * Math.pow((t - m) / (1 - m), 2);
}

/** Half-breadth of the section at station t and height y (y may be below the waterline). */
export function sectionHalf(h: HullForm, t: number, y: number): number {
  const hb = halfBeam(h, t);
  const ys = sheerY(h, t);
  if (h.kind === 'sail') {
    const v = clamp(y / ys);
    const top = hb * (0.83 + 0.17 * (1 - Math.pow(1 - v, 2)));
    return y >= 0 ? top : Math.max(hb * 0.83 * Math.pow(clamp(1 + y / 0.4), 0.7), STEM_HALF * 0.5);
  }
  const fwd = smooth(0.38, 1, t);
  const yc = lerp(-0.07, 0.5 * ys, Math.pow(fwd, 1.6)); // chine rises out of the water toward the bow
  const zc = hb * lerp(0.94, 0.55, fwd);
  if (y >= yc) {
    const v = clamp((y - yc) / (ys - yc));
    return Math.max(zc + (hb - zc) * Math.pow(v, lerp(0.7, 1.3, fwd)), STEM_HALF);
  }
  const yk = yc - (0.22 + 0.35 * (hb / (h.beam / 2)));
  return Math.max(zc * Math.pow(clamp((y - yk) / (yc - yk)), 0.9), STEM_HALF * 0.5);
}

/** x at station t and height y, including the raked stem and (sail) counter stern. */
export function stationX(h: HullForm, t: number, y: number): number {
  const v = clamp(y / sheerY(h, t));
  const bow = Math.pow(smooth(0.5, 1, t), 1.4) * h.stemRake * Math.pow(1 - v, 1.25);
  const stern = (1 - smooth(0, 0.3, t)) * h.sternRake * (1 - v);
  return h.x0 + h.length * t - bow + stern;
}

export const hullPoint = (h: HullForm, t: number, y: number, side: 1 | -1): V3 => [stationX(h, t, y), y, side * sectionHalf(h, t, y)];
/** Point at the sheer, moved `inset` metres toward the centreline and `dy` up. */
export const sheerPoint = (h: HullForm, t: number, side: 1 | -1, inset = 0, dy = 0): V3 => {
  const ys = sheerY(h, t);
  return [stationX(h, t, ys), ys + dy, side * Math.max(halfBeam(h, t) - inset, 0)];
};
/** Station whose sheer sits at x (inverse of the un-raked station spacing). */
export const stationAt = (h: HullForm, x: number) => clamp((x - h.x0) / h.length);

export interface HullPaint {
  topsides: Finish;
  boot: Finish;
  bottom: Finish;
}
const BOOT_LOW = 0.045;
const BOOT_HIGH = 0.12;

/**
 * Hull shell: port side stern→bow, around the stem, starboard bow→stern, then a transom panel.
 * Rows run from just under the water to the sheer, with a crisp horizontal boot stripe at the waterline.
 */
export function addHull(mb: MeshBuilder, h: HullForm, paint: HullPaint, stations: number, topRows: number) {
  const rowDefs: { y: (ys: number) => number; f: Finish }[] = [
    { y: () => -0.28, f: paint.bottom },
    { y: () => BOOT_LOW, f: paint.bottom },
    { y: () => BOOT_LOW, f: paint.boot },
    { y: () => BOOT_HIGH, f: paint.boot },
    { y: () => BOOT_HIGH, f: paint.topsides },
  ];
  for (let r = 1; r <= topRows; r++) rowDefs.push({ y: (ys) => lerp(BOOT_HIGH, ys, r / topRows), f: paint.topsides });
  const cols: { t: number; side: 1 | -1 }[] = [];
  // Denser stations toward the bow, where the plan-form curves.
  const tAt = (i: number) => 1 - Math.pow(1 - i / stations, 1.35);
  for (let i = 0; i <= stations; i++) cols.push({ t: tAt(i), side: 1 });
  for (let i = stations; i >= 0; i--) cols.push({ t: tAt(i), side: -1 });
  const pts = cols.map(({ t, side }) => rowDefs.map((r) => hullPoint(h, t, r.y(sheerY(h, t)), side)));
  const occl = (_i: number, j: number) => (j <= 4 ? 0.8 : lerp(0.86, 1, clamp((j - 4) / Math.max(1, topRows - 1))));
  mb.grid(pts, paint.topsides, { finishAt: (_i, j) => rowDefs[j]!.f, shade: occl });
  // Transom: ruled between the two stern columns.
  mb.grid([pts[pts.length - 1]!, pts[0]!], paint.topsides, { finishAt: (_i, j) => (j <= 3 ? rowDefs[j]!.f : shade(paint.topsides, 0.94)), shade: occl });
}

/** Closed loop around the sheer (port stern→bow, starboard bow→stern), for rub rails and toe rails. */
export function sheerLoop(h: HullForm, stations: number, inset = 0, dy = 0): V3[] {
  const out: V3[] = [];
  const tAt = (i: number) => 1 - Math.pow(1 - i / stations, 1.35);
  for (let i = 0; i <= stations; i++) out.push(sheerPoint(h, tAt(i), 1, inset, dy));
  for (let i = stations; i >= 0; i--) out.push(sheerPoint(h, tAt(i), -1, inset, dy));
  return out;
}
