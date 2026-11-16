import { describe, expect, it } from 'vitest';
import { SITE } from '../../src/data/site.ts';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { approachPath, TRANSIT_MINUTES } from '../../src/scene/approach.ts';
import { placeBoat } from '../../src/scene/layout.ts';
import { daylightAt, KEYS, localMinuteOf, sunDirection } from '../../src/scene/daylight.ts';
import { SUN_DIRECTION } from '../../src/scene/materials.ts';
import { transitsAt } from '../../src/scene/Traffic.tsx';
import { toMs } from '../../src/domain/time.ts';

const fx = loadFixtures().bundle;
const angle = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));

describe('approach paths (T30/T31): no hull teleports', () => {
  it('every berth: arrival and departure are continuous, start in the channel and end exactly on the berthed placement', () => {
    const N = 400;
    for (const s of SITE.slips) {
      const path = approachPath(s, 30, 10);
      const berth = placeBoat(s, 30, 10);
      for (const leg of ['arrival', 'departure'] as const) {
        let prev = path[leg](0);
        for (let i = 1; i <= N; i++) {
          const p = path[leg](i / N);
          expect(Math.hypot(p.center[0] - prev.center[0], p.center[1] - prev.center[1]), `${s.id} ${leg} step ${i}`).toBeLessThan(2.5);
          expect(angle(prev.yaw, p.yaw), `${s.id} ${leg} yaw step ${i}`).toBeLessThan(0.12);
          prev = p;
        }
      }
      const end = path.arrival(1);
      expect(Math.hypot(end.center[0] - berth.center[0], end.center[1] - berth.center[1])).toBeLessThan(1e-9);
      expect(angle(end.yaw, berth.yaw)).toBeLessThan(1e-9);
      const start = path.departure(0);
      expect(Math.hypot(start.center[0] - berth.center[0], start.center[1] - berth.center[1])).toBeLessThan(1e-9);
      expect(angle(start.yaw, berth.yaw)).toBeLessThan(1e-9);
      // The far end is out in the channel, well off the docks.
      const far = path.departure(1);
      expect(Math.hypot(far.center[0] - berth.center[0], far.center[1] - berth.center[1])).toBeGreaterThan(120);
    }
  });

  it('scheduled transits start at their log entry, never before it, and last TRANSIT_MINUTES', () => {
    const m = fx.movements.find((x) => x.kind === 'arrival' && x.trip === 'stay')!;
    const at = (dMin: number) => new Date(toMs(m.at) + dMin * 60_000).toISOString().replace('.000Z', 'Z');
    expect(transitsAt(fx, at(-0.5)).some((t) => t.key === m.id)).toBe(false);
    expect(transitsAt(fx, at(0)).find((t) => t.key === m.id)?.progress).toBe(0);
    expect(transitsAt(fx, at(TRANSIT_MINUTES / 2)).find((t) => t.key === m.id)?.kind).toBe('arrival');
    expect(transitsAt(fx, at(TRANSIT_MINUTES)).some((t) => t.key === m.id)).toBe(false);
    // Nothing is in transit at the scripted checkpoints: the approved views are unchanged.
    for (const t of Object.values(fx.scenario.checkpoints)) expect(transitsAt(fx, t)).toEqual([]);
  });
});

describe('time-of-day light (T31)', () => {
  it('holds the authored mid-morning light through the 08:45–09:20 scenario window', () => {
    for (const min of [8 * 60 + 45, 9 * 60, 9 * 60 + 20]) {
      const d = daylightAt(min);
      // T33 re-authored the strengths (stronger sun, lower fill) for more contrast; the direction is unchanged.
      expect(d).toMatchObject({ azimuthDeg: 125, elevationDeg: 40, sunIntensity: 2.9, hemiIntensity: 1.08, skyLight: 1, night: 0 });
      sunDirection(d).forEach((v, i) => expect(v).toBeCloseTo(SUN_DIRECTION[i]!, 9));
    }
  });

  it('moves the sun east → south → west and dims it after sunset; clamps outside 06:00–22:00', () => {
    expect(daylightAt(7 * 60).azimuthDeg).toBeLessThan(110);
    expect(daylightAt(13 * 60 + 30).elevationDeg).toBeGreaterThan(60);
    expect(daylightAt(19 * 60).azimuthDeg).toBeGreaterThan(270);
    expect(daylightAt(22 * 60).sunIntensity).toBe(0);
    expect(daylightAt(23 * 60)).toEqual(daylightAt(22 * 60));
    expect(daylightAt(5 * 60)).toEqual(daylightAt(6 * 60));
    for (let i = 1; i < KEYS.length; i++) expect(KEYS[i]!.min).toBeGreaterThanOrEqual(KEYS[i - 1]!.min);
    expect(localMinuteOf('2026-07-16T02:00:00Z')).toBe(22 * 60);
    expect(localMinuteOf('2026-07-15T12:45:00Z')).toBe(8 * 60 + 45);
  });
});
