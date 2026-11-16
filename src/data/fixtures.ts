/** Vite entry for the bundled fixtures. Seed fixtures are immutable; session changes live in the store. */
import slipsRaw from '../../data/slips.geojson?raw';
import sources from '../../data/fixtures/sources.json';
import actors from '../../data/fixtures/actors.json';
import vessels from '../../data/fixtures/vessels.json';
import agreements from '../../data/fixtures/agreements.json';
import documents from '../../data/fixtures/documents.json';
import observations from '../../data/fixtures/observations.json';
import movements from '../../data/fixtures/movements.json';
import verifications from '../../data/fixtures/verifications.json';
import sourceStatus from '../../data/fixtures/sourceStatus.json';
import stagedEvidence from '../../data/fixtures/stagedEvidence.json';
import evidenceAssets from '../../data/fixtures/evidenceAssets.json';
import slipServices from '../../data/fixtures/slipServices.json';
import transientRequests from '../../data/fixtures/transientRequests.json';
import lakeScenarios from '../../data/fixtures/lakeScenarios.json';
import scenario from '../../data/fixtures/scenario.json';
import { loadFromRaw, type FixtureFile, type LoadResult, type RawFixtures } from './assemble.ts';
import { hasFault } from '../app/faults.ts';

let cached: LoadResult | null = null;

export function rawFixtures(): RawFixtures {
  const f = (x: unknown) => x as FixtureFile<unknown>;
  return {
    slipsGeoJson: JSON.parse(slipsRaw) as unknown,
    files: {
      sources: f(sources), actors: f(actors), vessels: f(vessels), agreements: f(agreements), documents: f(documents),
      observations: f(observations), movements: f(movements), verifications: f(verifications), sourceStatus: f(sourceStatus),
      stagedEvidence: f(stagedEvidence), evidenceAssets: f(evidenceAssets), slipServices: f(slipServices), transientRequests: f(transientRequests),
      lakeScenarios: f(lakeScenarios),
    },
    scenario: scenario as unknown as RawFixtures['scenario'],
  };
}

type Rec = Record<string, unknown>;
const patchRecords = (file: FixtureFile<unknown>, id: string, patch: (r: Rec) => Rec): FixtureFile<unknown> => ({
  ...file,
  records: (file.records as Rec[]).map((r) => (r.id === id ? patch({ ...r }) : r)),
});

/**
 * Dev/test fault injection (`?debug&fault=…`, src/app/faults.ts): damage a copy of the raw input exactly where
 * a bad data file would, so the real validation and quarantine path handles it. Seed files are never touched.
 */
function withFaults(raw: RawFixtures): RawFixtures {
  let files = raw.files;
  const drop = (r: Rec) => {
    delete r.provenance;
    return r;
  };
  if (hasFault('record-provenance')) files = { ...files, vessels: patchRecords(files.vessels, 'V-030', drop) };
  if (hasFault('scenario-provenance')) files = { ...files, vessels: patchRecords(files.vessels, 'V-021', drop) };
  if (hasFault('record-reference')) {
    const ag = (files.agreements.records as Rec[]).find((a) => a.vesselId === 'V-031');
    if (ag) files = { ...files, agreements: patchRecords(files.agreements, String(ag.id), (r) => ({ ...r, vesselId: 'V-999' })) };
  }
  if (hasFault('evidence')) {
    files = { ...files, evidenceAssets: { ...files.evidenceAssets, records: (files.evidenceAssets.records as Rec[]).map((r) => ({ ...r, path: `assets/evidence/missing-${String(r.id)}.webp` })) } };
  }
  return files === raw.files ? raw : { ...raw, files };
}

export function loadFixtures(): LoadResult {
  cached ??= loadFromRaw(withFaults(rawFixtures()));
  return cached;
}
