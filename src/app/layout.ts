/**
 * Layout mode from the CSS viewport width (PRD §6, DESIGN §9). Browser zoom changes the CSS width, so 200 %
 * zoom on a 1440 px window (720 CSS px) gets the compact layout instead of clipped controls.
 *   desktop ≥ 1280 · tablet 768–1279 · mobile < 768
 * Short viewports (< 560 CSS px tall, e.g. a laptop at 200 % zoom) also use the compact layout.
 */
import { useSyncExternalStore } from 'react';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';
export const QUERIES = {
  desktop: '(min-width: 1280px) and (min-height: 560px)',
  tablet: '(min-width: 768px) and (max-width: 1279.98px) and (min-height: 560px)',
} as const;

function current(): LayoutMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  if (window.matchMedia(QUERIES.desktop).matches) return 'desktop';
  if (window.matchMedia(QUERIES.tablet).matches) return 'tablet';
  return 'mobile';
}

function subscribe(l: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const qs = Object.values(QUERIES).map((q) => window.matchMedia(q));
  for (const q of qs) q.addEventListener('change', l);
  return () => {
    for (const q of qs) q.removeEventListener('change', l);
  };
}

export const useLayoutMode = () => useSyncExternalStore(subscribe, current, () => 'desktop' as LayoutMode);

/** Width the right rail takes from the 3D view, for camera framing. */
export function railInsetPx(mode: LayoutMode, railOpen: boolean): number {
  if (mode === 'desktop') return railOpen ? 360 + 24 + 16 : 0;
  if (mode === 'tablet') return railOpen ? 320 + 16 + 12 : 0;
  return 0;
}
