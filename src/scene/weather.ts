/**
 * T35 lake what-if in the scene: from a simulated lake sample to the wind on the water and the sky's overcast.
 * Pure. Below 12 kt nothing changes, so the calm day (5–11 kt) renders exactly as the approved views.
 */
import type { LakeSample } from '../domain/types.ts';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface SceneWeather {
  /** Direction the wind blows TOWARD, world x (east) / z (−north), unit length. */
  toward: [number, number];
  /** Ripple strength 0…1 (12 → 38 kt). */
  strength: number;
  /** Whitecaps 0…1 on open water (18 → 34 kt). */
  whitecaps: number;
  /** Overcast 0…0.85 (16 → 36 kt). */
  overcast: number;
}

export function sceneWeather(s: Pick<LakeSample, 'windFromDeg' | 'wind_kt'>): SceneWeather {
  const th = (s.windFromDeg * Math.PI) / 180;
  return {
    toward: [-Math.sin(th), Math.cos(th)],
    strength: clamp01((s.wind_kt - 12) / 26),
    whitecaps: clamp01((s.wind_kt - 18) / 16),
    overcast: 0.85 * clamp01((s.wind_kt - 16) / 20),
  };
}
