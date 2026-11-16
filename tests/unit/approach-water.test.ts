import { describe, expect, it } from 'vitest';
import { SITE } from '../../src/data/site.ts';
import { approachPath } from '../../src/scene/approach.ts';

type P = readonly [number, number];
function inRing(p: P, ring: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** On the authored land masks, outside their documented-water holes. */
const onLand = (p: P) => SITE.land.some((l) => inRing(p, l.ring) && !l.holes.some((h) => inRing(p, h)));

describe('approach paths stay on the water (T30/T31)', () => {
  it('no sampled point of any berth’s path lies on the land masks', () => {
    const bad: string[] = [];
    for (const s of SITE.slips) {
      const path = approachPath(s, 30, 10);
      for (let i = 0; i <= 100; i++) {
        const p = path.departure(i / 100).center;
        if (onLand(p)) {
          bad.push(`${s.id}@${i}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
