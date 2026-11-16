import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { seedSession } from '../../src/domain/session.ts';
import { operatorSummary } from '../../src/domain/selectors.ts';
import { localDate } from '../../src/domain/time.ts';

const fx = loadFixtures().bundle;

describe('operator KPIs (T25, PRD F18)', () => {
  it('derives occupancy from agreements covering the scenario night, never from presence', () => {
    const k = operatorSummary(fx, seedSession(fx));
    const night = fx.scenario.date;
    const held = new Set(fx.agreements.filter((a) => a.status === 'active' && a.start <= night && a.end > night).map((a) => a.slipId));
    expect(k.slips).toBe(fx.slips.length);
    expect(k.occupied).toBe(held.size);
    expect(k.occupancyPct).toBe(Math.round((held.size / fx.slips.length) * 100));
    // B-12 is empty at 08:45 but held by Lake Effect's agreement: it counts as occupied tonight.
    expect(held.has('B-12')).toBe(true);
  });

  it('counts arrivals on the scenario day in Buffalo time, whatever the clock', () => {
    const k = operatorSummary(fx, seedSession(fx));
    // Check-ins only: a seasonal boat back from an outing is not an arrival (T28).
    expect(k.arrivals).toBe(fx.movements.filter((m) => m.kind === 'arrival' && m.trip === 'stay' && localDate(m.at) === fx.scenario.date).length);
    expect(fx.movements.filter((m) => m.kind === 'arrival' && m.trip === 'outing').length).toBeGreaterThan(0);
    expect(localDate('2026-07-16T03:30:00Z')).toBe('2026-07-15'); // 23:30 EDT is still the 15th
  });

  it('needs review follows the session, not the fixtures', () => {
    expect(operatorSummary(fx, seedSession(fx)).needsAttention).toBe(0);
    expect(operatorSummary(fx, buildSnapshot(fx, 'uncertain')).needsAttention).toBe(1);
    expect(operatorSummary(fx, buildSnapshot(fx, 'resolved')).needsAttention).toBe(0);
  });
});
