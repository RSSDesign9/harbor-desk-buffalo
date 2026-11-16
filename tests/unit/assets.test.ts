import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url));

describe('runtime asset copies (T07)', () => {
  it('ships exactly three variable font faces, byte-identical to design/fonts, plus their OFL licences', () => {
    const shipped = readdirSync(new URL('../../public/fonts', import.meta.url)).sort();
    expect(shipped).toEqual(['AtkinsonHyperlegibleMono-OFL.txt', 'AtkinsonHyperlegibleMono-Variable.woff2', 'Commissioner-OFL.txt', 'Commissioner-Variable.woff2', 'WorkSans-OFL.txt', 'WorkSans-Variable.woff2']);
    for (const f of shipped) expect(read(`public/fonts/${f}`).equals(read(`design/fonts/${f}`)), f).toBe(true);
    const bytes = shipped.filter((f) => !f.endsWith('.txt')).reduce((s, f) => s + read(`public/fonts/${f}`).length, 0);
    expect(bytes).toBe(96212);
  });

  it('declares only those faces and never a remote font URL', () => {
    const css = read('src/ui/fonts.css').toString();
    expect(css.match(/@font-face/g)).toHaveLength(3);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('uses the supplied vessel sprite unchanged', () => {
    expect(read('public/assets/icons-vessels.svg').equals(read('design/icons-vessels.svg'))).toBe(true);
  });
});
