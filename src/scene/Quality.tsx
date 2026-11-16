/** Adaptive pixel ratio while moving, full capped ratio at rest (see quality.ts). Renders nothing. */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MAX_DPR, SAMPLE_FRAMES, nextMovingDpr } from './quality.ts';

const REST_MS = 450;

export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const max = Math.min(MAX_DPR, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const moving = useRef(max);
  const applied = useRef(max);
  const samples = useRef<number[]>([]);
  const rest = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fast windows needed before stepping up, so the ratio does not oscillate around a threshold.
  const fastWindows = useRef(0);

  const apply = (dpr: number) => {
    if (applied.current === dpr) return;
    applied.current = dpr;
    setDpr(dpr);
  };

  // Ambient frames (drifting water, camera still) are not “moving”: they are throttled on purpose and must not
  // read as a slow GPU. Only frames in which the camera moved are sampled.
  const lastCam = useRef<number[]>([]);
  useFrame(({ camera }, delta) => {
    const m = camera.matrixWorld.elements;
    const still = lastCam.current.length === 16 && m.every((v, i) => Math.abs(v - lastCam.current[i]!) < 1e-6);
    lastCam.current = Array.from(m);
    if (still) return;
    const ms = delta * 1000;
    if (rest.current) clearTimeout(rest.current);
    // At rest: one sharp frame at the full capped ratio. (It is a single frame, so it is not sampled.)
    rest.current = setTimeout(() => {
      samples.current = [];
      apply(max);
    }, REST_MS);
    if (ms > 250) {
      // First frame after a pause: resume at the ratio that was holding while moving.
      samples.current = [];
      apply(moving.current);
      return;
    }
    samples.current.push(ms);
    if (samples.current.length < SAMPLE_FRAMES) return;
    const mean = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
    samples.current = [];
    let next = nextMovingDpr(moving.current, mean, max);
    if (next > moving.current) {
      fastWindows.current += 1;
      if (fastWindows.current < 6) next = moving.current;
      else fastWindows.current = 0;
    } else fastWindows.current = 0;
    moving.current = next;
    apply(next);
  });

  useEffect(
    () => () => {
      if (rest.current) clearTimeout(rest.current);
    },
    [],
  );
  return null;
}
