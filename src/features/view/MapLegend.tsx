/**
 * Dock-map legend (T29, PRD F19). Every status has a pattern as well as a colour (the plates use the same
 * patterns), a plain name, a one-line meaning and tonight's count, so the map never relies on colour alone.
 * The canvas is aria-hidden; this list and the Slips list are the accessible equivalent.
 */
import { useId } from 'react';
import { useAppState } from '../../app/AppStore.tsx';
import { activeSession } from '../../domain/store.ts';
import { MAP_STATUSES, MAP_STATUS_HINT, MAP_STATUS_LABEL, mapStatusCounts } from '../../domain/selectors.ts';
import './map-legend.css';

export function MapLegend() {
  const state = useAppState();
  const id = useId();
  if (!state) return null;
  const counts = mapStatusCounts(state.fixtures, activeSession(state));
  return (
    <section className="map-legend" aria-labelledby={`${id}-h`} data-testid="map-legend">
      <h2 className="label map-legend-title" id={`${id}-h`}>
        Map · tonight
      </h2>
      <ul className="map-legend-list">
        {MAP_STATUSES.map((st) => (
          <li key={st} title={MAP_STATUS_HINT[st]}>
            <span className={`map-key map-key-${st}`} aria-hidden="true" />
            <span className="map-legend-name">{MAP_STATUS_LABEL[st]}</span>
            <span className="data map-legend-count">{counts[st]}</span>
            <span className="sr-only">. {MAP_STATUS_HINT[st]}.</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
