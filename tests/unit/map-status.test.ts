import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { seedSession } from '../../src/domain/session.ts';
import { MAP_STATUSES, MAP_STATUS_LABEL, mapSlipStatus, mapStatusCounts, mapStatuses, operatorSummary } from '../../src/domain/selectors.ts';
import { toMs } from '../../src/domain/time.ts';

const fx = loadFixtures().bundle;
const seed = seedSession(fx);
const night = fx.scenario.date;
const heldTonight = fx.agreements.filter((a) => a.status === 'active' && a.start <= night && a.end > night);
const at = (clock: string) => ({ ...seed, clock });

describe('dock map statuses (T29, PRD F19)', () => {
  it('gives every slip exactly one status, and the counts add up to the 126 slips', () => {
    const st = mapStatuses(fx, seed);
    expect(st.size).toBe(fx.slips.length);
    const counts = mapStatusCounts(fx, seed);
    expect(MAP_STATUSES.reduce((n, k) => n + counts[k], 0)).toBe(126);
    // Every status shows up on the July morning, so the legend is never decorative.
    for (const k of MAP_STATUSES.filter((x) => x !== 'review')) expect(counts[k], k).toBeGreaterThan(0);
  });

  it('vacant means “no agreement tonight”: never inferred from an empty berth or an offline camera', () => {
    const counts = mapStatusCounts(fx, seed);
    expect(counts.vacant).toBe(fx.slips.length - heldTonight.length);
    expect(fx.slips.length - counts.vacant).toBe(operatorSummary(fx, seed).occupied);
    // B-12 is empty at 08:45 but held: it is away, not vacant (inv. 2).
    expect(mapSlipStatus(fx, seed, 'B-12')).toBe('away');
    // A-02, B-30 and C-05 are the pinned vacant slips (T28).
    for (const id of ['A-02', 'B-30', 'C-05']) expect(mapSlipStatus(fx, seed, id)).toBe('vacant');
    // Slips under the offline camera keep their agreement-based status.
    const dark = fx.slips.filter((s) => s.id.startsWith('C-0')).map((s) => s.id);
    for (const id of dark) expect(mapSlipStatus(fx, seed, id) === 'vacant').toBe(!heldTonight.some((a) => a.slipId === id));
  });

  it('follows the B-12 story: away → needs review → occupied once Lake Effect is confirmed', () => {
    expect(mapSlipStatus(fx, buildSnapshot(fx, 'normal'), 'B-12')).toBe('away');
    expect(mapSlipStatus(fx, buildSnapshot(fx, 'uncertain'), 'B-12')).toBe('review');
    expect(mapSlipStatus(fx, buildSnapshot(fx, 'pending_check'), 'B-12')).toBe('review');
    expect(mapSlipStatus(fx, buildSnapshot(fx, 'resolved'), 'B-12')).toBe('occupied');
    // Harbor Light (B-14) left at 08:30 and a possible match never brings it back (inv. 3, 4).
    for (const stage of ['uncertain', 'resolved'] as const) expect(mapSlipStatus(fx, buildSnapshot(fx, stage), 'B-14')).toBe('away');
    expect(mapStatusCounts(fx, buildSnapshot(fx, 'uncertain')).review).toBe(1);
  });

  it('reserved = a transient booked from tonight that has not checked in; it turns occupied at check-in, never earlier', () => {
    const arrivals = fx.movements.filter((m) => m.kind === 'arrival' && m.trip === 'stay' && heldTonight.some((a) => a.type === 'transient' && a.start === night && a.vesselId === m.vesselId));
    const later = arrivals.filter((m) => toMs(m.at) > toMs(seed.clock));
    expect(later.length).toBeGreaterThan(5);
    for (const m of later) {
      expect(mapSlipStatus(fx, seed, m.slipId), m.slipId).toBe('reserved');
      expect(mapSlipStatus(fx, at(new Date(toMs(m.at) - 60_000).toISOString()), m.slipId)).toBe('reserved');
      expect(mapSlipStatus(fx, at(m.at), m.slipId)).toBe('occupied');
    }
    expect(mapStatusCounts(fx, seed).reserved).toBe(later.length);
  });

  it('away follows the staff log at the clock: out at departure, back at the logged return', () => {
    const outing = fx.movements.find((m) => m.kind === 'departure' && m.trip === 'outing' && toMs(m.at) > toMs(seed.clock) && fx.movements.some((r) => r.vesselId === m.vesselId && r.kind === 'arrival' && toMs(r.at) > toMs(m.at)))!;
    const back = fx.movements.find((r) => r.vesselId === outing.vesselId && r.kind === 'arrival' && toMs(r.at) > toMs(outing.at))!;
    expect(mapSlipStatus(fx, seed, outing.slipId)).toBe('occupied');
    expect(mapSlipStatus(fx, at(outing.at), outing.slipId)).toBe('away');
    expect(mapSlipStatus(fx, at(back.at), outing.slipId)).toBe('occupied');
  });

  it('labels name a status, never a vessel', () => {
    const names = new Set(fx.vessels.map((v) => v.name));
    for (const l of Object.values(MAP_STATUS_LABEL)) expect(names.has(l)).toBe(false);
  });
});
