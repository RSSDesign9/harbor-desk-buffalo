/** Demo session: everything a viewer’s run appends on top of the immutable fixtures (PRD §8 DemoSession). */
import type { AuditEvent, DockCheckTask, FixtureBundle, IdentityDecision, IsoTime, LocalAssignment, ReviewIssue, SourceStatusEvent, Verification } from './types.ts';

export const SESSION_SCHEMA_VERSION = 1 as const;

export type Selection = { kind: 'slip' | 'vessel'; id: string } | null;

export interface DemoSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  scenarioVersion: string;
  seed: string;
  /** Identifies an interactive run; a new “Try this state” branch gets a new id. */
  branchId: string;
  /** Virtual scenario time; only ever one of the scenario checkpoints. */
  clock: IsoTime;
  selection: Selection;
  /** Staged evidence revealed by the explicit scenario control. */
  revealedEvidenceIds: readonly string[];
  acknowledgedEvidenceIds: readonly string[];
  /** The evidence comparison currently open for an issue (cancel/back closes it without mutation). */
  review: { issueId: string } | null;
  issues: readonly ReviewIssue[];
  tasks: readonly DockCheckTask[];
  verifications: readonly Verification[];
  decisions: readonly IdentityDecision[];
  audit: readonly AuditEvent[];
  sourceEvents: readonly SourceStatusEvent[];
  /** T30: demo assignments of incoming transient requests. Appended; undo stamps `undoneAt`. */
  assignments: readonly LocalAssignment[];
}

export function seedSession(fx: FixtureBundle, branchId = 'main'): DemoSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    scenarioVersion: fx.scenario.scenarioVersion,
    seed: fx.scenario.seed,
    branchId,
    clock: fx.scenario.checkpoints.normal,
    selection: null,
    revealedEvidenceIds: [],
    acknowledgedEvidenceIds: [],
    review: null,
    issues: [],
    tasks: [],
    verifications: [],
    decisions: [],
    audit: [],
    sourceEvents: [],
    assignments: [],
  };
}

export const seqId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`;
