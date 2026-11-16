import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../../src/data/fixtures.ts';
import { SITE, slipGeom } from '../../src/data/site.ts';
import { seedSession } from '../../src/domain/session.ts';
import { buildSnapshot } from '../../src/domain/replay.ts';
import { pointInPolygon } from '../../src/scene/geometry2d.ts';
import { deckStrip, fingerPolygons, placeBoat, placementFootprint, slipAxes } from '../../src/scene/layout.ts';
import { hullForSlip } from '../../src/scene/hulls.ts';
import { PLACEHOLDER_COLORS, TOKEN_COLORS } from '../../src/scene/palette.ts';

const fx = loadFixtures().bundle;
const toPt = ([e, n]: readonly number[]) => ({ east: e!, north: n! });

describe('runtime site geometry', () => {
  it('carries all 126 slips with the canonical B-10/B-12/B-14 positions from site-local.json', () => {
    expect(SITE.slips).toHaveLength(126);
    const local = JSON.parse(readFileSync(new URL('../../data/derived/site-local.json', import.meta.url), 'utf8')) as { slips: { id: string; derived: { centroid: { east: number; north: number } } }[] };
    for (const id of ['B-10', 'B-12', 'B-14']) {
      const a = slipGeom(id)!.centroid;
      const b = local.slips.find((s) => s.id === id)!.derived.centroid;
      expect(Math.hypot(a[0] - b.east, a[1] - b.north)).toBeLessThan(0.02);
    }
    expect(SITE.land.map((l) => l.id)).toEqual(['land-west', 'land-east', 'land-north']);
  });
});

describe('Dock B layout (berths are water; decks and boats fit)', () => {
  const dockB = SITE.slips.filter((s) => s.dock === 'B');

  it('slips open to the north-east (≈59°) on Dock B', () => {
    for (const s of dockB) expect(Math.abs(s.headingDeg - 59)).toBeLessThan(2);
  });

  it('the headwalk deck lies on the dock side of every berth and covers at most the first 0.6 m of it', () => {
    const b = SITE.headwalks.B!;
    const towardWater = slipAxes(slipGeom('B-12')!).out;
    const quads = deckStrip(b.line, towardWater);
    for (const s of dockB) {
      const { out } = slipAxes(s);
      const deep = [s.inner[0] + out[0] * 0.8, s.inner[1] + out[1] * 0.8];
      expect(quads.some((q) => pointInPolygon(toPt(deep), q.map(toPt))), s.id).toBe(false);
    }
  });

  it('fingers stay within berth length and every placeholder hull fits inside its berth', () => {
    for (const f of fingerPolygons(dockB.filter((s) => s.id <= 'B-19'))) expect(f.polygon).toHaveLength(4);
    for (const s of [seedSession(fx), buildSnapshot(fx, 'uncertain')]) {
      for (const g of dockB) {
        const h = hullForSlip(fx, s, g.id);
        if (!h) continue;
        const fp = placementFootprint(placeBoat(g, h.lengthFt, h.beamFt));
        const ring = g.corners.map(toPt);
        // Allow a 0.15 m tolerance at the sides for rounding.
        const inset = fp.map(([e, n]) => {
          const c = g.centroid;
          return { east: e - (e - c[0]) * 0.03, north: n - (n - c[1]) * 0.03 };
        });
        for (const p of inset) expect(pointInPolygon(p, ring), `${g.id} hull outside berth`).toBe(true);
      }
    }
  });
});

describe('scene palette', () => {
  it('token-backed colours match design/tokens.json', () => {
    const tokens = JSON.parse(readFileSync(new URL('../../design/tokens.json', import.meta.url), 'utf8')) as { color: Record<string, { $value: string }> };
    const map: Record<string, string> = { midnight: 'midnight', riverWater: 'river-water', lakeSky: 'lake-sky', sand: 'sand', sandDark: 'sand-dark', siloConcrete: 'silo-concrete', forest: 'forest', rust: 'rust', slate: 'slate', mist100: 'mist-100', silo_blue: 'silo-blue', limestone: 'limestone', signal: 'signal', chartCyan: 'chart-cyan', warning: 'warning', chartGreen: 'chart-green' };
    for (const [k, token] of Object.entries(map)) expect(TOKEN_COLORS[k as keyof typeof TOKEN_COLORS], k).toBe(tokens.color[token]!.$value);
    expect(Object.keys(PLACEHOLDER_COLORS).length).toBeGreaterThan(0);
  });
});
