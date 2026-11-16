/**
 * Boat asset entry point: one merged geometry per (family, size, colours, LOD), cached.
 * The cache key and the geometry name carry dimensions and colours only — never a vessel identity.
 */
import type { BufferGeometry } from 'three';
import { buildConsole } from './console.ts';
import { buildCruiser } from './cruiser.ts';
import { MeshBuilder } from './mesh.ts';
import type { BoatParams, Lod } from './parts.ts';
import { buildSailboat } from './sailboat.ts';
import { finish } from './mesh.ts';
import { hasFault } from '../../app/faults.ts';

export type { BoatParams, Lod, BoatFamily } from './parts.ts';

/** Camera distance (m) beyond which the next cheaper representation is used. */
export const LOD_DISTANCES: readonly [number, number] = [95, 260];
export const lodForDistance = (d: number): Lod => (d < LOD_DISTANCES[0] ? 0 : d < LOD_DISTANCES[1] ? 1 : 2);

/** Build a boat into an existing builder (used to merge scenery boats into one draw call). */
export function addBoat(mb: MeshBuilder, p: BoatParams, lod: Lod) {
  // Dev/test fault injection (`?debug&fault=model`): the cabin-cruiser generator fails, as a broken asset would.
  // Applied here so moored AND stored boats see the same failure.
  if (p.family === 'cruiser' && hasFault('model')) throw new Error('cruiser model failed to build (fault injection)');
  if (p.family === 'cruiser') buildCruiser(mb, p, lod);
  else if (p.family === 'console') buildConsole(mb, p, lod);
  else buildSailboat(mb, p, lod);
}

export function buildBoat(p: BoatParams, lod: Lod): BufferGeometry {
  const mb = new MeshBuilder();
  addBoat(mb, p, lod);
  const g = mb.build();
  g.name = `${p.family}-lod${lod}`;
  return g;
}

const cache = new Map<string, BufferGeometry>();
const round = (n: number) => Math.round(n * 100) / 100;
export function boatGeometry(p: BoatParams, lod: Lod): BufferGeometry {
  const key = `${p.family}|${round(p.lengthM)}|${round(p.beamM)}|${p.hull}|${p.canvas}|${lod}`;
  let g = cache.get(key);
  if (!g) {
    g = buildBoat(p, lod);
    cache.set(key, g);
  }
  return g;
}

/**
 * Stand-in when a boat model fails to build (T18): a plain grey block of the hull's length and beam with a low
 * deckhouse. Deliberately generic and unfinished-looking: same for every family and colour, no cover colour,
 * never a name board, so it cannot read as a verified or specific vessel.
 */
const FALLBACK = finish('#9aa3aa', 0.9);
/** Add the stand-in block into an existing builder (stored scenery boats are one merged mesh). */
export function addFallbackBoat(mb: MeshBuilder, lengthM: number, beamM: number) {
  mb.box([0, 0.35, 0], [lengthM * 0.94, 0.9, beamM * 0.9], FALLBACK);
  mb.box([-lengthM * 0.05, 1.05, 0], [lengthM * 0.38, 0.5, beamM * 0.6], FALLBACK);
}
const fallbackCache = new Map<string, BufferGeometry>();
export function fallbackBoatGeometry(lengthM: number, beamM: number): BufferGeometry {
  const key = `${round(lengthM)}|${round(beamM)}`;
  let g = fallbackCache.get(key);
  if (!g) {
    const mb = new MeshBuilder();
    addFallbackBoat(mb, lengthM, beamM);
    g = mb.build();
    g.name = 'boat-fallback';
    fallbackCache.set(key, g);
  }
  return g;
}

export { reportModelFailure } from '../modelFailures.ts';
