import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAppState } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { NO_FILTERS, type Filters } from './model.ts';

/**
 * UI-only registry and panel state (query, filters, tab; T17: which pane a compact rail shows, whether the
 * tablet rail is open, whether the mobile sheet is expanded). Never part of the domain session, so changing
 * layout, view or theme cannot change records or workflow state.
 */
type Pane = 'details' | 'list' | 'tasks' | 'request';
/** T31: the arrivals board is a third tab beside Slips and Vessels. */
export type RegistryTab = 'slips' | 'vessels' | 'arrivals';
interface RegistryUi {
  query: string;
  setQuery: (q: string) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  tab: RegistryTab;
  setTab: (t: RegistryTab) => void;
  listOpen: boolean;
  setListOpen: (open: boolean) => void;
  clearAll: () => void;
  /** Compact layouts: the pane to show. A new selection opens Details; “Back to list” holds until it changes. */
  paneFor: (selKey: string, hasDetails: boolean) => Pane;
  setPane: (p: Pane) => void;
  returnPane: 'tasks' | 'list';
  railOpen: boolean;
  setRailOpen: (open: boolean) => void;
  sheetExpanded: boolean;
  setSheetExpanded: (v: boolean) => void;
}

const Ctx = createContext<RegistryUi | null>(null);

export function RegistryProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const s = state ? activeSession(state) : null;
  const selKey = s?.selection ? `${s.selection.kind}:${s.selection.id}` : '';
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [tab, setTab] = useState<RegistryTab>('slips');
  // The list stays mounted to preserve its keyboard position; the workspace controls visibility.
  const [listOpen, setListOpen] = useState(true);
  const [returnPane, setReturnPane] = useState<'tasks' | 'list'>('tasks');
  const [paneChoice, setPaneChoice] = useState<{ pane: Pane; selKey: string } | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const setPane = useCallback((pane: Pane) => {
    setPaneChoice({ pane, selKey });
    setRailOpen(true);
    if (pane === 'list' || pane === 'tasks') setReturnPane(pane);
    if (pane === 'list') setListOpen(true);
  }, [selKey]);
  const paneFor = useCallback(
    (key: string, hasDetails: boolean): Pane => (paneChoice && paneChoice.selKey === key && (paneChoice.pane !== 'details' || hasDetails) ? paneChoice.pane : hasDetails ? 'details' : returnPane),
    [paneChoice, returnPane],
  );
  const value = useMemo<RegistryUi>(
    () => ({
      query,
      setQuery,
      filters,
      setFilters,
      tab,
      setTab,
      listOpen,
      setListOpen,
      clearAll: () => {
        setQuery('');
        setFilters(NO_FILTERS);
      },
      paneFor,
      setPane,
      returnPane,
      railOpen,
      setRailOpen,
      sheetExpanded,
      setSheetExpanded,
    }),
    [query, filters, tab, listOpen, paneFor, setPane, returnPane, railOpen, sheetExpanded],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRegistryUi(): RegistryUi {
  const v = useContext(Ctx);
  if (!v) throw new Error('RegistryProvider missing');
  return v;
}
