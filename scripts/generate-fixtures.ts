/**
 * Generate (or check) the deterministic SIM fixtures in data/fixtures/.
 *   npm run fixtures            write files
 *   npm run fixtures:check      fail if files differ from a fresh generation, then validate
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFixtures, GENERATED_AT } from '../src/data/generate.ts';
import { parseSlipsGeoJson } from '../src/data/slips.ts';
import { FIXTURE_FILES, FIXTURE_SCHEMA, loadFromRaw, type RawFixtures } from '../src/data/assemble.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'fixtures');
const check = process.argv.includes('--check');

const slipsGeoJson = JSON.parse(readFileSync(join(ROOT, 'data/slips.geojson'), 'utf8')) as unknown;
const { slips, rejects } = parseSlipsGeoJson(slipsGeoJson);
if (rejects.length) throw new Error(`slips.geojson rejects: ${JSON.stringify(rejects)}`);
const bundle = generateFixtures(slips);

const NOTE = 'SIM: fictional records generated deterministically by src/data/generate.ts. Not real vessels, people, observations or operations.';
const serialize = (obj: unknown) => JSON.stringify(obj, null, 1) + '\n';
const outputs: Record<string, string> = {};
for (const k of FIXTURE_FILES) {
  const note = k === 'sources' ? 'Source manifest. Provenance is per record (DOC / ASSUME / SIM).' : NOTE;
  outputs[`${k}.json`] = serialize({ schema: FIXTURE_SCHEMA, generated_at: GENERATED_AT, generator: 'src/data/generate.ts', note, records: bundle[k] });
}
outputs['scenario.json'] = serialize({ schema: FIXTURE_SCHEMA, generated_at: GENERATED_AT, scenario: bundle.scenario });

let drift = 0;
if (check) {
  for (const [name, text] of Object.entries(outputs)) {
    const p = join(OUT, name);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== text) {
      console.error(`DRIFT ${name}: differs from a fresh deterministic generation`);
      drift++;
    }
  }
} else {
  mkdirSync(OUT, { recursive: true });
  for (const [name, text] of Object.entries(outputs)) writeFileSync(join(OUT, name), text);
}

const parsed = Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k.replace('.json', ''), JSON.parse(v)]));
const raw = { slipsGeoJson, files: Object.fromEntries(FIXTURE_FILES.map((k) => [k, parsed[k]])), scenario: parsed.scenario } as unknown as RawFixtures;
const result = loadFromRaw(raw);
const count = (s: string) => result.issues.filter((i) => i.severity === s).length;
console.log(`${check ? 'Checked' : 'Wrote'} ${Object.keys(outputs).length} fixture files. Validation: ${result.status}; fatal ${count('fatal')}, errors ${count('error')}, warnings ${count('warning')}.`);
for (const i of result.issues) console.log(`  ${i.severity.toUpperCase().padEnd(7)} ${i.collection}${i.id ? ` ${i.id}` : ''}: ${i.message}`);
const b = result.bundle;
console.log(`  slips ${b.slips.length} · vessels ${b.vessels.length} · agreements ${b.agreements.length} · documents ${b.documents.length} · observations ${b.observations.length} · movements ${b.movements.length} · verifications ${b.verifications.length}`);
if (drift || result.status !== 'ok') process.exit(1);
