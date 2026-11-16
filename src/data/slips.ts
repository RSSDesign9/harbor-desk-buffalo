import type { Slip } from '../domain/types.ts';

/**
 * Read slip properties from the ORIGINAL data/slips.geojson without renumbering or editing.
 * Geometry is intentionally dropped here: world transforms come from data/derived/site-local.json (scene layer).
 * Malformed features are returned as rejects for validation to report, never silently fixed.
 */
export function parseSlipsGeoJson(geojson: unknown): { slips: Slip[]; rejects: { index: number; reason: string }[] } {
  const slips: Slip[] = [];
  const rejects: { index: number; reason: string }[] = [];
  const features = (geojson as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return { slips, rejects: [{ index: -1, reason: 'Not a FeatureCollection' }] };
  features.forEach((f, index) => {
    const p = (f as { properties?: Record<string, unknown> }).properties;
    if (!p) return rejects.push({ index, reason: 'Feature has no properties' });
    const dockKind = p.dock_kind;
    if (dockKind !== 'fixed' && dockKind !== 'floating') return rejects.push({ index, reason: `Bad dock_kind ${String(dockKind)}` });
    slips.push({
      id: String(p.id),
      dock: String(p.dock),
      number: Number(p.number),
      length_ft: Number(p.length_ft),
      width_ft: Number(p.width_ft),
      dock_kind: dockKind,
      headwalk_osm_way: Number(p.headwalk_osm_way),
      provenance: p.provenance as Slip['provenance'],
      basis: String(p.basis ?? ''),
      // The headwalk reference itself is a documented OSM way; the slip is an assumption.
      fieldProvenance: { headwalk_osm_way: 'DOC' },
    });
    return undefined;
  });
  return { slips, rejects };
}
