/**
 * Harbor Desk 3D view — the assumed marina, docks A–E, and its waterfront (TASKS T08, T14–T16). Lazily loaded by the shell.
 * The canvas is aria-hidden: the Slips / Vessels list is the accessible tree (DESIGN §14).
 * No remote assets: no HDRI presets, no CDN fonts or decoders (design/ASSET-PLAN.md).
 */
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import { CameraRig, type CameraDebug } from './CameraRig.tsx';
import { DebugBridge } from './DebugBridge.tsx';
import { Marina } from './Marina.tsx';
import { Environment } from './Environment.tsx';
import { BASE_FOV, PRESETS, type Preset } from './camera.ts';
import { MapLabels, MapMixDriver } from './MapLayer.tsx';
import { PlannedBoats, ScenePicker, ScheduledTraffic } from './Traffic.tsx';
import { Shore } from './Shore.tsx';
import { WaterReflection } from './Water.tsx';
import { PostProcessing } from './PostAO.tsx';
import { AdaptiveQuality } from './Quality.tsx';
import { MAX_DPR } from './quality.ts';
import { MAP_KEYBOARD_HELP } from './keyboardPan.ts';

export default function SceneRoot({
  rightInsetPx = 0,
  bottomInsetPx = 0,
  restingPreset = 'dock',
  onContextLost,
}: {
  rightInsetPx?: number;
  bottomInsetPx?: number;
  restingPreset?: Extract<Preset, 'dock' | 'map'>;
  onContextLost?: () => void;
}) {
  const [cameraDebug, setCameraDebug] = useState<CameraDebug | null>(null);
  return (
    <div
      className="map-navigation"
      data-map-navigation
      role="region"
      aria-label="Marina map"
      aria-description={MAP_KEYBOARD_HELP}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.target instanceof HTMLCanvasElement) event.currentTarget.focus({ preventScroll: true });
      }}
    >
      <Canvas
        onCreated={({ gl }) => {
          // T18: a lost WebGL context hands the map to the 2D plan. Records and selection live outside the scene.
          // R3F also releases the context on purpose when the canvas unmounts (e.g. switching to the plan); only a
          // loss on a canvas still in the document is a real failure.
          // Several render calls make one frame (reflection, scene, occlusion): PostProcessing resets the counters per frame.
          gl.info.autoReset = false;
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            window.setTimeout(() => {
              if (canvas.isConnected) onContextLost?.();
            }, 0);
          });
        }}
        aria-hidden="true"
        data-testid="scene-canvas"
        frameloop="demand"
        shadows
        dpr={[1, MAX_DPR]}
        camera={{ position: PRESETS.overview.position, fov: BASE_FOV, near: 2, far: 5000 }}
        gl={{ antialias: true, toneMapping: NeutralToneMapping, toneMappingExposure: 1 }}
      >
        <AdaptiveQuality />
        <Environment />
        <Shore />
        <Marina />
        <ScheduledTraffic />
        <PlannedBoats />
        <ScenePicker />
        <MapMixDriver />
        <MapLabels />
        <CameraRig rightInsetPx={rightInsetPx} bottomInsetPx={bottomInsetPx} restingPreset={restingPreset} onDebug={setCameraDebug} />
        {/* After the camera rig: the reflection pass mirrors this frame's camera. */}
        <WaterReflection />
        <DebugBridge cameraDebug={cameraDebug} />
        {/* Last: frame accounting, and on a capable GPU the ambient-occlusion pass that draws the frame. */}
        <PostProcessing />
      </Canvas>
    </div>
  );
}
