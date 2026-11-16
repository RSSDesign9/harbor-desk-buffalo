import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { slipGeom } from '../../src/data/site.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { seedSession } from '../../src/domain/session.ts';
import { LOD_DISTANCES, boatGeometry, buildBoat, lodForDistance, type BoatParams, type Lod } from '../../src/scene/assets/boat.ts';
import { DOCK_PARTS } from '../../src/scene/assets/dock.ts';
import { hullForSlip } from '../../src/scene/hulls.ts';
import { placeBoat } from '../../src/scene/layout.ts';

const FEET = 0.3048;
const fx = loadFixtures().bundle;
const SAMPLES: BoatParams[] = [
  { family: 'cruiser', lengthM: 28.5 * FEET, beamM: 9.7 * FEET, hull: 'white', canvas: 'sand' },
  { family: 'cruiser', lengthM: 26 * FEET, beamM: 8.8 * FEET, hull: 'slate', canvas: 'navy' },
  { family: 'cruiser', lengthM: 28 * FEET, beamM: 9.5 * FEET, hull: 'white', canvas: 'none' },
  { family: 'console', lengthM: 24 * FEET, beamM: 8.5 * FEET, hull: 'white', canvas: 'navy' },
  { family: 'console', lengthM: 29 * FEET, beamM: 9.5 * FEET, hull: 'slate', canvas: 'none' },
  { family: 'sail', lengthM: 27 * FEET, beamM: 9.2 * FEET, hull: 'white', canvas: 'sand' },
  { family: 'sail', lengthM: 24 * FEET, beamM: 8.2 * FEET, hull: 'rust', canvas: 'navy' },
];
const tris = (p: BoatParams, lod: Lod) => buildBoat(p, lod).getIndex()!.count / 3;

describe('boat assets (T09): dimensions, pivot and detail levels', () => {
  for (const p of SAMPLES) {
    const label = `${p.family} ${Math.round(p.lengthM / FEET)} ft ${p.hull}/${p.canvas}`;
    it(`${label}: real size, centred pivot at the waterline, bow toward +x`, () => {
      for (const lod of [0, 1, 2] as Lod[]) {
        const g = buildBoat(p, lod);
        const pos = g.getAttribute('position');
        for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i]!)).toBe(true);
        const b = g.boundingBox!;
        // Overall length is the vessel's LOA (bow pulpit / anchor may overhang a little); the hull never
        // extends past the stern end of the footprint used for berth-fit checks.
        expect(b.max.x - b.min.x, `LOD${lod} length`).toBeGreaterThan(p.lengthM - 0.25);
        expect(b.max.x - b.min.x, `LOD${lod} length`).toBeLessThan(p.lengthM + 0.45);
        expect(b.min.x, `LOD${lod} stern`).toBeGreaterThan(-p.lengthM / 2 - 0.05); // rub rail radius
        // Symmetric about the centreline; beam matches (fenders may add a hand's width each side).
        expect(Math.abs(b.max.z + b.min.z), `LOD${lod} centred`).toBeLessThan(0.02);
        expect(b.max.z - b.min.z, `LOD${lod} beam`).toBeGreaterThan(p.beamM - 0.1);
        expect(b.max.z - b.min.z, `LOD${lod} beam`).toBeLessThan(p.beamM + 0.75);
        // Floats: the hull reaches just below y = 0 and stands well above it.
        expect(b.min.y).toBeLessThan(0);
        expect(b.min.y).toBeGreaterThan(-0.6);
        expect(b.max.y).toBeGreaterThan(1.2);
        // The bow is the narrow end: vertices in the forward 5 % sit near the centreline.
        let bowHalf = 0;
        for (let i = 0; i < pos.count; i++) if (pos.getX(i) > b.max.x - 0.05 * p.lengthM && pos.getY(i) < 1.2) bowHalf = Math.max(bowHalf, Math.abs(pos.getZ(i)));
        expect(bowHalf, `LOD${lod} bow`).toBeLessThan(p.beamM * 0.3);
      }
    });
    it(`${label}: each distance representation is much cheaper than the one before`, () => {
      const [a, b, c] = [tris(p, 0), tris(p, 1), tris(p, 2)];
      expect(a).toBeLessThanOrEqual(40_000); // ASSET-PLAN ceiling for the selected boat
      expect(a).toBeGreaterThan(3_000); // meaningfully more than an extruded block
      expect(b).toBeLessThan(a * 0.5);
      expect(c).toBeLessThan(600);
      expect(c).toBeLessThan(b * 0.4);
    });
  }

  it('picks detail by camera distance and reuses geometry for identical boats', () => {
    expect(lodForDistance(20)).toBe(0);
    expect(lodForDistance(LOD_DISTANCES[0] + 1)).toBe(1);
    expect(lodForDistance(LOD_DISTANCES[1] + 1)).toBe(2);
    expect(boatGeometry(SAMPLES[0]!, 1)).toBe(boatGeometry({ ...SAMPLES[0]! }, 1));
    expect(boatGeometry(SAMPLES[0]!, 1)).not.toBe(boatGeometry(SAMPLES[1]!, 1));
  });

  it('every dock part builds with finite geometry', () => {
    for (const [id, make] of Object.entries(DOCK_PARTS)) {
      const g = make();
      const pos = g.getAttribute('position');
      expect(pos.count, id).toBeGreaterThan(0);
      for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i]!), id).toBe(true);
    }
  });
});

describe('the B-12 observation hull keeps the uncertainty story (PRD §6, §7)', () => {
  const params = (stage: 'uncertain' | 'resolved') => {
    const s = buildSnapshot(fx, stage);
    const spec = hullForSlip(fx, s, 'B-12')!;
    const place = placeBoat(slipGeom('B-12')!, spec.lengthFt, spec.beamFt);
    return { spec, params: { family: spec.family, lengthM: place.lengthM, beamM: place.beamM, hull: spec.hullColor, canvas: spec.canvas } satisfies BoatParams };
  };

  it('is a cabin cruiser with the changed (sand) canvas cover, and no hull is drawn before the observation', () => {
    expect(hullForSlip(fx, seedSession(fx), 'B-12')).toBeNull();
    const { spec } = params('uncertain');
    expect(spec.family).toBe('cruiser');
    expect(spec.canvas).toBe('sand');
    expect(spec.key).toBe('observed:B-12');
    const assigned = fx.vessels.find((v) => v.name === 'Lake Effect')!;
    expect(assigned.canvasColor).not.toBe(spec.canvas); // “cover differs from the cover on record”
  });

  it('is the same geometry after the identity is confirmed: relabelled, not swapped', () => {
    const before = params('uncertain');
    const after = params('resolved');
    expect(after.spec.key).toBe(before.spec.key);
    expect(boatGeometry(after.params, 0)).toBe(boatGeometry(before.params, 0));
  });

  it('asset names and sources carry no vessel identity', () => {
    const names = fx.vessels.map((v) => v.name);
    const ids = fx.vessels.flatMap((v) => [v.id, v.registrationSuffix].filter((x): x is string => typeof x === 'string' && x.length > 3));
    for (const p of SAMPLES) for (const lod of [0, 1, 2] as Lod[]) expect(buildBoat(p, lod).name).toMatch(/^(cruiser|console|sail)-lod[012]$/);
    const dir = new URL('../../src/scene/assets/', import.meta.url);
    const sources = [...readdirSync(dir).map((f) => readFileSync(new URL(f, dir), 'utf8')), readFileSync(new URL('../../src/scene/Boat.tsx', import.meta.url), 'utf8'), readFileSync(new URL('../../data/derived/asset-report.json', import.meta.url), 'utf8')].join('\n');
    for (const n of [...names, ...ids]) expect(sources.includes(n), n).toBe(false);
  });

  it('away vessels are still not drawn: Harbor Light’s berth stays empty at every stage', () => {
    for (const s of [seedSession(fx), buildSnapshot(fx, 'uncertain'), buildSnapshot(fx, 'resolved')]) expect(hullForSlip(fx, s, 'B-14')).toBeNull();
  });
});
