/**
 * Registry and inspector view models (TASKS T10). Pure functions over the shared domain selectors, so the
 * scene, list, inspector, markers and counts can never disagree. No React here.
 *
 * Identity rules (PRD §6, §7 inv. 3, 10):
 * - An unverified hull is described by its slip and observation only. Labels, search keys and accessible
 *   text never name the hull; a candidate appears only as an explicitly labelled “Possible match”.
 * - Assignment (registry) is shown as assignment; it is never presented as the observed boat’s identity.
 */
import type { DemoSession } from '../../domain/session.ts';
import type { FixtureBundle, IsoTime, Vessel, VesselType } from '../../domain/types.ts';
import {
  activeAssignmentForSlip,
  unsoldNights,
  UNSOLD_HORIZON_NIGHTS,
  activeAgreementForSlip,
  activeAgreementForVessel,
  bookability,
  documentsForVessel,
  latestIssueForSlip,
  slipIdentity,
  slipPresence,
  vesselLocation,
} from '../../domain/selectors.ts';
import { formatClock } from '../../domain/time.ts';
import type { PillTone } from '../../ui/Status.tsx';

type Fx = FixtureBundle;
type S = DemoSession;

// ---------- search ----------
export interface ParsedQuery {
  raw: string;
  compact: string;
  /** Canonical slip ID when the query is a slip ID in any spacing/padding (B12, b 12, B-012 → B-12). */
  slipId: string | null;
  /** Canonical vessel ID (v21, V 021 → V-021). */
  vesselId: string | null;
  text: string;
}

export function parseQuery(raw: string): ParsedQuery {
  const text = raw.trim().toLowerCase();
  const compact = text.replace(/[\s\-_.]/g, '');
  const slip = /^([a-e])0*(\d{1,2})$/.exec(compact);
  const vessel = /^v0*(\d{1,3})$/.exec(compact);
  return {
    raw,
    compact,
    text,
    slipId: slip ? `${slip[1]!.toUpperCase()}-${slip[2]!.padStart(2, '0')}` : null,
    vesselId: vessel ? `V-${vessel[1]!.padStart(3, '0')}` : null,
  };
}

const compactId = (id: string) => id.replace('-', '').toLowerCase();

export interface Filters {
  dock: 'all' | 'A' | 'B' | 'C' | 'D' | 'E';
  needsReview: boolean;
}
export const NO_FILTERS: Filters = { dock: 'all', needsReview: false };

// ---------- labels ----------
export const TYPE_LABEL: Record<VesselType, string> = { 'cabin-cruiser': 'Cabin cruiser', 'center-console': 'Center console', runabout: 'Runabout', sailboat: 'Sailboat' };
export const TYPE_GLYPH: Record<VesselType, 'v-power' | 'v-sail'> = { 'cabin-cruiser': 'v-power', 'center-console': 'v-power', runabout: 'v-power', sailboat: 'v-sail' };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** “1 May – 15 Oct 2026”: ISO dates break mid-number in a narrow rail. */
export function termLabel(start: string, end: string): string {
  const [ys, ms, ds] = start.split('-').map(Number) as [number, number, number];
  const [ye, me, de] = end.split('-').map(Number) as [number, number, number];
  const d = (day: number, m: number) => `${day} ${MONTH[m - 1]}`;
  return ys === ye ? `${d(ds, ms)} – ${d(de, me)} ${ye}` : `${d(ds, ms)} ${ys} – ${d(de, me)} ${ye}`;
}
const ft = (v: number | null) => (v === null ? 'Not recorded' : `${Number.isInteger(v) ? v : v.toFixed(1)}\u00a0ft`); // never wrap “ft” alone
const t = (iso: IsoTime) => formatClock(iso);
const SOURCE_LABEL = (fx: Fx, sourceId: string) => {
  const src = fx.sources.find((x) => x.id === sourceId);
  if (!src) return sourceId;
  if (src.kind === 'sim-camera') return `Camera ${src.id}`;
  if (src.kind === 'sim-staff-log') return 'Staff log';
  return 'Staff check';
};

export interface Badge {
  label: string;
  tone: PillTone;
}

export function presenceBadge(fx: Fx, s: S, slipId: string): Badge {
  const p = slipPresence(fx, s, slipId);
  if (p.current === 'present') return { label: 'Present', tone: 'present' };
  if (p.current === 'empty') return { label: 'Empty', tone: 'empty' };
  if (p.cameraStatus === 'offline') return { label: 'Camera offline', tone: 'offline' };
  return { label: 'Presence unknown', tone: 'unknown' };
}

export function reviewBadge(s: S, slipId: string): Badge | null {
  const issue = latestIssueForSlip(s, slipId);
  if (!issue) return null;
  if (issue.state === 'open') return { label: 'Needs review', tone: 'review' };
  if (issue.state === 'pending_check') return { label: 'Dock check pending', tone: 'pending' };
  return { label: 'Resolved', tone: 'resolved' };
}

/** Short state used by scene markers and hover labels. Never names an unverified hull. */
export function slipStateLabel(fx: Fx, s: S, slipId: string): string {
  const p = slipPresence(fx, s, slipId);
  const id = slipIdentity(fx, s, slipId);
  if (id.state === 'unverified') return p.current === 'present' ? 'Vessel present · identity unverified' : 'Identity unverified · presence unknown';
  if (id.state === 'confirmed') {
    const name = fx.vessels.find((v) => v.id === id.vesselId)?.name ?? 'Confirmed vessel';
    return p.current === 'present' ? name : `${name} · presence unknown`;
  }
  if (p.current === 'empty') return activeAgreementForSlip(fx, slipId) ? 'Empty · assigned' : 'Empty';
  return p.cameraStatus === 'offline' ? 'Camera offline' : 'Presence unknown';
}

export function markerLabel(fx: Fx, s: S, slipId: string, via: 'slip' | 'away-vessel' = 'slip'): string {
  if (via === 'away-vessel') return `${slipId} · Assigned berth · last confirmed away`;
  return `${slipId} · ${slipStateLabel(fx, s, slipId)}`;
}

// ---------- list rows ----------
export interface SlipRow {
  id: string;
  dock: string;
  assignedVessel: { id: string; name: string } | null;
  presence: Badge;
  review: Badge | null;
}

export interface VesselRow {
  id: string;
  name: string;
  typeLabel: string;
  glyph: 'v-power' | 'v-sail';
  slipId: string | null;
  status: Badge;
}

export function vesselStatus(fx: Fx, s: S, vesselId: string): Badge {
  const loc = vesselLocation(fx, s, vesselId);
  const ag = activeAgreementForVessel(fx, vesselId);
  if (loc.kind === 'departed') return { label: `Away · departed ${t(loc.at)}`, tone: 'away' };
  if (loc.kind === 'confirmed-present') return { label: `At ${loc.slipId} · confirmed ${t(loc.at)}`, tone: 'present' };
  return { label: ag ? 'No confirmed activity today' : 'No current slip agreement', tone: 'unknown' };
}

export function slipRows(fx: Fx, s: S, query: string, filters: Filters): SlipRow[] {
  const q = parseQuery(query);
  const rows: { row: SlipRow; rank: number }[] = [];
  for (const slip of fx.slips) {
    if (filters.dock !== 'all' && slip.dock !== filters.dock) continue;
    const review = reviewBadge(s, slip.id);
    if (filters.needsReview && !(review && review.tone !== 'resolved')) continue;
    const ag = activeAgreementForSlip(fx, slip.id);
    const vessel = ag ? fx.vessels.find((v) => v.id === ag.vesselId) ?? null : null;
    let rank = 0;
    if (q.compact) {
      // Search keys: slip ID and the ASSIGNED vessel (registry). Never observation candidates.
      if (q.slipId === slip.id) rank = 3;
      else if (compactId(slip.id).startsWith(q.compact)) rank = 2;
      else if (vessel && (q.vesselId === vessel.id || vessel.name.toLowerCase().includes(q.text))) rank = 1;
      else continue;
    }
    rows.push({ rank, row: { id: slip.id, dock: slip.dock, assignedVessel: vessel ? { id: vessel.id, name: vessel.name } : null, presence: presenceBadge(fx, s, slip.id), review } });
  }
  return rows.sort((a, b) => b.rank - a.rank).map((r) => r.row);
}

export function vesselRows(fx: Fx, s: S, query: string, filters: Filters): VesselRow[] {
  const q = parseQuery(query);
  const rows: { row: VesselRow; rank: number }[] = [];
  for (const v of fx.vessels) {
    const ag = activeAgreementForVessel(fx, v.id);
    if (filters.dock !== 'all' && ag?.slipId[0] !== filters.dock) continue;
    let rank = 0;
    if (q.compact) {
      if (q.vesselId === v.id) rank = 3;
      else if (v.name.toLowerCase().startsWith(q.text)) rank = 2;
      else if (v.name.toLowerCase().includes(q.text) || (q.slipId !== null && ag?.slipId === q.slipId)) rank = 1;
      else continue;
    }
    rows.push({ rank, row: { id: v.id, name: v.name, typeLabel: TYPE_LABEL[v.type], glyph: TYPE_GLYPH[v.type], slipId: ag?.slipId ?? null, status: vesselStatus(fx, s, v.id) } });
  }
  return rows.sort((a, b) => b.rank - a.rank).map((r) => r.row);
}

// ---------- inspectors ----------
export interface Fact {
  label: string;
  value: string;
  provenance?: 'DOC' | 'ASSUME' | 'SIM' | 'FIELD';
}

export interface SlipInspector {
  kind: 'slip';
  id: string;
  subtitle: string;
  review: Badge | null;
  assignment: { vessel: { id: string; name: string; summary: string } | null; facts: Fact[] };
  observation: {
    headline: string;
    badge: Badge;
    facts: Fact[];
    possibleMatch: { id: string; name: string } | null;
    reason: string | null;
  };
  summary: Fact[];
  slipFacts: Fact[];
  modelledIn3D: boolean;
}

/** T30: a demo assignment on a slip without an agreement. */
function localAssignmentFacts(fx: Fx, s: S, slipId: string): Fact[] {
  const a = activeAssignmentForSlip(s, slipId);
  const r = a ? fx.transientRequests.find((x) => x.id === a.requestId) : undefined;
  return a && r ? [{ label: 'Demo assignment', value: `${r.vesselName} · due ${t(r.arrivalFrom)} · ${r.nights} nights`, provenance: 'SIM' }] : [];
}
/** T30: assumed depth and shore power (SRC-SERVICES). */
function serviceFacts(fx: Fx, slipId: string): Fact[] {
  const v = fx.slipServices.find((x) => x.slipId === slipId);
  return v
    ? [
        { label: 'Depth', value: ft(v.depth_ft), provenance: 'ASSUME' },
        { label: 'Shore power', value: v.shorePowerA.map((a) => `${a}\u00a0A`).join(' · '), provenance: 'ASSUME' },
      ]
    : [];
}

export function slipInspector(fx: Fx, s: S, slipId: string, modelledDocks: ReadonlySet<string>): SlipInspector | null {
  const slip = fx.slips.find((x) => x.id === slipId);
  if (!slip) return null;
  const ag = activeAgreementForSlip(fx, slipId);
  const vessel = ag ? fx.vessels.find((v) => v.id === ag.vesselId) ?? null : null;
  const p = slipPresence(fx, s, slipId);
  const id = slipIdentity(fx, s, slipId);
  const book = bookability(fx, slipId);
  const obs = id.state === 'unverified' && id.observationId ? fx.observations.find((o) => o.id === id.observationId) ?? null : null;

  let headline: string;
  if (id.state === 'unverified') headline = p.current === 'present' ? 'Identity unverified' : 'Identity unverified · presence unknown';
  else if (id.state === 'confirmed') {
    const name = fx.vessels.find((v) => v.id === id.vesselId)?.name ?? '—';
    headline = p.current === 'present' ? `${name} · identity confirmed` : `Last confirmed: ${name} · presence unknown`;
  } else headline = p.current === 'empty' ? 'No vessel present' : 'Presence unknown';

  const facts: Fact[] = [];
  if (p.basis) facts.push({ label: 'Source', value: `${SOURCE_LABEL(fx, p.basis.sourceId)} · ${t(p.basis.at)}`, provenance: 'SIM' });
  facts.push({
    label: 'Freshness',
    value:
      p.freshness === 'fresh'
        ? (p.current === 'unknown' ? 'Recent report · presence unknown' : 'Current')
        : p.lastReported
          ? `Last reported ${p.lastReported.presence} at ${t(p.lastReported.at)} · current presence unknown`
          : 'No report',
  });
  if (p.cameraStatus === 'offline' && p.cameraId) facts.push({ label: 'Camera', value: `${p.cameraId} offline`, provenance: 'SIM' });
  if (id.state === 'confirmed') {
    const basis = id.basis === 'identity-decision' ? 'Staff evidence' : id.basis === 'arrival-log' ? 'Arrival log' : 'Staff verification';
    facts.push({ label: 'Identity', value: `${basis} · ${t(id.at)}`, provenance: 'SIM' });
  }

  const possible = id.state === 'unverified' ? id.candidateVesselIds.map((cid) => fx.vessels.find((v) => v.id === cid)).find(Boolean) ?? null : null;

  return {
    kind: 'slip',
    id: slip.id,
    subtitle: `Dock ${slip.dock} · ${slip.dock_kind}`,
    review: reviewBadge(s, slipId),
    assignment: {
      vessel: vessel ? { id: vessel.id, name: vessel.name, summary: `${ft(vessel.loa_ft)} ${TYPE_LABEL[vessel.type].toLowerCase()}` } : null,
      facts: ag
        ? [
            { label: 'Agreement', value: ag.type === 'seasonal' ? 'Seasonal' : 'Transient', provenance: 'SIM' },
            { label: 'Term', value: termLabel(ag.start, ag.end), provenance: 'SIM' },
          ]
        : [
            { label: 'Agreement', value: 'None on record', provenance: 'SIM' },
            ...localAssignmentFacts(fx, s, slipId),
            { label: 'Unsold nights', value: `${unsoldNights(fx, s, slipId)} of the next ${UNSOLD_HORIZON_NIGHTS}`, provenance: 'SIM' as const },
          ],
    },
    observation: { headline, badge: presenceBadge(fx, s, slipId), facts, possibleMatch: possible ? { id: possible.id, name: possible.name } : null, reason: obs?.reason ?? null },
    summary: [
      { label: 'Presence', value: p.current === 'present' ? 'Present' : p.current === 'empty' ? 'Empty' : 'Unknown' },
      { label: 'Agreement', value: ag ? 'Assigned' : 'None' },
      { label: 'Bookable', value: book.bookable === false ? 'No' : 'Not assessed' },
    ],
    slipFacts: [
      { label: 'Length × width', value: `${slip.length_ft} × ${slip.width_ft} ft`, provenance: 'ASSUME' },
      { label: 'Headwalk', value: `OSM way ${slip.headwalk_osm_way}`, provenance: 'DOC' },
      ...serviceFacts(fx, slipId),
    ],
    modelledIn3D: modelledDocks.has(slip.dock),
  };
}

export interface VesselInspector {
  kind: 'vessel';
  id: string;
  name: string;
  typeLabel: string;
  glyph: 'v-power' | 'v-sail';
  location: Badge;
  locationNote: string;
  assignedSlipId: string | null;
  particulars: Fact[];
  identifiers: Fact[];
  documents: Fact[];
  assignment: Fact[];
}

const DOC_LABEL = { registration: 'Registration record', documentation: 'Documentation record', insurance: 'Insurance record' } as const;
const REVIEW_LABEL = { reviewed: 'Reviewed (demo)', pending_review: 'Pending review', not_recorded: 'Not recorded' } as const;

export function vesselInspector(fx: Fx, s: S, vesselId: string): VesselInspector | null {
  const v: Vessel | undefined = fx.vessels.find((x) => x.id === vesselId);
  if (!v) return null;
  const ag = activeAgreementForVessel(fx, v.id);
  const loc = vesselLocation(fx, s, v.id);
  const status = vesselStatus(fx, s, v.id);
  // The status pill already carries the place and time; the note adds only the source.
  const note =
    loc.kind === 'departed'
      ? 'Source: staff log'
      : loc.kind === 'confirmed-present'
        ? `Source: ${loc.basis === 'identity-decision' ? 'identity decision' : loc.basis === 'arrival-log' ? 'arrival log' : 'staff verification'}`
        : '';
  return {
    kind: 'vessel',
    id: v.id,
    name: v.name,
    typeLabel: TYPE_LABEL[v.type],
    glyph: TYPE_GLYPH[v.type],
    location: status,
    locationNote: note,
    assignedSlipId: ag?.slipId ?? null,
    particulars: [
      { label: 'Type', value: TYPE_LABEL[v.type], provenance: 'SIM' },
      { label: 'LOA / beam / draft', value: `${ft(v.loa_ft)} / ${ft(v.beam_ft)} / ${ft(v.draft_ft)}`, provenance: 'SIM' },
      { label: 'Owner', value: v.owner.label, provenance: 'SIM' },
    ],
    identifiers: [
      { label: 'Registration', value: v.registrationSuffix ? `ending ${v.registrationSuffix}` : 'Not recorded', provenance: 'SIM' },
      { label: 'Documentation', value: v.documentationRef ?? 'Not recorded', provenance: 'SIM' },
      { label: 'HIN', value: v.hinMasked ?? 'Not recorded', provenance: 'SIM' },
    ],
    documents: documentsForVessel(fx, v.id).map((d) => ({
      label: DOC_LABEL[d.docType],
      value: `${REVIEW_LABEL[d.reviewState]}${d.maskedReference ? ` · ${d.maskedReference}` : ''}${d.reviewedOn ? ` · ${d.reviewedOn}` : ''}`,
      provenance: 'SIM' as const,
    })),
    assignment: ag
      ? [
          { label: 'Assigned slip', value: `${ag.slipId} · ${ag.type}`, provenance: 'SIM' },
          { label: 'Term', value: termLabel(ag.start, ag.end), provenance: 'SIM' },
        ]
      : [{ label: 'Assigned slip', value: 'No current agreement', provenance: 'SIM' }],
  };
}

/** Which slip the camera should frame for a selection. An away vessel frames its assigned berth, which stays empty. */
export function frameTarget(fx: Fx, s: S): { slipId: string; via: 'slip' | 'away-vessel' | 'vessel' } | null {
  const sel = s.selection;
  if (!sel) return null;
  if (sel.kind === 'slip') return fx.slips.some((x) => x.id === sel.id) ? { slipId: sel.id, via: 'slip' } : null;
  const ag = activeAgreementForVessel(fx, sel.id);
  if (!ag) return null;
  return { slipId: ag.slipId, via: vesselLocation(fx, s, sel.id).kind === 'departed' ? 'away-vessel' : 'vessel' };
}
