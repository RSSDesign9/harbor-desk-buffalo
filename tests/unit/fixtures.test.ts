import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateFixtures } from '../../src/data/generate.ts';
import { parseSlipsGeoJson } from '../../src/data/slips.ts';
import { FIXTURE_FILES, loadFromRaw, type RawFixtures } from '../../src/data/assemble.ts';
import { loadFixtures, rawFixtures } from '../../src/data/fixtures.ts';
import { validateBundle } from '../../src/domain/validate.ts';
import type { FixtureBundle } from '../../src/domain/types.ts';

const geo = JSON.parse(readFileSync(new URL('../../data/slips.geojson', import.meta.url), 'utf8')) as { features: { properties: { id: string } }[] };

/** A deep, mutable copy of the raw fixture files for tampering tests. */
function rawCopy(): RawFixtures {
  return JSON.parse(JSON.stringify(rawFixtures())) as RawFixtures;
}
const recordsOf = (raw: RawFixtures, k: keyof RawFixtures['files']) => raw.files[k].records as Record<string, unknown>[];

describe('fixture bundle (T05)', () => {
  const loaded = loadFixtures();
  const fx = loaded.bundle;

  it('loads cleanly with no validation issues', () => {
    expect(loaded.issues).toEqual([]);
    expect(loaded.status).toBe('ok');
  });

  it('keeps all 126 supplied slip IDs in their original order, without renumbering', () => {
    expect(fx.slips.map((s) => s.id)).toEqual(geo.features.map((f) => f.properties.id));
    const perDock = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((d) => [d, fx.slips.filter((s) => s.dock === d).length]));
    expect(perDock).toEqual({ A: 39, B: 37, C: 18, D: 22, E: 10 });
  });

  it('is reproducible: regenerating from the seed yields the committed files exactly', () => {
    const regenerated = generateFixtures(parseSlipsGeoJson(geo).slips);
    for (const k of FIXTURE_FILES) expect(JSON.parse(JSON.stringify(regenerated[k]))).toEqual(rawFixtures().files[k].records);
    expect(regenerated.scenario).toEqual(fx.scenario);
  });

  it('contains the canonical PRD §7 records, reconciled from DESIGN’s illustrative card', () => {
    const v = (id: string) => fx.vessels.find((x) => x.id === id)!;
    expect(v('V-021')).toMatchObject({ name: 'Lake Effect', loa_ft: 29, type: 'cabin-cruiser', registrationSuffix: '42 AB' });
    expect(v('V-022')).toMatchObject({ name: 'Harbor Light', loa_ft: 27, type: 'cabin-cruiser' });
    expect(v('V-023')).toMatchObject({ name: 'River Run', loa_ft: 24, type: 'center-console' });
    const slipOf = (id: string) => fx.agreements.find((a) => a.vesselId === id && a.status === 'active')?.slipId;
    expect([slipOf('V-021'), slipOf('V-022'), slipOf('V-023')]).toEqual(['B-12', 'B-14', 'B-10']);
    // DESIGN §12’s 32 ft / B-14 / hull NY-4471-RB card is not a fixture.
    expect(JSON.stringify(fx)).not.toMatch(/NY-4471|Sea Ray|Sundancer/);
    expect(fx.scenario.date).toBe('2026-07-15');
    expect(fx.actors.find((a) => a.id === fx.scenario.demoActorId)?.label).toBe('Demo dockmaster');
  });

  it('has 113 SIM vessels with generation timestamps, plausible units and fictional owners', () => {
    expect(fx.vessels).toHaveLength(113);
    for (const v of fx.vessels) {
      expect(v.provenance).toBe('SIM');
      expect(v.generated_at).toBe(fx.generated_at);
      expect(v.loa_ft).toBeGreaterThan(15);
      if (v.beam_ft !== null) expect(v.beam_ft).toBeLessThan(v.loa_ft / 2);
      expect(v.owner.label).toMatch(/^(Private owner|Fictional organization) O-\d{3}$/);
    }
  });

  it('never has two active agreements for one slip or one vessel, and every LOA fits its assumed length class', () => {
    const active = fx.agreements.filter((a) => a.status === 'active');
    expect(new Set(active.map((a) => a.slipId)).size).toBe(active.length);
    expect(new Set(active.map((a) => a.vesselId)).size).toBe(active.length);
    for (const a of active) {
      const slip = fx.slips.find((s) => s.id === a.slipId)!;
      expect(fx.vessels.find((v) => v.id === a.vesselId)!.loa_ft).toBeLessThanOrEqual(slip.length_ft);
    }
  });

  it('supplies mixed observed states, with no future evidence about B-12 decided in the seed', () => {
    const presences = new Set(fx.observations.map((o) => o.presence));
    expect(presences).toEqual(new Set(['present', 'empty', 'unknown']));
    expect(fx.verifications.some((v) => v.slipId === 'B-12')).toBe(true); // 07:30 dock walk, before departure
    expect(fx.verifications.filter((v) => v.slipId === 'B-12').every((v) => v.checkedAt < fx.scenario.checkpoints.normal)).toBe(true);
    // Observation IDs are opaque.
    for (const o of fx.observations) expect(o.id).toMatch(/^OBS-[A-Z2-9]{6}$/);
  });

  it('carries valid provenance on every record and a plain source manifest', () => {
    for (const k of FIXTURE_FILES) for (const r of fx[k] as readonly { provenance: string }[]) expect(['DOC', 'ASSUME', 'SIM', 'FIELD']).toContain(r.provenance);
    expect(fx.sources.filter((s) => s.provenance === 'DOC').every((s) => s.url || s.path)).toBe(true);
  });

  it('is deeply frozen so no code path can edit a seed observation', () => {
    const obs = fx.observations.find((o) => o.id === fx.scenario.uncertainObservationId)!;
    expect(() => {
      (obs as { presence: string }).presence = 'empty';
    }).toThrow(TypeError);
  });
});

describe('fixture validation failures (T05)', () => {
  it('quarantines a record with missing provenance and keeps the rest usable', () => {
    const raw = rawCopy();
    delete recordsOf(raw, 'documents')[0]!.provenance;
    const r = loadFromRaw(raw);
    expect(r.status).toBe('degraded');
    expect(r.removed).toContainEqual({ collection: 'documents', id: recordsOf(raw, 'documents')[0]!.id });
    expect(r.bundle.documents).toHaveLength(225);
    expect(r.bundle.vessels).toHaveLength(113);
  });

  it('quarantines a broken reference, then anything that depended on it', () => {
    const raw = rawCopy();
    const victim = recordsOf(raw, 'vessels').find((v) => v.id === 'V-030')!;
    victim.provenance = undefined;
    const r = loadFromRaw(raw);
    expect(r.status).toBe('degraded');
    expect(r.bundle.vessels.some((v) => v.id === 'V-030')).toBe(false);
    expect(r.bundle.agreements.some((a) => a.vesselId === 'V-030')).toBe(false);
    expect(r.bundle.documents.some((d) => d.vesselId === 'V-030')).toBe(false);
    expect(r.issues.some((i) => i.message.includes('Unknown vessel V-030'))).toBe(true);
  });

  it('rejects duplicate active assignments', () => {
    const raw = rawCopy();
    const ags = recordsOf(raw, 'agreements');
    ags.find((a) => a.vesselId === 'V-001')!.slipId = 'B-11';
    expect(validateBundle(loadFixtures().bundle).ok).toBe(true);
    const tampered = loadFromRaw(raw);
    expect(tampered.issues.some((i) => /Duplicate active agreement for slip B-11/.test(i.message))).toBe(true);
  });

  it('rejects out-of-order timestamps', () => {
    const raw = rawCopy();
    const o = recordsOf(raw, 'observations')[5]!;
    o.receivedAt = '2026-07-15T00:00:00Z';
    expect(loadFromRaw(raw).issues.some((i) => i.message.includes('receivedAt is earlier'))).toBe(true);
  });

  it('treats tampering with the canonical scenario as fatal (no false operational facts)', () => {
    const raw = rawCopy();
    recordsOf(raw, 'vessels').find((v) => v.id === 'V-021')!.loa_ft = 32;
    const r = loadFromRaw(raw);
    expect(r.status).toBe('fatal');
    expect(r.issues.some((i) => i.severity === 'fatal' && i.id === 'V-021')).toBe(true);
  });

  it('reports a missing fixture file as fatal instead of rendering a partial dataset', () => {
    const raw = rawCopy();
    (raw.files as Partial<RawFixtures['files']>).observations = undefined as never;
    expect(loadFromRaw(raw).status).toBe('fatal');
  });

  it('keeps types honest: a bundle built from the files matches FixtureBundle shape', () => {
    const b: FixtureBundle = loadFixtures().bundle;
    expect(Object.keys(b).sort()).toEqual(
      ['actors', 'agreements', 'documents', 'evidenceAssets', 'generated_at', 'lakeScenarios', 'movements', 'observations', 'scenario', 'slipServices', 'slips', 'sourceStatus', 'sources', 'stagedEvidence', 'transientRequests', 'verifications', 'vessels'].sort(),
    );
  });
});
