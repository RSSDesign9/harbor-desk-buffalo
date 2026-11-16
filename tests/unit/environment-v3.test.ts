/**
 * Batch 12 (T33): the environment realism pass. Pure rules only: generated textures, the daylight keys,
 * outward-facing wrapped patches, the new scenery placement (shrubs, scrub trees, parked cars) and asset sizes.
 */
import { describe, expect, it } from 'vitest';
import { SITE, type EN } from '../../src/data/site.ts';
import { buildCar } from '../../src/scene/assets/buildings.ts';
import { SCRUB_FORM, TREE_FORMS, TREE_FORMS_FAR, buildShrub, buildTree } from '../../src/scene/assets/foliage.ts';
import { MeshBuilder, finish, type V3 } from '../../src/scene/assets/mesh.ts';
import { KEYS, daylightAt } from '../../src/scene/daylight.ts';
import { DETAIL_SIZE, detailPixels, ripplePixels } from '../../src/scene/detail.ts';
import { GROUND } from '../../src/scene/ground.ts';
import { DECK_TOP_Y, placeBoat } from '../../src/scene/layout.ts';
import { DOCK_PLANS, WEST_BANK, closestOnRing } from '../../src/scene/marina.ts';
import { MAX_LINE_M, gunwaleY, mooringLines, ropePath } from '../../src/scene/mooring.ts';
import { ribbon } from '../../src/scene/shapes.ts';
import { BANK_LINE, buildingRings, inPoly, parkedCars, scrubTrees, shrubs, storedBoats, trees } from '../../src/scene/surroundings.ts';

const buildings = buildingRings();
const roads = SITE.lines.filter((l) => l.kind === 'road').map((l) => ribbon(l.line, l.widthM));
const tris = (g: { index: { count: number } | null }) => g.index!.count / 3;

describe('generated detail textures (T33)', () => {
  it('are deterministic, full-range and the declared size', () => {
    const a = detailPixels();
    expect(a.length).toBe(DETAIL_SIZE * DETAIL_SIZE * 4);
    expect(Array.from(detailPixels())).toEqual(Array.from(a));
    for (let c = 0; c < 4; c++) {
      let lo = 255;
      let hi = 0;
      for (let i = c; i < a.length; i += 4) {
        lo = Math.min(lo, a[i]!);
        hi = Math.max(hi, a[i]!);
      }
      expect(lo).toBe(0);
      expect(hi).toBe(255);
    }
  });

  it('the ripple texture has zero mean slope (no built-in tilt) and tiles: opposite edges continue each other', () => {
    const r = ripplePixels();
    expect(Array.from(ripplePixels())).toEqual(Array.from(r));
    const n = DETAIL_SIZE;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n * n; i++) {
      sx += r[i * 4]!;
      sy += r[i * 4 + 1]!;
    }
    expect(sx / (n * n)).toBeCloseTo(127.5, 0);
    expect(sy / (n * n)).toBeCloseTo(127.5, 0);
    // Height (blue) across the wrap is no rougher than height between neighbours inside the tile.
    let wrap = 0;
    let inside = 0;
    for (let y = 0; y < n; y++) {
      wrap += Math.abs(r[(y * n + n - 1) * 4 + 2]! - r[y * n * 4 + 2]!);
      inside += Math.abs(r[(y * n + 100) * 4 + 2]! - r[(y * n + 101) * 4 + 2]!);
    }
    expect(wrap).toBeLessThan(inside * 1.6);
  });
});

describe('time-of-day sky (T33)', () => {
  it('lamps are off through the working day and fully on by 22:00, rising steadily after sunset', () => {
    for (const hh of [8, 9, 12, 15, 17]) expect(daylightAt(hh * 60).night).toBe(0);
    expect(daylightAt(22 * 60).night).toBe(1);
    let last = -1;
    for (let m = 19 * 60 + 45; m <= 22 * 60; m += 5) {
      const n = daylightAt(m).night;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('every key has a horizon, an overhead colour, a fill, a glow and a cloud colour', () => {
    for (const k of KEYS) for (const c of [k.sky, k.zenith, k.fill, k.glow, k.cloud, k.sun]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    // The sky overhead is darker than the horizon at every hour (clear-sky gradient).
    const luma = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;
    for (const k of KEYS) expect(luma(k.zenith)).toBeLessThan(luma(k.sky));
  });
});

describe('wrapped patches face outward whichever way they were wound (T33)', () => {
  const column = (reverse: boolean) => {
    const mb = new MeshBuilder();
    const pts: V3[][] = [];
    for (let s = 0; s < 12; s++) {
      const th = ((reverse ? -s : s) / 12) * Math.PI * 2;
      pts.push([0, 4, 8].map((y): V3 => [5 + Math.cos(th) * 2, y, -3 + Math.sin(th) * 2]));
    }
    mb.grid(pts, finish('#888888', 0.9), { closeU: true });
    return mb.build();
  };
  it.each([false, true])('a column wound %s', (reverse) => {
    const g = column(reverse);
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      const out = [pos.getX(i) - 5, 0, pos.getZ(i) + 3];
      expect(nor.getX(i) * out[0]! + nor.getZ(i) * out[2]!).toBeGreaterThan(0);
    }
    // Winding agrees with the normals: the first triangle's geometric normal points out too.
    const [a, b, c] = [0, 1, 2].map((k) => g.index!.getX(k));
    const p = (i: number): V3 => [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const [pa, pb, pc] = [p(a!), p(b!), p(c!)];
    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = pc[2] - pa[2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    expect(n[0]! * (pa[0] - 5) + n[2]! * (pa[2] + 3)).toBeGreaterThan(0);
  });
});

describe('new scenery keeps to the validated geography (T33)', () => {
  const stored = storedBoats();
  const clearOfHardThings = (p: EN) => !buildings.some((r) => inPoly(p, r)) && !roads.some((r) => inPoly(p, r));

  it('shrubs stand on land near a tree, off buildings, roads and the bank walk', () => {
    const list = shrubs(stored);
    const ts = trees(stored);
    expect(list.length).toBeGreaterThan(15);
    expect(list.length).toBeLessThan(ts.length * 2);
    for (const s of list) {
      expect(inPoly(s.at, WEST_BANK)).toBe(true);
      expect(clearOfHardThings(s.at)).toBe(true);
      expect(closestOnRing(s.at, BANK_LINE, true).distance).toBeGreaterThanOrEqual(7.5);
      expect(Math.min(...ts.map((t) => Math.hypot(t.at[0] - s.at[0], t.at[1] - s.at[1])))).toBeLessThan(7);
    }
  });

  it('scrub trees stay outside the 2022 site boundary, on land, well back from the dressed bank', () => {
    const list = scrubTrees();
    const boundary = SITE.masses.filter((m) => m.kind === 'boundary').map((m) => m.ring);
    const lands = SITE.land.filter((l) => l.id === 'land-west' || l.id === 'land-east');
    expect(list.length).toBeGreaterThan(60);
    expect(list.length).toBeLessThan(500);
    for (const t of list) {
      expect(lands.some((l) => inPoly(t.at, l.ring) && !l.holes.some((h) => inPoly(t.at, h)))).toBe(true);
      expect(boundary.some((r) => inPoly(t.at, r))).toBe(false);
      expect(clearOfHardThings(t.at)).toBe(true);
      expect(closestOnRing(t.at, BANK_LINE, true).distance).toBeGreaterThanOrEqual(45);
    }
  });

  it('parked cars sit inside a mapped parking area, off the lawn and walk, and never touch', () => {
    const cars = parkedCars();
    const lots = [...SITE.masses.filter((m) => m.kind === 'parking').map((m) => m.ring), ...SITE.osmContext.filter((c) => c.kind === 'parking').map((c) => c.ring)];
    expect(cars.length).toBeGreaterThan(10);
    expect(cars.length).toBeLessThan(160);
    for (const c of cars) {
      expect(lots.some((r) => inPoly(c.at, r))).toBe(true);
      expect(inPoly(c.at, WEST_BANK)).toBe(true);
      expect(clearOfHardThings(c.at)).toBe(true);
      expect(closestOnRing(c.at, BANK_LINE, true).distance).toBeGreaterThanOrEqual(30);
      expect(c.tone).toBeGreaterThanOrEqual(0);
      expect(c.tone).toBeLessThan(1);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) expect(Math.hypot(cars[i]!.at[0] - cars[j]!.at[0], cars[i]!.at[1] - cars[j]!.at[1])).toBeGreaterThan(2.4);
  });

  it('placement is deterministic', () => {
    expect(scrubTrees()).toEqual(scrubTrees());
    expect(parkedCars()).toEqual(parkedCars());
    expect(shrubs(stored)).toEqual(shrubs(stored));
  });
});

describe('scenery assets stay within their size (T33)', () => {
  it('trees, scrub, shrub and car', () => {
    for (const f of TREE_FORMS) {
      const g = buildTree(f);
      expect(tris(g)).toBeGreaterThan(2500);
      expect(tris(g)).toBeLessThan(6500);
      expect(g.boundingBox!.min.y).toBeGreaterThan(-0.05); // stands on the ground
    }
    // The distant models are an order of magnitude lighter, and about the same size and shape.
    TREE_FORMS_FAR.forEach((f, i) => {
      const far = buildTree(f);
      const near = buildTree(TREE_FORMS[i]!);
      expect(tris(far)).toBeLessThan(600);
      expect(Math.abs(far.boundingBox!.max.y - near.boundingBox!.max.y)).toBeLessThan(1.2);
    });
    expect(tris(buildTree(SCRUB_FORM))).toBeLessThan(420);
    expect(tris(buildShrub())).toBeLessThan(520);
    const car = buildCar();
    expect(tris(car)).toBeLessThan(420);
    const size = car.boundingBox!;
    expect(size.max.x - size.min.x).toBeGreaterThan(4.2);
    expect(size.max.x - size.min.x).toBeLessThan(4.7);
  });

  it('ground kinds are distinct small integers (they travel as one float per vertex)', () => {
    const v = Object.values(GROUND);
    expect(new Set(v).size).toBe(v.length);
    for (const k of v) expect(Number.isInteger(k) && k >= 0 && k < 16).toBe(true);
  });
});

describe('mooring lines (T33)', () => {
  it('every berth gets two stern lines to its headwalk and bow lines only where a finger runs alongside', () => {
    let withBow = 0;
    for (const plan of DOCK_PLANS)
      for (const slip of plan.slips) {
        const p = placeBoat(slip, 28, 9.5);
        const lines = mooringLines(slip, p, plan);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(lines.length).toBeLessThanOrEqual(4);
        if (lines.length > 2) withBow += 1;
        for (const l of lines) {
          const len = Math.hypot(l.to[0] - l.from[0], l.to[2] - l.from[2]);
          expect(len).toBeGreaterThan(0.2);
          expect(len).toBeLessThanOrEqual(MAX_LINE_M);
          // From the gunwale down to a dock: never up into the air, never under the water.
          expect(l.from[1]).toBeCloseTo(gunwaleY(p.lengthM), 9);
          expect(l.to[1]).toBeGreaterThanOrEqual(DECK_TOP_Y);
          expect(l.to[1]).toBeLessThan(2);
        }
      }
    expect(withBow).toBeGreaterThan(100); // nearly every berth has a finger on at least one side
  });

  it('a rope sags between its ends and stays above the water', () => {
    const plan = DOCK_PLANS.find((d) => d.dock === 'B')!;
    const slip = plan.slips.find((s) => s.id === 'B-12')!;
    for (const l of mooringLines(slip, placeBoat(slip, 29, 10), plan)) {
      const path = ropePath(l);
      expect(path[0]).toEqual([...l.from]);
      expect(path[path.length - 1]![1]).toBeCloseTo(l.to[1], 9);
      const mid = path[Math.floor(path.length / 2)]!;
      expect(mid[1]).toBeLessThan((l.from[1] + l.to[1]) / 2);
      for (const q of path) expect(q[1]).toBeGreaterThan(0.2);
    }
  });
});
