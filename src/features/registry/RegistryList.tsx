/**
 * Slips / Vessels list (TASKS T10, DESIGN §8 asset list). A single-tab-stop listbox:
 * ↑/↓/Home/End move, Enter/Space selects, the selected option follows the shared selection.
 * 44 px rows; status is text + pill (never colour alone).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useAppState, useStore } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { Button } from '../../ui/Button.tsx';
import { Checkbox } from '../../ui/Fields.tsx';
import { VesselGlyph } from '../../ui/icons.tsx';
import { EmptyState, StatusPill } from '../../ui/Status.tsx';
import { slipRows, vesselRows, type Filters, type SlipRow, type VesselRow } from './model.ts';
import { useRegistryUi } from './RegistryContext.tsx';
import { focusSoon } from '../slip-review/useReviewActions.ts';
import { ArrivalsBoard } from '../board/ArrivalsBoard.tsx';
import type { RegistryTab } from './RegistryContext.tsx';

const TABS: readonly RegistryTab[] = ['slips', 'vessels', 'arrivals'];

type Row = { kind: 'slip'; row: SlipRow } | { kind: 'vessel'; row: VesselRow };

/**
 * Keep the active row visible by scrolling ONLY its nearest scrolling container (the list on desktop, the rail
 * body in compact layouts). scrollIntoView would also scroll overflow-hidden ancestors such as the rail itself,
 * sliding the whole panel under the top bar (a T17 defect found at tablet size).
 */
function scrollWithinNearest(el: HTMLElement) {
  let sc = el.parentElement;
  while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
  if (!sc) return;
  const r = el.getBoundingClientRect();
  const c = sc.getBoundingClientRect();
  if (r.top < c.top) sc.scrollTop -= c.top - r.top;
  else if (r.bottom > c.bottom) sc.scrollTop += r.bottom - c.bottom;
}

export function RegistryList() {
  const state = useAppState();
  const store = useStore();
  const ui = useRegistryUi();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  // Active (keyboard) row: follows the shared selection until the user moves it.
  const [moved, setMoved] = useState<{ index: number; selKey: string } | null>(null);

  const session = state ? activeSession(state) : null;
  // Rows are built only while the list is open (a closed list need not follow every scrubber minute).
  const open = ui.listOpen;
  const slips = useMemo(() => (open && state && session ? slipRows(state.fixtures, session, ui.query, ui.filters) : []), [open, state, session, ui.query, ui.filters]);
  const vessels = useMemo(() => (open && state && session ? vesselRows(state.fixtures, session, ui.query, ui.filters) : []), [open, state, session, ui.query, ui.filters]);
  const rows: Row[] = ui.tab === 'slips' ? slips.map((row) => ({ kind: 'slip', row })) : vessels.map((row) => ({ kind: 'vessel', row }));
  const sel = session?.selection ?? null;
  const selectedIndex = rows.findIndex((r) => sel && r.kind === sel.kind && r.row.id === sel.id);

  const selKey = `${ui.tab}|${sel?.kind ?? ''}:${sel?.id ?? ''}|${ui.query}|${ui.filters.dock}|${ui.filters.needsReview}`;
  const setActive = (index: number) => setMoved({ index, selKey });
  const base = moved && moved.selKey === selKey ? moved.index : selectedIndex >= 0 ? selectedIndex : 0;
  const activeIndex = Math.min(base, Math.max(0, rows.length - 1));
  const activeRow = rows[activeIndex];
  const optionId = (r: Row) => `${listId}-${r.kind}-${r.row.id}`;
  useEffect(() => {
    if (!activeRow) return;
    const el = document.getElementById(optionId(activeRow));
    if (el) scrollWithinNearest(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRow?.row.id, ui.tab]);

  if (!state || !store) return null;
  const choose = (r: Row) => {
    store.dispatch({ type: 'select', selection: { kind: r.kind, id: r.row.id } });
    // Compact layouts swap the list for Details, so focus follows to the record (desktop keeps list focus).
    ui.setPane('details');
    focusSoon('inspector-title');
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1;
    const next = e.key === 'ArrowDown' ? Math.min(last, activeIndex + 1) : e.key === 'ArrowUp' ? Math.max(0, activeIndex - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && activeRow) {
      e.preventDefault();
      choose(activeRow);
    }
  };
  const setDock = (dock: Filters['dock']) => ui.setFilters({ ...ui.filters, dock });
  const filtered = ui.query !== '' || ui.filters.dock !== 'all' || ui.filters.needsReview;

  return (
    <section className="panel registry" aria-labelledby={`${listId}-title`}>
      <h2 className="sr-only" id={`${listId}-title`}>Slips &amp; vessels</h2>
      <div id={`${listId}-body`} className="registry-body" hidden={!ui.listOpen}>
        <div className="tabs-list" role="tablist" aria-label="Registry">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="tab"
              aria-selected={ui.tab === t}
              aria-controls={t === 'arrivals' ? 'registry-arrivals' : 'registry-listbox'}
              tabIndex={ui.tab === t ? 0 : -1}
              onClick={() => ui.setTab(t)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const i = TABS.indexOf(t);
                  const other = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
                  ui.setTab(other);
                  (e.currentTarget.parentElement?.querySelector(`[data-tab="${other}"]`) as HTMLElement | null)?.focus();
                }
              }}
              data-tab={t}
            >
              {t === 'slips' ? `Slips ${slips.length}` : t === 'vessels' ? `Vessels ${vessels.length}` : 'Arrivals'}
            </button>
          ))}
        </div>
        {ui.tab === 'arrivals' ? (
          <div id="registry-arrivals" role="tabpanel" aria-label="Arrivals today">
            <ArrivalsBoard />
          </div>
        ) : (
        <>
        <div className="registry-filters">
          <label className="filter-select">
            <span className="body-sm">Dock</span>
            <select className="input" value={ui.filters.dock} onChange={(e) => setDock(e.target.value as Filters['dock'])}>
              <option value="all">All docks</option>
              {['A', 'B', 'C', 'D', 'E'].map((d) => (
                <option key={d} value={d}>
                  Dock {d}
                </option>
              ))}
            </select>
          </label>
          {ui.tab === 'slips' ? (
            <Checkbox label="Needs review" checked={ui.filters.needsReview} onChange={(e) => ui.setFilters({ ...ui.filters, needsReview: e.target.checked })} />
          ) : null}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            eyebrow={ui.tab === 'slips' ? 'No slips match' : 'No vessels match'}
            action={
              <Button variant="secondary" onClick={ui.clearAll}>
                Clear search and filters
              </Button>
            }
          >
            {ui.query ? `Nothing matches “${ui.query}”. Try a slip ID such as B-12, a vessel name, or a vessel ID.` : 'No records match these filters.'}
          </EmptyState>
        ) : (
          <div
            ref={listRef}
            id="registry-listbox"
            className="registry-list"
            role="listbox"
            tabIndex={0}
            aria-label={`${ui.tab === 'slips' ? 'Slips' : 'Vessels'}${filtered ? ', filtered' : ''}`}
            aria-activedescendant={activeRow ? optionId(activeRow) : undefined}
            onKeyDown={onKey}
          >
            {rows.map((r, i) => (
              <div
                key={r.row.id}
                id={optionId(r)}
                role="option"
                data-kind={r.kind}
                aria-selected={i === selectedIndex}
                className={`registry-row${i === activeIndex ? ' is-active' : ''}${i === selectedIndex ? ' is-selected' : ''}`}
                onClick={() => {
                  setActive(i);
                  choose(r);
                }}
              >
                {r.kind === 'slip' ? (
                  <>
                    <span className="row-id">{r.row.id}</span>
                    <span className="row-name">{r.row.assignedVessel ? r.row.assignedVessel.name : <span className="secondary">No agreement</span>}</span>
                    <span className="row-pills">
                      {/* One pill per row: an open review outranks presence; the inspector shows both. */}
                      {r.row.review && r.row.review.tone !== 'resolved' ? (
                        <StatusPill tone={r.row.review.tone}>{r.row.review.label}</StatusPill>
                      ) : (
                        <StatusPill tone={r.row.presence.tone}>{r.row.presence.label}</StatusPill>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="row-id">{r.row.id}</span>
                    <span className="row-name">
                      <VesselGlyph kind={r.row.glyph} />
                      {r.row.name}
                      <span className="sr-only">, {r.row.typeLabel}</span>
                    </span>
                    <span className="row-pills">
                      <span className="row-slip">{r.row.slipId ?? '—'}</span>
                      <StatusPill tone={r.row.status.tone}>{r.row.status.label}</StatusPill>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </section>
  );
}
