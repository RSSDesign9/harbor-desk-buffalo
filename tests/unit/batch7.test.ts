/** Batch 7 (T17/T18) pure pieces: geometry validation, the boat stand-in, layout insets, fault gating. */
import { describe, expect, it } from 'vitest';
import { SITE, validateSite, type SiteRuntime } from '../../src/data/site.ts';
import { fallbackBoatGeometry } from '../../src/scene/assets/boat.ts';
import { railInsetPx } from '../../src/app/layout.ts';
import { activeFaults, FAULTS } from '../../src/app/faults.ts';

describe('runtime geometry validation (T18)', () => {
  it('accepts the shipped geometry: 126 slips, every coordinate finite', () => {
    expect(validateSite(SITE)).toEqual([]);
    expect(SITE.slips).toHaveLength(126);
  });
  it('rejects non-finite corners, duplicate ids, short rings and broken headwalks instead of guessing', () => {
    const [a, b, ...rest] = SITE.slips;
    const bad: SiteRuntime = {
      ...SITE,
      slips: [{ ...a!, corners: [[Number.NaN, 0], ...a!.corners.slice(1)] }, { ...b!, id: a!.id }, { ...rest[0]!, corners: rest[0]!.corners.slice(0, 2) }, ...rest.slice(1)],
      headwalks: { ...SITE.headwalks, B: { ...SITE.headwalks.B!, line: [[0, Number.POSITIVE_INFINITY], [1, 1]] } },
    };
    const issues = validateSite(bad);
    expect(issues).toEqual(expect.arrayContaining([`${a!.id}: corners`, `slip id ${a!.id}`, `${rest[0]!.id}: corners`, 'headwalk B']));
  });
});

describe('boat model stand-in (T18)', () => {
  it('is a generic finite block named without any identity, cached per size', () => {
    const g = fallbackBoatGeometry(8.7, 3);
    expect(g.name).toBe('boat-fallback');
    const pos = g.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);
    expect(Array.from(pos.array as Float32Array).every(Number.isFinite)).toBe(true);
    expect(fallbackBoatGeometry(8.7, 3)).toBe(g);
  });
});

describe('layout (T17)', () => {
  it('frames the camera clear of the rail only where a rail covers the scene', () => {
    expect(railInsetPx('desktop', true)).toBe(400);
    expect(railInsetPx('tablet', true)).toBe(348);
    expect(railInsetPx('tablet', false)).toBe(0);
    expect(railInsetPx('mobile', true)).toBe(0);
  });
});

describe('fault injection is never active outside a browser debug session', () => {
  it('has no active faults here and a closed list of names', () => {
    expect(activeFaults().size).toBe(0);
    expect(new Set(FAULTS).size).toBe(FAULTS.length);
  });
});
