/**
 * Sky dome (TASKS T33): the same analytic sky the materials reflect (materials.ts), drawn behind the scene
 * with fair-weather cloud, a sun disc and, after dusk, stars. It follows the time of day through the shared
 * sky uniforms, and its horizon is the fog colour, so distant land and water fade into it without a seam.
 * No texture is downloaded: clouds come from the generated noise texture (detail.ts).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, ShaderMaterial, type Mesh } from 'three';
import { detailUniform } from './detail.ts';
import { CLOUD_GLSL, SKY_GLSL, ambientTime, skyUniforms, withTier } from './materials.ts';

const noRaycast = () => null;

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'harbor-sky',
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: { ...skyUniforms, uDetail: detailUniform, uAmbientTime: ambientTime },
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // on the far plane
}`,
    fragmentShader: withTier(/* glsl */ `
#include <common>
varying vec3 vDir;
${SKY_GLSL}
${CLOUD_GLSL}
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  // Below the horizon the dome is the haze colour: the far water and land fade into the same value.
  vec3 up = normalize(vec3(d.x, max(d.y, 0.0), d.z));
  vec3 col = harborSkyClouds(up);
  float s = max(dot(up, uSunDir), 0.0);
  float cover = harborCloudCover(up);
  col += uSunGlow * smoothstep(0.99955, 0.99985, s) * 4.0 * (1.0 - uNight) * (1.0 - cover);
  // Stars: sparse, only well above the horizon and only at night.
  vec3 cell = floor(up * 220.0);
  float star = step(0.9965, hash3(cell)) * smoothstep(0.12, 0.4, up.y) * (1.0 - cover);
  col += vec3(0.75, 0.82, 1.0) * star * uNight * uNight * 0.55;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`),
  });
}

export function Sky() {
  const material = useMemo(() => skyMaterial(), []);
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} name="sky-dome" material={material} frustumCulled={false} renderOrder={-10} raycast={noRaycast}>
      <sphereGeometry args={[100, 32, 16]} />
    </mesh>
  );
}
