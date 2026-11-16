/**
 * Lake conditions (TASKS T35, PRD F23 option E). Pure and deterministic.
 *
 * A what-if lens over the simulated lake series (SIM, shapes ASSUME via SRC-LAKE): the water level at the marina
 * relative to the still-water level the assumed depths refer to, and the wind. The fit check reads the extremes
 * over a request's stay; the scene and the conditions strip read the value at the clock.
 */
import type { FixtureBundle, IsoTime, LakeSample, LakeScenario, LakeScenarioId, TransientRequest } from './types.ts';
import { formatClock, localDate, toMs } from './time.ts';

export const LAKE_SCENARIO_IDS: readonly LakeScenarioId[] = ['calm', 'sw-gale'];
export const isLakeScenarioId = (v: unknown): v is LakeScenarioId => v === 'calm' || v === 'sw-gale';

/** NWS Great Lakes gale band starts at 34 kt (SRC-NWS-MARINE). The 20 kt tight line is an assumption (SRC-LAKE). */
export const GALE_KT = 34;
export const EXPOSED_TIGHT_KT = 20;
/** Wind directions (from) that blow across the river mouth into the open berths: west-south-west, 200–300° (ASSUME). */
export const OPEN_SECTOR_DEG: readonly [number, number] = [200, 300];

export function lakeScenario(fx: FixtureBundle, id: LakeScenarioId): LakeScenario | undefined {
  return fx.lakeScenarios.find((l) => l.id === id);
}

/** The series at a moment: linear between samples, held at the ends. */
export function lakeAt(sc: LakeScenario, t: IsoTime): LakeSample {
  const s = sc.samples;
  const ms = toMs(t);
  if (ms <= toMs(s[0]!.at)) return { ...s[0]!, at: t };
  const last = s[s.length - 1]!;
  if (ms >= toMs(last.at)) return { ...last, at: t };
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (toMs(s[mid]!.at) <= ms) lo = mid;
    else hi = mid;
  }
  const a = s[lo]!;
  const b = s[hi]!;
  const f = (ms - toMs(a.at)) / (toMs(b.at) - toMs(a.at));
  const mix = (x: number, y: number) => x + (y - x) * f;
  // Direction: the short way round.
  const d = ((((b.windFromDeg - a.windFromDeg) % 360) + 540) % 360) - 180;
  return {
    at: t,
    level_ft: Math.round(mix(a.level_ft, b.level_ft) * 10) / 10,
    windFromDeg: Math.round((a.windFromDeg + d * f + 360) % 360),
    wind_kt: Math.round(mix(a.wind_kt, b.wind_kt)),
    gust_kt: Math.round(mix(a.gust_kt, b.gust_kt)),
  };
}

/** The demo stay: from the start of the arrival window to the end of it plus the nights booked. */
export function stayWindow(req: Pick<TransientRequest, 'arrivalFrom' | 'arrivalTo' | 'nights'>): readonly [IsoTime, IsoTime] {
  return [req.arrivalFrom, new Date(toMs(req.arrivalTo) + req.nights * 86400000).toISOString().replace('.000Z', 'Z')];
}

export const inOpenSector = (deg: number) => deg >= OPEN_SECTOR_DEG[0] && deg <= OPEN_SECTOR_DEG[1];

/** What the fit check needs from the lake over a stay: the low and high water and the strongest onshore wind. */
export interface StayConditions {
  scenario: LakeScenarioId;
  /** Local calendar day of the stay's start, for wording times on later days. */
  day: string;
  low: { level_ft: number; at: IsoTime };
  high: { level_ft: number; at: IsoTime };
  /** Strongest sustained wind from the open sector (0 kt at the window start if none blows from it). */
  onshore: { wind_kt: number; gust_kt: number; windFromDeg: number; at: IsoTime };
}

export function stayConditions(sc: LakeScenario, window: readonly [IsoTime, IsoTime]): StayConditions {
  const [from, to] = window.map(toMs) as [number, number];
  // The window ends, plus every sample strictly inside it.
  const pts = [lakeAt(sc, window[0]), ...sc.samples.filter((x) => toMs(x.at) > from && toMs(x.at) < to), lakeAt(sc, window[1])];
  let low = pts[0]!;
  let high = pts[0]!;
  let onshore: LakeSample | null = null;
  for (const p of pts) {
    if (p.level_ft < low.level_ft) low = p;
    if (p.level_ft > high.level_ft) high = p;
    if (inOpenSector(p.windFromDeg) && (!onshore || p.wind_kt > onshore.wind_kt)) onshore = p;
  }
  return {
    scenario: sc.id,
    day: localDate(window[0]),
    low: { level_ft: low.level_ft, at: low.at },
    high: { level_ft: high.level_ft, at: high.at },
    onshore: onshore ? { wind_kt: onshore.wind_kt, gust_kt: onshore.gust_kt, windFromDeg: onshore.windFromDeg, at: onshore.at } : { wind_kt: 0, gust_kt: 0, windFromDeg: 0, at: window[0] },
  };
}

/** Conditions for a request's stay under a what-if, or null if the series is missing (verdicts then fall back to T30). */
export function conditionsForRequest(fx: FixtureBundle, req: Pick<TransientRequest, 'arrivalFrom' | 'arrivalTo' | 'nights'>, id: LakeScenarioId): StayConditions | null {
  const sc = lakeScenario(fx, id);
  return sc ? stayConditions(sc, stayWindow(req)) : null;
}

// ---------- wording ----------
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;
/** 225 → “SW”. */
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]!;
/** “+4.4 ft”, “−2 ft”, “0 ft” (true minus sign, no-break space). */
export const signedFt = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 10) / 10)}\u00a0ft`;
/** “20:00”, or “03:00 16 Jul” off the scenario day. */
export function whenLabel(t: IsoTime, day: string): string {
  const d = localDate(t);
  if (d === day) return formatClock(t);
  const [, m, dd] = d.split('-');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  return `${formatClock(t)} ${Number(dd)}\u00a0${month}`;
}
