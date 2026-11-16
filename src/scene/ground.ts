/**
 * Ground detail (TASKS T33). Land and ground paint keep their flat authored colours and placement; this adds
 * world-space variation from the shared noise texture, by kind, so lawn reads as mown grass with dry patches
 * and hard-standing reads as gravel, asphalt or concrete rather than one flat fill.
 *
 * The kind travels as a per-vertex `gkind` attribute (constant per polygon), so every ground surface still
 * shares one shader program.
 */
import { Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry, type MeshStandardMaterialParameters } from 'three';
import { detailUniform } from './detail.ts';
import { isLite, withTier } from './materials.ts';

export const GROUND = { grass: 0, gravel: 1, asphalt: 2, paving: 3, dryGrass: 4, concrete: 5, meadow: 6 } as const;
export type GroundKind = (typeof GROUND)[keyof typeof GROUND];

/** Tag every vertex of a geometry with one ground kind. */
export function withGroundKind<G extends BufferGeometry>(g: G, kind: GroundKind): G {
  const n = g.getAttribute('position').count;
  g.setAttribute('gkind', new Float32BufferAttribute(new Float32Array(n).fill(kind), 1));
  return g;
}

export function groundMaterial(params: MeshStandardMaterialParameters): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ roughness: 0.95, ...params });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = detailUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float gkind;\nvarying float vGKind;\nvarying vec3 vGWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGKind = gkind;\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGKind;\nvarying vec3 vGWorld;\nuniform sampler2D uDetail;\nfloat gIs(float k) { return 1.0 - step(0.5, abs(vGKind - k)); }')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
// Stone-scale grain fades to its mean once a grain is smaller than a pixel (otherwise it aliases into a hatch).
#ifdef HARBOR_LITE
vec4 gFine = vec4(0.5);
#else
float gPx = max(length(dFdx(vGWorld.xz)), length(dFdy(vGWorld.xz)));
vec4 gFine = mix(vec4(0.5), texture2D(uDetail, vGWorld.xz * 0.23), 1.0 - smoothstep(0.03, 0.1, gPx));
#endif
{
  vec2 gp = vGWorld.xz;
  // Each scale is sampled on a turned grid, so the lattice of one never lines up with another.
  #ifdef HARBOR_LITE
  // One lookup instead of four: broad tone drift only.
  vec4 gB = texture2D(uDetail, mat2(0.602, -0.799, 0.799, 0.602) * gp * 0.031 + 0.37);
  vec4 gA = gB.barg;
  vec4 gC = vec4(0.5);
  #else
  vec4 gA = texture2D(uDetail, mat2(0.829, 0.559, -0.559, 0.829) * gp * 0.0083);
  vec4 gB = texture2D(uDetail, mat2(0.602, -0.799, 0.799, 0.602) * gp * 0.031 + 0.37);
  vec4 gC = texture2D(uDetail, mat2(0.946, 0.326, -0.326, 0.946) * gp * 0.113 + 0.71);
  #endif
  float meadow = gIs(6.0) + gIs(4.0);
  float grassy = gIs(0.0) + meadow;
  // Lawn: broad drift between a cooler and a yellower green, blade-scale speckle, dry worn patches.
  float drift = smoothstep(0.2, 0.8, gA.r * 0.4 + gB.b * 0.35 + gC.r * 0.25);
  vec3 grass = diffuseColor.rgb * mix(vec3(0.74, 0.8, 0.78), vec3(1.02, 0.95, 0.86), drift);
  grass *= 0.84 + 0.32 * gFine.g;
  grass = mix(grass, vec3(dot(grass, vec3(0.3, 0.6, 0.1))), 0.16) * 0.94;
  grass = mix(grass, grass * vec3(1.22, 1.12, 0.86), smoothstep(0.5, 0.9, gB.a * 0.6 + gC.a * 0.4) * (0.4 + 0.4 * gIs(4.0)));
  // Unmown ground beyond the yard: straw-coloured stretches, darker scrub, bare earth showing through.
  vec3 rough = diffuseColor.rgb * mix(vec3(0.7, 0.8, 0.66), vec3(1.26, 1.14, 0.8), smoothstep(0.25, 0.75, gA.b * 0.5 + gB.r * 0.3 + gC.a * 0.2));
  rough = mix(rough, rough * vec3(0.72, 0.8, 0.66), smoothstep(0.55, 0.78, gA.a * 0.55 + gB.g * 0.45));
  rough = mix(rough, vec3(0.34, 0.3, 0.22), smoothstep(0.66, 0.92, gB.b * 0.6 + gC.g * 0.4) * 0.3);
  rough *= 0.82 + 0.36 * gFine.g;
  rough = mix(rough, vec3(dot(rough, vec3(0.3, 0.6, 0.1))), 0.3) * vec3(0.98, 0.93, 0.86);
  grass = mix(grass, rough, min(meadow, 1.0));
  // Hard ground: stone-scale speckle (strongest on gravel), broad tone drift, darker damp and oil patches.
  float speck = 0.16 + 0.22 * gIs(1.0) + 0.06 * gIs(2.0);
  vec3 hard = diffuseColor.rgb * (1.0 - speck * 0.5 + speck * gFine.g) * (0.93 + 0.14 * gA.b);
  float patches = gB.r * 0.5 + gC.b * 0.3 + gA.a * 0.2;
  hard *= 1.0 - (0.09 + 0.07 * gIs(2.0)) * smoothstep(0.38, 0.72, patches);
  hard = mix(hard, hard * vec3(1.06, 1.03, 0.97), smoothstep(0.4, 0.8, gB.a * 0.6 + gC.g * 0.4) * 0.6);
  diffuseColor.rgb = mix(hard, grass, min(grassy, 1.0));
}`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor - 0.12 * gIs(2.0) + (gFine.g - 0.5) * 0.1, 0.5, 1.0);');
    shader.fragmentShader = withTier(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => `harbor-ground${isLite() ? '-lite' : ''}`;
  return m;
}
