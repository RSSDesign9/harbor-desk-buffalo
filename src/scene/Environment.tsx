/**
 * Land and lighting (TASKS T09, T15, T33). Water is in Water.tsx, the sky dome in Sky.tsx; yard, buildings and
 * bank dressing are in Shore.tsx.
 * - Soft daylight: one sun whose single shadow map follows the working view, a hemisphere fill, and an
 *   analytic sky reflection in the materials (no HDRI, no environment map; see materials.ts).
 * - Water is a plane at y = 0 with procedural ripple normals; land is authored masks with documented-water
 *   holes (data/GEOMETRY-VALIDATION.md). Ripples drift slowly (T17) only while ambient motion is allowed:
 *   paused by the pause-motion control, frozen under prefers-reduced-motion, stopped while the tab is hidden.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAmbientMotion } from '../app/prefs.ts';
import { Vector3, type DirectionalLight, type MeshStandardMaterial, type PerspectiveCamera } from 'three';
import { lensScale } from './camera.ts';
import { SITE } from '../data/site.ts';
import { prism } from './shapes.ts';
import { LAND_TOP } from './marina.ts';
import { ambientTime, setLampPools, skyUniforms, windUniform } from './materials.ts';
import { sceneWeather } from './weather.ts';
import { lakeAt, lakeScenario } from '../domain/lake.ts';
import { GROUND, groundMaterial, withGroundKind, type GroundKind } from './ground.ts';
import { Sky } from './Sky.tsx';
import { Water } from './Water.tsx';
import { gpuCapable } from './webgl.ts';
import { useAppState } from '../app/AppStore.tsx';
import { activeSession } from '../domain/store.ts';
import { daylightAt, localMinuteOf, overcast, sunDirection, type Daylight } from './daylight.ts';
import { Color, type HemisphereLight } from 'three';
import { invalidateShadows } from './quality.ts';
import { countShadowUpdate, shadowVersion } from './quality.ts';
import { SCENE_COLORS as S } from './palette.ts';

/** Current light (T31): follows the active session's clock, including the time scrubber. */
const sunState = { sunDir: new Vector3(), daylight: daylightAt(9 * 60) as Daylight };
sunState.sunDir.set(...sunDirection(sunState.daylight));
/** The daylight now applied (QA: the debug bridge reads it). */
export const currentDaylight = () => sunState.daylight;

/**
 * Shadow map size. A capable GPU gets 4096²: at the working view a texel is then about 2 cm, fine enough for
 * rails and rigging to cast lines instead of a speckle (T33). Software and low-power renderers keep 2048².
 */
const SHADOW_MAP = gpuCapable() ? 4096 : 2048;

/** One shadow-casting sun. The shadow frustum is refitted to the camera target so near views get sharp contact shadows. */
function Sun() {
  const light = useRef<DirectionalLight>(null);
  const controls = useThree((s) => s.controls) as { getTarget?: (v: Vector3) => Vector3 } | null;
  const target = useMemo(() => new Vector3(), []);
  const seen = useRef({ version: 0, tx: NaN, tz: NaN, half: 0, frames: 0 });
  useFrame(({ camera, gl }) => {
    const l = light.current;
    if (!l) return;
    if (controls?.getTarget) controls.getTarget(target);
    // Distance the normal lens would need for this framing (the 2° map lens stands much farther back; T29).
    const lens = lensScale((camera as PerspectiveCamera).fov);
    const reach = camera.position.distanceTo(target) / lens;
    // Quantised so the frustum (and the shadow texels) do not crawl during small camera moves. The dock map
    // spans the whole 700 m frontage, so it gets a wider (coarser) shadow frustum.
    const half = Math.min(lens > 1.0001 ? 420 : 280, Math.max(34, Math.ceil((reach * 0.8) / 12) * 12));
    const texel = (half * 2) / SHADOW_MAP;
    // Wider shadow frusta have larger texels: lift the receiver further off its own shadow, or faces the sun
    // only grazes (the shaded side of the elevator) fill with a hatch of self-shadow.
    l.shadow.normalBias = Math.max(0.04, texel * 0.6);
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    l.target.position.set(tx, 0, tz);
    l.position.set(tx, 0, tz).addScaledVector(sunState.sunDir, 420);
    l.target.updateMatrixWorld();
    l.color.set(sunState.daylight.sunColor);
    l.intensity = sunState.daylight.sunIntensity;
    const c = l.shadow.camera;
    if (c.right !== half) {
      c.left = -half;
      c.right = half;
      c.top = half;
      c.bottom = -half;
      c.updateProjectionMatrix();
    }
    // Redraw the shadow map only when the frustum moved or a caster changed (quality.ts). The first frames
    // always redraw, while instanced props are still being placed.
    const k = seen.current;
    gl.shadowMap.autoUpdate = false;
    if (k.frames < 4 || k.version !== shadowVersion() || k.tx !== tx || k.tz !== tz || k.half !== half) {
      seen.current = { version: shadowVersion(), tx, tz, half, frames: k.frames + 1 };
      gl.shadowMap.needsUpdate = true;
      countShadowUpdate();
    }
  });
  return <directionalLight ref={light} color="#fff4e2" intensity={2.3} castShadow shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]} shadow-camera-near={40} shadow-camera-far={900} shadow-bias={-0.0003} shadow-normalBias={0.04} shadow-radius={2.5} />;
}

/** Ambient clock (seconds), shared with the materials. Advances only while motion runs, so pausing freezes the surface exactly. */
export const waterTime = ambientTime;
/** Ambient frame rate: slow drift needs no more, and it halves the cost of continuous rendering. */
export const AMBIENT_FPS = 30;

/**
 * Drives the ripple drift. With frameloop="demand", ambient frames are requested here and nowhere else; when
 * motion is paused or reduced, or the document is hidden, no frame is requested at all (the idle scene is still).
 */
function WaterMotion() {
  const running = useAmbientMotion();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (document.hidden) {
        last = now;
        return;
      }
      waterTime.value += Math.min(0.1, (now - last) / 1000);
      last = now;
      invalidate();
    }, 1000 / AMBIENT_FPS);
    return () => window.clearInterval(id);
  }, [running, invalidate]);
  return null;
}

/**
 * Lighting follows the clock (T31, T33): sun direction, colour and strength, the sky fill, the background and
 * fog, and the sky reflection. Applied only when the minute changes; the shadow map is redrawn then.
 */
function applyDaylight(d: Daylight) {
  sunState.daylight = d;
  sunState.sunDir.set(...sunDirection(d));
  skyUniforms.uSunDir.value.copy(sunState.sunDir);
  skyUniforms.uSkyLight.value = d.skyLight;
  skyUniforms.uSkyHorizon.value.set(d.sky);
  skyUniforms.uSkyZenith.value.set(d.zenith);
  skyUniforms.uSunGlow.value.set(d.glow);
  skyUniforms.uCloud.value.set(d.cloud);
  skyUniforms.uNight.value = d.night;
  setLampPools(d.night);
  // What glossy surfaces see below the horizon darkens with the light.
  skyUniforms.uSkyGround.value.set(S.skyGround).multiplyScalar(0.25 + 0.75 * d.skyLight);
}

function TimeOfDay() {
  const state = useAppState();
  const clock = state ? activeSession(state).clock : null;
  // T35: the lake what-if at the clock: wind on the water and an overcast sky (none on the calm day).
  const sc = state ? lakeScenario(state.fixtures, state.lake) : undefined;
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!clock) return;
    const w = sceneWeather(sc ? lakeAt(sc, clock) : { windFromDeg: 0, wind_kt: 0 });
    windUniform.value.set(w.toward[0], w.toward[1], w.strength, w.whitecaps);
    const d = overcast(daylightAt(localMinuteOf(clock)), w.overcast);
    applyDaylight(d);
    const { scene, gl } = get();
    // The eye adapts as the light goes: a little more exposure at night keeps the docks readable.
    gl.toneMappingExposure = 1 + 0.75 * d.night;
    const sky = new Color(d.sky);
    if (scene.background instanceof Color) scene.background.copy(sky);
    scene.fog?.color.copy(sky);
    const fill = scene.getObjectByName('sky-fill') as HemisphereLight | undefined;
    if (fill) {
      fill.intensity = d.hemiIntensity;
      fill.color.set(d.fill);
    }
    invalidateShadows();
    invalidate();
  }, [clock, sc, get, invalidate]);
  return null;
}

const landKind: Record<string, GroundKind> = { 'land-west': GROUND.meadow, 'land-east': GROUND.dryGrass, 'land-north': GROUND.concrete };

export function Environment() {
  // Land masks: authored (ASSUME) with documented-water holes. West is the marina side; the peninsula and
  // the north bank are approximate context and stay plain (no landmarks are sourced for them).
  const land = useMemo(() => SITE.land.map((l) => ({ id: l.id, geo: withGroundKind(prism(l.ring, LAND_TOP + 0.6, l.holes), landKind[l.id] ?? GROUND.grass) })), []);
  const landMaterials = useMemo(() => {
    const side = groundMaterial({ color: S.bankWall });
    const top = (color: string) => [groundMaterial({ color }), side];
    return { 'land-west': top(S.grass), 'land-east': top(S.dryGrass), 'land-north': top(S.wharf) } as Record<string, MeshStandardMaterial[]>;
  }, []);

  return (
    <group name="environment">
      <color attach="background" args={[S.sky]} />
      <fog attach="fog" args={[S.sky, 650, 2400]} />
      <Sky />
      {/* Sky fill: a hemisphere light for diffuse, an analytic sky reflection in the materials for gloss. */}
      <hemisphereLight name="sky-fill" args={[S.skyFill, S.skyBounce, 1.08]} />
      <Sun />
      <TimeOfDay />
      <WaterMotion />
      <Water />

      {land.map((l) => (
        <mesh key={l.id} name={l.id} geometry={l.geo} material={landMaterials[l.id] ?? landMaterials["land-west"]!} position-y={-0.6} receiveShadow />
      ))}
    </group>
  );
}
