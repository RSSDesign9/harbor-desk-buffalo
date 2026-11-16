/** WCAG 2.x contrast helpers, including alpha compositing over a scene backdrop. */
export type RGB = readonly [number, number, number];

export function parseColor(c: string): { rgb: RGB; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c.trim());
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  throw new RangeError(`Unsupported colour ${c}`);
}

/** Source-over composite of `top` (with alpha) on an opaque `bottom`. */
export function composite(top: string, bottom: string): RGB {
  const t = parseColor(top);
  const b = parseColor(bottom).rgb;
  return [0, 1, 2].map((i) => t.rgb[i]! * t.alpha + b[i]! * (1 - t.alpha)) as unknown as RGB;
}

export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const la = luminance(typeof a === 'string' ? parseColor(a).rgb : a);
  const lb = luminance(typeof b === 'string' ? parseColor(b).rgb : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
