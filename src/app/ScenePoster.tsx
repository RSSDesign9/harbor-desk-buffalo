/**
 * Poster still over the 3D canvas until the scene has drawn (TASKS T24, PRD F15): no blank canvas on a cold load.
 * It fades as the opening shot starts; under paused or reduced motion it is cut. Decorative: the canvas is
 * aria-hidden too, and the loading status underneath still announces progress.
 */
import { useEffect, useState } from 'react';
import { POSTER, POSTER_FADE_MS, getIntroPhase, useIntroPhase } from '../scene/intro.ts';
import { usePrefs, useReducedMotion } from './prefs.ts';

export function ScenePoster() {
  const phase = useIntroPhase();
  const prefs = usePrefs();
  const reduced = useReducedMotion();
  // A scene remounted after the intro (e.g. “Restart 3D view”) starts without the poster.
  const [gone, setGone] = useState(() => getIntroPhase() === 'done');
  const leaving = phase !== 'poster';
  // transitionend is not guaranteed (hidden tab, no transition): remove the poster when the fade must be over.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setGone(true), POSTER_FADE_MS + 150);
    return () => window.clearTimeout(t);
  }, [leaving]);
  if (gone || (leaving && (reduced || prefs.motionPaused))) return null;
  return (
    <img
      className="scene-poster"
      data-testid="scene-poster"
      data-state={leaving ? 'leaving' : 'shown'}
      src={POSTER.src}
      srcSet={POSTER.srcSet}
      sizes="100vw"
      alt=""
      aria-hidden="true"
      decoding="async"
      fetchPriority="high"
      onTransitionEnd={() => leaving && setGone(true)}
      onError={() => setGone(true)}
    />
  );
}
