/**
 * Small framework-agnostic store (PRD §10: explicit commands, pure selectors).
 *
 * Interactive run and replay view are separate by construction:
 * - viewing a replay snapshot never reads from or writes to the interactive session;
 * - “Try this state” replaces the interactive run with a fresh branch built from the seed;
 * - “Restart demo” returns to the seed and clears the stored branch.
 * Only the interactive session is persisted.
 */
import { apply, type Command, type CommandResult } from './engine.ts';
import { clearSession, loadSession, saveSession, type LoadNotice, type StorageBackend, type StorageLike } from './persistence.ts';
import { buildSnapshot } from './replay.ts';
import { checkpointAt, timelineSnapshot } from './timeline.ts';
import { seedSession, type DemoSession } from './session.ts';
import type { CheckpointId, FixtureBundle, IsoTime, LakeScenarioId } from './types.ts';

/**
 * Replay is one read-only view of the scripted day (T31): `at` is the moment shown. Guided replay jumps it to a
 * checkpoint; the day timeline (scrubber) moves it to any minute. `checkpoint` is the scripted stage in force at
 * `at` (normal before 08:45), which is what “Try this state” branches from.
 */
export type View = { mode: 'interactive' } | { mode: 'replay'; checkpoint: CheckpointId; at: IsoTime; snapshot: DemoSession };

export interface AppState {
  fixtures: FixtureBundle;
  interactive: DemoSession;
  view: View;
  storage: { backend: StorageBackend; notice: LoadNotice | null; lastSaveError: string | null };
  lastResult: CommandResult | null;
  /**
   * T35: the lake what-if lens. A view over the simulated series, not a record: it applies to the run and to the
   * replay timeline alike, changes no session, and is not persisted (a reload starts calm). Assignments record
   * the what-if they were checked under.
   */
  lake: LakeScenarioId;
}

export const activeSession = (st: AppState): DemoSession => (st.view.mode === 'replay' ? st.view.snapshot : st.interactive);

export interface Store {
  getState(): AppState;
  subscribe(listener: () => void): () => void;
  dispatch(cmd: Command): CommandResult;
  viewReplay(checkpoint: CheckpointId): void;
  /** T31: show the scripted day at any time (read-only). Keeps the current selection. */
  viewTimeline(at: IsoTime): void;
  returnToInteractive(): void;
  /** T35: switch the lake what-if (allowed in replay; never touches a session). */
  setLake(id: LakeScenarioId): void;
  startBranch(checkpoint: CheckpointId): void;
  restart(): void;
}

export function createStore(fixtures: FixtureBundle, storage: { backend: StorageBackend; storage: StorageLike }, opts: { lake?: LakeScenarioId } = {}): Store {
  const loaded = loadSession(storage.storage, fixtures);
  let state: AppState = {
    fixtures,
    interactive: loaded.session ?? seedSession(fixtures),
    view: { mode: 'interactive' },
    storage: { backend: storage.backend, notice: loaded.notice, lastSaveError: null },
    lastResult: null,
    lake: opts.lake ?? 'calm',
  };
  const listeners = new Set<() => void>();
  const set = (next: AppState) => {
    state = next;
    for (const l of listeners) l();
  };
  const persist = (session: DemoSession): string | null => {
    const r = saveSession(storage.storage, session);
    return r.ok ? null : r.error;
  };
  let branchCounter = Number(/^branch-(\d+)$/.exec(state.interactive.branchId)?.[1] ?? 0);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(cmd) {
      if (state.view.mode === 'replay') {
        if (cmd.type !== 'select') {
          const rejected: CommandResult = { ok: false, session: state.view.snapshot, reason: 'replay_read_only' };
          set({ ...state, lastResult: rejected });
          return rejected;
        }
        const r = apply(state.fixtures, state.view.snapshot, cmd);
        set({ ...state, view: { ...state.view, snapshot: r.session }, lastResult: r });
        return r;
      }
      const r = apply(state.fixtures, state.interactive, cmd);
      const changed = r.ok && r.effect === 'changed';
      const lastSaveError = changed ? persist(r.session) : state.storage.lastSaveError;
      set({ ...state, interactive: r.session, lastResult: r, storage: { ...state.storage, lastSaveError } });
      return r;
    },
    viewReplay(checkpoint) {
      set({ ...state, view: { mode: 'replay', checkpoint, at: state.fixtures.scenario.checkpoints[checkpoint], snapshot: buildSnapshot(state.fixtures, checkpoint) }, lastResult: null });
    },
    viewTimeline(at) {
      const selection = activeSession(state).selection;
      const checkpoint = checkpointAt(state.fixtures, at) ?? 'normal';
      set({ ...state, view: { mode: 'replay', checkpoint, at, snapshot: timelineSnapshot(state.fixtures, at, selection) }, lastResult: null });
    },
    returnToInteractive() {
      set({ ...state, view: { mode: 'interactive' }, lastResult: null });
    },
    setLake(id) {
      if (id !== state.lake) set({ ...state, lake: id });
    },
    startBranch(checkpoint) {
      branchCounter += 1;
      const branch = buildSnapshot(state.fixtures, checkpoint, `branch-${branchCounter}`);
      set({ ...state, interactive: branch, view: { mode: 'interactive' }, lastResult: null, storage: { ...state.storage, lastSaveError: persist(branch) } });
    },
    restart() {
      clearSession(storage.storage);
      branchCounter = 0;
      set({ ...state, interactive: seedSession(state.fixtures), view: { mode: 'interactive' }, lastResult: null, storage: { ...state.storage, notice: null, lastSaveError: null } });
    },
  };
}
