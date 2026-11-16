/** Small parts shared by the boat families and the dock: cleats, fenders. */
import { F } from './finishes.ts';
import type { MeshBuilder, V3 } from './mesh.ts';

export type Lod = 0 | 1 | 2;
export type BoatFamily = 'cruiser' | 'console' | 'sail';
/** Everything a boat generator may know. Deliberately no vessel name, ID or registration. */
export interface BoatParams {
  family: BoatFamily;
  lengthM: number;
  beamM: number;
  hull: 'white' | 'slate' | 'forest' | 'rust';
  canvas: 'navy' | 'sand' | 'none';
}

/** Horn cleat, horn along x. `at` is the deck point under its centre. */
export function addCleat(mb: MeshBuilder, at: V3, k = 1, f = F.stainless, alongZ = false) {
  const l = 0.11 * k;
  const y = at[1];
  const a: V3 = alongZ ? [at[0], y + 0.045 * k, at[2] - l] : [at[0] - l, y + 0.045 * k, at[2]];
  const b: V3 = alongZ ? [at[0], y + 0.045 * k, at[2] + l] : [at[0] + l, y + 0.045 * k, at[2]];
  mb.cyl(a, b, 0.014 * k, 0.014 * k, 5, f);
  for (const s of [-0.4, 0.4]) {
    const base: V3 = alongZ ? [at[0], y, at[2] + l * s] : [at[0] + l * s, y, at[2]];
    mb.cyl(base, [base[0], y + 0.045 * k, base[2]], 0.016 * k, 0.012 * k, 4, f, false);
  }
}

/** Hanging fender with its lanyard up to the rail. */
export function addFender(mb: MeshBuilder, center: V3, hang: V3, k: number, lod: Lod) {
  mb.pillow(center, [0.2 * k, 0.56 * k, 0.2 * k], F.fender, { n: 2.5, seg: lod === 0 ? 6 : 4, shade: (y) => 0.86 + 0.14 * y });
  if (lod === 0) mb.cyl([center[0], center[1] + 0.26 * k, center[2]], hang, 0.008, 0.008, 3, F.rope, false);
}
