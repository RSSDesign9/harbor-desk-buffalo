/**
 * Deterministic SIM fixture generator (TASKS T05).
 *
 * Pure function: same slips + same seed → byte-identical fixtures. Run via `npm run fixtures`
 * (scripts/generate-fixtures.ts), which writes data/fixtures/*.json. Canonical scenario records
 * (PRD §7) are fixed literals; the wider marina is seeded.
 *
 * Every generated record is SIM. Slip IDs/geometry are ASSUME and are never renumbered here.
 */
import type {
  Actor,
  Agreement,
  CheckpointId,
  DocumentSummary,
  EvidenceAsset,
  FixtureBundle,
  IsoTime,
  LakeSample,
  LakeScenario,
  ModelAssetKey,
  Movement,
  Observation,
  Presence,
  ScenarioDefinition,
  Slip,
  SlipService,
  Source,
  SourceStatusEvent,
  StagedEvidence,
  TransientRequest,
  Verification,
  Vessel,
  VesselType,
} from '../domain/types.ts';

export const FIXTURE_SEED = 'harbor-desk/b12-v1';
/** Second stream (T28): everything added to make the marina a busy July day. The original 46 assignments never draw from it. */
export const JULY_SEED = `${FIXTURE_SEED}/july-day`;
export const SCENARIO_VERSION = 'b12-v1';
/** Fixture creation time (not an event time). */
export const GENERATED_AT: IsoTime = '2026-11-14T00:00:00Z';
const DAY = '2026-07-15';

/** 15 July 2026 is EDT (UTC−4). `hm('09:12')` → '2026-07-15T13:12:00Z'. */
export function hm(local: string, day = DAY): IsoTime {
  const [h, m] = local.split(':').map(Number) as [number, number];
  // Evening hours roll into the next UTC day (20:00 EDT is 00:00Z).
  return new Date(Date.parse(`${day}T00:00:00Z`) + ((h + 4) * 60 + m) * 60000).toISOString().replace('.000Z', 'Z');
}

const CHECKPOINTS: Record<CheckpointId, IsoTime> = {
  normal: hm('08:45'),
  uncertain: hm('09:12'),
  pending_check: hm('09:13'),
  verification_review: hm('09:18'),
  resolved: hm('09:20'),
};

// ---------- seeded randomness ----------
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
/** Opaque, stable ID that encodes nothing about identity. */
export function opaqueId(prefix: string, ...parts: string[]): string {
  let h = hashString([FIXTURE_SEED, ...parts].join('|'));
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += B32[h % B32.length];
    h = Math.floor(h / B32.length) ^ hashString(out + parts.join(''));
    h >>>= 0;
  }
  return `${prefix}-${out}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pad3 = (n: number) => String(n).padStart(3, '0');

// ---------- fixed reference data ----------
const SOURCES: Source[] = [
  { id: 'SRC-OSM', kind: 'osm-dataset', title: 'OpenStreetMap harbor features (Buffalo River mouth, City Ship Canal)', path: 'data/buffalo-river-features.geojson', url: 'https://www.openstreetmap.org/copyright', date: '2026-11-14', provenance: 'DOC', caveats: 'Crowd-sourced; fetched 14 Nov 2026. Documents a source, not current survey accuracy or site ownership. © OpenStreetMap contributors, ODbL.' },
  { id: 'SRC-ESD-MAP', kind: 'official-map', title: 'First Buffalo River Marina site map (ESD operator RFP, Exhibit A)', path: 'data/reference/first-buffalo-site-map-2022.pdf', url: 'https://www.esd.ny.gov/sites/default/files/rfp/Exhibit-A-Site-Map-First-Buffalo-Marina-Operator.pdf', date: '2022-06-01', provenance: 'DOC', caveats: 'Dated site diagram on an aerial photo. Labels do not validate current services or operations.' },
  { id: 'SRC-ESD-SCOPE', kind: 'official-document', title: 'ESD operator RFP, Appendix A — Scope of Services', url: 'https://www.esd.ny.gov/sites/default/files/rfp/Appendix-A-Scope-of-Services-First-Buffalo-Marina-Operator.pdf', date: null, provenance: 'DOC', caveats: 'Publication date not recorded in this build. Supports registry/records as plausible workflows; does not establish current software or policies.' },
  { id: 'SRC-SLIPS', kind: 'generated-layout', title: 'Assumed slip plan: 126 slips, docks A–E', path: 'data/slips.geojson', date: '2026-11-14', provenance: 'ASSUME', caveats: 'Generated on OSM headwalks. Count, numbering and length classes are design assumptions, not marina capacity.' },
  { id: 'SRC-SITE-LOCAL', kind: 'derived-geometry', title: 'Local-frame geometry, land masks and approximate surroundings', path: 'data/derived/site-local.json', date: '2026-11-14', provenance: 'ASSUME', caveats: 'Derived by scripts/inspect-geometry.ts. Approximate; see data/GEOMETRY-VALIDATION.md.' },
  { id: 'C-01', kind: 'sim-camera', title: 'Simulated camera C-01 (Dock A)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier. Not an installed camera or a validated field of view.' },
  { id: 'C-02', kind: 'sim-camera', title: 'Simulated camera C-02 (Dock B, B-01…B-19)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier. Not an installed camera or a validated field of view.' },
  { id: 'C-03', kind: 'sim-camera', title: 'Simulated camera C-03 (Dock B, B-20…B-37, and Dock D)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier. Not an installed camera or a validated field of view.' },
  { id: 'C-04', kind: 'sim-camera', title: 'Simulated camera C-04 (Dock C, C-01…C-09)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier; the one camera scripted offline, from 07:05, to exercise stale-data handling.' },
  { id: 'C-05', kind: 'sim-camera', title: 'Simulated camera C-05 (Dock C, C-10…C-18)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier. Not an installed camera or a validated field of view.' },
  { id: 'C-06', kind: 'sim-camera', title: 'Simulated camera C-06 (Dock E)', date: '2026-11-14', provenance: 'SIM', caveats: 'Simulated camera identifier. Not an installed camera or a validated field of view.' },
  { id: 'SRC-RATES', kind: 'assumed-rates', title: 'Assumed dockage rates: seasonal $/ft by dock, transient $2.50/ft/night', date: '2026-11-16', provenance: 'ASSUME', caveats: 'Round numbers set for the demo, priced on the slip length class. Not a Buffalo rate card, a quote or a market survey.' },
  { id: 'SRC-SERVICES', kind: 'assumed-services', title: 'Assumed berth depth and shore power', date: '2026-11-16', provenance: 'ASSUME', caveats: 'Round demo numbers: deeper at the start of each dock run, about 1.5 ft shallower at its far end; 50 A outlets on slips of 35 ft and over, 30 A everywhere. Not a survey, soundings or a utility plan. Fit verdicts built on them are illustrations, not berth-fit or navigation advice.' },
  { id: 'SRC-LAKE', kind: 'assumed-lake', title: 'Simulated lake conditions: calm day and SW gale with seiche', date: '2026-11-16', provenance: 'ASSUME', caveats: 'Shapes chosen to illustrate a wind setup at the east end of Lake Erie and the slosh that follows (a 14 h period and the amplitudes are demo values), plus berth exposure and fixed-deck heights by dock. Not a NOAA gauge record, an NWS forecast or a survey. Verdicts built on them are illustrations, not navigation or berth-fit advice.' },
  { id: 'SRC-NWS-MARINE', kind: 'official-guide', title: 'NWS, Marine Weather Services: Great Lakes (NOAA PA 98053)', url: 'https://www.weather.gov/media/owlie/mw_lakes.pdf', date: null, provenance: 'DOC', caveats: 'Publication date not recorded in this build. Defines a Gale Warning as forecast winds of 34 to 47 knots, the exposure no-fit line used here. It gives no numeric small craft threshold, so the 20 kt tight line is an assumption.' },
  { id: 'STAFF-LOG', kind: 'sim-staff-log', title: 'Simulated staff movement log', date: '2026-11-14', provenance: 'SIM', caveats: 'Fictional departures and arrivals.' },
  { id: 'STAFF-CHECK', kind: 'sim-staff-check', title: 'Simulated staff dock walks and dock checks', date: '2026-11-14', provenance: 'SIM', caveats: 'Fictional staff identity checks, including “verified” demo decisions.' },
];

const ACTORS: Actor[] = [
  { id: 'ACT-DOCKMASTER', label: 'Demo dockmaster', role: 'dockmaster', provenance: 'SIM' },
  { id: 'ACT-STAFF', label: 'Demo dock staff', role: 'dock-staff', provenance: 'SIM' },
  { id: 'ACT-SYSTEM', label: 'Harbor Desk (simulated rules)', role: 'system', provenance: 'SIM' },
];

const NAMES = [
  'North Light', 'Breakwall', 'Erie Glass', 'Second Wind', 'Halcyon', 'Kestrel', 'Blue Heron', 'Driftwood', 'Sandpiper',
  'Seiche', 'Grain Line', 'Low Pressure', 'Tern', 'Meridian', 'Slow Current', 'Bluewater', 'Westerly', 'Fair Weather',
  'Night Heron', 'Long Pier', 'Pennant', 'Cormorant', 'Gray Lady', 'Freshwater', 'Easy Does It', 'Sundown', 'Shoal Draft',
  'Clear Sky', 'Stillwater', 'Marigold', 'Osprey', 'Second Shift', 'Silver Lining', 'Lake Song', 'Quiet Hour', 'Windward',
  'Starboard Light', 'Tailwind', 'Morning Watch', 'Small Craft', 'Ballast', 'Undertow', 'Whitecap', 'Lee Shore', 'Canal Days',
];

/** Names for the 65 vessels added in T28. None repeats NAMES. */
const NAMES_JULY = [
  'Lakeshore', 'Two Bells', 'Bright Water', 'Pelican Run', 'Old Harbor', 'Amber Light', 'Slack Tide', 'Wanderer', 'Kingfisher', 'Gull Rock',
  'Saltless', 'First Mate', 'Evening Star', 'Cattail', 'Maple Leaf', 'Barn Swallow', 'Low Water', 'Iron Bell', 'Commodore', 'Foxglove',
  'Salt Cellar', 'Yarrow', 'Lightship', 'Blue Hour', 'Little Egret', 'Granite', 'Pine Barrens', 'Sea Legs', 'Moonrise', 'Fiddlehead',
  'Harvest', 'Cobalt', 'Wild Rice', 'Tin Roof', 'Skipper', 'Plover', 'Bell Buoy', 'Open Water', 'Copper Kettle', 'Larkspur',
  'Dune Grass', 'Steady On', 'Willow', 'Grain Barge', 'Chickadee', 'North Star', 'Quarter Deck', 'Mist Net', 'Sweet Water', 'Reed Warbler',
  'High Stakes', 'Blackbird', 'Tamarack', 'Fair Haven', 'Lazy Susan', 'Cirrus', 'Rowan', 'Dockside', 'Bay Leaf', 'Heron Point',
  'Sparrow', 'Anchor Light', 'Goldeneye', 'Last Light', 'Spindrift',
];

/** One camera per stretch of dock; C-04 is the only one scripted offline (T28). */
const CAMERA_FOR = (slip: Slip): string =>
  slip.dock === 'A' ? 'C-01' : slip.dock === 'B' ? (slip.number <= 19 ? 'C-02' : 'C-03') : slip.dock === 'D' ? 'C-03' : slip.dock === 'C' ? (slip.number <= 9 ? 'C-04' : 'C-05') : 'C-06';

/** Assumed dockage (SRC-RATES): seasonal $/ft of slip length class by dock, and one nightly $/ft for transients. */
const SEASON_USD_PER_FT: Record<string, number> = { A: 82, B: 96, C: 108, D: 118, E: 128 };
const NIGHT_USD_PER_FT = 2.5;
const rateFor = (slip: Slip, type: 'seasonal' | 'transient') =>
  type === 'seasonal' ? { rateUsd: Math.round(slip.length_ft * SEASON_USD_PER_FT[slip.dock]!), rateBasis: 'season' as const } : { rateUsd: Math.round(slip.length_ft * NIGHT_USD_PER_FT), rateBasis: 'night' as const };
const RATE_PROVENANCE = { rateUsd: 'ASSUME', rateBasis: 'ASSUME' } as const;

/** Slips kept vacant on the July day: A-02 and B-30 (scenario tests rely on them) plus C-05 (offline view), then 12 seeded. */
const PINNED_VACANT = ['A-02', 'B-30', 'C-05'];
const VACANT_TOTAL = 15; // 126 − 15 = 111 held → 88%
const NO_VACANT_ZONE = new Set(Array.from({ length: 9 }, (_, i) => `B-${String(i + 8).padStart(2, '0')}`)); // B-08…B-16: the scenario neighbourhood stays held
const TRANSIENTS_ADDED = 20;
const OUTINGS_ADDED = 16;

const SLIP_ORDER = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Assigned slips by agreement type (ASSUME distribution; see BUILD-LOG T05). */
const SEASONAL_SLIPS = [
  'A-03', 'A-05', 'A-08', 'A-11', 'A-14', 'A-19', 'A-24', 'A-30',
  ...Array.from({ length: 14 }, (_, i) => `B-${String(i + 5).padStart(2, '0')}`), // B-05…B-18
  'B-22', 'B-23', 'B-24', 'B-25', 'B-26', 'B-27',
  'C-02', 'C-04', 'C-07', 'C-11', 'C-15',
  'D-02', 'D-05', 'D-06', 'D-09', 'D-13', 'D-17', 'D-20',
  'E-02', 'E-04', 'E-07', 'E-09',
];
const TRANSIENT_SLIPS = ['A-36', 'A-37'];

interface Canon {
  vessel: Omit<Vessel, 'provenance' | 'generated_at'>;
  slipId: string;
}
const CANONICAL: Canon[] = [
  {
    slipId: 'B-12',
    vessel: { id: 'V-021', name: 'Lake Effect', type: 'cabin-cruiser', modelAssetKey: 'cruiser', loa_ft: 29, beam_ft: 10.3, draft_ft: 2.9, owner: { id: 'O-021', kind: 'individual', label: 'Private owner O-021' }, registrationSuffix: '42 AB', documentationRef: null, hinMasked: null, hullColor: 'white', canvasColor: 'navy' },
  },
  {
    slipId: 'B-14',
    vessel: { id: 'V-022', name: 'Harbor Light', type: 'cabin-cruiser', modelAssetKey: 'cruiser', loa_ft: 27, beam_ft: 9.6, draft_ft: 2.8, owner: { id: 'O-022', kind: 'individual', label: 'Private owner O-022' }, registrationSuffix: '83 KD', documentationRef: null, hinMasked: null, hullColor: 'white', canvasColor: 'navy' },
  },
  {
    slipId: 'B-10',
    vessel: { id: 'V-023', name: 'River Run', type: 'center-console', modelAssetKey: 'console', loa_ft: 24, beam_ft: 8.5, draft_ft: 1.6, owner: { id: 'O-023', kind: 'individual', label: 'Private owner O-023' }, registrationSuffix: '05 RT', documentationRef: null, hinMasked: 'HIN ••••••••B626', hullColor: 'white', canvasColor: 'none' },
  },
];

const TYPE_BY_DOCK: Record<string, { types: VesselType[]; min: number }> = {
  A: { types: ['runabout', 'center-console', 'sailboat'], min: 18 },
  B: { types: ['cabin-cruiser', 'center-console', 'sailboat'], min: 22 },
  C: { types: ['cabin-cruiser', 'sailboat'], min: 30 },
  D: { types: ['cabin-cruiser', 'sailboat'], min: 34 },
  E: { types: ['cabin-cruiser', 'sailboat'], min: 38 },
};
const ASSET: Record<VesselType, ModelAssetKey> = { 'cabin-cruiser': 'cruiser', 'center-console': 'console', runabout: 'console', sailboat: 'sail' };
const BEAM_RATIO: Record<VesselType, number> = { 'cabin-cruiser': 0.34, 'center-console': 0.35, runabout: 0.37, sailboat: 0.33 };

function mkRng(seed: number) {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return { rand, pick, between, shuffle };
}
type Rng = ReturnType<typeof mkRng>;

/** Local clock minutes on the scenario day → UTC ISO, rounded to 5 minutes. */
const atMinute = (min: number, day = DAY) => {
  const m = Math.round(min / 5) * 5;
  return hm(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, day);
};
const minutesOf = (utc: IsoTime) => Math.round((Date.parse(utc) - Date.parse(hm('00:00'))) / 60000);

export function generateFixtures(slips: readonly Slip[]): FixtureBundle {
  const R0 = mkRng(hashString(FIXTURE_SEED)); // the original stream: the first 46 assignments, their documents, the morning's departures
  const R1 = mkRng(hashString(JULY_SEED)); // the busy July day (T28)
  const { rand, pick } = R0;
  const slipById = new Map(slips.map((s) => [s.id, s]));
  const need = (id: string) => {
    const s = slipById.get(id);
    if (!s) throw new Error(`Fixture generator: slip ${id} missing from slips.geojson`);
    return s;
  };
  const provenance = 'SIM' as const;

  // ----- vessels -----
  const assignments: { slipId: string; vesselId: string; type: 'seasonal' | 'transient' }[] = [];
  const vessels: Vessel[] = CANONICAL.map((c) => ({ ...c.vessel, provenance, generated_at: GENERATED_AT }));
  for (const c of CANONICAL) assignments.push({ slipId: c.slipId, vesselId: c.vessel.id, type: 'seasonal' });

  const canonicalSlips = new Set(CANONICAL.map((c) => c.slipId));
  const freeIds = Array.from({ length: 48 }, (_, i) => `V-${pad3(i + 1)}`).filter((id) => !CANONICAL.some((c) => c.vessel.id === id));
  const toAssign = [
    ...SEASONAL_SLIPS.filter((s) => !canonicalSlips.has(s)).map((s) => ({ slipId: s, type: 'seasonal' as const })),
    ...TRANSIENT_SLIPS.map((s) => ({ slipId: s, type: 'transient' as const })),
  ];
  const makeVessel = (R: Rng, id: string, name: string, dock: string, maxLen: number, maxBeam: number): Vessel => {
    const cls = TYPE_BY_DOCK[dock]!;
    const type = R.pick(cls.types);
    const loa = Math.round(R.between(cls.min, maxLen));
    const beam = Math.min(r1(loa * BEAM_RATIO[type] + R.between(-0.3, 0.4)), r1(maxBeam));
    const draftBase = type === 'sailboat' ? loa * 0.14 : type === 'cabin-cruiser' ? 2.6 + (loa - 26) * 0.06 : type === 'center-console' ? 1.5 : 1.3;
    const draft = R.rand() < 0.12 ? null : r1(draftBase + R.between(-0.2, 0.3));
    const documented = loa >= 34 && R.rand() < 0.5;
    const suffix = `${String(Math.floor(R.rand() * 90) + 10)} ${B32[Math.floor(R.rand() * 22)]}${B32[Math.floor(R.rand() * 22)]}`;
    const num = Number(id.slice(2));
    return {
      id,
      name,
      type,
      modelAssetKey: ASSET[type],
      loa_ft: loa,
      beam_ft: R.rand() < 0.06 ? null : beam,
      draft_ft: draft,
      owner: R.rand() < 0.15 ? { id: `O-${pad3(num)}`, kind: 'organization', label: `Fictional organization O-${pad3(num)}` } : { id: `O-${pad3(num)}`, kind: 'individual', label: `Private owner O-${pad3(num)}` },
      registrationSuffix: documented ? null : suffix,
      documentationRef: documented ? `DOC ••••${Math.floor(R.rand() * 900) + 100}` : null,
      hinMasked: R.rand() < 0.3 ? `HIN ••••••••${B32[Math.floor(R.rand() * 22)]}${Math.floor(R.rand() * 900) + 100}` : null,
      hullColor: R.pick(['white', 'white', 'white', 'white', 'white', 'white', 'white', 'slate', 'forest', 'rust'] as const), // v2: mostly white gelcoat
      canvasColor: type === 'runabout' || type === 'center-console' ? R.pick(['none', 'navy', 'sand'] as const) : R.pick(['navy', 'sand'] as const),
      provenance,
      generated_at: GENERATED_AT,
    };
  };
  let nameIdx = 0;
  toAssign.forEach((a, i) => {
    const slip = need(a.slipId);
    const v = makeVessel(R0, freeIds[i]!, NAMES[nameIdx++]!, slip.dock, slip.length_ft, slip.width_ft - 1.5);
    vessels.push(v);
    assignments.push({ slipId: a.slipId, vesselId: v.id, type: a.type });
  });
  // Two vessels with no current slip agreement (e.g. on a waiting list or in storage elsewhere): V-047 and V-048.
  for (const id of freeIds.slice(toAssign.length)) vessels.push(makeVessel(R0, id, NAMES[nameIdx++]!, 'B', 28, 10));
  vessels.sort((a, b) => a.id.localeCompare(b.id));

  // ----- agreements (the original 46) -----
  const slipOf = (id: string) => need(id);
  const agreementFor = (id: string, a: { slipId: string; vesselId: string; type: 'seasonal' | 'transient' }, start: string, end: string): Agreement => ({
    id,
    vesselId: a.vesselId,
    slipId: a.slipId,
    type: a.type,
    start,
    end,
    status: 'active',
    ...rateFor(slipOf(a.slipId), a.type),
    provenance,
    fieldProvenance: RATE_PROVENANCE,
  });
  const agreements: Agreement[] = assignments
    .slice()
    .sort((a, b) => a.vesselId.localeCompare(b.vesselId))
    .map((a, i) => agreementFor(`AGR-${pad3(i + 1)}`, a, a.type === 'seasonal' ? '2026-05-01' : a.slipId === 'A-36' ? '2026-07-14' : '2026-07-15', a.type === 'seasonal' ? '2026-10-15' : '2026-07-17'));

  // ----- documents -----
  const documents: DocumentSummary[] = [];
  const documentsFor = (R: Rng, list: readonly Vessel[]) => {
    for (const v of list) {
      const canonical = CANONICAL.some((c) => c.vessel.id === v.id);
      const primary = v.documentationRef ? 'documentation' : 'registration';
      const state = canonical ? 'reviewed' : R.rand() < 0.85 ? 'reviewed' : 'pending_review';
      documents.push({
        id: `DOCREC-${v.id}-1`,
        vesselId: v.id,
        docType: primary,
        maskedReference: primary === 'registration' ? (v.registrationSuffix ? `ending ${v.registrationSuffix}` : null) : v.documentationRef,
        reviewState: state,
        reviewedOn: state === 'reviewed' ? `2026-0${4 + Math.floor(R.rand() * 3)}-${String(1 + Math.floor(R.rand() * 28)).padStart(2, '0')}` : null,
        expiresOn: null,
        provenance,
      });
      const insState = canonical ? 'reviewed' : R.rand() < 0.75 ? 'reviewed' : R.rand() < 0.6 ? 'pending_review' : 'not_recorded';
      documents.push({
        id: `DOCREC-${v.id}-2`,
        vesselId: v.id,
        docType: 'insurance',
        maskedReference: insState === 'not_recorded' ? null : `POL ••••${Math.floor(R.rand() * 9000) + 1000}`,
        reviewState: insState,
        reviewedOn: insState === 'reviewed' ? `2026-0${4 + Math.floor(R.rand() * 3)}-${String(1 + Math.floor(R.rand() * 28)).padStart(2, '0')}` : null,
        expiresOn: insState === 'not_recorded' ? null : `2027-0${4 + Math.floor(R.rand() * 3)}-30`,
        provenance,
      });
    }
  };
  documentsFor(R0, vessels);

  // ----- movements: the morning's departures (original) -----
  const assignedByVessel = new Map(assignments.map((a) => [a.vesselId, a]));
  const movements: Movement[] = [];
  const departures: { vesselId: string; at: IsoTime }[] = [
    { vesselId: 'V-021', at: hm('08:10') },
    { vesselId: 'V-022', at: hm('08:30') },
  ];
  const awayPool = assignments.filter((a) => a.type === 'seasonal' && !canonicalSlips.has(a.slipId) && ['A', 'B', 'D'].includes(a.slipId[0]!));
  const awayTimes = ['06:45', '07:05', '07:50', '08:05', '08:20'];
  const chosen = new Set<string>();
  while (chosen.size < awayTimes.length) chosen.add(pick(awayPool).vesselId);
  [...chosen].sort().forEach((vesselId, i) => departures.push({ vesselId, at: hm(awayTimes[i]!) }));
  departures
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((d, i) =>
      movements.push({ id: `MOV-${pad3(i + 1)}`, vesselId: d.vesselId, slipId: assignedByVessel.get(d.vesselId)!.slipId, kind: 'departure', at: d.at, trip: 'outing', expectedReturnAt: null, sourceId: 'STAFF-LOG', actorId: 'ACT-STAFF', provenance }),
    );
  for (const a of assignments.filter((x) => x.type === 'transient')) {
    movements.push({ id: `MOV-${pad3(movements.length + 1)}`, vesselId: a.vesselId, slipId: a.slipId, kind: 'arrival', at: a.slipId === 'A-36' ? '2026-07-14T20:30:00Z' : hm('07:40'), trip: 'stay', expectedReturnAt: null, sourceId: 'STAFF-LOG', actorId: 'ACT-STAFF', provenance });
  }

  // ===== T28: the busy July day, from the second stream =====
  const baseTaken = new Set(assignments.map((a) => a.slipId));
  const freeSlips = slips.map((s) => s.id).filter((id) => !baseTaken.has(id));
  for (const id of PINNED_VACANT) if (!freeSlips.includes(id)) throw new Error(`Fixture generator: pinned vacant slip ${id} is already assigned`);
  const vacant = new Set([...PINNED_VACANT, ...R1.shuffle(freeSlips.filter((id) => !PINNED_VACANT.includes(id) && !NO_VACANT_ZONE.has(id))).slice(0, VACANT_TOTAL - PINNED_VACANT.length)]);
  const fillSlips = freeSlips.filter((id) => !vacant.has(id)).sort(SLIP_ORDER); // 65
  const transientSet = new Set(R1.shuffle(fillSlips).slice(0, TRANSIENTS_ADDED));
  const extNames = R1.shuffle(NAMES_JULY);
  const extAssignments: typeof assignments = [];
  const extVessels: Vessel[] = [];
  fillSlips.forEach((slipId, i) => {
    const slip = need(slipId);
    const v = makeVessel(R1, `V-${pad3(49 + i)}`, extNames[i]!, slip.dock, slip.length_ft, slip.width_ft - 1.5);
    extVessels.push(v);
    extAssignments.push({ slipId, vesselId: v.id, type: transientSet.has(slipId) ? 'transient' : 'seasonal' });
  });
  vessels.push(...extVessels);
  documentsFor(R1, extVessels);

  // Stays: 6 transients checked in on the 13th or 14th, the rest arrive through today (07:00–21:40; two before the 08:45 start).
  const extTransients = extAssignments.filter((a) => a.type === 'transient');
  const earlier = extTransients.slice(0, 6);
  const today = extTransients.slice(6);
  const arrivalMin = today.map((_, i) => (i < 2 ? R1.between(425, 520) : R1.between(560, 1300))).sort((a, b) => a - b);
  const stayEnd = (): string => `2026-07-${String(16 + Math.floor(R1.rand() * 4))}`;
  const extAgreements: Agreement[] = [];
  const arrivalAt = new Map<string, IsoTime>();
  earlier.forEach((a, i) => {
    const day = i % 2 === 0 ? '2026-07-13' : '2026-07-14';
    const at = `${day}T${String(17 + Math.floor(R1.rand() * 4)).padStart(2, '0')}:${String(Math.floor(R1.rand() * 12) * 5).padStart(2, '0')}:00Z`;
    arrivalAt.set(a.vesselId, at);
    extAgreements.push(agreementFor('', a, day, stayEnd()));
  });
  today.forEach((a, i) => {
    arrivalAt.set(a.vesselId, atMinute(arrivalMin[i]!));
    extAgreements.push(agreementFor('', a, DAY, stayEnd()));
  });
  for (const a of extAssignments.filter((x) => x.type === 'seasonal')) extAgreements.push(agreementFor('', a, '2026-05-01', '2026-10-15'));
  // AGR-047 onward, in vessel order, so the original AGR-001…046 keep their numbers.
  extAgreements.sort((a, b) => a.vesselId.localeCompare(b.vesselId)).forEach((a) => agreements.push({ ...a, id: `AGR-${pad3(agreements.length + 1)}` }));
  const extMovements: Movement[] = [];
  const addMove = (m: Omit<Movement, 'id' | 'sourceId' | 'actorId' | 'provenance'>) => extMovements.push({ ...m, id: '', sourceId: 'STAFF-LOG', actorId: 'ACT-STAFF', provenance });
  for (const a of extTransients) addMove({ vesselId: a.vesselId, slipId: a.slipId, kind: 'arrival', at: arrivalAt.get(a.vesselId)!, trip: 'stay', expectedReturnAt: null });

  // Outings: seasonal boats on day trips, with the away flag (expected return) on the departure. Some are out before 08:45, most leave later.
  const outings = R1.shuffle(extAssignments.filter((a) => a.type === 'seasonal')).slice(0, OUTINGS_ADDED);
  const overnight = new Set(outings.slice(-3).map((o) => o.vesselId)); // out for the night, back tomorrow
  outings.forEach((o, i) => {
    const early = i < 6;
    const depMin = early ? R1.between(365, 515) : R1.between(580, 1050);
    const dep = atMinute(depMin);
    if (overnight.has(o.vesselId) && !early) {
      addMove({ vesselId: o.vesselId, slipId: o.slipId, kind: 'departure', at: dep, trip: 'outing', expectedReturnAt: hm('12:00', '2026-07-16') });
      return;
    }
    const retMin = Math.min(minutesOf(dep) + R1.between(100, 320), 21 * 60 + 55);
    const ret = atMinute(retMin);
    // Expected return is the plan, rounded to the half hour, so it differs a little from what actually happens.
    const planned = atMinute(Math.round(retMin / 30) * 30 + (R1.rand() < 0.5 ? 0 : 30));
    addMove({ vesselId: o.vesselId, slipId: o.slipId, kind: 'departure', at: dep, trip: 'outing', expectedReturnAt: planned > dep ? planned : ret });
    addMove({ vesselId: o.vesselId, slipId: o.slipId, kind: 'arrival', at: ret, trip: 'outing', expectedReturnAt: null });
  });
  // The morning's five original day-boats are back by afternoon; Lake Effect and Harbor Light stay out (scenario).
  const originalDayBoats = movements.filter((m) => m.kind === 'departure' && !canonicalSlips.has(m.slipId) && m.trip === 'outing');
  for (const dep of originalDayBoats) {
    const retMin = R1.between(13 * 60 + 30, 18 * 60 + 30);
    const ret = atMinute(retMin);
    (dep as { expectedReturnAt: IsoTime | null }).expectedReturnAt = atMinute(Math.round(retMin / 30) * 30);
    addMove({ vesselId: dep.vesselId, slipId: dep.slipId, kind: 'arrival', at: ret, trip: 'outing', expectedReturnAt: null });
  }
  extMovements.sort((a, b) => a.at.localeCompare(b.at) || a.vesselId.localeCompare(b.vesselId));
  extMovements.forEach((m) => movements.push({ ...m, id: `MOV-${pad3(movements.length + 1)}` }));
  vessels.sort((a, b) => a.id.localeCompare(b.id));

  const allAssignments = [...assignments, ...extAssignments];
  const heldSlips = new Set(allAssignments.map((a) => a.slipId));
  const movementsBySlip = new Map<string, Movement[]>();
  for (const m of movements) (movementsBySlip.get(m.slipId) ?? movementsBySlip.set(m.slipId, []).get(m.slipId)!).push(m);
  for (const list of movementsBySlip.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  /** Is the assigned boat physically at the slip at time t? Built from the movement log, never stored separately. */
  const isPresent = (slipId: string, t: IsoTime): boolean => {
    if (!heldSlips.has(slipId)) return false;
    const events = movementsBySlip.get(slipId) ?? [];
    const upTo = events.filter((m) => m.at <= t);
    if (upTo.length) return upTo[upTo.length - 1]!.kind === 'arrival';
    return events.length === 0 || events[0]!.kind === 'departure'; // nothing logged yet: there from before, unless its first event is an arrival
  };

  // ----- staff verifications: 07:30 dock walk, River Run at 08:40 -----
  const verifications: Verification[] = [];
  const walk = hm('07:30');
  const walkFor = (list: typeof assignments) => {
    for (const a of list.slice().sort((x, y) => SLIP_ORDER(x.slipId, y.slipId))) {
      if (!isPresent(a.slipId, walk)) continue;
      verifications.push({ id: `VER-${pad3(verifications.length + 1)}`, slipId: a.slipId, verifiedVesselId: a.vesselId, checkedAt: walk, actorId: 'ACT-STAFF', method: 'staff-dock-walk', evidenceSummary: 'Morning dock walk: name board and registration read at the slip.', evidenceAssetId: null, sourceId: 'STAFF-CHECK', provenance });
    }
  };
  walkFor(assignments);
  verifications.push({ id: `VER-${pad3(verifications.length + 1)}`, slipId: 'B-10', verifiedVesselId: 'V-023', checkedAt: hm('08:40'), actorId: 'ACT-STAFF', method: 'staff-dock-walk', evidenceSummary: 'Staff observation: River Run present at B-10.', evidenceAssetId: null, sourceId: 'STAFF-CHECK', provenance });
  walkFor(extAssignments);

  // ----- camera observations -----
  const observations: Observation[] = [];
  // T31: the first round is at 06:00 (was 06:50) so the day timeline opens on camera readings.
  const samples = ['06:00', '08:45', '09:12', '09:18'].map((t) => hm(t));
  const glare = new Set(['B-24@08:45', 'D-06@08:45']);
  const scenarioCandidateObs = opaqueId('OBS', 'B-12', hm('09:12'));
  for (const slip of slips) {
    const camera = CAMERA_FOR(slip);
    for (const t of samples) {
      if (camera === 'C-04' && t !== samples[0]) continue; // C-04 is offline from 07:05
      let presence: Presence = isPresent(slip.id, t) ? 'present' : 'empty';
      let candidates: string[] = [];
      let reason: string | null = null;
      let evidence: string | null = null;
      if (slip.id === 'B-12' && t >= hm('09:12')) {
        presence = 'present';
        if (t === hm('09:12')) {
          candidates = ['V-022'];
          reason = 'Name obscured. Canvas cover differs from the cover on record for the assigned vessel; hull profile resembles another cabin cruiser.';
          evidence = 'ev-7k2q';
        } else {
          reason = 'Vessel present; name still not legible.';
        }
      }
      if (t === hm('08:45') && glare.has(`${slip.id}@08:45`)) {
        presence = 'unknown';
        reason = 'View obstructed by glare.';
      }
      const offset = 4 + Math.floor(rand() * 17);
      observations.push({
        id: slip.id === 'B-12' && t === hm('09:12') ? scenarioCandidateObs : opaqueId('OBS', slip.id, t),
        slipId: slip.id,
        sourceId: camera,
        observedAt: t,
        receivedAt: new Date(Date.parse(t) + offset * 1000).toISOString().replace('.000Z', 'Z'),
        presence,
        candidateVesselIds: candidates,
        reason,
        evidenceAssetId: evidence,
        provenance,
      });
    }
  }
  observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.slipId.localeCompare(b.slipId, 'en', { numeric: true }));

  const sourceStatus: SourceStatusEvent[] = [
    { id: 'SST-001', sourceId: 'C-04', status: 'offline', at: hm('07:05'), provenance },
  ];

  const stagedEvidence: StagedEvidence[] = [
    { id: 'EV-WALK-0910', kind: 'dock-walk-mark', slipId: 'B-12', capturedAt: hm('09:10'), sourceId: 'STAFF-CHECK', actorId: 'ACT-STAFF', verifiedVesselId: null, summary: 'Marked Occupied on the morning dock walk; Lake Effect departed 08:10.', assetId: null, altText: 'Text-only dock-walk entry for B-12. No image was taken.', provenance },
    { id: 'EV-C02-0912', kind: 'camera-frame', slipId: 'B-12', capturedAt: hm('09:12'), sourceId: 'C-02', actorId: null, verifiedVesselId: null, summary: 'Cabin cruiser present at the slip. Stern name not legible; canvas cover differs from the cover on record for the assigned vessel.', assetId: 'ev-7k2q', altText: 'Simulated camera frame from C-02 at 09:12: an elevated view along Dock B with a cabin cruiser under a tan canvas cover in the slip; no name is legible.', provenance },
    { id: 'EV-STAFF-0918', kind: 'staff-dock-check', slipId: 'B-12', capturedAt: hm('09:18'), sourceId: 'STAFF-CHECK', actorId: 'ACT-STAFF', verifiedVesselId: 'V-021', summary: 'Boat name and registration ending 42 AB match Lake Effect. A new canvas cover explains the visual difference.', assetId: 'ev-p3m8', altText: 'Simulated staff photos at 09:18: the transom name board and the bow registration panel, which shows only the suffix.', provenance },
  ];
  const evidenceAssets: EvidenceAsset[] = [
    { id: 'ev-7k2q', path: 'assets/evidence/ev-7k2q.webp', status: 'available', provenance },
    { id: 'ev-p3m8', path: 'assets/evidence/ev-p3m8.webp', status: 'available', provenance },
  ];

  const scenario: ScenarioDefinition = {
    scenarioVersion: SCENARIO_VERSION,
    seed: FIXTURE_SEED,
    date: DAY,
    timeZone: 'America/New_York',
    slipId: 'B-12',
    assignedVesselId: 'V-021',
    candidateVesselId: 'V-022',
    neighbourVesselId: 'V-023',
    uncertainObservationId: scenarioCandidateObs,
    staffEvidenceId: 'EV-STAFF-0918',
    cameraEvidenceId: 'EV-C02-0912',
    dockWalkEvidenceId: 'EV-WALK-0910',
    demoActorId: 'ACT-DOCKMASTER',
    checkpoints: CHECKPOINTS,
    cameraFreshMinutes: 5,
    staffFreshMinutes: 60,
    cameraSweep: { everyMinutes: 5, windows: [[hm('06:00'), hm('08:40')], [hm('09:25'), hm('22:05')]] },
    provenance,
  };

  // ----- T30: assumed berth services (ASSUME) and one incoming transient request (SIM) -----
  const DEPTH_BASE_FT: Record<string, number> = { A: 9, B: 8, C: 6.5, D: 7, E: 10 };
  /** T35 (ASSUME): fixed-deck height above still water. */
  const FREEBOARD_FT: Record<string, number> = { A: 3.5, E: 4 };
  const dockCount = (d: string) => slips.filter((x) => x.dock === d).length;
  const slipServices: SlipService[] = slips.map((sl) => ({
    id: `SVC-${sl.id}`,
    slipId: sl.id,
    depth_ft: Math.round((DEPTH_BASE_FT[sl.dock]! - (1.5 * (sl.number - 1)) / Math.max(1, dockCount(sl.dock) - 1)) * 2) / 2,
    shorePowerA: sl.length_ft >= 35 ? [30, 50] : [30],
    // T35: Dock A and B-01…B-19 face the river mouth; the rest lie in the City Ship Canal (GEOMETRY-VALIDATION).
    exposure: sl.dock === 'A' || (sl.dock === 'B' && sl.number <= 19) ? 'open' : 'sheltered',
    deckFreeboard_ft: sl.dock_kind === 'fixed' ? (FREEBOARD_FT[sl.dock] ?? 3.5) : null,
    basis: 'SRC-SERVICES: round demo numbers by dock and position along the run. SRC-LAKE: exposure and fixed-deck height.',
    provenance: 'ASSUME',
  }));
  const transientRequests: TransientRequest[] = [
    {
      id: 'REQ-001', vesselName: 'Northern Tern', type: 'cabin-cruiser', modelAssetKey: 'cruiser',
      loa_ft: 36, beam_ft: 11.5, draft_ft: 4.5, powerA: 50,
      receivedAt: hm('08:30'), arrivalFrom: hm('16:00'), arrivalTo: hm('18:00'), nights: 2,
      hullColor: 'white', canvasColor: 'navy', provenance,
    },
  ];

  return {
    generated_at: GENERATED_AT,
    sources: SOURCES,
    actors: ACTORS,
    slips,
    vessels,
    agreements,
    documents,
    observations,
    movements,
    verifications,
    sourceStatus,
    stagedEvidence,
    evidenceAssets,
    slipServices,
    transientRequests,
    lakeScenarios: lakeScenarios(),
    scenario,
  };
}

// ---------- T35: lake what-ifs (SIM, shapes ASSUME via SRC-LAKE) ----------
/** Series from 06:00 on the scenario day for 60 h (to 18:00 two days later, past the longest demo stay), every 15 min. */
export const LAKE_START = hm('06:00');
export const LAKE_HOURS = 60;
export const LAKE_STEP_MIN = 15;
/** Seiche period chosen for the demo (ASSUME). */
export const SEICHE_PERIOD_H = 14;

/** Piecewise-linear keyframes [hour, value]. */
const keyed = (keys: readonly (readonly [number, number])[], h: number) => {
  if (h <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [h1, v1] = keys[i]!;
    const [h0, v0] = keys[i - 1]!;
    if (h <= h1) return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
  }
  return keys[keys.length - 1]![1];
};

function lakeScenarios(): LakeScenario[] {
  const at = (h: number) => new Date(Date.parse(LAKE_START) + h * 3600000).toISOString().replace('.000Z', 'Z');
  const series = (f: (h: number) => Omit<LakeSample, 'at'>) =>
    Array.from({ length: (LAKE_HOURS * 60) / LAKE_STEP_MIN + 1 }, (_, i) => {
      const h = (i * LAKE_STEP_MIN) / 60;
      const v = f(h);
      return { at: at(h), level_ft: r1(v.level_ft) + 0, windFromDeg: Math.round(v.windFromDeg / 5) * 5 % 360, wind_kt: Math.round(v.wind_kt), gust_kt: Math.round(v.gust_kt) };
    });

  // Calm July day: a light south-east breeze, an afternoon lake breeze from the south-west, and a level that only
  // rises a little in the afternoon. It never drops below still water, so the T30 verdicts hold exactly.
  const calm = series((h) => {
    const wind = keyed([[0, 5], [4, 7], [7, 10], [12, 11], [15, 6], [18, 4], [60, 5]], h);
    const dir = keyed([[0, 150], [5, 170], [7, 230], [12, 245], [15, 190], [60, 180]], h);
    const swell = h > 4 && h < 16 ? Math.sin((Math.PI * (h - 4)) / 12) ** 2 : 0;
    return { level_ft: 0.2 * swell, windFromDeg: dir, wind_kt: wind, gust_kt: wind * 1.3 };
  });

  // SW gale: the wind has been building overnight along the lake's long axis and peaks through the morning,
  // piling water up at the Buffalo end; when it eases after 13:00 the lake sloshes back (a damped seiche),
  // dropping well below still water around 20:00 and swinging back more weakly after that.
  const HOLD_H = 7; // 13:00
  const PEAK_FT = 4.4;
  // Damping: the envelope at half a period. Damping pulls the first trough a little earlier and deeper; 1.4 puts
  // it at −1.5 ft around 19:15, so the deepest canal berth (D-01) is still tight under the keel.
  const HALF_PERIOD_ENVELOPE_FT = 1.4;
  const tau = -(SEICHE_PERIOD_H / 2) / Math.log(HALF_PERIOD_ENVELOPE_FT / PEAK_FT);
  const gale = series((h) => {
    const level =
      h <= HOLD_H
        ? 2.6 + (PEAK_FT - 2.6) * Math.sin((Math.PI / 2) * Math.min(1, h / 4)) ** 2
        : PEAK_FT * Math.exp(-(h - HOLD_H) / tau) * Math.cos((2 * Math.PI * (h - HOLD_H)) / SEICHE_PERIOD_H);
    const wind = keyed([[0, 30], [2, 37], [5, 39], [7, 36], [10, 24], [12, 18], [16, 12], [24, 9], [36, 11], [60, 8]], h);
    const dir = keyed([[0, 225], [7, 235], [12, 255], [18, 270], [36, 260], [60, 240]], h);
    return { level_ft: level, windFromDeg: dir, wind_kt: wind, gust_kt: wind * (wind >= 25 ? 1.25 : 1.35) };
  });

  const basis = 'SRC-LAKE: authored shapes for the demo; gale band from SRC-NWS-MARINE.';
  return [
    { id: 'calm', label: 'Calm', summary: 'Light breeze; the lake holds near still water.', samples: calm, basis, provenance: 'SIM' },
    { id: 'sw-gale', label: 'SW gale', summary: 'What-if: a south-west gale piles water up at Buffalo, then the lake sloshes back below still water.', samples: gale, basis, provenance: 'SIM' },
  ];
}
