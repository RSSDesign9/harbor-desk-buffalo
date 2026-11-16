/**
 * Display preferences (T17): chart/light theme, solid panels, pause motion, and the 3D-vs-plan choice on small
 * screens (T29: `auto` = the 3D dock map on a capable GPU, the plan otherwise). UI-only: never part of the domain session, stored under their own key, and tolerant of storage
 * failure (they then last for the tab). The OS reduced-motion preference is read live, including changes.
 */
import { useSyncExternalStore } from 'react';

export interface Prefs {
  theme: 'dark' | 'light';
  solidPanels: boolean;
  motionPaused: boolean;
  /** Map on a small screen: `auto` follows the GPU probe (T29); `3d` / `plan` are the user's explicit choice. */
  mobileView: 'auto' | '3d' | 'plan';
}

export const PREFS_KEY = 'harbor-desk:prefs';
const DEFAULTS: Prefs = { theme: 'dark', solidPanels: false, motionPaused: false, mobileView: 'auto' };

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Prefs> & { mobile3d?: boolean };
    // Before T29 the choice was a boolean that defaulted to false (the plan): only `true` was a real choice.
    const mobileView = v.mobileView === '3d' || v.mobileView === 'plan' || v.mobileView === 'auto' ? v.mobileView : v.mobile3d === true ? '3d' : 'auto';
    return {
      theme: v.theme === 'light' ? 'light' : 'dark',
      solidPanels: v.solidPanels === true,
      motionPaused: v.motionPaused === true,
      mobileView,
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs: Prefs = typeof window === 'undefined' ? DEFAULTS : read();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function applyToDocument(p: Prefs) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  root.dataset.solidPanels = String(p.solidPanels);
  root.dataset.motion = p.motionPaused ? 'paused' : 'running';
}
if (typeof document !== 'undefined') applyToDocument(prefs);

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  applyToDocument(prefs);
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: the preference lasts for this tab */
  }
  for (const l of listeners) l();
}

export const getPrefs = () => prefs;
export const usePrefs = () => useSyncExternalStore(subscribe, getPrefs, () => DEFAULTS);

// ---------- reduced motion (live) ----------
const reducedQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const subscribeReduced = (l: () => void) => {
  reducedQuery?.addEventListener('change', l);
  return () => reducedQuery?.removeEventListener('change', l);
};
export const prefersReduced = () => reducedQuery?.matches === true;
export const useReducedMotion = () => useSyncExternalStore(subscribeReduced, prefersReduced, () => false);

/** Continuous (ambient) motion runs only when neither the user nor the OS asked for stillness. */
export const ambientMotionAllowed = () => !prefs.motionPaused && !prefersReduced();
export function useAmbientMotion(): boolean {
  const p = usePrefs();
  const reduced = useReducedMotion();
  return !p.motionPaused && !reduced;
}
