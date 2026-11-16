import { describe, expect, it } from 'vitest';
import {
  applySimilarity,
  area,
  centroid,
  closestPointOnPolyline,
  convexOverlapArea,
  fitSimilarity,
  interiorAngles,
  invertSimilarity,
  offsetPolyline,
  pointInPolygon,
} from '../../src/scene/geometry2d.ts';

const sq = (e: number, n: number, s: number) => [
  { east: e, north: n },
  { east: e + s, north: n },
  { east: e + s, north: n + s },
  { east: e, north: n + s },
];

describe('2D geometry helpers', () => {
  it('computes area and centroid of a square, open or closed', () => {
    const s = sq(0, 0, 4);
    expect(area(s)).toBeCloseTo(16);
    expect(area([...s, s[0]!])).toBeCloseTo(16);
    expect(centroid(s)).toEqual({ east: 2, north: 2 });
  });

  it('detects containment', () => {
    expect(pointInPolygon({ east: 1, north: 1 }, sq(0, 0, 2))).toBe(true);
    expect(pointInPolygon({ east: 3, north: 1 }, sq(0, 0, 2))).toBe(false);
  });

  it('measures convex overlap and treats touching edges as zero', () => {
    expect(convexOverlapArea(sq(0, 0, 2), sq(1, 1, 2))).toBeCloseTo(1);
    expect(convexOverlapArea(sq(0, 0, 2), sq(2, 0, 2))).toBeCloseTo(0);
  });

  it('reports right angles for a rectangle', () => {
    for (const a of interiorAngles(sq(0, 0, 3))) expect(a).toBeCloseTo(90);
  });

  it('finds chainage along a polyline', () => {
    const hit = closestPointOnPolyline({ east: 15, north: 3 }, [
      { east: 0, north: 0 },
      { east: 10, north: 0 },
      { east: 20, north: 0 },
    ]);
    expect(hit.distance).toBeCloseTo(3);
    expect(hit.chainage).toBeCloseTo(15);
  });

  it('offsets a polyline to its left by the requested distance', () => {
    const out = offsetPolyline([{ east: 0, north: 0 }, { east: 10, north: 0 }], 2);
    expect(out[0]!.east).toBeCloseTo(0);
    expect(out[0]!.north).toBeCloseTo(2);
    expect(out[1]!.north).toBeCloseTo(2);
  });

  it('recovers a known similarity transform and inverts it', () => {
    const truth = { s: 1.63, theta: 1.02, tx: 1100, ty: -650 };
    const src: [number, number][] = [
      [-130, 204],
      [8, -32],
      [261, -428],
    ];
    const dst = src.map((p) => applySimilarity(truth, p));
    const fit = fitSimilarity(src, dst);
    expect(fit.s).toBeCloseTo(truth.s, 6);
    expect(fit.theta).toBeCloseTo(truth.theta, 6);
    const back = applySimilarity(invertSimilarity(fit), dst[1]!);
    expect(back[0]).toBeCloseTo(8, 6);
    expect(back[1]).toBeCloseTo(-32, 6);
  });
});
