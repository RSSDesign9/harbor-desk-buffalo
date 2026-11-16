/**
 * 3D dock map layer (TASKS T29, PRD F19): status plates and slip numbers, drawn only while the map is up.
 *
 * - Plates are NOT a new mesh: the one berth pick mesh (Marina.tsx, all 126 berths in one draw call) switches
 *   from its faint daytime tint to status plates through `uMap`, which eases 0 → 1 as the map comes up.
 * - Every status has a pattern as well as a colour (legend: src/features/view/MapLegend.tsx): occupied = solid,
 *   away = diagonal hatch, reserved = dashed edge over a light fill, needs review = cross-hatch with a heavy
 *   edge, vacant = outline only. Patterns are in screen pixels, so they stay legible at any zoom; once a berth
 *   is only a few pixels wide its colour carries it, and the hover label, legend and list carry the name.
 * - Slip numbers and dock names are one draw call: screen-aligned quads from a canvas atlas, a fixed size in
 *   pixels, fading in once a berth is wide enough to label (MAP_LABEL_PX_PER_M). Docks are always labelled:
 *   “Dock B”, or just “B” when the whole map is small enough for the names to collide.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, LinearFilter, ShaderMaterial, Vector3, type Mesh, type PerspectiveCamera } from 'three';
import { SITE, type SlipGeom } from '../data/site.ts';
import type { MapStatus } from '../domain/selectors.ts';
import type { Verdict } from '../domain/fit.ts';
import { MAP_LABEL_PX_PER_M } from './camera.ts';
import { getMapMode } from './viewRequests.ts';
import { getAssignDrag } from '../features/assign/dragStore.ts';
import { prefersReducedMotion } from './viewRequests.ts';
import { MAP_COLORS } from './palette.ts';
import { skyUniforms } from './materials.ts';

/** 0 = the normal scene, 1 = the dock map. Shared by the plate, label and water materials. */
export const mapMix = { value: 0 };
/** 0…1 while a transient request is being dragged (T30): offered slips show their fit verdict. */
export const assignMix = { value: 0 };
const MIX_MS = 450;

/** Eases `mapMix` toward the map mode, requesting frames only while it moves. Renders nothing. */
export function MapMixDriver() {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(0);
  useFrame(() => {
    const now = performance.now();
    const dt = last.current ? Math.min(100, now - last.current) : 16;
    last.current = now;
    const step = prefersReducedMotion() ? 1 : dt / MIX_MS;
    for (const [u, goal, speed] of [[mapMix, getMapMode() ? 1 : 0, 1], [assignMix, getAssignDrag().active ? 1 : 0, 2]] as const) {
      if (u.value === goal) continue;
      u.value = goal > u.value ? Math.min(goal, u.value + step * speed) : Math.max(goal, u.value - step * speed);
      invalidate();
    }
  });
  // A mode change with the camera still (e.g. a cut under reduced motion) must still draw a frame.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (mapMix.value !== (getMapMode() ? 1 : 0) || assignMix.value !== (getAssignDrag().active ? 1 : 0)) invalidate();
    }, 120);
    return () => window.clearInterval(id);
  }, [invalidate]);
  return null;
}

export const STATUS_CODE: Record<MapStatus, number> = { occupied: 0, away: 1, reserved: 2, review: 3, vacant: 4 };
/** The rgba tint the berth mesh had before T29 (lake-sky at 8 %; sand at 15 % where presence is unknown). */
const tintFor = (unknown: boolean) => (unknown ? [0.79, 0.78, 0.74, 0.15] : [0.283, 0.392, 0.546, 0.08]);

/**
 * All 126 berths as one mesh: two triangles per berth, in SITE.slips order, so `faceIndex >> 1` is the slip.
 * Per vertex: the daytime tint, the map status, the berth-local (u, v) and the berth size in metres.
 */
export function berthGeometry(slips: readonly SlipGeom[], unknown: ReadonlySet<string>, status: ReadonlyMap<string, MapStatus>, verdicts: ReadonlyMap<string, Verdict> = new Map()): BufferGeometry {
  const ver: number[] = [];
  const pos: number[] = [];
  const col: number[] = [];
  const st: number[] = [];
  const uv: number[] = [];
  const size: number[] = [];
  const quadUv = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  for (const s of slips) {
    const [a, b, c, d] = s.corners as unknown as [readonly number[], readonly number[], readonly number[], readonly number[]];
    const w = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
    const l = Math.hypot(d[0]! - a[0]!, d[1]! - a[1]!);
    const rgba = tintFor(unknown.has(s.id));
    const code = STATUS_CODE[status.get(s.id) ?? 'vacant'];
    const v = verdicts.get(s.id);
    const vcode = v ? VERDICT_CODE[v] : 0;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      ver.push(vcode);
      const p = [a, b, c, d][i]!;
      pos.push(p[0]!, 0.04, -p[1]!);
      col.push(...rgba);
      st.push(code);
      uv.push(...quadUv[i]!);
      size.push(w, l);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.setAttribute('aStatus', new Float32BufferAttribute(st, 1));
  g.setAttribute('aSlipUv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aSlipSize', new Float32BufferAttribute(size, 2));
  g.setAttribute('aVerdict', new Float32BufferAttribute(ver, 1));
  g.computeBoundingSphere();
  return g;
}

/** Fit verdict codes for the berth shader (0 = not offered). */
export const VERDICT_CODE: Record<Verdict, number> = { fits: 1, tight: 2, 'no-fit': 3 };

const linear = (hex: string) => new Color(hex); // three converts sRGB hex to the linear working space

/** Daytime tint ↔ status plates, one program. Untoned: plate colours are UI tokens and must stay exact. */
export function berthMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Double-sided: the supplied berth rings do not all wind the same way (Dock E is numbered in reverse).
    side: DoubleSide,
    toneMapped: false,
    uniforms: {
      uMap: mapMix,
      uAssign: assignMix,
      uDayLight: skyUniforms.uSkyLight,
      uColors: { value: [linear(MAP_COLORS.occupied), linear(MAP_COLORS.away), linear(MAP_COLORS.reserved), linear(MAP_COLORS.review), linear(MAP_COLORS.vacant)] },
      uVerdictColors: { value: [linear(MAP_COLORS.fits), linear(MAP_COLORS.tight), linear(MAP_COLORS.noFit)] },
    },
    vertexShader: /* glsl */ `
      attribute vec4 color;
      attribute float aStatus;
      attribute vec2 aSlipUv;
      attribute vec2 aSlipSize;
      attribute float aVerdict;
      varying float vVerdict;
      varying vec4 vTint;
      varying float vStatus;
      varying vec2 vLocal;
      varying vec2 vSize;
      void main() {
        vTint = color;
        vVerdict = aVerdict;
        vStatus = aStatus;
        vLocal = aSlipUv * aSlipSize;
        vSize = aSlipSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uMap;
      uniform float uAssign;
      uniform float uDayLight;
      uniform vec3 uColors[5];
      uniform vec3 uVerdictColors[3];
      varying float vVerdict;
      varying vec4 vTint;
      varying float vStatus;
      varying vec2 vLocal;
      varying vec2 vSize;
      float stripes(float along, float period, float width) { return step(mod(along, period), width); }
      void main() {
        int st = int(vStatus + 0.5);
        vec3 c = uColors[0];
        if (st == 1) c = uColors[1]; else if (st == 2) c = uColors[2]; else if (st == 3) c = uColors[3]; else if (st == 4) c = uColors[4];
        // Distance to the berth edge in screen pixels (derivatives keep edges a constant width at any zoom).
        vec2 e2 = min(vLocal, vSize - vLocal);
        vec2 px = e2 / max(fwidth(vLocal), vec2(1e-4));
        float edgePx = min(px.x, px.y);
        // How many pixels the berth is across: patterns need room, below ~9 px the colour carries it.
        float widthPx = min(vSize.x, vSize.y) / max(max(fwidth(vLocal.x), fwidth(vLocal.y)), 1e-4);
        float room = smoothstep(7.0, 11.0, widthPx);
        vec2 f = gl_FragCoord.xy;
        float a;
        if (st == 0) { // occupied: solid
          a = 0.9;
        } else if (st == 1) { // away: diagonal hatch, solid edge
          a = mix(0.7, mix(0.12, 0.92, stripes(f.x + f.y, 6.0, 2.6)), room);
          a = max(a, step(edgePx, 1.6) * 0.95);
        } else if (st == 2) { // reserved: light fill, dashed edge
          float dash = stripes(f.x - f.y, 7.0, 4.0);
          a = mix(0.55, 0.28, room);
          a = max(a, step(edgePx, 2.0) * mix(0.95, dash * 0.95, room));
        } else if (st == 3) { // needs review: cross-hatch, heavy edge
          float hatch = max(stripes(f.x + f.y, 5.0, 1.8), stripes(f.x - f.y, 5.0, 1.8));
          a = mix(0.85, mix(0.2, 0.95, hatch), room);
          a = max(a, step(edgePx, 2.6));
        } else { // vacant: outline only
          a = max(mix(0.18, 0.05, room), step(edgePx, 1.3) * 0.85);
        }
        vec4 plate = vec4(c, a);
        // The daytime tint is unlit, so it dims with the sky at dusk (T31); plates are UI colours and stay exact.
        vec4 base = mix(vec4(vTint.rgb * uDayLight, vTint.a), plate, uMap);
        // T30 drag: offered slips show their verdict (fits = solid, tight = hatch, no fit = outline with a cross);
        // everything not offered recedes.
        int v = int(vVerdict + 0.5);
        vec4 verdict = vec4(base.rgb, base.a * 0.3);
        if (v == 1) verdict = vec4(uVerdictColors[0], max(0.78, step(edgePx, 2.0)));
        else if (v == 2) verdict = vec4(uVerdictColors[1], max(mix(0.6, mix(0.18, 0.9, stripes(f.x + f.y, 6.0, 2.6)), room), step(edgePx, 2.0)));
        else if (v == 3) {
          float cross = max(stripes(f.x + f.y, 9.0, 1.4), stripes(f.x - f.y, 9.0, 1.4));
          verdict = vec4(uVerdictColors[2], max(mix(0.5, mix(0.12, 0.7, cross), room), step(edgePx, 2.0)));
        }
        gl_FragColor = mix(base, verdict, uAssign);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------------------------
interface Label {
  text: string;
  /** Anchor in scene space. */
  at: [number, number, number];
  /** Height in CSS px. */
  px: number;
  /** Shown from this many px per metre at the target (0 = always)… */
  minPxPerM: number;
  /** …up to this many (Infinity = no limit). */
  maxPxPerM: number;
}
/** Below this scale “Dock C” and “Dock E” would overlap, so the docks are labelled by letter alone. */
const DOCK_NAME_PX_PER_M = 0.9;

const DOCK_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
function mapLabels(): Label[] {
  const out: Label[] = [];
  for (const s of SITE.slips) {
    // Just past the open-water end of the berth, where no hull sits.
    const dx = s.outer[0] - s.inner[0];
    const dy = s.outer[1] - s.inner[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push({ text: s.id.slice(2), at: [s.outer[0] + (dx / len) * 1.6, 0.3, -(s.outer[1] + (dy / len) * 1.6)], px: 13, minPxPerM: MAP_LABEL_PX_PER_M, maxPxPerM: Infinity });
  }
  for (const d of DOCK_LETTERS) {
    const slips = SITE.slips.filter((s) => s.dock === d);
    if (!slips.length) continue;
    const e = slips.reduce((a, s) => a + s.outer[0], 0) / slips.length;
    const n = slips.reduce((a, s) => a + s.outer[1], 0) / slips.length;
    const h = (slips[0]!.headingDeg * Math.PI) / 180;
    const at: [number, number, number] = [e + Math.sin(h) * 16, 0.3, -(n + Math.cos(h) * 16)];
    out.push({ text: `Dock ${d}`, at, px: 15, minPxPerM: DOCK_NAME_PX_PER_M, maxPxPerM: Infinity });
    out.push({ text: d, at, px: 15, minPxPerM: 0, maxPxPerM: DOCK_NAME_PX_PER_M });
  }
  return out;
}

const CELL_H = 48; // atlas cell height in texels (labels are drawn at up to ~3.5× their CSS size)
function buildAtlas(texts: string[]) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `600 ${Math.round(CELL_H * 0.62)}px "Atkinson Hyperlegible Mono", "SF Mono", Menlo, monospace`;
  ctx.font = font;
  const pad = 8;
  const widths = texts.map((t) => Math.ceil(ctx.measureText(t).width) + 2 * pad);
  const W = 1024;
  const rects: { x: number; y: number; w: number }[] = [];
  let x = 0, y = 0;
  for (const w of widths) {
    if (x + w > W) {
      x = 0;
      y += CELL_H;
    }
    rects.push({ x, y, w });
    x += w;
  }
  canvas.width = W;
  canvas.height = Math.max(CELL_H, 2 ** Math.ceil(Math.log2(y + CELL_H)));
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    texts.forEach((t, i) => {
      const r = rects[i]!;
      const cx = r.x + r.w / 2;
      const cy = r.y + CELL_H / 2 + 1;
      // Midnight halo, white face: legible on water, plates and decks alike.
      ctx.lineWidth = CELL_H * 0.16;
      ctx.strokeStyle = 'rgba(1, 27, 43, 0.92)';
      ctx.strokeText(t, cx, cy);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t, cx, cy);
    });
  };
  draw();
  return { canvas, rects, draw, size: [canvas.width, canvas.height] as const, font };
}

/** Slip numbers and dock letters (one draw call). Visible only while the map is up. */
export function MapLabels() {
  const { size, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as { getTarget?: (v: Vector3) => Vector3 } | null;
  const mesh = useRef<Mesh>(null);
  const built = useMemo(() => {
    const labels = mapLabels();
    const texts = [...new Set(labels.map((l) => l.text))];
    const atlas = buildAtlas(texts);
    const tex = new CanvasTexture(atlas.canvas);
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    const pos: number[] = [], corner: number[] = [], uvr: number[] = [], sz: number[] = [], scaleRange: number[] = [];
    const idx: number[] = [];
    labels.forEach((l, i) => {
      const r = atlas.rects[texts.indexOf(l.text)]!;
      const [W, H] = atlas.size;
      const u0 = r.x / W, u1 = (r.x + r.w) / W;
      const v1 = 1 - r.y / H, v0 = 1 - (r.y + CELL_H) / H;
      const aspect = r.w / CELL_H;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        pos.push(...l.at);
        corner.push(cx, cy);
        uvr.push(cx < 0 ? u0 : u1, cy < 0 ? v0 : v1);
        // Half extents in CSS px. The cell is taller than the glyphs; scale so the cap height is about l.px.
        const h = (l.px * 1.45) / 2;
        sz.push(h * aspect, h);
        scaleRange.push(l.minPxPerM, Number.isFinite(l.maxPxPerM) ? l.maxPxPerM : 1e6);
      }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
    g.setAttribute('uv', new Float32BufferAttribute(uvr, 2));
    g.setAttribute('aHalf', new Float32BufferAttribute(sz, 2));
    g.setAttribute('aScaleRange', new Float32BufferAttribute(scaleRange, 2));
    g.setIndex(idx);
    // Anchors are spread over the whole marina; the default sphere would cull quads that hang off the edge.
    g.computeBoundingSphere();
    g.boundingSphere!.radius += 50;
    const mat = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uAtlas: { value: tex }, uViewport: { value: [1, 1] }, uPxPerM: { value: 0 }, uMap: mapMix },
      vertexShader: /* glsl */ `
        attribute vec2 aCorner;
        attribute vec2 aHalf;
        attribute vec2 aScaleRange;
        uniform vec2 uViewport;
        uniform float uPxPerM;
        uniform float uMap;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vec4 clip = projectionMatrix * viewMatrix * vec4(position, 1.0);
          clip.xy += aCorner * aHalf / uViewport * 2.0 * clip.w;
          gl_Position = clip;
          vUv = uv;
          float show = aScaleRange.x <= 0.0 ? 1.0 : smoothstep(aScaleRange.x * 0.85, aScaleRange.x, uPxPerM);
          show *= 1.0 - smoothstep(aScaleRange.y, aScaleRange.y * 1.15, uPxPerM);
          vAlpha = show * uMap;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uAtlas, vUv);
          if (t.a * vAlpha < 0.01) discard;
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
        }`,
    });
    return { g, mat, tex, atlas };
  }, []);

  // Redraw the atlas once the self-hosted mono face is ready (canvas text does not wait for webfonts).
  useEffect(() => {
    let live = true;
    document.fonts?.load(built.atlas.font).then(() => {
      if (!live) return;
      built.atlas.draw();
      built.tex.needsUpdate = true;
      invalidate();
    }, () => undefined);
    return () => {
      live = false;
    };
  }, [built, invalidate]);
  useEffect(() => () => {
    built.g.dispose();
    built.mat.dispose();
    built.tex.dispose();
  }, [built]);

  const target = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    m.visible = mapMix.value > 0.001;
    if (!m.visible) return;
    const cam = camera as PerspectiveCamera;
    controls?.getTarget?.(target);
    const d = camera.position.distanceTo(target);
    const fullH = cam.view?.enabled ? cam.view.fullHeight : size.height;
    const u = (m.material as ShaderMaterial).uniforms;
    u.uPxPerM!.value = fullH / (2 * d * Math.tan((cam.fov * Math.PI) / 360));
    u.uViewport!.value = [size.width, size.height];
  });

  return <mesh ref={mesh} name="map-labels" geometry={built.g} material={built.mat} frustumCulled={false} renderOrder={12} raycast={() => null} visible={false} />;
}
