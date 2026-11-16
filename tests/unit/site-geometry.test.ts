import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { feetToMetres } from '../../src/scene/geo.ts';
import { pointInPolygon } from '../../src/scene/geometry2d.ts';

// Guards the derived output of `npm run geometry` (T02). If this fails, regenerate and re-review the plan.
const site = JSON.parse(readFileSync(new URL('../../data/derived/site-local.json', import.meta.url), 'utf8')) as {
  slips: { id: string; dock: string; length_ft: number; width_ft: number; provenance: string; derived: { measuredLength_m: number; measuredWidth_m: number; outerMid: { east: number; north: number }; corners: { east: number; north: number }[] } }[];
  landMasks: { id: string; ring: { east: number; north: number }[] }[];
  frame: { origin: { lat: number; lon: number } };
};

describe('derived site geometry', () => {
  it('preserves all 126 slip IDs and their ASSUME provenance', () => {
    expect(site.slips).toHaveLength(126);
    expect(new Set(site.slips.map((s) => s.id)).size).toBe(126);
    expect(site.slips.every((s) => s.provenance === 'ASSUME')).toBe(true);
    for (const id of ['B-10', 'B-12', 'B-14']) expect(site.slips.some((s) => s.id === id)).toBe(true);
  });

  it('keeps slip dimensions in metres consistent with the feet classes', () => {
    for (const s of site.slips) {
      expect(Math.abs(s.derived.measuredLength_m - feetToMetres(s.length_ft))).toBeLessThan(0.05 * feetToMetres(s.length_ft));
      expect(Math.abs(s.derived.measuredWidth_m - feetToMetres(s.width_ft))).toBeLessThan(0.05 * feetToMetres(s.width_ft));
    }
  });

  it('never places a slip corner under an authored land mask', () => {
    for (const s of site.slips) for (const c of s.derived.corners) for (const m of site.landMasks) expect(pointInPolygon(c, m.ring)).toBe(false);
  });

  it('records the documented origin', () => {
    expect(site.frame.origin).toMatchObject({ lat: 42.8742, lon: -78.8806 });
  });
});
