/** Virtual scenario time. Stored as UTC ISO strings; displayed in America/New_York. Never the viewer’s wall clock. */
import type { IsoTime } from './types.ts';

export const DISPLAY_TIME_ZONE = 'America/New_York';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export function isIsoUtc(value: unknown): value is IsoTime {
  return typeof value === 'string' && ISO_UTC.test(value) && !Number.isNaN(Date.parse(value));
}

export function toMs(t: IsoTime): number {
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid time: ${t}`);
  return ms;
}

export function minutesBetween(earlier: IsoTime, later: IsoTime): number {
  return (toMs(later) - toMs(earlier)) / 60000;
}

export const isAtOrBefore = (a: IsoTime, b: IsoTime) => toMs(a) <= toMs(b);

export function addSeconds(t: IsoTime, s: number): IsoTime {
  return new Date(toMs(t) + s * 1000).toISOString().replace('.000Z', 'Z');
}

const hm = new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const zoneFmt = new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TIME_ZONE, timeZoneName: 'short' });

/** “09:12” in New York time. */
/** Calendar date (YYYY-MM-DD) of an instant in the display time zone, e.g. for “today” in Buffalo. */
export function localDate(t: IsoTime): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}

export function formatClock(t: IsoTime): string {
  return hm.format(new Date(toMs(t)));
}

/** “15 Jul 2026” in New York time. */
export function formatDay(t: IsoTime): string {
  return dayFmt.format(new Date(toMs(t)));
}

/** “EDT” / “EST”. */
export function formatZone(t: IsoTime): string {
  return zoneFmt.formatToParts(new Date(toMs(t))).find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
}
