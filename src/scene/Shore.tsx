/**
 * Waterfront surroundings (TASKS T15): the working yard’s hard-standing, roads and paths as one sheet of
 * ground paint; the grain elevator and sheds; stored boats on stands; the Skyway viaduct; revetment rock,
 * lamp posts and a restrained row of trees along the bank.
 *
 * All placement comes from src/scene/surroundings.ts (ASSUME; sources in data/GEOMETRY-VALIDATION.md).
 * Nothing here is selectable, labelled or counted: stored boats are scenery, not registry records.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import { SITE, type EN } from '../data/site.ts';
import { LAND_TOP } from './marina.ts';
import { paint, ribbon } from './shapes.ts';
import { addBoat, addFallbackBoat, boatGeometry, reportModelFailure } from './assets/boat.ts';
import { addBoatStand, addElevator, addShed, addViaduct, buildCar } from './assets/buildings.ts';
import { buildLampPost, buildRock } from './assets/dock.ts';
import { SCRUB_FORM, TREE_FORMS, TREE_FORMS_FAR, buildShrub, buildTree } from './assets/foliage.ts';
import { rng } from './assets/mesh.ts';
import { F } from './assets/finishes.ts';
import { MeshBuilder } from './assets/mesh.ts';
import type { Lod } from './assets/parts.ts';
import { groundContactMaterial, lampPoolMaterial, surfaceMaterial } from './materials.ts';
import { GROUND, groundMaterial } from './ground.ts';
import { gpuCapable } from './webgl.ts';
import { SCENE_COLORS as S } from './palette.ts';
import { invalidateShadows } from './quality.ts';
import { BUILDINGS, BUILDING_HEIGHTS as H, ROCK_FINE_DISTANCE, SKYWAY, lampPosts, parkedCars, promenadeRuns, revetmentChunks, scrubTrees, shrubs, storedBoats, trees, vergeRuns, type Placed, type StoredBoat } from './surroundings.ts';

export { LAND_TOP };
const noRaycast = () => null;
const place = (at: EN, y: number, yaw: number) => new Matrix4().makeRotationY(yaw).setPosition(at[0], y, -at[1]);
const toMatrix = (p: Placed, baseY = 0) => new Matrix4().compose(new Vector3(p.at[0], p.y + baseY, -p.at[1]), new Quaternion().setFromEuler(new Euler(p.tilt, p.yaw, p.tilt * 0.6)), new Vector3(...p.scale));

function Instances({ geometry, matrices, name, castShadow = false, tints }: { geometry: BufferGeometry; matrices: Matrix4[]; name: string; castShadow?: boolean; tints?: readonly Color[] }) {
  const set = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // Per-instance tint (multiplies the baked vertex colours): no two neighbours quite the same.
    if (tints) {
      tints.forEach((c, i) => mesh.setColorAt(i, c));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  };
  return <instancedMesh name={name} ref={set} args={[geometry, surfaceMaterial(), matrices.length]} castShadow={castShadow} receiveShadow raycast={noRaycast} />;
}

/** Hard-standing, parking, roads, lawn verge and the bank walk, painted in that order. */
function groundPaint(): BufferGeometry {
  const mass: Record<string, { color: string; kind: number }> = { 'boat-storage': { color: S.gravel, kind: GROUND.gravel }, parking: { color: S.asphalt, kind: GROUND.asphalt }, yard: { color: S.yard, kind: GROUND.concrete } };
  return paint([
    ...SITE.osmContext.filter((c) => c.kind === 'parking').map((c) => ({ ring: c.ring, color: S.yard, kind: GROUND.concrete })),
    ...SITE.masses.filter((m) => mass[m.kind]).map((m) => ({ ring: m.ring, ...mass[m.kind]! })),
    ...SITE.lines.filter((l) => l.kind === 'road').map((l) => ({ ring: ribbon(l.line, l.widthM), color: S.asphalt, kind: GROUND.asphalt })),
    ...vergeRuns().map((r) => ({ ring: ribbon(r.line, r.width), color: S.grass, kind: GROUND.grass })),
    ...promenadeRuns().map((r) => ({ ring: ribbon(r.line, r.width), color: S.paving, kind: GROUND.paving })),
    // T33: the walk is cast in slabs. A saw-cut joint across it at every station (3 m) and one down the middle.
    ...promenadeRuns().flatMap((r) => [
      { ring: ribbon(r.line, 0.07), color: S.pavingJoint, kind: GROUND.paving },
      ...r.line.slice(1, -1).map((p, i) => {
        const a = r.line[i]!;
        const b = r.line[i + 2]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const n: EN = [(-(b[1] - a[1]) / l) * (r.width / 2), ((b[0] - a[0]) / l) * (r.width / 2)];
        return { ring: ribbon([[p[0] - n[0], p[1] - n[1]], [p[0] + n[0], p[1] + n[1]]], 0.07), color: S.pavingJoint, kind: GROUND.paving };
      }),
    ]),
  ]);
}

function buildMasses(): BufferGeometry {
  const mb = new MeshBuilder();
  mb.with(place(BUILDINGS.elevator.center, LAND_TOP, BUILDINGS.elevator.yaw), () => addElevator(mb, BUILDINGS.elevator.length, BUILDINGS.elevator.width, { binHeight: H.elevatorBins }));
  mb.with(place(BUILDINGS.service.center, LAND_TOP, BUILDINGS.service.yaw), () => addShed(mb, BUILDINGS.service.length, BUILDINGS.service.width, H.serviceEave, H.serviceRidge, { doors: 3 }));
  mb.with(place(BUILDINGS.office.center, LAND_TOP, BUILDINGS.office.yaw), () => addShed(mb, BUILDINGS.office.length, BUILDINGS.office.width, H.officeEave, H.officeRidge, { windows: true, wall: F.officeWall }));
  const g = mb.build();
  g.name = 'yard-buildings';
  return g;
}

function buildSkyway(): BufferGeometry {
  const mb = new MeshBuilder();
  mb.with(place(SKYWAY.center, 0, SKYWAY.yaw), () => addViaduct(mb, SKYWAY.length, SKYWAY.width, H.skywayDeck));
  const g = mb.build();
  g.name = 'skyway';
  return g;
}

/** Height of the waterline above the ground for a hauled-out hull, and how far its keel hangs below it. */
function standing(b: StoredBoat): { lift: number; keel: number } {
  let keel = 0.5; // a stand-in sits on a plain stand if its model cannot be built
  try {
    keel = -boatGeometry(b.params, 2).boundingBox!.min.y;
  } catch {
    /* reported where the hull is drawn */
  }
  return { lift: keel + 0.5, keel };
}
/** Every stored boat and its stand in ONE geometry per level of detail (scenery: no per-boat objects). */
export function buildStoredBoats(stored: readonly StoredBoat[], lod: Lod): BufferGeometry {
  const mb = new MeshBuilder();
  let failed = 0;
  for (const b of stored) {
    const { lift, keel } = standing(b);
    mb.with(place(b.at, LAND_TOP, b.yaw), () => {
      addBoatStand(mb, b.params.lengthM, b.params.beamM, lift, keel);
      mb.with(new Matrix4().makeTranslation(0, lift, 0), () => {
        // T18: one failed boat model must not take down the scene; scenery gets the same plain stand-in.
        try {
          addBoat(mb, b.params, lod);
        } catch {
          addFallbackBoat(mb, b.params.lengthM, b.params.beamM);
          failed += 1;
        }
      });
    });
  }
  const g = mb.build();
  g.name = `stored-boats-lod${lod}`;
  g.userData.failedModels = failed;
  return g;
}

/** Stored boats swap to the cheap representation as a group when the camera is far from the yard. */
const STORED_LOD_DISTANCE = 300;
function StoredBoats({ stored }: { stored: readonly StoredBoat[] }) {
  const [lod, setLod] = useState<Lod>(2);
  const current = useRef<Lod>(2);
  const centre = useMemo(() => {
    const n = stored.length || 1;
    return new Vector3(stored.reduce((s, b) => s + b.at[0], 0) / n, LAND_TOP, -stored.reduce((s, b) => s + b.at[1], 0) / n);
  }, [stored]);
  useFrame(({ camera }) => {
    const d = camera.position.distanceTo(centre);
    const next: Lod = current.current === 2 ? (d < STORED_LOD_DISTANCE ? 1 : 2) : d > STORED_LOD_DISTANCE * 1.08 ? 2 : 1;
    if (next !== current.current) {
      current.current = next;
      setLod(next);
    }
  });
  const geometry = useMemo(() => buildStoredBoats(stored, lod), [stored, lod]);
  useEffect(() => {
    if ((geometry.userData.failedModels as number) > 0) reportModelFailure();
  }, [geometry]);
  useEffect(() => {
    invalidateShadows();
    return () => geometry.dispose();
  }, [geometry]);
  return <mesh name="stored-boats" userData={{ scenery: true, count: stored.length }} geometry={geometry} material={surfaceMaterial()} castShadow receiveShadow raycast={noRaycast} />;
}

/** Stone tone: wet and dark at the waterline, drier and paler up the bank, each stone a little different. */
function rockTint(r: Placed): Color {
  const h = Math.abs(Math.sin(r.at[0] * 12.9898 + r.at[1] * 78.233) * 43758.5453) % 1;
  const wet = Math.min(1, Math.max(0, (r.y - 0.05) / 0.5));
  const v = (0.5 + 0.5 * wet) * (0.84 + 0.3 * h);
  return new Color(v * (1 + 0.04 * (h - 0.5)), v, v * (0.97 - 0.05 * h));
}
/** Leaf tint for a tree or shrub: small seeded shifts in brightness and toward yellow or blue-green. */
function leafTint(rand: () => number): Color {
  const v = 0.86 + rand() * 0.26;
  const warm = rand() - 0.5;
  return new Color(v * (1 + warm * 0.2), v * (1 + warm * 0.05), v * (1 - warm * 0.16));
}
function leafTints(count: number, seed: number): Color[] {
  const rand = rng(seed);
  return Array.from({ length: count }, () => leafTint(rand));
}

/** Trees are grouped on a grid this size; inside `TREE_NEAR_M` of the camera a group draws the detailed models. */
const TREE_GROUP_M = 130;
const TREE_NEAR_M = 230;
interface TreeGroup {
  centre: Vector3;
  forms: { matrices: Matrix4[]; tints: Color[] }[];
}
function Trees({ groups, near, far }: { groups: TreeGroup[]; near: BufferGeometry[]; far: BufferGeometry[] }) {
  const [detail, setDetail] = useState('');
  const current = useRef('');
  useFrame(({ camera }) => {
    // One model for every distance (the lighter tier): nothing to swap, and no shadow redraws while orbiting.
    if (near === far) return;
    const was = current.current;
    const next = groups.map((g, i) => (camera.position.distanceTo(g.centre) < TREE_NEAR_M * (was[i] === '1' ? 1.1 : 1) ? '1' : '0')).join('');
    if (next !== was) {
      current.current = next;
      setDetail(next);
      invalidateShadows();
    }
  });
  return (
    <group name="tree-groups">
      {groups.flatMap((g, i) => {
        const fine = detail[i] === '1';
        return g.forms.map((f, k) => (f.matrices.length ? <Instances key={`${i}-${k}-${fine ? 'n' : 'f'}`} name="trees" geometry={(fine ? near : far)[k]!} matrices={f.matrices} tints={f.tints} castShadow /> : null));
      })}
    </group>
  );
}

/**
 * Revetment in bank chunks: a chunk near the camera draws every stone, a distant one draws a quarter as many,
 * larger. Stones cast no shadows, so a swap does not touch the shadow map.
 */
function Revetment({ rock }: { rock: BufferGeometry }) {
  const chunks = useMemo(
    () =>
      revetmentChunks().map((c) => ({
        centre: new Vector3(c.center[0], 0.6, -c.center[1]),
        fine: c.fine.map((r) => toMatrix(r)),
        coarse: c.coarse.map((r) => toMatrix(r)),
        fineTints: c.fine.map(rockTint),
        coarseTints: c.coarse.map(rockTint),
      })),
    [],
  );
  const [near, setNear] = useState<string>('');
  const current = useRef('');
  useFrame(({ camera }) => {
    const was = current.current;
    const next = chunks.map((c, i) => (camera.position.distanceTo(c.centre) < ROCK_FINE_DISTANCE * (was[i] === '1' ? 1.08 : 1) ? '1' : '0')).join('');
    if (next !== was) {
      current.current = next;
      setNear(next);
    }
  });
  return (
    <group name="revetment">
      {chunks.map((c, i) => {
        const fine = near[i] === '1';
        return <Instances key={`${i}-${fine ? 'f' : 'c'}`} name={fine ? 'revetment-fine' : 'revetment-coarse'} geometry={rock} matrices={fine ? c.fine : c.coarse} tints={fine ? c.fineTints : c.coarseTints} />;
      })}
    </group>
  );
}

/** Paint colours for parked cars: mostly white, silver, grey and black, as any car park is. */
const CAR_PAINT = ['#e9eaea', '#c2c6c9', '#8d9296', '#2b2e31', '#e9eaea', '#3d4f66', '#7d2a26', '#c2c6c9', '#4a4d4f', '#d8d3c4'];

/** A flat soft patch at a point: `w` across, `d` deep, turned by `yaw`. */
const patch = (at: EN, w: number, d: number, yaw = 0) =>
  new Matrix4().compose(new Vector3(at[0], LAND_TOP + 0.06, -at[1]), new Quaternion().setFromEuler(new Euler(0, yaw, 0)).multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))), new Vector3(w, d, 1));

/** Contact shading on the ground: one instanced mesh for every trunk, shrub, lamp, stored boat, car and wall foot. */
function LampPools({ matrices }: { matrices: Matrix4[] }) {
  const set = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  return (
    <instancedMesh name="lamp-pools" ref={set} args={[undefined, lampPoolMaterial(), matrices.length]} raycast={noRaycast} renderOrder={3}>
      <planeGeometry />
    </instancedMesh>
  );
}

function GroundContacts({ matrices }: { matrices: Matrix4[] }) {
  const set = (mesh: InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  return (
    <instancedMesh name="ground-contacts" ref={set} args={[undefined, groundContactMaterial(), matrices.length]} raycast={noRaycast} renderOrder={2}>
      <planeGeometry />
    </instancedMesh>
  );
}

export function Shore() {
  const built = useMemo(() => {
    // Software and low-power renderers (webgl.ts) get the lighter dressing: distant tree models everywhere,
    // every second scrub tree and parked car. Placement and everything a record refers to are identical.
    const lite = !gpuCapable();
    const thin = <T,>(list: T[]): T[] => (lite ? list.filter((_x, i) => i % 2 === 0) : list);
    const stored = storedBoats();
    const paintMaterial = groundMaterial({ vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    return {
      stored,
      paintMaterial,
      ground: groundPaint(),
      masses: buildMasses(),
      skyway: buildSkyway(),
      lamps: lampPosts().map((p) => place(p, LAND_TOP + 0.05, 0)),
      // Three tree forms, dealt by a seeded draw so neighbours differ, in 130 m groups that each pick the
      // detailed or the distant model by camera distance (T33).
      trees: (() => {
        const rand = rng(91);
        const groups = new Map<string, { centre: Vector3; forms: { matrices: Matrix4[]; tints: Color[] }[] }>();
        const tintRand = rng(100);
        for (const t of trees(stored)) {
          const roll = rand();
          const form = roll < 0.45 ? 0 : roll < 0.78 ? 1 : 2;
          const key = `${Math.floor(t.at[0] / TREE_GROUP_M)},${Math.floor(t.at[1] / TREE_GROUP_M)}`;
          const g = groups.get(key) ?? { centre: new Vector3(), forms: TREE_FORMS.map(() => ({ matrices: [] as Matrix4[], tints: [] as Color[] })) };
          groups.set(key, g);
          g.forms[form]!.matrices.push(toMatrix(t, LAND_TOP + 0.05));
          g.forms[form]!.tints.push(leafTint(tintRand));
          g.centre.add(new Vector3(t.at[0], 4, -t.at[1]));
        }
        return [...groups.values()].map((g) => ({ ...g, centre: g.centre.divideScalar(g.forms.reduce((n, f) => n + f.matrices.length, 0)) }));
      })(),
      treeNear: TREE_FORMS.map((f) => buildTree(f)),
      treeFar: TREE_FORMS_FAR.map((f) => buildTree(f)),
      shrubs: shrubs(stored).map((t) => toMatrix(t, LAND_TOP + 0.05)),
      shrub: buildShrub(),
      lite,
      scrub: thin(scrubTrees()).map((t) => toMatrix(t, LAND_TOP)),
      ...(() => {
        const cars = thin(parkedCars());
        const treeList = trees(stored);
        const contacts = [
          ...treeList.map((t) => patch(t.at, 3.4 * t.scale[0], 3.4 * t.scale[0])),
          ...shrubs(stored).map((t) => patch(t.at, 3 * t.scale[0], 3 * t.scale[0])),
          ...lampPosts().map((p) => patch(p, 1.1, 1.1)),
          ...stored.map((b) => patch(b.at, b.params.lengthM * 1.15, b.params.beamM * 1.7, b.yaw)),
          ...cars.map((c) => patch(c.at, 5.4, 2.7, c.yaw)),
          // Wall feet: a soft band along each side of each building.
          ...Object.values(BUILDINGS).flatMap((b) => {
            const ux: EN = [Math.cos(b.yaw), Math.sin(b.yaw)];
            const uz: EN = [Math.sin(b.yaw), -Math.cos(b.yaw)];
            const side = (k: number): EN => [b.center[0] + uz[0] * k, b.center[1] + uz[1] * k];
            const end = (k: number): EN => [b.center[0] + ux[0] * k, b.center[1] + ux[1] * k];
            return [patch(side(b.width / 2), b.length + 3, 5.5, b.yaw), patch(side(-b.width / 2), b.length + 3, 5.5, b.yaw), patch(end(b.length / 2), 5.5, b.width + 3, b.yaw), patch(end(-b.length / 2), 5.5, b.width + 3, b.yaw)];
          }),
        ];
        return {
          contacts,
          lampPools: lampPosts().map((p) => patch(p, 17, 17)),
          cars: cars.map((c) => place(c.at, LAND_TOP + 0.05, c.yaw)),
          carTints: cars.map((c) => new Color(CAR_PAINT[Math.floor(c.tone * CAR_PAINT.length) % CAR_PAINT.length]!)),
          car: buildCar(),
        };
      })(),
      scrubTree: buildTree(SCRUB_FORM),
      rock: buildRock(),
      lamp: buildLampPost(),
    };
  }, []);

  return (
    <group name="shore">
      {/* Painted after the land it lies on; it writes no depth, so its own layers never fight. */}
      <mesh name="ground-paint" geometry={built.ground} material={built.paintMaterial} position-y={LAND_TOP + 0.03} receiveShadow raycast={noRaycast} renderOrder={1} />
      <mesh name="yard-buildings" geometry={built.masses} material={surfaceMaterial()} castShadow receiveShadow raycast={noRaycast} />
      {/* Casts but does not receive: a 30 m-high deck 400 m from the working view only shows shadow-map banding. */}
      <mesh name="skyway" geometry={built.skyway} material={surfaceMaterial()} castShadow raycast={noRaycast} />
      <GroundContacts matrices={built.contacts} />
      <LampPools matrices={built.lampPools} />
      <StoredBoats stored={built.stored} />
      <Instances name="parked-cars" geometry={built.car} matrices={built.cars} tints={built.carTints} castShadow />
      <Revetment rock={built.rock} />
      <Instances name="lamp-posts" geometry={built.lamp} matrices={built.lamps} castShadow />
      <Trees groups={built.trees} near={built.lite ? built.treeFar : built.treeNear} far={built.treeFar} />
      <Instances name="shrubs" geometry={built.shrub} matrices={built.shrubs} tints={leafTints(built.shrubs.length, 200)} castShadow />
      <Instances name="scrub-trees" geometry={built.scrubTree} matrices={built.scrub} tints={leafTints(built.scrub.length, 300)} castShadow />
    </group>
  );
}
