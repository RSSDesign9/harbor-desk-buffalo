/**
 * A moored boat (TASKS T09): one merged, authored geometry per boat, chosen by camera distance
 * (src/scene/assets/boat.ts). The object carries dimensions and colours only; names are generic
 * (`hull`) and never a vessel identity. The pivot is the centreline at the waterline, bow toward open water.
 * Contact shadows for all hulls are one instanced mesh in Marina.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Vector3, type Group, type PerspectiveCamera } from 'three';
import { lensScale } from './camera.ts';
import type { HullSpec } from './hulls.ts';
import type { BoatPlacement } from './layout.ts';
import { LOD_DISTANCES, boatGeometry, fallbackBoatGeometry, reportModelFailure, type BoatParams, type Lod } from './assets/boat.ts';
import { staleSurfaceMaterial, surfaceMaterial } from './materials.ts';
import { invalidateShadows } from './quality.ts';
import { NameBoard, type NameBoardData } from './NameBoard.tsx';

interface Props {
  spec: HullSpec;
  placement: BoatPlacement;
  /** Slip the hull sits in (debug/QA lookup only; never an identity). */
  slipId: string;
  /** Present only for a confirmed identity; a separate child mesh, so the hull geometry never changes. */
  nameBoard?: NameBoardData | null;
  onSelect?: (e: ThreeEvent<MouseEvent>) => void;
  onHover?: (over: boolean) => void;
  /** T30/T31: boats in transit and planned (assigned) boats are scenery: no picking, no hover. */
  interactive?: boolean;
}
const noRaycast = () => null;

/** Hysteresis so a boat near a threshold does not flip representation every frame. */
const HYSTERESIS = 1.08;

export function Boat({ spec, placement, slipId, nameBoard = null, onSelect, onHover, interactive = true }: Props) {
  const group = useRef<Group>(null);
  const world = useMemo(() => new Vector3(), []);
  const [lod, setLod] = useState<Lod>(1);
  const current = useRef<Lod>(1);
  const position = useMemo(() => new Vector3(placement.center[0], 0, -placement.center[1]), [placement.center]);
  const params = useMemo<BoatParams>(
    () => ({ family: spec.family, lengthM: placement.lengthM, beamM: placement.beamM, hull: spec.hullColor, canvas: spec.canvas }),
    [spec.family, spec.hullColor, spec.canvas, placement.lengthM, placement.beamM],
  );
  useFrame(({ camera }) => {
    // Distance the normal lens would need for this framing: on the 2° map lens every hull is the same size on
    // screen, so they share one level of detail (T29).
    // World position: a boat moved by a parent group (in transit, T31) is measured where it actually is.
    const at = group.current ? group.current.getWorldPosition(world) : position;
    const d = camera.position.distanceTo(at) / lensScale((camera as PerspectiveCamera).fov);
    const now = current.current;
    let next: Lod;
    if (now === 0) next = d > LOD_DISTANCES[0] * HYSTERESIS ? 1 : 0;
    else if (now === 1) next = d < LOD_DISTANCES[0] ? 0 : d > LOD_DISTANCES[1] * HYSTERESIS ? 2 : 1;
    else next = d < LOD_DISTANCES[1] ? 1 : 2;
    if (next !== now) {
      current.current = next;
      setLod(next);
    }
  });
  // A model that fails to build becomes a generic stand-in (T18); the hull stays selectable as its slip.
  const built = useMemo(() => {
    try {
      return { geometry: boatGeometry(params, lod), fallback: false };
    } catch {
      return { geometry: fallbackBoatGeometry(params.lengthM, params.beamM), fallback: true };
    }
  }, [params, lod]);
  const geometry = built.geometry;
  useEffect(() => {
    if (built.fallback) reportModelFailure();
  }, [built]);
  // A hull appearing, leaving or changing representation changes what casts a shadow.
  useEffect(() => {
    invalidateShadows();
    return invalidateShadows;
  }, [geometry, spec.stale, position, placement.yaw]);

  return (
    <group
      ref={group}
      name={interactive ? 'hull' : 'hull-transit'}
      userData={{ slipId, hullKey: spec.key, fallback: built.fallback }}
      position={position}
      rotation-y={placement.yaw}
      {...(interactive
        ? {
            onClick: (e: ThreeEvent<MouseEvent>) => onSelect?.(e),
            onPointerOver: (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onHover?.(true);
            },
            onPointerOut: () => onHover?.(false),
          }
        : {})}
    >
      <mesh geometry={geometry} material={spec.stale ? staleSurfaceMaterial() : surfaceMaterial()} castShadow={!spec.stale} receiveShadow userData={{ lod }} {...(interactive ? {} : { raycast: noRaycast })} />
      {nameBoard && lod === 0 && spec.family === 'cruiser' && !built.fallback ? <NameBoard data={nameBoard} lengthM={placement.lengthM} beamM={placement.beamM} /> : null}
    </group>
  );
}
