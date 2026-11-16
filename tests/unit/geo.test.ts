import { describe, expect, it } from 'vitest';
import {
  SITE_ORIGIN,
  bearingDeg,
  feetToMetres,
  fromLocal,
  localToScene,
  positionToLocal,
  toLocal,
} from '../../src/scene/geo.ts';

describe('local metric frame', () => {
  it('maps the origin to (0, 0)', () => {
    const p = toLocal(SITE_ORIGIN);
    expect(p.east).toBeCloseTo(0, 9);
    expect(p.north).toBeCloseTo(0, 9);
  });

  it('round-trips WGS84 → local → WGS84 within a millimetre across the working area', () => {
    for (const [dLon, dLat] of [
      [0.01, 0.01],
      [-0.02, 0.005],
      [0.015, -0.012],
    ] as const) {
      const src = { lon: SITE_ORIGIN.lon + dLon, lat: SITE_ORIGIN.lat + dLat };
      const back = fromLocal(toLocal(src));
      // 1e-8 degrees ≈ 1 mm
      expect(Math.abs(back.lon - src.lon)).toBeLessThan(1e-8);
      expect(Math.abs(back.lat - src.lat)).toBeLessThan(1e-8);
    }
  });

  it('uses metres: 0.001° latitude ≈ 111.1 m and 0.001° longitude ≈ 81.6 m at 42.87° N', () => {
    const north = toLocal({ lon: SITE_ORIGIN.lon, lat: SITE_ORIGIN.lat + 0.001 });
    const east = toLocal({ lon: SITE_ORIGIN.lon + 0.001, lat: SITE_ORIGIN.lat });
    expect(north.north).toBeGreaterThan(110.9);
    expect(north.north).toBeLessThan(111.2);
    expect(east.east).toBeGreaterThan(81.4);
    expect(east.east).toBeLessThan(81.8);
  });

  it('orients scene axes: east → +x, north → −z, up → +y', () => {
    expect(localToScene({ east: 5, north: 0 })).toEqual([5, 0, -0]);
    expect(localToScene({ east: 0, north: 5 }, 2)).toEqual([0, 2, -5]);
  });

  it('converts feet to metres exactly (1 ft = 0.3048 m)', () => {
    expect(feetToMetres(30)).toBeCloseTo(9.144, 10);
    expect(feetToMetres(11)).toBeCloseTo(3.3528, 10);
  });

  it('rejects non-finite or incomplete positions instead of guessing', () => {
    expect(() => positionToLocal([Number.NaN, 42.87])).toThrow(RangeError);
    expect(() => positionToLocal([-78.88])).toThrow(RangeError);
  });

  it('computes compass bearings clockwise from north', () => {
    const o = { east: 0, north: 0 };
    expect(bearingDeg(o, { east: 0, north: 1 })).toBeCloseTo(0);
    expect(bearingDeg(o, { east: 1, north: 0 })).toBeCloseTo(90);
    expect(bearingDeg(o, { east: 0, north: -1 })).toBeCloseTo(180);
  });
});
