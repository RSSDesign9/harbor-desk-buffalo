/**
 * DOM → scene requests for view presets and reset. A tiny external store, so DOM controls and the
 * camera rig communicate without the camera ever touching selection state.
 */
import { useSyncExternalStore } from 'react';
import type { Preset } from './camera.ts';

export interface ViewRequest {
  preset: Preset;
  nonce: number;
}
let current: ViewRequest = { preset: 'overview', nonce: 0 };
const listeners = new Set<() => void>();

export function requestView(preset: Preset): void {
  setMapMode(preset === 'map');
  current = { preset, nonce: current.nonce + 1 };
  for (const l of listeners) l();
}
export const getViewRequest = () => current;
export function subscribeViewRequests(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const useViewRequest = () => useSyncExternalStore(subscribeViewRequests, getViewRequest);

/**
 * Whether the 3D dock map (T29) is up: status plates, slip numbers and the legend. Set when a map preset is
 * requested (or the opening shot lands on the map), cleared by any other preset. Orbiting, zooming and
 * selecting keep it. UI state only: it never touches selection or the scenario.
 */
let mapMode = false;
const mapListeners = new Set<() => void>();
export function setMapMode(on: boolean): void {
  if (mapMode === on) return;
  mapMode = on;
  for (const l of mapListeners) l();
}
export const getMapMode = () => mapMode;
const subscribeMapMode = (l: () => void) => {
  mapListeners.add(l);
  return () => mapListeners.delete(l);
};
export const useMapMode = () => useSyncExternalStore(subscribeMapMode, getMapMode, () => false);

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
