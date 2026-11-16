import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { seedSession } from '../../src/domain/session.ts';
import { agreementNightlyUsd, agreementValueUsd, awayBoats, offlineCameras, operatorSummary, slipPresence } from '../../src/domain/selectors.ts';
import { hm } from '../../src/data/generate.ts';
import { localDate } from '../../src/domain/time.ts';

const fx = loadFixtures().bundle;
const seed = seedSession(fx);
const night = fx.scenario.date;
const heldTonight = fx.agreements.filter((a) => a.status === 'active' && a.start <= night && a.end > night);

describe('realistic July fixtures (T28)', () => {
  it('is about 88% occupied, as a mix of seasonal and transient boats', () => {
    const pct = (heldTonight.length / fx.slips.length) * 100;
    expect(pct).toBeGreaterThanOrEqual(86);
    expect(pct).toBeLessThanOrEqual(90);
    const seasonal = heldTonight.filter((a) => a.type === 'seasonal').length;
    const transient = heldTonight.filter((a) => a.type === 'transient').length;
    expect(seasonal).toBeGreaterThan(transient * 3);
    expect(transient).toBeGreaterThanOrEqual(15);
    expect(operatorSummary(fx, seed)).toMatchObject({ occupied: heldTonight.length, occupancyPct: 88 });
  });

  it('prices every agreement: a season fee for seasonal boats, a nightly rate for transients, each with its own provenance', () => {
    for (const a of fx.agreements) {
      expect(Number.isInteger(a.rateUsd) && a.rateUsd > 0).toBe(true);
      expect(a.rateBasis).toBe(a.type === 'seasonal' ? 'season' : 'night');
      expect(a.fieldProvenance).toMatchObject({ rateUsd: 'ASSUME', rateBasis: 'ASSUME' });
    }
    const seasonal = fx.agreements.find((a) => a.type === 'seasonal')!;
    const transient = fx.agreements.find((a) => a.type === 'transient')!;
    expect(agreementValueUsd(seasonal)).toBe(seasonal.rateUsd);
    expect(agreementNightlyUsd(seasonal)).toBeLessThan(seasonal.rateUsd / 100);
    expect(agreementNightlyUsd(transient)).toBe(transient.rateUsd);
    expect(agreementValueUsd(transient)).toBeGreaterThan(transient.rateUsd);
    expect(fx.sources.find((s) => s.id === 'SRC-RATES')?.provenance).toBe('ASSUME');
  });

  it('plans a day of check-ins and outings between 06:00 and 22:00, with away flags that follow the clock', () => {
    const todays = fx.movements.filter((m) => localDate(m.at) === night);
    expect(todays.length).toBeGreaterThan(40);
    for (const m of todays) {
      expect(m.at >= hm('06:00') && m.at <= hm('22:00')).toBe(true);
      expect(m.provenance).toBe('SIM');
    }
    const checkIns = todays.filter((m) => m.kind === 'arrival' && m.trip === 'stay');
    expect(checkIns.length).toBe(15);
    expect(todays.filter((m) => m.kind === 'departure').length).toBeGreaterThan(15);
    // Away at 08:45: boats out on the water, each flagged with the plan (Lake Effect's is unknown).
    const morning = awayBoats(fx, seed);
    expect(morning.length).toBeGreaterThanOrEqual(10);
    expect(morning.find((b) => b.vesselId === 'V-021')?.expectedReturnAt).toBeNull();
    expect(morning.filter((b) => b.expectedReturnAt).length).toBeGreaterThanOrEqual(8);
    // By 21:00 most day boats are back; overnight boats are still out and say so.
    const evening = awayBoats(fx, { ...seed, clock: hm('21:00') });
    expect(evening.length).toBeLessThan(morning.length);
    expect(evening.some((b) => b.vesselId === 'V-021')).toBe(true);
    expect(operatorSummary(fx, seed).away).toBe(morning.length);
  });

  it('has exactly one offline camera, covering only part of Dock C', () => {
    expect(fx.sourceStatus.filter((e) => e.status === 'offline').map((e) => e.sourceId)).toEqual(['C-04']);
    expect(offlineCameras(fx, seed)).toEqual(['C-04']);
    expect(operatorSummary(fx, seed).offlineCameras).toBe(1);
    const covered = new Set(fx.observations.filter((o) => o.sourceId === 'C-04').map((o) => o.slipId));
    expect([...covered].every((id) => id.startsWith('C-'))).toBe(true);
    expect(covered.size).toBe(9);
    // Every other slip is read by a camera that stays online.
    expect(slipPresence(fx, seed, 'E-03').cameraStatus).toBe('online');
    expect(slipPresence(fx, seed, 'C-12').cameraStatus).toBe('online');
    expect(slipPresence(fx, seed, 'C-05').cameraStatus).toBe('offline');
  });

  it('keeps the scenario neighbourhood: B-12, B-14, B-10 held, B-11 and B-13 held, A-02 and B-30 vacant', () => {
    const held = new Set(heldTonight.map((a) => a.slipId));
    for (const id of ['B-10', 'B-11', 'B-12', 'B-13', 'B-14']) expect(held.has(id)).toBe(true);
    for (const id of ['A-02', 'B-30', 'C-05']) expect(held.has(id)).toBe(false);
  });

  it('derives revenue at risk from the session, not from a constant', () => {
    expect(operatorSummary(fx, seed).revenueAtRiskUsd).toBe(0);
    const lakeEffect = fx.agreements.find((a) => a.slipId === 'B-12')!;
    expect(operatorSummary(fx, buildSnapshot(fx, 'uncertain')).revenueAtRiskUsd).toBe(agreementValueUsd(lakeEffect));
    expect(operatorSummary(fx, buildSnapshot(fx, 'resolved')).revenueAtRiskUsd).toBe(0);
    expect(operatorSummary(fx, seed).nightlyRevenueUsd).toBeGreaterThan(1000);
  });
});
