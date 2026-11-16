/**
 * Procedural detail textures (TASKS T33). Generated once in the browser from seeded noise: nothing is
 * downloaded, and the same bytes come out on every machine.
 *
 * - `detailTexture()`: 256² tileable value noise, four independent channels.
 *     R  broad fbm (patches)      G  fine grain (speckle)
 *     B  second broad fbm         A  mid-frequency fbm (stains, clouds)
 *   Sampled in world space at several scales by the ground, the shared surface material, the sky and the water.
 * - `rippleTexture()`: 256² tileable water surface: RG = slope (∂h/∂x, ∂h/∂z) packed to 0…1, B = height.
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping, type Texture } from 'three';
import { rng } from './assets/mesh.ts';

export const DETAIL_SIZE = 256;

/** Tileable value noise on a `cells`×`cells` lattice, smooth-interpolated. Pure. */
function valueNoise(size: number, cells: number, rand: () => number): Float32Array {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const out = new Float32Array(size * size);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy);
    const ty = s(fy - y0);
    const r0 = (y0 % cells) * cells;
    const r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx);
      const tx = s(fx - x0);
      const c0 = x0 % cells;
      const c1 = (x0 + 1) % cells;
      const a = lattice[r0 + c0]! + (lattice[r0 + c1]! - lattice[r0 + c0]!) * tx;
      const b = lattice[r1 + c0]! + (lattice[r1 + c1]! - lattice[r1 + c0]!) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Sum of octaves, normalised to 0…1 with the contrast stretched so the texture uses the whole range. */
export function fbm(size: number, baseCells: number, octaves: number, seed: number, gain = 0.5): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  let cells = baseCells;
  for (let o = 0; o < octaves && cells <= size; o++) {
    const n = valueNoise(size, cells, rand);
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + n[i]! * amp;
    amp *= gain;
    cells *= 2;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of out) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i]! - lo) / (hi - lo || 1);
  return out;
}

/** The four noise channels as bytes (RGBA, row-major). Exported for the unit test. */
export function detailPixels(size = DETAIL_SIZE): Uint8Array {
  const channels = [fbm(size, 4, 5, 101), fbm(size, 48, 1, 202), fbm(size, 5, 4, 303), fbm(size, 16, 3, 404)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(channels[c]![i]! * 255);
  return data;
}

/**
 * Calm-water surface: a sum of sine waves with whole-number wave vectors, so it tiles exactly. Many short
 * waves over a few long ones, as wind ripple on a sheltered river reads from above.
 */
export function ripplePixels(size = DETAIL_SIZE): Uint8Array {
  const rand = rng(77);
  const waves: { kx: number; ky: number; amp: number; phase: number }[] = [];
  for (let i = 0; i < 46; i++) {
    // Wave number 2…28 cycles per tile, biased to the short end; directions spread around a prevailing one.
    const k = 2 + Math.pow(rand(), 1.6) * 26;
    const th = 0.5 + (rand() - 0.5) * 2.4;
    const kx = Math.round(Math.cos(th) * k);
    const ky = Math.round(Math.sin(th) * k);
    if (kx === 0 && ky === 0) continue;
    waves.push({ kx, ky, amp: 1 / Math.pow(Math.hypot(kx, ky), 1.25), phase: rand() * Math.PI * 2 });
  }
  const h = new Float32Array(size * size);
  const sx = new Float32Array(size * size);
  const sy = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      let hh = 0;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const a = w.kx * u + w.ky * v + w.phase;
        // Sharpened crests: sin + a little of its second harmonic.
        hh += w.amp * (Math.sin(a) + 0.25 * Math.sin(2 * a + 0.7));
        const d = w.amp * (Math.cos(a) + 0.5 * Math.cos(2 * a + 0.7));
        dx += d * w.kx;
        dy += d * w.ky;
      }
      const i = y * size + x;
      h[i] = hh;
      sx[i] = dx;
      sy[i] = dy;
    }
  const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const ps = Math.max(peak(sx), peak(sy));
  const ph = peak(h);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round((0.5 + (0.5 * sx[i]!) / ps) * 255);
    data[i * 4 + 1] = Math.round((0.5 + (0.5 * sy[i]!) / ps) * 255);
    data[i * 4 + 2] = Math.round((0.5 + (0.5 * h[i]!) / ph) * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}

function tiling(data: Uint8Array, size: number): Texture {
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

let detail: Texture | null = null;
let ripple: Texture | null = null;
export const detailTexture = (): Texture => (detail ??= tiling(detailPixels(), DETAIL_SIZE));
export const rippleTexture = (): Texture => (ripple ??= tiling(ripplePixels(), DETAIL_SIZE));
/** One uniform object per texture, shared by every material that samples it. */
export const detailUniform = { get value() { return detailTexture(); } };
export const rippleUniform = { get value() { return rippleTexture(); } };
