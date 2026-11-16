/**
 * Where a cabin cruiser carries its name board (transom) and registration panels (both bow quarters), in the
 * boat's local frame (x toward the bow, y up from the waterline, z to port). Geometry only: the text arrives
 * as data at render time and only for a CONFIRMED identity (src/scene/NameBoard.tsx). Nothing here knows
 * which vessel it is decorating.
 */
import { cruiserHullForm } from './cruiser.ts';
import { hullPoint, sectionHalf, sheerY } from './hull.ts';
import type { V3 } from './mesh.ts';

export interface DecalPlacement {
  position: V3;
  /** Unit vectors: decal width direction (text runs along it), up, and outward normal. */
  xAxis: V3;
  yAxis: V3;
  normal: V3;
  width: number;
  height: number;
}

const OFFSET = 0.012; // clear of the hull surface, so the decal never z-fights
/** Text direction for a decal facing `normal` with y up: x = y × n, so it reads left to right from outside. */
const textAxis = (n: V3): V3 => [n[2], 0, -n[0]];

export function cruiserDecals(lengthM: number, beamM: number): { name: DecalPlacement; registration: DecalPlacement[] } {
  const h = cruiserHullForm(lengthM, beamM);
  const k = lengthM / 8.7;
  // Transom: vertical (no stern rake), between the swim platform (≈0.31k) and the sheer.
  const yName = 0.5 * (0.36 * k + h.fbStern);
  const halfW = sectionHalf(h, 0, yName);
  const width = Math.min(halfW * 2 * 0.74, 1.1 * k);
  const name: DecalPlacement = {
    position: [h.x0 - OFFSET, yName, 0],
    xAxis: textAxis([-1, 0, 0]),
    yAxis: [0, 1, 0],
    normal: [-1, 0, 0],
    width,
    height: width / 4.2,
  };
  // Registration on both forward quarters, as the panels are usually carried.
  const registration = ([1, -1] as const).map((side) => {
    const t = 0.66;
    const y = 0.7 * sheerY(h, t);
    const a = hullPoint(h, t - 0.02, y, side);
    const b = hullPoint(h, t + 0.02, y, side);
    const p = hullPoint(h, t, y, side);
    const tx = b[0] - a[0];
    const tz = b[2] - a[2];
    const tl = Math.hypot(tx, tz) || 1;
    const along: V3 = [tx / tl, 0, tz / tl];
    // Outward normal in the water plane (port = +z, starboard = −z), tilted forward where the hull narrows.
    const normal: V3 = [-side * along[2], 0, side * along[0]];
    const xAxis = textAxis(normal);
    const w = 0.56 * k;
    return { position: [p[0] + normal[0] * OFFSET, y, p[2] + normal[2] * OFFSET] as V3, xAxis, yAxis: [0, 1, 0] as V3, normal, width: w, height: w / 5 };
  });
  return { name, registration };
}
