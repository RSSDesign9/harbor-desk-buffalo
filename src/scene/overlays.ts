/**
 * Whether scene overlays (selection/hover/review outlines and markers) are drawn. Always on in the product;
 * only the `?debug` bridge turns them off, so evidence stills can be rendered from the clean scene
 * (scripts/render-evidence.ts). A tiny external store, like viewRequests.ts.
 */
import { useSyncExternalStore } from 'react';

let visible = true;
const listeners = new Set<() => void>();
export function setOverlaysVisible(v: boolean): void {
  visible = v;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useOverlaysVisible = () => useSyncExternalStore(subscribe, () => visible);
