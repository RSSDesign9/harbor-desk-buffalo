/**
 * River water (TASKS T33). One plane at y = 0, as before; what changed is how it is shaded.
 *
 * - Ripples: slopes from a generated tiling ripple texture at three scales, drifting slowly with the current
 *   (ambient motion only; a paused scene is exactly still). Water inside the marina is calmer than open water.
 * - Depth and contact: a small baked mask of the site (drawn once on a 2D canvas from the same land and dock
 *   polygons the scene uses) gives a lighter, greener shallow margin along the bank and a soft dark band
 *   under and beside every headwalk and finger.
 * - Sky: the analytic sky with clouds, by fresnel.
 * - Reflections: a planar reflection of the scene (boats, piles, docks, bank, buildings), rendered at half
 *   resolution into one off-screen target, re-rendered only when the camera or a shadow caster moved. It is
 *   skipped on software and low-power GPUs, in the dock map, and whenever the camera is below the surface.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Object3D,
  type Texture,
} from 'three';
import { SITE, type EN } from '../data/site.ts';
import { detailUniform, rippleUniform } from './detail.ts';
import { mapMix } from './MapLayer.tsx';
import { DOCK_PLANS } from './marina.ts';
import { CLOUD_GLSL, SKY_GLSL, ambientTime, isLite, skyUniforms, windUniform, withTier } from './materials.ts';
import { SCENE_COLORS as S } from './palette.ts';
import { shadowVersion } from './quality.ts';
import { gpuCapable } from './webgl.ts';

const noRaycast = () => null;

// ---------- baked site mask ----------
/** Area the mask covers, local metres: the slips with a margin. Outside it the water is plain open water. */
export const MASK_RECT = (() => {
  const pts = SITE.slips.flatMap((s) => s.corners);
  const margin = 115;
  const minE = Math.min(...pts.map((p) => p[0])) - margin;
  const maxE = Math.max(...pts.map((p) => p[0])) + margin;
  const minN = Math.min(...pts.map((p) => p[1])) - margin;
  const maxN = Math.max(...pts.map((p) => p[1])) + margin;
  return { minE, minN, width: maxE - minE, height: maxN - minN };
})();
/** How far each field reaches from its edge (m). */
export const SHORE_REACH_M = 15;
export const DOCK_REACH_M = 2.4;
export const SHELTER_REACH_M = 30;

/**
 * R: nearness to the bank (1 on land, falling to 0 `SHORE_REACH_M` out). G: nearness to dock structure (1
 * under a deck or finger). B: shelter (1 inside the berths, falling off into the fairway).
 * Fields are built from stacked strokes of the same outline, which works in every canvas implementation.
 */
function siteMask(longSidePx: number): Texture {
  const scale = longSidePx / Math.max(MASK_RECT.width, MASK_RECT.height);
  const w = Math.round(MASK_RECT.width * scale);
  const h = Math.round(MASK_RECT.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  // Local metres → pixels: east right, north up.
  ctx.setTransform(scale, 0, 0, -scale, -MASK_RECT.minE * scale, (MASK_RECT.minN + MASK_RECT.height) * scale);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const trace = (rings: readonly (readonly EN[])[]) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
    }
  };
  const field = (rings: readonly (readonly EN[])[], color: string, reachM: number, steps: number, fillRule: CanvasFillRule = 'nonzero') => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 1 / (steps + 1);
    for (let i = 0; i <= steps; i++) {
      trace(rings);
      ctx.fill(fillRule);
      if (i === 0) continue;
      ctx.lineWidth = (2 * reachM * i) / steps;
      trace(rings);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  for (const l of SITE.land) field([l.ring, ...l.holes], '#ff0000', SHORE_REACH_M, 14, 'evenodd');
  const structure = DOCK_PLANS.flatMap((d) => [...d.deck, ...d.fingers.map((f) => f.polygon)]);
  field(structure, '#00ff00', DOCK_REACH_M, 5);
  field(SITE.slips.map((s) => s.corners), '#0000ff', SHELTER_REACH_M, 10);
  const t = new CanvasTexture(canvas);
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  return t;
}

// ---------- planar reflection ----------
const reflection = {
  texture: { value: null as Texture | null },
  matrix: { value: new Matrix4() },
  on: { value: 0 },
  /** How many times the mirrored scene has been rendered (QA: it should not grow while the view is still). */
  stats: { renders: 0 },
};
export const reflectionStats = () => ({ ...reflection.stats, on: reflection.on.value > 0 });

/**
 * Not mirrored: the interface and water-surface dressing, and scenery too far back from the bank or too thin to
 * show in the water (cars, shrubs, scrub, boats ashore, ropes). Docks, hulls, piles, bank, trees and buildings are.
 */
const UNREFLECTED = new Set(['water', 'sky-dome', 'berth', 'berth-unknown', 'contact-shadows', 'review-contour', 'map-labels', 'ground-paint', 'ground-contacts', 'lamp-pools', 'parked-cars', 'shrubs', 'scrub-trees', 'stored-boats', 'mooring-lines']);
const isOverlay = (o: Object3D) => UNREFLECTED.has(o.name) || 'isLine2' in o || 'isLineSegments2' in o || 'isLine' in o || 'isSprite' in o;

function makeReflectionState() {
  return {
    target: new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: 0, depthBuffer: true, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter }),
    camera: new PerspectiveCamera(),
    plane: new Plane(),
    clip: new Vector4(),
    q: new Vector4(),
    size: new Vector2(),
    eye: new Vector3(),
    look: new Vector3(),
    up: new Vector3(),
    rot: new Matrix4(),
    key: '',
    hidden: [] as Object3D[],
  };
}

/**
 * Renders the mirrored scene into the reflection target before the main pass. Mount it AFTER the camera rig so
 * it sees this frame's camera.
 */
export function WaterReflection() {
  const enabled = useMemo(() => gpuCapable(), []);
  const gl = useThree((s) => s.gl);
  // Scratch objects for the pass: created on the first frame that needs them, kept for the life of the canvas.
  const scratch = useRef<ReturnType<typeof makeReflectionState> | null>(null);
  useEffect(
    () => () => {
      reflection.on.value = 0;
      reflection.texture.value = null;
      scratch.current?.target.dispose();
      scratch.current = null;
    },
    [],
  );

  useFrame(({ scene, camera }) => {
    const cam = camera as PerspectiveCamera;
    const state = (scratch.current ??= makeReflectionState());
    reflection.texture.value = state.target.texture;
    // The dock map is a schematic over darkened water, and a camera under the surface has nothing to mirror.
    if (!enabled || mapMix.value > 0.6 || cam.position.y < 0.5) {
      reflection.on.value = 0;
      return;
    }
    cam.updateMatrixWorld();
    const buf = gl.getDrawingBufferSize(state.size);
    const w = Math.max(2, Math.round(buf.x / 2));
    const h = Math.max(2, Math.round(buf.y / 2));
    if (state.target.width !== w || state.target.height !== h) {
      state.target.setSize(w, h);
      state.key = '';
    }
    // Re-render only when the view or something that casts a shadow (a hull, the sun) changed.
    const key = `${shadowVersion()}|${cam.matrixWorld.elements.map((v) => v.toFixed(4)).join(',')}|${cam.projectionMatrix.elements[0]!.toFixed(5)},${cam.projectionMatrix.elements[8]!.toFixed(5)},${cam.projectionMatrix.elements[9]!.toFixed(5)}`;
    reflection.on.value = 1 - Math.min(1, mapMix.value / 0.6);
    if (key === state.key) return;
    state.key = key;

    // Mirror the camera in the plane y = 0 (the construction three's Reflector uses).
    const v = state.camera;
    state.eye.setFromMatrixPosition(cam.matrixWorld);
    state.rot.extractRotation(cam.matrixWorld);
    state.look.set(0, 0, -1).applyMatrix4(state.rot).add(state.eye);
    v.position.set(state.eye.x, -state.eye.y, state.eye.z);
    state.up.set(0, 1, 0).applyMatrix4(state.rot);
    v.up.set(state.up.x, -state.up.y, state.up.z);
    v.lookAt(state.look.x, -state.look.y, state.look.z);
    v.near = cam.near;
    v.far = cam.far;
    v.updateMatrixWorld();
    v.matrixWorldInverse.copy(v.matrixWorld).invert();
    v.projectionMatrix.copy(cam.projectionMatrix);
    // The mirrored camera's right-hand side is the main camera's left: an off-centre view (panel insets) flips.
    v.projectionMatrix.elements[8] = -v.projectionMatrix.elements[8]!;
    reflection.matrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
    // Oblique near plane at the water surface, so nothing below it is drawn into the reflection.
    state.plane.set(new Vector3(0, 1, 0), -0.02).applyMatrix4(v.matrixWorldInverse);
    const clip = state.clip.set(state.plane.normal.x, state.plane.normal.y, state.plane.normal.z, state.plane.constant);
    const p = v.projectionMatrix.elements;
    const q = state.q.set((Math.sign(clip.x) + p[8]!) / p[0]!, (Math.sign(clip.y) + p[9]!) / p[5]!, -1, (1 + p[10]!) / p[14]!);
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1;
    p[14] = clip.w;
    v.projectionMatrixInverse.copy(v.projectionMatrix).invert();

    state.hidden.length = 0;
    scene.traverse((o) => {
      if (o.visible && isOverlay(o)) {
        o.visible = false;
        state.hidden.push(o);
      }
    });
    const prevTarget = gl.getRenderTarget();
    const prevAlpha = gl.getClearAlpha();
    const background = scene.background;
    scene.background = null;
    gl.setClearAlpha(0);
    gl.setRenderTarget(state.target);
    gl.clear();
    gl.render(scene, v);
    reflection.stats.renders += 1;
    gl.setRenderTarget(prevTarget);
    gl.setClearAlpha(prevAlpha);
    scene.background = background;
    for (const o of state.hidden) o.visible = true;
  }, 0);
  return null;
}

// ---------- material ----------
/** Calm water shows more sky than its 2 % normal-incidence reflectance suggests at this miniature scale. */
const WATER_SKY_GAIN = 2.4;

function waterMaterial(mask: Texture): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: S.water, roughness: 0.16, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, skyUniforms, {
      uAmbientTime: ambientTime,
      uWind: windUniform, // T35: lake what-if wind
      uMapMix: mapMix, // T29: the dock map darkens the water so light status plates read
      uRipple: rippleUniform,
      uDetail: detailUniform,
      uMask: { value: mask },
      uMaskRect: { value: new Vector4(MASK_RECT.minE, MASK_RECT.minN, 1 / MASK_RECT.width, 1 / MASK_RECT.height) },
      uRefl: reflection.texture,
      uReflMatrix: reflection.matrix,
      uReflOn: reflection.on,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterPos;\nvarying vec4 vReflUv;\nuniform mat4 uReflMatrix;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvReflUv = uReflMatrix * vec4(vWaterPos, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
${SKY_GLSL}
${CLOUD_GLSL}
varying vec3 vWaterPos;
varying vec4 vReflUv;
uniform float uMapMix;
uniform sampler2D uRipple;
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform sampler2D uRefl;
uniform float uReflOn;
uniform vec4 uWind;
vec2 gSlope;
vec3 gMask;
// Surface slope (dh/dx, dh/dz) at a world position; calm scales the short ripples.
// T35: wind (uWind.z > 0) runs the short ripples downwind and roughens them; at 0 this is the calm surface exactly.
vec2 waterSlope(vec2 p, float calm, float fine) {
  vec2 t = vec2(0.19, 0.11) * uAmbientTime;
  vec2 w = uWind.xy * (uWind.z * uAmbientTime);
  float rough = 1.0 + 1.9 * uWind.z;
  vec2 b = texture2D(uRipple, p.yx * 0.047 - t * 0.017 + 0.23 - w.yx * 0.03).gr - 0.5;
  vec2 c = texture2D(uRipple, p * 0.171 + t * 0.045 + 0.61 - w * 0.11).rg - 0.5;
  #ifdef HARBOR_LITE
  vec2 a = b.yx;
  vec2 d = c.yx;
  #else
  vec2 a = texture2D(uRipple, p * 0.0143 + t * 0.006).rg - 0.5;
  vec2 d = texture2D(uRipple, p.yx * 0.53 - t * 0.09 + 0.17 - w.yx * 0.3).gr - 0.5;
  #endif
  return a * 0.2 * (0.35 + 0.65 * fine) + (b * 0.22 * (0.25 + 0.75 * fine) + (c * 0.2 + d * 0.14) * fine) * calm * rough;
}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  float dist = distance(cameraPosition, vWaterPos);
  vec2 muv = (vec2(vWaterPos.x, -vWaterPos.z) - uMaskRect.xy) * uMaskRect.zw;
  vec2 edge = smoothstep(vec2(0.0), vec2(0.04), muv) * smoothstep(vec2(0.0), vec2(0.04), 1.0 - muv);
  gMask = texture2D(uMask, muv).rgb * edge.x * edge.y;
  // Sheltered water inside the marina carries less short ripple; far water keeps only the broad pattern.
  float calm = 1.0 - 0.55 * gMask.b;
  gSlope = waterSlope(vWaterPos.xz, calm, 1.0 - smoothstep(120.0, 520.0, dist));
  vec3 deep = diffuseColor.rgb;
  #ifdef HARBOR_LITE
  float broad = 0.5;
  #else
  float broad = texture2D(uDetail, vWaterPos.xz * 0.0047).r;
  #endif
  deep *= 0.86 + 0.26 * broad;
  // Shallow margin along the bank: lighter and greener where the bed shows through.
  float shallow = gMask.r * gMask.r;
  vec3 body = mix(deep, deep * vec3(1.32, 1.42, 1.06) + vec3(0.012, 0.02, 0.008), shallow * 0.75);
  // Ripple faces turned to and from the light.
  body *= 1.0 + clamp(dot(gSlope, vec2(1.9, 1.3)), -0.2, 0.2);
  // Contact shading: darker under and beside docks, and a thin dark line at the waterline of the bank.
  body *= 1.0 - 0.42 * smoothstep(0.05, 0.95, gMask.g);
  body *= 1.0 - 0.3 * smoothstep(0.82, 1.0, gMask.r);
  // T35: whitecaps on open water in a strong wind (none in the sheltered marina basin or at 0).
  // Streaks: sampled in the wind's frame, stretched downwind, drifting with it.
  vec2 wf = vec2(dot(vWaterPos.xz, uWind.xy), dot(vWaterPos.xz, vec2(-uWind.y, uWind.x)));
  vec2 capUv = vec2(wf.x * 0.03 - uWind.z * uAmbientTime * 0.02, wf.y * 0.12);
  float caps = smoothstep(0.26, 0.36, length(texture2D(uRipple, capUv).rg - 0.5)) * smoothstep(0.3, 0.8, texture2D(uRipple, wf * 0.011 + 0.41).r);
  body = mix(body, vec3(0.78, 0.82, 0.84), caps * uWind.w * (1.0 - gMask.b) * 0.55 * (1.0 - smoothstep(260.0, 900.0, dist)));
  diffuseColor.rgb = mix(body, diffuseColor.rgb * 0.55, uMapMix);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(normalize(vec3(-gSlope.x, 1.0, -gSlope.y)), 0.0)).xyz);`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
  vec3 wN = normalize(vec3(-gSlope.x, 1.0, -gSlope.y));
  vec3 wV = normalize(cameraPosition - vWaterPos);
  float wNdv = saturate(dot(wN, wV));
  float wF = 0.02 + 0.98 * pow(1.0 - wNdv, 5.0);
  vec3 wR = reflect(-wV, wN);
  wR.y = abs(wR.y);
  vec3 wSky = harborSkyClouds(wR);
  // The mirrored scene, pushed sideways by the ripple slope; blurrier where the surface is rougher.
  vec4 wUv = vReflUv;
  wUv.xy += gSlope * vec2(1.0, -1.0) * 0.3 * wUv.w;
  #ifdef HARBOR_LITE
  vec4 wScene = vec4(0.0);
  #else
  vec4 wScene = texture2DProj(uRefl, wUv, 1.2) * uReflOn;
  #endif
  vec3 wRefl = mix(wSky, wScene.rgb, clamp(wScene.a, 0.0, 1.0));
  // Objects reflect more strongly than fresnel alone gives: at this height they are what makes water read as water.
  float wAmount = clamp(wF * ${WATER_SKY_GAIN.toFixed(2)} + 0.16 * clamp(wScene.a, 0.0, 1.0), 0.0, 1.0) * (1.0 - uMapMix);
  outgoingLight = mix(outgoingLight, wRefl, wAmount);
}
#include <opaque_fragment>`,
      );
    shader.fragmentShader = withTier(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => `harbor-water-v3${isLite() ? '-lite' : ''}`;
  return m;
}

export function Water() {
  const material = useMemo(() => waterMaterial(siteMask(gpuCapable() ? 2048 : 1024)), []);
  return (
    <mesh name="water" rotation-x={-Math.PI / 2} receiveShadow material={material} raycast={noRaycast}>
      <planeGeometry args={[5000, 5000]} />
    </mesh>
  );
}
