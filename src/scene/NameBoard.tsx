/**
 * Name board and registration panels for a hull whose identity has been CONFIRMED (PRD §7 resolved row: “same
 * hull becomes labeled Lake Effect, without teleporting”). The text arrives as data from the identity
 * decision; the hull geometry is untouched (it is a separate child mesh). Never drawn for an unverified hull.
 * Text is painted into a canvas with the locally loaded Commissioner / Atkinson Hyperlegible Mono faces: no remote
 * font. Canvas cannot set the FLAR axis, so the painted name uses Commissioner's default (unflared) instance.
 */
import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, DoubleSide, Matrix4, MeshLambertMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { cruiserDecals, type DecalPlacement } from './assets/nameboard.ts';

export interface NameBoardData {
  name: string;
  registrationSuffix: string | null;
}

const NAVY = '#14294a';
const textures = new Map<string, CanvasTexture>();
let fontsReady: Promise<unknown> | null = null;
const loadFonts = () =>
  (fontsReady ??= document.fonts
    ? Promise.all([document.fonts.load('700 96px "Commissioner"'), document.fonts.load('500 64px "Atkinson Hyperlegible Mono"')]).catch(() => undefined)
    : Promise.resolve());

function paint(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  let tex = textures.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  textures.set(key, tex);
  return tex;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, start: number) {
  let px = start;
  ctx.font = font(px);
  while (px > 10 && ctx.measureText(text).width > maxW) ctx.font = font((px -= 4));
}

function nameTexture(name: string) {
  return paint(`name|${name}`, 1024, 244, (ctx) => {
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, name.toUpperCase(), (px) => `700 ${px}px "Commissioner", sans-serif`, 960, 150);
    ctx.fillText(name.toUpperCase(), 512, 112);
    ctx.fillRect(212, 206, 600, 8);
  });
}

function registrationTexture(suffix: string) {
  return paint(`reg|${suffix}`, 640, 128, (ctx) => {
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `•••• ${suffix}`;
    fitText(ctx, text, (px) => `500 ${px}px "Atkinson Hyperlegible Mono", monospace`, 600, 92);
    ctx.fillText(text, 320, 68);
  });
}

const plane = new PlaneGeometry(1, 1);
function Decal({ at, texture }: { at: DecalPlacement; texture: CanvasTexture }) {
  const quaternion = useMemo(
    () => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...at.xAxis), new Vector3(...at.yAxis), new Vector3(...at.normal))),
    [at],
  );
  const material = useMemo(() => new MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), [texture]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh name="name-board" geometry={plane} material={material} position={at.position} quaternion={quaternion} scale={[at.width, at.height, 1]} raycast={() => null} renderOrder={2} />;
}

export function NameBoard({ data, lengthM, beamM }: { data: NameBoardData; lengthM: number; beamM: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadFonts().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const decals = useMemo(() => cruiserDecals(lengthM, beamM), [lengthM, beamM]);
  if (!ready) return null;
  return (
    <group name="name-boards">
      <Decal at={decals.name} texture={nameTexture(data.name)} />
      {data.registrationSuffix ? decals.registration.map((r, i) => <Decal key={i} at={r} texture={registrationTexture(data.registrationSuffix!)} />) : null}
    </group>
  );
}
