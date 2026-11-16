/**
 * Harbor Desk domain model (PRD §8). Pure data: no rendering, no React.
 *
 * Presence, identity, agreement, issue status and document review are separate records (PRD §7 inv. 1).
 * Effective identity and location are always DERIVED from appended records; nothing is overwritten.
 * Times are ISO-8601 strings in UTC (`…Z`); the UI formats them in America/New_York.
 */

export type Provenance = 'DOC' | 'ASSUME' | 'SIM' | 'FIELD';
export const PROVENANCE_VALUES: readonly Provenance[] = ['DOC', 'ASSUME', 'SIM', 'FIELD'];

export type IsoTime = string;

/** Optional per-field overrides for records whose fields come from mixed origins. */
export type FieldProvenance = Readonly<Record<string, Provenance>>;

export type SourceKind =
  | 'osm-dataset'
  | 'official-map'
  | 'official-document'
  | 'generated-layout'
  | 'derived-geometry'
  | 'assumed-rates'
  | 'assumed-services'
  | 'assumed-lake'
  | 'official-guide'
  | 'sim-camera'
  | 'sim-staff-log'
  | 'sim-staff-check';

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  path?: string;
  url?: string;
  /** Publication / fetch / generation date (YYYY-MM-DD); null only when the caveats say it is not recorded. */
  date: string | null;
  provenance: Provenance;
  caveats: string;
}

export type DockKind = 'fixed' | 'floating';

/** Slip properties exactly as supplied in data/slips.geojson. World transforms live in the scene layer. */
export interface Slip {
  id: string;
  dock: string;
  number: number;
  length_ft: number;
  width_ft: number;
  dock_kind: DockKind;
  headwalk_osm_way: number;
  provenance: Provenance;
  basis: string;
  fieldProvenance?: FieldProvenance;
}

export type VesselType = 'cabin-cruiser' | 'center-console' | 'runabout' | 'sailboat';
/** Which parametric 3D family renders this vessel (design/ASSET-PLAN.md). */
export type ModelAssetKey = 'cruiser' | 'console' | 'sail';

export interface Owner {
  id: string;
  kind: 'individual' | 'organization';
  /** Fictional, non-personal label. Never a real person’s name. */
  label: string;
}

export interface Vessel {
  id: string;
  name: string;
  type: VesselType;
  modelAssetKey: ModelAssetKey;
  /** Length overall, beam and draft in feet. `null` = not recorded (never shown as zero). */
  loa_ft: number;
  beam_ft: number | null;
  draft_ft: number | null;
  owner: Owner;
  /** State registration, displayed only by its suffix, e.g. “ending 42 AB”. */
  registrationSuffix: string | null;
  /** Federal documentation reference, masked. Separate from registration. */
  documentationRef: string | null;
  /** Hull identification number, masked; optional and separate from registration. */
  hinMasked: string | null;
  hullColor: 'white' | 'slate' | 'forest' | 'rust';
  canvasColor: 'navy' | 'sand' | 'none';
  provenance: Provenance;
  generated_at: IsoTime;
}

export type AgreementType = 'seasonal' | 'transient';

export interface Agreement {
  id: string;
  vesselId: string;
  slipId: string;
  type: AgreementType;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  status: 'active' | 'ended';
  /**
   * Dockage charged (USD, whole dollars): the season fee for a seasonal agreement, the nightly rate for a
   * transient one (see `rateBasis`). T28: invented for the demo, never a real Buffalo rate card.
   */
  rateUsd: number;
  rateBasis: 'season' | 'night';
  provenance: Provenance;
  /** Per-field origin for the rate fields (ASSUME: a design assumption, not a published rate). */
  fieldProvenance: FieldProvenance;
}

export type DocumentType = 'registration' | 'documentation' | 'insurance';
/** Demo review state of a record. Never means “legally compliant”. */
export type ReviewState = 'reviewed' | 'pending_review' | 'not_recorded';

export interface DocumentSummary {
  id: string;
  vesselId: string;
  docType: DocumentType;
  maskedReference: string | null;
  reviewState: ReviewState;
  reviewedOn: string | null;
  expiresOn: string | null;
  provenance: Provenance;
}

export type Presence = 'present' | 'empty' | 'unknown';

/** Immutable camera observation. Opaque ID; never encodes identity (PRD §7 inv. 10). */
export interface Observation {
  id: string;
  slipId: string;
  sourceId: string;
  observedAt: IsoTime;
  receivedAt: IsoTime;
  presence: Presence;
  /** Possible matches only. Never a confirmed identity or a location update. */
  candidateVesselIds: readonly string[];
  reason: string | null;
  evidenceAssetId: string | null;
  provenance: Provenance;
}

export interface Movement {
  id: string;
  vesselId: string;
  slipId: string;
  kind: 'departure' | 'arrival';
  at: IsoTime;
  /**
   * `outing`: a seasonal boat leaves for the day, and its arrival is the return. `stay`: a transient
   * check-in (arrival). Only `stay` arrivals count as arrivals in the operator KPIs.
   */
  trip: 'outing' | 'stay';
  /** Away-boat flag for a departure: when the boat is expected back. `null` = no return planned today. */
  expectedReturnAt: IsoTime | null;
  sourceId: string;
  actorId: string;
  provenance: Provenance;
}

export interface Verification {
  id: string;
  slipId: string;
  verifiedVesselId: string;
  checkedAt: IsoTime;
  actorId: string;
  method: 'staff-dock-walk' | 'staff-dock-check';
  evidenceSummary: string;
  evidenceAssetId: string | null;
  sourceId: string;
  provenance: Provenance;
}

export interface IdentityDecision {
  id: string;
  observationId: string;
  confirmedVesselId: string;
  verificationId: string;
  actorId: string;
  decidedAt: IsoTime;
  provenance: Provenance;
}

export type IssueState = 'open' | 'pending_check' | 'resolved';

export interface ReviewIssue {
  id: string;
  slipId: string;
  observationId: string;
  state: IssueState;
  reason: string;
  createdAt: IsoTime;
  resolvedAt: IsoTime | null;
  provenance: Provenance;
}

export interface DockCheckTask {
  id: string;
  issueId: string;
  slipId: string;
  requestedAt: IsoTime;
  status: 'pending' | 'completed';
  completedAt: IsoTime | null;
  verificationId: string | null;
  provenance: Provenance;
}

export type AuditEventType =
  | 'issue_opened'
  | 'dock_check_requested'
  | 'staff_evidence_received'
  | 'identity_confirmed'
  | 'dock_check_completed'
  | 'issue_resolved'
  | 'source_status_changed';

export interface AuditEvent {
  id: string;
  issueId: string | null;
  type: AuditEventType;
  actorId: string;
  eventAt: IsoTime;
  refs: {
    observationId?: string;
    verificationId?: string;
    decisionId?: string;
    taskId?: string;
    evidenceId?: string;
    sourceId?: string;
  };
  before?: string;
  after?: string;
  provenance: Provenance;
}

export interface Actor {
  id: string;
  label: string;
  role: 'dockmaster' | 'dock-staff' | 'system';
  provenance: Provenance;
}

/** Evidence staged by the scenario and revealed only by an explicit scenario control. */
export interface StagedEvidence {
  id: string;
  kind: 'camera-frame' | 'staff-dock-check' | 'dock-walk-mark';
  slipId: string;
  capturedAt: IsoTime;
  sourceId: string;
  actorId: string | null;
  /** For staff evidence: the vessel the staff member identified. Camera frames have none. */
  verifiedVesselId: string | null;
  summary: string;
  /** Opaque asset ID; the image file may not exist yet (rendered in T09/T11). */
  assetId: string | null;
  altText: string;
  provenance: Provenance;
}

export interface EvidenceAsset {
  id: string;
  path: string;
  status: 'planned' | 'available';
  provenance: Provenance;
}

export interface SourceStatusEvent {
  id: string;
  sourceId: string;
  status: 'online' | 'offline';
  at: IsoTime;
  provenance: Provenance;
}

export type CheckpointId = 'normal' | 'uncertain' | 'pending_check' | 'verification_review' | 'resolved';

export interface ScenarioDefinition {
  scenarioVersion: string;
  seed: string;
  date: string;
  timeZone: 'America/New_York';
  slipId: string;
  assignedVesselId: string;
  candidateVesselId: string;
  neighbourVesselId: string;
  uncertainObservationId: string;
  staffEvidenceId: string;
  cameraEvidenceId: string;
  /** T32: the morning dock-walk entry that opens the B-12 issue (text only; the camera is the second source). */
  dockWalkEvidenceId: string;
  demoActorId: string;
  checkpoints: Readonly<Record<CheckpointId, IsoTime>>;
  /** Freshness policies (demo, not a validated SLA). */
  cameraFreshMinutes: number;
  staffFreshMinutes: number;
  /**
   * T31: an online camera re-reads its slips every `everyMinutes` inside these windows (UTC [from, to)), and each
   * re-read reports the slip's latest known state. The windows leave the scripted B-12 morning (08:40–09:25)
   * exactly as recorded, so the scenario's own frames are the only camera reports there.
   */
  cameraSweep: { everyMinutes: number; windows: readonly (readonly [IsoTime, IsoTime])[] };
  provenance: Provenance;
}

/** Assumed berth services (T30, PRD §15 SlipDepth): water depth at the berth and shore power. ASSUME, not a survey. */
export interface SlipService {
  id: string;
  slipId: string;
  depth_ft: number;
  /** Shore-power pedestal outlets at the berth, in amps. */
  shorePowerA: readonly number[];
  /**
   * T35 (ASSUME): whether the berth is open to wind and waves from the west–southwest across the river mouth
   * (`open`) or tucked into the City Ship Canal (`sheltered`), and, on a fixed dock, how far the deck stands
   * above the still-water level the depths refer to. Floating docks ride the water: null.
   */
  exposure: 'open' | 'sheltered';
  deckFreeboard_ft: number | null;
  basis: string;
  provenance: Provenance;
}

/** T35: the lake what-ifs. `calm` keeps the T30 verdicts; `sw-gale` is a SW gale and the seiche that follows. */
export type LakeScenarioId = 'calm' | 'sw-gale';

/** One sample of a simulated lake series at the marina (T35). */
export interface LakeSample {
  at: IsoTime;
  /** Water level relative to the still-water level the assumed depths refer to, in feet (+ higher, − lower). */
  level_ft: number;
  /** Direction the wind blows FROM, compass degrees. */
  windFromDeg: number;
  wind_kt: number;
  gust_kt: number;
}

/** A simulated lake-conditions series (T35, PRD F23 option E). SIM: not a NOAA gauge record or an NWS forecast. */
export interface LakeScenario {
  id: LakeScenarioId;
  label: string;
  summary: string;
  /** Samples at a fixed step, ascending, covering the scenario day and the longest demo stay. */
  samples: readonly LakeSample[];
  basis: string;
  provenance: Provenance;
}

/** An incoming transient request (T30, PRD §15 TransientRequest). SIM. */
export interface TransientRequest {
  id: string;
  vesselName: string;
  type: VesselType;
  modelAssetKey: ModelAssetKey;
  loa_ft: number;
  beam_ft: number;
  draft_ft: number;
  /** Shore power the boat needs, in amps. */
  powerA: number;
  /** When the request reached the marina (it is not visible before). */
  receivedAt: IsoTime;
  arrivalFrom: IsoTime;
  arrivalTo: IsoTime;
  nights: number;
  hullColor: Vessel['hullColor'];
  canvasColor: Vessel['canvasColor'];
  provenance: Provenance;
}

/** A session-local SIM assignment of a request to a slip (T30, PRD §15 LocalAssignment). Appended; undo stamps undoneAt. */
export interface LocalAssignment {
  id: string;
  requestId: string;
  slipId: string;
  assignedAt: IsoTime;
  undoneAt: IsoTime | null;
  actorId: string;
  /** T35: the lake what-if the fit was checked under (absent in runs saved before T35 = calm). */
  lake?: LakeScenarioId;
  provenance: Provenance;
}

/** Everything immutable the app starts from. */
export interface FixtureBundle {
  generated_at: IsoTime;
  sources: readonly Source[];
  actors: readonly Actor[];
  slips: readonly Slip[];
  vessels: readonly Vessel[];
  agreements: readonly Agreement[];
  documents: readonly DocumentSummary[];
  observations: readonly Observation[];
  movements: readonly Movement[];
  verifications: readonly Verification[];
  sourceStatus: readonly SourceStatusEvent[];
  stagedEvidence: readonly StagedEvidence[];
  evidenceAssets: readonly EvidenceAsset[];
  slipServices: readonly SlipService[];
  transientRequests: readonly TransientRequest[];
  /** T35: lake what-ifs (SIM). */
  lakeScenarios: readonly LakeScenario[];
  scenario: ScenarioDefinition;
}
