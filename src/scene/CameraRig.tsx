/**
 * Camera system (TASKS T08, DESIGN §7).
 * - User orbit/pan/zoom: camera-controls with bounds, distance and polar limits.
 * - Fly-to: our own 700 ms eased flight from the CURRENT pose. A new request replaces the running one; any
 *   user input cancels it. Reduced motion → immediate cut.
 * - Selection drives the camera; the camera never writes selection.
 * - Framing offset: the projection centre shifts left by half the right rail, so targets sit in the open scene.
 * - Opening shot (T24): once the scene has drawn, one 3 s move from the overview to the resting preset (Dock B,
 *   or the dock map on a small screen); see intro.ts.
 * - Dock map (T29): a 2° lens framed on all 126 berths inside the canvas area the panels leave free (measured
 *   from the DOM at request time). A flight that changes lens is a dolly-zoom (camera.ts interpolatePose); user
 *   input during one lands it at its end, so the controls never take over at an in-between lens. While the map
 *   is up a selection keeps the map (mapSlipPose) instead of flying down to the berth.
 * - Lens bookkeeping every frame: near/far planes and fog follow the lens, so a long lens far away clips and
 *   fogs like the normal lens at the equivalent distance.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Fog, PerspectiveCamera } from 'three';
import { Box3, Vector3 } from 'three';
import { useAppState } from '../app/AppStore.tsx';
import { ambientMotionAllowed } from '../app/prefs.ts';
import { activeSession } from '../domain/store.ts';
import { slipGeom } from '../data/site.ts';
import { frameTarget } from '../features/registry/model.ts';
import {
  BASE_FOV,
  CAMERA_BOUNDS,
  CAMERA_DURATION_MS,
  DISTANCE_LIMITS,
  ESTABLISHING_POSE,
  MAX_POLAR,
  PRESETS,
  easeCamera,
  interpolatePose,
  lensScale,
  mapPose,
  mapSlipPose,
  poseFov,
  pxPerMetre,
  slipPose,
  type MapViewport,
  type Pose,
  type Preset,
  type Rect,
  type Vec3,
  freeRect,
} from './camera.ts';
import { getMapMode, prefersReducedMotion, setMapMode, useViewRequest } from './viewRequests.ts';
import { INTRO_DURATION_MS, POSTER_FADE_MS, getIntroPhase, setIntroPhase } from './intro.ts';
import { KEYBOARD_PAN_PX, keyboardPanDirection } from './keyboardPan.ts';

interface Flight {
  from: Pose;
  to: Pose;
  start: number;
  id: number;
  duration: number;
  /** The opening shot: skippable, and it ends the intro when it lands. */
  intro: boolean;
}

export interface CameraDebug {
  /** Position, target and lens (fov, degrees). */
  pose(): Pose;
  /** Pixels per metre at the target, and the canvas area the map framing treats as free of panels. */
  map(): { pxPerM: number; viewport: MapViewport };
  flying(): boolean;
  flightsStarted(): number;
  lastFlightTarget(): Vec3 | null;
  /** Test-only: place the camera immediately (used to put a berth behind a panel). */
  jump(pose: Pose): void;
  /** The opening shot's start pose (scripts/render-poster.ts renders the poster from it). */
  establishing: Pose;
}

/** Panels that may sit over the canvas. The map is fitted into what they leave free. */
const OBSTRUCTIONS = ['.topbar', '.summary-zone', '.notice-zone', '.rail', '.bottom-left-zone', '.view-controls', '.scene-layer > .map-legend', '.scene-poster'];
export function CameraRig({
  rightInsetPx,
  bottomInsetPx = 0,
  restingPreset = 'dock',
  onDebug,
}: {
  rightInsetPx: number;
  bottomInsetPx?: number;
  restingPreset?: 'dock' | 'map';
  onDebug?: (d: CameraDebug) => void;
}) {
  const controls = useRef<CameraControls>(null);
  const flight = useRef<Flight | null>(null);
  const flights = useRef(0);
  const { camera, size, invalidate, gl } = useThree();
  // Lens changes write to the live camera and fog; read them through get() (not render-time values).
  const get = useThree((s) => s.get);
  const liveCamera = () => get().camera as PerspectiveCamera;
  const insets = useRef({ x: 0, y: 0 });
  const state = useAppState();
  const viewRequest = useViewRequest();

  // Framing offset for the inspector rail.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const d = Math.min(rightInsetPx / 2, size.width / 4);
    // A bottom sheet (mobile 3D) shifts the framing up the same way the rail shifts it left.
    const v = Math.min(bottomInsetPx / 2, size.height / 4);
    insets.current = { x: d, y: v };
    if (d > 0 || v > 0) cam.setViewOffset(size.width + 2 * d, size.height + 2 * v, 2 * d, 2 * v, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, rightInsetPx, bottomInsetPx, invalidate]);

  const currentPose = (): Pose => {
    const c = controls.current!;
    const p = c.getPosition(new Vector3());
    const t = c.getTarget(new Vector3());
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z], fov: liveCamera().fov };
  };

  /** The canvas as the map framing sees it: size, view-offset insets and the area not under a panel. */
  const viewport = (): MapViewport => {
    const canvas = gl.domElement.getBoundingClientRect();
    const panels: Rect[] = [];
    for (const sel of OBSTRUCTIONS) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        if (sel === '.scene-poster') continue; // decorative, fades away; listed so it is never mistaken for a panel
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        panels.push({ left: r.left - canvas.left, top: r.top - canvas.top, right: r.right - canvas.left, bottom: r.bottom - canvas.top });
      }
    }
    return { width: size.width, height: size.height, insetX: insets.current.x, insetY: insets.current.y, free: freeRect(size.width, size.height, panels) };
  };

  const poseFor = (preset: Preset): Pose => (preset === 'map' ? mapPose(viewport()) : PRESETS[preset]);

  /** Lens and dolly limits: the user's zoom range scales with the lens, and always includes the map's own framing. */
  const applyLens = (fov: number, poseDistance?: number) => {
    const cam = liveCamera();
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const c = controls.current;
    if (!c) return;
    const k = lensScale(fov);
    c.minDistance = DISTANCE_LIMITS.min * k;
    c.maxDistance = Math.max(DISTANCE_LIMITS.max * k, (poseDistance ?? 0) * 2.5);
  };
  const poseDistance = (p: Pose) => Math.hypot(p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2]);

  const flyTo = (to: Pose, opts: { duration?: number; intro?: boolean; delay?: number } = {}) => {
    const c = controls.current;
    if (!c) return;
    if (flight.current?.intro) setIntroPhase('done'); // a selection or preset during the intro takes over
    flights.current += 1;
    if (prefersReducedMotion()) {
      flight.current = null;
      applyLens(poseFov(to), poseDistance(to));
      void c.setLookAt(...to.position, ...to.target, false);
      invalidate();
      return;
    }
    // Limits must admit every distance the flight passes through (a dolly-zoom reaches far beyond the normal range).
    c.minDistance = 0;
    c.maxDistance = Infinity;
    // Interruptible: always start from wherever the camera is now, discarding any running flight.
    flight.current = { from: currentPose(), to, start: performance.now() + (opts.delay ?? 0), id: flights.current, duration: opts.duration ?? CAMERA_DURATION_MS, intro: opts.intro === true };
    invalidate();
  };

  const land = (pose: Pose) => {
    flight.current = null;
    applyLens(poseFov(pose), poseDistance(pose));
    void controls.current?.setLookAt(...pose.position, ...pose.target, false);
    invalidate();
  };

  // Opening shot. Starts after the second frame, i.e. once the first one is on screen, so the poster can fade
  // onto a drawn scene. A selection restored from storage, paused motion or reduced motion skip the move.
  const framesDrawn = useRef(0);
  const hasTarget = useRef(false);
  const startIntro = () => {
    if (getIntroPhase() !== 'poster') return; // remounted scene (e.g. “Restart 3D view”): no second intro
    // A selection (restored, or made from the list before the first frame) owns the camera.
    if (hasTarget.current || flight.current) return setIntroPhase('done');
    if (restingPreset === 'map') setMapMode(true);
    const end = poseFor(restingPreset);
    if (!ambientMotionAllowed() || prefersReducedMotion()) {
      land(end);
      return setIntroPhase('done');
    }
    setIntroPhase('flying');
    flyTo(end, { duration: INTRO_DURATION_MS, intro: true, delay: POSTER_FADE_MS });
  };

  // Click, key or wheel anywhere skips the move to its end pose (capture phase: before any other handler).
  useEffect(() => {
    const skip = () => {
      const f = flight.current;
      if (!f?.intro) return;
      land(f.to);
      setIntroPhase('done');
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    return () => {
      window.removeEventListener('pointerdown', skip, opts);
      window.removeEventListener('keydown', skip, opts);
      window.removeEventListener('wheel', skip, opts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Near/far planes and fog follow the lens: a long lens stands far back, so the clip range moves with it, and fog
  // starts where it would for the normal lens at the equivalent distance (same look, good depth precision).
  const fogBase = useRef<{ near: number; far: number } | null>(null);
  const syncLens = () => {
    const cam = liveCamera();
    const c = controls.current;
    const fog = get().scene.fog as Fog | null;
    if (fog && !fogBase.current) fogBase.current = { near: fog.near, far: fog.far };
    const dist = c ? c.distance : cam.position.length();
    const k = lensScale(cam.fov);
    const shift = k > 1.0001 ? dist * (1 - 1 / k) : 0;
    const near = shift > 0 ? Math.max(2, dist - 2500) : 2;
    const far = shift > 0 ? dist + 3000 : 5000;
    if (cam.near !== near || cam.far !== far) {
      cam.near = near;
      cam.far = far;
      cam.updateProjectionMatrix();
    }
    if (fog && fogBase.current) {
      fog.near = fogBase.current.near + shift;
      fog.far = fogBase.current.far + shift;
    }
  };

  useFrame(() => {
    syncLens();
    if (framesDrawn.current < 2) {
      framesDrawn.current += 1;
      if (framesDrawn.current === 2) startIntro();
      else invalidate();
    }
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    // A hidden tab gets no opening shot: land it, so nothing keeps requesting frames in the background.
    if (f.intro && document.hidden) {
      land(f.to);
      setIntroPhase('done');
      return;
    }
    const k = Math.max(0, Math.min(1, (performance.now() - f.start) / f.duration));
    const e = easeCamera(k);
    const p = interpolatePose(f.from, f.to, e);
    const cam = liveCamera();
    if (cam.fov !== p.fov) {
      cam.fov = p.fov;
      cam.updateProjectionMatrix();
    }
    void c.setLookAt(...p.position, ...p.target, false);
    syncLens();
    if (k >= 1) {
      flight.current = null;
      applyLens(poseFov(f.to), poseDistance(f.to));
      if (f.intro) setIntroPhase('done');
    } else invalidate();
  });

  // Bounds and limits.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setBoundary(new Box3(new Vector3(...CAMERA_BOUNDS.min), new Vector3(...CAMERA_BOUNDS.max)));
    c.maxPolarAngle = MAX_POLAR;
    c.dollyToCursor = true;
    // A small screen rests on the dock map: it is up from the first frame, so a restored selection keeps it.
    if (restingPreset === 'map' && getIntroPhase() === 'poster') setMapMode(true);
    // First mount: the poster's pose, where the opening shot starts. A remount after the intro (e.g. “Restart
    // 3D view”): the map if it was up, else the overview.
    const start = getIntroPhase() === 'poster' ? ESTABLISHING_POSE : getMapMode() ? poseFor('map') : PRESETS.overview;
    applyLens(poseFov(start), poseDistance(start));
    void c.setLookAt(...start.position, ...start.target, false);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate]);

  // Selection drives the camera (list or scene). Camera motion never changes selection.
  const session = state ? activeSession(state) : null;
  const target = state && session ? frameTarget(state.fixtures, session) : null;
  const targetKey = target ? `${target.slipId}:${session?.selection?.kind}:${session?.selection?.id}` : null;
  useEffect(() => {
    hasTarget.current = target !== null;
  });
  useEffect(() => {
    if (!target) return;
    const g = slipGeom(target.slipId);
    if (g) flyTo(getMapMode() ? mapSlipPose(g, viewport(), currentPose()) : slipPose(g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Preset / reset requests from the DOM controls.
  const firstRequest = useRef(true);
  useEffect(() => {
    if (firstRequest.current) {
      firstRequest.current = false;
      return;
    }
    flyTo(poseFor(viewRequest.preset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRequest.nonce]);

  useEffect(() => {
    onDebug?.({
      pose: () => (controls.current ? currentPose() : { position: [0, 0, 0], target: [0, 0, 0], fov: BASE_FOV }),
      map: () => {
        const vp = viewport();
        return { pxPerM: controls.current ? pxPerMetre(currentPose(), vp) : 0, viewport: vp };
      },
      flying: () => flight.current !== null,
      flightsStarted: () => flights.current,
      lastFlightTarget: () => flight.current?.to.target ?? null,
      jump: (pose) => land(pose.fov === undefined ? { ...pose, fov: liveCamera().fov } : pose),
      establishing: ESTABLISHING_POSE,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDebug, invalidate]);

  const interruptFlight = () => {
    // A lens-changing flight must land before manual navigation takes over.
    const f = flight.current;
    if (f?.intro) setIntroPhase('done');
    if (f && poseFov(f.from) !== poseFov(f.to)) land(f.to);
    else if (f && controls.current) applyLens(liveCamera().fov, controls.current.distance);
    flight.current = null;
  };

  useEffect(() => {
    const surface = gl.domElement.closest<HTMLElement>('[data-map-navigation]');
    if (!surface) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== surface) return;
      const direction = keyboardPanDirection(event);
      const c = controls.current;
      if (!direction || !c || !c.enabled) return;
      event.preventDefault();
      interruptFlight();
      // A landed flight updates the control pose before the next rendered camera matrix.
      c.update(0);
      const step = KEYBOARD_PAN_PX / pxPerMetre(currentPose(), { height: size.height, insetY: insets.current.y });
      // Pan along the water plane in screen-relative directions, at the current zoom.
      // Immediate steps also respect reduced motion; native key repeat handles held arrows.
      void c.truck(direction[0] * step, 0, false);
      void c.forward(-direction[1] * step / Math.max(0.1, Math.cos(c.polarAngle)), false);
      invalidate();
    };
    surface.addEventListener('keydown', onKeyDown);
    return () => surface.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, size.height, invalidate]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.2}
      onStart={interruptFlight}
    />
  );
}
