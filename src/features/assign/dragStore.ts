/**
 * Drag-to-assign UI state (T30). A tiny external store shared by the DOM request card and the 3D scene, like
 * viewRequests.ts. UI only: dragging never changes records; only a drop dispatches `assignRequest`.
 */
import { useSyncExternalStore } from 'react';

export interface AssignDrag {
  active: boolean;
  requestId: string | null;
  /** The slip under the pointer (scene, 3D map or 2D plan), or null. */
  hoverSlipId: string | null;
  /** Pointer, client px. */
  x: number;
  y: number;
}

let state: AssignDrag = { active: false, requestId: null, hoverSlipId: null, x: 0, y: 0 };
const listeners = new Set<() => void>();
export function setAssignDrag(patch: Partial<AssignDrag>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
export const getAssignDrag = () => state;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useAssignDrag = () => useSyncExternalStore(subscribe, getAssignDrag, () => state);
/**
 * Narrow subscriptions (T30 frame pacing): most consumers must NOT re-render on every pointer move, only when
 * the drag starts or stops, or when the slip under the pointer changes.
 */
export const useAssignDragActive = () => useSyncExternalStore(subscribe, () => state.active, () => false);
export const useAssignDragHover = () => useSyncExternalStore(subscribe, () => (state.active ? state.hoverSlipId : null), () => null);

/**
 * What is under a client point: the 3D scene registers a raycasting picker while it is mounted; otherwise
 * (or if the scene finds nothing) a 2D plan berth under the point counts too.
 */
type Picker = (x: number, y: number) => string | null;
let scenePicker: Picker | null = null;
export const setScenePicker = (p: Picker | null) => {
  scenePicker = p;
};
export function slipAtPoint(x: number, y: number): string | null {
  const el = typeof document === 'undefined' ? null : document.elementFromPoint(x, y);
  if (el?.tagName === 'CANVAS' && scenePicker) return scenePicker(x, y);
  const plan = el?.closest?.('[data-slip]');
  return plan ? plan.getAttribute('data-slip') : null;
}
