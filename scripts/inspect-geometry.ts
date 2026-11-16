/**
 * T02 — Reproducible geometry inspection for Harbor Desk.
 *
 *   npm run geometry            (node scripts/inspect-geometry.ts)
 *
 * Reads the ORIGINAL inputs (never modified):
 *   data/buffalo-river-features.geojson   OSM, DOC
 *   data/slips.geojson                    generated slips, ASSUME
 * Writes DERIVED outputs (safe to delete and regenerate):
 *   data/derived/site-local.json          local-metre geometry for the app, with provenance + source mapping
 *   data/derived/geometry-report.json     every check, its result and the measured numbers
 *   data/derived/site-plan-annotated.svg  annotated plan (render to PNG with scripts/render-plan.ts)
 *
 * Map anchors are manual picks on the official 1 June 2022 ESD site map
 * (data/reference/first-buffalo-site-map-2022.pdf rendered with `sips -s format png -Z 2400`, 2400×1553 px).
 * Pick uncertainty is about ±10 px (≈ ±6 m). Nothing here is survey-grade.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEET_TO_METRES, SITE_ORIGIN, bearingDeg, positionToLocal } from '../src/scene/geo.ts';
import {
  type Pt,
  add,
  applySimilarity,
  centroid,
  closestPointOnPolyline,
  convexOverlapArea,
  dist,
  dot,
  fitSimilarity,
  interiorAngles,
  invertSimilarity,
  norm,
  offsetPolyline,
  openRing,
  overlapWithPolygon,
  pointInPolygon,
  polylineLength,
  scale,
  sub,
} from '../src/scene/geometry2d.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'derived');
const GENERATED_AT = '2026-11-14';

// ---------- load originals ----------
interface Feature {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'LineString' | 'MultiPolygon'; coordinates: unknown };
  properties: Record<string, unknown>;
}
interface FC {
  type: 'FeatureCollection';
  features: Feature[];
  bbox?: number[];
  [k: string]: unknown;
}
const osm = JSON.parse(readFileSync(join(ROOT, 'data/buffalo-river-features.geojson'), 'utf8')) as FC;
const slipsFC = JSON.parse(readFileSync(join(ROOT, 'data/slips.geojson'), 'utf8')) as FC;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const P = (p: Pt) => ({ east: r2(p.east), north: r2(p.north) });

type Check = { id: string; title: string; pass: boolean; detail: string; data?: unknown };
const checks: Check[] = [];
const check = (id: string, title: string, pass: boolean, detail: string, data?: unknown) =>
  checks.push(data === undefined ? { id, title, pass, detail } : { id, title, pass, detail, data });

const osmById = new Map<number, Feature>();
for (const f of osm.features) osmById.set(Number(f.properties.osm_id), f);

function lineOf(id: number): Pt[] {
  const f = osmById.get(id);
  if (!f || f.geometry.type !== 'LineString') throw new Error(`OSM way ${id} missing or not a LineString`);
  return (f.geometry.coordinates as number[][]).map(positionToLocal);
}
function ringOf(f: Feature): Pt[] {
  return ((f.geometry.coordinates as number[][][])[0] ?? []).map(positionToLocal);
}

// ---------- 0. source inventory ----------
check('osm.count', 'OSM feature count matches baseline (146)', osm.features.length === 146, `${osm.features.length} features`);
check('osm.provenance', 'Every OSM feature carries provenance DOC',
  osm.features.every((f) => f.properties.provenance === 'DOC'),
  `${osm.features.filter((f) => f.properties.provenance !== 'DOC').length} without DOC`);
const missingSlipway = !osmById.has(934085281);
check('osm.slipway-934085281', 'Slipway cited by SLIPS.md (OSM 934085281) is present in supplied features', !missingSlipway,
  missingSlipway ? 'Not present. Only slipway in file is OSM 1073540134 (between headwalks D and C). Recorded, not fabricated.' : 'present');

// ---------- 1. slips: structure ----------
const EXPECTED: Record<string, { count: number; length_ft: number; width_ft: number; headwalk: number; kind: string }> = {
  A: { count: 39, length_ft: 25, width_ft: 10, headwalk: 934085283, kind: 'fixed' },
  B: { count: 37, length_ft: 30, width_ft: 11, headwalk: 934085288, kind: 'floating' },
  C: { count: 18, length_ft: 35, width_ft: 12.5, headwalk: 1073532827, kind: 'floating' },
  D: { count: 22, length_ft: 40, width_ft: 14, headwalk: 1073540143, kind: 'floating' },
  E: { count: 10, length_ft: 45, width_ft: 16, headwalk: 1073532822, kind: 'fixed' },
};
// Headwalk lengths stated in SLIPS.md (ft), for comparison only.
const SLIPS_MD_HEADWALK_FT: Record<string, string> = { A: '410', B: '234 + 226', C: '140 + 147', D: '349', E: '203' };

interface SlipOut {
  id: string;
  dock: string;
  number: number;
  length_ft: number;
  width_ft: number;
  dock_kind: string;
  headwalk_osm_way: number;
  provenance: string;
  basis: string;
  derived: {
    corners: { east: number; north: number }[];
    centroid: { east: number; north: number };
    /** Point on the headwalk side (berth entrance from the dock). */
    innerMid: { east: number; north: number };
    /** Point on the open-water side. */
    outerMid: { east: number; north: number };
    /** Compass bearing from dock toward open water, degrees. */
    headingDeg: number;
    measuredLength_m: number;
    measuredWidth_m: number;
    headwalkGap_m: number;
    chainage_m: number;
  };
}

const ids = new Set<string>();
const dupes: string[] = [];
const structuralFailures: string[] = [];
const slips: SlipOut[] = [];
const headwalkCache = new Map<number, Pt[]>();

for (const f of slipsFC.features) {
  const p = f.properties as Record<string, unknown>;
  const id = String(p.id);
  if (ids.has(id)) dupes.push(id);
  ids.add(id);
  const dock = String(p.dock);
  const number = Number(p.number);
  const exp = EXPECTED[dock];
  if (!/^[A-E]-\d{2}$/.test(id) || id !== `${dock}-${String(number).padStart(2, '0')}`) structuralFailures.push(`${id}: id does not match dock/number`);
  if (!exp) {
    structuralFailures.push(`${id}: unknown dock ${dock}`);
    continue;
  }
  if (p.provenance !== 'ASSUME') structuralFailures.push(`${id}: provenance ${String(p.provenance)}`);
  if (p.length_ft !== exp.length_ft || p.width_ft !== exp.width_ft) structuralFailures.push(`${id}: dims ${String(p.length_ft)}×${String(p.width_ft)} ≠ class`);
  if (p.headwalk_osm_way !== exp.headwalk) structuralFailures.push(`${id}: headwalk ${String(p.headwalk_osm_way)}`);
  if (p.dock_kind !== exp.kind) structuralFailures.push(`${id}: dock_kind ${String(p.dock_kind)}`);
  if (f.geometry.type !== 'Polygon') {
    structuralFailures.push(`${id}: geometry ${f.geometry.type}`);
    continue;
  }
  const raw = (f.geometry.coordinates as number[][][])[0] ?? [];
  const closed = raw.length > 0 && raw[0]![0] === raw[raw.length - 1]![0] && raw[0]![1] === raw[raw.length - 1]![1];
  const finite = raw.every((c) => c.length >= 2 && c.every(Number.isFinite));
  if (!closed) structuralFailures.push(`${id}: ring not closed`);
  if (!finite) structuralFailures.push(`${id}: non-finite coordinate`);
  if (raw.length !== 5) structuralFailures.push(`${id}: expected 4 corners + closing vertex, got ${raw.length}`);

  const corners = openRing(raw.map(positionToLocal));
  const headwalk = headwalkCache.get(exp.headwalk) ?? lineOf(exp.headwalk);
  headwalkCache.set(exp.headwalk, headwalk);
  // Width edges are the two short edges; the inner one is nearest the headwalk.
  const edges = corners.map((a, i) => ({ a, b: corners[(i + 1) % corners.length]!, i }));
  const sorted = [...edges].sort((x, y) => dist(x.a, x.b) - dist(y.a, y.b));
  const shortEdges = sorted.slice(0, 2);
  const longEdges = sorted.slice(2);
  const mids = shortEdges.map((e) => scale(add(e.a, e.b), 0.5));
  const gaps = mids.map((m) => closestPointOnPolyline(m, headwalk).distance);
  const innerIdx = gaps[0]! <= gaps[1]! ? 0 : 1;
  const innerMid = mids[innerIdx]!;
  const outerMid = mids[1 - innerIdx]!;
  const hit = closestPointOnPolyline(innerMid, headwalk);
  slips.push({
    id,
    dock,
    number,
    length_ft: Number(p.length_ft),
    width_ft: Number(p.width_ft),
    dock_kind: String(p.dock_kind),
    headwalk_osm_way: Number(p.headwalk_osm_way),
    provenance: String(p.provenance),
    basis: String(p.basis),
    derived: {
      corners: corners.map(P),
      centroid: P(centroid(corners)),
      innerMid: P(innerMid),
      outerMid: P(outerMid),
      headingDeg: r1(bearingDeg(innerMid, outerMid)),
      measuredLength_m: r2((dist(longEdges[0]!.a, longEdges[0]!.b) + dist(longEdges[1]!.a, longEdges[1]!.b)) / 2),
      measuredWidth_m: r2((dist(shortEdges[0]!.a, shortEdges[0]!.b) + dist(shortEdges[1]!.a, shortEdges[1]!.b)) / 2),
      headwalkGap_m: r2(hit.distance),
      chainage_m: r1(hit.chainage),
    },
  });
}

check('slips.count', 'Slip count is 126', slips.length === 126, `${slips.length}`);
const perDock = Object.fromEntries(Object.keys(EXPECTED).map((d) => [d, slips.filter((s) => s.dock === d).length]));
check('slips.per-dock', 'Per-dock counts A39/B37/C18/D22/E10',
  Object.entries(EXPECTED).every(([d, e]) => perDock[d] === e.count), JSON.stringify(perDock));
check('slips.ids-unique', 'Slip IDs unique', dupes.length === 0, dupes.length ? dupes.join(', ') : 'no duplicates');
const contiguous = Object.keys(EXPECTED).every((d) => {
  const nums = slips.filter((s) => s.dock === d).map((s) => s.number).sort((a, b) => a - b);
  return nums.every((n, i) => n === i + 1);
});
check('slips.numbering-contiguous', 'Numbers run 01…n per dock without gaps', contiguous, contiguous ? 'contiguous' : 'gaps found');
check('slips.canonical', 'B-10, B-12, B-14 exist', ['B-10', 'B-12', 'B-14'].every((i) => ids.has(i)), 'checked by id');
check('slips.structure', 'Rings closed, finite, 4 corners, provenance ASSUME, class dims, headwalk + kind match', structuralFailures.length === 0,
  structuralFailures.length ? `${structuralFailures.length} failures` : 'all 126 pass', structuralFailures.slice(0, 20));

// ---------- 2. dimensions / units ----------
const dimErrors: string[] = [];
let maxRelErr = 0;
let maxAngleErr = 0;
for (const s of slips) {
  const L = s.length_ft * FEET_TO_METRES;
  const W = s.width_ft * FEET_TO_METRES;
  const eL = Math.abs(s.derived.measuredLength_m - L) / L;
  const eW = Math.abs(s.derived.measuredWidth_m - W) / W;
  maxRelErr = Math.max(maxRelErr, eL, eW);
  if (eL > 0.03 || eW > 0.03) dimErrors.push(`${s.id}: ${s.derived.measuredLength_m}×${s.derived.measuredWidth_m} m vs ${r2(L)}×${r2(W)} m`);
  const angles = interiorAngles(s.derived.corners);
  maxAngleErr = Math.max(maxAngleErr, ...angles.map((a) => Math.abs(a - 90)));
}
check('slips.dimensions', 'Polygon size matches length_ft/width_ft within 3% (units are feet → metres at 0.3048)', dimErrors.length === 0,
  `max relative error ${(maxRelErr * 100).toFixed(2)}%`, dimErrors.slice(0, 10));
check('slips.rectangular', 'Slip corners are right angles within 2°', maxAngleErr < 2, `max deviation ${maxAngleErr.toFixed(2)}°`);

// ---------- 3. headwalk attachment ----------
const maxGap = Math.max(...slips.map((s) => s.derived.headwalkGap_m));
const farSlips = slips.filter((s) => s.derived.headwalkGap_m > 1.5).map((s) => `${s.id} (${s.derived.headwalkGap_m} m)`);
check('slips.headwalk-gap', 'Each slip’s inner edge lies within 1.5 m of its OSM headwalk', farSlips.length === 0,
  `max gap ${maxGap} m`, farSlips);

// ---------- 4. overlap ----------
const overlaps: string[] = [];
for (let i = 0; i < slips.length; i++) {
  for (let j = i + 1; j < slips.length; j++) {
    const a = slips[i]!;
    const b = slips[j]!;
    if (dist(a.derived.centroid, b.derived.centroid) > 30) continue;
    const ov = convexOverlapArea(a.derived.corners, b.derived.corners);
    if (ov > 0.05) overlaps.push(`${a.id}×${b.id}: ${r2(ov)} m²`);
  }
}
check('slips.overlap', 'No two slips overlap (>0.05 m²)', overlaps.length === 0, `${overlaps.length} overlapping pairs`, overlaps.slice(0, 30));

// spacing along each dock
const spacing: Record<string, { min: number; max: number; widthM: number }> = {};
for (const d of Object.keys(EXPECTED)) {
  const list = slips.filter((s) => s.dock === d).sort((a, b) => a.number - b.number);
  const gapsAlong: number[] = [];
  for (let i = 1; i < list.length; i++) gapsAlong.push(dist(list[i - 1]!.derived.centroid, list[i]!.derived.centroid));
  spacing[d] = { min: r2(Math.min(...gapsAlong)), max: r2(Math.max(...gapsAlong)), widthM: r2(EXPECTED[d]!.width_ft * FEET_TO_METRES) };
}
const runBreaks = Object.entries(spacing).filter(([, v]) => v.max > v.widthM * 1.5).map(([d, v]) => `${d}: max centre spacing ${v.max} m (width ${v.widthM} m) — a run break / gangway gap`);
check('slips.spacing', 'Centre spacing along each dock ≥ slip width (no squeezed berths)',
  Object.values(spacing).every((v) => v.min >= v.widthM - 0.05), JSON.stringify(spacing), runBreaks);

// ---------- 5. water side and land intersections ----------
const riverIds = [1216155152, 1517089936, 1517089942, 1517089941, 1517089940, 1517089939, 1517089937];
/** Chain OSM ways into one polyline by shared endpoints, oriented from the river mouth (west) upstream. */
function chainWays(wayIds: number[]): Pt[] {
  const pieces = wayIds.map(lineOf);
  pieces.sort((a, b) => Math.min(a[0]!.east, a[a.length - 1]!.east) - Math.min(b[0]!.east, b[b.length - 1]!.east));
  let chain = [...pieces.shift()!];
  if (chain[0]!.east > chain[chain.length - 1]!.east) chain.reverse();
  while (pieces.length) {
    const tail = chain[chain.length - 1]!;
    let bestI = -1;
    let bestRev = false;
    let bestD = Infinity;
    pieces.forEach((pc, i) => {
      const d0 = dist(pc[0]!, tail);
      const d1 = dist(pc[pc.length - 1]!, tail);
      if (d0 < bestD) [bestD, bestI, bestRev] = [d0, i, false];
      if (d1 < bestD) [bestD, bestI, bestRev] = [d1, i, true];
    });
    const next = pieces.splice(bestI, 1)[0]!;
    if (bestRev) next.reverse();
    if (bestD > 1) throw new Error(`River ways do not join (gap ${bestD.toFixed(1)} m)`);
    chain = chain.concat(next.slice(1));
  }
  return chain;
}
const riverLine = chainWays(riverIds);
const canalFeature = osmById.get(31752570)!;
const canalRing = ringOf(canalFeature);

const landFeatures = osm.features.filter((f) => ['parking', 'building', 'coastguard_station'].includes(String(f.properties.kind)) && f.geometry.type === 'Polygon');
const landHits: string[] = [];
for (const s of slips) {
  for (const f of landFeatures) {
    const ring = ringOf(f);
    if (!ring.some((p) => dist(p, s.derived.centroid) < 600)) continue;
    const ov = overlapWithPolygon(s.derived.corners, ring);
    if (ov > 0.25) landHits.push(`${s.id} overlaps OSM ${String(f.properties.osm_id)} (${String(f.properties.kind)}) by ≈${r1(ov)} m²`);
  }
}
check('slips.land', 'No slip polygon overlaps a mapped land/yard/building polygon', landHits.length === 0, `${landHits.length} overlaps`, landHits.slice(0, 30));

const waterPolys = osm.features.filter((f) => ['water', 'harbour_basin', 'marina'].includes(String(f.properties.kind)) && f.geometry.type === 'Polygon');
const inCanal = slips.filter((s) => pointInPolygon(s.derived.centroid, canalRing)).map((s) => s.id);
const inOtherWater = slips.filter((s) => !inCanal.includes(s.id) && waterPolys.some((f) => pointInPolygon(s.derived.centroid, ringOf(f)))).map((s) => s.id);
const unmapped = slips.filter((s) => !inCanal.includes(s.id) && !inOtherWater.includes(s.id)).map((s) => s.id);
const span = (list: string[]) => (list.length ? `${list[0]}…${list[list.length - 1]}` : 'none');
check('water.coverage', 'Every slip lies in a mapped water polygon (FLAG expected: river-mouth water is unmapped)', unmapped.length === 0,
  `${inCanal.length} slips (${span(inCanal)}) lie in OSM 31752570 “City Ship Canal”; ${unmapped.length} (${span(unmapped)}, incl. B-12) face the Buffalo River mouth, which the supplied file maps only as a centreline (OSM ${riverIds.join(', ')}). Repair: water plane + authored land masks; never close a partial polygon.`,
  { inCanal: inCanal.length, inOtherWater, unmapped });

// Distance from headwalks to the river centreline ≈ half river width on the site side.
const halfWidths = slips.map((s) => closestPointOnPolyline(s.derived.innerMid, riverLine).distance);

// ---------- 6. dock order and numbering direction ----------
const reachA = lineOf(934085283)[0]!;
const reachE = lineOf(1073532822)[0]!;
const reachDir = norm(sub(reachE, reachA));
const along = (p: Pt) => dot(sub(p, reachA), reachDir);
const dockOrder = Object.keys(EXPECTED)
  .map((d) => {
    const list = slips.filter((s) => s.dock === d);
    const c = scale(list.reduce((acc, s) => add(acc, s.derived.centroid), { east: 0, north: 0 }), 1 / list.length);
    const first = list.find((s) => s.number === 1)!;
    const last = list.reduce((m, s) => (s.number > m.number ? s : m));
    return { dock: d, alongM: r1(along(c)), firstAlongM: r1(along(first.derived.centroid)), lastAlongM: r1(along(last.derived.centroid)) };
  })
  .sort((a, b) => a.alongM - b.alongM);
const orderStr = dockOrder.map((d) => d.dock).join(' → ');
check('docks.order', 'Docks are lettered in order along the reach, downstream (NW) → upstream (SE), per SLIPS.md', orderStr === 'A → B → C → D → E',
  `Actual order NW→SE: ${orderStr}. IDs stay canonical; the lettering rule in SLIPS.md is not what the generated data does.`, dockOrder);
const numberingDir = dockOrder.map((d) => `${d.dock}: 01 at ${d.firstAlongM < d.lastAlongM ? 'NW (downstream)' : 'SE (upstream)'} end`);
check('docks.numbering-direction', 'Numbering direction is consistent across docks', new Set(numberingDir.map((s) => s.split(': ')[1])).size === 1,
  numberingDir.join('; '));

const headwalkLengths = Object.fromEntries(
  Object.entries(EXPECTED).map(([d, e]) => [d, { osm_m: r1(polylineLength(lineOf(e.headwalk))), osm_ft: Math.round(polylineLength(lineOf(e.headwalk)) / FEET_TO_METRES), slipsMd_ft: SLIPS_MD_HEADWALK_FT[d] }]),
);

// ---------- 7. official-map anchors ----------
// Picks on the 2400×1553 render. x right, y down. Converted to y-up for fitting.
const B_BREAK = scale(add(lineOf(934085288)[4]!, lineOf(934085288)[5]!), 0.5);
const anchors = [
  { id: 'R1', name: 'Dock A headwalk NW end ↔ headwalk at the 2022 site-boundary corner (map marker 2)', local: reachA, map: [640, 657.5] as [number, number] },
  { id: 'R2', name: 'Gap between Dock B’s two runs ↔ gangway at map marker 5', local: B_BREAK, map: [1075, 657.5] as [number, number] },
  { id: 'R3', name: 'Dock E headwalk SE end ↔ dock line end in the Skyway shadow (map marker 10)', local: reachE, map: [1850, 643.5] as [number, number] },
];
const yUp = ([x, y]: [number, number]): [number, number] => [x, -y];
const fit = fitSimilarity(anchors.map((a) => [a.local.east, a.local.north]), anchors.map((a) => yUp(a.map)));
const inv = invertSimilarity(fit);
const mapToLocal = (m: [number, number]): Pt => {
  const [e, n] = applySimilarity(inv, yUp(m));
  return { east: e, north: n };
};
const pxPerM = fit.s;
const anchorResults = anchors.map((a) => {
  const back = mapToLocal(a.map);
  return { id: a.id, name: a.name, local: P(a.local), map_px: a.map, residual_m: r1(dist(back, a.local)) };
});
// The map’s “up” direction expressed as a compass bearing in the local frame.
const mapUpBearing = (((fit.theta * 180) / Math.PI) % 360 + 360) % 360;

// Independent checks (not used in the fit)
const midRiverMap: [number, number] = [850, (167.5 + 658) / 2];
const midRiverLocal = mapToLocal(midRiverMap);
const midRiverToCentre = closestPointOnPolyline(midRiverLocal, riverLine).distance;
const cslip = osmById.get(371587071)!;
const cslipRing = ringOf(cslip);
const cslipMouth = cslipRing.reduce((m, p) => (p.north < m.north ? p : m));
const cslipMapLocal = mapToLocal([680, 160]);
const independent = [
  {
    id: 'C1',
    name: 'Mid-river on the map (between Canalside wharf edge and the dock line at x=850 px) vs OSM river centreline',
    residual_m: r1(midRiverToCentre),
    verdict: midRiverToCentre < 25 ? 'consistent' : 'inconsistent',
  },
  {
    id: 'C2',
    name: 'Candidate Commercial Slip mouth on the map (680,160 px) vs southern end of OSM 371587071 “Commercial Slip”',
    residual_m: r1(dist(cslipMapLocal, cslipMouth)),
    verdict: 'unresolved — identification of the map channel is uncertain; north-bank context stays approximate',
  },
];
check('anchors.fit', 'Three distributed dock anchors agree with the 2022 map within 15 m', anchorResults.every((a) => a.residual_m < 15),
  anchorResults.map((a) => `${a.id} ${a.residual_m} m`).join(', ') + `; scale ${r2(pxPerM)} px/m; map “up” points to bearing ${r1(mapUpBearing)}° (NE)`, { anchorResults, independent });

// ---------- 8. intended surrounding masses (digitized from the 2022 map, ASSUME) ----------
// Picks were made on a 2380-px-wide preview of the same render; scale to the 2400 frame.
const PREVIEW = 2400 / 2380;
const pv = (pts: [number, number][]) => pts.map(([x, y]) => mapToLocal([x * PREVIEW, y * PREVIEW])).map(P);
const masses = [
  { id: 'grain-elevator', kind: 'building', label: 'Grain elevator (map marker 7, “Grain Elevator Light Display”)', ring: pv([[1272, 650], [1440, 650], [1440, 712], [1272, 712]]), heightNote: 'Tall elevator; height not sourced — ASSUME massing only' },
  { id: 'service-building', kind: 'building', label: 'Service building (map marker 3)', ring: pv([[645, 828], [705, 828], [705, 865], [645, 865]]) },
  { id: 'small-building', kind: 'building', label: 'Small building beside storage area (map marker 6)', ring: pv([[1120, 680], [1152, 680], [1152, 706], [1120, 706]]) },
  { id: 'storage-4a', kind: 'boat-storage', label: 'Boat storage (map marker 4)', ring: pv([[712, 682], [1040, 682], [1055, 705], [1052, 795], [735, 795], [705, 770]]) },
  { id: 'storage-4b', kind: 'boat-storage', label: 'Boat storage along road (map marker 4)', ring: pv([[808, 826], [1350, 800], [1355, 862], [810, 875]]) },
  { id: 'storage-6', kind: 'boat-storage', label: 'Boat storage (map marker 6)', ring: pv([[1118, 676], [1205, 676], [1220, 700], [1212, 782], [1102, 782]]) },
  { id: 'parking-8', kind: 'parking', label: 'Parking (map marker 8)', ring: pv([[1370, 792], [1565, 782], [1568, 860], [1365, 862]]) },
  { id: 'yard-9', kind: 'yard', label: 'Yard (map marker 9)', ring: pv([[1580, 685], [1840, 676], [1852, 858], [1580, 860]]) },
  { id: 'site-boundary-2022', kind: 'boundary', label: '2022 site boundary (red dash-dot on map)', ring: pv([[520, 868], [632, 625], [1855, 605], [1860, 860], [1300, 880]]) },
];
const lines = [
  { id: 'skyway', kind: 'bridge', label: 'Skyway (NY-5) deck centreline, approx. 28 m wide', line: pv([[1240, 70], [2300, 860]]), widthM: 28 },
  { id: 'fuhrmann-blvd', kind: 'road', label: 'Fuhrmann Blvd', line: pv([[520, 870], [1300, 882], [1860, 876], [2300, 895]]), widthM: 12 },
  { id: 'service-road', kind: 'road', label: 'Service road (approximate)', line: pv([[560, 800], [760, 790], [1060, 800], [1250, 772], [1600, 765], [1860, 770]]), widthM: 7 },
  { id: 'gangway-marker-5', kind: 'gangway', label: 'Gangway at map marker 5', line: pv([[1075, 640], [1075, 700]]), widthM: 2 },
  { id: 'canalside-wharf-edge', kind: 'bank', label: 'North bank wharf edge (Canalside side)', line: pv([[700, 165], [1300, 185]]), widthM: 0 },
];

// ---------- 9. land masks (water repair strategy) ----------
// Strategy: water is a plane at sea level; land is drawn only where there is land evidence.
// A partial water polygon is never closed across the site. Three masks:
//   land-west  the marina side, bank authored just behind the headwalks (ASSUME offsets, checked
//              against the yard polygon and the City Ship Canal’s DOC west edge)
//   land-east  the peninsula between the City Ship Canal and the river: the canal polygon’s DOC east
//              edge plus an ASSUMED river south bank (centreline offset by an assumed half-width)
//   land-north the Canalside side: wharf edge digitized from the 2022 map (ASSUME)
const BANK_OFFSET = { A: 1.0, B: 3.0 } as const;
const mainRuns: Record<string, Pt[]> = {
  A: lineOf(934085283).slice(0, 3),
  B: lineOf(934085288).slice(1),
  D: lineOf(1073540143).slice(2, 6),
  C: lineOf(1073532827).slice(1, 4),
  E: [...lineOf(1073532822).slice(0, 3)].reverse(),
};
const runInfo: Record<string, { mainRun_m: number; slipSpan_m: number }> = {};
for (const d of ['A', 'B', 'D', 'C', 'E']) {
  const list = slips.filter((s) => s.dock === d);
  const ch = list.map((s) => s.derived.chainage_m);
  runInfo[d] = { mainRun_m: r1(polylineLength(mainRuns[d]!)), slipSpan_m: r1(Math.max(...ch) - Math.min(...ch) + EXPECTED[d]!.width_ft * FEET_TO_METRES) };
}
check('docks.headwalk-lengths', 'Headwalk lengths vs SLIPS.md (informational)', true,
  `${JSON.stringify(headwalkLengths)}; main runs and slip spans ${JSON.stringify(runInfo)}. SLIPS.md’s stated lengths do not match OSM; slips occupy part of each run.`);

// (a) North of the canal mouth (Dock A, Dock B first run) no shoreline is mapped: author one just behind the headwalk.
const canalPts = openRing(canalRing);
const canalTipWest = canalPts.reduce((m, p) => (p.north > -60 && p.east < m.east ? p : m), { east: Infinity, north: 0 });
const bank: Pt[] = [];
for (const d of ['A', 'B'] as const) {
  let run = mainRuns[d]!;
  if (d === 'B') run = run.filter((p) => p.north > canalTipWest.north + 4); // first run only
  const sample = slips.find((s) => s.dock === d)!;
  const toWater = norm(sub(sample.derived.outerMid, sample.derived.innerMid));
  const t = norm(sub(run[run.length - 1]!, run[0]!));
  const leftIsWater = t.east * toWater.north - t.north * toWater.east >= 0;
  bank.push(...offsetPolyline(run, (leftIsWater ? -1 : 1) * BANK_OFFSET[d]));
}
// (b) From the canal mouth south-east, the canal polygon’s west edge is documented shoreline (it shares vertices with the yard).
const tipIdx = canalPts.indexOf(canalTipWest);
for (let i = 0; i < canalPts.length; i++) {
  const p = canalPts[(tipIdx - i + canalPts.length) % canalPts.length]!; // walk backwards = south-east along the west edge
  if (p.north < -700) break;
  bank.push(p);
}
const bankStart = add(bank[0]!, scale(reachDir, -120));
const siteBank = [bankStart, ...bank];
const bankEnd = siteBank[siteBank.length - 1]!;
const inland = scale({ east: -reachDir.north, north: reachDir.east }, -1); // right of the NW→SE reach = SW = inland
const INLAND_M = 400;
const landWest = [...siteBank, add(bankEnd, scale(inland, INLAND_M)), add(bankStart, scale(inland, INLAND_M))];

const yard = osmById.get(1073548174)!;
const yardRing = ringOf(yard);
const yardOutsideMask = yardRing.filter((p) => !pointInPolygon(p, landWest) && closestPointOnPolyline(p, siteBank).distance > 1.0).length; // ±1 m: within source uncertainty
check('yard.within-land', 'OSM 1073548174 (kind parking; SLIPS.md “boatyard”) lies on the land side of the bank (±1 m)', yardOutsideMask === 0,
  `${yardOutsideMask} of ${yardRing.length} vertices fall on the water side (authored offsets A ${BANK_OFFSET.A} m, B ${BANK_OFFSET.B} m; canal west edge used south-east of the mouth)`);

// land-east: canal east edge (DOC) from the mouth south-east, then the river’s assumed south-west bank back toward the mouth.
const canalTipEast = canalPts.reduce((m, p) => (p.north > -60 && p.east > m.east ? p : m), { east: -Infinity, north: 0 });
const eastEdge: Pt[] = [];
for (let i = 0; i < canalPts.length; i++) {
  const p = canalPts[(canalPts.indexOf(canalTipEast) + i) % canalPts.length]!;
  if (p.north < -700) break;
  eastEdge.push(p);
}
const RIVER_HALF_WIDTH_M = 45; // ASSUME — not sourced; keeps the river visibly navigable
const riverSW = offsetPolyline(riverLine, -RIVER_HALF_WIDTH_M).filter((p) => p.north < canalTipEast.north + 40 && p.north > -720 && p.east > canalTipEast.east);
const landEast = [...eastEdge, ...[...riverSW].reverse()];

// land-north: Canalside wharf edge from the map, extended along its own direction (ASSUME).
const wharf = lines.find((l) => l.id === 'canalside-wharf-edge')!.line;
const wDir = norm(sub(wharf[1]!, wharf[0]!));
const northBank = [add(wharf[0]!, scale(wDir, -400)), wharf[0]!, wharf[1]!, add(wharf[1]!, scale(wDir, 60))];
const outward = { east: -wDir.north, north: wDir.east }; // left of travel = away from the water
const landNorth = [...northBank, add(northBank[3]!, scale(outward, 300)), add(northBank[0]!, scale(outward, 300))];

// Documented water always cuts authored land: any mapped water polygon touching a mask becomes a hole in it.
const holesFor = (ring: Pt[]) =>
  waterPolys
    .filter((f) => Number(f.properties.osm_id) !== 31752570)
    .filter((f) => ringOf(f).some((p) => pointInPolygon(p, ring)))
    .map((f) => Number(f.properties.osm_id));

const masksRings = { 'land-west': landWest, 'land-east': landEast, 'land-north': landNorth };
const maskHoles: Record<string, number[]> = Object.fromEntries(Object.entries(masksRings).map(([k, r]) => [k, holesFor(r)]));
const holeRings = new Map<number, Pt[]>(Object.values(maskHoles).flat().map((id) => [id, ringOf(osmById.get(id)!)]));
/** True when a point is on authored land: inside a mask and not inside one of that mask’s documented-water holes. */
const onLand = (p: Pt) =>
  Object.entries(masksRings).some(([k, r]) => pointInPolygon(p, r) && !maskHoles[k]!.some((id) => pointInPolygon(p, holeRings.get(id)!)));
const slipsOnLand = slips.filter((s) => s.derived.corners.some(onLand)).map((s) => s.id);
check('water.mask-clear', 'No land mask covers any slip corner', slipsOnLand.length === 0, `${slipsOnLand.length} slips touched`, slipsOnLand);

const riverInLand = riverLine.filter((p) => dist(p, reachA) < 1200 && onLand(p)).length;
check('water.river-open', 'River centreline near the site stays in open water (not under a land mask)', riverInLand === 0, `${riverInLand} centreline vertices under land`);

const canalSamples = (() => {
  let inside = 0;
  let underLand = 0;
  for (let e = -50; e < 600; e += 4) for (let n = -720; n < 20; n += 4) {
    const p = { east: e, north: n };
    if (!pointInPolygon(p, canalRing)) continue;
    inside++;
    if (onLand(p)) underLand++;
  }
  return { inside, underLand, fraction: r2(underLand / Math.max(1, inside)) };
})();
check('water.canal-open', 'City Ship Canal (OSM 31752570) stays open water: ≤3% of its mapped area under land masks', canalSamples.fraction <= 0.03,
  `${canalSamples.underLand} of ${canalSamples.inside} 4 m samples under land (${(canalSamples.fraction * 100).toFixed(1)}%)`);

const otherWaterUnderLand = waterPolys
  .filter((f) => Number(f.properties.osm_id) !== 31752570)
  .map((f) => {
    const ring = ringOf(f);
    // Probe the interior: vertices sit on shared boundaries and are ambiguous.
    const c = centroid(ring);
    const probes = [c, ...openRing(ring).map((p) => add(p, scale(sub(c, p), 0.2)))].filter((p) => pointInPolygon(p, ring));
    return { osm_id: f.properties.osm_id, kind: f.properties.kind, probesOnLand: probes.filter(onLand).length, of: probes.length };
  })
  .filter((x) => x.probesOnLand > 0);
check('water.other-open', 'No other mapped water polygon is covered by authored land (documented water cuts holes in masks)', otherWaterUnderLand.length === 0,
  otherWaterUnderLand.length ? JSON.stringify(otherWaterUnderLand) : `none covered; holes ${JSON.stringify(maskHoles)}`);

// Water side, judged against land evidence (not the schematic centreline, which cuts across the mouth near Dock A).
const waterSideFail = slips.filter((s) => {
  const outerOnLand = onLand(s.derived.outerMid) || landFeatures.some((f) => pointInPolygon(s.derived.outerMid, ringOf(f)));
  const away = closestPointOnPolyline(s.derived.outerMid, siteBank).distance > closestPointOnPolyline(s.derived.innerMid, siteBank).distance + 5;
  return outerOnLand || !away;
}).map((s) => s.id);
check('slips.water-side', 'Every slip opens away from the site bank into water (outer edge on no land evidence)', waterSideFail.length === 0,
  waterSideFail.length ? `${waterSideFail.length} fail` : 'all 126 open into water', waterSideFail);

const riverWidthAtB12 = (() => {
  const b = slips.find((s) => s.id === 'B-12')!;
  return r1(closestPointOnPolyline(b.derived.innerMid, northBank).distance);
})();
// ---------- 10. canonical slips ----------
const canon = ['B-10', 'B-12', 'B-14'].map((id) => slips.find((s) => s.id === id)!);
const b12 = canon[1]!;
check('b12.context', 'B-12 sits on Dock B’s first run between B-10 and B-14', canon[0]!.derived.chainage_m < b12.derived.chainage_m && b12.derived.chainage_m < canon[2]!.derived.chainage_m,
  `B-12 centroid ${JSON.stringify(b12.derived.centroid)} m, heading ${b12.derived.headingDeg}°, gap to headwalk ${b12.derived.headwalkGap_m} m; ≈${r1(dist(b12.derived.innerMid, B_BREAK))} m from the marker-5 gangway; ≈${r1(halfWidths[slips.indexOf(b12)]!)} m to the schematic river centreline; faces the river mouth, just north of the City Ship Canal polygon`);

// ---------- write outputs ----------
mkdirSync(OUT, { recursive: true });
const siteLocal = {
  schema: 'harbor-desk/site-local@1',
  generated_at: GENERATED_AT,
  generator: 'scripts/inspect-geometry.ts',
  frame: {
    origin: SITE_ORIGIN,
    units: 'metres',
    axes: 'east (+x scene), north (−z scene), up (+y scene)',
    projection: 'Local tangent plane: equirectangular with WGS84 meridian/prime-vertical radii at origin latitude. Few-cm error over the working area; not a survey datum.',
  },
  provenance_note:
    'Headwalks, river centreline and OSM polygons: DOC (OpenStreetMap, ODbL, fetched 2026-11-14) — documented source, not current survey. Slips: ASSUME (generated). Masses, bank, land masks and map-derived features: ASSUME (digitized from the 1 June 2022 ESD site map via a 3-anchor similarity fit; ±10 m).',
  sources: [
    { id: 'osm-harbor', path: 'data/buffalo-river-features.geojson', provenance: 'DOC' },
    { id: 'slips', path: 'data/slips.geojson', provenance: 'ASSUME' },
    { id: 'esd-site-map-2022', path: 'data/reference/first-buffalo-site-map-2022.pdf', url: 'https://www.esd.ny.gov/sites/default/files/rfp/Exhibit-A-Site-Map-First-Buffalo-Marina-Operator.pdf', date: '2022-06-01', provenance: 'DOC' },
  ],
  mapFit: { anchors: anchorResults, independentChecks: independent, pxPerMetre: r2(pxPerM), note: 'Similarity transform local metres → 2400-px render (y up). Used only to place approximate context.' },
  headwalks: Object.fromEntries(Object.entries(EXPECTED).map(([d, e]) => [d, { osm_way: e.headwalk, kind: e.kind, provenance: 'DOC', line: lineOf(e.headwalk).map(P) }])),
  slips,
  river: { centreline: riverLine.map(P), osm_ways: riverIds, provenance: 'DOC', approxWidthAtB12_m: riverWidthAtB12 },
  waterStrategy: 'Water is a plane at sea level. Land masks are drawn only where land evidence exists. Partial OSM water polygons are never closed across the site.',
  cityShipCanal: { osm_id: 31752570, provenance: 'DOC', ring: openRing(canalRing).map(P) },
  landMasks: [
    { id: 'land-west', provenance: 'ASSUME', basis: `Marina side. North of the canal mouth: bank authored ${BANK_OFFSET.A} m (Dock A) / ${BANK_OFFSET.B} m (Dock B first run) behind the OSM headwalks. South-east of the mouth: the City Ship Canal west edge (DOC, OSM 31752570). Closes ${INLAND_M} m inland.`, ring: landWest.map(P), holes: maskHoles['land-west'] },
    { id: 'land-east', provenance: 'ASSUME', basis: `Peninsula between the City Ship Canal and the river: canal east edge (DOC, OSM 31752570) + river bank assumed ${RIVER_HALF_WIDTH_M} m from the OSM centreline`, ring: landEast.map(P), holes: maskHoles['land-east'] },
    { id: 'land-north', provenance: 'ASSUME', basis: 'Canalside side: wharf edge digitized from the 2022 map, extended; closes inland', ring: landNorth.map(P), holes: maskHoles['land-north'] },
  ],
  osmContext: landFeatures
    .filter((f) => ringOf(f).some((p) => Math.abs(p.east) < 900 && Math.abs(p.north) < 900))
    .map((f) => ({ osm_id: f.properties.osm_id, kind: f.properties.kind, name: f.properties.name ?? null, provenance: 'DOC', ring: ringOf(f).map(P) })),
  slipway: { osm_id: 1073540134, provenance: 'DOC', line: lineOf(1073540134).map(P) },
  masses,
  lines,
};
writeFileSync(join(OUT, 'site-local.json'), JSON.stringify(siteLocal, null, 1));

const report = {
  generated_at: GENERATED_AT,
  generator: 'scripts/inspect-geometry.ts',
  summary: { total: checks.length, passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).map((c) => c.id) },
  checks,
  measurements: {
    headwalkLengths,
    spacing,
    halfRiverWidthFromHeadwalks_m: { min: r1(Math.min(...halfWidths)), max: r1(Math.max(...halfWidths)) },
    riverWidthAtB12_m: riverWidthAtB12,
    canonical: canon.map((s) => ({ id: s.id, centroid: s.derived.centroid, headingDeg: s.derived.headingDeg, chainage_m: s.derived.chainage_m })),
  },
};
writeFileSync(join(OUT, 'geometry-report.json'), JSON.stringify(report, null, 1));

// ---------- annotated plan SVG (reach-aligned, north arrow) ----------
const rot = -(Math.atan2(reachDir.north, reachDir.east)); // rotate so reach runs left→right
const cR = Math.cos(rot);
const sR = Math.sin(rot);
const PX = 1.6; // px per metre
const W = 1600;
const H = 1000;
const cx = W / 2 - 40;
const cy = H / 2 + 60;
const pc = { east: (reachA.east + reachE.east) / 2, north: (reachA.north + reachE.north) / 2 };
const tp = (p: Pt) => {
  const x = p.east - pc.east;
  const y = p.north - pc.north;
  return [r1(cx + PX * (cR * x - sR * y)), r1(cy - PX * (sR * x + cR * y))] as const;
};
const pts = (arr: readonly Pt[]) => arr.map((p) => tp(p).join(',')).join(' ');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Mono, Menlo, monospace">`;
svg += `<rect width="${W}" height="${H}" fill="#9ecefc"/>`;
svg += `<polygon points="${pts(canalRing)}" fill="#82bdff" stroke="#0a6e8a" stroke-width="1"><title>City Ship Canal OSM 31752570 (DOC)</title></polygon>`;
svg += `<polygon points="${pts(landWest)}" fill="#cec58a" stroke="#233747" stroke-width="1"/>`;
svg += `<polygon points="${pts(landEast)}" fill="#cec58a" stroke="#233747" stroke-width="1" stroke-dasharray="6 4"/>`;
svg += `<polygon points="${pts(landNorth)}" fill="#cec58a" stroke="#233747" stroke-width="1" stroke-dasharray="6 4"/>`;
for (const f of siteLocal.osmContext) svg += `<polygon points="${pts(f.ring)}" fill="#b09e56" fill-opacity="0.45" stroke="#3f5464" stroke-width="0.8"><title>OSM ${f.osm_id} ${f.kind}</title></polygon>`;
for (const m of masses) {
  const boundary = m.kind === 'boundary';
  svg += `<polygon points="${pts(m.ring)}" fill="${boundary ? 'none' : m.kind === 'building' ? '#7b7265' : '#e6e5df'}" fill-opacity="${boundary ? 0 : 0.75}" stroke="${boundary ? '#dc3127' : '#233747'}" stroke-width="${boundary ? 1.6 : 0.8}" stroke-dasharray="${boundary ? '10 4 2 4' : '4 3'}"><title>${esc(m.label)} (ASSUME, digitized)</title></polygon>`;
}
for (const l of lines) {
  const stroke = l.kind === 'bridge' ? '#748491' : l.kind === 'bank' ? '#233747' : '#bbb9ad';
  svg += `<polyline points="${pts(l.line)}" fill="none" stroke="${stroke}" stroke-width="${Math.max(1.5, l.widthM * PX)}" stroke-opacity="${l.kind === 'bridge' ? 0.55 : 0.9}" stroke-dasharray="${l.kind === 'road' ? '' : '8 4'}"><title>${esc(l.label)}</title></polyline>`;
}
svg += `<polyline points="${pts(riverLine)}" fill="none" stroke="#0a6e8a" stroke-width="1.2" stroke-dasharray="10 6"/>`;
for (const [d, e] of Object.entries(EXPECTED)) svg += `<polyline points="${pts(lineOf(e.headwalk))}" fill="none" stroke="#011b2b" stroke-width="2.4"><title>Headwalk ${d} OSM ${e.headwalk}</title></polyline>`;
svg += `<polyline points="${pts(lineOf(1073540134))}" fill="none" stroke="#c842c6" stroke-width="3"><title>Slipway OSM 1073540134</title></polyline>`;
for (const s of slips) {
  const isCanon = ['B-10', 'B-12', 'B-14'].includes(s.id);
  svg += `<polygon points="${pts(s.derived.corners)}" fill="${s.id === 'B-12' ? '#ff4d00' : isCanon ? '#ffac00' : '#ffffff'}" fill-opacity="${isCanon ? 0.9 : 0.55}" stroke="#233747" stroke-width="0.5"><title>${s.id}</title></polygon>`;
}
// dock letters
for (const d of dockOrder) {
  const list = slips.filter((s) => s.dock === d.dock);
  const c = scale(list.reduce((acc, s) => add(acc, s.derived.outerMid), { east: 0, north: 0 }), 1 / list.length);
  const [x, y] = tp(add(c, scale(norm(sub(list[0]!.derived.outerMid, list[0]!.derived.innerMid)), 18)));
  const first = list.find((s) => s.number === 1)!;
  const [fx, fy] = tp(first.derived.outerMid);
  svg += `<text x="${x}" y="${y}" font-size="22" font-weight="600" fill="#011b2b" text-anchor="middle">${d.dock}</text>`;
  svg += `<text x="${fx}" y="${fy - 8}" font-size="10" fill="#011b2b" text-anchor="middle">${d.dock}-01</text>`;
}
// canonical callouts
canon.forEach((s, i) => {
  const [x, y] = tp(s.derived.outerMid);
  const ty = y - 70 - i * 22;
  svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${ty + 4}" stroke="#011b2b" stroke-width="0.8"/>`;
  svg += `<rect x="${x - 30}" y="${ty - 14}" width="60" height="18" rx="3" fill="${s.id === 'B-12' ? '#ff4d00' : '#ffffff'}" stroke="#011b2b" stroke-width="0.8"/>`;
  svg += `<text x="${x}" y="${ty - 1}" font-size="12" fill="#011b2b" text-anchor="middle">${s.id}</text>`;
});
// anchors
for (const a of anchors) {
  const [x, y] = tp(a.local);
  svg += `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#2d62ff" stroke-width="2"/><text x="${x + 10}" y="${y + 22}" font-size="12" fill="#2d62ff">${a.id} · ${anchorResults.find((r) => r.id === a.id)!.residual_m} m</text>`;
}
// labels for context
const label = (p: Pt, text: string, size = 12, color = '#233747') => {
  const [x, y] = tp(p);
  svg += `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle">${esc(text)}</text>`;
};
label(centroid(masses[0]!.ring), 'Grain elevator (approx.)', 11);
label(centroid(masses[1]!.ring), 'Service bldg', 10);
label(lines[0]!.line[0]!, '', 10);
{
  const sky = lines[0]!.line;
  label(add(scale(add(sky[0]!, sky[1]!), 0.5), { east: 0, north: 0 }), 'Skyway (approx.)', 12);
}
label(add(midRiverLocal, { east: 0, north: 0 }), 'BUFFALO RIVER MOUTH (unmapped water)', 16, '#0a6e8a');
label(centroid(canalRing.filter((p) => p.north > -400)), 'CITY SHIP CANAL (OSM)', 14, '#0a6e8a');
label(add(northBank[1]!, scale(outward, 40)), 'Canalside side (north bank, approximate)', 12);
label(add(eastEdge[3]!, { east: 80, north: 20 }), 'Peninsula (approx.)', 12);
label(add(siteBank[Math.floor(siteBank.length / 2)]!, scale(inland, 150)), 'Fuhrmann Blvd side', 12);
label(centroid(yardRing), 'OSM 1073548174 (kind: parking)', 10, '#3f5464');
// north arrow
{
  const nx = W - 90;
  const ny = 120;
  const n = { east: 0, north: 1 };
  const dx = cR * n.east - sR * n.north;
  const dy = -(sR * n.east + cR * n.north);
  svg += `<g><circle cx="${nx}" cy="${ny}" r="38" fill="#ffffff" fill-opacity="0.85" stroke="#233747"/><line x1="${nx - dx * 28}" y1="${ny - dy * 28}" x2="${nx + dx * 28}" y2="${ny + dy * 28}" stroke="#011b2b" stroke-width="2"/><circle cx="${nx + dx * 28}" cy="${ny + dy * 28}" r="4" fill="#ff4d00"/><text x="${nx + dx * 52}" y="${ny + dy * 52 + 5}" font-size="16" font-weight="600" text-anchor="middle" fill="#011b2b">N</text></g>`;
}
// scale bar
svg += `<g transform="translate(40 ${H - 60})"><rect x="-10" y="-30" width="${100 * PX + 120}" height="50" fill="#ffffff" fill-opacity="0.85"/><line x1="0" y1="0" x2="${100 * PX}" y2="0" stroke="#011b2b" stroke-width="3"/><line x1="${50 * PX}" y1="-5" x2="${50 * PX}" y2="5" stroke="#011b2b"/><text x="0" y="-10" font-size="12" fill="#011b2b">0</text><text x="${100 * PX}" y="-10" font-size="12" fill="#011b2b">100 m</text></g>`;
// legend / annotations
const notes = [
  'Harbor Desk · geometry validation plan · generated by scripts/inspect-geometry.ts',
  'Reach-aligned like the 2022 map (NW left, SE right, NE up). Local frame origin 42.8742 N, 78.8806 W. 1.6 px = 1 m.',
  'DOC: OSM headwalks (black), river centreline (dashed teal), OSM yard/parking/buildings (olive).',
  'ASSUME: 126 slips (white; B-12 orange, B-10/B-14 amber). Banks, land masks, dashed masses and roads digitized from the 1 Jun 2022 ESD map (±10 m).',
  `Anchors R1–R3 (blue): fit residuals ${anchorResults.map((a) => a.residual_m).join(' / ')} m. North-bank Commercial Slip candidate off by ${independent[1]!.residual_m} m: north bank approximate.`,
  `Finding: dock letters run ${orderStr} along the reach (not A→E). Numbering direction differs by dock. IDs kept canonical.`,
  'Finding: docks sit on the WEST BANK OF THE CITY SHIP CANAL at the Buffalo River mouth (B-20…E-10 in the OSM canal polygon). Not “between Michigan Ave and Ohio St”.',
  'Finding: river-mouth water (A-01…B-19, incl. B-12) is unmapped; water is a plane under authored land masks. Slipway OSM 934085281 (SLIPS.md) absent.',
  'Slip polygons are berth water space, not decking. Not a survey; not navigation guidance.',
];
svg += `<g transform="translate(24 24)"><rect x="-8" y="-6" width="980" height="${notes.length * 18 + 14}" fill="#ffffff" fill-opacity="0.88" rx="6"/>`;
notes.forEach((t, i) => (svg += `<text x="0" y="${12 + i * 18}" font-size="${i === 0 ? 13 : 11.5}" font-weight="${i === 0 ? 600 : 400}" fill="#011b2b">${esc(t)}</text>`));
svg += `</g>`;
// inset: Dock B detail around B-12
{
  const ix = W - 470;
  const iy = H - 330;
  const IW = 440;
  const IH = 300;
  const k = 9; // px per metre
  const c0 = b12.derived.centroid;
  const ti = (p: Pt) => {
    const x = p.east - c0.east;
    const y = p.north - c0.north;
    return [r1(ix + IW / 2 + k * (cR * x - sR * y)), r1(iy + IH / 2 - k * (sR * x + cR * y))] as const;
  };
  const ip = (arr: readonly Pt[]) => arr.map((p) => ti(p).join(',')).join(' ');
  svg += `<defs><clipPath id="inset"><rect x="${ix}" y="${iy}" width="${IW}" height="${IH}"/></clipPath></defs>`;
  svg += `<rect x="${ix}" y="${iy}" width="${IW}" height="${IH}" fill="#9ecefc" stroke="#011b2b" stroke-width="1.5"/>`;
  svg += `<g clip-path="url(#inset)"><polygon points="${ip(landWest)}" fill="#cec58a"/><polyline points="${ip(lineOf(934085288))}" fill="none" stroke="#011b2b" stroke-width="${2.4 * k * 0.4}"/>`;
  for (const s of slips.filter((x) => x.dock === 'B' && Math.abs(x.number - 12) <= 5)) {
    svg += `<polygon points="${ip(s.derived.corners)}" fill="${s.id === 'B-12' ? '#ff4d00' : ['B-10', 'B-14'].includes(s.id) ? '#ffac00' : '#ffffff'}" fill-opacity="0.85" stroke="#233747" stroke-width="1"/>`;
    const [x, y] = ti(s.derived.outerMid);
    svg += `<text x="${x}" y="${y}" font-size="11" text-anchor="middle" fill="#011b2b" dy="-4">${s.id}</text>`;
  }
  svg += `</g><text x="${ix + 8}" y="${iy + 18}" font-size="12" font-weight="600" fill="#011b2b">Dock B detail · B-07…B-17 · 9 px = 1 m</text>`;
  svg += `<text x="${ix + 8}" y="${iy + IH - 10}" font-size="11" fill="#011b2b">Bank 3 m behind floating headwalk (ASSUME).</text>`;
}
svg += `</svg>`;
writeFileSync(join(OUT, 'site-plan-annotated.svg'), svg);

// ---------- console summary ----------
const failed = checks.filter((c) => !c.pass);
console.log(`Geometry inspection: ${checks.length - failed.length}/${checks.length} checks pass.`);
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FLAG'}  ${c.id.padEnd(28)} ${c.detail}`);
console.log('Outputs: data/derived/site-local.json, data/derived/geometry-report.json, data/derived/site-plan-annotated.svg');
