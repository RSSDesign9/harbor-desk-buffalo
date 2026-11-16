import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composite, contrastRatio } from '../../src/ui/contrast.ts';
import { deriveTokenBlocks, normalizeValue } from '../../src/ui/tokenCss.ts';

/**
 * Text sits on translucent glass over the 3D scene, so contrast is measured on the COMPOSITED surface
 * against worst-case backdrops (PRD §11). These are computed bounds; the rendered scene is re-checked in T17.
 */
const t = deriveTokenBlocks(JSON.parse(readFileSync(new URL('../../design/tokens.json', import.meta.url), 'utf8')) as Record<string, unknown>);
const hex = (block: Map<string, string>, k: string) => normalizeValue(block.get(k)!, t.base);

// Dark (default) theme floats over the daylight scene: white gelcoat, sand concrete, painted limestone, sky, water, night.
const DARK_BACKDROPS = ['#ffffff', '#e6e5df', '#e7ebed', '#91a8c3', '#4e6d98', '#011b2b'];
// Light chart mode is used over the chart palette (plan view) and its own canvas (snow-canvas since 4515d680).
const LIGHT_BACKDROPS = ['--c-chart-water', '--c-chart-shoal', '--c-chart-built', '--c-chart-land', '--c-white'].map((k) => t.base.get(k)!).concat(normalizeValue(t.light.get('--bg-canvas')!, t.base));

const worst = (text: string, glass: string, backdrops: string[]) => Math.min(...backdrops.map((b) => contrastRatio(text, composite(glass, b))));

describe('composited contrast (T07)', () => {
  it('dark glass: every essential text role reaches AA (4.5:1) over the brightest backdrop', () => {
    const glass = hex(t.dark, '--bg-panel');
    for (const role of ['--text-primary', '--text-secondary', '--state-docked', '--state-underway', '--state-review', '--state-overdue']) {
      expect(worst(hex(t.dark, role), glass, DARK_BACKDROPS), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('light glass over the chart palette: essential text roles reach AA', () => {
    const glass = hex(t.light, '--bg-panel');
    for (const role of ['--text-primary', '--text-secondary', '--state-docked', '--state-underway', '--state-review']) {
      expect(worst(hex(t.light, role), glass, LIGHT_BACKDROPS), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('documents the roles that are NOT text-safe on glass (decorative only / never as text)', () => {
    expect(worst(hex(t.dark, '--text-muted'), hex(t.dark, '--bg-panel'), DARK_BACKDROPS)).toBeLessThan(4.5);
    expect(worst(hex(t.dark, '--text-accent'), hex(t.dark, '--bg-panel'), DARK_BACKDROPS)).toBeLessThan(4.5);
    expect(worst(hex(t.light, '--text-accent'), hex(t.light, '--bg-panel'), LIGHT_BACKDROPS)).toBeLessThan(4.5);
  });

  it('primary button text on its solid fill and the two-tone focus ring meet their thresholds', () => {
    expect(contrastRatio(hex(t.dark, '--text-on-accent'), hex(t.base, '--c-signal'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex(t.light, '--text-on-accent'), hex(t.base, '--c-signal-dark'))).toBeGreaterThanOrEqual(4.5);
    // Focus ring (blue) against its white halo, and the halo against the darkest glass: ≥3:1 non-text.
    expect(contrastRatio(hex(t.base, '--c-focus'), hex(t.dark, '--focus-halo'))).toBeGreaterThanOrEqual(3);
    expect(worst(hex(t.dark, '--focus-halo'), hex(t.dark, '--bg-panel'), DARK_BACKDROPS)).toBeGreaterThanOrEqual(3);
    expect(worst(hex(t.base, '--c-focus'), hex(t.light, '--bg-panel'), LIGHT_BACKDROPS)).toBeGreaterThanOrEqual(3);
  });

  it('solid panel fallback keeps the same guarantees', () => {
    for (const role of ['--text-primary', '--text-secondary', '--state-review', '--state-underway']) {
      expect(contrastRatio(hex(t.dark, role), hex(t.dark, '--bg-panel-solid')), role).toBeGreaterThanOrEqual(4.5);
    }
  });
});
