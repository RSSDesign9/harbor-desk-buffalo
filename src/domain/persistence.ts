/**
 * Versioned local persistence with an in-memory fallback (PRD §8). A prototype convenience,
 * not a secure or multi-user audit store. Corrupt, incompatible or inconsistent data is discarded
 * and the caller falls back to the seed with a notice; it is never partially trusted.
 */
import { isLakeScenarioId } from './lake.ts';
import { SESSION_SCHEMA_VERSION, type DemoSession } from './session.ts';
import type { FixtureBundle } from './types.ts';

export const STORAGE_KEY = 'harbor-desk:session';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export type StorageBackend = 'local' | 'memory';

/** Probe localStorage; any failure (disabled, quota, privacy mode) selects in-memory storage. */
export function pickStorage(candidate: (() => StorageLike | undefined) | undefined): { backend: StorageBackend; storage: StorageLike } {
  try {
    const ls = candidate?.();
    if (!ls) throw new Error('no storage');
    const probe = `${STORAGE_KEY}:probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { backend: 'local', storage: ls };
  } catch {
    return { backend: 'memory', storage: memoryStorage() };
  }
}

export type LoadNotice = 'corrupt' | 'incompatible_version' | 'inconsistent' | 'read_failed';

interface Envelope {
  schemaVersion: number;
  scenarioVersion: string;
  session: DemoSession;
}

export function saveSession(storage: StorageLike, session: DemoSession): { ok: true } | { ok: false; error: string } {
  try {
    const env: Envelope = { schemaVersion: SESSION_SCHEMA_VERSION, scenarioVersion: session.scenarioVersion, session };
    storage.setItem(STORAGE_KEY, JSON.stringify(env));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function clearSession(storage: StorageLike): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

/** Structural + referential check of a stored session against the current fixtures. */
export function isConsistentSession(fx: FixtureBundle, v: unknown): v is DemoSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (s.schemaVersion !== SESSION_SCHEMA_VERSION || s.scenarioVersion !== fx.scenario.scenarioVersion || s.seed !== fx.scenario.seed) return false;
  if (!isStr(s.branchId) || !Object.values(fx.scenario.checkpoints).includes(s.clock as string)) return false;
  for (const k of ['revealedEvidenceIds', 'acknowledgedEvidenceIds', 'issues', 'tasks', 'verifications', 'decisions', 'audit', 'sourceEvents']) if (!isArr(s[k])) return false;
  const sel = s.selection as { kind?: unknown; id?: unknown } | null;
  if (sel !== null && !(sel && (sel.kind === 'slip' ? fx.slips.some((x) => x.id === sel.id) : sel.kind === 'vessel' && fx.vessels.some((x) => x.id === sel.id)))) return false;
  const evidence = new Set(fx.stagedEvidence.map((e) => e.id));
  if (!(s.revealedEvidenceIds as unknown[]).every((e) => isStr(e) && evidence.has(e))) return false;
  if (!(s.acknowledgedEvidenceIds as unknown[]).every((e) => (s.revealedEvidenceIds as unknown[]).includes(e))) return false;
  const issues = s.issues as { id?: unknown; slipId?: unknown; observationId?: unknown; state?: unknown }[];
  if (!issues.every((i) => isStr(i.id) && i.slipId === fx.scenario.slipId && i.observationId === fx.scenario.uncertainObservationId && ['open', 'pending_check', 'resolved'].includes(i.state as string))) return false;
  const issueIds = new Set(issues.map((i) => i.id));
  const tasks = s.tasks as { issueId?: unknown }[];
  if (!tasks.every((t) => issueIds.has(t.issueId as string)) || new Set(tasks.map((t) => t.issueId)).size !== tasks.length) return false;
  const verIds = new Set((s.verifications as { id?: unknown }[]).map((x) => x.id));
  if (!(s.decisions as { verificationId?: unknown; confirmedVesselId?: unknown }[]).every((d) => verIds.has(d.verificationId) && fx.vessels.some((x) => x.id === d.confirmedVesselId))) return false;
  const review = s.review as { issueId?: unknown } | null;
  if (review !== null && !(review && issueIds.has(review.issueId as string))) return false;
  // T30 assignments (absent in runs saved before T30, which load with none).
  if (s.assignments !== undefined) {
    if (!isArr(s.assignments)) return false;
    const requests = new Set(fx.transientRequests.map((r) => r.id));
    const slips = new Set(fx.slips.map((x) => x.id));
    // T35: the lake what-if is absent on runs saved before it (calm).
    if (!(s.assignments as { requestId?: unknown; slipId?: unknown; undoneAt?: unknown; lake?: unknown }[]).every((a) => requests.has(a.requestId as string) && slips.has(a.slipId as string) && (a.undoneAt === null || isStr(a.undoneAt)) && (a.lake === undefined || isLakeScenarioId(a.lake)))) return false;
  }
  return true;
}

export function loadSession(storage: StorageLike, fx: FixtureBundle): { session: DemoSession | null; notice: LoadNotice | null } {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { session: null, notice: 'read_failed' };
  }
  if (text === null) return { session: null, notice: null };
  let env: Partial<Envelope>;
  try {
    env = JSON.parse(text) as Partial<Envelope>;
  } catch {
    clearSession(storage);
    return { session: null, notice: 'corrupt' };
  }
  if (!env || env.schemaVersion !== SESSION_SCHEMA_VERSION || env.scenarioVersion !== fx.scenario.scenarioVersion) {
    clearSession(storage);
    return { session: null, notice: 'incompatible_version' };
  }
  if (!isConsistentSession(fx, env.session)) {
    clearSession(storage);
    return { session: null, notice: 'inconsistent' };
  }
  return { session: { ...env.session, assignments: env.session.assignments ?? [] }, notice: null };
}
