import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveTokenBlocks, normalizeValue, parseCssBlocks, renderTokenCss } from '../../src/ui/tokenCss.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const json = JSON.parse(read('design/tokens.json')) as Record<string, unknown>;
const derived = deriveTokenBlocks(json);

describe('design tokens (T07)', () => {
  it('generated src/ui/tokens.css is exactly what design/tokens.json produces', () => {
    expect(read('src/ui/tokens.css')).toBe(renderTokenCss(derived));
  });

  it('design/tokens.css and design/tokens.json define the same tokens with the same values', () => {
    const css = parseCssBlocks(read('design/tokens.css'));
    for (const block of ['base', 'dark', 'light', 'reduced'] as const) {
      expect([...css[block].keys()].sort(), block).toEqual([...derived[block].keys()].sort());
      for (const [k, v] of derived[block]) expect(normalizeValue(css[block].get(k)!, css.base), `${block} ${k}`).toBe(normalizeValue(v, derived.base));
    }
  });

  it('resolves the stale aliases recorded in T01 in favour of JSON', () => {
    const meta = json._meta as { project: string };
    expect(meta.project).toMatch(/^Harbor Desk/);
    expect(derived.light.get('--text-muted')).toBe('#5d6c7b');
    expect(derived.base.get('--c-silo-concrete')).toBe('#7b7265'); // measured, not DESIGN prose’s #8f8b84 placeholder
    expect(derived.dark.get('--nav-aid')).toBe('var(--c-chart-magenta-dm)');
  });

  it('defines the review state with a non-orange colour', () => {
    expect(derived.dark.get('--state-review')).toBe('var(--c-warning)');
    expect(derived.base.get('--c-warning')).not.toBe(derived.base.get('--c-signal'));
  });
});
