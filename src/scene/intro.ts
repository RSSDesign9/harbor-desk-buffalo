/**
 * Opening shot (TASKS T24, PRD F15). A poster still of the start pose covers the canvas until the scene has
 * drawn; then the camera makes one establishing move (waterfront overview → Dock B) and the poster fades.
 *
 * - The move never touches selection or scenario state; a click, key or wheel skips it to the end pose.
 * - Paused motion, OS reduced motion, or a selection restored from storage skip the move entirely.
 * - A tiny external store so the DOM poster and the camera rig agree without sharing React state.
 */
import { useSyncExternalStore } from 'react';

/** poster: scene not drawn yet · flying: establishing move running · done: the user has the camera. */
export type IntroPhase = 'poster' | 'flying' | 'done';

export const INTRO_DURATION_MS = 3000;
/** The camera holds the poster's pose while the poster fades, so the two never ghost (= token motion.duration.scene-in). */
export const POSTER_FADE_MS = 400;

let phase: IntroPhase = 'poster';
const listeners = new Set<() => void>();

export function setIntroPhase(next: IntroPhase): void {
  if (phase === next || phase === 'done') return; // the intro only moves forward
  phase = next;
  for (const l of listeners) l();
}
export const getIntroPhase = () => phase;
export function subscribeIntro(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const useIntroPhase = () => useSyncExternalStore(subscribeIntro, getIntroPhase, () => 'poster' as IntroPhase);

/** Poster files (scripts/render-poster.ts): ESTABLISHING_POSE at 1600×1000 with the desktop rail. */
export const POSTER = {
  src: '/assets/poster/harbor-1600.webp',
  srcSet: '/assets/poster/harbor-1600.webp 1600w, /assets/poster/harbor-2400.webp 2400w',
};
