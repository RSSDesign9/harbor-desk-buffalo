/**
 * Ambient occlusion (TASKS T33). Where surfaces meet or crowd together (a hull against a finger, stones in the
 * revetment, a wall foot, the underside of a tree crown) less sky reaches them, and without that darkening
 * everything looks lit from everywhere and nothing sits on anything.
 *
 * Screen-space, from the depth buffer only:
 *   1. the scene is rendered into an off-screen target (4× multisampled, linear colour, with a depth texture);
 *   2. occlusion is estimated at half resolution from 12 depth taps around each pixel, over a radius that
 *      grows with distance (about 1.4 m in the working view), with normals rebuilt from depth;
 *   3. it is blurred across depth-similar neighbours, multiplied into the colour, and tone-mapped to the canvas;
 *   4. selection, hover and review outlines (their own layer) are drawn on top, untouched.
 *
 * Only on a capable GPU with float render targets: software and low-power renderers keep the single direct
 * pass, as do the browser journeys. It fades out in the dock map, which is a schematic.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  FloatType,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
} from 'three';
import { mapMix } from './MapLayer.tsx';
import { gpuCapable } from './webgl.ts';

/** Scene overlays (outlines) live on this layer: drawn after the occlusion pass, and never mirrored in the water. */
export const OVERLAY_LAYER = 1;
/** How strongly occlusion darkens (0…1). */
export const AO_STRENGTH = 0.72;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function occlusionMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'harbor-ao',
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { tDepth: { value: null }, uProj: { value: null }, uProjInv: { value: null }, uTexel: { value: new Vector2() }, uAspect: { value: 1 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uTexel;
uniform float uAspect;
vec3 viewPos(vec2 uv) {
  // Snap to the centre of a depth texel. This pass runs at half resolution, so its own pixel centres fall on
  // texel corners of the depth texture; unsnapped, the position and the depth can come from different texels
  // and flat ground bands with false occlusion.
  uv = (floor(uv / uTexel) + 0.5) * uTexel;
  float d = texture2D(tDepth, uv).r;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
void main() {
  vec2 here = (floor(vUv / uTexel) + 0.5) * uTexel;
  float depth = texture2D(tDepth, here).r;
  if (depth >= 0.999999) {
    gl_FragColor = vec4(1.0);
    return;
  }
  vec3 P = viewPos(here);
  // Normal from depth: across each axis, use the neighbour on the same surface (the smaller step in depth).
  vec3 Pr = viewPos(here + vec2(uTexel.x, 0.0));
  vec3 Pl = viewPos(here - vec2(uTexel.x, 0.0));
  vec3 Pu = viewPos(here + vec2(0.0, uTexel.y));
  vec3 Pd = viewPos(here - vec2(0.0, uTexel.y));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  // Radius in metres grows with distance, so a wide view still gets occlusion at the scale of buildings and trees.
  float radius = clamp(0.028 * -P.z, 0.9, 5.0);
  float rScreen = radius * uProj[1][1] * 0.5 / -P.z; // as a fraction of the view height
  vec2 rUv = vec2(rScreen / uAspect, rScreen);
  float spin = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float r2 = radius * radius;
  float sum = 0.0;
  for (int i = 0; i < 12; i++) {
    float t = (float(i) + 0.5) / 12.0;
    float a = spin + float(i) * 2.3999632;
    vec2 uv = here + vec2(cos(a), sin(a)) * sqrt(t) * rUv;
    // A tap outside the picture has no depth of its own (it would read the edge row and invent an occluder).
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    vec3 Q = viewPos(uv);
    vec3 v = Q - P;
    float vv = dot(v, v);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((dot(v, N) - 0.02 * radius) / (vv + 0.0004), 0.0);
  }
  float ao = max(0.0, 1.0 - sum * 5.0 * 2.4 / (r2 * r2 * r2 * 12.0));
  gl_FragColor = vec4(ao, depth, 0.0, 1.0);
}`,
  });
}

function compositeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'harbor-ao-composite',
    depthTest: false,
    depthWrite: false,
    uniforms: { tColor: { value: null }, tAo: { value: null }, tDepth: { value: null }, uAoTexel: { value: new Vector2() }, uStrength: { value: AO_STRENGTH } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: /* glsl */ `
#include <common>
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAo;
uniform sampler2D tDepth;
uniform vec2 uAoTexel;
uniform float uStrength;
void main() {
  vec4 color = texture2D(tColor, vUv);
  float depth = texture2D(tDepth, vUv).r;
  // Blur the half-resolution estimate, but only across neighbours at a similar depth (no halo over an edge).
  float sum = 0.0;
  float weight = 0.0;
  for (int y = -2; y <= 2; y++)
    for (int x = -2; x <= 2; x++) {
      vec4 s = texture2D(tAo, vUv + vec2(float(x), float(y)) * uAoTexel);
      float w = 1.0 / (1.0 + abs(s.g - depth) * 6000.0);
      sum += s.r * w;
      weight += w;
    }
  float ao = depth >= 0.999999 ? 1.0 : sum / max(weight, 0.0001);
  // Occlusion removes sky light more than sunlight: keep a floor, and let the darkening lean slightly cool.
  float k = mix(1.0, ao, uStrength);
  gl_FragColor = vec4(color.rgb * mix(vec3(k), vec3(k * 0.97, k * 0.985, k), 1.0 - k), 1.0);
  if (uStrength > 5.0) gl_FragColor = vec4(vec3(ao), 1.0); // debug: ?debug&ao=show
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
}

/** `?debug&ao=show` draws the occlusion term alone (QA). */
const SHOW_AO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug') && new URLSearchParams(window.location.search).get('ao') === 'show';

function makeState() {
  const depth = new DepthTexture(4, 4);
  depth.type = FloatType;
  depth.minFilter = NearestFilter;
  depth.magFilter = NearestFilter;
  const scene = new WebGLRenderTarget(4, 4, { samples: 4, type: HalfFloatType, depthTexture: depth, minFilter: LinearFilter, magFilter: LinearFilter });
  const ao = new WebGLRenderTarget(4, 4, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const occlusion = occlusionMaterial();
  const composite = compositeMaterial();
  return { depth, scene, ao, occlusion, composite, quad: new Mesh(new PlaneGeometry(2, 2), occlusion), camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), size: new Vector2() };
}

/** Whether this renderer gets the occlusion pass (and, with it, manual frame accounting). */
export function aoSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.has('debug') && q.get('ao') === 'off') return false;
  return gpuCapable();
}

/** Takes over rendering (priority 1) when occlusion is supported. Mount it last. */
function OcclusionPass() {
  const scratch = useRef<ReturnType<typeof makeState> | null>(null);
  useEffect(
    () => () => {
      const s = scratch.current;
      if (!s) return;
      s.scene.dispose();
      s.depth.dispose();
      s.ao.dispose();
      s.occlusion.dispose();
      s.composite.dispose();
      s.quad.geometry.dispose();
      scratch.current = null;
    },
    [],
  );
  useFrame(({ gl, scene, camera }) => {
    const s = (scratch.current ??= makeState());
    const cam = camera as PerspectiveCamera;
    const buf = gl.getDrawingBufferSize(s.size);
    const w = Math.max(2, Math.floor(buf.x));
    const h = Math.max(2, Math.floor(buf.y));
    if (s.scene.width !== w || s.scene.height !== h) {
      s.scene.setSize(w, h);
      s.ao.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    }
    const strength = AO_STRENGTH * (1 - Math.min(1, mapMix.value / 0.5));

    // 1. The scene, without the outline layer.
    cam.layers.set(0);
    gl.setRenderTarget(s.scene);
    gl.clear();
    gl.render(scene, cam);

    // 2. Occlusion at half resolution (skipped while the dock map has it faded out).
    if (strength > 0.001) {
      s.occlusion.uniforms.tDepth!.value = s.depth;
      s.occlusion.uniforms.uProj!.value = cam.projectionMatrix;
      s.occlusion.uniforms.uProjInv!.value = cam.projectionMatrixInverse;
      (s.occlusion.uniforms.uTexel!.value as Vector2).set(1 / w, 1 / h);
      s.occlusion.uniforms.uAspect!.value = w / h;
      s.quad.material = s.occlusion;
      gl.setRenderTarget(s.ao);
      gl.render(s.quad, s.camera);
    }

    // 3. Composite to the canvas (tone mapping and output colour space happen here).
    s.composite.uniforms.tColor!.value = s.scene.texture;
    s.composite.uniforms.tAo!.value = s.ao.texture;
    s.composite.uniforms.tDepth!.value = s.depth;
    (s.composite.uniforms.uAoTexel!.value as Vector2).set(1 / s.ao.width, 1 / s.ao.height);
    s.composite.uniforms.uStrength!.value = SHOW_AO ? 9 : strength;
    s.quad.material = s.composite;
    gl.setRenderTarget(null);
    gl.render(s.quad, s.camera);

    // 4. Outlines on top, as authored.
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    cam.layers.set(OVERLAY_LAYER);
    gl.render(scene, cam);
    gl.autoClear = autoClear;
    cam.layers.set(0);
    cam.layers.enable(OVERLAY_LAYER);
  }, 1);
  return null;
}

/**
 * Frame accounting and the optional occlusion pass. With several render calls a frame, the renderer's counters
 * are reset once at the start of the frame (SceneRoot turns the per-call reset off), so `stats()` reports
 * everything the frame drew, the reflection pass included.
 */
export function PostProcessing() {
  const supported = useMemo(() => aoSupported(), []);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.layers.enable(OVERLAY_LAYER);
  }, [camera]);
  useFrame(({ gl: renderer }) => renderer.info.reset(), -1);
  const floatTargets = useMemo(() => gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float'), [gl]);
  return supported && floatTargets ? <OcclusionPass /> : null;
}
