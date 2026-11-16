/**
 * Trim data/derived/site-local.json (153 KB, inspection detail) into the runtime geometry the scene loads:
 *   data/derived/site-runtime.json   (run by `npm run geometry`; checked by tests/unit/site-runtime.test.ts)
 * Local metres (east, north) as [e, n] pairs. Provenance is carried per layer.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
type EN = { east: number; north: number };
interface SiteLocal {
  frame: unknown;
  slips: { id: string; dock: string; derived: { corners: EN[]; innerMid: EN; outerMid: EN; centroid: EN; headingDeg: number } }[];
  headwalks: Record<string, { osm_way: number; kind: string; line: EN[] }>;
  landMasks: { id: string; provenance: string; ring: EN[]; holes: number[] }[];
  osmContext: { osm_id: number; kind: string; name: string | null; ring: EN[] }[];
  masses: { id: string; kind: string; label: string; ring: EN[] }[];
  lines: { id: string; kind: string; label: string; line: EN[]; widthM: number }[];
  cityShipCanal: { ring: EN[] };
}
const OSM = JSON.parse(readFileSync(join(ROOT, 'data/buffalo-river-features.geojson'), 'utf8')) as { features: { properties: { osm_id: number }; geometry: { coordinates: number[][][] } }[] };
const site = JSON.parse(readFileSync(join(ROOT, 'data/derived/site-local.json'), 'utf8')) as SiteLocal;
const { positionToLocal } = await import('../src/scene/geo.ts');

const q = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const p2 = (p: EN): [number, number] => [q(p.east, 2), q(p.north, 2)];
const p1 = (p: EN): [number, number] => [q(p.east, 1), q(p.north, 1)];
const holeRing = (id: number) => {
  const f = OSM.features.find((x) => x.properties.osm_id === id);
  if (!f) throw new Error(`Hole ${id} missing from OSM features`);
  return (f.geometry.coordinates[0] ?? []).map(positionToLocal).map(p1);
};

const runtime = {
  schema: 'harbor-desk/site-runtime@1',
  generated_at: '2026-11-14',
  generator: 'scripts/build-site-runtime.ts from data/derived/site-local.json',
  frame: site.frame,
  provenance: {
    slips: 'ASSUME',
    headwalks: 'DOC (OpenStreetMap, ODbL)',
    land: 'ASSUME (authored masks; see data/GEOMETRY-VALIDATION.md)',
    osmContext: 'DOC (OpenStreetMap, ODbL)',
    masses: 'ASSUME (digitized from the 1 Jun 2022 ESD map, ±10 m)',
    canal: 'DOC (OpenStreetMap 31752570)',
  },
  slips: site.slips.map((s) => ({ id: s.id, dock: s.dock, corners: s.derived.corners.map(p2), inner: p2(s.derived.innerMid), outer: p2(s.derived.outerMid), centroid: p2(s.derived.centroid), headingDeg: s.derived.headingDeg })),
  headwalks: Object.fromEntries(Object.entries(site.headwalks).map(([d, h]) => [d, { osmWay: h.osm_way, kind: h.kind, line: h.line.map(p2) }])),
  land: site.landMasks.map((m) => ({ id: m.id, ring: m.ring.map(p1), holes: m.holes.map(holeRing) })),
  osmContext: site.osmContext.map((c) => ({ osmId: c.osm_id, kind: c.kind, ring: c.ring.map(p1) })),
  masses: site.masses.map((m) => ({ id: m.id, kind: m.kind, label: m.label, ring: m.ring.map(p1) })),
  lines: site.lines.map((l) => ({ id: l.id, kind: l.kind, label: l.label, line: l.line.map(p1), widthM: l.widthM })),
  canal: site.cityShipCanal.ring.map(p1),
};
const out = join(ROOT, 'data/derived/site-runtime.json');
writeFileSync(out, JSON.stringify(runtime) + '\n');
console.log(`Wrote ${out} (${(JSON.stringify(runtime).length / 1024).toFixed(1)} KB)`);
