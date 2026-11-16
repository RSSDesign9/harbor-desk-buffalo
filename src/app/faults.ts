/**
 * Reproducible fault injection for development and tests (TASKS T18). Never part of the public interface:
 * faults apply only when the URL carries BOTH `debug` and `fault=…`, e.g.
 *
 *   /?debug&fault=geometry
 *   /?debug&fault=model,evidence
 *
 * Without `?debug` the parameter is ignored. Every fault mimics a real failure at the boundary where it would
 * happen (fixture load, geometry load, asset build, storage, WebGL probe); nothing bypasses domain rules.
 * The full list, and what each one does, is documented in BUILD-LOG (Batch 7, “Fault injection”).
 */
export const FAULTS = [
  'webgl-unsupported', // the WebGL probe fails, as on a browser without WebGL
  'geometry', // the runtime site geometry fails validation (a slip corner becomes NaN)
  'model', // the cabin-cruiser generator throws, as a failed boat asset would
  'evidence', // evidence images point at files that do not exist (404)
  'record-provenance', // one non-scenario vessel record arrives without provenance
  'record-reference', // one agreement references a vessel that does not exist
  'scenario-provenance', // the canonical Lake Effect record arrives without provenance (fatal)
  'storage-unavailable', // localStorage throws on access
  'storage-corrupt', // the stored session is unreadable JSON
  'storage-incompatible', // the stored session is from an older schema
  'storage-write', // storage reads work but every write throws (quota)
] as const;
export type Fault = (typeof FAULTS)[number];

let cached: ReadonlySet<Fault> | null = null;

export function activeFaults(): ReadonlySet<Fault> {
  if (cached) return cached;
  if (typeof window === 'undefined') return (cached = new Set());
  const q = new URLSearchParams(window.location.search);
  if (!q.has('debug')) return (cached = new Set());
  const requested = (q.get('fault') ?? '').split(',').map((s) => s.trim());
  cached = new Set(FAULTS.filter((f) => requested.includes(f)));
  return cached;
}

export const hasFault = (f: Fault) => activeFaults().has(f);
