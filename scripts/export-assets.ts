/**
 * Asset regeneration / export path (TASKS T09). The editable sources are the parametric generators in
 * src/scene/assets/*.ts; the app runs them directly, so there is no binary to keep in sync. This script
 * runs the SAME generators in Node and writes:
 *
 *   data/derived/asset-report.json   triangle/vertex counts, bounding boxes and pivot checks per asset and LOD
 *   design/assets-export/*.glb       (with --glb) inspection copies for Blender or any glTF viewer; not shipped
 *
 *   npm run assets          regenerate the report
 *   npm run assets:check    fail if the committed report differs from the generators
 *   npm run assets:glb      also write the GLB inspection copies
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mesh, MeshStandardMaterial, Scene, type BufferGeometry } from 'three';
import { buildBoat, LOD_DISTANCES, type BoatParams, type Lod } from '../src/scene/assets/boat.ts';
import { DOCK_PARTS } from '../src/scene/assets/dock.ts';
import { BUILDING_PARTS } from '../src/scene/assets/buildings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEET = 0.3048;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Representative boats: the B-12 observation hull, and one of each other family at fixture sizes. */
const BOATS: { id: string; note: string; params: BoatParams }[] = [
  { id: 'cabin-cruiser-observed', note: 'Slip-class cruiser with the changed (sand) canvas cover: the B-12 observation hull', params: { family: 'cruiser', lengthM: 28.5 * FEET, beamM: 9.7 * FEET, hull: 'white', canvas: 'sand' } },
  { id: 'cabin-cruiser-navy', note: 'Cabin cruiser, slate hull, navy canvas', params: { family: 'cruiser', lengthM: 26 * FEET, beamM: 8.8 * FEET, hull: 'slate', canvas: 'navy' } },
  { id: 'cabin-cruiser-open', note: 'Cabin cruiser without canvas (open cockpit, radar arch)', params: { family: 'cruiser', lengthM: 28 * FEET, beamM: 9.5 * FEET, hull: 'white', canvas: 'none' } },
  { id: 'center-console', note: 'Small powerboat: center console with T-top and outboard', params: { family: 'console', lengthM: 24 * FEET, beamM: 8.5 * FEET, hull: 'white', canvas: 'navy' } },
  { id: 'sailboat', note: 'Keelboat with mast, boom, sail cover and standing rigging', params: { family: 'sail', lengthM: 27 * FEET, beamM: 9.2 * FEET, hull: 'white', canvas: 'sand' } },
];

function describe(g: BufferGeometry) {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count * 3; i++) if (!Number.isFinite(pos.array[i]!)) throw new Error(`${g.name}: non-finite vertex`);
  return {
    triangles: g.getIndex()!.count / 3,
    vertices: pos.count,
    bbox_m: { min: [r3(b.min.x), r3(b.min.y), r3(b.min.z)] as [number, number, number], max: [r3(b.max.x), r3(b.max.y), r3(b.max.z)] as [number, number, number] },
    geometryBytes: pos.count * (3 + 3 + 3 + 2 + 2) * 4 + g.getIndex()!.count * 4,
  };
}

const report = {
  schema: 'harbor-desk/asset-report@1',
  generator: 'scripts/export-assets.ts from src/scene/assets/*.ts',
  conventions: 'metres; +y up; bow toward +x; pivot on the centreline at the waterline (y = 0); one draw call per asset',
  lodDistances_m: LOD_DISTANCES,
  boats: BOATS.map((b) => {
    const lods = ([0, 1, 2] as Lod[]).map((lod) => ({ lod, ...describe(buildBoat(b.params, lod)) }));
    const box = lods[0]!.bbox_m;
    return {
      id: b.id,
      note: b.note,
      params: { ...b.params, lengthM: r3(b.params.lengthM), beamM: r3(b.params.beamM) },
      // Pivot checks: overall length matches LOA, the hull is centred on z, and the keel is below the waterline.
      checks: { lengthMatchesLoa: Math.abs(box.max[0] - box.min[0] - b.params.lengthM) < 0.45, centredOnZ: Math.abs(box.max[2] + box.min[2]) < 0.02, sitsInWater: box.min[1] < 0 && box.min[1] > -0.6 },
      lods,
    };
  }),
  dock: Object.entries(DOCK_PARTS).map(([id, make]) => ({ id, ...describe(make()) })),
  surroundings: Object.entries(BUILDING_PARTS).map(([id, make]) => ({ id, ...describe(make()) })),
};

const out = join(ROOT, 'data/derived/asset-report.json');
const json = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== json) {
    console.error('data/derived/asset-report.json is out of date with src/scene/assets. Run `npm run assets`.');
    process.exit(1);
  }
  console.log('asset-report.json matches the generators.');
} else {
  writeFileSync(out, json);
  console.log(`Wrote ${out}`);
  for (const b of report.boats) console.log(`  ${b.id}: ${b.lods.map((l) => `LOD${l.lod} ${l.triangles} tris`).join(' · ')}  ${JSON.stringify(b.checks)}`);
  for (const d of [...report.dock, ...report.surroundings]) console.log(`  ${d.id}: ${d.triangles} tris`);
}

if (process.argv.includes('--glb')) {
  // GLTFExporter expects the browser FileReader; Node has Blob but not FileReader.
  (globalThis as unknown as { FileReader: unknown }).FileReader = class {
    result: ArrayBuffer | string | null = null;
    onloadend: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((b) => {
        this.result = b;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((b) => {
        this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
        this.onloadend?.();
      });
    }
  };
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const dir = join(ROOT, 'design/assets-export');
  mkdirSync(dir, { recursive: true });
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: 2 });
  const write = async (name: string, geos: BufferGeometry[]) => {
    const scene = new Scene();
    geos.forEach((g, i) => {
      const clean = g.clone();
      clean.deleteAttribute('surf'); // custom attribute; colours and normals carry the look
      clean.deleteAttribute('uv');
      const m = new Mesh(clean, material);
      m.name = g.name;
      m.position.z = i * 6;
      scene.add(m);
    });
    const buf = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
    writeFileSync(join(dir, `${name}.glb`), Buffer.from(buf));
    console.log(`  ${name}.glb ${buf.byteLength} bytes`);
  };
  for (const b of BOATS) await write(b.id, ([0, 1, 2] as Lod[]).map((lod) => buildBoat(b.params, lod)));
  await write('dock-parts', Object.values(DOCK_PARTS).map((make) => make()));
  await write('surroundings', Object.values(BUILDING_PARTS).map((make) => make()));
}
