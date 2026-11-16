import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hm } from '../../src/data/generate.ts';
import { formatClock, formatDay, formatZone, isIsoUtc, minutesBetween } from '../../src/domain/time.ts';

describe('virtual scenario time', () => {
  it('stores UTC and displays America/New_York (EDT in July)', () => {
    expect(hm('09:12')).toBe('2026-07-15T13:12:00Z');
    expect(formatClock(hm('09:12'))).toBe('09:12');
    expect(formatClock(hm('08:45'))).toBe('08:45');
    expect(formatDay(hm('09:12'))).toBe('15 Jul 2026');
    expect(formatZone(hm('09:12'))).toBe('EDT');
    expect(isIsoUtc('2026-07-15T13:12:00Z')).toBe(true);
    expect(isIsoUtc('2026-07-15T09:12:00')).toBe(false);
    expect(minutesBetween(hm('09:12'), hm('09:20'))).toBe(8);
  });

  it('never reads the viewer’s wall clock in domain or data code', () => {
    for (const dir of ['src/domain', 'src/data']) {
      for (const f of readdirSync(dir)) {
        const text = readFileSync(`${dir}/${f}`, 'utf8');
        expect(text, `${dir}/${f}`).not.toMatch(/Date\.now\(|new Date\(\)|performance\.now|Math\.random\(/);
      }
    }
  });
});
