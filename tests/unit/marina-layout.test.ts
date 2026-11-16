/**
 * Batch 6 (T14): the full assumed layout, docks A–E, over the real fixtures. Geometry rules for every dock,
 * and the rule that only an observation puts a boat in a berth.
 */
import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { MODELLED_DOCKS, SITE, slipGeom, type EN } from '../../src/data/site.ts';
import { seedSession } from '../../src/domain/session.ts';
import { buildSnapshot, CHECKPOINT_ORDER } from '../../src/domain/replay.ts';
import { activeAgreementForSlip, datasetSummary, slipPresence, vesselLocation } from '../../src/domain/selectors.ts';
import { slipRows } from '../../src/features/registry/model.ts';
import { NO_FILTERS } from '../../src/features/registry/model.ts';
import { convexOverlapArea, pointInPolygon } from '../../src/scene/geometry2d.ts';
import { hullForSlip } from '../../src/scene/hulls.ts';
import { FINGER_WIDTH_M, placeBoat, placementFootprint, slipAxes } from '../../src/scene/layout.ts';
import { DOCK_IDS, DOCK_PLANS, WEST_BANK, closestOnRing } from '../../src/scene/marina.ts';

const fx = loadFixtures().bundle;
const pt = ([e, n]: readonly number[]) => ({ east: e!, north: n! });
const ring = (r: readonly EN[]) => r.map(pt);
const LAND = SITE.land.map((l) => ring(l.ring));
const onLand = (p: readonly number[]) => LAND.some((l) => pointInPolygon(pt(p), l));
const sessions = [seedSession(fx), ...CHECKPOINT_ORDER.map((c) => buildSnapshot(fx, c))];

describe('every assumed dock is laid out (T14)', () => {
  it('models all five docks and all 126 supplied slips exactly once, with their canonical IDs', () => {
    expect(DOCK_IDS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect([...MODELLED_DOCKS].sort()).toEqual(DOCK_IDS);
    const ids = DOCK_PLANS.flatMap((d) => d.slips.map((s) => s.id));
    expect(ids).toHaveLength(126);
    expect(new Set(ids).size).toBe(126);
    expect(ids.slice().sort()).toEqual(fx.slips.map((s) => s.id).sort());
    expect(Object.fromEntries(DOCK_PLANS.map((d) => [d.dock, d.slips.length]))).toEqual({ A: 39, B: 37, C: 18, D: 22, E: 10 });
    // Every supplied slip is still ASSUME; nothing here promotes it.
    for (const s of fx.slips) expect(s.provenance, s.id).toBe('ASSUME');
  });

  it('fixed docks are quays and floating docks have a gangway that starts on land and ends on the dock', () => {
    for (const d of DOCK_PLANS) {
      expect(d.kind).toBe(SITE.headwalks[d.dock]!.kind);
      if (d.kind === 'fixed') {
        expect(d.gangway, d.dock).toBeNull();
        continue;
      }
      const g = d.gangway!;
      expect(pointInPolygon(pt(g.head), ring(WEST_BANK)), `${d.dock} gangway head on land`).toBe(true);
      expect(onLand(g.foot), `${d.dock} gangway foot off the bank`).toBe(false);
      expect(Math.hypot(g.head[0] - g.foot[0], g.head[1] - g.foot[1])).toBeLessThan(14);
      expect(closestOnRing(g.foot, SITE.headwalks[d.dock]!.line, true).distance, `${d.dock} gangway reaches the headwalk`).toBeLessThan(1.2);
    }
  });

  it('headwalk decks never cover berth water; fingers, piles and berths are in the water', () => {
    for (const d of DOCK_PLANS) {
      for (const s of d.slips) {
        const { out } = slipAxes(s);
        const deep = [s.inner[0] + out[0] * 0.8, s.inner[1] + out[1] * 0.8];
        expect(d.deck.some((q) => pointInPolygon(pt(deep), q.map(pt))), `${s.id} berth under a deck`).toBe(false);
        expect(onLand(s.centroid), `${s.id} berth on land`).toBe(false);
        expect(onLand(s.outer), `${s.id} berth mouth on land`).toBe(false);
      }
      expect(d.fingers.length).toBeGreaterThanOrEqual(d.slips.length + 1);
      for (const f of d.fingers) expect(onLand(f.tip), `${d.dock} finger tip on land`).toBe(false);
      for (const p of d.piles.slice(0, d.fingers.length)) expect(onLand(p), `${d.dock} pile on land`).toBe(false);
    }
  });

  it('a quay apron reaches the bank it is built against', () => {
    for (const d of DOCK_PLANS.filter((x) => x.kind === 'fixed')) expect(d.deck.some((q) => q.some((p) => pointInPolygon(pt(p), ring(WEST_BANK)))), `${d.dock} apron meets the bank`).toBe(true);
  });
});

describe('boats are drawn only where an observation supports presence (T14)', () => {
  it('every drawn hull has a last report of “present”; an agreement alone never draws one', () => {
    for (const s of sessions)
      for (const slip of fx.slips) {
        const hull = hullForSlip(fx, s, slip.id);
        const last = slipPresence(fx, s, slip.id).lastReported?.presence;
        expect(Boolean(hull), `${slip.id}`).toBe(last === 'present');
      }
    const seed = sessions[0]!;
    const assignedNotPresent = fx.slips.filter((x) => activeAgreementForSlip(fx, x.id) && slipPresence(fx, seed, x.id).lastReported?.presence !== 'present');
    expect(assignedNotPresent.length).toBeGreaterThan(0);
    for (const x of assignedNotPresent) expect(hullForSlip(fx, seed, x.id), x.id).toBeNull();
  });

  it('a vessel last confirmed away is drawn nowhere, and no vessel is drawn twice', () => {
    for (const s of sessions) {
      const keys = fx.slips.map((x) => hullForSlip(fx, s, x.id)?.key).filter((k): k is string => Boolean(k));
      expect(new Set(keys).size).toBe(keys.length);
      for (const v of fx.vessels) if (vesselLocation(fx, s, v.id).kind === 'departed') expect(keys, v.id).not.toContain(`vessel:${v.id}`);
    }
  });

  it('every hull fits inside its own berth, clear of the fingers, off the land, and overlaps no other hull', () => {
    for (const s of sessions) {
      const placed = fx.slips.flatMap((x) => {
        const h = hullForSlip(fx, s, x.id);
        return h ? [{ id: x.id, g: slipGeom(x.id)!, p: placeBoat(slipGeom(x.id)!, h.lengthFt, h.beamFt) }] : [];
      });
      expect(placed.length).toBeGreaterThan(30);
      for (const b of placed) {
        const fp = placementFootprint(b.p);
        const berth = b.g.corners.map(pt);
        const c = b.g.centroid;
        for (const [e, n] of fp) {
          expect(pointInPolygon({ east: e - (e - c[0]) * 0.03, north: n - (n - c[1]) * 0.03 }, berth), `${b.id} hull outside berth`).toBe(true);
          expect(onLand([e, n]), `${b.id} hull on land`).toBe(false);
        }
        // Berth width minus beam leaves room for half a finger on each side.
        const width = Math.min(Math.hypot(b.g.corners[1]![0] - b.g.corners[0]![0], b.g.corners[1]![1] - b.g.corners[0]![1]), Math.hypot(b.g.corners[2]![0] - b.g.corners[1]![0], b.g.corners[2]![1] - b.g.corners[1]![1]));
        expect(width - b.p.beamM, `${b.id} beam clearance`).toBeGreaterThanOrEqual(FINGER_WIDTH_M * 0.5);
      }
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;
          if (Math.hypot(a.p.center[0] - b.p.center[0], a.p.center[1] - b.p.center[1]) > 20) continue;
          expect(convexOverlapArea(placementFootprint(a.p).map(pt), placementFootprint(b.p).map(pt)), `${a.id} overlaps ${b.id}`).toBeLessThan(0.01);
        }
    }
  });
});

describe('counters and the list derive from the fixtures (T14)', () => {
  it('126 slips and 113 vessels come from the data, and every slip is a list row', () => {
    const seed = sessions[0]!;
    const summary = datasetSummary(fx, seed);
    expect(summary.slips).toBe(fx.slips.length);
    expect(summary.vessels).toBe(fx.vessels.length);
    expect(summary).toMatchObject({ slips: 126, vessels: 113, needsReview: 0 });
    const rows = slipRows(fx, seed, '', NO_FILTERS);
    expect(rows.map((r) => r.id).sort()).toEqual(fx.slips.map((s) => s.id).sort());
    for (const dock of DOCK_IDS) expect(slipRows(fx, seed, '', { dock: dock as 'A', needsReview: false }).length).toBe(DOCK_PLANS.find((d) => d.dock === dock)!.slips.length);
  });

  it('empty and unknown berths stay distinct states', () => {
    const seed = sessions[0]!;
    const states = new Set(fx.slips.map((s) => slipPresence(fx, seed, s.id).current));
    expect(states.has('empty')).toBe(true);
    expect(states.has('unknown')).toBe(true);
    const rows = slipRows(fx, seed, '', NO_FILTERS);
    const labels = new Set(rows.map((r) => r.presence.label));
    expect(labels.has('Empty')).toBe(true);
    expect([...labels].some((l) => l === 'Presence unknown' || l === 'Camera offline')).toBe(true);
  });
});
