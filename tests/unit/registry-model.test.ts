import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { apply, type Command } from '../../src/domain/engine.ts';
import { seedSession, type DemoSession } from '../../src/domain/session.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { vesselLocation } from '../../src/domain/selectors.ts';
import {
  frameTarget,
  markerLabel,
  NO_FILTERS,
  parseQuery,
  slipInspector,
  slipRows,
  slipStateLabel,
  vesselInspector,
  vesselRows,
} from '../../src/features/registry/model.ts';
import { hullForSlip } from '../../src/scene/hulls.ts';

const fx = loadFixtures().bundle;
const B = new Set(['B']);
const seed = seedSession(fx);
const uncertain = buildSnapshot(fx, 'uncertain');
const pending = buildSnapshot(fx, 'pending_check');
const resolved = buildSnapshot(fx, 'resolved');
const sel = (s: DemoSession, kind: 'slip' | 'vessel', id: string) => {
  const r = apply(fx, s, { type: 'select', selection: { kind, id } } as Command);
  return r.session;
};

describe('search (F04)', () => {
  it('normalises slip and vessel IDs in any spacing, case or padding', () => {
    for (const q of ['B12', 'b12', 'b 12', 'B-12', 'b-012', ' B12 ']) expect(parseQuery(q).slipId).toBe('B-12');
    expect(parseQuery('a1').slipId).toBe('A-01');
    for (const q of ['V21', 'v-021', 'v 21']) expect(parseQuery(q).vesselId).toBe('V-021');
    expect(parseQuery('Lake').slipId).toBeNull();
  });

  it('B12 puts B-12 first; a partial ID lists its prefix matches', () => {
    expect(slipRows(fx, seed, 'B12', NO_FILTERS)[0]!.id).toBe('B-12');
    const b1 = slipRows(fx, seed, 'b1', NO_FILTERS).map((r) => r.id);
    expect(b1[0]).toBe('B-01');
    expect(b1).toEqual(expect.arrayContaining(['B-10', 'B-12', 'B-14', 'B-19']));
    expect(b1).not.toContain('B-20');
  });

  it('finds vessels by name and by ID, and slips by their assigned vessel', () => {
    expect(vesselRows(fx, seed, 'lake effect', NO_FILTERS).map((r) => r.id)).toEqual(['V-021']);
    expect(vesselRows(fx, seed, 'V22', NO_FILTERS)[0]!.name).toBe('Harbor Light');
    expect(slipRows(fx, seed, 'river run', NO_FILTERS).map((r) => r.id)).toEqual(['B-10']);
  });

  it('never matches a slip through an observation candidate (inv. 10)', () => {
    for (const s of [uncertain, pending]) {
      expect(slipRows(fx, s, 'Harbor Light', NO_FILTERS).map((r) => r.id)).toEqual(['B-14']);
      expect(slipRows(fx, s, 'V-022', NO_FILTERS).map((r) => r.id)).toEqual(['B-14']);
    }
  });

  it('filters by dock and by needs review, with an honest empty result', () => {
    expect(slipRows(fx, seed, '', { dock: 'B', needsReview: false })).toHaveLength(37);
    expect(slipRows(fx, seed, '', { dock: 'all', needsReview: true })).toEqual([]);
    expect(slipRows(fx, uncertain, '', { dock: 'all', needsReview: true }).map((r) => r.id)).toEqual(['B-12']);
    expect(slipRows(fx, resolved, '', { dock: 'all', needsReview: true })).toEqual([]);
    expect(vesselRows(fx, seed, '', { dock: 'E', needsReview: false }).every((r) => r.slipId?.startsWith('E-'))).toBe(true);
    expect(slipRows(fx, seed, 'zz-99', NO_FILTERS)).toEqual([]);
  });
});

describe('slip inspector (F05, F06)', () => {
  it('normal: B-12 empty but assigned to Lake Effect, and not bookable', () => {
    const m = slipInspector(fx, seed, 'B-12', B)!;
    expect(m.assignment.vessel).toMatchObject({ id: 'V-021', name: 'Lake Effect', summary: '29\u00a0ft cabin cruiser' });
    expect(m.observation.headline).toBe('No vessel present');
    expect(m.summary).toEqual([
      { label: 'Presence', value: 'Empty' },
      { label: 'Agreement', value: 'Assigned' },
      { label: 'Bookable', value: 'No' },
    ]);
    expect(m.observation.facts.find((f) => f.label === 'Source')?.value).toBe('Camera C-02 · 08:45');
    expect(m.modelledIn3D).toBe(true);
  });

  it('uncertain: present, identity unverified, Harbor Light only as a possible match with the reason', () => {
    const m = slipInspector(fx, uncertain, 'B-12', B)!;
    expect(m.observation.badge.label).toBe('Present');
    expect(m.observation.headline).toBe('Identity unverified');
    expect(m.observation.possibleMatch).toEqual({ id: 'V-022', name: 'Harbor Light' });
    expect(m.observation.reason).toMatch(/Name obscured/);
    expect(m.review).toEqual({ label: 'Needs review', tone: 'review' });
    expect(m.summary.find((f) => f.label === 'Bookable')?.value).toBe('No');
    expect(JSON.stringify(m)).not.toMatch(/wrong boat|mismatch confirmed/i);
  });

  it('resolved: Lake Effect confirmed by decision; agreement unchanged', () => {
    const m = slipInspector(fx, resolved, 'B-12', B)!;
    expect(m.observation.headline).toBe('Lake Effect · identity confirmed');
    expect(m.observation.possibleMatch).toBeNull();
    expect(m.assignment.facts[0]!.value).toBe('Seasonal');
  });

  it('unassigned slips are “not assessed”, never “available”', () => {
    const m = slipInspector(fx, seed, 'B-30', B)!;
    expect(m.summary.find((f) => f.label === 'Bookable')?.value).toBe('Not assessed');
    expect(JSON.stringify(m)).not.toMatch(/available/i);
  });

  it('camera offline is reported as unknown, never as empty', () => {
    const m = slipInspector(fx, seed, 'C-02', B)!;
    expect(m.observation.badge.label).toBe('Camera offline');
    expect(m.observation.facts.some((f) => f.label === 'Camera' && /^C-\d+ offline$/.test(f.value))).toBe(true);
    expect(m.summary.find((f) => f.label === 'Presence')?.value).toBe('Unknown');
    expect(m.modelledIn3D).toBe(false);
  });
});

describe('markers and hover labels never name an unverified hull (inv. 10)', () => {
  it('B-12 labels across stages', () => {
    expect(markerLabel(fx, seed, 'B-12')).toBe('B-12 · Empty · assigned');
    for (const s of [uncertain, pending]) {
      const label = markerLabel(fx, s, 'B-12');
      expect(label).toBe('B-12 · Vessel present · identity unverified');
      for (const v of fx.vessels) expect(label).not.toContain(v.name);
    }
    expect(markerLabel(fx, resolved, 'B-12')).toBe('B-12 · Lake Effect');
    expect(slipStateLabel(fx, seed, 'B-10')).toBe('River Run');
  });
});

describe('vessel inspector and selection framing', () => {
  it('registration and HIN are separate fields; unknowns say “Not recorded”', () => {
    const rr = vesselInspector(fx, seed, 'V-023')!;
    expect(rr.identifiers).toEqual([
      { label: 'Registration', value: 'ending 05 RT', provenance: 'SIM' },
      { label: 'Documentation', value: 'Not recorded', provenance: 'SIM' },
      { label: 'HIN', value: 'HIN ••••••••B626', provenance: 'SIM' },
    ]);
    const le = vesselInspector(fx, seed, 'V-021')!;
    expect(le.identifiers.find((f) => f.label === 'HIN')?.value).toBe('Not recorded');
    expect(le.documents.every((d) => d.value.startsWith('Reviewed (demo)'))).toBe(true);
  });

  it('Harbor Light stays assigned to B-14 and “last confirmed away” at every stage', () => {
    for (const s of [seed, uncertain, pending, resolved]) {
      const m = vesselInspector(fx, s, 'V-022')!;
      expect(m.assignedSlipId).toBe('B-14');
      expect(m.location.label).toBe('Away · departed 08:30');
      expect(m.locationNote).toBe('Source: staff log');
      expect(vesselLocation(fx, s, 'V-022')).toMatchObject({ kind: 'departed', slipId: 'B-14' });
    }
  });

  it('an away vessel frames its assigned berth, which stays empty in the scene', () => {
    const s = sel(uncertain, 'vessel', 'V-022');
    expect(frameTarget(fx, s)).toEqual({ slipId: 'B-14', via: 'away-vessel' });
    expect(hullForSlip(fx, s, 'B-14')).toBeNull();
    expect(markerLabel(fx, s, 'B-14', 'away-vessel')).toBe('B-14 · Assigned berth · last confirmed away');
    expect(frameTarget(fx, sel(seed, 'vessel', 'V-047'))).toBeNull(); // no agreement → nothing to frame
  });

  it('selecting the unidentified hull selects the slip, not a vessel', () => {
    expect(frameTarget(fx, sel(uncertain, 'slip', 'B-12'))).toEqual({ slipId: 'B-12', via: 'slip' });
  });
});

describe('placeholder hulls (scene presence rules)', () => {
  it('no hull at B-12 when empty; a generic observed hull when present; the same hull after resolution', () => {
    expect(hullForSlip(fx, seed, 'B-12')).toBeNull();
    const a = hullForSlip(fx, uncertain, 'B-12')!;
    const b = hullForSlip(fx, resolved, 'B-12')!;
    expect(a).toMatchObject({ observed: true, family: 'cruiser', canvas: 'sand' });
    expect(b).toEqual(a); // relabelled, not moved or reshaped
  });

  it('confirmed vessels use their own dimensions; away vessels and empty slips get none', () => {
    expect(hullForSlip(fx, seed, 'B-10')).toMatchObject({ key: 'vessel:V-023', family: 'console', lengthFt: 24, observed: false });
    expect(hullForSlip(fx, seed, 'B-14')).toBeNull();
    expect(hullForSlip(fx, seed, 'B-30')).toBeNull();
    const drawn = fx.slips.filter((s) => s.dock === 'B' && hullForSlip(fx, seed, s.id)).length;
    expect(drawn).toBeGreaterThan(10);
  });

  it('stale reports stay drawn but faded (C-04 docks)', () => {
    expect(hullForSlip(fx, seed, 'C-02')).toMatchObject({ stale: true });
  });
});
