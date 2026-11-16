/**
 * Pure assembly of fixture files into a validated, quarantined bundle. No Vite- or Node-specific imports,
 * so the app, the scripts and the tests share it.
 */
import type { FixtureBundle, ScenarioDefinition } from '../domain/types.ts';
import { applyQuarantine, type ValidationIssue } from '../domain/validate.ts';
import { parseSlipsGeoJson } from './slips.ts';

export const FIXTURE_SCHEMA = 'harbor-desk/fixtures@1';

export type FixtureCollection = Exclude<keyof FixtureBundle, 'generated_at' | 'scenario' | 'slips'>;
export const FIXTURE_FILES: readonly FixtureCollection[] = [
  'sources', 'actors', 'vessels', 'agreements', 'documents', 'observations', 'movements', 'verifications', 'sourceStatus', 'stagedEvidence', 'evidenceAssets',
  'slipServices', 'transientRequests', 'lakeScenarios',
];

export interface FixtureFile<T> {
  schema: string;
  generated_at: string;
  generator: string;
  note: string;
  records: T[];
}

export interface RawFixtures {
  slipsGeoJson: unknown;
  files: Record<FixtureCollection, FixtureFile<unknown>>;
  scenario: { schema: string; generated_at: string; scenario: ScenarioDefinition };
}

export type LoadStatus = 'ok' | 'degraded' | 'fatal';
export interface LoadResult {
  status: LoadStatus;
  bundle: FixtureBundle;
  issues: ValidationIssue[];
  removed: { collection: string; id: string }[];
}

export function assembleBundle(raw: RawFixtures): { bundle: FixtureBundle; slipRejects: { index: number; reason: string }[] } {
  const { slips, rejects } = parseSlipsGeoJson(raw.slipsGeoJson);
  const pick = <K extends FixtureCollection>(k: K) => (raw.files[k]?.records ?? []) as unknown as FixtureBundle[K];
  const bundle: FixtureBundle = {
    generated_at: raw.scenario.generated_at,
    slips,
    sources: pick('sources'),
    actors: pick('actors'),
    vessels: pick('vessels'),
    agreements: pick('agreements'),
    documents: pick('documents'),
    observations: pick('observations'),
    movements: pick('movements'),
    verifications: pick('verifications'),
    sourceStatus: pick('sourceStatus'),
    stagedEvidence: pick('stagedEvidence'),
    evidenceAssets: pick('evidenceAssets'),
    slipServices: pick('slipServices'),
    transientRequests: pick('transientRequests'),
    lakeScenarios: pick('lakeScenarios'),
    scenario: raw.scenario.scenario,
  };
  return { bundle, slipRejects: rejects };
}

/** Deep-freeze so no code path can mutate seed records (PRD §7 inv. 5: observations are immutable). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export function loadFromRaw(raw: RawFixtures): LoadResult {
  const schemaIssues: ValidationIssue[] = [];
  for (const k of FIXTURE_FILES) {
    const f = raw.files[k];
    if (!f || f.schema !== FIXTURE_SCHEMA || !Array.isArray(f.records)) schemaIssues.push({ severity: 'fatal', collection: 'bundle', id: k, message: `Fixture file ${k} is missing or has the wrong schema` });
  }
  if (raw.scenario?.schema !== FIXTURE_SCHEMA) schemaIssues.push({ severity: 'fatal', collection: 'bundle', id: 'scenario', message: 'Scenario file is missing or has the wrong schema' });
  const { bundle, slipRejects } = assembleBundle(raw);
  for (const r of slipRejects) schemaIssues.push({ severity: 'error', collection: 'slips', id: String(r.index), message: r.reason });
  if (schemaIssues.some((i) => i.severity === 'fatal')) return { status: 'fatal', bundle: deepFreeze(bundle), issues: schemaIssues, removed: [] };

  const { bundle: clean, result, removed } = applyQuarantine(bundle);
  const issues = [...schemaIssues, ...result.issues];
  const status: LoadStatus = result.fatal ? 'fatal' : issues.some((i) => i.severity === 'error') ? 'degraded' : 'ok';
  return { status, bundle: deepFreeze(clean), issues, removed };
}
