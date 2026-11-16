/**
 * Fixture validation (TASKS T05, PRD F12).
 *
 * Fails rather than guesses: missing provenance and broken references are errors. Record-level errors
 * QUARANTINE the record (it leaves the display model; the rest of the app keeps working). Errors in the
 * canonical scenario are FATAL because the workflow would otherwise show false operational facts.
 */
import type { FixtureBundle, Slip } from './types.ts';
import { isProvenance } from './provenance.ts';
import { isIsoUtc, toMs } from './time.ts';

export type Collection = Exclude<keyof FixtureBundle, 'generated_at' | 'scenario'>;

export interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warning';
  collection: Collection | 'scenario' | 'bundle';
  id: string | null;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  fatal: boolean;
  issues: ValidationIssue[];
  /** Records to drop from the display model, by collection. */
  quarantine: Partial<Record<Collection, string[]>>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EXPECTED_DOCK_COUNTS: Readonly<Record<string, number>> = { A: 39, B: 37, C: 18, D: 22, E: 10 };
export const EXPECTED_SLIPS = 126;
export const EXPECTED_VESSELS = 113;

export function validateBundle(b: FixtureBundle): ValidationResult {
  const issues: ValidationIssue[] = [];
  const quarantine: Partial<Record<Collection, string[]>> = {};
  const fail = (collection: Collection, id: string, message: string) => {
    issues.push({ severity: 'error', collection, id, message });
    const list = (quarantine[collection] ??= []);
    if (!list.includes(id)) list.push(id);
  };
  const warn = (collection: Collection, id: string | null, message: string) => issues.push({ severity: 'warning', collection, id, message });
  const fatal = (collection: ValidationIssue['collection'], id: string | null, message: string) => issues.push({ severity: 'fatal', collection, id, message });
  // Dataset-level problems (counts) block a build but not the running app: the rest stays usable.
  const bundleError = (collection: ValidationIssue['collection'], message: string) => issues.push({ severity: 'error', collection, id: null, message });

  // ---- uniqueness + provenance on every record ----
  const collections: Collection[] = ['sources', 'actors', 'slips', 'vessels', 'agreements', 'documents', 'observations', 'movements', 'verifications', 'sourceStatus', 'stagedEvidence', 'evidenceAssets', 'slipServices', 'transientRequests', 'lakeScenarios'];
  for (const c of collections) {
    const seen = new Set<string>();
    for (const r of b[c] as readonly { id: string; provenance?: unknown }[]) {
      if (typeof r.id !== 'string' || r.id === '') {
        issues.push({ severity: 'error', collection: c, id: null, message: 'Record without an id' });
        continue;
      }
      if (seen.has(r.id)) fail(c, r.id, `Duplicate id ${r.id}`);
      seen.add(r.id);
      if (!isProvenance(r.provenance)) fail(c, r.id, `Missing or invalid provenance (${String(r.provenance)}); unlabelled records cannot enter the display model`);
    }
  }

  const ids = <T extends { id: string }>(arr: readonly T[]) => new Set(arr.map((r) => r.id));
  const slipIds = ids(b.slips);
  const vesselIds = ids(b.vessels);
  const sourceById = new Map(b.sources.map((s) => [s.id, s]));
  const actorIds = ids(b.actors);
  const assetIds = ids(b.evidenceAssets);
  const slipById = new Map<string, Slip>(b.slips.map((s) => [s.id, s]));
  const vesselById = new Map(b.vessels.map((v) => [v.id, v]));

  // ---- T30: assumed berth services and transient requests ----
  const servicedSlips = new Set<string>();
  for (const v of b.slipServices) {
    if (!slipIds.has(v.slipId)) fail('slipServices', v.id, `Unknown slip ${v.slipId}`);
    else if (servicedSlips.has(v.slipId)) fail('slipServices', v.id, `Second service record for ${v.slipId}`);
    servicedSlips.add(v.slipId);
    if (!(v.depth_ft > 0) || !Array.isArray(v.shorePowerA) || !v.shorePowerA.every((a) => a > 0)) fail('slipServices', v.id, 'Depth and shore power must be positive');
    if (v.provenance !== 'ASSUME') fail('slipServices', v.id, 'Berth services are assumptions and must be labelled ASSUME');
    // T35: exposure and fixed-deck height (null exactly on floating docks).
    const sl = slipById.get(v.slipId);
    if (v.exposure !== 'open' && v.exposure !== 'sheltered') fail('slipServices', v.id, 'Exposure must be open or sheltered');
    if (sl && (sl.dock_kind === 'floating' ? v.deckFreeboard_ft !== null : !(typeof v.deckFreeboard_ft === 'number' && v.deckFreeboard_ft > 0))) fail('slipServices', v.id, 'Fixed docks need a positive deck height; floating docks have none');
  }
  // ---- T35: lake what-ifs ----
  for (const l of b.lakeScenarios) {
    if (l.provenance !== 'SIM') fail('lakeScenarios', l.id, 'Lake conditions are simulated and must be labelled SIM');
    const ok =
      Array.isArray(l.samples) &&
      l.samples.length > 1 &&
      l.samples.every((x, i) => isIsoUtc(x.at) && [x.level_ft, x.windFromDeg, x.wind_kt, x.gust_kt].every(Number.isFinite) && x.wind_kt >= 0 && x.gust_kt >= x.wind_kt && x.windFromDeg >= 0 && x.windFromDeg < 360 && (i === 0 || toMs(x.at) > toMs(l.samples[i - 1]!.at)));
    if (!ok) fail('lakeScenarios', l.id, 'Samples must be ascending UTC times with finite values, wind ≥ 0, gusts ≥ wind and a direction in 0–359°');
    else
      for (const r of b.transientRequests) {
        const end = toMs(r.arrivalTo) + r.nights * 86400000;
        if (toMs(l.samples[0]!.at) > toMs(r.arrivalFrom) || toMs(l.samples[l.samples.length - 1]!.at) < end) fail('lakeScenarios', l.id, `Series does not cover the stay of ${r.id}`);
      }
  }
  for (const id of ['calm', 'sw-gale'] as const) if (!b.lakeScenarios.some((l) => l.id === id)) bundleError('lakeScenarios', `Lake scenario ${id} is missing`);
  for (const r of b.transientRequests) {
    if (![r.loa_ft, r.beam_ft, r.draft_ft, r.powerA, r.nights].every((n) => typeof n === 'number' && n > 0)) fail('transientRequests', r.id, 'Request dimensions, power and nights must be positive');
    if (![r.receivedAt, r.arrivalFrom, r.arrivalTo].every(isIsoUtc) || toMs(r.arrivalFrom) > toMs(r.arrivalTo)) fail('transientRequests', r.id, 'Request times must be UTC ISO with arrivalFrom ≤ arrivalTo');
  }

  // ---- sources ----
  for (const s of b.sources) {
    if (s.provenance === 'DOC' && !s.url && !s.path) fail('sources', s.id, 'Documented source needs a URL or path');
    if (s.date === null ? !/not recorded/i.test(s.caveats) : !DATE.test(s.date)) fail('sources', s.id, 'Source date must be YYYY-MM-DD, or null with a caveat saying it is not recorded');
  }

  // ---- slips ----
  if (b.slips.length !== EXPECTED_SLIPS) bundleError('slips', `Expected ${EXPECTED_SLIPS} slips, found ${b.slips.length}`);
  const perDock: Record<string, number> = {};
  for (const s of b.slips) {
    perDock[s.dock] = (perDock[s.dock] ?? 0) + 1;
    if (s.id !== `${s.dock}-${String(s.number).padStart(2, '0')}`) fail('slips', s.id, 'Slip id does not match dock/number');
    if (s.provenance !== 'ASSUME') fail('slips', s.id, 'Slips are design assumptions and must be ASSUME');
    if (!(s.length_ft > 0 && s.width_ft > 0 && s.width_ft < s.length_ft)) fail('slips', s.id, 'Slip dimensions (ft) must be positive with width < length');
  }
  for (const [d, n] of Object.entries(EXPECTED_DOCK_COUNTS)) if (perDock[d] !== n) bundleError('slips', `Dock ${d}: expected ${n} slips, found ${perDock[d] ?? 0}`);

  // ---- vessels ----
  if (b.vessels.length !== EXPECTED_VESSELS) bundleError('vessels', `Expected ${EXPECTED_VESSELS} vessels, found ${b.vessels.length}`);
  for (const v of b.vessels) {
    if (!/^V-\d{3}$/.test(v.id)) fail('vessels', v.id, 'Vessel id must look like V-001');
    if (!v.name?.trim()) fail('vessels', v.id, 'Vessel needs a name');
    if (v.provenance === 'SIM' && !isIsoUtc(v.generated_at)) fail('vessels', v.id, 'SIM vessel needs a generated_at timestamp');
    if (!(v.loa_ft > 0 && v.loa_ft < 120)) fail('vessels', v.id, `Implausible LOA ${v.loa_ft} ft`);
    if (v.beam_ft !== null && !(v.beam_ft > 0 && v.beam_ft < v.loa_ft / 2)) fail('vessels', v.id, `Implausible beam ${v.beam_ft} ft for LOA ${v.loa_ft} ft`);
    if (v.draft_ft !== null && !(v.draft_ft > 0 && v.draft_ft < v.loa_ft / 3)) fail('vessels', v.id, `Implausible draft ${v.draft_ft} ft`);
    const expectedAsset = v.type === 'sailboat' ? 'sail' : v.type === 'cabin-cruiser' ? 'cruiser' : 'console';
    if (v.modelAssetKey !== expectedAsset) fail('vessels', v.id, `Model family ${v.modelAssetKey} does not match type ${v.type}`);
    if (!v.owner?.label || /\b(mr|mrs|ms|dr)\.?\s/i.test(v.owner.label)) fail('vessels', v.id, 'Owner must be a fictional, non-personal label');
  }

  // ---- agreements ----
  const activeBySlip = new Map<string, string>();
  const activeByVessel = new Map<string, string>();
  for (const a of b.agreements) {
    if (!vesselIds.has(a.vesselId)) fail('agreements', a.id, `Unknown vessel ${a.vesselId}`);
    if (!slipIds.has(a.slipId)) fail('agreements', a.id, `Unknown slip ${a.slipId}`);
    if (!DATE.test(a.start) || !DATE.test(a.end) || a.start >= a.end) fail('agreements', a.id, 'Agreement dates must be YYYY-MM-DD with start < end');
    if (a.status === 'active') {
      const s = activeBySlip.get(a.slipId);
      if (s) fail('agreements', a.id, `Duplicate active agreement for slip ${a.slipId} (also ${s})`);
      activeBySlip.set(a.slipId, a.id);
      const v = activeByVessel.get(a.vesselId);
      if (v) fail('agreements', a.id, `Vessel ${a.vesselId} has two active agreements (also ${v})`);
      activeByVessel.set(a.vesselId, a.id);
    }
    if (!Number.isInteger(a.rateUsd) || a.rateUsd <= 0) fail('agreements', a.id, `Rate must be a positive whole-dollar amount (${String(a.rateUsd)})`);
    if (a.rateBasis !== (a.type === 'seasonal' ? 'season' : 'night')) fail('agreements', a.id, `Rate basis ${String(a.rateBasis)} does not fit a ${a.type} agreement`);
    if (!isProvenance(a.fieldProvenance?.rateUsd) || !isProvenance(a.fieldProvenance?.rateBasis)) fail('agreements', a.id, 'Rate fields need their own provenance');
    const slip = slipById.get(a.slipId);
    const vessel = vesselById.get(a.vesselId);
    if (slip && vessel && vessel.loa_ft > slip.length_ft) warn('agreements', a.id, `${vessel.name} (${vessel.loa_ft} ft) is longer than the assumed ${slip.length_ft} ft class of ${slip.id}; not a berth-fit judgement`);
  }

  // ---- documents ----
  for (const d of b.documents) {
    if (!vesselIds.has(d.vesselId)) fail('documents', d.id, `Unknown vessel ${d.vesselId}`);
    if (d.reviewState !== 'reviewed' && d.reviewedOn !== null) fail('documents', d.id, 'Only reviewed records carry a review date');
    if (d.reviewState === 'reviewed' && (d.reviewedOn === null || !DATE.test(d.reviewedOn))) fail('documents', d.id, 'Reviewed records need a review date');
  }

  // ---- observations ----
  for (const o of b.observations) {
    if (!slipIds.has(o.slipId)) fail('observations', o.id, `Unknown slip ${o.slipId}`);
    const src = sourceById.get(o.sourceId);
    if (!src) fail('observations', o.id, `Unknown source ${o.sourceId}`);
    else if (src.kind !== 'sim-camera') fail('observations', o.id, `Observation source ${o.sourceId} is not a camera`);
    if (!isIsoUtc(o.observedAt) || !isIsoUtc(o.receivedAt)) fail('observations', o.id, 'Times must be ISO-8601 UTC');
    else if (toMs(o.receivedAt) < toMs(o.observedAt)) fail('observations', o.id, 'receivedAt is earlier than observedAt');
    if (!['present', 'empty', 'unknown'].includes(o.presence)) fail('observations', o.id, `Invalid presence ${o.presence}`);
    for (const c of o.candidateVesselIds) if (!vesselIds.has(c)) fail('observations', o.id, `Unknown candidate vessel ${c}`);
    if (o.candidateVesselIds.length > 0 && o.presence !== 'present') fail('observations', o.id, 'Candidates only make sense when a vessel is present');
    if (o.evidenceAssetId !== null && !assetIds.has(o.evidenceAssetId)) fail('observations', o.id, `Unknown evidence asset ${o.evidenceAssetId}`);
  }

  // ---- movements, verifications, source status ----
  for (const m of b.movements) {
    if (!vesselIds.has(m.vesselId) || !slipIds.has(m.slipId)) fail('movements', m.id, 'Unknown vessel or slip');
    if (!sourceById.has(m.sourceId) || !actorIds.has(m.actorId)) fail('movements', m.id, 'Unknown source or actor');
    if (!isIsoUtc(m.at)) fail('movements', m.id, 'Time must be ISO-8601 UTC');
    if (m.trip !== 'outing' && m.trip !== 'stay') fail('movements', m.id, `Unknown trip ${String(m.trip)}`);
    if (m.expectedReturnAt !== null && (m.kind !== 'departure' || !isIsoUtc(m.expectedReturnAt) || m.expectedReturnAt <= m.at)) fail('movements', m.id, 'Expected return must be a later ISO time on a departure, or null');
  }
  for (const v of b.verifications) {
    if (!vesselIds.has(v.verifiedVesselId) || !slipIds.has(v.slipId)) fail('verifications', v.id, 'Unknown vessel or slip');
    if (!sourceById.has(v.sourceId) || !actorIds.has(v.actorId)) fail('verifications', v.id, 'Unknown source or actor');
    if (!isIsoUtc(v.checkedAt)) fail('verifications', v.id, 'Time must be ISO-8601 UTC');
  }
  for (const s of b.sourceStatus) {
    if (!sourceById.has(s.sourceId)) fail('sourceStatus', s.id, `Unknown source ${s.sourceId}`);
    if (!isIsoUtc(s.at)) fail('sourceStatus', s.id, 'Time must be ISO-8601 UTC');
  }
  for (const e of b.stagedEvidence) {
    if (!slipIds.has(e.slipId) || !sourceById.has(e.sourceId)) fail('stagedEvidence', e.id, 'Unknown slip or source');
    if (e.actorId !== null && !actorIds.has(e.actorId)) fail('stagedEvidence', e.id, `Unknown actor ${e.actorId}`);
    if (e.verifiedVesselId !== null && !vesselIds.has(e.verifiedVesselId)) fail('stagedEvidence', e.id, `Unknown vessel ${e.verifiedVesselId}`);
    if (e.kind !== 'staff-dock-check' && e.verifiedVesselId !== null) fail('stagedEvidence', e.id, 'Only a staff dock check can carry a verified identity');
    if (e.assetId !== null && !assetIds.has(e.assetId)) fail('stagedEvidence', e.id, `Unknown asset ${e.assetId}`);
    if (!e.altText?.trim()) fail('stagedEvidence', e.id, 'Evidence needs text that stands in for the image');
  }

  // ---- canonical scenario (fatal on mismatch) ----
  const sc = b.scenario;
  if (!isProvenance(sc.provenance)) fatal('scenario', null, 'Scenario needs provenance');
  const cps = Object.values(sc.checkpoints);
  if (!cps.every(isIsoUtc) || cps.some((t, i) => i > 0 && toMs(t) <= toMs(cps[i - 1]!))) fatal('scenario', null, 'Checkpoints must be strictly increasing UTC times');
  if (sc.date !== '2026-07-15' || sc.timeZone !== 'America/New_York') fatal('scenario', null, 'Scenario must be 15 July 2026, America/New_York (PRD §7)');
  const expectVessel = (id: string, name: string, loa: number, type: string, slip: string) => {
    const v = vesselById.get(id);
    if (!v || v.name !== name || v.loa_ft !== loa || v.type !== type) fatal('scenario', id, `Canonical vessel ${id} must be ${name}, ${loa} ft ${type}`);
    const ag = b.agreements.find((a) => a.vesselId === id && a.status === 'active');
    if (!ag || ag.slipId !== slip) fatal('scenario', id, `${name} must hold an active agreement for ${slip}`);
  };
  expectVessel('V-021', 'Lake Effect', 29, 'cabin-cruiser', 'B-12');
  expectVessel('V-022', 'Harbor Light', 27, 'cabin-cruiser', 'B-14');
  expectVessel('V-023', 'River Run', 24, 'center-console', 'B-10');
  if (vesselById.get('V-021')?.registrationSuffix !== '42 AB') fatal('scenario', 'V-021', 'Lake Effect registration must end 42 AB');
  const obs = b.observations.find((o) => o.id === sc.uncertainObservationId);
  if (!obs || obs.slipId !== sc.slipId || obs.observedAt !== sc.checkpoints.uncertain || obs.sourceId !== 'C-02' || !obs.candidateVesselIds.includes(sc.candidateVesselId))
    fatal('scenario', sc.uncertainObservationId, 'The 09:12 C-02 observation at B-12 with candidate Harbor Light is missing or altered');
  if (obs && /lake|effect|v-021|harbor|light/i.test(obs.id)) fatal('scenario', obs.id, 'Observation IDs must be opaque');
  const staff = b.stagedEvidence.find((e) => e.id === sc.staffEvidenceId);
  if (!staff || staff.verifiedVesselId !== sc.assignedVesselId || staff.capturedAt !== sc.checkpoints.verification_review) fatal('scenario', sc.staffEvidenceId, 'Staff evidence must identify Lake Effect at 09:18');
  const dep = (vid: string, at: string) => b.movements.some((m) => m.vesselId === vid && m.kind === 'departure' && m.at === at);
  if (!dep('V-021', '2026-07-15T12:10:00Z')) fatal('scenario', 'V-021', 'Lake Effect departure must be logged at 08:10');
  if (!dep('V-022', '2026-07-15T12:30:00Z')) fatal('scenario', 'V-022', 'Harbor Light departure must be logged at 08:30');
  if (!b.verifications.some((v) => v.verifiedVesselId === 'V-023' && v.slipId === 'B-10' && v.checkedAt === '2026-07-15T12:40:00Z')) fatal('scenario', 'V-023', 'River Run staff observation at 08:40 is missing');
  if (b.actors.find((a) => a.id === sc.demoActorId)?.label !== 'Demo dockmaster') fatal('scenario', sc.demoActorId, 'Demo actor must be “Demo dockmaster”');
  // Nothing about B-12 may already be decided in the seed.
  if (b.verifications.some((v) => v.slipId === sc.slipId && toMs(v.checkedAt) > toMs(sc.checkpoints.normal))) fatal('scenario', sc.slipId, 'Seed must not contain a post-08:45 verification at B-12');

  // A canonical record that was quarantined is fatal too.
  const canonicalIds = new Set(['V-021', 'V-022', 'V-023', 'B-10', 'B-12', 'B-14', sc.uncertainObservationId, sc.staffEvidenceId]);
  for (const list of Object.values(quarantine)) for (const id of list ?? []) if (canonicalIds.has(id)) fatal('scenario', id, `Canonical record ${id} failed validation`);

  const isFatal = issues.some((i) => i.severity === 'fatal');
  return { ok: !isFatal && !issues.some((i) => i.severity === 'error'), fatal: isFatal, issues, quarantine };
}

/** Remove quarantined records and anything that references them, until stable. */
export function applyQuarantine(bundle: FixtureBundle): { bundle: FixtureBundle; result: ValidationResult; removed: { collection: Collection; id: string }[] } {
  let current = bundle;
  const removed: { collection: Collection; id: string }[] = [];
  let result = validateBundle(current);
  const seen = new Set<string>();
  const allIssues: ValidationIssue[] = [];
  const collect = (r: ValidationResult) => {
    for (const i of r.issues) {
      const key = `${i.severity}|${i.collection}|${i.id}|${i.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        allIssues.push(i);
      }
    }
  };
  collect(result);
  for (let pass = 0; pass < 5 && !result.fatal && Object.keys(result.quarantine).length > 0; pass++) {
    const next = { ...current } as Record<string, unknown>;
    for (const [c, list] of Object.entries(result.quarantine) as [Collection, string[]][]) {
      const drop = new Set(list);
      next[c] = (current[c] as readonly { id: string }[]).filter((r) => !drop.has(r.id));
      for (const id of list) removed.push({ collection: c, id });
    }
    current = next as unknown as FixtureBundle;
    result = validateBundle(current);
    collect(result);
  }
  // Every issue from every pass is reported; fatal/ok reflect the final, quarantined bundle.
  return { bundle: current, result: { ...result, issues: allIssues }, removed };
}
