/**
 * Which slip a client point is over: the nearest berth-mesh or hull hit, mirroring the click handlers in
 * Marina.tsx. Shared by the drag-to-assign picker (T30) and the debug bridge.
 */
import { Raycaster, Vector2, type Camera, type Object3D } from 'three';
import { SITE } from '../data/site.ts';

const ray = new Raycaster();
const ndc = new Vector2();

export function pickAt(camera: Camera, root: Object3D, canvas: DOMRect, x: number, y: number): { slipId: string } | { blockedBy: string } | null {
  ndc.set(((x - canvas.left) / canvas.width) * 2 - 1, -((y - canvas.top) / canvas.height) * 2 + 1);
  camera.updateMatrixWorld();
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObjects(root.children, true)) {
    // Outline rings and dashed contours are drawn on top but take no clicks (they have no handlers), so a
    // click passes through them to the berth: skip them here too.
    const o0 = hit.object as Object3D & { isLine2?: boolean; isLineSegments2?: boolean; isLine?: boolean };
    if (o0.isLine2 || o0.isLineSegments2 || o0.isLine) continue;
    if (hit.object.name === 'berth' && hit.faceIndex != null) {
      const s = SITE.slips[hit.faceIndex >> 1];
      return s ? { slipId: s.id } : null;
    }
    for (let o: Object3D | null = hit.object; o; o = o.parent) {
      const id = (o.userData as { slipId?: string }).slipId;
      if (o.name === 'hull' && id) return { slipId: id };
    }
    return { blockedBy: hit.object.name || hit.object.type };
  }
  return null;
}
