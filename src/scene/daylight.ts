/**
 * Time-of-day lighting (TASKS T31; refined in T33 with a sky colour overhead, a sun glow, clouds and a night
 * factor for lamps and windows). Pure: keyframes by local minute, interpolated.
 *
 * The 08:45–09:20 scenario window holds the authored mid-morning light exactly (azimuth 125°, elevation 40°,
 * materials.ts), so the approved views, the poster and the evidence stills do not change. Away from it the sun
 * follows a simplified Buffalo July day: low in the east-north-east after 06:00, high in the south in early
 * afternoon, low in the west-north-west before sunset (≈ 20:50), then dusk. Azimuths keep the authored
 * 25–30° southward bias near the scenario window so shadows still fall across the fingers.
 */
import { Color } from 'three';
import { SCENE_COLORS as S } from './palette.ts';

export interface Daylight {
  /** Compass degrees and elevation above the horizon. */
  azimuthDeg: number;
  elevationDeg: number;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
  /** Background and fog colour. */
  sky: string;
  /** Multiplier on the analytic sky reflection (1 by day). */
  skyLight: number;
  /** T33: colour overhead, the hemisphere fill that goes with it, and the glow around the sun. */
  zenith: string;
  fill: string;
  glow: string;
  /** 0 by day, 1 at night: lamps, lit windows and the stars follow it. */
  night: number;
  /** Cloud brightness against the sky (clouds go grey, then dark, after sunset). */
  cloud: string;
}

interface Key {
  min: number;
  az: number;
  el: number;
  sun: string;
  sunI: number;
  hemiI: number;
  sky: string;
  skyLight: number;
  zenith: string;
  fill: string;
  glow: string;
  night: number;
  cloud: string;
}
const m = (hh: number, mm = 0) => hh * 60 + mm;
const DAY: Key = { min: 0, az: 125, el: 40, sun: '#fff1dc', sunI: 2.9, hemiI: 1.08, sky: S.sky, skyLight: 1, zenith: S.skyZenith, fill: S.skyFill, glow: '#fff3d9', night: 0, cloud: '#f6f8fa' };
export const KEYS: readonly Key[] = [
  { min: m(6), az: 72, el: 7, sun: '#ffb877', sunI: 1.35, hemiI: 0.6, sky: '#e6c9ad', skyLight: 0.75, zenith: '#7f97b8', fill: '#a8b4c8', glow: '#ffc890', night: 0.12, cloud: '#f2d9c4' },
  { min: m(7, 30), az: 98, el: 24, sun: '#ffe0b8', sunI: 2.2, hemiI: 0.8, sky: '#d3dae0', skyLight: 0.92, zenith: '#82a4cc', fill: '#b3c5db', glow: '#ffe6c4', night: 0, cloud: '#f7f1e8' },
  { ...DAY, min: m(8, 45) },
  { ...DAY, min: m(9, 20) },
  { min: m(13, 30), az: 182, el: 66, sun: '#fff7ea', sunI: 2.95, hemiI: 0.95, sky: '#cddae6', skyLight: 1, zenith: '#6f9bd2', fill: '#b9cde6', glow: '#fff8ea', night: 0, cloud: '#fafbfc' },
  { min: m(17, 30), az: 258, el: 34, sun: '#ffedd0', sunI: 2.65, hemiI: 0.88, sky: '#d2d9de', skyLight: 1, zenith: '#7da2cf', fill: '#b6c8de', glow: '#fff0d2', night: 0, cloud: '#f8f4ec' },
  { min: m(19, 45), az: 288, el: 11, sun: '#ffb46c', sunI: 1.9, hemiI: 0.62, sky: '#ecc69a', skyLight: 0.8, zenith: '#7790b6', fill: '#a9b3c9', glow: '#ffbf7a', night: 0.1, cloud: '#f0cfae' },
  { min: m(20, 50), az: 301, el: 0, sun: '#ff8a4c', sunI: 0.5, hemiI: 0.55, sky: '#e39a70', skyLight: 0.55, zenith: '#4f6590', fill: '#8792b0', glow: '#ff9a5c', night: 0.7, cloud: '#b98f86' },
  { min: m(22), az: 318, el: -9, sun: '#6b7a99', sunI: 0, hemiI: 0.42, sky: '#27344c', skyLight: 0.3, zenith: '#0d1728', fill: '#7f93c2', glow: '#1c2740', night: 1, cloud: '#232d42' },
];

const mixHex = (a: string, b: string, k: number) => '#' + new Color(a).lerp(new Color(b), k).getHexString();

/** Lighting at a local minute of the day (clamped to 06:00–22:00). */
export function daylightAt(localMinute: number): Daylight {
  const t = Math.min(KEYS[KEYS.length - 1]!.min, Math.max(KEYS[0]!.min, localMinute));
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.min <= t) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const k = b.min === a.min ? 0 : (t - a.min) / (b.min - a.min);
  const f = (x: number, y: number) => x + (y - x) * k;
  return {
    azimuthDeg: f(a.az, b.az),
    elevationDeg: f(a.el, b.el),
    sunColor: mixHex(a.sun, b.sun, k),
    sunIntensity: f(a.sunI, b.sunI),
    hemiIntensity: f(a.hemiI, b.hemiI),
    sky: mixHex(a.sky, b.sky, k),
    skyLight: f(a.skyLight, b.skyLight),
    zenith: mixHex(a.zenith, b.zenith, k),
    fill: mixHex(a.fill, b.fill, k),
    glow: mixHex(a.glow, b.glow, k),
    night: f(a.night, b.night),
    cloud: mixHex(a.cloud, b.cloud, k),
  };
}

/** Unit vector toward the sun in scene axes (x = east, y = up, z = −north). */
export function sunDirection(d: Pick<Daylight, 'azimuthDeg' | 'elevationDeg'>): [number, number, number] {
  const az = (d.azimuthDeg * Math.PI) / 180;
  // Below the horizon the light keeps a grazing angle (it is dimmed to zero by intensity instead).
  const el = (Math.max(2, d.elevationDeg) * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

/** Local (America/New_York, EDT in July) minute of the day for a UTC ISO time. */
export function localMinuteOf(iso: string): number {
  const d = new Date(iso);
  return (((d.getUTCHours() - 4 + 24) % 24) * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60) % (24 * 60);
}

/**
 * T35 lake what-if: an overcast sky (0 = as authored, 1 = a heavy grey gale sky). The sun dims and greys, the
 * fill rises a little, the sky and clouds go to a cool grey. At 0 the daylight is returned unchanged.
 */
export function overcast(d: Daylight, o: number): Daylight {
  if (!(o > 0)) return d;
  const k = Math.min(1, o);
  const grey = mixHex('#9ea8b1', '#2a3240', d.night);
  return {
    ...d,
    sunColor: mixHex(d.sunColor, '#e9edf0', 0.6 * k),
    sunIntensity: d.sunIntensity * (1 - 0.62 * k),
    hemiIntensity: d.hemiIntensity * (1 + 0.12 * k),
    sky: mixHex(d.sky, grey, 0.65 * k),
    zenith: mixHex(d.zenith, mixHex('#7e8a96', '#1a2230', d.night), 0.7 * k),
    fill: mixHex(d.fill, '#b4bcc4', 0.5 * k),
    glow: mixHex(d.glow, grey, 0.8 * k),
    skyLight: d.skyLight * (1 - 0.18 * k),
    cloud: mixHex(d.cloud, mixHex('#c3c9cf', '#3a4250', d.night), 0.75 * k),
  };
}
