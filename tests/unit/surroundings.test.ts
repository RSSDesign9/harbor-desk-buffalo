/**
 * Batch 6 (T15/T16): placement rules for the waterfront surroundings, and the rendering-quality step rule.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE, type EN } from '../../src/data/site.ts';
import { DOCK_PLANS, WEST_BANK, closestOnRing } from '../../src/scene/marina.ts';
import { BUILDING_PARTS } from '../../src/scene/assets/buildings.ts';
import { MAX_DPR, MIN_DPR, nextMovingDpr } from '../../src/scene/quality.ts';
import { ribbon } from '../../src/scene/shapes.ts';
import { BANK_LINE, BUILDINGS, ELEVATOR_BANK_CLEARANCE_M, ELEVATOR_INLAND_SHIFT_M, ELEVATOR_RING, SKYWAY, buildingRings, inPoly, lampPosts, promenadeRuns, revetment, revetmentChunks, storedBoats, trees, vergeRuns } from '../../src/scene/surroundings.ts';

const mass = (id: string) => SITE.masses.find((m) => m.id === id)!.ring;
const buildings = buildingRings();
const roads = SITE.lines.filter((l) => l.kind === 'road').map((l) => ribbon(l.line, l.widthM));
const onBank = (p: EN) => inPoly(p, WEST_BANK);

describe('surroundings follow the validated geography (T15)', () => {
  it('building footprints are the 2022-map masses, on land, clear of every berth and deck', () => {
    const built = { elevator: ELEVATOR_RING, service: mass('service-building'), office: mass('small-building') };
    for (const [key, id] of [['elevator', 'grain-elevator'], ['service', 'service-building'], ['office', 'small-building']] as const) {
      const f = BUILDINGS[key];
      expect(f.id).toBe(id);
      for (const p of built[key]) expect(onBank(p), `${id} corner on land`).toBe(true);
      expect(inPoly(f.center, built[key])).toBe(true);
      for (const s of SITE.slips) expect(inPoly(s.centroid, built[key]), `${s.id} under ${id}`).toBe(false);
      for (const d of DOCK_PLANS) for (const q of d.deck) for (const p of q) expect(inPoly(p, built[key]), `dock ${d.dock} deck under ${id}`).toBe(false);
    }
    expect(BUILDINGS.elevator.length).toBeGreaterThan(90);
    expect(BUILDINGS.elevator.width).toBeLessThan(45);
    // The viaduct is the mapped Skyway line, not a new placement.
    const sky = SITE.lines.find((l) => l.id === 'skyway')!;
    expect(SKYWAY.width).toBe(sky.widthM);
    expect(SKYWAY.length).toBeGreaterThan(700);
  });

  it('the digitized elevator footprint overhangs the documented canal edge, and the built one is moved inland off it', () => {
    const raw = mass('grain-elevator');
    const overhang = raw.filter((p) => !onBank(p)).map((p) => closestOnRing(p, WEST_BANK).distance);
    expect(overhang.length).toBe(2); // the two water-side corners
    expect(Math.max(...overhang)).toBeGreaterThan(15);
    expect(ELEVATOR_INLAND_SHIFT_M).toBeGreaterThan(Math.max(...overhang));
    expect(ELEVATOR_INLAND_SHIFT_M).toBeLessThan(40);
    for (const p of ELEVATOR_RING) {
      expect(onBank(p)).toBe(true);
      expect(closestOnRing(p, WEST_BANK).distance).toBeGreaterThanOrEqual(ELEVATOR_BANK_CLEARANCE_M);
    }
    // Moved, not reshaped.
    const side = (r: readonly (readonly number[])[]) => Math.hypot(r[1]![0]! - r[0]![0]!, r[1]![1]! - r[0]![1]!);
    expect(side(ELEVATOR_RING)).toBeCloseTo(side(raw), 6);
  });

  it('the walk and verge are painted only on land and never through a building', () => {
    const strips = [...promenadeRuns(), ...vergeRuns()];
    expect(promenadeRuns().length).toBeGreaterThan(0);
    for (const r of strips)
      for (const p of ribbon(r.line, r.width)) {
        expect(onBank(p), 'strip vertex over water').toBe(true);
        expect(buildings.some((b) => inPoly(p, b)), 'strip through a building').toBe(false);
      }
  });

  it('revetment runs along the bank but not under a quay apron or a gangway', () => {
    const rocks = revetment();
    expect(rocks.length).toBeGreaterThan(3000);
    const aprons = DOCK_PLANS.filter((d) => d.kind === 'fixed').flatMap((d) => d.deck);
    for (const r of rocks) expect(aprons.some((a) => inPoly(r.at, a))).toBe(false);
    const chunks = revetmentChunks();
    expect(chunks.reduce((a, c) => a + c.fine.length, 0)).toBe(rocks.length);
    for (const c of chunks) expect(c.coarse.length).toBeLessThan(c.fine.length / 2.5);
    expect(BANK_LINE.length).toBeGreaterThan(30);
  });

  it('stored boats are sparse scenery on the mapped storage areas: on land, clear of buildings, roads and each other', () => {
    const stored = storedBoats();
    expect(stored).toEqual(storedBoats()); // deterministic
    expect(stored.length).toBeGreaterThanOrEqual(8);
    expect(stored.length).toBeLessThanOrEqual(34);
    const storage = ['storage-4a', 'storage-4b', 'storage-6'].map(mass);
    for (const b of stored) {
      expect(storage.some((r) => inPoly(b.at, r)), 'outside a storage area').toBe(true);
      expect(onBank(b.at)).toBe(true);
      expect(buildings.some((r) => inPoly(b.at, r))).toBe(false);
      expect(roads.some((r) => inPoly(b.at, r))).toBe(false);
      // Scenery carries dimensions and colours only: nothing that could be read as a record.
      expect(Object.keys(b.params).sort()).toEqual(['beamM', 'canvas', 'family', 'hull', 'lengthM']);
    }
    for (let i = 0; i < stored.length; i++) for (let j = i + 1; j < stored.length; j++) expect(Math.hypot(stored[i]!.at[0] - stored[j]!.at[0], stored[i]!.at[1] - stored[j]!.at[1])).toBeGreaterThan(6);
  });

  it('trees and lamp posts stand on land, off buildings and roads, and not on a stored boat', () => {
    const stored = storedBoats();
    const ts = trees(stored);
    expect(ts.length).toBeGreaterThan(30);
    expect(ts.length).toBeLessThan(140); // restrained
    for (const t of ts) {
      expect(onBank(t.at)).toBe(true);
      expect(buildings.some((r) => inPoly(t.at, r))).toBe(false);
      expect(roads.some((r) => inPoly(t.at, r))).toBe(false);
      for (const b of stored) expect(Math.hypot(t.at[0] - b.at[0], t.at[1] - b.at[1])).toBeGreaterThan(8.9);
    }
    for (const p of lampPosts()) expect(onBank(p)).toBe(true);
  });

  it('nothing in the scene sources models a service module, a depth layer or a branded landmark', () => {
    const dir = new URL('../../src/scene/', import.meta.url);
    const files = [...readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => new URL(f, dir)), ...readdirSync(new URL('assets/', dir)).map((f) => new URL(`assets/${f}`, dir))];
    for (const f of files) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, String(f)).not.toMatch(/fuel|pump-?out|travel-?lift|depth-?contour|bathymetr|riverworks|labatt/i);
    }
    expect(Object.keys(BUILDING_PARTS)).toEqual(['grain-elevator-104x38m', 'service-shed-36x22m', 'office-20x16m', 'boat-stand-8m', 'viaduct-232m']);
  });
});

describe('adaptive pixel ratio (T16)', () => {
  it('steps down when frames run long, up when they are short, and stays inside its bounds', () => {
    expect(nextMovingDpr(1.75, 30, MAX_DPR)).toBe(1.5);
    expect(nextMovingDpr(1, 40, MAX_DPR)).toBe(MIN_DPR);
    expect(nextMovingDpr(1.25, 16.7, MAX_DPR)).toBe(1.5);
    expect(nextMovingDpr(1.75, 16.7, MAX_DPR)).toBe(MAX_DPR);
    expect(nextMovingDpr(1.5, 20, MAX_DPR)).toBe(1.5);
    // A 1× display never goes above 1.
    expect(nextMovingDpr(1, 10, 1)).toBe(1);
  });
});
