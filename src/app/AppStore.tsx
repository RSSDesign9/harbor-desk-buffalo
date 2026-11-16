import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadFixtures } from '../data/fixtures.ts';
import type { LoadResult } from '../data/assemble.ts';
import { pickStorage, STORAGE_KEY, type StorageLike } from '../domain/persistence.ts';
import { hasFault } from './faults.ts';
import { createStore, type AppState, type Store } from '../domain/store.ts';
import { isLakeScenarioId } from '../domain/lake.ts';

interface Ctx {
  store: Store | null;
  load: LoadResult;
}
const StoreContext = createContext<Ctx | null>(null);

/**
 * The browser storage the session uses. With `?debug&fault=storage-…` (dev/test only) it misbehaves the way a
 * real browser can: unavailable, corrupt or old saved data, or writes that throw (quota).
 */
function storageCandidate(): StorageLike | undefined {
  if (hasFault('storage-unavailable')) throw new Error('storage disabled (fault injection)');
  const ls = window.localStorage;
  if (hasFault('storage-corrupt')) ls.setItem(STORAGE_KEY, '{"schemaVersion":1,"session":');
  if (hasFault('storage-incompatible')) ls.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, scenarioVersion: 'b12-v0', session: {} }));
  if (!hasFault('storage-write')) return ls;
  let probed = false;
  return {
    getItem: (k) => ls.getItem(k),
    removeItem: (k) => ls.removeItem(k),
    setItem: (k, v) => {
      // Let the availability probe pass once, then fail every real write, as a full quota does.
      if (!probed && k.endsWith(':probe')) {
        probed = true;
        return ls.setItem(k, v);
      }
      throw new Error('QuotaExceededError (fault injection)');
    },
  };
}

/** Creates the domain store once. A fatal fixture problem yields no store, and the shell shows a data error. */
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ctx] = useState<Ctx>(() => {
    const load = loadFixtures();
    if (load.status === 'fatal') return { store: null, load };
    const storage = pickStorage(storageCandidate);
    // T35: `?lake=sw-gale` opens on the gale what-if (for links and QA captures); anything else is calm.
    const lake = new URLSearchParams(window.location.search).get('lake');
    return { store: createStore(load.bundle, storage, { lake: isLakeScenarioId(lake) ? lake : 'calm' }), load };
  });
  // Test/QA bridge (?debug): exposes the store React actually uses (set in an effect, so StrictMode’s
  // discarded initializer result is never exposed). Never enabled without the flag.
  useEffect(() => {
    if (!ctx.store || !new URLSearchParams(window.location.search).has('debug')) return;
    const w = window as unknown as { __harborDesk?: unknown };
    w.__harborDesk = { store: ctx.store };
    return () => {
      delete w.__harborDesk;
    };
  }, [ctx.store]);
  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('AppStoreProvider missing');
  return c;
}

export const useFixtureLoad = () => useCtx().load;
export const useStore = () => useCtx().store;

const noop = () => () => undefined;
/** Subscribe to the whole app state (or null when fixtures failed). Selectors stay pure and live in src/domain. */
export function useAppState(): AppState | null {
  const store = useCtx().store;
  return useSyncExternalStore(store ? store.subscribe : noop, store ? store.getState : () => null);
}
