/**
 * Shared scene materials (TASKS T09). Boats, docks, piles and shore props all use ONE opaque material:
 * colour comes from vertex colours, roughness/metalness from the per-vertex `surf` attribute, and dock
 * planking from a small generated texture (no download). A second instance draws stale (unconfirmed) hulls faded.
 */
import { AdditiveBlending, ClampToEdgeWrapping, DataTexture, DoubleSide, LinearFilter, LinearMipmapLinearFilter, MeshBasicMaterial, MeshStandardMaterial, RGBAFormat, RepeatWrapping, SRGBColorSpace, ShaderChunk, Vector3, Vector4, type Texture } from 'three';
import { Color } from 'three';
import { rng } from './assets/mesh.ts';
import { detailUniform } from './detail.ts';
import { gpuCapable } from './webgl.ts';
import { SCENE_COLORS as S } from './palette.ts';

/** Planks per texture repeat; the dock generator maps one repeat to PLANKS × PLANK_WIDTH_M metres. */
export const PLANKS_PER_REPEAT = 16;

/** Rows 0–47 (v < 0.75): planks with tone variation and seams. Rows 48–63: plain white, for everything else. */
function plankTexture(): Texture {
  const w = 256;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  const rand = rng(9);
  const tones = Array.from({ length: PLANKS_PER_REPEAT }, () => 0.9 + rand() * 0.1);
  const px = w / PLANKS_PER_REPEAT;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1;
      if (y < 48) {
        const plank = Math.floor(x / px);
        const inPlank = x - plank * px;
        v = tones[plank]! * (inPlank < 1 ? 0.7 : inPlank < 2 ? 0.92 : 1) * (0.985 + rand() * 0.03);
      }
      const c = Math.round(Math.min(1, v) * 255);
      const i = (y * w + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  const t = new DataTexture(data, w, h, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Soft mid-morning summer sun: azimuth 125° (south-east), elevation 40°. The 09:12 scenario sun would sit
 * nearer due east; it is turned 25–30° south so shadows fall ACROSS the fingers (visible from the working
 * view, which looks south-west from the water) instead of hiding behind the hulls. A lighting choice, not data.
 * Scene axes: x = east, y = up, z = −north.
 */
const SUN_AZIMUTH = (125 * Math.PI) / 180;
const SUN_ELEVATION = (40 * Math.PI) / 180;
export const SUN_DIRECTION: readonly [number, number, number] = [Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH), Math.sin(SUN_ELEVATION), -Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH)];

/**
 * Sky uniforms shared by every material with the analytic reflection and by the sky dome (T31, T33): the sun
 * direction, the horizon / overhead / below-horizon colours, the glow around the sun and a night factor all
 * follow the time of day (Environment.tsx, daylight.ts). They start at the authored mid-morning light.
 */
export const skyUniforms = {
  uSunDir: { value: new Vector3(...SUN_DIRECTION) },
  uSkyLight: { value: 1 },
  uSkyHorizon: { value: new Color(S.sky) },
  uSkyZenith: { value: new Color(S.skyZenith) },
  uSkyGround: { value: new Color(S.skyGround) },
  uSunGlow: { value: new Color('#fff3d9') },
  uCloud: { value: new Color('#f6f8fa') },
  uNight: { value: 0 },
};
/** Ambient clock (seconds): drifting water and clouds. Advances only while ambient motion runs. */
export const ambientTime = { value: 0 };
/**
 * T35 lake what-if: wind on the water. xy = the direction the wind blows TOWARD in world x/z, z = strength 0…1
 * (rougher, faster ripples running downwind), w = whitecaps 0…1 on open water. Both 0 below 12 kt, so the calm
 * day renders exactly as before (the approved views, poster and evidence stills do not change).
 */
export const windUniform = { value: new Vector4(0.7071, -0.7071, 0, 0) };

/**
 * The sky as a formula: a horizon-to-overhead gradient, a glow around the sun, and (where `harborClouds` is
 * used: the dome and the water) a thin layer of fair-weather cloud from the shared noise texture.
 */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSkyLight;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyZenith;
uniform vec3 uSkyGround;
uniform vec3 uSunGlow;
uniform vec3 uCloud;
uniform float uNight;
vec3 harborSky(vec3 d) {
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(max(d.y, 0.0), 0.55));
  vec3 col = d.y >= 0.0 ? sky : mix(uSkyHorizon, uSkyGround, smoothstep(0.0, 0.3, -d.y));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunGlow * (pow(s, 32.0) * 0.5 + pow(s, 5.0) * 0.07) * (1.0 - uNight);
  return col * uSkyLight;
}`;
export const CLOUD_GLSL = /* glsl */ `
uniform sampler2D uDetail;
uniform float uAmbientTime;
/** Cloud cover 0…1 along a direction above the horizon. */
float harborCloudCover(vec3 d) {
  #ifdef HARBOR_LITE
  return 0.0;
  #endif
  if (d.y <= 0.03) return 0.0;
  // A flat cloud deck seen in perspective, bent so the horizon does not compress it into stripes.
  vec2 p = d.xz / (d.y + 0.55);
  vec2 drift = vec2(0.0011, 0.0005) * uAmbientTime;
  float a = texture2D(uDetail, mat2(0.829, 0.559, -0.559, 0.829) * p * 0.11 + drift).r;
  float b = texture2D(uDetail, p * 0.29 - drift * 1.7 + 0.31).b;
  float c = texture2D(uDetail, p * 0.83 + 0.11).a;
  float cover = a * 0.58 + b * 0.3 + c * 0.12;
  return smoothstep(0.44, 0.78, cover) * smoothstep(0.03, 0.3, d.y);
}
vec3 harborSkyClouds(vec3 d) {
  vec3 sky = harborSky(d);
  #ifdef HARBOR_LITE
  return sky;
  #endif
  float cover = harborCloudCover(d);
  float s = max(dot(d, uSunDir), 0.0);
  vec3 lit = uCloud * (0.86 + 0.3 * pow(s, 3.0)) * uSkyLight;
  return mix(sky, lit, cover * 0.72);
}`;

/**
 * Analytic sky reflection, added to a MeshStandardMaterial’s output. The sky is evaluated along the
 * reflection vector with a Schlick fresnel and a roughness falloff.
 *
 * Why not `scene.environment`: the sky here is a formula, so evaluating it directly needs no pre-filter
 * pass, no extra texture and no per-material environment lookup, and the result is identical on every GPU.
 * (An environment map was tried first; its fill light flattened the cast shadows. See BUILD-LOG T09.)
 */
export function addSkyReflection(shader: { fragmentShader: string; uniforms: Record<string, { value: unknown }> }, gain: number) {
  Object.assign(shader.uniforms, skyUniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${SKY_GLSL}`)
    .replace(
      '#include <opaque_fragment>',
      /* glsl */ `{
  vec3 hView = normalize(vViewPosition);
  vec3 hNormal = normalize(normal);
  float hNdv = saturate(dot(hNormal, hView));
  vec3 hRefl = inverseTransformDirection(reflect(-hView, hNormal), viewMatrix);
  vec3 hF0 = mix(vec3(0.04), diffuseColor.rgb, metalnessFactor);
  float hGloss = 1.0 - roughnessFactor;
  vec3 hFresnel = hF0 + (max(vec3(hGloss), hF0) - hF0) * pow(1.0 - hNdv, 5.0);
  outgoingLight += harborSky(hRefl) * hFresnel * (0.2 + 0.8 * hGloss * hGloss) * ${gain.toFixed(3)};
}
#include <opaque_fragment>`,
    );
}

/**
 * Lighter shaders for software and low-power renderers (webgl.ts): no noise lookups, no leaf cut-outs, no
 * clouds. Every texture lookup is expensive on a CPU rasteriser, and those renderers also skip the reflection
 * and occlusion passes. Colours, lighting, shadows and geometry are the same in both tiers.
 */
let liteTier: boolean | null = null;
export const isLite = (): boolean => (liteTier ??= !gpuCapable());
/** Prepend the tier switch to a fragment shader. */
export const withTier = (fragment: string): string => (isLite() ? `#define HARBOR_LITE\n${fragment}` : fragment);

/**
 * Surface kinds (the third component of the per-vertex `surf` attribute, T33). They add world-space detail
 * from the shared noise texture, so large plain faces stop reading as flat paint:
 *   0 plain (gelcoat, canvas, metal: unchanged)   1 mineral (concrete, rock, timber: mottling, rain streaks)
 *   2 foliage (leaf clumps, lit and shaded)       3 lamp (glows as night falls)
 *   4 window (reflective by day, some lit at night)
 */
export const KIND = { plain: 0, mineral: 1, foliage: 2, lamp: 3, window: 4 } as const;

function surfMaterial(stale: boolean): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, map: plankTexture(), transparent: stale, opacity: stale ? 0.45 : 1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = detailUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 surf;\nvarying vec3 vSurf;\nvarying vec3 vHWorld;\nvarying vec3 vHNormal;\nuniform vec3 uSunDir;')
      // The shadow lookup is offset along the vertex normal. The authored patches are double-sided and not all
      // wound outward, so on some (boat decks) that offset pointed into the solid and the sunlit side speckled
      // with its own shadow. Offset toward the sun instead, whichever way the stored normal points (T33).
      .replace('#include <shadowmap_vertex>', ShaderChunk.shadowmap_vertex.replace('vec4 shadowWorldPosition;', 'shadowWorldNormal *= dot( shadowWorldNormal, uSunDir ) < 0.0 ? -1.0 : 1.0;\n\tvec4 shadowWorldPosition;'))
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
vSurf = surf;
{
  mat4 hm = modelMatrix;
  #ifdef USE_INSTANCING
  hm = modelMatrix * instanceMatrix;
  #endif
  vHWorld = (hm * vec4(transformed, 1.0)).xyz;
  vHNormal = normalize(mat3(hm) * objectNormal);
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;\nvarying vec3 vHWorld;\nvarying vec3 vHNormal;\nuniform sampler2D uDetail;\nfloat hKind(float k) { return 1.0 - step(0.5, abs(vSurf.z - k)); }')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
vec3 hAbs = abs(normalize(vHNormal));
// Project the noise along the face's dominant axis so walls are not smeared.
vec2 hUv = hAbs.y > 0.6 ? vHWorld.xz : (hAbs.x > hAbs.z ? vHWorld.zy : vHWorld.xy);
#ifdef HARBOR_LITE
vec4 hBroad = vec4(0.5);
#else
vec4 hBroad = texture2D(uDetail, hUv * 0.043);
#endif
// Metres per pixel on this face: once a noise cell is smaller than a pixel it only adds a hatch of aliasing,
// so each scale fades to its mean before that happens.
#ifdef HARBOR_LITE
vec4 hFine = vec4(0.5);
vec4 hLeaf = vec4(0.5);
#else
float hPx = max(length(dFdx(hUv)), length(dFdy(hUv)));
vec4 hFine = mix(vec4(0.5), texture2D(uDetail, hUv * 0.27), 1.0 - smoothstep(0.025, 0.08, hPx));
vec4 hLeaf = mix(vec4(0.5), texture2D(uDetail, hUv * 0.105 + 0.5), 1.0 - smoothstep(0.07, 0.22, hPx));
#endif
{
  float mineral = hKind(1.0);
  #ifdef HARBOR_LITE
  float streak = 0.0;
  #else
  float streak = hAbs.y < 0.6 ? texture2D(uDetail, vec2(hUv.x * 0.35, hUv.y * 0.022)).a - 0.5 : 0.0;
  #endif
  diffuseColor.rgb *= 1.0 + mineral * ((hBroad.r - 0.5) * 0.16 + (hFine.g - 0.5) * 0.1 + streak * 0.22);
  float foliage = hKind(2.0);
  // Leaf clumps: fine light/dark break-up, and a slow drift between a yellower and a bluer green.
  vec3 leaf = diffuseColor.rgb * mix(vec3(0.9, 0.97, 0.92), vec3(1.1, 1.05, 0.88), hBroad.b);
  leaf *= 0.62 + 0.76 * hLeaf.g * (0.6 + 0.8 * hLeaf.a);
  diffuseColor.rgb = mix(diffuseColor.rgb, leaf, foliage);
  // Leafy outline: where a leaf mass turns edge-on to the camera, cut it away by the leaf noise, so a crown
  // ends in a ragged fringe instead of a clean polygon edge. Far away the noise averages out and nothing is cut.
  #ifndef HARBOR_LITE
  float rim = 1.0 - abs(dot(normalize(vHNormal), normalize(cameraPosition - vHWorld)));
  float cut = hLeaf.g * 0.65 + hLeaf.a * 0.35;
  if (foliage > 0.5 && cut < 0.1 + smoothstep(0.3, 0.92, rim) * 0.62) discard;
  #endif
}`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vSurf.x + hKind(1.0) * (hFine.g - 0.5) * 0.12, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vSurf.y;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
{
  // Foliage: tilt the smooth lobe normals by the leaf noise so sun and shade break into clumps.
  vec3 hBump = (vec3(hLeaf.g, hLeaf.a, hLeaf.r) - 0.5) * 1.1 * hKind(2.0);
  normal = normalize(normal + (viewMatrix * vec4(hBump, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
{
  // Lamps come on as night falls; about a third of the windows are lit.
  float lit = step(0.64, fract(sin(dot(floor(vHWorld.xyz * 0.45), vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  totalEmissiveRadiance += vColor.rgb * uNight * (hKind(3.0) * 5.0 + hKind(4.0) * lit * vec3(2.6, 1.9, 1.0));
}`,
      );
    addSkyReflection(shader, 1);
    shader.fragmentShader = withTier(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => `harbor-surf-v3${isLite() ? '-lite' : ''}`;
  return m;
}

let surf: MeshStandardMaterial | null = null;
let surfStale: MeshStandardMaterial | null = null;
export const surfaceMaterial = () => (surf ??= surfMaterial(false));
export const staleSurfaceMaterial = () => (surfStale ??= surfMaterial(true));

/** Soft dark patch under a hull: contact shadow plus the hull’s dim reflection on calm water. */
let contact: MeshBasicMaterial | null = null;
let groundContact: MeshBasicMaterial | null = null;
/**
 * The same soft patch on land (T33): where a trunk, a wall, a keel block or a tyre meets the ground the sky is
 * hidden, so the ground is a little darker there. Drawn over the ground paint, under everything else.
 */
export function groundContactMaterial(): MeshBasicMaterial {
  if (groundContact) return groundContact;
  const base = contactShadowMaterial();
  groundContact = new MeshBasicMaterial({ color: '#15180f', map: base.map, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  return groundContact;
}
let lampPool: MeshBasicMaterial | null = null;
/** Warm pool of light on the ground under a lamp: additive, and only as bright as the night is dark (T33). */
export function lampPoolMaterial(): MeshBasicMaterial {
  if (lampPool) return lampPool;
  // Round, brightest under the lamp, gone by the edge.
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.min(1, Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2);
      const a = Math.pow(1 - r, 2.2);
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const glow = new DataTexture(data, n, n, RGBAFormat);
  glow.magFilter = LinearFilter;
  glow.minFilter = LinearFilter;
  glow.needsUpdate = true;
  lampPool = new MeshBasicMaterial({ color: '#ffc27a', map: glow, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 });
  lampPool.visible = false;
  return lampPool;
}
/** Lamp pools follow the night factor (0 by day: not drawn at all). */
export function setLampPools(night: number) {
  const m = lampPoolMaterial();
  m.opacity = 0.75 * night;
  m.visible = night > 0.02;
}
export function contactShadowMaterial(): MeshBasicMaterial {
  if (contact) return contact;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = Math.abs((x + 0.5) / n - 0.5) * 2;
      const v = Math.abs((y + 0.5) / n - 0.5) * 2;
      const d = Math.pow(Math.pow(u, 3) + Math.pow(v, 3), 1 / 3);
      const t = Math.min(1, Math.max(0, (d - 0.5) / 0.5));
      const a = 1 - t * t * (3 - 2 * t);
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const t = new DataTexture(data, n, n, RGBAFormat);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  contact = new MeshBasicMaterial({ color: '#0e1d27', map: t, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: true });
  return contact;
}
